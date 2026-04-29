import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api.js';
import toast from 'react-hot-toast';
import { Plus, Eye, RefreshCw, Printer } from 'lucide-react';
import { format } from 'date-fns';

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

// ─── Main Page ───────────────────────────────────────────
export default function PurchasesPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [storeSettings, setStoreSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);
      const [o, s] = await Promise.all([
        api.get(`/purchases?${params}`),
        api.get('/settings'),
      ]);
      setOrders(o.data);
      setStoreSettings(s.data || {});
    } finally { setLoading(false); }
  }, [statusFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Purchase Orders</h1>
          <p className="page-subtitle">{orders.length} orders</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/purchases/new')}><Plus size={16} /> New PO</button>
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
                  <th>PO Number</th><th>Type</th><th>Vendor</th><th>Warehouse</th><th>Status</th>
                  <th style={{ textAlign: 'center' }}>Items</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th>Expected</th><th>Created</th><th>Payment</th><th></th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr><td colSpan={11} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No purchase orders found</td></tr>
                ) : orders.map(o => (
                  <tr key={o._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/purchases/${o._id}`)}>
                    <td><span className="text-mono">{o.poNumber}</span></td>
                    <td>{o.type === 'direct_sale' ? <span className="badge badge-purple">Direct Sale</span> : <span className="badge badge-gray">Standard</span>}</td>
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
                        <button className="btn btn-ghost btn-icon" title="View" onClick={() => navigate(`/purchases/${o._id}`)}><Eye size={14} /></button>
                        <button className="btn btn-ghost btn-icon" title="Print" onClick={() => printPO(o, storeSettings)}><Printer size={14} /></button>
                        {o.status === 'draft' && (
                          <button className="btn btn-ghost btn-icon" title="Edit" onClick={() => navigate(`/purchases/${o._id}/edit`)}>✏️</button>
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

    </div>
  );
}
