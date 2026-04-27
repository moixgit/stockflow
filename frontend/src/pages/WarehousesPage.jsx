import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api.js';
import toast from 'react-hot-toast';
import { Plus, Edit2, Warehouse } from 'lucide-react';

function WHModal({ wh, onClose, onSave, managers }) {
  const [form, setForm] = useState(wh || { name: '', code: '', phone: '', email: '', notes: '', manager: '', address: { street: '', city: '', state: '', country: '', zip: '' } });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setAddr = (k, v) => setForm(p => ({ ...p, address: { ...p.address, [k]: v } }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (wh) await api.put(`/warehouses/${wh._id}`, form);
      else await api.post('/warehouses', form);
      toast.success(wh ? 'Warehouse updated' : 'Warehouse created');
      onSave();
    } catch (err) { toast.error(err?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{wh ? 'Edit Warehouse' : 'Add Warehouse'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid form-grid-2" style={{ gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Code *</label>
              <input className="form-input" value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} required placeholder="WH-01" />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Manager</label>
              <select className="form-input" value={form.manager} onChange={e => set('manager', e.target.value)}>
                <option value="">No manager</option>
                {managers.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">City</label>
              <input className="form-input" value={form.address?.city} onChange={e => setAddr('city', e.target.value)} />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Street Address</label>
              <input className="form-input" value={form.address?.street} onChange={e => setAddr('street', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Country</label>
              <input className="form-input" value={form.address?.country} onChange={e => setAddr('country', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">ZIP</label>
              <input className="form-input" value={form.address?.zip} onChange={e => setAddr('zip', e.target.value)} />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <span className="spinner" /> : (wh ? 'Update' : 'Create Warehouse')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [w, u] = await Promise.all([api.get('/warehouses'), api.get('/users')]);
      setWarehouses(w.data);
      setManagers(u.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Warehouses</h1><p className="page-subtitle">{warehouses.length} locations</p></div>
        <button className="btn btn-primary" onClick={() => setModal('add')}><Plus size={16} /> Add Warehouse</button>
      </div>

      <div className="grid-3">
        {warehouses.map(wh => (
          <div key={wh._id} className="card" style={{ cursor: 'default' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, background: 'var(--accent-dim)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Warehouse size={20} color="var(--accent)" />
              </div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setModal(wh)}><Edit2 size={13} /></button>
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>{wh.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Code: <span className="text-mono">{wh.code}</span>
            </div>
            {wh.address?.city && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>📍 {wh.address.city}, {wh.address.country}</div>}
            {wh.manager && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>👤 {wh.manager.name}</div>}
            {wh.phone && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>📞 {wh.phone}</div>}
          </div>
        ))}

        {!loading && warehouses.length === 0 && (
          <div className="card" style={{ gridColumn: '1/-1' }}>
            <div className="empty-state"><Warehouse /><p>No warehouses yet</p></div>
          </div>
        )}
      </div>

      {modal && <WHModal wh={modal !== 'add' ? modal : null} managers={managers} onClose={() => setModal(null)} onSave={() => { setModal(null); load(); }} />}
    </div>
  );
}
