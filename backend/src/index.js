import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';

// Routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import warehouseRoutes from './routes/warehouses.js';
import categoryRoutes from './routes/categories.js';
import productRoutes from './routes/products.js';
import vendorRoutes from './routes/vendors.js';
import purchaseRoutes from './routes/purchases.js';
import posRoutes from './routes/pos.js';
import inventoryRoutes from './routes/inventory.js';
import barcodeRoutes from './routes/barcode.js';
import dashboardRoutes from './routes/dashboard.js';
import reportRoutes from './routes/reports.js';
import brandRoutes from './routes/brands.js';
import settingsRoutes from './routes/settings.js';
import breakageRoutes from './routes/breakages.js';
import inspectionRoutes from './routes/inspections.js';

const app = express();

// Security
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: '*', credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
app.use('/api/', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/barcode', barcodeRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/breakages', breakageRoutes);
app.use('/api/inspections', inspectionRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal Server Error' });
});

// Connect DB & Start
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/stockflow';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => console.log(`🚀 StockFlow API running on port ${PORT}`));
  })
  .catch(err => { console.error('❌ DB connection failed:', err); process.exit(1); });
