import { Router } from 'express';
import { Product, Inventory, Warehouse, Sale, PurchaseOrder, InventoryMovement } from '../models/index.js';
import { protect, authorize } from '../middleware/auth.js';
import { nanoid } from 'nanoid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';

const uploadDir = 'uploads/products';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${nanoid(8)}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

const router = Router();
router.use(protect);

router.get('/', async (req, res) => {
  try {
    const { search, category, vendor, page = 1, limit = 50 } = req.query;
    const query = { isActive: true };
    if (search) query.$or = [
      { name: new RegExp(search, 'i') },
      { sku: new RegExp(search, 'i') },
      { barcode: new RegExp(search, 'i') },
      { brand: new RegExp(search, 'i') },
      { articleNumber: new RegExp(search, 'i') },
    ];
    if (category) query.category = category;
    if (vendor) query.vendors = vendor;

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate('vendors', 'name company')
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const productIds = products.map(p => p._id);
    const inventories = await Inventory.find({ product: { $in: productIds } })
      .populate('warehouse', 'name code');

    const invMap = {};
    for (const inv of inventories) {
      const pid = inv.product.toString();
      if (!invMap[pid]) invMap[pid] = [];
      invMap[pid].push({ warehouse: inv.warehouse, quantity: inv.quantity });
    }

    const productsWithStock = products.map(p => ({
      ...p.toObject(),
      stock: invMap[p._id.toString()] || [],
    }));

    res.json({ success: true, data: productsWithStock, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Image upload
router.post('/upload', authorize('admin', 'inventory_manager'), upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  res.json({ success: true, url: `/uploads/products/${req.file.filename}` });
});

router.post('/', authorize('admin', 'inventory_manager'), async (req, res) => {
  try {
    if (!req.body.barcode) req.body.barcode = nanoid(12).toUpperCase();
    if (!req.body.sku) req.body.sku = `SKU-${nanoid(8).toUpperCase()}`;
    if (!req.body.category) req.body.category = null;
    if (!req.body.brand) req.body.brand = null;
    req.body.vendors = (req.body.vendors || []).filter(Boolean);

    const product = await Product.create(req.body);

    const warehouses = await Warehouse.find({ isActive: true });
    const inventoryDocs = warehouses.map(wh => ({
      product: product._id,
      warehouse: wh._id,
      quantity: 0,
      reservedQuantity: 0,
    }));
    await Inventory.insertMany(inventoryDocs, { ordered: false }).catch(() => {});

    res.status(201).json({ success: true, data: product });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.get('/alerts/low-stock', async (req, res) => {
  try {
    const inventories = await Inventory.find()
      .populate({ path: 'product', match: { isActive: true }, populate: [{ path: 'category', select: 'name' }] })
      .populate('warehouse', 'name code');

    const lowStock = inventories.filter(inv => inv.product && inv.quantity <= inv.product.reorderPoint);
    res.json({ success: true, data: lowStock });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/by-barcode/:barcode', async (req, res) => {
  try {
    const product = await Product.findOne({ barcode: req.params.barcode, isActive: true })
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate('vendors', 'name');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Product stats for detail page
router.get('/:id/stats', async (req, res) => {
  try {
    const oid = new mongoose.Types.ObjectId(req.params.id);

    const [salesAgg, recentSales, inventory, movements, purchases] = await Promise.all([
      Sale.aggregate([
        { $match: { status: 'completed' } },
        { $unwind: '$items' },
        { $match: { 'items.product': oid } },
        { $group: {
          _id: null,
          totalSold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.total' },
          salesCount: { $sum: 1 },
        }},
      ]),
      Sale.aggregate([
        { $match: { status: 'completed' } },
        { $unwind: '$items' },
        { $match: { 'items.product': oid } },
        { $sort: { createdAt: -1 } },
        { $limit: 15 },
        { $project: {
          saleNumber: 1,
          createdAt: 1,
          customer: 1,
          quantity: '$items.quantity',
          unitPrice: '$items.unitPrice',
          total: '$items.total',
        }},
      ]),
      Inventory.find({ product: req.params.id }).populate('warehouse', 'name code'),
      InventoryMovement.find({ product: req.params.id })
        .populate('warehouse', 'name code')
        .populate('performedBy', 'name')
        .sort({ createdAt: -1 })
        .limit(20),
      PurchaseOrder.find({ 'items.product': oid })
        .populate('vendor', 'name')
        .sort({ createdAt: -1 })
        .limit(10)
        .select('poNumber vendor status createdAt items grandTotal'),
    ]);

    const stats = salesAgg[0] || { totalSold: 0, totalRevenue: 0, salesCount: 0 };

    res.json({ success: true, data: { stats, recentSales, inventory, movements, purchases } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate('vendors', 'name company');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const inventory = await Inventory.find({ product: product._id })
      .populate('warehouse', 'name code');

    res.json({ success: true, data: product, inventory });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id', authorize('admin', 'inventory_manager'), async (req, res) => {
  try {
    const update = { ...req.body };
    if ('category' in update && !update.category) update.category = null;
    if ('brand' in update && !update.brand) update.brand = null;
    if ('vendors' in update) update.vendors = (update.vendors || []).filter(Boolean);
    const product = await Product.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
      .populate('category', 'name').populate('vendors', 'name company');
    res.json({ success: true, data: product });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await Product.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Product deactivated' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

export default router;
