import { Router } from 'express';
import { Sale, PurchaseOrder, Product, Inventory, Vendor, User, Brand } from '../models/index.js';
import { protect } from '../middleware/auth.js';
import dayjs from 'dayjs';

const router = Router();
router.use(protect);

router.get('/stats', async (req, res) => {
  try {
    const today = dayjs().startOf('day').toDate();
    const thisMonth = dayjs().startOf('month').toDate();
    const lastMonth = dayjs().subtract(1, 'month').startOf('month').toDate();
    const lastMonthEnd = dayjs().subtract(1, 'month').endOf('month').toDate();

    const [
      totalProducts, totalVendors, totalUsers,
      todaySales, monthSales, lastMonthSales,
      totalPOs, pendingPOs,
      lowStockCount,
    ] = await Promise.all([
      Product.countDocuments({ isActive: true }),
      Vendor.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: true }),
      Sale.aggregate([{ $match: { createdAt: { $gte: today }, status: 'completed' } }, { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } }]),
      Sale.aggregate([{ $match: { createdAt: { $gte: thisMonth }, status: 'completed' } }, { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } }]),
      Sale.aggregate([{ $match: { createdAt: { $gte: lastMonth, $lte: lastMonthEnd }, status: 'completed' } }, { $group: { _id: null, total: { $sum: '$grandTotal' } } }]),
      PurchaseOrder.countDocuments(),
      PurchaseOrder.countDocuments({ status: { $in: ['draft', 'ordered'] } }),
      Inventory.aggregate([
        { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'product' } },
        { $unwind: '$product' },
        { $match: { 'product.isActive': true, $expr: { $lte: ['$quantity', '$product.reorderPoint'] } } },
        { $count: 'total' }
      ]),
    ]);

    const salesThisMonth = monthSales[0] || { total: 0, count: 0 };
    const salesLastMonth = lastMonthSales[0] || { total: 0 };
    const salesGrowth = salesLastMonth.total > 0
      ? ((salesThisMonth.total - salesLastMonth.total) / salesLastMonth.total * 100).toFixed(1)
      : 0;

    res.json({
      success: true,
      data: {
        totalProducts,
        totalVendors,
        totalUsers,
        todaySales: todaySales[0] || { total: 0, count: 0 },
        monthSales: salesThisMonth,
        salesGrowth: Number(salesGrowth),
        totalPOs,
        pendingPOs,
        lowStockCount: lowStockCount[0]?.total || 0,
      }
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Sales chart data (last 30 days)
router.get('/sales-chart', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const from = dayjs().subtract(days, 'day').startOf('day').toDate();

    const data = await Sale.aggregate([
      { $match: { createdAt: { $gte: from }, status: 'completed' } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        total: { $sum: '$grandTotal' },
        count: { $sum: 1 },
      }},
      { $sort: { _id: 1 } },
    ]);

    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Top selling products
router.get('/top-products', async (req, res) => {
  try {
    const from = dayjs().subtract(30, 'day').toDate();
    const data = await Sale.aggregate([
      { $match: { createdAt: { $gte: from }, status: 'completed' } },
      { $unwind: '$items' },
      { $group: { _id: '$items.product', name: { $first: '$items.productName' }, totalQty: { $sum: '$items.quantity' }, totalRevenue: { $sum: '$items.total' } } },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 },
    ]);
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Warehouse stock summary
router.get('/warehouse-stock', async (req, res) => {
  try {
    const data = await Inventory.aggregate([
      { $group: { _id: '$warehouse', totalItems: { $sum: 1 }, totalQuantity: { $sum: '$quantity' } } },
      { $lookup: { from: 'warehouses', localField: '_id', foreignField: '_id', as: 'warehouse' } },
      { $unwind: '$warehouse' },
      { $project: { name: '$warehouse.name', code: '$warehouse.code', totalItems: 1, totalQuantity: 1 } },
    ]);
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Sales by brand
router.get('/brand-sales', async (req, res) => {
  try {
    const from = dayjs().subtract(30, 'day').toDate();
    const data = await Sale.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: from } } },
      { $unwind: '$items' },
      { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'product' } },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'brands', localField: 'product.brand', foreignField: '_id', as: 'brand' } },
      { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
      { $group: {
        _id: { $ifNull: ['$product.brand', 'unbranded'] },
        brandName: { $first: { $ifNull: ['$brand.name', 'Unbranded'] } },
        totalRevenue: { $sum: '$items.total' },
        totalQty: { $sum: '$items.quantity' },
      }},
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 },
    ]);
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Recent sales
router.get('/recent-sales', async (req, res) => {
  try {
    const sales = await Sale.find({ status: 'completed' })
      .populate('soldBy', 'name')
      .populate('warehouse', 'name')
      .sort({ createdAt: -1 })
      .limit(10);
    res.json({ success: true, data: sales });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

export default router;
