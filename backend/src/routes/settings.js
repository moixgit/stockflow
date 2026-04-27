import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { StoreSettings } from '../models/index.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();
router.use(protect);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/store';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `logo-${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/', async (req, res) => {
  try {
    const settings = await StoreSettings.findOne();
    res.json({ success: true, data: settings || {} });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/', authorize('admin'), async (req, res) => {
  try {
    const settings = await StoreSettings.findOneAndUpdate(
      {},
      { $set: req.body },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, data: settings });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.post('/logo', authorize('admin'), upload.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  res.json({ success: true, url: `/uploads/store/${req.file.filename}` });
});

export default router;
