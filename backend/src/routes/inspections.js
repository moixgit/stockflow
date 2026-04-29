import { Router } from 'express';
import { InventoryInspection, Inventory, Breakage, InventoryMovement, Product, Counter } from '../models/index.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();
router.use(protect);

const populateInspection = (q) => q
  .populate('warehouse', 'name code')
  .populate('performedBy', 'name')
  .populate('verifiedBy', 'name')
  .populate('items.product', 'name sku productType piecesPerBox');

router.get('/', async (req, res) => {
  try {
    const { warehouse, status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (warehouse) query.warehouse = warehouse;
    if (status) query.status = status;

    const total = await InventoryInspection.countDocuments(query);
    const inspections = await populateInspection(
      InventoryInspection.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit))
    );
    res.json({ success: true, data: inspections, total });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Create inspection — auto-loads current inventory as expected quantities
router.post('/', authorize('admin', 'inventory_manager'), async (req, res) => {
  try {
    const { warehouseId, notes } = req.body;
    if (!warehouseId) return res.status(400).json({ success: false, message: 'Warehouse is required' });

    const counter = await Counter.findByIdAndUpdate('inspection', { $inc: { seq: 1 } }, { new: true, upsert: true });
    const inspectionNumber = `INS-${String(counter.seq).padStart(4, '0')}`;

    const inventory = await Inventory.find({ warehouse: warehouseId })
      .populate({ path: 'product', match: { isActive: true }, select: 'name sku productType piecesPerBox isActive' });

    const items = inventory
      .filter(inv => inv.product)
      .map(inv => ({
        product: inv.product._id,
        expectedQty: inv.quantity,
        expectedLooseQty: inv.looseQuantity || 0,
        actualQty: null,
        actualLooseQty: null,
        discrepancyType: null,
      }));

    const inspection = await InventoryInspection.create({
      inspectionNumber,
      warehouse: warehouseId,
      items,
      notes,
      performedBy: req.user._id,
      status: 'draft',
    });

    res.status(201).json({ success: true, data: await populateInspection(InventoryInspection.findById(inspection._id)) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const inspection = await populateInspection(InventoryInspection.findById(req.params.id));
    if (!inspection) return res.status(404).json({ success: false, message: 'Inspection not found' });
    res.json({ success: true, data: inspection });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Update item counts (draft/submitted only)
router.put('/:id', authorize('admin', 'inventory_manager'), async (req, res) => {
  try {
    const inspection = await InventoryInspection.findById(req.params.id);
    if (!inspection) return res.status(404).json({ success: false, message: 'Inspection not found' });
    if (inspection.status === 'verified')
      return res.status(400).json({ success: false, message: 'Cannot edit a verified inspection' });

    const { items, notes } = req.body;
    if (notes !== undefined) inspection.notes = notes;

    if (items) {
      for (const update of items) {
        const item = inspection.items.id(update._id);
        if (!item) continue;
        if (update.actualQty !== undefined) item.actualQty = update.actualQty === '' ? null : Number(update.actualQty);
        if (update.actualLooseQty !== undefined) item.actualLooseQty = update.actualLooseQty === '' ? null : Number(update.actualLooseQty);
        if (update.discrepancyType !== undefined) item.discrepancyType = update.discrepancyType || null;
        if (update.notes !== undefined) item.notes = update.notes;
      }
    }

    await inspection.save();
    res.json({ success: true, data: await populateInspection(InventoryInspection.findById(inspection._id)) });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// Submit inspection (draft → submitted)
router.post('/:id/submit', authorize('admin', 'inventory_manager'), async (req, res) => {
  try {
    const inspection = await InventoryInspection.findById(req.params.id);
    if (!inspection) return res.status(404).json({ success: false, message: 'Inspection not found' });
    if (inspection.status !== 'draft')
      return res.status(400).json({ success: false, message: 'Only draft inspections can be submitted' });

    const filled = inspection.items.filter(i => i.actualQty !== null);
    if (!filled.length) return res.status(400).json({ success: false, message: 'Enter actual counts for at least one item before submitting' });

    inspection.status = 'submitted';
    await inspection.save();
    res.json({ success: true, data: await populateInspection(InventoryInspection.findById(inspection._id)) });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// Verify inspection (admin only) — adjust inventory and create discrepancy records
router.post('/:id/verify', authorize('admin'), async (req, res) => {
  try {
    const inspection = await InventoryInspection.findById(req.params.id)
      .populate('items.product', 'name sku productType piecesPerBox');
    if (!inspection) return res.status(404).json({ success: false, message: 'Inspection not found' });
    if (inspection.status !== 'submitted')
      return res.status(400).json({ success: false, message: 'Only submitted inspections can be verified' });

    for (const item of inspection.items) {
      if (item.actualQty === null) continue;

      const inv = await Inventory.findOne({ product: item.product._id, warehouse: inspection.warehouse });
      if (!inv) continue;

      const product = item.product;
      const isBox = product?.productType === 'box';

      const boxDiff = item.actualQty - item.expectedQty;
      const looseDiff = isBox ? ((item.actualLooseQty ?? item.expectedLooseQty) - item.expectedLooseQty) : 0;
      const hasShortage = boxDiff < 0 || looseDiff < 0;

      // Adjust inventory to actual
      const prevBoxQty = inv.quantity;
      const prevLooseQty = inv.looseQuantity || 0;
      inv.quantity = item.actualQty;
      if (isBox) inv.looseQuantity = item.actualLooseQty ?? item.expectedLooseQty;
      await inv.save();

      // Record movement for the adjustment
      if (boxDiff !== 0) {
        await InventoryMovement.create({
          product: item.product._id,
          warehouse: inspection.warehouse,
          type: 'adjustment',
          movementUnit: isBox ? 'boxes' : 'pieces',
          quantity: Math.abs(boxDiff),
          previousQuantity: prevBoxQty,
          newQuantity: inv.quantity,
          reference: inspection.inspectionNumber,
          referenceType: 'adjustment',
          notes: `Inspection ${inspection.inspectionNumber}: ${boxDiff > 0 ? 'surplus' : 'shortage'} of ${Math.abs(boxDiff)} ${isBox ? 'box(es)' : 'pcs'}`,
          performedBy: req.user._id,
        });
      }

      // Create breakage/missing record for shortages
      if (hasShortage && item.discrepancyType) {
        const shortageBoxes = Math.abs(Math.min(boxDiff, 0));
        const shortageLoose = Math.abs(Math.min(looseDiff, 0));

        if (shortageBoxes > 0) {
          const brkCounter = await Counter.findByIdAndUpdate('breakage', { $inc: { seq: 1 } }, { new: true, upsert: true });
          await Breakage.create({
            breakageNumber: `BRK-${String(brkCounter.seq).padStart(4, '0')}`,
            type: item.discrepancyType,
            product: item.product._id,
            warehouse: inspection.warehouse,
            quantity: shortageBoxes,
            unit: isBox ? 'boxes' : 'pieces',
            source: 'inspection',
            inspection: inspection._id,
            notes: item.notes || `Found during inspection ${inspection.inspectionNumber}`,
            date: new Date(),
            reportedBy: req.user._id,
            status: 'confirmed',
          });
        }
        if (isBox && shortageLoose > 0) {
          const brkCounter = await Counter.findByIdAndUpdate('breakage', { $inc: { seq: 1 } }, { new: true, upsert: true });
          await Breakage.create({
            breakageNumber: `BRK-${String(brkCounter.seq).padStart(4, '0')}`,
            type: item.discrepancyType,
            product: item.product._id,
            warehouse: inspection.warehouse,
            quantity: shortageLoose,
            unit: 'pieces',
            source: 'inspection',
            inspection: inspection._id,
            notes: item.notes || `Found during inspection ${inspection.inspectionNumber}`,
            date: new Date(),
            reportedBy: req.user._id,
            status: 'confirmed',
          });
        }
      }
    }

    inspection.status = 'verified';
    inspection.verifiedBy = req.user._id;
    inspection.verifiedAt = new Date();
    await inspection.save();

    res.json({ success: true, data: await populateInspection(InventoryInspection.findById(inspection._id)) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/:id', authorize('admin', 'inventory_manager'), async (req, res) => {
  try {
    const inspection = await InventoryInspection.findById(req.params.id);
    if (!inspection) return res.status(404).json({ success: false, message: 'Inspection not found' });
    if (inspection.status !== 'draft')
      return res.status(400).json({ success: false, message: 'Only draft inspections can be deleted' });
    await inspection.deleteOne();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

export default router;
