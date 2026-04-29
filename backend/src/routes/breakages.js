import { Router } from 'express';
import { Breakage, Inventory, InventoryMovement, Product, Counter, PurchaseOrder } from '../models/index.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();
router.use(protect);

router.get('/', async (req, res) => {
  try {
    const { warehouse, product, status, source, type, page = 1, limit = 50 } = req.query;
    const query = {};
    if (warehouse) query.warehouse = warehouse;
    if (product) query.product = product;
    if (status) query.status = status;
    if (source) query.source = source;
    if (type) query.type = type;

    const total = await Breakage.countDocuments(query);
    const breakages = await Breakage.find(query)
      .populate('product', 'name sku productType piecesPerBox unit')
      .populate('warehouse', 'name code')
      .populate('reportedBy', 'name')
      .populate('purchaseOrder', 'poNumber')
      .populate('inspection', 'inspectionNumber')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, data: breakages, total });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', authorize('admin', 'inventory_manager'), async (req, res) => {
  try {
    const { productId, warehouseId, quantity, unit = 'pieces', type = 'broken', source = 'other', purchaseOrderId, notes, date, savedPieces: savedPiecesRaw } = req.body;

    if (!productId || !warehouseId || !quantity) {
      return res.status(400).json({ success: false, message: 'Product, warehouse and quantity are required' });
    }

    const counter = await Counter.findByIdAndUpdate('breakage', { $inc: { seq: 1 } }, { new: true, upsert: true });
    const breakageNumber = `BRK-${String(counter.seq).padStart(4, '0')}`;

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    let inv = await Inventory.findOne({ product: productId, warehouse: warehouseId });
    if (!inv) return res.status(404).json({ success: false, message: 'No inventory record found for this product/warehouse' });

    const prevBoxQty = inv.quantity;
    const prevLooseQty = inv.looseQuantity || 0;
    const piecesPerBox = product.piecesPerBox || 1;

    // How many intact pieces are being rescued (only relevant for box-unit breakage on box products)
    const savedPieces = (product.productType === 'box' && unit === 'boxes')
      ? Math.max(0, Number(savedPiecesRaw || 0))
      : 0;

    if (product.productType === 'box' && unit === 'boxes') {
      if (inv.quantity < quantity) return res.status(400).json({ success: false, message: 'Insufficient boxes in stock' });
      const maxSaved = Number(quantity) * piecesPerBox;
      if (savedPieces > maxSaved)
        return res.status(400).json({ success: false, message: `Saved pieces (${savedPieces}) cannot exceed total pieces in broken boxes (${maxSaved})` });

      // Remove the broken boxes
      inv.quantity -= Number(quantity);
      // Rescue intact pieces back into loose stock
      if (savedPieces > 0) {
        inv.looseQuantity = (inv.looseQuantity || 0) + savedPieces;
      }
    } else if (product.productType === 'box' && unit === 'pieces') {
      const totalPieces = inv.quantity * piecesPerBox + (inv.looseQuantity || 0);
      if (totalPieces < quantity) return res.status(400).json({ success: false, message: 'Insufficient stock for breakage quantity' });
      let loose = (inv.looseQuantity || 0) - Number(quantity);
      while (loose < 0 && inv.quantity > 0) {
        loose += piecesPerBox;
        inv.quantity -= 1;
      }
      inv.looseQuantity = loose;
    } else {
      if (inv.quantity < quantity) return res.status(400).json({ success: false, message: 'Insufficient stock' });
      inv.quantity -= Number(quantity);
    }
    await inv.save();

    // Movement: box reduction
    await InventoryMovement.create({
      product: productId,
      warehouse: warehouseId,
      type: 'breakage',
      movementUnit: unit,
      quantity: Number(quantity),
      previousQuantity: prevBoxQty,
      newQuantity: inv.quantity,
      reference: breakageNumber,
      referenceType: 'breakage',
      notes: savedPieces > 0
        ? `${quantity} box${quantity > 1 ? 'es' : ''} broken — ${savedPieces} piece${savedPieces > 1 ? 's' : ''} saved as loose, ${Number(quantity) * piecesPerBox - savedPieces} pieces lost`
        : (notes || `Breakage reported — source: ${source}`),
      performedBy: req.user._id,
    });

    // Movement: rescued pieces added to loose stock
    if (savedPieces > 0) {
      await InventoryMovement.create({
        product: productId,
        warehouse: warehouseId,
        type: 'in',
        movementUnit: 'pieces',
        quantity: savedPieces,
        previousQuantity: prevLooseQty,
        newQuantity: inv.looseQuantity,
        reference: breakageNumber,
        referenceType: 'breakage',
        notes: `Saved pieces rescued from broken box(es) — ref: ${breakageNumber}`,
        performedBy: req.user._id,
      });
    }

    // The breakage record tracks the actually lost pieces (not the saved ones)
    const brokenPieces = Number(quantity) * piecesPerBox - savedPieces;
    const breakage = await Breakage.create({
      breakageNumber,
      type,
      product: productId,
      warehouse: warehouseId,
      quantity: savedPieces > 0 ? brokenPieces : Number(quantity),
      unit: savedPieces > 0 ? 'pieces' : unit,
      source,
      purchaseOrder: purchaseOrderId || undefined,
      notes: savedPieces > 0
        ? `${quantity} box${quantity > 1 ? 'es' : ''} broken — ${savedPieces} pcs saved as loose stock, ${brokenPieces} pcs written off. ${notes || ''}`.trim()
        : notes,
      date: date ? new Date(date) : new Date(),
      reportedBy: req.user._id,
      status: 'confirmed',
    });

    const populated = await Breakage.findById(breakage._id)
      .populate('product', 'name sku productType piecesPerBox unit')
      .populate('warehouse', 'name code')
      .populate('reportedBy', 'name');

    res.status(201).json({ success: true, data: populated });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.put('/:id', authorize('admin', 'inventory_manager'), async (req, res) => {
  try {
    const { status, notes } = req.body;
    const breakage = await Breakage.findByIdAndUpdate(req.params.id, { status, notes }, { new: true })
      .populate('product', 'name sku')
      .populate('warehouse', 'name code');
    if (!breakage) return res.status(404).json({ success: false, message: 'Breakage record not found' });
    res.json({ success: true, data: breakage });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

export default router;
