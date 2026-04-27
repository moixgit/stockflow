import { Router } from 'express';
import { Brand } from '../models/index.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();
router.use(protect);

router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const query = { isActive: true };
    if (search) query.name = new RegExp(search, 'i');
    const brands = await Brand.find(query).sort({ name: 1 });
    res.json({ success: true, data: brands });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', authorize('admin', 'inventory_manager'), async (req, res) => {
  try {
    const brand = await Brand.create(req.body);
    res.status(201).json({ success: true, data: brand });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.put('/:id', authorize('admin', 'inventory_manager'), async (req, res) => {
  try {
    const brand = await Brand.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: brand });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.delete('/:id', authorize('admin', 'inventory_manager'), async (req, res) => {
  try {
    await Brand.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Brand removed' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

export default router;
