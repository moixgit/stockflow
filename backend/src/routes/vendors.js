import { Router } from 'express';
import { Vendor, VendorPayment, PurchaseOrder } from '../models/index.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();
router.use(protect);

router.get('/', async (req, res) => {
  try {
    const { search, isActive = 'true' } = req.query;
    const query = { isActive: isActive === 'true' };
    if (search) query.$or = [
      { name: new RegExp(search, 'i') },
      { company: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') },
    ];
    const vendors = await Vendor.find(query).sort({ name: 1 });
    res.json({ success: true, data: vendors });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', authorize('admin', 'inventory_manager'), async (req, res) => {
  try {
    const vendor = await Vendor.create(req.body);
    res.status(201).json({ success: true, data: vendor });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    res.json({ success: true, data: vendor });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id', authorize('admin', 'inventory_manager'), async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json({ success: true, data: vendor });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await Vendor.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Vendor deactivated' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ─── Vendor detail stats + orders + payments ────────────
router.get('/:id/detail', async (req, res) => {
  try {
    const { from, to, status } = req.query;
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const orderQuery = { vendor: vendor._id };
    if (status) orderQuery.status = status;
    if (from || to) {
      orderQuery.createdAt = {};
      if (from) orderQuery.createdAt.$gte = new Date(from);
      if (to) orderQuery.createdAt.$lte = new Date(to + 'T23:59:59');
    }

    const [orders, payments] = await Promise.all([
      PurchaseOrder.find(orderQuery)
        .populate('warehouse', 'name code')
        .populate('items.product', 'name sku productType piecesPerBox')
        .sort({ createdAt: -1 }),
      VendorPayment.find({ vendor: vendor._id })
        .populate('purchaseOrder', 'poNumber')
        .populate('recordedBy', 'name')
        .sort({ date: -1 }),
    ]);

    const activeOrders = orders.filter(o => o.status !== 'cancelled');
    const totalValue = activeOrders.reduce((s, o) => s + (o.grandTotal || 0), 0);
    const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
    const pendingDeliveries = orders.filter(o => ['ordered', 'partial'].includes(o.status));

    res.json({
      success: true,
      data: {
        vendor,
        orders,
        payments,
        stats: {
          totalOrders: activeOrders.length,
          totalValue,
          totalPaid,
          pendingBalance: vendor.balance,
          pendingDeliveries: pendingDeliveries.length,
          pendingDeliveriesValue: pendingDeliveries.reduce((s, o) => s + ((o.grandTotal || 0) - (o.paidAmount || 0)), 0),
        },
      },
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ─── Record payment to vendor ────────────────────────────
router.post('/:id/payments', authorize('admin', 'inventory_manager'), async (req, res) => {
  try {
    const { amount, method, referenceNumber, notes, date, purchaseOrderId } = req.body;
    if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Valid amount required' });
    if (!method) return res.status(400).json({ success: false, message: 'Payment method required' });

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const payment = await VendorPayment.create({
      vendor: vendor._id,
      purchaseOrder: purchaseOrderId || undefined,
      amount: Number(amount),
      method,
      referenceNumber: referenceNumber || undefined,
      notes,
      date: date ? new Date(date) : new Date(),
      recordedBy: req.user._id,
    });

    // Decrement vendor balance (what we owe them)
    vendor.balance = Math.max(0, (vendor.balance || 0) - Number(amount));
    await vendor.save();

    // Update linked PO paid amount and payment status
    if (purchaseOrderId) {
      const po = await PurchaseOrder.findById(purchaseOrderId);
      if (po && po.vendor.toString() === vendor._id.toString()) {
        po.paidAmount = (po.paidAmount || 0) + Number(amount);
        po.paymentStatus = po.paidAmount >= po.grandTotal ? 'paid' : po.paidAmount > 0 ? 'partial' : 'unpaid';
        await po.save();
      }
    }

    const populated = await VendorPayment.findById(payment._id)
      .populate('purchaseOrder', 'poNumber')
      .populate('recordedBy', 'name');

    res.status(201).json({ success: true, data: populated, vendor });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// ─── List payments for a vendor ─────────────────────────
router.get('/:id/payments', async (req, res) => {
  try {
    const payments = await VendorPayment.find({ vendor: req.params.id })
      .populate('purchaseOrder', 'poNumber')
      .populate('recordedBy', 'name')
      .sort({ date: -1 });
    res.json({ success: true, data: payments });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

export default router;
