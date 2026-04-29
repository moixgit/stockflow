import { Router } from 'express';
import { PurchaseOrder, Inventory, InventoryMovement, Vendor, Sale, Product, Breakage, Counter, VendorPayment } from '../models/index.js';
import { protect, authorize } from '../middleware/auth.js';
import { generatePONumber, generateSaleNumber } from '../utils/counter.js';

const router = Router();
router.use(protect);

const populatePO = (q) => q
  .populate('vendor', 'name company phone email address')
  .populate('warehouse', 'name code address')
  .populate('createdBy', 'name email')
  .populate('items.product', 'name sku barcode unit sellingPrice productType piecesPerBox');

router.get('/', async (req, res) => {
  try {
    const { status, type, vendor, warehouse, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;
    if (vendor) query.vendor = vendor;
    if (warehouse) query.warehouse = warehouse;

    const total = await PurchaseOrder.countDocuments(query);
    const orders = await populatePO(
      PurchaseOrder.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit))
    );
    res.json({ success: true, data: orders, total });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', authorize('admin', 'inventory_manager'), async (req, res) => {
  try {
    const poNumber = await generatePONumber();
    const isDirectSale = req.body.type === 'direct_sale';

    if (!isDirectSale && !req.body.warehouse)
      return res.status(400).json({ success: false, message: 'Warehouse is required for standard purchase orders' });

    const items = req.body.items.map(item => ({
      ...item,
      sellingPrice: item.sellingPrice || 0,
      total: item.orderedQty * item.costPrice,
    }));

    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const taxAmount = subtotal * ((req.body.taxRate || 0) / 100);
    const grandTotal = subtotal + taxAmount - (req.body.discountAmount || 0) + (req.body.shippingCost || 0);

    const saleSubtotal = isDirectSale ? items.reduce((s, i) => s + (i.sellingPrice * i.orderedQty), 0) : 0;
    const saleGrandTotal = isDirectSale ? saleSubtotal + taxAmount - (req.body.discountAmount || 0) : 0;

    const advanceAmount = Math.min(Number(req.body.advanceAmount || 0), grandTotal);
    const poPaymentTerms = req.body.poPaymentTerms || 'credit';

    // Derive initial paidAmount and paymentStatus from advance
    const initialPaid = poPaymentTerms === 'prepaid' ? grandTotal : advanceAmount;

    const po = await PurchaseOrder.create({
      ...req.body,
      warehouse: isDirectSale ? null : (req.body.warehouse || null),
      poNumber,
      items,
      subtotal,
      taxAmount,
      grandTotal,
      saleGrandTotal,
      poPaymentTerms,
      advanceAmount,
      paidAmount: initialPaid,
      paymentStatus: initialPaid >= grandTotal ? 'paid' : initialPaid > 0 ? 'partial' : 'unpaid',
      createdBy: req.user._id,
    });

    // Record advance payment if any
    if (initialPaid > 0 && req.body.advanceMethod) {
      await VendorPayment.create({
        vendor: po.vendor,
        purchaseOrder: po._id,
        amount: initialPaid,
        method: req.body.advanceMethod,
        referenceNumber: req.body.advanceReference || undefined,
        notes: `Advance payment for PO ${poNumber}`,
        date: new Date(),
        recordedBy: req.user._id,
      });
    }

    res.status(201).json({ success: true, data: await populatePO(PurchaseOrder.findById(po._id)) });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const po = await populatePO(PurchaseOrder.findById(req.params.id));
    if (!po) return res.status(404).json({ success: false, message: 'PO not found' });
    res.json({ success: true, data: po });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id', authorize('admin', 'inventory_manager'), async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ success: false, message: 'PO not found' });
    if (!['draft'].includes(po.status))
      return res.status(400).json({ success: false, message: 'Only draft POs can be edited' });

    const isDirectSale = req.body.type === 'direct_sale';
    const items = (req.body.items || po.items).map(item => ({
      ...item,
      sellingPrice: item.sellingPrice || 0,
      total: item.orderedQty * item.costPrice,
    }));
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const taxAmount = subtotal * ((req.body.taxRate || 0) / 100);
    const grandTotal = subtotal + taxAmount - (req.body.discountAmount || 0) + (req.body.shippingCost || 0);
    const saleSubtotal = isDirectSale ? items.reduce((s, i) => s + (i.sellingPrice * i.orderedQty), 0) : 0;
    const saleGrandTotal = isDirectSale ? saleSubtotal + taxAmount - (req.body.discountAmount || 0) : 0;

    Object.assign(po, req.body, { items, subtotal, taxAmount, grandTotal, saleGrandTotal });
    await po.save();
    res.json({ success: true, data: await populatePO(PurchaseOrder.findById(po._id)) });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// Change status (manual: draft→ordered, any→cancelled)
router.patch('/:id/status', authorize('admin', 'inventory_manager'), async (req, res) => {
  try {
    const { status } = req.body;
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ success: false, message: 'PO not found' });

    const locked = ['received', 'cancelled', 'direct_sale'];
    if (locked.includes(po.status))
      return res.status(400).json({ success: false, message: `Cannot change status of a ${po.status} PO` });

    const allowed = ['ordered', 'received', 'cancelled'];
    if (!allowed.includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status transition' });

    po.status = status;
    if (status === 'received') {
      po.receivedDate = new Date();

      for (const item of po.items) {
        const remaining = item.orderedQty - (item.receivedQty || 0);
        if (remaining > 0) {
          const product = await Product.findById(item.product).select('productType');
          const isBoxProduct = product?.productType === 'box';

          let inv = await Inventory.findOne({ product: item.product, warehouse: po.warehouse });
          if (!inv) inv = await Inventory.create({ product: item.product, warehouse: po.warehouse, quantity: 0, looseQuantity: 0, reservedQuantity: 0 });
          const prevQty = inv.quantity;
          inv.quantity += remaining;
          await inv.save();

          await InventoryMovement.create({
            product: item.product,
            warehouse: po.warehouse,
            type: 'in',
            movementUnit: isBoxProduct ? 'boxes' : 'pieces',
            quantity: remaining,
            previousQuantity: prevQty,
            newQuantity: inv.quantity,
            reference: po.poNumber,
            referenceType: 'purchase',
            performedBy: req.user._id,
          });
        }
        item.receivedQty = item.orderedQty;
      }
    }
    if (status === 'received') {
      const alreadyPaid = po.poPaymentTerms === 'prepaid' ? po.grandTotal : (po.advanceAmount || 0);
      const outstandingOnReceive = Math.max(0, po.grandTotal - alreadyPaid);
      if (outstandingOnReceive > 0) {
        await Vendor.findByIdAndUpdate(po.vendor, { $inc: { balance: outstandingOnReceive } });
      }
    }

    await po.save();
    res.json({ success: true, data: await populatePO(PurchaseOrder.findById(po._id)) });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// Receive items (standard PO only)
router.post('/:id/receive', authorize('admin', 'inventory_manager'), async (req, res) => {
  try {
    const { receivedItems } = req.body; // [{itemId, receivedQty}]
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ success: false, message: 'PO not found' });
    if (po.type === 'direct_sale')
      return res.status(400).json({ success: false, message: 'Use complete-direct-sale for this PO' });
    if (['cancelled', 'received', 'direct_sale'].includes(po.status))
      return res.status(400).json({ success: false, message: `Cannot receive items for a ${po.status} PO` });

    for (const ri of receivedItems) {
      const item = po.items.id(ri.itemId);
      if (!item) continue;

      const product = await Product.findById(item.product).select('productType piecesPerBox name');
      const isBoxProduct = product?.productType === 'box';
      const receiveAsLoose = isBoxProduct && ri.receivingUnit === 'pieces';
      const brokenQty = Math.max(0, Number(ri.brokenQty || 0));
      const netReceived = ri.receivedQty - brokenQty;

      if (netReceived < 0)
        return res.status(400).json({ success: false, message: `Broken quantity cannot exceed received quantity for "${product?.name}"` });

      item.receivedQty = (item.receivedQty || 0) + ri.receivedQty;

      let inv = await Inventory.findOne({ product: item.product, warehouse: po.warehouse });
      if (!inv) inv = await Inventory.create({ product: item.product, warehouse: po.warehouse, quantity: 0, looseQuantity: 0 });

      // Add net (non-broken) to inventory
      if (netReceived > 0) {
        const prevQty = receiveAsLoose ? (inv.looseQuantity || 0) : inv.quantity;
        if (receiveAsLoose) {
          inv.looseQuantity = (inv.looseQuantity || 0) + netReceived;
        } else {
          inv.quantity += netReceived;
        }
        await inv.save();

        await InventoryMovement.create({
          product: item.product,
          warehouse: po.warehouse,
          type: 'in',
          movementUnit: receiveAsLoose ? 'pieces' : (isBoxProduct ? 'boxes' : 'pieces'),
          quantity: netReceived,
          previousQuantity: prevQty,
          newQuantity: receiveAsLoose ? inv.looseQuantity : inv.quantity,
          reference: po.poNumber,
          referenceType: 'purchase',
          notes: brokenQty > 0 ? `Received ${ri.receivedQty}, ${brokenQty} broken on arrival` : undefined,
          performedBy: req.user._id,
        });
      }

      // Auto-create breakage record for broken-on-arrival items
      if (brokenQty > 0) {
        const brkCounter = await Counter.findByIdAndUpdate('breakage', { $inc: { seq: 1 } }, { new: true, upsert: true });
        await Breakage.create({
          breakageNumber: `BRK-${String(brkCounter.seq).padStart(4, '0')}`,
          type: 'broken',
          product: item.product,
          warehouse: po.warehouse,
          quantity: brokenQty,
          unit: receiveAsLoose ? 'pieces' : (isBoxProduct ? 'boxes' : 'pieces'),
          source: 'shipping',
          purchaseOrder: po._id,
          notes: `Broken on arrival from PO ${po.poNumber}`,
          date: new Date(),
          reportedBy: req.user._id,
          status: 'confirmed',
        });
      }
    }

    const allReceived = po.items.every(i => i.receivedQty >= i.orderedQty);
    const anyReceived = po.items.some(i => i.receivedQty > 0);
    po.status = allReceived ? 'received' : (anyReceived ? 'partial' : po.status);
    if (allReceived) po.receivedDate = new Date();
    await po.save();

    // Only add outstanding amount to vendor balance (deduct already-paid advance)
    const alreadyPaid = po.poPaymentTerms === 'prepaid' ? po.grandTotal : (po.advanceAmount || 0);
    const outstandingOnReceive = Math.max(0, po.grandTotal - alreadyPaid);
    if (outstandingOnReceive > 0) {
      await Vendor.findByIdAndUpdate(po.vendor, { $inc: { balance: outstandingOnReceive } });
    }

    res.json({ success: true, data: await populatePO(PurchaseOrder.findById(po._id)) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Record payment for a PO (standard or direct sale)
router.patch('/:id/payment', authorize('admin', 'inventory_manager'), async (req, res) => {
  try {
    const { amount, method = 'cash', referenceNumber, notes } = req.body;
    if (!amount || Number(amount) <= 0)
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ success: false, message: 'PO not found' });
    if (po.status === 'cancelled')
      return res.status(400).json({ success: false, message: 'Cannot record payment for a cancelled PO' });

    const isDS = po.type === 'direct_sale';
    // For direct sales compare against sale revenue; for standard POs compare against purchase cost
    const targetAmount = isDS ? (po.saleGrandTotal || po.grandTotal) : po.grandTotal;

    po.paidAmount = (po.paidAmount || 0) + Number(amount);
    po.paymentStatus = po.paidAmount >= targetAmount ? 'paid' : (po.paidAmount > 0 ? 'partial' : 'unpaid');
    await po.save();

    if (!isDS) {
      // For standard POs: create vendor payment record and adjust vendor balance
      await VendorPayment.create({
        vendor: po.vendor,
        purchaseOrder: po._id,
        amount: Number(amount),
        method,
        referenceNumber: referenceNumber || undefined,
        notes: notes || `Payment for PO ${po.poNumber}`,
        date: new Date(),
        recordedBy: req.user._id,
      });
      await Vendor.findByIdAndUpdate(po.vendor, { $inc: { balance: -Number(amount) } });
    }

    res.json({ success: true, data: await populatePO(PurchaseOrder.findById(po._id)) });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// Complete a direct-sale PO — creates a Sale record, no inventory touch
router.post('/:id/complete-direct-sale', authorize('admin', 'inventory_manager'), async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id).populate('items.product', 'name sku barcode sellingPrice');
    if (!po) return res.status(404).json({ success: false, message: 'PO not found' });
    if (po.type !== 'direct_sale')
      return res.status(400).json({ success: false, message: 'Only direct sale POs can use this endpoint' });
    if (['cancelled', 'direct_sale'].includes(po.status))
      return res.status(400).json({ success: false, message: `PO is already ${po.status}` });

    const { paymentMethod = 'cash', amountPaid, customer } = req.body;

    const saleItems = po.items.map(item => {
      const unitPrice = item.sellingPrice || item.product?.sellingPrice || item.costPrice;
      return {
        product: item.product._id,
        productName: item.product.name,
        barcode: item.product.barcode || '',
        quantity: item.orderedQty,
        unitPrice,
        discount: 0,
        taxRate: 0,
        total: unitPrice * item.orderedQty,
      };
    });

    const saleSubtotal = saleItems.reduce((s, i) => s + i.total, 0);
    const taxAmount = po.taxAmount || 0;
    const discountAmount = po.discountAmount || 0;
    const grandTotal = saleSubtotal + taxAmount - discountAmount;
    const paid = amountPaid != null ? Number(amountPaid) : grandTotal;

    const saleNumber = await generateSaleNumber();
    const sale = await Sale.create({
      saleNumber,
      isDirectSale: true,
      customer: customer || po.customer || {},
      items: saleItems,
      subtotal: saleSubtotal,
      taxAmount,
      discountAmount,
      grandTotal,
      paymentMethod,
      amountPaid: paid,
      changeAmount: Math.max(0, paid - grandTotal),
      soldBy: req.user._id,
      notes: `Direct sale from PO: ${po.poNumber}`,
    });

    po.status = 'direct_sale';
    po.linkedSaleId = sale._id;
    po.paidAmount = paid;
    po.paymentStatus = paid >= grandTotal ? 'paid' : (paid > 0 ? 'partial' : 'unpaid');
    if (customer) po.customer = customer;
    await po.save();

    await Vendor.findByIdAndUpdate(po.vendor, { $inc: { balance: po.grandTotal } });

    res.json({ success: true, data: await populatePO(PurchaseOrder.findById(po._id)), sale });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

export default router;
