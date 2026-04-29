import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api.js';
import toast from 'react-hot-toast';
import { Eye, RefreshCw, Printer, RotateCcw, Receipt, TrendingUp, ShoppingBag, Ban } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '../store/authStore.js';

const fmt = (n) => `Rs ${(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_META = {
  completed: { label: 'Completed', cls: 'badge-green' },
  pending:   { label: 'Pending',   cls: 'badge-yellow' },
  cancelled: { label: 'Cancelled', cls: 'badge-gray'   },
  refunded:  { label: 'Refunded',  cls: 'badge-red'    },
};

const PAY_META = {
  cash:          { label: 'Cash',          cls: 'badge-green'  },
  card:          { label: 'Card',          cls: 'badge-blue'   },
  bank_transfer: { label: 'Bank Transfer', cls: 'badge-blue'   },
  cheque:        { label: 'Cheque',        cls: 'badge-yellow' },
  credit:        { label: 'Credit',        cls: 'badge-purple' },
};

// ─── Receipt printer ────────────────────────────────────
function printReceipt(sale, store = {}) {
  const date = new Date(sale.createdAt).toLocaleString('en-PK', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Receipt ${sale.saleNumber}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Courier New',monospace;font-size:12px;color:#000;background:#fff;width:300px;margin:0 auto;padding:16px 8px}
  .center{text-align:center} .bold{font-weight:700} .line{border-top:1px dashed #000;margin:8px 0}
  .row{display:flex;justify-content:space-between;padding:2px 0}
  .item-name{flex:1} .item-qty{width:40px;text-align:center} .item-price{width:70px;text-align:right}
  .total-row{display:flex;justify-content:space-between;font-weight:700;font-size:13px;padding:3px 0}
  @media print{@page{margin:0;size:80mm auto}}
</style></head><body>
<div class="center bold" style="font-size:15px;margin-bottom:2px">${store.name || 'StockFlow'}</div>
${store.address?.city ? `<div class="center" style="font-size:11px">${[store.address.street, store.address.city].filter(Boolean).join(', ')}</div>` : ''}
${store.phone ? `<div class="center" style="font-size:11px">Tel: ${store.phone}</div>` : ''}
<div class="line"></div>
<div class="row"><span>Receipt #</span><span class="bold">${sale.saleNumber}</span></div>
<div class="row"><span>Date</span><span>${date}</span></div>
<div class="row"><span>Cashier</span><span>${sale.soldBy?.name || '—'}</span></div>
${sale.customer?.name ? `<div class="row"><span>Customer</span><span>${sale.customer.name}</span></div>` : ''}
${sale.warehouse?.name ? `<div class="row"><span>Store</span><span>${sale.warehouse.name}</span></div>` : ''}
<div class="line"></div>
<div class="row bold"><span class="item-name">Item</span><span class="item-qty">Qty</span><span class="item-price">Amount</span></div>
<div class="line"></div>
${sale.items.map(item => {
  const unit = item.sellingUnit === 'loose' ? 'pcs' : item.sellingUnit === 'box' ? 'box' : '';
  return `<div style="padding:2px 0">
  <div class="bold" style="font-size:11px">${item.productName || item.product?.name || '?'}</div>
  <div class="row" style="color:#555">
    <span class="item-name">${unit ? `(${unit})` : ''}</span>
    <span class="item-qty">${item.quantity}</span>
    <span class="item-price">${fmt(item.total)}</span>
  </div></div>`;
}).join('')}
<div class="line"></div>
${(sale.subtotal !== sale.grandTotal || sale.shippingCost > 0) ? `<div class="row"><span>Subtotal</span><span>${fmt(sale.subtotal)}</span></div>` : ''}
${sale.taxAmount > 0 ? `<div class="row"><span>Tax</span><span>${fmt(sale.taxAmount)}</span></div>` : ''}
${sale.discountAmount > 0 ? `<div class="row"><span>Discount</span><span>-${fmt(sale.discountAmount)}</span></div>` : ''}
${sale.shippingCost > 0 ? `<div class="row"><span>Shipping</span><span>+${fmt(sale.shippingCost)}</span></div>` : ''}
<div class="total-row"><span>TOTAL</span><span>${fmt(sale.grandTotal)}</span></div>
<div class="row"><span>Paid (${(sale.paymentMethod || 'cash').replace('_', ' ')})</span><span>${fmt(sale.amountPaid)}</span></div>
${sale.changeAmount > 0 ? `<div class="row"><span>Change</span><span>${fmt(sale.changeAmount)}</span></div>` : ''}
<div class="line"></div>
<div class="center" style="font-size:11px;margin-top:4px">${store.receiptFooter || 'Thank you for your purchase!'}</div>
</body></html>`;
  const w = window.open('', '_blank', 'width=400,height=600');
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

