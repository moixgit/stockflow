import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import api, { BACKEND_URL } from '../utils/api.js';
import toast from 'react-hot-toast';
import { ArrowLeft, Upload, X, Search, Package, Tag, Ruler, DollarSign, Layers } from 'lucide-react';
import { calcPricePerPiece, pricingRateLabel } from '../utils/pricing.js';

const EMPTY_FORM = {
  name: '', sku: '', barcode: '', description: '', unit: 'pcs',
  costPrice: 0, sellingPrice: 0, taxRate: 0, reorderPoint: 10,
  category: '', vendors: [], barcodeType: 'CODE128', tags: '',
  brand: '', articleNumber: '', size: '', sizeUnit: 'kg', image: '',
  productType: 'standard', piecesPerBox: 1, canSellLoose: true, setComponents: [],
  pricingMode: 'per_piece', dimensionLength: 0, dimensionWidth: 0, dimensionUnit: 'ft',
};

function SectionCard({ icon: Icon, title, children, accent }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-elevated)' }}>
        {Icon && <Icon size={15} color={accent || 'var(--accent)'} />}
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{title}</span>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

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
          width: '100%', height: 160, borderRadius: 10, border: '2px dashed var(--border)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          cursor: uploading ? 'wait' : 'pointer', overflow: 'hidden', position: 'relative',
          background: value ? 'transparent' : 'var(--bg-tertiary)', transition: 'border-color 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
      >
        {value ? (
          <>
            <img src={value} alt="Product" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = 1}
              onMouseLeave={e => e.currentTarget.style.opacity = 0}>
              <Upload size={20} color="#fff" />
              <span style={{ color: '#fff', fontSize: 12, marginTop: 4 }}>Change image</span>
            </div>
          </>
        ) : (
          <>
            {uploading ? <div className="spinner" /> : <Upload size={24} color="var(--text-muted)" />}
            <span style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>{uploading ? 'Uploading…' : 'Click to upload image'}</span>
            <span style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 4 }}>PNG, JPG up to 5MB</span>
          </>
        )}
      </div>
      {value && (
        <button type="button" className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 8px', color: 'var(--red)' }} onClick={() => onChange('')}>
          <X size={12} /> Remove image
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
    </div>
  );
}

