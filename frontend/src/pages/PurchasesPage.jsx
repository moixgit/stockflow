import React, { useState, useEffect, useCallback } from 'react';
import api, { BACKEND_URL } from '../utils/api.js';
import toast from 'react-hot-toast';
import { Plus, Eye, RefreshCw, Printer, Check, X, ChevronDown, ArrowRight, Truck, Package } from 'lucide-react';
import { format } from 'date-fns';
import { calcPricePerPiece, pricingRateLabel, dimensionDisplay } from '../utils/pricing.js';

const fmt = (n) => `Rs ${(n || 0).toFixed(2)}`;

const STATUS_META = {
  draft:        { label: 'Draft',        cls: 'badge-gray'   },
  ordered:      { label: 'Ordered',      cls: 'badge-blue'   },
  partial:      { label: 'Partial',      cls: 'badge-yellow' },
  received:     { label: 'Received',     cls: 'badge-green'  },
  cancelled:    { label: 'Cancelled',    cls: 'badge-red'    },
  direct_sale:  { label: 'Direct Sale',  cls: 'badge-purple' },
};

const PAY_META = {
  unpaid:  { cls: 'badge-red'    },
  partial: { cls: 'badge-yellow' },
  paid:    { cls: 'badge-green'  },
};

// ─── Print ──────────────────────────────────────────────
function printPO(po, store = {}) {
  const date = new Date(po.createdAt).toLocaleString('en-PK', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const isDS = po.type === 'direct_sale';

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${isDS ? 'Direct Sale Order' : 'Purchase Order'} ${po.poNumber}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Arial,sans-serif; font-size:13px; color:#1a1a2e; background:#fff; }
  .page { max-width:760px; margin:0 auto; padding:40px 48px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px; }
  .brand-name { font-size:26px; font-weight:900; color:#6c63ff; letter-spacing:-1px; }
  .brand-sub { font-size:11px; color:#888; margin-top:2px; }
  .po-meta { text-align:right; }
  .po-title { font-size:20px; font-weight:700; color:#1a1a2e; }
  .po-num { font-size:13px; color:#6c63ff; font-weight:600; margin-top:4px; }
  .po-date { font-size:11px; color:#888; margin-top:2px; }
  .hline { border:none; border-top:2px solid #6c63ff; margin:0 0 24px; }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:28px; }
  .info-box { background:#f8f8ff; border:1px solid #e5e0ff; border-radius:8px; padding:12px 14px; }
  .info-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.8px; color:#6c63ff; margin-bottom:4px; }
  .info-val { font-size:13px; color:#1a1a2e; font-weight:500; line-height:1.5; }
  .info-sub { font-size:11px; color:#888; }
  .type-badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700; text-transform:uppercase;
    background:${isDS ? '#ede9fe' : '#dbeafe'}; color:${isDS ? '#5b21b6' : '#1e40af'}; margin-bottom:8px; }
  table { width:100%; border-collapse:collapse; margin-bottom:20px; }
  thead tr { background:#6c63ff; color:#fff; }
  thead th { padding:9px 12px; text-align:left; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; }
  thead th:nth-child(n+2) { text-align:center; }
  thead th:last-child { text-align:right; }
  tbody tr { border-bottom:1px solid #f0f0f0; }
  tbody tr:nth-child(even) { background:#fafafa; }
  tbody td { padding:9px 12px; font-size:13px; vertical-align:middle; }
  tbody td:nth-child(n+2) { text-align:center; color:#555; }
  tbody td:last-child { text-align:right; font-weight:600; }
  .totals { display:flex; justify-content:flex-end; margin-bottom:28px; }
  .totals-box { width:240px; }
  .t-row { display:flex; justify-content:space-between; padding:4px 0; font-size:13px; }
  .t-row.grand { border-top:2px solid #6c63ff; margin-top:6px; padding-top:9px; font-size:15px; font-weight:800; color:#6c63ff; }
  .t-label { color:#666; }
  .footer { border-top:1px solid #e5e7eb; padding-top:16px; display:flex; justify-content:space-between; align-items:flex-end; }
  .footer-note { font-size:11px; color:#aaa; max-width:340px; line-height:1.5; }
  .footer-brand { font-size:18px; font-weight:900; color:#e5e0ff; }
  @media print { @page { margin:15mm; size:A4 portrait; } .page { padding:0; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div style="display:flex;align-items:center;gap:14px">
      ${store.logo ? `<img src="${store.logo}" style="max-height:60px;max-width:110px;object-fit:contain"/>` : ''}
      <div>
        <div class="brand-name">${store.name || 'StockFlow'}</div>
        ${store.tagline ? `<div class="brand-sub">${store.tagline}</div>` : ''}
        ${store.address?.city ? `<div class="brand-sub">${[store.address.street, store.address.city, store.address.country].filter(Boolean).join(', ')}</div>` : ''}
        ${store.phone ? `<div class="brand-sub">Tel: ${store.phone}</div>` : ''}
        ${store.taxNumber ? `<div class="brand-sub">NTN: ${store.taxNumber}</div>` : ''}
      </div>
    </div>
    <div class="po-meta">
      <div class="type-badge">${isDS ? 'Direct Sale Order' : 'Purchase Order'}</div>
      <div class="po-title">${po.poNumber}</div>
      <div class="po-date">${date}</div>
      <div style="margin-top:6px;font-size:11px;color:#888">Status: <strong>${STATUS_META[po.status]?.label || po.status}</strong></div>
      ${po.expectedDate ? `<div style="font-size:11px;color:#888">Expected: ${new Date(po.expectedDate).toLocaleDateString('en-PK')}</div>` : ''}
    </div>
  </div>
  <hr class="hline"/>

  <div class="info-grid">
    <div class="info-box">
      <div class="info-label">Vendor</div>
      <div class="info-val">${po.vendor?.name || '—'}</div>
      ${po.vendor?.company ? `<div class="info-sub">${po.vendor.company}</div>` : ''}
      ${po.vendor?.phone ? `<div class="info-sub">Tel: ${po.vendor.phone}</div>` : ''}
      ${po.vendor?.email ? `<div class="info-sub">${po.vendor.email}</div>` : ''}
    </div>
    ${isDS ? `
    <div class="info-box">
      <div class="info-label">End Customer</div>
      <div class="info-val">${po.customer?.name || 'Walk-in Customer'}</div>
      ${po.customer?.phone ? `<div class="info-sub">Tel: ${po.customer.phone}</div>` : ''}
      ${po.customer?.email ? `<div class="info-sub">${po.customer.email}</div>` : ''}
    </div>` : `
    <div class="info-box">
      <div class="info-label">Deliver To (Warehouse)</div>
      <div class="info-val">${po.warehouse?.name || '—'}</div>
      <div class="info-sub">Code: ${po.warehouse?.code || '—'}</div>
    </div>`}
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th style="text-align:left">Product</th>
        <th>SKU</th>
        <th>Qty</th>
        <th>Cost Price</th>
        ${isDS ? '<th>Selling Price</th>' : ''}
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${po.items.map((item, i) => `
      <tr>
        <td style="color:#aaa;font-size:11px">${i + 1}</td>
        <td style="text-align:left;font-weight:600">${item.product?.name || ''}</td>
        <td>${item.product?.sku || '—'}</td>
        <td>${item.orderedQty}</td>
        <td>${fmt(item.costPrice)}</td>
        ${isDS ? `<td>${fmt(item.sellingPrice)}</td>` : ''}
        <td>${fmt(item.total || item.costPrice * item.orderedQty)}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      ${isDS ? `
      <div class="t-row" style="color:#6c63ff;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">
        <span>Purchase (Cost)</span>
      </div>` : ''}
      <div class="t-row"><span class="t-label">Subtotal</span><span>${fmt(po.subtotal)}</span></div>
      ${po.shippingCost ? `<div class="t-row"><span class="t-label">Shipping</span><span>${fmt(po.shippingCost)}</span></div>` : ''}
      ${po.taxAmount ? `<div class="t-row"><span class="t-label">Tax</span><span>${fmt(po.taxAmount)}</span></div>` : ''}
      ${po.discountAmount ? `<div class="t-row"><span class="t-label">Discount</span><span>-${fmt(po.discountAmount)}</span></div>` : ''}
      <div class="t-row grand"><span>Total</span><span>${fmt(po.grandTotal)}</span></div>
      ${isDS && po.saleGrandTotal ? `
      <div style="margin-top:12px;border-top:1px dashed #ddd;padding-top:10px">
        <div class="t-row" style="color:#6c63ff;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">
          <span>Sale (Revenue)</span>
        </div>
        <div class="t-row grand" style="color:#16a34a"><span>Sale Total</span><span>${fmt(po.saleGrandTotal)}</span></div>
        <div class="t-row" style="font-size:12px;color:#888"><span>Margin</span><span>${fmt(po.saleGrandTotal - po.grandTotal)}</span></div>
      </div>` : ''}
    </div>
  </div>

  ${po.notes ? `<div style="margin-bottom:20px;padding:12px 14px;background:#f8f8ff;border-radius:8px;border:1px solid #e5e0ff;font-size:12px;color:#555"><strong>Notes:</strong> ${po.notes}</div>` : ''}

  <div class="footer">
    <div class="footer-note">
      This is a computer-generated ${isDS ? 'direct sale order' : 'purchase order'} and does not require a manual signature.<br/>
      For queries reference: <strong>${po.poNumber}</strong>${store.email ? ` · ${store.email}` : ''}
    </div>
    <div class="footer-brand">${store.name || 'StockFlow'}</div>
  </div>
</div>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=860,height=900');
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

// ─── Create / Edit Modal ─────────────────────────────────
function POModal({ onClose, onSave, vendors, warehouses, editPO = null }) {
  const [form, setForm] = useState(editPO ? {
    vendor: editPO.vendor?._id || editPO.vendor || '',
    warehouse: editPO.warehouse?._id || editPO.warehouse || '',
    type: editPO.type || 'standard',
    customer: editPO.customer || { name: '', phone: '', email: '' },
    items: editPO.items.map(i => ({
      product: i.product?._id || i.product || '',
      orderedQty: i.orderedQty,
      costPrice: i.costPrice,
      sellingPrice: i.sellingPrice || 0,
      orderingUnit: i.orderingUnit || 'boxes',
      priceInputMode: 'piece',  // always 'piece' when loading existing PO
      vendorRate: '',
    })),
    shippingCost: editPO.shippingCost || 0,
    discountAmount: editPO.discountAmount || 0,
    taxRate: editPO.taxAmount && editPO.subtotal ? ((editPO.taxAmount / editPO.subtotal) * 100).toFixed(2) : 0,
    notes: editPO.notes || '',
    expectedDate: editPO.expectedDate ? editPO.expectedDate.slice(0, 10) : '',
    poPaymentTerms: editPO.poPaymentTerms || 'credit',
    advanceAmount: editPO.advanceAmount || 0,
    advanceMethod: 'cash',
  } : {
    vendor: '', warehouse: '', type: 'standard',
    customer: { name: '', phone: '', email: '' },
    items: [{ product: '', orderedQty: 1, costPrice: '', sellingPrice: '', orderingUnit: 'boxes', priceInputMode: 'piece', vendorRate: '' }],
    shippingCost: 0, discountAmount: 0, taxRate: 0, notes: '', expectedDate: '',
    poPaymentTerms: 'credit', advanceAmount: 0, advanceMethod: 'cash',
  });

  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);
  const isDS = form.type === 'direct_sale';

  useEffect(() => { api.get('/products?limit=500').then(r => setProducts(r.data)); }, []);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setCust = (k, v) => setForm(p => ({ ...p, customer: { ...p.customer, [k]: v } }));
  const setItem = (i, k, v) => setForm(p => ({ ...p, items: p.items.map((it, idx) => idx === i ? { ...it, [k]: v } : it) }));
  const setItemMulti = (i, updates) => setForm(p => ({ ...p, items: p.items.map((it, idx) => idx === i ? { ...it, ...updates } : it) }));
  const addItem = () => setForm(p => ({ ...p, items: [...p.items, { product: '', orderedQty: 1, costPrice: '', sellingPrice: '', orderingUnit: 'boxes', priceInputMode: 'piece', vendorRate: '' }] }));
  const removeItem = (i) => setForm(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));

  // Compute costPrice from a rate input for measurement-based products
  const rateToUnitCost = (prod, rate, orderingUnit) => {
    if (!prod || !rate) return '';
    const ppc = calcPricePerPiece(prod, Number(rate));
    const isBox = prod.productType === 'box';
    const result = (isBox && orderingUnit === 'boxes') ? ppc * (prod.piecesPerBox || 1) : ppc;
    return Math.round(result * 100) / 100;
  };

  const subtotal = form.items.reduce((s, i) => s + (Number(i.orderedQty) * Number(i.costPrice)), 0);
  const saleSubtotal = form.items.reduce((s, i) => s + (Number(i.orderedQty) * Number(i.sellingPrice)), 0);
  const grandTotal = subtotal * (1 + Number(form.taxRate) / 100) - Number(form.discountAmount) + Number(form.shippingCost || 0);
  const saleGrandTotal = isDS ? saleSubtotal * (1 + Number(form.taxRate) / 100) - Number(form.discountAmount) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.vendor) return toast.error('Vendor is required');
    if (!isDS && !form.warehouse) return toast.error('Warehouse is required for standard purchase orders');
    if (form.items.some(i => !i.product)) return toast.error('All items must have a product');
    setSaving(true);
    try {
      if (editPO) {
        await api.put(`/purchases/${editPO._id}`, form);
        toast.success('Purchase order updated');
      } else {
        await api.post('/purchases', form);
        toast.success('Purchase order created');
      }
      onSave();
    } catch (err) { toast.error(err?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg" style={{ maxWidth: 780 }}>
        <div className="modal-header">
          <h2 className="modal-title">{editPO ? 'Edit Purchase Order' : 'New Purchase Order'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          {/* Type toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {[['standard', 'Standard PO', '📦'], ['direct_sale', 'Direct Sale (Vendor → Customer)', '🔄']].map(([val, label, icon]) => (
              <button key={val} type="button"
                onClick={() => set('type', val)}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  border: form.type === val ? '2px solid var(--accent)' : '2px solid var(--border)',
                  background: form.type === val ? 'var(--accent)0d' : 'var(--bg-elevated)',
                  color: form.type === val ? 'var(--accent)' : 'var(--text-muted)',
                  transition: 'all .15s',
                }}>
                {icon} {label}
              </button>
            ))}
          </div>

          {isDS && (
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Customer (End Buyer)</div>
              <div className="form-grid form-grid-3">
                <div className="form-group">
                  <label className="form-label">Customer Name</label>
                  <input className="form-input" value={form.customer.name} onChange={e => setCust('name', e.target.value)} placeholder="Walk-in" />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" value={form.customer.phone} onChange={e => setCust('phone', e.target.value)} placeholder="+92…" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" value={form.customer.email} onChange={e => setCust('email', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          <div className="form-grid form-grid-2 mb-16">
            <div className="form-group">
              <label className="form-label">Vendor *</label>
              <select className="form-input" value={form.vendor} onChange={e => set('vendor', e.target.value)} required>
                <option value="">Select Vendor</option>
                {vendors.map(v => <option key={v._id} value={v._id}>{v.name} — {v.company}</option>)}
              </select>
            </div>
            {!isDS && (
              <div className="form-group">
                <label className="form-label">Warehouse *</label>
                <select className="form-input" value={form.warehouse} onChange={e => set('warehouse', e.target.value)} required={!isDS}>
                  <option value="">Select Warehouse</option>
                  {warehouses.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Expected Date</label>
              <input className="form-input" type="date" value={form.expectedDate} onChange={e => set('expectedDate', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Tax Rate (%)</label>
              <input className="form-input" type="number" step="0.01" value={form.taxRate} onChange={e => set('taxRate', +e.target.value)} />
            </div>
          </div>

          {/* Payment Terms */}
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Payment Terms</div>
            <div className="form-grid form-grid-3">
              <div className="form-group">
                <label className="form-label">Payment Type</label>
                <select className="form-input" value={form.poPaymentTerms} onChange={e => set('poPaymentTerms', e.target.value)}>
                  <option value="credit">Credit (Pay after delivery)</option>
                  <option value="prepaid">Prepaid (Full payment upfront)</option>
                  <option value="partial">Partial (Advance + remainder later)</option>
                </select>
              </div>
              {(form.poPaymentTerms === 'prepaid' || form.poPaymentTerms === 'partial') && (
                <div className="form-group">
                  <label className="form-label">{form.poPaymentTerms === 'prepaid' ? 'Amount Paid (Rs)' : 'Advance Amount (Rs)'}</label>
                  <input className="form-input" type="number" step="0.01" min="0"
                    value={form.advanceAmount}
                    onChange={e => set('advanceAmount', +e.target.value)}
                    placeholder={form.poPaymentTerms === 'prepaid' ? 'Full amount' : 'Advance paid now'} />
                </div>
              )}
              {(form.poPaymentTerms === 'prepaid' || form.poPaymentTerms === 'partial') && (
                <div className="form-group">
                  <label className="form-label">Payment Method</label>
                  <select className="form-input" value={form.advanceMethod} onChange={e => set('advanceMethod', e.target.value)}>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="online">Online</option>
                  </select>
                </div>
              )}
            </div>
            {form.poPaymentTerms === 'credit' && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Full amount will be added to vendor's outstanding balance on delivery.
              </div>
            )}
            {form.poPaymentTerms === 'prepaid' && (
              <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 4 }}>
                Full payment upfront — balance will not increase on delivery.
              </div>
            )}
            {form.poPaymentTerms === 'partial' && (
              <div style={{ fontSize: 11, color: 'var(--orange)', marginTop: 4 }}>
                Advance recorded now. Remaining balance added to vendor on delivery.
              </div>
            )}
          </div>

          {/* Items */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div>
                <label className="form-label" style={{ marginBottom: 0 }}>Order Items</label>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Vendor price is set per purchase — change it freely regardless of the product's default cost.
                </div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}><Plus size={13} /> Add Item</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Product</th>
                  <th style={{ padding: '8px 6px', textAlign: 'center', width: 100, fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Qty / Unit</th>
                  <th style={{ padding: '8px 6px', textAlign: 'right', width: 140, fontSize: 11, fontWeight: 600, color: 'var(--orange)' }}>
                    Vendor Price ✎
                  </th>
                  {isDS && <th style={{ padding: '8px 6px', textAlign: 'right', width: 130, fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
                    Selling Price ✎
                  </th>}
                  <th style={{ padding: '8px 10px', textAlign: 'right', width: 90, fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Total</th>
                  <th style={{ width: 30 }}></th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((item, i) => {
                  const prod = products.find(p => p._id === item.product);
                  const isBox = prod?.productType === 'box';
                  const unit = item.orderingUnit || 'boxes';
                  const pricingMode = prod?.pricingMode || 'per_piece';
                  const isMeasured = pricingMode !== 'per_piece';
                  const inputMode = item.priceInputMode || 'piece';

                  // For rate mode: compute the effective cost from vendorRate
                  const computedCost = isMeasured && inputMode === 'rate' && item.vendorRate
                    ? rateToUnitCost(prod, item.vendorRate, unit)
                    : null;
                  // The actual costPrice used in totals
                  const effectiveCost = computedCost !== null ? computedCost : (Number(item.costPrice) || 0);
                  const effectiveSell = Number(item.sellingPrice) || 0;

                  const unitLabel = isBox && unit === 'boxes' ? 'box' : (prod?.unit || 'pcs');
                  const rateLabel = pricingMode === 'per_sqm' ? 'sqm' : 'm';

                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                      {/* ── Product ── */}
                      <td style={{ padding: '6px 6px' }}>
                        <select className="form-input" style={{ padding: '6px 8px', fontSize: 12 }} value={item.product}
                          onChange={e => {
                            const p = products.find(x => x._id === e.target.value);
                            setItemMulti(i, {
                              product: e.target.value,
                              orderingUnit: (p?.productType === 'box') ? 'boxes' : 'pieces',
                              costPrice: '',
                              sellingPrice: '',
                              priceInputMode: 'piece',
                              vendorRate: '',
                            });
                          }}>
                          <option value="">Select product</option>
                          {products.map(p => <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>)}
                        </select>
                        {prod && (
                          <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                            {isBox && (
                              <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--accent)18', color: 'var(--accent)', borderRadius: 4, padding: '1px 6px' }}>
                                BOX · {prod.piecesPerBox || 1} pcs
                              </span>
                            )}
                            {isMeasured && (
                              <span style={{ fontSize: 10, fontWeight: 700, background: '#0ea5e918', color: '#0ea5e9', borderRadius: 4, padding: '1px 6px' }}>
                                {dimensionDisplay(prod)} · {pricingMode === 'per_sqm' ? '/sqm' : '/m'}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* ── Qty + Unit toggle ── */}
                      <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                        <input className="form-input" type="number" min="1"
                          style={{ padding: '6px', fontSize: 12, textAlign: 'center', width: '100%' }}
                          value={item.orderedQty} onChange={e => setItem(i, 'orderedQty', +e.target.value)} />
                        {isBox ? (
                          <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                            {['boxes', 'loose'].map(u => (
                              <button key={u} type="button"
                                onClick={() => setItemMulti(i, { orderingUnit: u, costPrice: '', vendorRate: '' })}
                                style={{
                                  flex: 1, padding: '2px 0', fontSize: 10, fontWeight: 700, borderRadius: 4, cursor: 'pointer',
                                  border: `1px solid ${unit === u ? 'var(--accent)' : 'var(--border)'}`,
                                  background: unit === u ? 'var(--accent)' : 'transparent',
                                  color: unit === u ? '#fff' : 'var(--text-muted)',
                                }}>
                                {u === 'boxes' ? 'Box' : 'Pcs'}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                            {prod?.unit || 'pcs'}
                          </div>
                        )}
                      </td>

                      {/* ── Vendor Price ── */}
                      <td style={{ padding: '6px 4px' }}>
                        {/* For measured products: Rate / Piece toggle */}
                        {isMeasured && prod && (
                          <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
                            {[['rate', `Rs/${rateLabel}`], ['piece', `Rs/${unitLabel}`]].map(([mode, label]) => (
                              <button key={mode} type="button"
                                onClick={() => setItemMulti(i, { priceInputMode: mode, costPrice: '', vendorRate: '' })}
                                style={{
                                  flex: 1, padding: '2px 4px', fontSize: 10, fontWeight: 700, borderRadius: 4, cursor: 'pointer',
                                  border: `1px solid ${inputMode === mode ? '#0ea5e9' : 'var(--border)'}`,
                                  background: inputMode === mode ? '#0ea5e9' : 'transparent',
                                  color: inputMode === mode ? '#fff' : 'var(--text-muted)',
                                }}>
                                {label}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Rate input (measurement products in rate mode) */}
                        {isMeasured && inputMode === 'rate' ? (
                          <>
                            <input className="form-input" type="number" step="0.01" min="0" placeholder={`Rs/${rateLabel}`}
                              style={{ padding: '6px', fontSize: 12, textAlign: 'right', borderColor: '#0ea5e9' }}
                              value={item.vendorRate}
                              onChange={e => {
                                const rate = e.target.value;
                                const computed = rateToUnitCost(prod, rate, unit);
                                setItemMulti(i, { vendorRate: rate, costPrice: computed !== '' ? computed : '' });
                              }} />
                            {item.vendorRate > 0 && (
                              <div style={{ fontSize: 10, color: '#0ea5e9', textAlign: 'right', marginTop: 2 }}>
                                {fmt(calcPricePerPiece(prod, Number(item.vendorRate)))}/pcs
                                {isBox && unit === 'boxes' && (
                                  <span style={{ color: 'var(--accent)' }}>
                                    {' '}→ {fmt(computedCost)}/box
                                  </span>
                                )}
                              </div>
                            )}
                          </>
                        ) : (
                          /* Direct piece/unit price input */
                          <input className="form-input" type="number" step="0.01" min="0" placeholder={`Rs/${unitLabel}`}
                            style={{ padding: '6px', fontSize: 12, textAlign: 'right' }}
                            value={item.costPrice}
                            onChange={e => setItem(i, 'costPrice', e.target.value)} />
                        )}
                        {!isMeasured && prod && (
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right', marginTop: 2 }}>
                            Rs/{unitLabel}
                          </div>
                        )}
                      </td>

                      {/* ── Selling Price (DS only) ── */}
                      {isDS && (
                        <td style={{ padding: '6px 4px' }}>
                          <input className="form-input" type="number" step="0.01" min="0" placeholder={`Rs/${unitLabel}`}
                            style={{ padding: '6px', fontSize: 12, textAlign: 'right', borderColor: 'var(--accent)' }}
                            value={item.sellingPrice} onChange={e => setItem(i, 'sellingPrice', e.target.value)} />
                          {effectiveSell > 0 && effectiveCost > 0 && (
                            <div style={{ fontSize: 10, color: 'var(--green)', textAlign: 'right', marginTop: 2 }}>
                              margin: {fmt(effectiveSell - effectiveCost)}
                            </div>
                          )}
                        </td>
                      )}

                      <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {fmt(item.orderedQty * effectiveCost)}
                      </td>
                      <td style={{ padding: '6px 4px' }}>
                        {form.items.length > 1 && (
                          <button type="button" onClick={() => removeItem(i)}
                            style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: 4 }}>✕</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="form-grid form-grid-2 mb-16">
            <div className="form-group">
              <label className="form-label">Shipping Cost (Rs)</label>
              <input className="form-input" type="number" step="0.01" value={form.shippingCost} onChange={e => set('shippingCost', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Discount (Rs)</label>
              <input className="form-input" type="number" step="0.01" value={form.discountAmount} onChange={e => set('discountAmount', +e.target.value)} />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>

          <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Purchase Total</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>{fmt(grandTotal)}</div>
            </div>
            {isDS && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sale Total (Revenue)</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{fmt(saleGrandTotal)}</div>
                <div style={{ fontSize: 11, color: 'var(--green)' }}>Margin: {fmt(saleGrandTotal - grandTotal)}</div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : (editPO ? 'Save Changes' : 'Create Purchase Order')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Detail Modal ────────────────────────────────────────
function PODetailModal({ po: initialPO, onClose, onRefresh, store }) {
  const [po, setPO] = useState(initialPO);
  const [tab, setTab] = useState('details');
  const [changingStatus, setChangingStatus] = useState(false);
  const [receiveQtys, setReceiveQtys] = useState({});
  const [brokenQtys, setBrokenQtys] = useState({});
  const [receiveUnits, setReceiveUnits] = useState(() => {
    const units = {};
    initialPO.items.forEach(item => {
      // default to the unit the PO was ordered in, fall back to product type
      units[item._id] = item.orderingUnit === 'loose' ? 'pieces'
        : item.product?.productType === 'box' ? 'boxes'
        : 'pieces';
    });
    return units;
  });
  const [receiving, setReceiving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [dsForm, setDsForm] = useState({ paymentMethod: 'cash', amountPaid: '', customer: po.customer || { name: '', phone: '', email: '' } });
  const [paymentAmount, setPaymentAmount] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);

  const isDS = po.type === 'direct_sale';
  const locked = ['received', 'cancelled', 'direct_sale'].includes(po.status);

  const changeStatus = async (status) => {
    setChangingStatus(true);
    try {
      const res = await api.patch(`/purchases/${po._id}/status`, { status });
      setPO(res.data);
      toast.success(`Status changed to ${status}`);
      onRefresh();
    } catch (err) { toast.error(err?.message || 'Failed'); }
    finally { setChangingStatus(false); }
  };

  const handleReceive = async () => {
    const receivedItems = po.items
      .filter(item => receiveQtys[item._id] > 0)
      .map(item => ({
        itemId: item._id,
        receivedQty: Number(receiveQtys[item._id]),
        brokenQty: Number(brokenQtys[item._id] || 0),
        receivingUnit: receiveUnits[item._id] || 'boxes',
      }));
    if (!receivedItems.length) return toast.error('Enter quantities to receive');
    const overBroken = receivedItems.find(r => r.brokenQty > r.receivedQty);
    if (overBroken) return toast.error('Broken quantity cannot exceed received quantity');
    setReceiving(true);
    try {
      const res = await api.post(`/purchases/${po._id}/receive`, { receivedItems });
      setPO(res.data);
      setReceiveQtys({});
      setBrokenQtys({});
      const totalBroken = receivedItems.reduce((s, r) => s + r.brokenQty, 0);
      toast.success(totalBroken > 0 ? `Items received — ${totalBroken} broken items auto-logged` : 'Items received and inventory updated');
      onRefresh();
    } catch (err) { toast.error(err?.message || 'Failed'); }
    finally { setReceiving(false); }
  };

  const handleCompleteDirectSale = async () => {
    setCompleting(true);
    try {
      const res = await api.post(`/purchases/${po._id}/complete-direct-sale`, {
        paymentMethod: dsForm.paymentMethod,
        amountPaid: dsForm.amountPaid || undefined,
        customer: dsForm.customer,
      });
      setPO(res.data);
      toast.success('Direct sale completed — sale record created');
      onRefresh();
    } catch (err) { toast.error(err?.message || 'Failed'); }
    finally { setCompleting(false); }
  };

  const handleRecordPayment = async () => {
    if (!paymentAmount || Number(paymentAmount) <= 0) return toast.error('Enter a valid amount');
    setRecordingPayment(true);
    try {
      const res = await api.patch(`/purchases/${po._id}/payment`, { amount: Number(paymentAmount) });
      setPO(res.data);
      setPaymentAmount('');
      toast.success('Payment recorded');
      onRefresh();
    } catch (err) { toast.error(err?.message || 'Failed'); }
    finally { setRecordingPayment(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg" style={{ maxWidth: 820, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header" style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div>
              <h2 className="modal-title" style={{ margin: 0 }}>{po.poNumber}</h2>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <span className={`badge ${STATUS_META[po.status]?.cls}`}>{STATUS_META[po.status]?.label || po.status}</span>
                {isDS && <span className="badge badge-purple">Direct Sale</span>}
                <span className={`badge ${PAY_META[po.paymentStatus]?.cls}`}>{po.paymentStatus}</span>
                {po.poPaymentTerms && po.poPaymentTerms !== 'credit' && (
                  <span className={`badge ${po.poPaymentTerms === 'prepaid' ? 'badge-green' : 'badge-orange'}`}>
                    {po.poPaymentTerms === 'prepaid' ? 'Prepaid' : 'Partial Advance'}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-secondary" onClick={() => printPO(po, store)}>
              <Printer size={14} /> Print PO
            </button>
            <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', padding: '0 20px' }}>
          {['details', isDS ? 'complete' : 'receive', 'payment', 'status'].map(t => {
            const label = t === 'complete' ? 'Complete Sale' : t === 'receive' ? 'Receive Items' : t === 'payment' ? (isDS ? 'Customer Payment' : 'Payment') : t.charAt(0).toUpperCase() + t.slice(1);
            return (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
                  borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: -1 }}>
                {label}
              </button>
            );
          })}
        </div>

        <div style={{ padding: '20px 24px' }}>
          {/* ── Details Tab ── */}
          {tab === 'details' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: isDS ? '1fr 1fr' : '1fr 1fr', gap: 14, marginBottom: 20 }}>
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--accent)', marginBottom: 4 }}>Vendor</div>
                  <div style={{ fontWeight: 600 }}>{po.vendor?.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{po.vendor?.company}</div>
                  {po.vendor?.phone && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{po.vendor.phone}</div>}
                </div>
                {isDS ? (
                  <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--accent)', marginBottom: 4 }}>Customer</div>
                    <div style={{ fontWeight: 600 }}>{po.customer?.name || 'Walk-in'}</div>
                    {po.customer?.phone && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{po.customer.phone}</div>}
                    {po.customer?.email && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{po.customer.email}</div>}
                    {po.expectedDate && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Expected: {format(new Date(po.expectedDate), 'MMM d, yyyy')}</div>}
                  </div>
                ) : (
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--accent)', marginBottom: 4 }}>Warehouse</div>
                  <div style={{ fontWeight: 600 }}>{po.warehouse?.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Code: {po.warehouse?.code}</div>
                  {po.expectedDate && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Expected: {format(new Date(po.expectedDate), 'MMM d, yyyy')}</div>}
                </div>
                )}
              </div>

              <div className="table-wrap" style={{ marginBottom: 20 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Product</th><th>SKU</th><th style={{ textAlign: 'center' }}>Ordered</th>
                      {!isDS && <th style={{ textAlign: 'center' }}>Received</th>}
                      <th style={{ textAlign: 'right' }}>Cost</th>
                      {isDS && <th style={{ textAlign: 'right' }}>Sell</th>}
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {po.items.map((item, i) => {
                      const isBox = item.product?.productType === 'box';
                      const pricingMode = item.product?.pricingMode || 'per_piece';
                      const isMeasured = pricingMode !== 'per_piece';
                      const orderUnit = item.orderingUnit || (isBox ? 'boxes' : 'pieces');
                      return (
                      <tr key={i}>
                        <td style={{ fontWeight: 500 }}>
                          <div>{item.product?.name || '—'}</div>
                          <div style={{ display: 'flex', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                            {isBox && (
                              <span style={{ fontSize: 10, background: 'var(--accent)20', color: 'var(--accent)', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                                BOX · {item.product.piecesPerBox || 1} pcs
                              </span>
                            )}
                            {isMeasured && (
                              <span style={{ fontSize: 10, background: '#0ea5e918', color: '#0ea5e9', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                                {dimensionDisplay(item.product)} · {pricingMode === 'per_sqm' ? '/sqm' : '/m'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td><span className="text-mono" style={{ fontSize: 11 }}>{item.product?.sku || '—'}</span></td>
                        <td style={{ textAlign: 'center' }}>
                          <div>{item.orderedQty}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            {isBox ? (orderUnit === 'loose' ? 'pcs' : 'boxes') : (item.product?.unit || 'pcs')}
                          </div>
                        </td>
                        {!isDS && <td style={{ textAlign: 'center' }}>
                          <span style={{ color: item.receivedQty >= item.orderedQty ? 'var(--green)' : item.receivedQty > 0 ? 'var(--yellow)' : 'var(--text-muted)' }}>
                            {item.receivedQty || 0}
                          </span>
                        </td>}
                        <td style={{ textAlign: 'right' }}>
                          <div>{fmt(item.costPrice)}</div>
                          {isMeasured && item.product?.costPrice > 0 && (
                            <div style={{ fontSize: 10, color: '#0ea5e9' }}>
                              {fmt(item.product.costPrice)}{pricingRateLabel(item.product)}
                            </div>
                          )}
                        </td>
                        {isDS && <td style={{ textAlign: 'right', color: 'var(--accent)' }}>{fmt(item.sellingPrice)}</td>}
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(item.total)}</td>
                      </tr>
                    ); })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 40 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Subtotal</span><span>{fmt(po.subtotal)}</span>
                  </div>
                  {po.shippingCost > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Shipping</span><span>{fmt(po.shippingCost)}</span>
                  </div>}
                  {po.taxAmount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Tax</span><span>{fmt(po.taxAmount)}</span>
                  </div>}
                  {po.discountAmount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Discount</span><span style={{ color: 'var(--red)' }}>-{fmt(po.discountAmount)}</span>
                  </div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, marginTop: 4, paddingTop: 8, borderTop: '2px solid var(--border)' }}>
                    <span>Total</span><span style={{ color: 'var(--green)' }}>{fmt(po.grandTotal)}</span>
                  </div>
                  {po.advanceAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4, color: 'var(--green)' }}>
                      <span>Advance Paid</span><span>-{fmt(po.advanceAmount)}</span>
                    </div>
                  )}
                  {po.paidAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4, color: 'var(--green)' }}>
                      <span>Total Paid</span><span>{fmt(po.paidAmount)}</span>
                    </div>
                  )}
                  {po.grandTotal > po.paidAmount && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4, color: 'var(--red)', fontWeight: 600 }}>
                      <span>Remaining</span><span>{fmt(po.grandTotal - po.paidAmount)}</span>
                    </div>
                  )}
                  {isDS && po.saleGrandTotal > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, marginTop: 4, color: 'var(--accent)' }}>
                      <span>Sale Total</span><span>{fmt(po.saleGrandTotal)}</span>
                    </div>
                  )}
                </div>
              </div>

              {po.notes && (
                <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                  <strong>Notes:</strong> {po.notes}
                </div>
              )}
            </>
          )}

          {/* ── Receive Tab (Standard) ── */}
          {tab === 'receive' && !isDS && (
            <>
              {locked ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                  <Package size={36} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                  <p>This PO is {po.status} — no further receiving needed.</p>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-muted)' }}>Enter quantities received for each item. This will update inventory.</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-elevated)' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Product</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Ordered</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Already Received</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>Unit</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>Receive Now</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, color: 'var(--red)', fontWeight: 600 }}>Broken on Arrival</th>
                      </tr>
                    </thead>
                    <tbody>
                      {po.items.map(item => {
                        const remaining = item.orderedQty - (item.receivedQty || 0);
                        const isBox = item.product?.productType === 'box';
                        const unit = receiveUnits[item._id] || (isBox ? 'boxes' : 'pieces');
                        return (
                          <tr key={item._id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '8px 10px' }}>
                              <div style={{ fontWeight: 500 }}>{item.product?.name}</div>
                              {isBox && (
                                <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 2, display: 'flex', gap: 4, alignItems: 'center' }}>
                                  <span style={{ background: 'var(--accent)20', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>BOX</span>
                                  {item.product?.piecesPerBox > 1 && <span style={{ color: 'var(--text-muted)' }}>{item.product.piecesPerBox} pcs/box</span>}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              {item.orderedQty}
                              {isBox && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>boxes</div>}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>{item.receivedQty || 0}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                              {isBox ? (
                                <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                  {['boxes', 'pieces'].map(u => (
                                    <button key={u} type="button" onClick={() => setReceiveUnits(prev => ({ ...prev, [item._id]: u }))}
                                      style={{
                                        padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                        border: unit === u ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                                        background: unit === u ? 'var(--accent)15' : 'transparent',
                                        color: unit === u ? 'var(--accent)' : 'var(--text-muted)',
                                      }}>{u}</button>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>pcs</span>
                              )}
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                              <input type="number" min="0" className="form-input"
                                style={{ width: 80, textAlign: 'center', padding: '5px 8px', fontSize: 13 }}
                                placeholder="0"
                                value={receiveQtys[item._id] || ''}
                                onChange={e => setReceiveQtys(prev => ({ ...prev, [item._id]: e.target.value }))}
                              />
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                              <input type="number" min="0" max={receiveQtys[item._id] || 0} className="form-input"
                                style={{ width: 80, textAlign: 'center', padding: '5px 8px', fontSize: 13, borderColor: brokenQtys[item._id] > 0 ? 'var(--red)' : undefined, color: brokenQtys[item._id] > 0 ? 'var(--red)' : undefined }}
                                placeholder="0"
                                value={brokenQtys[item._id] || ''}
                                onChange={e => setBrokenQtys(prev => ({ ...prev, [item._id]: e.target.value }))}
                              />
                              {brokenQtys[item._id] > 0 && (
                                <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 2 }}>auto-logged</div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#991b1b' }}>
                    Broken-on-arrival items are automatically logged as shipping breakages and excluded from inventory.
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-primary" onClick={handleReceive} disabled={receiving}>
                      <Truck size={14} /> {receiving ? 'Saving…' : 'Receive Items & Update Inventory'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── Complete Direct Sale Tab ── */}
          {tab === 'complete' && isDS && (
            <>
              {po.status === 'direct_sale' ? (
                <div style={{ textAlign: 'center', padding: 32 }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <Check size={28} color="#16a34a" />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Direct Sale Completed</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>Sale record created. Inventory was not affected.</div>
                  <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', padding: '8px 16px', borderRadius: 8, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', fontSize: 13 }}>
                    Payment: <span className={`badge ${PAY_META[po.paymentStatus]?.cls}`}>{po.paymentStatus}</span>
                    {po.paymentStatus !== 'paid' && <span style={{ color: 'var(--text-muted)' }}>— use Customer Payment tab to record</span>}
                  </div>
                </div>
              ) : locked && po.status !== 'direct_sale' ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                  This PO is {po.status} and cannot be converted.
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fef3c7', borderRadius: 8, border: '1px solid #fbbf24', fontSize: 13 }}>
                    <strong>Direct Sale:</strong> Items will be sold directly from vendor to customer. <strong>No inventory changes</strong> will be made. A sale record will be created.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}>
                    <div className="form-group">
                      <label className="form-label">Payment Method</label>
                      <select className="form-input" value={dsForm.paymentMethod} onChange={e => setDsForm(p => ({ ...p, paymentMethod: e.target.value }))}>
                        {['cash', 'card', 'bank_transfer', 'cheque', 'credit'].map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Amount Received (blank = full amount)</label>
                      <input className="form-input" type="number" step="0.01" placeholder={fmt(po.saleGrandTotal || po.grandTotal)}
                        value={dsForm.amountPaid} onChange={e => setDsForm(p => ({ ...p, amountPaid: e.target.value }))} />
                    </div>
                    <div style={{ padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Sale Total</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{fmt(po.saleGrandTotal || po.grandTotal)}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 20 }}>
                    <button className="btn btn-primary" onClick={handleCompleteDirectSale} disabled={completing}>
                      <Check size={14} /> {completing ? 'Processing…' : 'Complete Direct Sale'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── Payment Tab (Standard + Direct Sale) ── */}
          {tab === 'payment' && (() => {
            const targetAmt = isDS ? (po.saleGrandTotal || po.grandTotal) : po.grandTotal;
            const remaining = Math.max(0, targetAmt - (po.paidAmount || 0));
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {isDS && (
                  <div style={{ padding: '10px 14px', background: '#ede9fe20', border: '1px solid #a78bfa40', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                    Track what the <strong>customer has paid</strong> for this direct sale. Sale total is based on selling prices.
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  {[
                    { label: isDS ? 'Sale Total' : 'Total Amount', value: fmt(targetAmt), color: 'var(--text-primary)' },
                    { label: 'Paid', value: fmt(po.paidAmount || 0), color: 'var(--green)' },
                    { label: 'Remaining', value: fmt(remaining), color: remaining <= 0 ? 'var(--green)' : 'var(--red)' },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: '12px 16px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, background: PAY_META[po.paymentStatus]?.cls === 'badge-green' ? '#d1fae520' : PAY_META[po.paymentStatus]?.cls === 'badge-yellow' ? '#fef3c720' : '#fee2e220', width: 'fit-content' }}>
                  <span className={`badge ${PAY_META[po.paymentStatus]?.cls}`}>{po.paymentStatus}</span>
                </div>
                {po.paymentStatus !== 'paid' && po.status !== 'cancelled' ? (
                  <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: '16px', border: '1px solid var(--border)', maxWidth: 360 }}>
                    <div style={{ fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>{isDS ? 'Record Customer Payment' : 'Record Payment'}</div>
                    <div className="form-group">
                      <label className="form-label">Amount (Rs)</label>
                      <input className="form-input" type="number" step="0.01" min="0.01"
                        placeholder={`Max: ${fmt(remaining)}`}
                        value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setPaymentAmount(String(remaining.toFixed(2)))}>
                        Full Amount
                      </button>
                    </div>
                    <button className="btn btn-primary" style={{ marginTop: 12, width: '100%' }} onClick={handleRecordPayment} disabled={recordingPayment}>
                      {recordingPayment ? <span className="spinner" /> : '✓ Record Payment'}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#d1fae520', border: '1px solid var(--green)', borderRadius: 8 }}>
                    <Check size={18} color="var(--green)" />
                    <span style={{ color: 'var(--green)', fontWeight: 600 }}>Fully paid</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Status Tab ── */}
          {tab === 'status' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
                Current: <span className={`badge ${STATUS_META[po.status]?.cls}`}>{STATUS_META[po.status]?.label}</span>
              </div>
              {locked ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>This PO is {po.status} and no further status changes are allowed.</div>
              ) : (
                <>
                  {po.status === 'draft' && (
                    <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={changingStatus}
                      onClick={() => changeStatus('ordered')}>
                      <ArrowRight size={14} /> Mark as Ordered (sent to vendor)
                    </button>
                  )}
                  {!isDS && ['ordered', 'partial'].includes(po.status) && (
                    <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={changingStatus}
                      onClick={() => changeStatus('received')}>
                      <Package size={14} /> Mark as Fully Received
                    </button>
                  )}
                  {isDS && !['cancelled', 'draft'].includes(po.status) && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      To complete the sale, use the Complete Sale tab.
                    </div>
                  )}
                  <button className="btn btn-secondary" style={{ alignSelf: 'flex-start', color: 'var(--red)', borderColor: 'var(--red)' }}
                    disabled={changingStatus} onClick={() => changeStatus('cancelled')}>
                    <X size={14} /> Cancel PO
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────
export default function PurchasesPage() {
  const [orders, setOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [storeSettings, setStoreSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editPO, setEditPO] = useState(null);
  const [detailPO, setDetailPO] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);
      const [o, v, w, s] = await Promise.all([
        api.get(`/purchases?${params}`),
        api.get('/vendors'),
        api.get('/warehouses'),
        api.get('/settings'),
      ]);
      setOrders(o.data);
      setVendors(v.data);
      setWarehouses(w.data);
      setStoreSettings(s.data || {});
    } finally { setLoading(false); }
  }, [statusFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id) => {
    try {
      const res = await api.get(`/purchases/${id}`);
      setDetailPO(res.data);
    } catch { toast.error('Failed to load PO'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Purchase Orders</h1>
          <p className="page-subtitle">{orders.length} orders</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> New PO</button>
      </div>

      <div className="card mb-16">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select className="form-input" style={{ width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            {Object.entries(STATUS_META).map(([val, { label }]) => <option key={val} value={val}>{label}</option>)}
          </select>
          <select className="form-input" style={{ width: 160 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            <option value="standard">Standard PO</option>
            <option value="direct_sale">Direct Sale</option>
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
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Type</th>
                  <th>Vendor</th>
                  <th>Warehouse</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Items</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th>Expected</th>
                  <th>Created</th>
                  <th>Payment</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr><td colSpan={11} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No purchase orders found</td></tr>
                ) : orders.map(o => (
                  <tr key={o._id} style={{ cursor: 'pointer' }} onClick={() => openDetail(o._id)}>
                    <td><span className="text-mono">{o.poNumber}</span></td>
                    <td>
                      {o.type === 'direct_sale'
                        ? <span className="badge badge-purple">Direct Sale</span>
                        : <span className="badge badge-gray">Standard</span>}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{o.vendor?.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.vendor?.company}</div>
                    </td>
                    <td>{o.type === 'direct_sale' ? <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span> : o.warehouse?.name}</td>
                    <td><span className={`badge ${STATUS_META[o.status]?.cls}`}>{STATUS_META[o.status]?.label || o.status}</span></td>
                    <td style={{ textAlign: 'center' }}><span className="text-mono">{o.items?.length}</span></td>
                    <td style={{ textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>{fmt(o.grandTotal)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.expectedDate ? format(new Date(o.expectedDate), 'MMM d, yyyy') : '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{format(new Date(o.createdAt), 'MMM d, yyyy')}</td>
                    <td><span className={`badge ${PAY_META[o.paymentStatus]?.cls}`}>{o.paymentStatus}</span></td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-icon" title="View" onClick={() => openDetail(o._id)}><Eye size={14} /></button>
                        <button className="btn btn-ghost btn-icon" title="Print" onClick={() => printPO(o, storeSettings)}><Printer size={14} /></button>
                        {o.status === 'draft' && (
                          <button className="btn btn-ghost btn-icon" title="Edit" onClick={() => { setEditPO(o); setShowModal(true); }}>✏️</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <POModal
          vendors={vendors}
          warehouses={warehouses}
          editPO={editPO}
          onClose={() => { setShowModal(false); setEditPO(null); }}
          onSave={() => { setShowModal(false); setEditPO(null); load(); }}
        />
      )}

      {detailPO && (
        <PODetailModal
          po={detailPO}
          store={storeSettings}
          onClose={() => setDetailPO(null)}
          onRefresh={load}
        />
      )}
    </div>
  );
}