// ─── Sale Detail Modal ───────────────────────────────────
function SaleDetailModal({ sale: init, onClose, onRefund, store, isAdmin }) {
  const [sale, setSale] = useState(init);
  const [refunding, setRefunding] = useState(false);

  const handleRefund = async () => {
    if (!window.confirm(`Refund sale ${sale.saleNumber}? Inventory will be restored.`)) return;
    setRefunding(true);
    try {
      const res = await api.post(`/pos/${sale._id}/refund`);
      setSale(res.data);
      toast.success('Sale refunded — inventory restored');
      onRefund();
    } catch (err) { toast.error(err?.message || 'Refund failed'); }
    finally { setRefunding(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg" style={{ maxWidth: 760, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header" style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
          <div>
            <h2 className="modal-title" style={{ margin: 0 }}>{sale.saleNumber}</h2>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <span className={`badge ${STATUS_META[sale.status]?.cls}`}>{STATUS_META[sale.status]?.label}</span>
              <span className={`badge ${PAY_META[sale.paymentMethod]?.cls}`}>{PAY_META[sale.paymentMethod]?.label || sale.paymentMethod}</span>
              {sale.isDirectSale && <span className="badge badge-purple">Direct Sale</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => printReceipt(sale, store)}>
              <Printer size={14} /> Print Receipt
            </button>
            {isAdmin && sale.status === 'completed' && (
              <button className="btn btn-secondary" style={{ color: 'var(--red)', borderColor: 'var(--red)' }} onClick={handleRefund} disabled={refunding}>
                <RotateCcw size={14} /> {refunding ? 'Processing…' : 'Refund'}
              </button>
            )}
            <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
          </div>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {/* Info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Date', value: format(new Date(sale.createdAt), 'MMM d, yyyy h:mm a') },
              { label: 'Sold By', value: sale.soldBy?.name || '—' },
              { label: 'Warehouse', value: sale.warehouse?.name || (sale.isDirectSale ? 'Direct Sale' : '—') },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--accent)', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {(sale.customer?.name || sale.customer?.phone) && (
            <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)', marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--accent)', marginBottom: 4 }}>Customer</div>
              <div style={{ fontWeight: 500 }}>{sale.customer.name || 'Walk-in'}</div>
              {sale.customer.phone && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sale.customer.phone}</div>}
              {sale.customer.email && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sale.customer.email}</div>}
            </div>
          )}

          {/* Items table */}
          <div className="table-wrap" style={{ marginBottom: 20 }}>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th style={{ textAlign: 'center' }}>Unit</th>
                  <th style={{ textAlign: 'center' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Unit Price</th>
                  <th style={{ textAlign: 'center' }}>Disc %</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item, i) => (
                  <tr key={i}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{item.productName || item.product?.name || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{item.product?.sku || item.barcode || ''}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {item.sellingUnit === 'box' && <span className="badge badge-blue" style={{ fontSize: 10 }}>Box</span>}
                      {item.sellingUnit === 'loose' && <span className="badge badge-green" style={{ fontSize: 10 }}>Pcs</span>}
                      {!item.sellingUnit && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(item.unitPrice)}</td>
                    <td style={{ textAlign: 'center', color: item.discount > 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                      {item.discount > 0 ? `${item.discount}%` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ minWidth: 240, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {(sale.subtotal !== sale.grandTotal || sale.shippingCost > 0) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Subtotal</span><span>{fmt(sale.subtotal)}</span>
                </div>
              )}
              {sale.taxAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Tax</span><span>{fmt(sale.taxAmount)}</span>
                </div>
              )}
              {sale.discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Discount</span><span style={{ color: 'var(--red)' }}>-{fmt(sale.discountAmount)}</span>
                </div>
              )}
              {sale.shippingCost > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Shipping</span><span>+{fmt(sale.shippingCost)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 800, paddingTop: 8, borderTop: '2px solid var(--border)' }}>
                <span>Grand Total</span><span style={{ color: 'var(--green)' }}>{fmt(sale.grandTotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4 }}>
                <span style={{ color: 'var(--text-muted)' }}>Amount Paid</span><span style={{ fontWeight: 600 }}>{fmt(sale.amountPaid)}</span>
              </div>
              {sale.changeAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Change</span><span style={{ color: 'var(--accent)', fontWeight: 600 }}>{fmt(sale.changeAmount)}</span>
                </div>
              )}
            </div>
          </div>

          {sale.notes && (
            <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)' }}>
              <strong>Notes:</strong> {sale.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────
export default function SalesPage() {
  const [sales, setSales] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [storeSettings, setStoreSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const LIMIT = 25;

  const [detailSale, setDetailSale] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Stats
  const [stats, setStats] = useState({ count: 0, revenue: 0, refunded: 0, avgOrder: 0 });

  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: pg, limit: LIMIT });
      if (statusFilter) params.set('status', statusFilter);
      if (warehouseFilter) params.set('warehouse', warehouseFilter);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo + 'T23:59:59');

      const [s, w, st] = await Promise.all([
        api.get(`/pos?${params}`),
        api.get('/warehouses'),
        api.get('/settings'),
      ]);

      let data = s.data || [];

      // Client-side filter for payment method and search (server doesn't support these)
      if (paymentFilter) data = data.filter(s => s.paymentMethod === paymentFilter);
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        data = data.filter(s =>
          s.saleNumber?.toLowerCase().includes(q) ||
          s.customer?.name?.toLowerCase().includes(q) ||
          s.customer?.phone?.includes(q) ||
          s.soldBy?.name?.toLowerCase().includes(q)
        );
      }

      setSales(data);
      setTotal(s.total || 0);
      setWarehouses(w.data || []);
      setStoreSettings(st.data || {});
      setPage(pg);

      // Compute stats from current filtered data
      const completed = data.filter(s => s.status === 'completed');
      const revenue = completed.reduce((sum, s) => sum + (s.grandTotal || 0), 0);
      setStats({
        count: completed.length,
        revenue,
        refunded: data.filter(s => s.status === 'refunded').length,
        avgOrder: completed.length ? revenue / completed.length : 0,
      });
    } finally { setLoading(false); }
  }, [statusFilter, warehouseFilter, paymentFilter, searchQuery, dateFrom, dateTo]);

  useEffect(() => { load(1); }, [load]);

  const openDetail = async (id) => {
    try {
      const res = await api.get(`/pos/${id}`);
      setDetailSale(res.data);
    } catch { toast.error('Failed to load sale'); }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales</h1>
          <p className="page-subtitle">{total} total transactions</p>
        </div>
        <button className="btn btn-secondary" onClick={() => load(1)}><RefreshCw size={14} /></button>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { icon: ShoppingBag, label: 'Sales (filtered)', value: stats.count, color: 'var(--accent)', fmt: false },
          { icon: TrendingUp,  label: 'Revenue',          value: stats.revenue, color: 'var(--green)', fmt: true },
          { icon: Receipt,     label: 'Avg Order Value',  value: stats.avgOrder, color: 'var(--text)', fmt: true },
          { icon: Ban,         label: 'Refunded',         value: stats.refunded, color: 'var(--red)', fmt: false },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <s.icon size={20} color={s.color} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>
                {s.fmt ? fmt(s.value) : s.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card mb-16">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Search */}
          <div style={{ flex: '1 1 200px', minWidth: 180 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Search</div>
            <input className="form-input" placeholder="Sale #, customer, cashier…"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%' }} />
          </div>

          {/* Status */}
          <div style={{ minWidth: 140 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Status</div>
            <select className="form-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              {Object.entries(STATUS_META).map(([val, { label }]) => <option key={val} value={val}>{label}</option>)}
            </select>
          </div>

          {/* Payment method */}
          <div style={{ minWidth: 150 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Payment</div>
            <select className="form-input" value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}>
              <option value="">All Methods</option>
              {Object.entries(PAY_META).map(([val, { label }]) => <option key={val} value={val}>{label}</option>)}
            </select>
          </div>

          {/* Warehouse */}
          <div style={{ minWidth: 160 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Warehouse</div>
            <select className="form-input" value={warehouseFilter} onChange={e => setWarehouseFilter(e.target.value)}>
              <option value="">All Warehouses</option>
              {warehouses.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>

          {/* Date from */}
          <div style={{ minWidth: 140 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>From</div>
            <input className="form-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>

          {/* Date to */}
          <div style={{ minWidth: 140 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>To</div>
            <input className="form-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>

          {/* Quick date presets */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', paddingBottom: 1 }}>
            {[
              { label: 'Today', action: () => { const t = new Date().toISOString().slice(0,10); setDateFrom(t); setDateTo(t); } },
              { label: '7d',    action: () => { const t = new Date().toISOString().slice(0,10); const f = new Date(Date.now()-6*864e5).toISOString().slice(0,10); setDateFrom(f); setDateTo(t); } },
              { label: '30d',   action: () => { const t = new Date().toISOString().slice(0,10); const f = new Date(Date.now()-29*864e5).toISOString().slice(0,10); setDateFrom(f); setDateTo(t); } },
              { label: 'Clear', action: () => { setDateFrom(''); setDateTo(''); setStatusFilter(''); setPaymentFilter(''); setWarehouseFilter(''); setSearchQuery(''); } },
            ].map(p => (
              <button key={p.label} className="btn btn-secondary btn-sm" onClick={p.action}>{p.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" style={{ width: 28, height: 28 }} /></div>
        ) : sales.length === 0 ? (
          <div className="empty-state">
            <Receipt size={36} style={{ opacity: 0.3 }} />
            <p>No sales found</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Try adjusting the filters</p>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Sale #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Warehouse</th>
                    <th style={{ textAlign: 'center' }}>Items</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th>Payment</th>
                    <th>Cashier</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map(s => (
                    <tr key={s._id} style={{ cursor: 'pointer' }} onClick={() => openDetail(s._id)}>
                      <td>
                        <span className="text-mono" style={{ fontWeight: 600 }}>{s.saleNumber}</span>
                        {s.isDirectSale && <div><span className="badge badge-purple" style={{ fontSize: 9 }}>Direct</span></div>}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        <div>{format(new Date(s.createdAt), 'MMM d, yyyy')}</div>
                        <div style={{ fontSize: 11 }}>{format(new Date(s.createdAt), 'h:mm a')}</div>
                      </td>
                      <td>
                        {s.customer?.name
                          ? <><div style={{ fontWeight: 500 }}>{s.customer.name}</div>
                              {s.customer.phone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.customer.phone}</div>}</>
                          : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Walk-in</span>}
                      </td>
                      <td style={{ fontSize: 13 }}>{s.warehouse?.name || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="text-mono">{s.items?.length || 0}</span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: s.status === 'refunded' ? 'var(--red)' : 'var(--green)' }}>
                        {fmt(s.grandTotal)}
                      </td>
                      <td>
                        <span className={`badge ${PAY_META[s.paymentMethod]?.cls || 'badge-gray'}`}>
                          {PAY_META[s.paymentMethod]?.label || s.paymentMethod}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.soldBy?.name || '—'}</td>
                      <td><span className={`badge ${STATUS_META[s.status]?.cls || 'badge-gray'}`}>{STATUS_META[s.status]?.label || s.status}</span></td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-icon" title="View" onClick={() => openDetail(s._id)}><Eye size={14} /></button>
                          <button className="btn btn-ghost btn-icon" title="Print" onClick={() => printReceipt(s, storeSettings)}><Printer size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0 0', borderTop: '1px solid var(--border)', marginTop: 8 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Page {page} of {totalPages} — {total} total
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => load(page - 1)}>← Prev</button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
                    return (
                      <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}`} onClick={() => load(p)}>{p}</button>
                    );
                  })}
                  <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => load(page + 1)}>Next →</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {detailSale && (
        <SaleDetailModal
          sale={detailSale}
          store={storeSettings}
          isAdmin={isAdmin}
          onClose={() => setDetailSale(null)}
          onRefund={() => { setDetailSale(null); load(page); }}
        />
      )}
    </div>
  );
}
