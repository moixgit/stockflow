import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api.js';
import toast from 'react-hot-toast';
import { ArrowLeft, Printer, Check, X, ArrowRight, Truck, Package } from 'lucide-react';
import { format } from 'date-fns';
import { dimensionDisplay, pricingRateLabel } from '../utils/pricing.js';

const fmt = (n) => `Rs ${(n || 0).toFixed(2)}`;

const STATUS_META = {
  draft:       { label: 'Draft',       cls: 'badge-gray'   },
  ordered:     { label: 'Ordered',     cls: 'badge-blue'   },
  partial:     { label: 'Partial',     cls: 'badge-yellow' },
  received:    { label: 'Received',    cls: 'badge-green'  },
  cancelled:   { label: 'Cancelled',   cls: 'badge-red'    },
  direct_sale: { label: 'Direct Sale', cls: 'badge-purple' },
};

const PAY_META = {
  unpaid:  { cls: 'badge-red'    },
  partial: { cls: 'badge-yellow' },
  paid:    { cls: 'badge-green'  },
};

function printPO(po, store = {}) {
  const date = new Date(po.createdAt).toLocaleString('en-PK', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const isDS = po.type === 'direct_sale';
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>${isDS ? 'Direct Sale Order' : 'Purchase Order'} ${po.poNumber}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:13px;color:#1a1a2e;background:#fff}.page{max-width:760px;margin:0 auto;padding:40px 48px}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px}.brand-name{font-size:26px;font-weight:900;color:#6c63ff;letter-spacing:-1px}.brand-sub{font-size:11px;color:#888;margin-top:2px}.po-meta{text-align:right}.po-title{font-size:20px;font-weight:700;color:#1a1a2e}.po-date{font-size:11px;color:#888;margin-top:2px}.hline{border:none;border-top:2px solid #6c63ff;margin:0 0 24px}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:28px}.info-box{background:#f8f8ff;border:1px solid #e5e0ff;border-radius:8px;padding:12px 14px}.info-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#6c63ff;margin-bottom:4px}.info-val{font-size:13px;color:#1a1a2e;font-weight:500;line-height:1.5}.info-sub{font-size:11px;color:#888}.type-badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;background:${isDS?'#ede9fe':'#dbeafe'};color:${isDS?'#5b21b6':'#1e40af'};margin-bottom:8px}table{width:100%;border-collapse:collapse;margin-bottom:20px}thead tr{background:#6c63ff;color:#fff}thead th{padding:9px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}thead th:nth-child(n+2){text-align:center}thead th:last-child{text-align:right}tbody tr{border-bottom:1px solid #f0f0f0}tbody tr:nth-child(even){background:#fafafa}tbody td{padding:9px 12px;font-size:13px;vertical-align:middle}tbody td:nth-child(n+2){text-align:center;color:#555}tbody td:last-child{text-align:right;font-weight:600}.totals{display:flex;justify-content:flex-end;margin-bottom:28px}.totals-box{width:240px}.t-row{display:flex;justify-content:space-between;padding:4px 0;font-size:13px}.t-row.grand{border-top:2px solid #6c63ff;margin-top:6px;padding-top:9px;font-size:15px;font-weight:800;color:#6c63ff}.t-label{color:#666}.footer{border-top:1px solid #e5e7eb;padding-top:16px;display:flex;justify-content:space-between;align-items:flex-end}.footer-note{font-size:11px;color:#aaa;max-width:340px;line-height:1.5}.footer-brand{font-size:18px;font-weight:900;color:#e5e0ff}@media print{@page{margin:15mm;size:A4 portrait}.page{padding:0}}</style>
</head><body><div class="page">
  <div class="header">
    <div style="display:flex;align-items:center;gap:14px">
      ${store.logo ? `<img src="${store.logo}" style="max-height:60px;max-width:110px;object-fit:contain"/>` : ''}
      <div><div class="brand-name">${store.name || 'StockFlow'}</div>
      ${store.tagline ? `<div class="brand-sub">${store.tagline}</div>` : ''}
      ${store.address?.city ? `<div class="brand-sub">${[store.address.street, store.address.city, store.address.country].filter(Boolean).join(', ')}</div>` : ''}
      ${store.phone ? `<div class="brand-sub">Tel: ${store.phone}</div>` : ''}
      ${store.taxNumber ? `<div class="brand-sub">NTN: ${store.taxNumber}</div>` : ''}</div>
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
    <div class="info-box"><div class="info-label">Vendor</div>
      <div class="info-val">${po.vendor?.name || '—'}</div>
      ${po.vendor?.company ? `<div class="info-sub">${po.vendor.company}</div>` : ''}
      ${po.vendor?.phone ? `<div class="info-sub">Tel: ${po.vendor.phone}</div>` : ''}
    </div>
    ${isDS ? `<div class="info-box"><div class="info-label">End Customer</div>
      <div class="info-val">${po.customer?.name || 'Walk-in Customer'}</div>
      ${po.customer?.phone ? `<div class="info-sub">Tel: ${po.customer.phone}</div>` : ''}
    </div>` : `<div class="info-box"><div class="info-label">Warehouse</div>
      <div class="info-val">${po.warehouse?.name || '—'}</div>
      <div class="info-sub">Code: ${po.warehouse?.code || '—'}</div>
    </div>`}
  </div>
  <table><thead><tr><th>#</th><th style="text-align:left">Product</th><th>Qty</th><th>Unit</th><th>Cost Price</th>${isDS ? '<th>Selling Price</th>' : ''}<th>Total</th></tr></thead>
  <tbody>${po.items.map((item, i) => `<tr>
    <td style="color:#aaa;font-size:11px">${i + 1}</td>
    <td style="text-align:left;font-weight:600">${item.product?.name || ''}</td>
    <td>${item.orderedQty}</td>
    <td>${item.orderingUnit === 'loose' ? 'pcs (loose)' : item.orderingUnit || 'pcs'}</td>
    <td>${fmt(item.costPrice)}</td>
    ${isDS ? `<td>${fmt(item.sellingPrice)}</td>` : ''}
    <td>${fmt(item.total || item.costPrice * item.orderedQty)}</td>
  </tr>`).join('')}</tbody></table>
  <div class="totals"><div class="totals-box">
    <div class="t-row"><span class="t-label">Subtotal</span><span>${fmt(po.subtotal)}</span></div>
    ${po.shippingCost ? `<div class="t-row"><span class="t-label">Shipping</span><span>${fmt(po.shippingCost)}</span></div>` : ''}
    ${po.taxAmount ? `<div class="t-row"><span class="t-label">Tax</span><span>${fmt(po.taxAmount)}</span></div>` : ''}
    ${po.discountAmount ? `<div class="t-row"><span class="t-label">Discount</span><span>-${fmt(po.discountAmount)}</span></div>` : ''}
    <div class="t-row grand"><span>Total</span><span>${fmt(po.grandTotal)}</span></div>
    ${isDS && po.saleGrandTotal ? `<div style="margin-top:12px;border-top:1px dashed #ddd;padding-top:10px">
      <div class="t-row grand" style="color:#16a34a"><span>Sale Total</span><span>${fmt(po.saleGrandTotal)}</span></div>
      <div class="t-row" style="font-size:12px;color:#888"><span>Margin</span><span>${fmt(po.saleGrandTotal - po.grandTotal)}</span></div>
    </div>` : ''}
  </div></div>
  ${po.notes ? `<div style="margin-bottom:20px;padding:12px 14px;background:#f8f8ff;border-radius:8px;border:1px solid #e5e0ff;font-size:12px;color:#555"><strong>Notes:</strong> ${po.notes}</div>` : ''}
  <div class="footer">
    <div class="footer-note">Computer-generated ${isDS ? 'direct sale order' : 'purchase order'} — ref: <strong>${po.poNumber}</strong>${store.email ? ` · ${store.email}` : ''}</div>
    <div class="footer-brand">${store.name || 'StockFlow'}</div>
  </div>
</div></body></html>`;
  const w = window.open('', '_blank', 'width=860,height=900');
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

export default function PurchaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [po, setPO] = useState(null);
  const [store, setStore] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('details');
  const [changingStatus, setChangingStatus] = useState(false);
  const [receiveQtys, setReceiveQtys] = useState({});
  const [brokenQtys, setBrokenQtys] = useState({});
  const [receiveUnits, setReceiveUnits] = useState({});
  const [receiving, setReceiving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [dsForm, setDsForm] = useState({ paymentMethod: 'cash', amountPaid: '', customer: { name: '', phone: '', email: '' } });
  const [paymentAmount, setPaymentAmount] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);

  const reload = useCallback(async () => {
    try { const res = await api.get(`/purchases/${id}`); setPO(res.data); }
    catch { toast.error('Failed to reload'); }
  }, [id]);

  useEffect(() => {
    Promise.all([api.get(`/purchases/${id}`), api.get('/settings')])
      .then(([r, s]) => {
        const p = r.data;
        setPO(p);
        setStore(s.data || {});
        const units = {};
        p.items.forEach(item => {
          units[item._id] = item.orderingUnit === 'loose' ? 'pieces'
            : item.product?.productType === 'box' ? 'boxes' : 'pieces';
        });
        setReceiveUnits(units);
        setDsForm(prev => ({ ...prev, customer: p.customer || { name: '', phone: '', email: '' } }));
      })
      .catch(() => toast.error('Failed to load PO'))
      .finally(() => setLoading(false));
  }, [id]);

  const changeStatus = async (status) => {
    setChangingStatus(true);
    try {
      const res = await api.patch(`/purchases/${po._id}/status`, { status });
      setPO(res.data);
      toast.success(`Status: ${status}`);
    } catch (err) { toast.error(err?.message || 'Failed'); }
    finally { setChangingStatus(false); }
  };

  const handleReceive = async () => {
    const items = po.items
      .filter(item => receiveQtys[item._id] > 0)
      .map(item => ({
        itemId: item._id,
        receivedQty: Number(receiveQtys[item._id]),
        brokenQty: Number(brokenQtys[item._id] || 0),
        receivingUnit: receiveUnits[item._id] || 'boxes',
      }));
    if (!items.length) return toast.error('Enter quantities to receive');
    if (items.find(r => r.brokenQty > r.receivedQty)) return toast.error('Broken qty cannot exceed received qty');
    setReceiving(true);
    try {
      const res = await api.post(`/purchases/${po._id}/receive`, { receivedItems: items });
      setPO(res.data);
      setReceiveQtys({});
      setBrokenQtys({});
      const broken = items.reduce((s, r) => s + r.brokenQty, 0);
      toast.success(broken > 0 ? `Received — ${broken} broken items logged` : 'Inventory updated');
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
      toast.success('Direct sale completed');
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
    } catch (err) { toast.error(err?.message || 'Failed'); }
    finally { setRecordingPayment(false); }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div className="spinner" style={{ width: 28, height: 28 }} />
    </div>
  );
  if (!po) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
      Purchase order not found. <button className="btn btn-ghost" onClick={() => navigate(-1)}>← Back</button>
    </div>
  );

  const isDS = po.type === 'direct_sale';
  const locked = ['received', 'cancelled', 'direct_sale'].includes(po.status);

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate(-1)} title="Back">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>{po.poNumber}</h1>
            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
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
        <button className="btn btn-secondary" onClick={() => printPO(po, store)}>
          <Printer size={14} /> Print PO
        </button>
      </div>

      <div className="card">
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 8px' }}>
          {['details', isDS ? 'complete' : 'receive', 'payment', 'status'].map(t => {
            const label = t === 'complete' ? 'Complete Sale'
              : t === 'receive' ? 'Receive Items'
              : t === 'payment' ? (isDS ? 'Customer Payment' : 'Payment')
              : 'Details';
            return (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: -1,
              }}>{label}</button>
            );
          })}
        </div>

        <div style={{ padding: 24 }}>

          {/* ── Details ── */}
          {tab === 'details' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
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
                      <th>Product</th><th>SKU</th>
                      <th style={{ textAlign: 'center' }}>Ordered</th>
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
                              {isBox && <span style={{ fontSize: 10, background: 'var(--accent)20', color: 'var(--accent)', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>BOX · {item.product.piecesPerBox || 1} pcs</span>}
                              {isMeasured && <span style={{ fontSize: 10, background: '#0ea5e918', color: '#0ea5e9', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>{dimensionDisplay(item.product)} · {pricingMode === 'per_sqm' ? '/sqm' : '/m'}</span>}
                              {orderUnit === 'loose' && <span style={{ fontSize: 10, background: '#d1fae520', color: '#16a34a', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>loose pcs</span>}
                            </div>
                          </td>
                          <td><span className="text-mono" style={{ fontSize: 11 }}>{item.product?.sku || '—'}</span></td>
                          <td style={{ textAlign: 'center' }}>
                            <div>{item.orderedQty}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{isBox ? (orderUnit === 'loose' ? 'pcs' : 'boxes') : (item.product?.unit || 'pcs')}</div>
                          </td>
                          {!isDS && <td style={{ textAlign: 'center' }}>
                            <span style={{ color: item.receivedQty >= item.orderedQty ? 'var(--green)' : item.receivedQty > 0 ? 'var(--yellow)' : 'var(--text-muted)' }}>
                              {item.receivedQty || 0}
                            </span>
                          </td>}
                          <td style={{ textAlign: 'right' }}>
                            <div>{fmt(item.costPrice)}</div>
                            {isMeasured && <div style={{ fontSize: 10, color: '#0ea5e9' }}>{fmt(item.product?.costPrice)}{pricingRateLabel(item.product)}</div>}
                          </td>
                          {isDS && <td style={{ textAlign: 'right', color: 'var(--accent)' }}>{fmt(item.sellingPrice)}</td>}
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(item.total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220 }}>
                  {[
                    { label: 'Subtotal', val: fmt(po.subtotal) },
                    po.shippingCost > 0 && { label: 'Shipping', val: fmt(po.shippingCost) },
                    po.taxAmount > 0 && { label: 'Tax', val: fmt(po.taxAmount) },
                    po.discountAmount > 0 && { label: 'Discount', val: `-${fmt(po.discountAmount)}`, red: true },
                  ].filter(Boolean).map(r => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                      <span style={r.red ? { color: 'var(--red)' } : {}}>{r.val}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, marginTop: 4, paddingTop: 8, borderTop: '2px solid var(--border)' }}>
                    <span>Total</span><span style={{ color: 'var(--green)' }}>{fmt(po.grandTotal)}</span>
                  </div>
                  {po.advanceAmount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--green)' }}><span>Advance Paid</span><span>-{fmt(po.advanceAmount)}</span></div>}
                  {po.paidAmount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--green)' }}><span>Total Paid</span><span>{fmt(po.paidAmount)}</span></div>}
                  {po.grandTotal > (po.paidAmount || 0) && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--red)', fontWeight: 600 }}><span>Remaining</span><span>{fmt(po.grandTotal - (po.paidAmount || 0))}</span></div>}
                  {isDS && po.saleGrandTotal > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, marginTop: 4, color: 'var(--accent)' }}><span>Sale Total</span><span>{fmt(po.saleGrandTotal)}</span></div>}
                </div>
              </div>
              {po.notes && <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)' }}><strong>Notes:</strong> {po.notes}</div>}
            </>
          )}

          {/* ── Receive ── */}
          {tab === 'receive' && !isDS && (
            locked ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                <Package size={36} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                <p>This PO is {po.status} — no further receiving needed.</p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-muted)' }}>Enter quantities received. This updates inventory.</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-elevated)' }}>
                      {['Product', 'Ordered', 'Received', 'Unit', 'Receive Now', 'Broken'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Product' ? 'left' : 'center', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {po.items.map(item => {
                      const isBox = item.product?.productType === 'box';
                      const unit = receiveUnits[item._id] || (isBox ? 'boxes' : 'pieces');
                      const isLoose = item.orderingUnit === 'loose';
                      return (
                        <tr key={item._id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ fontWeight: 500 }}>{item.product?.name}</div>
                            <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                              {isBox && <span style={{ fontSize: 10, background: 'var(--accent)20', color: 'var(--accent)', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>BOX · {item.product?.piecesPerBox || 1} pcs</span>}
                              {isLoose && <span style={{ fontSize: 10, background: '#d1fae520', color: '#16a34a', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>loose pcs</span>}
                            </div>
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            {item.orderedQty}
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{isLoose ? 'pcs' : isBox ? 'boxes' : item.product?.unit || 'pcs'}</div>
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>{item.receivedQty || 0}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                            {isBox && !isLoose ? (
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                {['boxes', 'pieces'].map(u => (
                                  <button key={u} type="button" onClick={() => setReceiveUnits(prev => ({ ...prev, [item._id]: u }))}
                                    style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: unit === u ? '1.5px solid var(--accent)' : '1.5px solid var(--border)', background: unit === u ? 'var(--accent)15' : 'transparent', color: unit === u ? 'var(--accent)' : 'var(--text-muted)' }}>{u}</button>
                                ))}
                              </div>
                            ) : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>pcs</span>}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                            <input type="number" min="0" className="form-input" style={{ width: 80, textAlign: 'center', padding: '5px 8px', fontSize: 13 }}
                              placeholder="0" value={receiveQtys[item._id] || ''}
                              onChange={e => setReceiveQtys(prev => ({ ...prev, [item._id]: e.target.value }))} />
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                            <input type="number" min="0" className="form-input"
                              style={{ width: 80, textAlign: 'center', padding: '5px 8px', fontSize: 13, borderColor: brokenQtys[item._id] > 0 ? 'var(--red)' : undefined }}
                              placeholder="0" value={brokenQtys[item._id] || ''}
                              onChange={e => setBrokenQtys(prev => ({ ...prev, [item._id]: e.target.value }))} />
                            {brokenQtys[item._id] > 0 && <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 2 }}>auto-logged</div>}
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
            )
          )}

          {/* ── Complete Direct Sale ── */}
          {tab === 'complete' && isDS && (
            po.status === 'direct_sale' ? (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <Check size={28} color="#16a34a" />
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Direct Sale Completed</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>Sale record created. Inventory was not affected.</div>
                <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', padding: '8px 16px', borderRadius: 8, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', fontSize: 13 }}>
                  Payment: <span className={`badge ${PAY_META[po.paymentStatus]?.cls}`}>{po.paymentStatus}</span>
                  {po.paymentStatus !== 'paid' && <span style={{ color: 'var(--text-muted)' }}>— use Customer Payment tab</span>}
                </div>
              </div>
            ) : locked ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>This PO is {po.status} and cannot be converted.</div>
            ) : (
              <>
                <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fef3c7', borderRadius: 8, border: '1px solid #fbbf24', fontSize: 13 }}>
                  <strong>Direct Sale:</strong> Items go vendor → customer. <strong>No inventory changes.</strong> A sale record will be created.
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
            )
          )}

          {/* ── Payment ── */}
          {tab === 'payment' && (() => {
            const targetAmt = isDS ? (po.saleGrandTotal || po.grandTotal) : po.grandTotal;
            const remaining = Math.max(0, targetAmt - (po.paidAmount || 0));
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {isDS && (
                  <div style={{ padding: '10px 14px', background: '#ede9fe20', border: '1px solid #a78bfa40', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                    Track what the <strong>customer has paid</strong>. Sale total is based on selling prices.
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
                <span className={`badge ${PAY_META[po.paymentStatus]?.cls}`} style={{ width: 'fit-content' }}>{po.paymentStatus}</span>
                {po.paymentStatus !== 'paid' && po.status !== 'cancelled' ? (
                  <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: 16, border: '1px solid var(--border)', maxWidth: 360 }}>
                    <div style={{ fontWeight: 600, marginBottom: 12 }}>{isDS ? 'Record Customer Payment' : 'Record Payment'}</div>
                    <div className="form-group">
                      <label className="form-label">Amount (Rs)</label>
                      <input className="form-input" type="number" step="0.01" min="0.01"
                        placeholder={`Max: ${fmt(remaining)}`}
                        value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
                    </div>
                    <button className="btn btn-ghost btn-sm" style={{ marginTop: 4 }} onClick={() => setPaymentAmount(remaining.toFixed(2))}>Full Amount</button>
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

          {/* ── Status ── */}
          {tab === 'status' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
                Current: <span className={`badge ${STATUS_META[po.status]?.cls}`}>{STATUS_META[po.status]?.label}</span>
              </div>
              {locked ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>This PO is {po.status} — no further changes allowed.</div>
              ) : (
                <>
                  {po.status === 'draft' && (
                    <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={changingStatus} onClick={() => changeStatus('ordered')}>
                      <ArrowRight size={14} /> Mark as Ordered
                    </button>
                  )}
                  {!isDS && ['ordered', 'partial'].includes(po.status) && (
                    <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={changingStatus} onClick={() => changeStatus('received')}>
                      <Package size={14} /> Mark as Fully Received
                    </button>
                  )}
                  {isDS && !['cancelled', 'draft'].includes(po.status) && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Use the Complete Sale tab to finalize.</div>
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
