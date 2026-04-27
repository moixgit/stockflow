import { Router } from 'express';
import { Warehouse } from '../models/index.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();
router.use(protect);

router.get('/', async (req, res) => {
  try {
    const warehouses = await Warehouse.find({ isActive: true }).populate('manager', 'name email');
    res.json({ success: true, data: warehouses });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', authorize('admin'), async (req, res) => {
  try {
    const body = { ...req.body };
    if (!body.manager) delete body.manager;
    const wh = await Warehouse.create(body);
    res.status(201).json({ success: true, data: wh });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const body = { ...req.body };
    if (!body.manager) body.manager = null;
    const wh = await Warehouse.findByIdAndUpdate(req.params.id, body, { new: true });
    res.json({ success: true, data: wh });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await Warehouse.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Warehouse deactivated' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

export default router;
