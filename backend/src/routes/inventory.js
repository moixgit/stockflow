import { Router } from 'express';
import { Inventory, InventoryMovement, Product } from '../models/index.js';
import { protect, authorize } from '../middleware/auth.js';

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
      .populate({ path: 'product', match: { isActive: true }, populate: [{ path: 'category', select: 'name' }, { path: 'vendors', select: 'name' }] })
      .populate('warehouse', 'name code');

    const filtered = inventory.filter(i => i.product);
    res.json({ success: true, data: filtered });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Adjust stock (manual adjustment)
router.post('/adjust', authorize('admin', 'inventory_manager'), async (req, res) => {
  try {
    const { productId, warehouseId, quantity, type = 'adjustment', notes, reference } = req.body;

    let inv = await Inventory.findOne({ product: productId, warehouse: warehouseId });
    if (!inv) inv = await Inventory.create({ product: productId, warehouse: warehouseId, quantity: 0, reservedQuantity: 0 });

    const prevQty = inv.quantity;
    if (type === 'adjustment') {
      inv.quantity = quantity;
    } else if (type === 'in') {
      inv.quantity += quantity;
    } else if (type === 'out') {
      if (inv.quantity < quantity) return res.status(400).json({ success: false, message: 'Insufficient stock' });
      inv.quantity -= quantity;
    }
    await inv.save();

    await InventoryMovement.create({
      product: productId,
      warehouse: warehouseId,
      type,
      quantity,
      previousQuantity: prevQty,
      newQuantity: inv.quantity,
      reference,
      notes,
      performedBy: req.user._id,
    });

    res.json({ success: true, data: inv });
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
