import { Router } from 'express';
import { Sale, Inventory, Product } from '../models/index.js';
import { protect, authorize } from '../middleware/auth.js';
import mongoose from 'mongoose';

const router = Router();
router.use(protect, authorize('admin', 'inventory_manager'));

// ── Sales Report ─────────────────────────────────────────
router.get('/sales', async (req, res) => {
  try {
    const { from, to, warehouse, groupBy = 'day' } = req.query;

    const match = {};
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        match.createdAt.$lte = end;
      }
    }
    if (warehouse) match.warehouse = new mongoose.Types.ObjectId(warehouse);

    const dateFmt = groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';

    const [chart, byPaymentMethod, topProducts, sales, summaryArr] = await Promise.all([
      // Chart data grouped by day/month
      Sale.aggregate([
        { $match: match },
        { $group: {
          _id: { $dateToString: { format: dateFmt, date: '$createdAt' } },
          revenue: { $sum: '$grandTotal' },
          count: { $sum: 1 },
        }},
        { $sort: { _id: 1 } },
      ]),

      // By payment method
      Sale.aggregate([
        { $match: match },
        { $group: {
          _id: '$paymentMethod',
          total: { $sum: '$grandTotal' },
          count: { $sum: 1 },
        }},
        { $sort: { total: -1 } },
      ]),

      // Top products by revenue
      Sale.aggregate([
        { $match: match },
        { $unwind: '$items' },
        { $group: {
          _id: '$items.productName',
          revenue: { $sum: '$items.total' },
          qty: { $sum: '$items.quantity' },
        }},
        { $sort: { revenue: -1 } },
        { $limit: 10 },
      ]),

      // Full sales list (latest 100)
      Sale.find(match)
        .populate('warehouse', 'name')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),

      // Summary totals
      Sale.aggregate([
        { $match: match },
        { $unwind: '$items' },
        { $group: {
          _id: null,
          totalRevenue: { $sum: '$grandTotal' },
          totalSales: { $addToSet: '$_id' },
          totalItems: { $sum: '$items.quantity' },
          avgOrderValue: { $avg: '$grandTotal' },
        }},
      ]),
    ]);

    const summary = summaryArr[0]
      ? {
          totalRevenue: summaryArr[0].totalRevenue,
          totalSales: summaryArr[0].totalSales.length,
          totalItems: summaryArr[0].totalItems,
          avgOrderValue: summaryArr[0].avgOrderValue,
        }
      : { totalRevenue: 0, totalSales: 0, totalItems: 0, avgOrderValue: 0 };

    res.json({ success: true, data: { summary, chart, byPaymentMethod, topProducts, sales } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Inventory Valuation ──────────────────────────────────
router.get('/inventory-valuation', async (req, res) => {
  try {
    // Get all active products with their inventory across all warehouses
    const products = await Product.find({ isActive: true })
      .select('name sku costPrice sellingPrice brand category')
      .lean();

    const inventoryRecords = await Inventory.find()
      .populate('warehouse', 'name code')
      .lean();

    // Group inventory by product
    const invByProduct = {};
    for (const rec of inventoryRecords) {
      const pid = rec.product.toString();
      if (!invByProduct[pid]) invByProduct[pid] = [];
      invByProduct[pid].push({ warehouseName: rec.warehouse?.name, quantity: rec.quantity });
    }

    const enriched = products.map(p => {
      const inv = invByProduct[p._id.toString()] || [];
      const totalQty = inv.reduce((s, i) => s + i.quantity, 0);
      return {
        ...p,
        inventory: inv,
        totalQty,
        costValue: totalQty * (p.costPrice || 0),
        retailValue: totalQty * (p.sellingPrice || 0),
      };
    });

    const summary = {
      totalProducts: enriched.length,
      totalCostValue: enriched.reduce((s, p) => s + p.costValue, 0),
      totalRetailValue: enriched.reduce((s, p) => s + p.retailValue, 0),
    };

    res.json({ success: true, data: { summary, products: enriched } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

export default router;
