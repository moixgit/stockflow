import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', parent: '' });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories?limit=200');
      setCategories(res.data || []);
    } catch { toast.error('Failed to load categories'); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditing(null); setForm({ name: '', description: '', parent: '' }); setShowModal(true); };
  const openEdit = (cat) => { setEditing(cat); setForm({ name: cat.name, description: cat.description || '', parent: cat.parent?._id || '' }); setShowModal(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Name is required');
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/categories/${editing._id}`, form);
        toast.success('Category updated');
      } else {
        await api.post('/categories', form);
        toast.success('Category created');
      }
      setShowModal(false);
      fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this category?')) return;
    try {
      await api.delete(`/categories/${id}`);
      toast.success('Deleted');
      fetchCategories();
    } catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  const toggleActive = async (cat) => {
    try {
      await api.put(`/categories/${cat._id}`, { isActive: !cat.isActive });
      fetchCategories();
    } catch { toast.error('Update failed'); }
  };

  // Build tree structure
  const buildTree = (cats) => {
    const roots = cats.filter(c => !c.parent);
    const children = cats.filter(c => c.parent);
    return roots.map(r => ({
      ...r,
      children: children.filter(c => c.parent?._id === r._id || c.parent === r._id)
    }));
  };

  const filtered = categories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );
  const tree = buildTree(filtered);
  const rootCategories = categories.filter(c => !c.parent);

  const stats = {
    total: categories.length,
    active: categories.filter(c => c.isActive).length,
    roots: rootCategories.length,
    children: categories.filter(c => c.parent).length,
  };

  if (loading) return <div className="page-container"><div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '80px' }}>Loading categories…</div></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Categories</h1>
          <p className="page-subtitle">Organize products into hierarchical categories</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ New Category</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total', value: stats.total, icon: '🏷️', color: 'var(--accent)' },
          { label: 'Active', value: stats.active, icon: '✅', color: 'var(--green)' },
          { label: 'Root', value: stats.roots, icon: '🌳', color: 'var(--yellow)' },
          { label: 'Sub-categories', value: stats.children, icon: '🌿', color: 'var(--blue)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.color + '20', color: s.color }}>{s.icon}</div>
            <div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="card" style={{ marginBottom: '16px', padding: '12px 16px' }}>
        <input
          className="form-input"
          style={{ margin: 0 }}
          placeholder="Search categories..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Category Tree */}
      <div className="card">
        <h3 style={{ marginBottom: '20px', color: 'var(--text-primary)' }}>Category Hierarchy</h3>

        {tree.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🏷️</div>
            <div style={{ marginBottom: '8px' }}>No categories yet</div>
            <button className="btn btn-primary" onClick={openCreate}>Create First Category</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {tree.map(cat => (
              <div key={cat._id}>
                {/* Root category */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '14px 16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: 'var(--accent)20',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px'
                    }}>🌳</div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cat.name}</div>
                      {cat.description && <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{cat.description}</div>}
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>/{cat.slug}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {cat.children?.length > 0 && (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{cat.children.length} sub-categories</span>
                    )}
                    <span className={`badge ${cat.isActive ? 'badge-success' : 'badge-danger'}`}>
                      {cat.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => openEdit(cat)}>Edit</button>
                    <button
                      className="btn"
                      style={{ padding: '6px 12px', fontSize: '12px', background: cat.isActive ? 'rgba(255,87,87,0.1)' : 'rgba(34,211,160,0.1)', color: cat.isActive ? 'var(--red)' : 'var(--green)', border: 'none' }}
                      onClick={() => toggleActive(cat)}
                    >
                      {cat.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      onClick={() => handleDelete(cat._id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Child categories */}
                {cat.children?.map(child => (
                  <div key={child._id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    marginTop: '8px',
                    marginLeft: '32px',
                    borderLeft: '3px solid var(--accent)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '6px',
                        background: 'var(--green)20',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px'
                      }}>🌿</div>
                      <div>
                        <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '14px' }}>{child.name}</div>
                        {child.description && <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{child.description}</div>}
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>/{child.slug}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`badge ${child.isActive ? 'badge-success' : 'badge-danger'}`}>
                        {child.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => openEdit(child)}>Edit</button>
                      <button className="btn btn-danger" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => handleDelete(child._id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Edit Category' : 'New Category'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Category Name *</label>
                <input className="form-input" placeholder="e.g. Electronics" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-input" rows={3} placeholder="Optional description..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Parent Category (optional)</label>
                <select className="form-input" value={form.parent} onChange={e => setForm({ ...form, parent: e.target.value })}>
                  <option value="">-- None (root category) --</option>
                  {rootCategories.filter(c => c._id !== editing?._id).map(c => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
