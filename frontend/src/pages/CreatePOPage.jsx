import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api.js';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, X, Search, Package, Building2, User, CreditCard, FileText, Truck } from 'lucide-react';
import { calcPricePerPiece, dimensionDisplay } from '../utils/pricing.js';

const fmt = n => `Rs ${(n || 0).toFixed(2)}`;

const BLANK_ITEM = {
  product: '', orderedQty: 1, costPrice: '', sellingPrice: '',
  orderingUnit: 'boxes', priceInputMode: 'piece', vendorRate: '', looseQty: '',
};

function processItemsForEdit(items) {
  const result = [];
  const boxIdx = new Map();
  items.forEach(i => {
    const pid = i.product?._id || i.product || '';
    if (i.orderingUnit !== 'loose') {
      const idx = result.length;
      result.push({ product: pid, orderedQty: i.orderedQty, costPrice: i.costPrice, sellingPrice: i.sellingPrice || 0, orderingUnit: i.orderingUnit || 'boxes', priceInputMode: 'piece', vendorRate: '', looseQty: '' });
      boxIdx.set(pid, idx);
    }
  });
  items.forEach(i => {
    const pid = i.product?._id || i.product || '';
    if (i.orderingUnit === 'loose') {
      const idx = boxIdx.get(pid);
      if (idx !== undefined) result[idx].looseQty = i.orderedQty;
      else result.push({ product: pid, orderedQty: i.orderedQty, costPrice: i.costPrice, sellingPrice: i.sellingPrice || 0, orderingUnit: 'loose', priceInputMode: 'piece', vendorRate: '', looseQty: '' });
    }
  });
  return result;
}

function ProductThumb({ product, size = 36 }) {
  if (product?.image) {
    return <img src={product.image} alt="" style={{ width: size, height: size, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: 6, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Package size={size * 0.45} color="var(--text-muted)" />
    </div>
  );
}

function ProductAutocomplete({ products, value, onChange }) {
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
    const close = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    if (open) updatePos();
  }, [open, updatePos]);

  const selected = value ? products.find(p => p._id === value) : null;
  const filtered = products.filter(p => {
    const q = query.toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q) || (p.brand?.name || '').toLowerCase().includes(q);
  }).slice(0, 30);

  const dropdown = open && createPortal(
    <div style={{ position: 'absolute', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 99999, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.22)', maxHeight: 320, overflowY: 'auto' }}>
      {filtered.length === 0
        ? <div style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: 13 }}>No products found</div>
        : filtered.map(p => (
          <button key={p._id} type="button"
            onMouseDown={e => { e.preventDefault(); onChange(p._id); setQuery(''); setOpen(false); }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <ProductThumb product={p} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{p.name}</span>
                {p.productType === 'box' && <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--accent)18', color: 'var(--accent)', borderRadius: 4, padding: '1px 5px' }}>BOX/{p.piecesPerBox}pcs</span>}
                {p.productType === 'set' && <span style={{ fontSize: 10, fontWeight: 700, background: '#8b5cf618', color: '#8b5cf6', borderRadius: 4, padding: '1px 5px' }}>SET</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 2, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{p.sku}</span>
                {p.brand?.name && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{p.brand.name}</span>}
                {p.category?.name && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>· {p.category.name}</span>}
              </div>
            </div>
            {p.sellingPrice > 0 && (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>Rs {p.sellingPrice}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>sell</div>
              </div>
            )}
          </button>
        ))}
    </div>,
    document.body
  );

  if (selected) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--bg-elevated)', border: '2px solid var(--accent)', borderRadius: 8 }}>
        <ProductThumb product={selected} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selected.name}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{selected.sku}</span>
            {selected.productType === 'box' && <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--accent)18', color: 'var(--accent)', borderRadius: 4, padding: '1px 5px' }}>BOX/{selected.piecesPerBox}pcs</span>}
            {selected.category?.name && <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{selected.category.name}</span>}
            {selected.sellingPrice > 0 && <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>Rs {selected.sellingPrice}</span>}
          </div>
        </div>
        <button type="button" onClick={() => onChange('')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 4, flexShrink: 0 }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.background = '#fef2f2'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none'; }}>
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapRef}>
      <div style={{ position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input ref={inputRef}
          className="form-input" style={{ paddingLeft: 30, fontSize: 13 }}
          placeholder="Search by name, SKU or brand…"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { updatePos(); setOpen(true); }}
          autoComplete="off"
        />
      </div>
      {dropdown}
    </div>
  );
}

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

