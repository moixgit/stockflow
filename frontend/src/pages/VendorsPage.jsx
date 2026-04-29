import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api.js';
import toast from 'react-hot-toast';
import { Plus, Edit2, Store, Search, Star, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function VendorModal({ vendor, onClose, onSave }) {
  const [form, setForm] = useState(vendor || { name: '', company: '', email: '', phone: '', taxId: '', paymentTerms: 'NET30', creditLimit: 0, notes: '', rating: 3, address: { street: '', city: '', state: '', country: '', zip: '' } });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setAddr = (k, v) => setForm(p => ({ ...p, address: { ...p.address, [k]: v } }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (vendor) await api.put(`/vendors/${vendor._id}`, form);
      else await api.post('/vendors', form);
      toast.success(vendor ? 'Vendor updated' : 'Vendor created');
      onSave();
    } catch (err) { toast.error(err?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h2 className="modal-title">{vendor ? 'Edit Vendor' : 'Add Vendor'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid form-grid-2" style={{ gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Company</label>
              <input className="form-input" value={form.company} onChange={e => set('company', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Tax ID</label>
              <input className="form-input" value={form.taxId} onChange={e => set('taxId', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Terms</label>
              <select className="form-input" value={form.paymentTerms} onChange={e => set('paymentTerms', e.target.value)}>
                {['NET7', 'NET15', 'NET30', 'NET45', 'NET60', 'COD', 'Prepaid'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Credit Limit ($)</label>
              <input className="form-input" type="number" value={form.creditLimit} onChange={e => set('creditLimit', +e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Rating (1-5)</label>
              <input className="form-input" type="number" min="1" max="5" value={form.rating} onChange={e => set('rating', +e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">City</label>
              <input className="form-input" value={form.address?.city} onChange={e => setAddr('city', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Country</label>
              <input className="form-input" value={form.address?.country} onChange={e => setAddr('country', e.target.value)} />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <span className="spinner" /> : (vendor ? 'Update' : 'Create Vendor')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = search ? `?search=${search}` : '';
      const v = await api.get(`/vendors${params}`);
      setVendors(v.data);
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const fmt = (n) => `Rs ${(n || 0).toFixed(2)}`;

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Vendors</h1><p className="page-subtitle">{vendors.length} vendors</p></div>
        <button className="btn btn-primary" onClick={() => setModal('add')}><Plus size={16} /> Add Vendor</button>
      </div>

      <div className="card mb-16">
        <div className="search-bar">
          <Search size={16} />
          <input className="form-input" placeholder="Search vendors..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Vendor</th><th>Contact</th><th>Payment Terms</th><th>Credit Limit</th><th>Balance</th><th>Rating</th><th></th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ width: 24, height: 24, margin: '0 auto' }} /></td></tr>
              ) : vendors.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state"><Store /><p>No vendors found</p></div></td></tr>
              ) : vendors.map(v => (
                <tr key={v._id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{v.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.company}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: 12 }}>{v.email}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v.phone}</div>
                  </td>
                  <td><span className="badge badge-blue">{v.paymentTerms}</span></td>
                  <td>{fmt(v.creditLimit)}</td>
                  <td style={{ color: v.balance > 0 ? 'var(--red)' : 'var(--green)' }}>{fmt(v.balance)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 2 }}>
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star key={i} size={12} fill={i < v.rating ? 'var(--yellow)' : 'none'} color={i < v.rating ? 'var(--yellow)' : 'var(--border)'} />
                      ))}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm btn-icon" title="View Details" onClick={() => navigate(`/vendors/${v._id}`)}><Eye size={13} /></button>
                      <button className="btn btn-ghost btn-sm btn-icon" title="Edit" onClick={() => setModal(v)}><Edit2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && <VendorModal vendor={modal !== 'add' ? modal : null} onClose={() => setModal(null)} onSave={() => { setModal(null); load(); }} />}
    </div>
  );
}
