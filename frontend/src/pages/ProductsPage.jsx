import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { BACKEND_URL } from '../utils/api.js';
import toast from 'react-hot-toast';
import { Plus, Search, Edit2, Trash2, Package, RefreshCw, Upload, X, ExternalLink } from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';

const fmt = (n) => `Rs ${(n || 0).toFixed(2)}`;

function ImageUpload({ value, onChange }) {
  const inputRef = useRef();
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await api.post('/products/upload', fd);
      onChange(BACKEND_URL + res.url);
    } catch { toast.error('Image upload failed'); }
    finally { setUploading(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        onClick={() => !uploading && inputRef.current.click()}
        style={{
          width: '100%', height: 140, borderRadius: 10, border: '2px dashed var(--border)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          cursor: uploading ? 'wait' : 'pointer', overflow: 'hidden', position: 'relative',
          background: value ? 'transparent' : 'var(--bg-tertiary)',
          transition: 'border-color 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
      >
        {value ? (
          <>
            <img src={value} alt="Product" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              opacity: 0, transition: 'opacity 0.2s',
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = 1}
              onMouseLeave={e => e.currentTarget.style.opacity = 0}
            >
              <Upload size={20} color="#fff" />
              <span style={{ color: '#fff', fontSize: 12, marginTop: 4 }}>Change image</span>
            </div>
          </>
        ) : (
          <>
            {uploading ? <div className="spinner" /> : <Upload size={24} color="var(--text-muted)" />}
            <span style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>
              {uploading ? 'Uploading...' : 'Click to upload image'}
            </span>
            <span style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 4 }}>PNG, JPG up to 5MB</span>
          </>
        )}
      </div>
      {value && (
        <button type="button" className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 8px', color: 'var(--red)' }}
          onClick={() => onChange('')}>
          <X size={12} /> Remove image
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
    </div>
  );
}

function ProductModal({ product, onClose, onSave, categories, vendors, brands }) {
  const [form, setForm] = useState(() => {
    if (!product) return {
      name: '', sku: '', barcode: '', description: '', unit: 'pcs',
      costPrice: 0, sellingPrice: 0, taxRate: 0, reorderPoint: 10,
      category: '', vendors: [], barcodeType: 'CODE128', tags: '',
      brand: '', articleNumber: '', size: '', sizeUnit: 'kg', image: '',
    };
    return {
      ...product,
      category: product.category?._id || product.category || '',
      brand: product.brand?._id || product.brand || '',
      vendors: (product.vendors || []).map(v => v._id || v),
      tags: Array.isArray(product.tags) ? product.tags.join(', ') : (product.tags || ''),
      articleNumber: product.articleNumber || '',
      size: product.size || '',
      sizeUnit: product.sizeUnit || 'kg',
      image: product.image || '',
    };
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        tags: typeof form.tags === 'string' ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : form.tags,
      };
      if (product) await api.put(`/products/${product._id}`, payload);
      else await api.post('/products', payload);
      toast.success(product ? 'Product updated' : 'Product created');
      onSave();
    } catch (err) { toast.error(err?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" style={{ maxWidth: 760 }}>
        <div className="modal-header">
          <h2 className="modal-title">{product ? 'Edit Product' : 'Add New Product'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, marginBottom: 16 }}>
            <div>
              <label className="form-label">Product Image</label>
              <ImageUpload value={form.image} onChange={v => set('image', v)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Product Name *</label>
                <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">SKU</label>
                <input className="form-input" value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="Auto-generated if empty" />
              </div>
              <div className="form-group">
                <label className="form-label">Barcode</label>
                <input className="form-input" value={form.barcode} onChange={e => set('barcode', e.target.value)} placeholder="Auto-generated if empty" />
              </div>
              <div className="form-group">
                <label className="form-label">Brand</label>
                <select className="form-input" value={form.brand} onChange={e => set('brand', e.target.value)}>
                  <option value="">Select Brand</option>
                  {brands.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Article No. (by Brand)</label>
                <input className="form-input" value={form.articleNumber} onChange={e => set('articleNumber', e.target.value)} placeholder="Brand's article number" />
              </div>
            </div>
          </div>

          <div className="form-grid form-grid-2" style={{ gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-input" value={form.category} onChange={e => set('category', e.target.value)}>
                <option value="">Select Category</option>
                {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Vendors</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {(form.vendors || []).map(vid => {
                  const v = vendors.find(x => x._id === vid);
                  return v ? (
                    <span key={vid} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--accent)18', color: 'var(--accent)', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 500 }}>
                      {v.name}
                      <button type="button" onClick={() => set('vendors', form.vendors.filter(id => id !== vid))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
                    </span>
                  ) : null;
                })}
              </div>
              <select className="form-input"
                value=""
                onChange={e => {
                  const val = e.target.value;
                  if (val && !(form.vendors || []).includes(val)) set('vendors', [...(form.vendors || []), val]);
                  e.target.value = '';
                }}>
                <option value="">+ Add vendor...</option>
                {vendors.filter(v => !(form.vendors || []).includes(v._id)).map(v => (
                  <option key={v._id} value={v._id}>{v.name}{v.company ? ` — ${v.company}` : ''}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Size</label>
              <input className="form-input" value={form.size} onChange={e => set('size', e.target.value)} placeholder="e.g. 5, XL, 32x30" />
            </div>
            <div className="form-group">
              <label className="form-label">Size Unit</label>
              <select className="form-input" value={form.sizeUnit} onChange={e => set('sizeUnit', e.target.value)}>
                {['kg', 'g', 'lbs', 'oz', 'ft', 'm', 'cm', 'mm', 'l', 'ml', 'inch', 'yard', 'pcs', 'other'].map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Cost Price ($) *</label>
              <input className="form-input" type="number" step="0.01" value={form.costPrice} onChange={e => set('costPrice', +e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Selling Price ($) *</label>
              <input className="form-input" type="number" step="0.01" value={form.sellingPrice} onChange={e => set('sellingPrice', +e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Tax Rate (%)</label>
              <input className="form-input" type="number" step="0.01" value={form.taxRate} onChange={e => set('taxRate', +e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Unit</label>
              <select className="form-input" value={form.unit} onChange={e => set('unit', e.target.value)}>
                {['pcs', 'kg', 'g', 'lbs', 'oz', 'l', 'ml', 'box', 'pack', 'pair', 'set', 'dozen'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Reorder Point</label>
              <input className="form-input" type="number" value={form.reorderPoint} onChange={e => set('reorderPoint', +e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Barcode Type</label>
              <select className="form-input" value={form.barcodeType} onChange={e => set('barcodeType', e.target.value)}>
                <option value="CODE128">CODE128</option>
                <option value="EAN13">EAN-13</option>
                <option value="EAN8">EAN-8</option>
                <option value="UPCA">UPC-A</option>
                <option value="QR">QR Code</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Tags (comma separated)</label>
              <input className="form-input" value={Array.isArray(form.tags) ? form.tags.join(', ') : form.tags} onChange={e => set('tags', e.target.value)} placeholder="electronics, sale, featured" />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Description</label>
              <textarea className="form-input" rows={3} value={form.description} onChange={e => set('description', e.target.value)} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : (product ? 'Update Product' : 'Create Product')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modal, setModal] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;
  const { isInventoryManager } = useAuthStore();
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit, ...(search && { search }), ...(categoryFilter && { category: categoryFilter }) });
      const [p, c, v, b] = await Promise.all([
        api.get(`/products?${params}`),
        api.get('/categories'),
        api.get('/vendors'),
        api.get('/brands'),
      ]);
      setProducts(p.data);
      setTotal(p.total);
      setCategories(c.data);
      setVendors(v.data);
      setBrands(b.data);
    } finally { setLoading(false); }
  }, [page, search, categoryFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!confirm('Deactivate this product?')) return;
    try { await api.delete(`/products/${id}`); toast.success('Product deactivated'); load(); }
    catch (err) { toast.error(err?.message || 'Failed'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">{total} products total</p>
        </div>
        {isInventoryManager() && (
          <button className="btn btn-primary" onClick={() => setModal('add')}>
            <Plus size={16} /> Add Product
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card mb-16">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
            <Search size={16} />
            <input className="form-input" placeholder="Search by name, SKU, brand, article no..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="form-input" style={{ width: 180 }} value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <button className="btn btn-secondary" onClick={load}><RefreshCw size={14} /></button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" style={{ width: 28, height: 28 }} /></div>
        ) : products.length === 0 ? (
          <div className="empty-state"><Package /><p>No products found</p></div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 48 }}></th>
                    <th>Product</th>
                    <th>Brand</th>
                    <th>Article No.</th>
                    <th>Size</th>
                    <th>SKU</th>
                    <th>Category</th>
                    <th>Cost</th>
                    <th>Price</th>
                    <th>Margin</th>
                    <th>Reorder Pt.</th>
                    <th>Stock</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => {
                    const margin = p.sellingPrice > 0 ? ((p.sellingPrice - p.costPrice) / p.sellingPrice * 100).toFixed(1) : 0;
                    return (
                      <tr key={p._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/products/${p._id}`)}>
                        <td onClick={e => e.stopPropagation()}>
                          {p.image ? (
                            <img src={p.image} alt={p.name} style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border)' }} />
                          ) : (
                            <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Package size={16} color="var(--text-muted)" />
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{p.name}</div>
                          {p.vendors?.length > 0 && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {p.vendors[0].name}{p.vendors.length > 1 ? ` +${p.vendors.length - 1} more` : ''}
                            </div>
                          )}
                        </td>
                        <td>{p.brand?.name || <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>
                        <td><span className="text-mono" style={{ fontSize: 11 }}>{p.articleNumber || <span style={{ color: 'var(--text-dim)', fontFamily: 'inherit' }}>—</span>}</span></td>
                        <td>{p.size ? `${p.size} ${p.sizeUnit || ''}`.trim() : <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>
                        <td><span className="text-mono">{p.sku}</span></td>
                        <td>{p.category?.name || '—'}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{fmt(p.costPrice)}</td>
                        <td style={{ fontWeight: 600 }}>{fmt(p.sellingPrice)}</td>
                        <td>
                          <span className={`badge ${margin >= 30 ? 'badge-green' : margin >= 15 ? 'badge-yellow' : 'badge-red'}`}>
                            {margin}%
                          </span>
                        </td>
                        <td><span className="text-mono">{p.reorderPoint}</span></td>
                        <td onClick={e => e.stopPropagation()}>
                          {(() => {
                            const stock = p.stock || [];
                            const total = stock.reduce((s, i) => s + i.quantity, 0);
                            const withStock = stock.filter(s => s.quantity > 0);
                            return (
                              <div style={{ minWidth: 80 }}>
                                <span className={`badge ${total === 0 ? 'badge-red' : total <= p.reorderPoint ? 'badge-yellow' : 'badge-green'}`}>
                                  {total} {p.unit || 'pcs'}
                                </span>
                                {withStock.length > 0 && (
                                  <div style={{ marginTop: 4 }}>
                                    {withStock.map(s => (
                                      <div key={s.warehouse._id} style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                        {s.warehouse.name}: <span style={{ color: 'var(--text)', fontWeight: 500 }}>{s.quantity}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => navigate(`/products/${p._id}`)} title="View details">
                              <ExternalLink size={13} />
                            </button>
                            {isInventoryManager() && (
                              <>
                                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setModal(p)} title="Edit">
                                  <Edit2 size={13} />
                                </button>
                                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(p._id)} title="Delete" style={{ color: 'var(--red)' }}>
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              {Array.from({ length: Math.ceil(total / limit) }, (_, i) => (
                <button key={i} className={`page-btn ${page === i + 1 ? 'active' : ''}`} onClick={() => setPage(i + 1)}>{i + 1}</button>
              ))}
            </div>
          </>
        )}
      </div>

      {modal && (
        <ProductModal
          product={modal !== 'add' ? modal : null}
          categories={categories}
          vendors={vendors}
          brands={brands}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}
