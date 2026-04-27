import { Router } from 'express';
import { Category } from '../models/index.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();
router.use(protect);

router.get('/', async (req, res) => {
  try {
    const cats = await Category.find({ isActive: true }).populate('parent', 'name');
    res.json({ success: true, data: cats });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', authorize('admin', 'inventory_manager'), async (req, res) => {
  try {
    const slug = req.body.name.toLowerCase().replace(/\s+/g, '-');
    const body = { ...req.body, slug };
    if (!body.parent) body.parent = null;
    const cat = await Category.create(body);
    res.status(201).json({ success: true, data: cat });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.put('/:id', authorize('admin', 'inventory_manager'), async (req, res) => {
  try {
    const update = { ...req.body };
    if ('parent' in update && !update.parent) update.parent = null;
    const cat = await Category.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json({ success: true, data: cat });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await Category.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

export default router;
