import { Router } from 'express';
import bwipjs from 'bwip-js';
import { Product } from '../models/index.js';
import { protect } from '../middleware/auth.js';

const router = Router();
router.use(protect);

// Generate barcode image for a product
router.get('/generate/:barcode', async (req, res) => {
  try {
    const { barcode } = req.params;
    const { type = 'code128', width = 60, height = 20, text } = req.query;

    const png = await bwipjs.toBuffer({
      bcid: type,
      text: barcode,
      scale: 3,
      height: Number(height),
      width: Number(width),
      includetext: true,
      textxalign: 'center',
    });

    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(png);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Generate barcode for a product by ID
router.get('/product/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product?.barcode) return res.status(404).json({ success: false, message: 'Product or barcode not found' });

    const png = await bwipjs.toBuffer({
      bcid: product.barcodeType?.toLowerCase() || 'code128',
      text: product.barcode,
      scale: 3,
      height: 20,
      includetext: true,
      textxalign: 'center',
    });

    res.set('Content-Type', 'image/png');
    res.send(png);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Batch generate barcodes info
router.post('/batch', async (req, res) => {
  try {
    const { productIds } = req.body;
    const products = await Product.find({ _id: { $in: productIds } }).select('name sku barcode barcodeType');
    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