export default function CreatePOPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [vendors, setVendors] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    vendor: '', warehouse: '', type: 'standard',
    customer: { name: '', phone: '', email: '' },
    items: [{ ...BLANK_ITEM }],
    shippingCost: 0, discountAmount: 0, taxRate: 0, notes: '', expectedDate: '',
    poPaymentTerms: 'credit', advanceAmount: 0, advanceMethod: 'cash',
  });

  useEffect(() => {
    Promise.all([api.get('/vendors'), api.get('/warehouses'), api.get('/products?limit=500')])
      .then(([v, w, p]) => { setVendors(v.data); setWarehouses(w.data); setProducts(p.data); });
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/purchases/${id}`).then(r => {
      const po = r.data;
      setForm({
        vendor: po.vendor?._id || po.vendor || '',
        warehouse: po.warehouse?._id || po.warehouse || '',
        type: po.type || 'standard',
        customer: po.customer || { name: '', phone: '', email: '' },
        items: processItemsForEdit(po.items),
        shippingCost: po.shippingCost || 0, discountAmount: po.discountAmount || 0,
        taxRate: po.taxAmount && po.subtotal ? ((po.taxAmount / po.subtotal) * 100).toFixed(2) : 0,
        notes: po.notes || '', expectedDate: po.expectedDate ? po.expectedDate.slice(0, 10) : '',
        poPaymentTerms: po.poPaymentTerms || 'credit', advanceAmount: po.advanceAmount || 0, advanceMethod: 'cash',
      });
    }).finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setCust = (k, v) => setForm(p => ({ ...p, customer: { ...p.customer, [k]: v } }));
  const setItem = (i, k, v) => setForm(p => ({ ...p, items: p.items.map((it, idx) => idx === i ? { ...it, [k]: v } : it) }));
  const setItemMulti = (i, updates) => setForm(p => ({ ...p, items: p.items.map((it, idx) => idx === i ? { ...it, ...updates } : it) }));
  const addItem = () => setForm(p => ({ ...p, items: [...p.items, { ...BLANK_ITEM }] }));
  const removeItem = (i) => setForm(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));

  const rateToUnitCost = (prod, rate, unit) => {
    if (!prod || !rate) return '';
    const ppc = calcPricePerPiece(prod, Number(rate));
    const result = (prod.productType === 'box' && unit === 'boxes') ? ppc * (prod.piecesPerBox || 1) : ppc;
    return Math.round(result * 100) / 100;
  };

  const isDS = form.type === 'direct_sale';

  const subtotal = form.items.reduce((s, i) => {
    const prod = products.find(p => p._id === i.product);
    const loosePc = Number(i.costPrice || 0) / (prod?.piecesPerBox || 1);
    return s + Number(i.orderedQty || 0) * Number(i.costPrice || 0) + Number(i.looseQty || 0) * loosePc;
  }, 0);
  const saleSubtotal = form.items.reduce((s, i) => {
    const prod = products.find(p => p._id === i.product);
    const loosePc = Number(i.sellingPrice || 0) / (prod?.piecesPerBox || 1);
    return s + Number(i.orderedQty || 0) * Number(i.sellingPrice || 0) + Number(i.looseQty || 0) * loosePc;
  }, 0);
  const taxAmt = subtotal * Number(form.taxRate) / 100;
  const grandTotal = subtotal + taxAmt - Number(form.discountAmount) + Number(form.shippingCost || 0);
  const saleGrandTotal = isDS ? saleSubtotal * (1 + Number(form.taxRate) / 100) - Number(form.discountAmount) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.vendor) return toast.error('Select a vendor');
    if (!isDS && !form.warehouse) return toast.error('Select a warehouse');
    if (form.items.some(i => !i.product)) return toast.error('All items need a product');
    setSaving(true);
    try {
      const expandedItems = [];
      for (const item of form.items) {
        if (!item.product) continue;
        expandedItems.push({ product: item.product, orderedQty: Number(item.orderedQty), costPrice: Number(item.costPrice || 0), sellingPrice: Number(item.sellingPrice || 0), orderingUnit: item.orderingUnit });
        const prod = products.find(p => p._id === item.product);
        if (prod?.productType === 'box' && Number(item.looseQty) > 0) {
          const ppc = prod.piecesPerBox || 1;
          expandedItems.push({ product: item.product, orderedQty: Number(item.looseQty), costPrice: Number(item.costPrice || 0) / ppc, sellingPrice: Number(item.sellingPrice || 0) / ppc, orderingUnit: 'loose' });
        }
      }
      const payload = { ...form, items: expandedItems };
      if (isEdit) {
        await api.put(`/purchases/${id}`, payload);
        toast.success('Purchase order updated');
        navigate(`/purchases/${id}`);
      } else {
        const res = await api.post('/purchases', payload);
        toast.success('Purchase order created');
        navigate(`/purchases/${res.data._id || ''}`);
      }
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
            <h1 className="page-title" style={{ margin: 0 }}>{isEdit ? 'Edit Purchase Order' : 'New Purchase Order'}</h1>
            <p className="page-subtitle" style={{ margin: 0 }}>Fill in the details to {isEdit ? 'update' : 'create'} a purchase order</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>

          {/* ── Left column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Order Type */}
            <SectionCard icon={Package} title="Order Type">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { val: 'standard', label: 'Standard Purchase', sub: 'Stock is received into warehouse', icon: '📦' },
                  { val: 'direct_sale', label: 'Direct Sale', sub: 'Vendor ships directly to customer', icon: '🔄' },
                ].map(({ val, label, sub, icon }) => (
                  <button key={val} type="button" onClick={() => set('type', val)}
                    style={{ padding: '14px 16px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'all .15s', border: `2px solid ${form.type === val ? 'var(--accent)' : 'var(--border)'}`, background: form.type === val ? 'var(--accent)0e' : 'var(--bg-elevated)' }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: form.type === val ? 'var(--accent)' : 'var(--text)' }}>{label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>
                  </button>
                ))}
              </div>
              {isDS && (
                <div style={{ marginTop: 16, padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 10 }}>Customer (End Buyer)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Name</label>
                      <input className="form-input" value={form.customer.name} onChange={e => setCust('name', e.target.value)} placeholder="Walk-in" />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Phone</label>
                      <input className="form-input" value={form.customer.phone} onChange={e => setCust('phone', e.target.value)} placeholder="+92…" />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Email</label>
                      <input className="form-input" type="email" value={form.customer.email} onChange={e => setCust('email', e.target.value)} />
                    </div>
                  </div>
                </div>
              )}
            </SectionCard>

            {/* Vendor & Delivery */}
            <SectionCard icon={Building2} title="Vendor & Delivery">
              <div style={{ display: 'grid', gridTemplateColumns: isDS ? '1fr' : '1fr 1fr', gap: 14 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Vendor *</label>
                  <select className="form-input" value={form.vendor} onChange={e => set('vendor', e.target.value)} required>
                    <option value="">Select vendor…</option>
                    {vendors.map(v => <option key={v._id} value={v._id}>{v.name}{v.company ? ` — ${v.company}` : ''}</option>)}
                  </select>
                </div>
                {!isDS && (
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Deliver to Warehouse *</label>
                    <select className="form-input" value={form.warehouse} onChange={e => set('warehouse', e.target.value)} required>
                      <option value="">Select warehouse…</option>
                      {warehouses.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Expected Delivery</label>
                  <input className="form-input" type="date" value={form.expectedDate} onChange={e => set('expectedDate', e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Tax Rate (%)</label>
                  <input className="form-input" type="number" step="0.01" min="0" value={form.taxRate} onChange={e => set('taxRate', +e.target.value)} />
                </div>
              </div>
            </SectionCard>

            {/* Payment Terms */}
            <SectionCard icon={CreditCard} title="Payment Terms">
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {[
                  { val: 'credit', label: 'Credit', sub: 'Pay after delivery' },
                  { val: 'prepaid', label: 'Prepaid', sub: 'Full payment upfront' },
                  { val: 'partial', label: 'Partial', sub: 'Advance now, rest later' },
                ].map(({ val, label, sub }) => (
                  <button key={val} type="button" onClick={() => set('poPaymentTerms', val)}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'center', border: `2px solid ${form.poPaymentTerms === val ? 'var(--accent)' : 'var(--border)'}`, background: form.poPaymentTerms === val ? 'var(--accent)0e' : 'var(--bg-elevated)' }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: form.poPaymentTerms === val ? 'var(--accent)' : 'var(--text)' }}>{label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>
                  </button>
                ))}
              </div>
              {(form.poPaymentTerms === 'prepaid' || form.poPaymentTerms === 'partial') && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">{form.poPaymentTerms === 'prepaid' ? 'Amount Paid' : 'Advance Amount'} (Rs)</label>
                    <input className="form-input" type="number" step="0.01" min="0" value={form.advanceAmount} onChange={e => set('advanceAmount', +e.target.value)} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Payment Method</label>
                    <select className="form-input" value={form.advanceMethod} onChange={e => set('advanceMethod', e.target.value)}>
                      {['cash', 'cheque', 'bank_transfer', 'online'].map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                </div>
              )}
              {form.poPaymentTerms === 'credit' && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Full amount added to vendor balance on delivery.</div>}
            </SectionCard>

            {/* Order Items */}
            <SectionCard icon={Package} title="Order Items" accent="var(--orange)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {form.items.map((item, i) => {
                  const prod = products.find(p => p._id === item.product);
                  const isBox = prod?.productType === 'box';
                  const pricingMode = prod?.pricingMode || 'per_piece';
                  const isMeasured = pricingMode !== 'per_piece';
                  const inputMode = item.priceInputMode || 'piece';
                  const unit = item.orderingUnit || 'boxes';
                  const unitLabel = isBox && unit === 'boxes' ? 'box' : (prod?.unit || 'pcs');
                  const rateLabel = pricingMode === 'per_sqm' ? 'sqm' : 'm';
                  const computedCost = isMeasured && inputMode === 'rate' && item.vendorRate ? rateToUnitCost(prod, item.vendorRate, unit) : null;
                  const effectiveCost = computedCost !== null ? computedCost : (Number(item.costPrice) || 0);
                  const looseTotal = isBox && Number(item.looseQty) > 0 ? Number(item.looseQty) * (effectiveCost / (prod?.piecesPerBox || 1)) : 0;
                  const rowTotal = Number(item.orderedQty || 0) * effectiveCost + looseTotal;

                  return (
                    <div key={i} style={{ background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)', padding: 14 }}>
                      {/* Row header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Item {i + 1}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {rowTotal > 0 && <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>{fmt(rowTotal)}</span>}
                          {form.items.length > 1 && (
                            <button type="button" onClick={() => removeItem(i)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', borderRadius: 4 }}
                              onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.background = '#fef2f2'; }}
                              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none'; }}>
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Product search */}
                      <div className="form-group" style={{ margin: '0 0 10px' }}>
                        <label className="form-label">Product</label>
                        <ProductAutocomplete products={products} value={item.product}
                          onChange={pid => {
                            const p = products.find(x => x._id === pid);
                            setItemMulti(i, { product: pid || '', orderingUnit: p?.productType === 'box' ? 'boxes' : 'pieces', costPrice: '', sellingPrice: '', priceInputMode: 'piece', vendorRate: '', looseQty: '' });
                          }} />
                        {prod && (
                          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                            {isBox && <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--accent)18', color: 'var(--accent)', borderRadius: 4, padding: '1px 7px' }}>BOX · {prod.piecesPerBox || 1} pcs/box</span>}
                            {isMeasured && <span style={{ fontSize: 10, fontWeight: 700, background: '#0ea5e918', color: '#0ea5e9', borderRadius: 4, padding: '1px 7px' }}>{dimensionDisplay(prod)} · {pricingMode === 'per_sqm' ? '/sqm' : '/m'}</span>}
                          </div>
                        )}
                      </div>

                      {prod && (
                        <div style={{ display: 'grid', gridTemplateColumns: isBox ? '1fr 1fr 1fr' : '1fr 1fr', gap: 10 }}>
                          {/* Qty boxes */}
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">{isBox ? 'Boxes' : 'Quantity'}</label>
                            <input className="form-input" type="number" min="1" value={item.orderedQty}
                              onChange={e => setItem(i, 'orderedQty', +e.target.value)} />
                            <div style={{ fontSize: 10, color: isBox ? 'var(--accent)' : 'var(--text-muted)', marginTop: 3, fontWeight: isBox ? 700 : 400 }}>
                              {isBox ? 'boxes' : (prod?.unit || 'pcs')}
                            </div>
                          </div>

                          {/* Loose qty (box only) */}
                          {isBox && (
                            <div className="form-group" style={{ margin: 0 }}>
                              <label className="form-label">Loose Pieces</label>
                              <input className="form-input" type="number" min="0" placeholder="0"
                                style={{ borderColor: item.looseQty > 0 ? '#16a34a' : undefined }}
                                value={item.looseQty} onChange={e => setItem(i, 'looseQty', e.target.value)} />
                              <div style={{ fontSize: 10, color: '#16a34a', marginTop: 3, fontWeight: 700 }}>pcs (loose)</div>
                            </div>
                          )}

                          {/* Vendor cost price */}
                          <div className="form-group" style={{ margin: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                              <label className="form-label" style={{ margin: 0 }}>Vendor Price</label>
                              {isMeasured && (
                                <div style={{ display: 'flex', gap: 4 }}>
                                  {[['rate', `/${rateLabel}`], ['piece', `/${unitLabel}`]].map(([mode, lbl]) => (
                                    <button key={mode} type="button"
                                      onClick={() => setItemMulti(i, { priceInputMode: mode, costPrice: '', vendorRate: '' })}
                                      style={{ padding: '1px 6px', fontSize: 10, fontWeight: 700, borderRadius: 3, cursor: 'pointer', border: `1px solid ${inputMode === mode ? '#0ea5e9' : 'var(--border)'}`, background: inputMode === mode ? '#0ea5e9' : 'transparent', color: inputMode === mode ? '#fff' : 'var(--text-muted)' }}>
                                      Rs{lbl}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            {isMeasured && inputMode === 'rate' ? (
                              <>
                                <input className="form-input" type="number" step="0.01" min="0" placeholder={`Rs/${rateLabel}`}
                                  style={{ borderColor: '#0ea5e9' }}
                                  value={item.vendorRate}
                                  onChange={e => { const r = e.target.value; const c = rateToUnitCost(prod, r, unit); setItemMulti(i, { vendorRate: r, costPrice: c !== '' ? c : '' }); }} />
                                {item.vendorRate > 0 && <div style={{ fontSize: 10, color: '#0ea5e9', marginTop: 3 }}>≈ {fmt(calcPricePerPiece(prod, Number(item.vendorRate)))}/pcs{isBox ? ` → ${fmt(computedCost)}/box` : ''}</div>}
                              </>
                            ) : (
                              <>
                                <input className="form-input" type="number" step="0.01" min="0" placeholder={`Rs/${unitLabel}`}
                                  value={item.costPrice} onChange={e => setItem(i, 'costPrice', e.target.value)} />
                              </>
                            )}
                          </div>

                          {/* Selling price (DS only) */}
                          {isDS && (
                            <div className="form-group" style={{ margin: 0 }}>
                              <label className="form-label">Selling Price (Rs/{unitLabel})</label>
                              <input className="form-input" type="number" step="0.01" min="0"
                                style={{ borderColor: 'var(--accent)' }}
                                value={item.sellingPrice} onChange={e => setItem(i, 'sellingPrice', e.target.value)} />
                              {Number(item.sellingPrice) > 0 && effectiveCost > 0 && (
                                <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 3 }}>
                                  margin: {fmt(Number(item.sellingPrice) - effectiveCost)}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <button type="button" onClick={addItem}
                  style={{ padding: '10px', borderRadius: 8, border: '2px dashed var(--border)', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                  <Plus size={14} /> Add Another Item
                </button>
              </div>
            </SectionCard>

            {/* Notes & Extras */}
            <SectionCard icon={FileText} title="Notes & Charges">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Shipping Cost (Rs)</label>
                  <input className="form-input" type="number" step="0.01" min="0" value={form.shippingCost}
                    onChange={e => set('shippingCost', e.target.value)} placeholder="0.00" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Discount (Rs)</label>
                  <input className="form-input" type="number" step="0.01" min="0" value={form.discountAmount}
                    onChange={e => set('discountAmount', +e.target.value)} placeholder="0.00" />
                </div>
                <div className="form-group" style={{ margin: 0, gridColumn: '1/-1' }}>
                  <label className="form-label">Notes</label>
                  <textarea className="form-input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any special instructions…" />
                </div>
              </div>
            </SectionCard>
          </div>

          {/* ── Right sidebar ── */}
          <div style={{ position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Summary */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>Order Summary</span>
              </div>
              <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Items</span>
                  <span>{form.items.filter(i => i.product).length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
                  <span>{fmt(subtotal)}</span>
                </div>
                {Number(form.shippingCost) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Shipping</span>
                    <span>{fmt(form.shippingCost)}</span>
                  </div>
                )}
                {taxAmt > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Tax ({form.taxRate}%)</span>
                    <span>{fmt(taxAmt)}</span>
                  </div>
                )}
                {Number(form.discountAmount) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Discount</span>
                    <span style={{ color: 'var(--red)' }}>-{fmt(form.discountAmount)}</span>
                  </div>
                )}
                <div style={{ borderTop: '2px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Purchase Total</span>
                  <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>{fmt(grandTotal)}</span>
                </div>
                {isDS && saleGrandTotal > 0 && (
                  <>
                    <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>Sale Total</span>
                      <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{fmt(saleGrandTotal)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--green)' }}>
                      <span>Margin</span>
                      <span style={{ fontWeight: 600 }}>{fmt(saleGrandTotal - grandTotal)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Vendor info */}
            {form.vendor && (() => {
              const v = vendors.find(x => x._id === form.vendor);
              return v ? (
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--accent)', marginBottom: 6 }}>Vendor</div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{v.name}</div>
                  {v.company && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v.company}</div>}
                  {v.phone && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v.phone}</div>}
                </div>
              ) : null;
            })()}

            {/* Save button */}
            <button type="submit" className="btn btn-primary" disabled={saving}
              style={{ padding: '14px', fontSize: 15, fontWeight: 700, borderRadius: 10 }}>
              {saving ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Saving…</> : (isEdit ? '✓ Save Changes' : '✓ Create Purchase Order')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
          </div>

        </div>
      </form>
    </div>
  );
}
