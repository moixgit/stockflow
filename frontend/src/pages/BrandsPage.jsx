import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, Tag, Search } from 'lucide-react';

function BrandModal({ brand, onClose, onSave }) {
  const [form, setForm] = useState(brand || { name: '', description: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Brand name is required');
    setSaving(true);
    try {
      if (brand) await api.put(`/brands/${brand._id}`, form);
      else await api.post('/brands', form);
      toast.success(brand ? 'Brand updated' : 'Brand created');
      onSave();
    } catch (err) { toast.error(err?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2 className="modal-title">{brand ? 'Edit Brand' : 'New Brand'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Brand Name *</label>
            <input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Nike, Samsung, Sony" required />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-input" rows={3} value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional brand description..." />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : (brand ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const BRAND_COLORS = [
  'var(--accent)', 'var(--green)', 'var(--blue)', 'var(--yellow)',
  '#fb923c', '#e879f9', '#34d399', '#60a5fa',
];

export default function BrandsPage() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // null | 'new' | brand object

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/brands');
      setBrands(res.data || []);
    } catch { toast.error('Failed to load brands'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Remove this brand?')) return;
    try {
      await api.delete(`/brands/${id}`);
      toast.success('Brand removed');
      load();
    } catch (err) { toast.error(err?.message || 'Failed'); }
  };

  const filtered = brands.filter(b => b.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Brands</h1>
          <p className="page-subtitle">{brands.length} brands registered</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('new')}>
          <Plus size={16} /> Add Brand
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Brands', value: brands.length, color: 'var(--accent)' },
          { label: 'Active Brands', value: brands.filter(b => b.isActive).length, color: 'var(--green)' },
          { label: 'Added This Month', value: brands.filter(b => new Date(b.createdAt) >= new Date(new Date().setDate(1))).length, color: 'var(--blue)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.color + '20', color: s.color }}><Tag size={20} /></div>
            <div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Search size={16} color="var(--text-muted)" />
          <input className="form-input" style={{ margin: 0, border: 'none', padding: 0, background: 'transparent' }}
            placeholder="Search brands..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" style={{ width: 28, height: 28 }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <Tag size={48} style={{ marginBottom: 12, opacity: 0.3 }} />
            <div style={{ fontWeight: 500, marginBottom: 8 }}>No brands yet</div>
            <button className="btn btn-primary" onClick={() => setModal('new')}>Add First Brand</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {filtered.map((brand, i) => {
            const color = BRAND_COLORS[i % BRAND_COLORS.length];
            const initials = brand.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
            return (
              <div key={brand._id} className="card" style={{ padding: 0, overflow: 'hidden', transition: 'transform 0.15s, box-shadow 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${color}30`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                {/* Color header */}
                <div style={{ height: 6, background: color }} />
                <div style={{ padding: '20px 20px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: color + '20', color, border: `2px solid ${color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: 16, letterSpacing: 1, flexShrink: 0,
                    }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {brand.name}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color, background: color + '18', padding: '2px 8px', borderRadius: 20 }}>
                        Active
                      </span>
                    </div>
                  </div>
                  {brand.description && (
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {brand.description}
                    </p>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
                    Added {new Date(brand.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost" style={{ flex: 1, fontSize: 12, justifyContent: 'center' }} onClick={() => setModal(brand)}>
                      <Edit2 size={13} /> Edit
                    </button>
                    <button className="btn" style={{ flex: 1, fontSize: 12, justifyContent: 'center', background: 'rgba(255,87,87,0.1)', color: 'var(--red)', border: 'none' }}
                      onClick={() => handleDelete(brand._id)}>
                      <Trash2 size={13} /> Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <BrandModal
          brand={modal !== 'new' ? modal : null}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}
