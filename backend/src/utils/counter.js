import { Counter } from '../models/index.js';

export async function getNextSequence(name) {
  const counter = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return counter.seq;
}

export async function generatePONumber() {
  const seq = await getNextSequence('purchase_order');
  return `PO-${String(seq).padStart(6, '0')}`;
}

export async function generateSaleNumber() {
  const seq = await getNextSequence('sale');
  return `SALE-${String(seq).padStart(6, '0')}`;
}
