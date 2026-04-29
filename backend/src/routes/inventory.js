import { Router } from 'express';
import { Inventory, InventoryMovement, Product } from '../models/index.js';
import { protect, authorize } from '../middleware/auth.js';
import mongoose from 'mongoose';

const router = Router();
router.use(protect);

// Get inventory for a warehouse
router.get('/', async (req, res) => {
  try {
    const { warehouse, product } = req.query;
    const query = {};
    if (warehouse) query.warehouse = warehouse;
    if (product) query.product = product;

    const inventory = await Inventory.find(query)
      .populate({ path: 'product', match: { isActive: true }, populate: [{ path: 'category', select: 'name' }, { path: 'vendors', select: 'name' }, { path: 'setComponents.product', select: 'name sku' }] })
      .populate('warehouse', 'name code');

    const filtered = inventory.filter(i => i.product);
    res.json({ success: true, data: filtered });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Adjust stock (manual adjustment)
router.post('/adjust', authorize('admin', 'inventory_manager'), async (req, res) => {
  try {
    const { productId, warehouseId, quantity, type = 'adjustment', notes, reference, unit = 'pieces' } = req.body;

    const product = await Product.findById(productId);
    const isBoxProduct = product?.productType === 'box';
    const operateOnLoose = isBoxProduct && unit === 'pieces';

    let inv = await Inventory.findOne({ product: productId, warehouse: warehouseId });
    if (!inv) {
      inv = await Inventory.findOneAndUpdate(
        { product: productId, warehouse: warehouseId },
        { $setOnInsert: { product: productId, warehouse: warehouseId, quantity: 0, looseQuantity: 0, reservedQuantity: 0 } },
        { upsert: true, new: true }
      );
    }

    const prevQty = operateOnLoose ? (inv.looseQuantity || 0) : inv.quantity;

    if (operateOnLoose) {
      if (type === 'adjustment') {
        inv.looseQuantity = Number(quantity);
      } else if (type === 'in') {
        inv.looseQuantity = (inv.looseQuantity || 0) + Number(quantity);
      } else if (type === 'out') {
        if ((inv.looseQuantity || 0) < quantity) return res.status(400).json({ success: false, message: 'Insufficient loose pieces' });
        inv.looseQuantity = (inv.looseQuantity || 0) - Number(quantity);
      }
    } else {
      if (type === 'adjustment') {
        inv.quantity = Number(quantity);
      } else if (type === 'in') {
        inv.quantity += Number(quantity);
      } else if (type === 'out') {
        if (inv.quantity < quantity) return res.status(400).json({ success: false, message: 'Insufficient stock' });
        inv.quantity -= Number(quantity);
      }
    }
    await inv.save();

    await InventoryMovement.create({
      product: productId,
      warehouse: warehouseId,
      type,
      movementUnit: unit,
      quantity,
      previousQuantity: prevQty,
      newQuantity: operateOnLoose ? inv.looseQuantity : inv.quantity,
      reference,
      notes,
      performedBy: req.user._id,
    });

    res.json({ success: true, data: inv });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Open boxes → convert whole boxes into loose pieces
router.post('/open-box', authorize('admin', 'inventory_manager'), async (req, res) => {
  try {
    const { productId, warehouseId, boxCount, notes } = req.body;
    if (!boxCount || boxCount < 1) return res.status(400).json({ success: false, message: 'boxCount must be at least 1' });

    const product = await Product.findById(productId);
    if (!product || product.productType !== 'box')
      return res.status(400).json({ success: false, message: 'Product is not a box type' });

    const inv = await Inventory.findOne({ product: productId, warehouse: warehouseId });
    if (!inv || inv.quantity < boxCount)
      return res.status(400).json({ success: false, message: 'Insufficient boxes in stock' });

    const piecesReleased = boxCount * (product.piecesPerBox || 1);
    const prevBoxQty = inv.quantity;
    inv.quantity -= boxCount;
    inv.looseQuantity = (inv.looseQuantity || 0) + piecesReleased;
    await inv.save();

    await InventoryMovement.create({
      product: productId,
      warehouse: warehouseId,
      type: 'adjustment',
      movementUnit: 'boxes',
      quantity: boxCount,
      previousQuantity: prevBoxQty,
      newQuantity: inv.quantity,
      reference: `OPEN-BOX`,
      referenceType: 'adjustment',
      notes: notes || `Opened ${boxCount} box${boxCount > 1 ? 'es' : ''} → ${piecesReleased} loose pieces`,
      performedBy: req.user._id,
    });

    res.json({ success: true, data: inv, piecesReleased });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Break a set product into its components
router.post('/break-set', authorize('admin', 'inventory_manager'), async (req, res) => {
  try {
    const { setProductId, warehouseId, setCount = 1, notes } = req.body;

    const setProduct = await Product.findById(setProductId)
      .populate('setComponents.product', 'name sku productType piecesPerBox');
    if (!setProduct || setProduct.productType !== 'set')
      return res.status(400).json({ success: false, message: 'Product is not a set' });
    if (!setProduct.setComponents?.length)
      return res.status(400).json({ success: false, message: 'Set has no components defined' });

    const setInv = await Inventory.findOne({ product: setProductId, warehouse: warehouseId });
    if (!setInv || setInv.quantity < setCount)
      return res.status(400).json({ success: false, message: `Only ${setInv?.quantity || 0} sets in stock` });

    const prevSetQty = setInv.quantity;
    setInv.quantity -= setCount;
    await setInv.save();

    await InventoryMovement.create({
      product: setProductId, warehouse: warehouseId,
      type: 'out', movementUnit: 'pieces', quantity: setCount,
      previousQuantity: prevSetQty, newQuantity: setInv.quantity,
      reference: 'BREAK-SET', referenceType: 'adjustment',
      notes: notes || `Broke ${setCount} set${setCount > 1 ? 's' : ''} into components`,
      performedBy: req.user._id,
    });

    const released = [];
    for (const comp of setProduct.setComponents) {
      const compId = comp.product?._id || comp.product;
      const compQty = (comp.quantity || 1) * setCount;
      const isBoxComp = comp.product?.productType === 'box';

      let compInv = await Inventory.findOneAndUpdate(
        { product: compId, warehouse: warehouseId },
        { $setOnInsert: { product: compId, warehouse: warehouseId, quantity: 0, looseQuantity: 0, reservedQuantity: 0 } },
        { upsert: true, new: true }
      );

      const prevQty = isBoxComp ? (compInv.looseQuantity || 0) : compInv.quantity;
      if (isBoxComp) {
        compInv.looseQuantity = (compInv.looseQuantity || 0) + compQty;
      } else {
        compInv.quantity += compQty;
      }
      await compInv.save();

      await InventoryMovement.create({
        product: compId, warehouse: warehouseId,
        type: 'in', movementUnit: 'pieces', quantity: compQty,
        previousQuantity: prevQty, newQuantity: isBoxComp ? compInv.looseQuantity : compInv.quantity,
        reference: 'BREAK-SET', referenceType: 'adjustment',
        notes: `Released from ${setCount} broken ${setProduct.name}`,
        performedBy: req.user._id,
      });

      released.push({ product: comp.product, quantityAdded: compQty, newTotal: isBoxComp ? compInv.looseQuantity : compInv.quantity });
    }

    res.json({ success: true, data: { setInv, released } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Transfer between warehouses
router.post('/transfer', authorize('admin', 'inventory_manager'), async (req, res) => {
  try {
    const { productId, fromWarehouseId, toWarehouseId, quantity, notes } = req.body;

    const fromInv = await Inventory.findOne({ product: productId, warehouse: fromWarehouseId });
    if (!fromInv || fromInv.quantity < quantity)
      return res.status(400).json({ success: false, message: 'Insufficient stock in source warehouse' });

    let toInv = await Inventory.findOne({ product: productId, warehouse: toWarehouseId });
    if (!toInv) toInv = await Inventory.create({ product: productId, warehouse: toWarehouseId, quantity: 0 });

    const ref = `TRF-${Date.now()}`;
    fromInv.quantity -= quantity;
    toInv.quantity += quantity;
    await fromInv.save();
    await toInv.save();

    await InventoryMovement.create([
      { product: productId, warehouse: fromWarehouseId, type: 'transfer', quantity: -quantity, previousQuantity: fromInv.quantity + quantity, newQuantity: fromInv.quantity, reference: ref, referenceType: 'transfer', notes, performedBy: req.user._id },
      { product: productId, warehouse: toWarehouseId, type: 'transfer', quantity, previousQuantity: toInv.quantity - quantity, newQuantity: toInv.quantity, reference: ref, referenceType: 'transfer', notes, performedBy: req.user._id },
    ]);

    res.json({ success: true, message: 'Transfer completed', data: { from: fromInv, to: toInv } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Inventory movements history
router.get('/movements', async (req, res) => {
  try {
    const { warehouse, product, type, page = 1, limit = 50 } = req.query;
    const query = {};
    if (warehouse) query.warehouse = warehouse;
    if (product) query.product = product;
    if (type) query.type = type;

    const total = await InventoryMovement.countDocuments(query);
    const movements = await InventoryMovement.find(query)
      .populate('product', 'name sku')
      .populate('warehouse', 'name code')
      .populate('performedBy', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, data: movements, total });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

export default router;
