// InventoryPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api.js';
import toast from 'react-hot-toast';
import { RefreshCw, ArrowLeftRight, AlertTriangle, Edit2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';

function AdjustModal({ inv, onClose, onSave }) {
  const [type, setType] = useState('adjustment');
  const [qty, setQty] = useState(inv.quantity);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/inventory/adjust', { productId: inv.product._id, warehouseId: inv.warehouse._id, quantity: +qty, type, notes });
      toast.success('Stock adjusted');
      onSave();
    } catch (err) { toast.error(err?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h2 className="modal-title">Adjust Stock</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg-elevated)', borderRadius: 8 }}>
          <div style={{ fontWeight: 500 }}>{inv.product.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{inv.warehouse.name} • Current: {inv.quantity}</div>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Adjustment Type</label>
            <select className="form-input" value={type} onChange={e => setType(e.target.value)}>
              <option value="adjustment">Set Exact Quantity</option>
              <option value="in">Add Stock</option>
              <option value="out">Remove Stock</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{type === 'adjustment' ? 'New Quantity' : 'Quantity'}</label>
            <input className="form-input" type="number" min="0" value={qty} onChange={e => setQty(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div className="modal-footer" style={{ margin: 0, padding: 0, border: 'none' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <span className="spinner" /> : 'Adjust Stock'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [adjustItem, setAdjustItem] = useState(null);
  const { isInventoryManager } = useAuthStore();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, w] = await Promise.all([
        api.get(`/inventory${warehouseFilter ? `?warehouse=${warehouseFilter}` : ''}`),
        api.get('/warehouses'),
      ]);
      setInventory(inv.data);
      setWarehouses(w.data);
    } finally { setLoading(false); }
  }, [warehouseFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Inventory</h1><p className="page-subtitle">{inventory.length} stock records</p></div>
      </div>

      <div className="card mb-16">
        <div style={{ display: 'flex', gap: 12 }}>
          <select className="form-input" style={{ width: 200 }} value={warehouseFilter} onChange={e => setWarehouseFilter(e.target.value)}>
            <option value="">All Warehouses</option>
            {warehouses.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
          </select>
          <button className="btn btn-secondary" onClick={load}><RefreshCw size={14} /></button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" style={{ width: 28, height: 28 }} /></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Product</th><th>SKU</th><th>Warehouse</th><th>In Stock</th><th>Reserved</th><th>Available</th><th>Reorder Point</th><th>Status</th>{isInventoryManager() && <th></th>}</tr></thead>
              <tbody>
                {inventory.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No inventory records</td></tr>
                ) : inventory.map(inv => {
                  const available = inv.quantity - inv.reservedQuantity;
                  const isLow = inv.quantity <= (inv.product?.reorderPoint || 10);
                  return (
                    <tr key={inv._id}>
                      <td><div style={{ fontWeight: 500 }}>{inv.product?.name}</div></td>
                      <td><span className="text-mono">{inv.product?.sku}</span></td>
                      <td>{inv.warehouse?.name} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({inv.warehouse?.code})</span></td>
                      <td><span className="text-mono" style={{ fontWeight: 600 }}>{inv.quantity}</span></td>
                      <td><span className="text-mono" style={{ color: 'var(--text-muted)' }}>{inv.reservedQuantity}</span></td>
                      <td><span className="text-mono" style={{ fontWeight: 600, color: available <= 0 ? 'var(--red)' : 'var(--text)' }}>{available}</span></td>
                      <td><span className="text-mono">{inv.product?.reorderPoint}</span></td>
                      <td>
                        {isLow ? (
                          <span className="badge badge-red"><AlertTriangle size={10} /> Low</span>
                        ) : (
                          <span className="badge badge-green">OK</span>
                        )}
                      </td>
                      {isInventoryManager() && (
                        <td>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setAdjustItem(inv)} title="Adjust stock">
                            <Edit2 size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {adjustItem && <AdjustModal inv={adjustItem} onClose={() => setAdjustItem(null)} onSave={() => { setAdjustItem(null); load(); }} />}
    </div>
  );
}
