import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { BACKEND_URL } from '../utils/api.js';
import toast from 'react-hot-toast';
import { Plus, Search, Edit2, Trash2, Package, RefreshCw, Upload, X, ExternalLink, ChevronDown, Ruler } from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';
import { calcPricePerPiece, pricingRateLabel, dimensionDisplay } from '../utils/pricing.js';

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

function ProductSearch({ products, value, onChange, placeholder = 'Search product...' }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef();

  useEffect(() => {
    const handler = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = products.filter(p => {
    if (!query) return true;
    const q = query.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q);
  }).slice(0, 30);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input className="form-input" style={{ paddingLeft: 28 }} placeholder={placeholder}
          value={value ? value.name : query}
          onChange={e => { setQuery(e.target.value); setOpen(true); if (value) onChange(null); }}
          onFocus={() => setOpen(true)} autoComplete="off" />
      </div>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', maxHeight: 220, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>No products found</div>
          ) : filtered.map(p => (
            <button key={p._id} type="button"
              onClick={() => { onChange(p); setQuery(''); setOpen(false); }}
              style={{ width: '100%', display: 'flex', gap: 8, padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{p.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{p.sku}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductModal({ product, onClose, onSave, categories, vendors, brands }) {
  const [allProducts, setAllProducts] = useState([]);
  const [form, setForm] = useState(() => {
    if (!product) return {
      name: '', sku: '', barcode: '', description: '', unit: 'pcs',
      costPrice: 0, sellingPrice: 0, taxRate: 0, reorderPoint: 10,
      category: '', vendors: [], barcodeType: 'CODE128', tags: '',
      brand: '', articleNumber: '', size: '', sizeUnit: 'kg', image: '',
      productType: 'standard', piecesPerBox: 1, canSellLoose: true, setComponents: [],
      pricingMode: 'per_piece', dimensionLength: 0, dimensionWidth: 0, dimensionUnit: 'ft',
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
      productType: product.productType || 'standard',
      piecesPerBox: product.piecesPerBox || 1,
      canSellLoose: product.canSellLoose !== false,
      pricingMode: product.pricingMode || 'per_piece',
      dimensionLength: product.dimensionLength || 0,
      dimensionWidth: product.dimensionWidth || 0,
      dimensionUnit: product.dimensionUnit || 'ft',
      setComponents: (product.setComponents || []).map(c => ({
        product: c.product || null,
        quantity: c.quantity || 1,
      })),
    };
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (form.productType === 'set') {
      api.get('/products?limit=500').then(r => setAllProducts(r.data || [])).catch(() => {});
    }
  }, [form.productType]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const addSetComponent = (prod) => {
    if (!prod) return;
    const exists = form.setComponents.find(c => (c.product?._id || c.product) === prod._id);
    if (exists) return toast.error('Product already in set');
    set('setComponents', [...form.setComponents, { product: prod, quantity: 1 }]);
  };

  const removeSetComponent = (idx) => {
    set('setComponents', form.setComponents.filter((_, i) => i !== idx));
  };

  const updateComponentQty = (idx, qty) => {
    const updated = [...form.setComponents];
    updated[idx] = { ...updated[idx], quantity: +qty };
    set('setComponents', updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        tags: typeof form.tags === 'string' ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : form.tags,
        setComponents: form.setComponents.map(c => ({ product: c.product?._id || c.product, quantity: c.quantity })),
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

          {/* Product Type */}
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Product Type</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['standard', 'Standard'], ['box', 'Box Product'], ['set', 'Set / Bundle']].map(([val, label]) => (
                <button key={val} type="button"
                  onClick={() => set('productType', val)}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${form.productType === val ? 'var(--accent)' : 'var(--border)'}`,
                    background: form.productType === val ? 'var(--accent)18' : 'var(--bg-elevated)',
                    color: form.productType === val ? 'var(--accent)' : 'var(--text-muted)',
                    fontWeight: form.productType === val ? 600 : 400,
                    cursor: 'pointer', fontSize: 13,
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Box product fields */}
          {form.productType === 'box' && (
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '12px 14px', marginBottom: 16, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Box Settings</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Pieces per Box</label>
                  <input className="form-input" type="number" min="1" value={form.piecesPerBox} onChange={e => set('piecesPerBox', +e.target.value)} required />
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>How many pieces come in one box</div>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Selling Options</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.canSellLoose} onChange={e => set('canSellLoose', e.target.checked)} />
                    <span style={{ fontSize: 13 }}>Can sell loose (individual pieces)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Set product component builder */}
          {form.productType === 'set' && (
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '12px 14px', marginBottom: 16, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Set Components</div>
              {form.setComponents.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  {form.setComponents.map((comp, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, background: 'var(--bg-card)', padding: '6px 10px', borderRadius: 6 }}>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{comp.product?.name || 'Unknown'}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{comp.product?.sku}</span>
                      <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Qty:</label>
                      <input type="number" min="1" value={comp.quantity}
                        onChange={e => updateComponentQty(idx, e.target.value)}
                        style={{ width: 56, padding: '3px 6px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text)', fontSize: 13, textAlign: 'center' }} />
                      <button type="button" onClick={() => removeSetComponent(idx)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 2, display: 'flex' }}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <ProductSearch
                products={(allProducts || []).filter(p => p._id !== product?._id)}
                value={null}
                onChange={addSetComponent}
                placeholder="Add product to set..."
              />
              {form.setComponents.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>Search and add products that make up this set</div>}
            </div>
          )}

          {/* Pricing Mode */}
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '12px 14px', marginBottom: 16, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Ruler size={13} /> Pricing Mode
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[
                ['per_piece', 'Per Piece', 'Price set per individual item'],
                ['per_sqm',   'Per Sq. Meter', 'Price per m² — enter tile/panel dimensions'],
                ['per_meter', 'Per Meter', 'Price per running meter — enter length per piece'],
              ].map(([val, label, hint]) => (
                <button key={val} type="button"
                  onClick={() => set('pricingMode', val)}
                  style={{
                    flex: 1, padding: '8px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, textAlign: 'left',
                    border: `1px solid ${form.pricingMode === val ? 'var(--accent)' : 'var(--border)'}`,
                    background: form.pricingMode === val ? 'var(--accent)18' : 'var(--bg-card)',
                    color: form.pricingMode === val ? 'var(--accent)' : 'var(--text-muted)',
                  }}>
                  {label}
                  <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2, opacity: 0.8 }}>{hint}</div>
                </button>
              ))}
            </div>

            {form.pricingMode !== 'per_piece' && (
              <div style={{ display: 'grid', gridTemplateColumns: form.pricingMode === 'per_sqm' ? '1fr 1fr 1fr' : '1fr 1fr', gap: 10 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{form.pricingMode === 'per_sqm' ? 'Length' : 'Length per piece'}</label>
                  <input className="form-input" type="number" step="0.01" min="0"
                    value={form.dimensionLength}
                    onChange={e => set('dimensionLength', +e.target.value)} />
                </div>
                {form.pricingMode === 'per_sqm' && (
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Width</label>
                    <input className="form-input" type="number" step="0.01" min="0"
                      value={form.dimensionWidth}
                      onChange={e => set('dimensionWidth', +e.target.value)} />
                  </div>
                )}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Unit</label>
                  <select className="form-input" value={form.dimensionUnit} onChange={e => set('dimensionUnit', e.target.value)}>
                    <option value="ft">Feet (ft)</option>
                    <option value="m">Meters (m)</option>
                    <option value="cm">Centimeters (cm)</option>
                    <option value="inch">Inches (in)</option>
                  </select>
                </div>
              </div>
            )}

            {form.pricingMode !== 'per_piece' && form.dimensionLength > 0 && (form.pricingMode !== 'per_sqm' || form.dimensionWidth > 0) && (
              <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
                {form.costPrice > 0 && (
                  <div style={{ padding: '6px 12px', background: 'var(--bg-card)', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Cost/piece: </span>
                    <strong style={{ color: 'var(--orange)' }}>Rs {calcPricePerPiece(form, form.costPrice).toFixed(2)}</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}> (at Rs {form.costPrice}{pricingRateLabel(form)})</span>
                  </div>
                )}
                {form.sellingPrice > 0 && (
                  <div style={{ padding: '6px 12px', background: 'var(--bg-card)', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Sell/piece: </span>
                    <strong style={{ color: 'var(--green)' }}>Rs {calcPricePerPiece(form, form.sellingPrice).toFixed(2)}</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}> (at Rs {form.sellingPrice}{pricingRateLabel(form)})</span>
                  </div>
                )}
              </div>
            )}
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
              <label className="form-label">Cost Price (Rs{pricingRateLabel(form)}) *</label>
              <input className="form-input" type="number" step="0.01" value={form.costPrice} onChange={e => set('costPrice', +e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Selling Price (Rs{pricingRateLabel(form)}) *</label>
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 500 }}>{p.name}</span>
                            {p.productType === 'box' && (
                              <span style={{ fontSize: 10, fontWeight: 600, background: 'var(--accent)18', color: 'var(--accent)', borderRadius: 4, padding: '1px 6px' }}>
                                BOX/{p.piecesPerBox}pcs
                              </span>
                            )}
                            {p.productType === 'set' && (
                              <span style={{ fontSize: 10, fontWeight: 600, background: '#8b5cf618', color: '#8b5cf6', borderRadius: 4, padding: '1px 6px' }}>
                                SET
                              </span>
                            )}
                            {p.pricingMode === 'per_sqm' && (
                              <span style={{ fontSize: 10, fontWeight: 600, background: '#0ea5e918', color: '#0ea5e9', borderRadius: 4, padding: '1px 6px' }}>
                                {dimensionDisplay(p)} · /sqm
                              </span>
                            )}
                            {p.pricingMode === 'per_meter' && (
                              <span style={{ fontSize: 10, fontWeight: 600, background: '#f59e0b18', color: '#f59e0b', borderRadius: 4, padding: '1px 6px' }}>
                                {dimensionDisplay(p)} · /m
                              </span>
                            )}
                          </div>
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
                        <td style={{ color: 'var(--text-muted)' }}>
                          <div>{fmt(p.costPrice)}<span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{pricingRateLabel(p)}</span></div>
                          {p.pricingMode && p.pricingMode !== 'per_piece' && (
                            <div style={{ fontSize: 10, color: 'var(--orange)' }}>{fmt(calcPricePerPiece(p, p.costPrice))}/pcs</div>
                          )}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          <div>{fmt(p.sellingPrice)}<span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 400 }}>{pricingRateLabel(p)}</span></div>
                          {p.pricingMode && p.pricingMode !== 'per_piece' && (
                            <div style={{ fontSize: 10, color: 'var(--green)' }}>{fmt(calcPricePerPiece(p, p.sellingPrice))}/pcs</div>
                          )}
                        </td>
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
                            const withStock = stock.filter(s => s.quantity > 0 || s.looseQuantity > 0);
                            const isBox = p.productType === 'box';
                            return (
                              <div style={{ minWidth: 80 }}>
                                <span className={`badge ${total === 0 ? 'badge-red' : total <= p.reorderPoint ? 'badge-yellow' : 'badge-green'}`}>
                                  {isBox ? `${total} boxes` : `${total} ${p.unit || 'pcs'}`}
                                </span>
                                {withStock.length > 0 && (
                                  <div style={{ marginTop: 4 }}>
                                    {withStock.map(s => (
                                      <div key={s.warehouse._id} style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                        {s.warehouse.name}: <span style={{ color: 'var(--text)', fontWeight: 500 }}>{s.quantity}{isBox ? ` box${s.quantity !== 1 ? 'es' : ''}` : ''}</span>
                                        {isBox && s.looseQuantity > 0 && <span style={{ color: 'var(--text-muted)' }}> +{s.looseQuantity}pcs</span>}
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
