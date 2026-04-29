import { Router } from 'express';
import { Sale, Inventory, InventoryMovement, Product } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import { generateSaleNumber } from '../utils/counter.js';

const router = Router();
router.use(protect);

router.get('/', async (req, res) => {
  try {
    const { status, warehouse, from, to, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (warehouse) query.warehouse = warehouse;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    const total = await Sale.countDocuments(query);
    const sales = await Sale.find(query)
      .populate('warehouse', 'name code')
      .populate('soldBy', 'name')
      .populate('items.product', 'name sku')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, data: sales, total });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const saleNumber = await generateSaleNumber();
    const warehouseId = req.body.warehouse;

    // Validate inventory before creating anything
    for (const item of req.body.items) {
      const inv = await Inventory.findOne({ product: item.product, warehouse: warehouseId }).sort({ quantity: -1 });
      const product = await Product.findById(item.product).select('name productType piecesPerBox');
      if (item.sellingUnit === 'loose') {
        // Total available pieces = boxes × piecesPerBox + loose pieces
        const piecesPerBox = product?.piecesPerBox || 1;
        const totalPieces = (inv?.quantity ?? 0) * piecesPerBox + (inv?.looseQuantity ?? 0);
        if (!inv || totalPieces < item.quantity)
          return res.status(400).json({
            success: false,
            message: `Insufficient pieces for "${product?.name || item.product}" — available: ${totalPieces} pcs, requested: ${item.quantity}.`,
          });
      } else {
        if (!inv || inv.quantity < item.quantity)
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for "${product?.name || item.product}" — available: ${inv?.quantity ?? 0}, requested: ${item.quantity}. Make sure you have stock in the selected warehouse.`,
          });
      }
    }

    const items = await Promise.all(req.body.items.map(async item => {
      const product = await Product.findById(item.product);
      return {
        ...item,
        productName: product?.name,
        barcode: product?.barcode,
        total: item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
      };
    }));

    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const taxAmount = items.reduce((s, i) => s + (i.total * (i.taxRate || 0) / 100), 0);
    const grandTotal = subtotal + taxAmount - (req.body.discountAmount || 0) + (req.body.shippingCost || 0);

    const sale = await Sale.create({
      ...req.body,
      saleNumber,
      items,
      subtotal,
      taxAmount,
      grandTotal,
      changeAmount: Math.max(0, (req.body.amountPaid || 0) - grandTotal),
      soldBy: req.user._id,
    });

    // Deduct inventory
    for (const item of items) {
      const inv = await Inventory.findOne({ product: item.product, warehouse: warehouseId }).sort({ quantity: -1 });
      if (item.sellingUnit === 'loose') {
        const product = await Product.findById(item.product).select('piecesPerBox');
        const piecesPerBox = product?.piecesPerBox || 1;
        const prevBoxQty = inv.quantity;
        const prevLoose = inv.looseQuantity || 0;
        // Deduct from loose first; auto-open boxes for the remainder
        let loose = prevLoose - item.quantity;
        while (loose < 0 && inv.quantity > 0) {
          loose += piecesPerBox;
          inv.quantity -= 1;
        }
        inv.looseQuantity = loose;
        await inv.save();
        const note = inv.quantity < prevBoxQty
          ? `Sold ${item.quantity} pcs loose (opened ${prevBoxQty - inv.quantity} box${prevBoxQty - inv.quantity > 1 ? 'es' : ''})`
          : `Sold ${item.quantity} pcs loose`;
        await InventoryMovement.create({
          product: item.product, warehouse: warehouseId,
          type: 'out', movementUnit: 'pieces',
          quantity: item.quantity, previousQuantity: prevLoose, newQuantity: inv.looseQuantity,
          reference: saleNumber, referenceType: 'sale', notes: note, performedBy: req.user._id,
        });
      } else {
        const prevQty = inv.quantity;
        inv.quantity -= item.quantity;
        await inv.save();
        await InventoryMovement.create({
          product: item.product, warehouse: warehouseId,
          type: 'out', movementUnit: item.sellingUnit === 'box' ? 'boxes' : 'pieces',
          quantity: item.quantity, previousQuantity: prevQty, newQuantity: inv.quantity,
          reference: saleNumber, referenceType: 'sale', performedBy: req.user._id,
        });
      }
    }

    res.status(201).json({ success: true, data: sale });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('warehouse', 'name code address')
      .populate('soldBy', 'name email')
      .populate('items.product', 'name sku barcode');
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });
    res.json({ success: true, data: sale });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Return/refund
router.post('/:id/refund', async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale || sale.status === 'refunded')
      return res.status(400).json({ success: false, message: 'Sale cannot be refunded' });
    sale.status = 'refunded';
    await sale.save();

    // Restore inventory
    for (const item of sale.items) {
      const inv = await Inventory.findOne({ product: item.product, warehouse: sale.warehouse });
      if (!inv) continue;
      if (item.sellingUnit === 'loose') {
        inv.looseQuantity = (inv.looseQuantity || 0) + item.quantity;
      } else {
        inv.quantity += item.quantity;
      }
      await inv.save();
    }

    res.json({ success: true, data: sale });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

export default router;