function ProductSearch({ products, value, onChange, placeholder }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const wrapRef = useRef();
  const inputRef = useRef();

  const updatePos = useCallback(() => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: r.width });
    }
  }, []);

  useEffect(() => {
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => { if (open) updatePos(); }, [open, updatePos]);

  const filtered = products.filter(p => {
    if (!query) return true;
    const q = query.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q);
  }).slice(0, 30);

  return (
    <div ref={wrapRef}>
      <div style={{ position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input ref={inputRef} className="form-input" style={{ paddingLeft: 28 }} placeholder={placeholder || 'Search product…'}
          value={value ? value.name : query}
          onChange={e => { setQuery(e.target.value); setOpen(true); if (value) onChange(null); }}
          onFocus={() => { updatePos(); setOpen(true); }} autoComplete="off" />
      </div>
      {open && createPortal(
        <div style={{ position: 'absolute', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 99999, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.22)', maxHeight: 240, overflowY: 'auto' }}>
          {filtered.length === 0
            ? <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>No products found</div>
            : filtered.map(p => (
              <button key={p._id} type="button"
                onMouseDown={e => { e.preventDefault(); onChange(p); setQuery(''); setOpen(false); }}
                style={{ width: '100%', display: 'flex', gap: 8, padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{p.sku}</div>
              </button>
            ))}
        </div>,
        document.body
      )}
    </div>
  );
}

export default function AddProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [brands, setBrands] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    Promise.all([api.get('/categories'), api.get('/vendors'), api.get('/brands')])
      .then(([c, v, b]) => { setCategories(c.data); setVendors(v.data); setBrands(b.data); });
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/products/${id}`).then(r => {
      const p = r.data;
      setForm({
        ...EMPTY_FORM, ...p,
        category: p.category?._id || p.category || '',
        brand: p.brand?._id || p.brand || '',
        vendors: (p.vendors || []).map(v => v._id || v),
        tags: Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || ''),
        articleNumber: p.articleNumber || '',
        size: p.size || '',
        sizeUnit: p.sizeUnit || 'kg',
        image: p.image || '',
        productType: p.productType || 'standard',
        piecesPerBox: p.piecesPerBox || 1,
        canSellLoose: p.canSellLoose !== false,
        pricingMode: p.pricingMode || 'per_piece',
        dimensionLength: p.dimensionLength || 0,
        dimensionWidth: p.dimensionWidth || 0,
        dimensionUnit: p.dimensionUnit || 'ft',
        setComponents: (p.setComponents || []).map(c => ({ product: c.product || null, quantity: c.quantity || 1 })),
      });
    }).finally(() => setLoading(false));
  }, [id, isEdit]);

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

  const margin = form.sellingPrice > 0 && form.costPrice > 0
    ? ((form.sellingPrice - form.costPrice) / form.sellingPrice * 100).toFixed(1)
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        tags: typeof form.tags === 'string' ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : form.tags,
        setComponents: form.setComponents.map(c => ({ product: c.product?._id || c.product, quantity: c.quantity })),
      };
      if (isEdit) {
        await api.put(`/products/${id}`, payload);
        toast.success('Product updated');
      } else {
        await api.post('/products', payload);
        toast.success('Product created');
      }
      navigate('/products');
    } catch (err) { toast.error(err?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" style={{ width: 28, height: 28 }} /></div>;

  return (
    <div style={{ maxWidth: 1060, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate(-1)}><ArrowLeft size={16} /></button>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>{isEdit ? 'Edit Product' : 'Add New Product'}</h1>
            <p className="page-subtitle" style={{ margin: 0 }}>{isEdit ? 'Update product details and pricing' : 'Fill in the details to create a new product'}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>

          {/* ── Left column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Basic Info */}
            <SectionCard icon={Package} title="Basic Information">
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 20 }}>
                <div>
                  <label className="form-label">Product Image</label>
                  <ImageUpload value={form.image} onChange={v => set('image', v)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ margin: 0, gridColumn: '1/-1' }}>
                    <label className="form-label">Product Name *</label>
                    <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Enter product name" required />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">SKU</label>
                    <input className="form-input" value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="Auto-generated if empty" />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Barcode</label>
                    <input className="form-input" value={form.barcode} onChange={e => set('barcode', e.target.value)} placeholder="Auto-generated if empty" />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Brand</label>
                    <select className="form-input" value={form.brand} onChange={e => set('brand', e.target.value)}>
                      <option value="">Select Brand</option>
                      {brands.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Article No. (by Brand)</label>
                    <input className="form-input" value={form.articleNumber} onChange={e => set('articleNumber', e.target.value)} placeholder="Brand's article number" />
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Product Type */}
            <SectionCard icon={Layers} title="Product Type">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[
                  { val: 'standard', label: 'Standard', sub: 'Single item sold by unit', icon: '📦' },
                  { val: 'box', label: 'Box Product', sub: 'Sold in boxes; track loose pieces', icon: '🗃️' },
                  { val: 'set', label: 'Set / Bundle', sub: 'Composed of multiple products', icon: '🎁' },
                ].map(({ val, label, sub, icon }) => (
                  <button key={val} type="button" onClick={() => set('productType', val)}
                    style={{ padding: '12px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', border: `2px solid ${form.productType === val ? 'var(--accent)' : 'var(--border)'}`, background: form.productType === val ? 'var(--accent)0e' : 'var(--bg-elevated)' }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: form.productType === val ? 'var(--accent)' : 'var(--text)' }}>{label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>
                  </button>
                ))}
              </div>

              {form.productType === 'box' && (
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '14px 16px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--accent)', marginBottom: 12 }}>Box Settings</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Pieces per Box</label>
                      <input className="form-input" type="number" min="1" value={form.piecesPerBox} onChange={e => set('piecesPerBox', +e.target.value)} required />
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3 }}>How many pieces come in one box</div>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Selling Options</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.canSellLoose} onChange={e => set('canSellLoose', e.target.checked)} />
                        <span style={{ fontSize: 13 }}>Can sell loose pieces</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {form.productType === 'set' && (
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '14px 16px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--accent)', marginBottom: 12 }}>Set Components</div>
                  {form.setComponents.map((comp, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, background: 'var(--bg-card)', padding: '8px 12px', borderRadius: 8 }}>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{comp.product?.name || 'Unknown'}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{comp.product?.sku}</span>
                      <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Qty:</label>
                      <input type="number" min="1" value={comp.quantity}
                        onChange={e => { const u = [...form.setComponents]; u[idx] = { ...u[idx], quantity: +e.target.value }; set('setComponents', u); }}
                        style={{ width: 56, padding: '3px 6px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text)', fontSize: 13, textAlign: 'center' }} />
                      <button type="button" onClick={() => set('setComponents', form.setComponents.filter((_, i) => i !== idx))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 2, display: 'flex' }}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <ProductSearch
                    products={(allProducts || []).filter(p => p._id !== id)}
                    value={null}
                    onChange={addSetComponent}
                    placeholder="Search and add product to set…"
                  />
                  {form.setComponents.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>Search and add products that make up this set</div>}
                </div>
              )}
            </SectionCard>

            {/* Pricing */}
            <SectionCard icon={DollarSign} title="Pricing & Measurement" accent="var(--green)">
              {/* Pricing mode */}
              <div style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Ruler size={13} /> Pricing Mode</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[
                    ['per_piece', 'Per Piece', 'Price per individual item'],
                    ['per_sqm', 'Per Sq. Meter', 'Price per m² — tiles, panels'],
                    ['per_meter', 'Per Meter', 'Price per running meter'],
                  ].map(([val, label, hint]) => (
                    <button key={val} type="button" onClick={() => set('pricingMode', val)}
                      style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, textAlign: 'left', border: `2px solid ${form.pricingMode === val ? 'var(--green)' : 'var(--border)'}`, background: form.pricingMode === val ? '#16a34a0e' : 'var(--bg-elevated)', color: form.pricingMode === val ? 'var(--green)' : 'var(--text-muted)' }}>
                      {label}
                      <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2, opacity: 0.8 }}>{hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              {form.pricingMode !== 'per_piece' && (
                <div style={{ marginBottom: 16, background: 'var(--bg-elevated)', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--green)', marginBottom: 10 }}>Dimensions</div>
                  <div style={{ display: 'grid', gridTemplateColumns: form.pricingMode === 'per_sqm' ? '1fr 1fr 1fr' : '1fr 1fr', gap: 10 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">{form.pricingMode === 'per_sqm' ? 'Length' : 'Length per piece'}</label>
                      <input className="form-input" type="number" step="0.01" min="0" value={form.dimensionLength} onChange={e => set('dimensionLength', +e.target.value)} />
                    </div>
                    {form.pricingMode === 'per_sqm' && (
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Width</label>
                        <input className="form-input" type="number" step="0.01" min="0" value={form.dimensionWidth} onChange={e => set('dimensionWidth', +e.target.value)} />
                      </div>
                    )}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Unit</label>
                      <select className="form-input" value={form.dimensionUnit} onChange={e => set('dimensionUnit', e.target.value)}>
                        {['ft', 'm', 'cm', 'inch'].map(u => <option key={u} value={u}>{u === 'ft' ? 'Feet (ft)' : u === 'm' ? 'Meters (m)' : u === 'cm' ? 'Centimeters (cm)' : 'Inches (in)'}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Cost Price (Rs{pricingRateLabel(form)}) *</label>
                  <input className="form-input" type="number" step="0.01" value={form.costPrice} onChange={e => set('costPrice', +e.target.value)} required />
                  {form.pricingMode !== 'per_piece' && form.costPrice > 0 && (
                    <div style={{ fontSize: 10, color: 'var(--orange)', marginTop: 3 }}>≈ Rs {calcPricePerPiece(form, form.costPrice).toFixed(2)}/pcs</div>
                  )}
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Selling Price (Rs{pricingRateLabel(form)}) *</label>
                  <input className="form-input" type="number" step="0.01" value={form.sellingPrice} onChange={e => set('sellingPrice', +e.target.value)} required />
                  {form.pricingMode !== 'per_piece' && form.sellingPrice > 0 && (
                    <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 3 }}>≈ Rs {calcPricePerPiece(form, form.sellingPrice).toFixed(2)}/pcs</div>
                  )}
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Tax Rate (%)</label>
                  <input className="form-input" type="number" step="0.01" value={form.taxRate} onChange={e => set('taxRate', +e.target.value)} />
                </div>
              </div>
            </SectionCard>

            {/* Classification */}
            <SectionCard icon={Tag} title="Classification & Details">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Category</label>
                  <select className="form-input" value={form.category} onChange={e => set('category', e.target.value)}>
                    <option value="">Select Category</option>
                    {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Unit</label>
                  <select className="form-input" value={form.unit} onChange={e => set('unit', e.target.value)}>
                    {['pcs', 'kg', 'g', 'lbs', 'oz', 'l', 'ml', 'box', 'pack', 'pair', 'set', 'dozen'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Size</label>
                  <input className="form-input" value={form.size} onChange={e => set('size', e.target.value)} placeholder="e.g. 5, XL, 32x30" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Size Unit</label>
                  <select className="form-input" value={form.sizeUnit} onChange={e => set('sizeUnit', e.target.value)}>
                    {['kg', 'g', 'lbs', 'oz', 'ft', 'm', 'cm', 'mm', 'l', 'ml', 'inch', 'yard', 'pcs', 'other'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Reorder Point</label>
                  <input className="form-input" type="number" value={form.reorderPoint} onChange={e => set('reorderPoint', +e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Barcode Type</label>
                  <select className="form-input" value={form.barcodeType} onChange={e => set('barcodeType', e.target.value)}>
                    {['CODE128', 'EAN13', 'EAN8', 'UPCA', 'QR'].map(t => <option key={t} value={t}>{t === 'EAN13' ? 'EAN-13' : t === 'EAN8' ? 'EAN-8' : t === 'UPCA' ? 'UPC-A' : t}</option>)}
                  </select>
                </div>

                {/* Vendors */}
                <div className="form-group" style={{ margin: 0, gridColumn: '1/-1' }}>
                  <label className="form-label">Vendors</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {(form.vendors || []).map(vid => {
                      const v = vendors.find(x => x._id === vid);
                      return v ? (
                        <span key={vid} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--accent)18', color: 'var(--accent)', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 500 }}>
                          {v.name}
                          <button type="button" onClick={() => set('vendors', form.vendors.filter(i => i !== vid))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
                        </span>
                      ) : null;
                    })}
                  </div>
                  <select className="form-input" value=""
                    onChange={e => { const val = e.target.value; if (val && !(form.vendors || []).includes(val)) set('vendors', [...(form.vendors || []), val]); e.target.value = ''; }}>
                    <option value="">+ Add vendor…</option>
                    {vendors.filter(v => !(form.vendors || []).includes(v._id)).map(v => (
                      <option key={v._id} value={v._id}>{v.name}{v.company ? ` — ${v.company}` : ''}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0, gridColumn: '1/-1' }}>
                  <label className="form-label">Tags (comma separated)</label>
                  <input className="form-input" value={Array.isArray(form.tags) ? form.tags.join(', ') : form.tags}
                    onChange={e => set('tags', e.target.value)} placeholder="electronics, sale, featured" />
                </div>
                <div className="form-group" style={{ margin: 0, gridColumn: '1/-1' }}>
                  <label className="form-label">Description</label>
                  <textarea className="form-input" rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional product description…" />
                </div>
              </div>
            </SectionCard>
          </div>

          {/* ── Right sidebar ── */}
          <div style={{ position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Preview card */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>Product Preview</span>
              </div>
              <div style={{ padding: 18 }}>
                {form.image && (
                  <img src={form.image} alt="" style={{ width: '100%', height: 120, objectFit: 'contain', borderRadius: 8, marginBottom: 12, border: '1px solid var(--border)' }} />
                )}
                {form.name ? (
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{form.name}</div>
                ) : (
                  <div style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 4 }}>Enter product name…</div>
                )}
                {form.sku && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>{form.sku}</div>}
                {form.productType === 'box' && (
                  <div style={{ fontSize: 10, fontWeight: 700, background: 'var(--accent)18', color: 'var(--accent)', borderRadius: 4, padding: '2px 7px', display: 'inline-block', marginBottom: 8 }}>
                    BOX · {form.piecesPerBox} pcs/box
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {form.costPrice > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Cost</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--orange)' }}>Rs {(+form.costPrice).toFixed(2)}{pricingRateLabel(form)}</span>
                    </div>
                  )}
                  {form.sellingPrice > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Price</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>Rs {(+form.sellingPrice).toFixed(2)}{pricingRateLabel(form)}</span>
                    </div>
                  )}
                  {margin !== null && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 2 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Margin</span>
                      <span style={{ fontWeight: 700, color: +margin >= 30 ? 'var(--green)' : +margin >= 15 ? 'var(--orange)' : 'var(--red)' }}>{margin}%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Save button */}
            <button type="submit" className="btn btn-primary" disabled={saving}
              style={{ padding: '14px', fontSize: 15, fontWeight: 700, borderRadius: 10 }}>
              {saving ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Saving…</> : (isEdit ? '✓ Save Changes' : '✓ Create Product')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
          </div>
        </div>
      </form>
    </div>
  );
}
