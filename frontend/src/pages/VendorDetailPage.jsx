import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api.js';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Plus, RefreshCw, TruckIcon, Wallet, Clock, CheckCircle,
  CreditCard, Banknote, Building2, Star, Edit2, Phone, Mail, MapPin,
} from 'lucide-react';
import { format } from 'date-fns';

const fmt = (n) => `Rs ${(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PO_STATUS = {
  draft:       { label: 'Draft',       cls: 'badge-gray'   },
  ordered:     { label: 'Ordered',     cls: 'badge-blue'   },
  partial:     { label: 'Partial',     cls: 'badge-yellow' },
  received:    { label: 'Received',    cls: 'badge-green'  },
  cancelled:   { label: 'Cancelled',   cls: 'badge-red'    },
  direct_sale: { label: 'Direct Sale', cls: 'badge-purple' },
};

const PO_PAY_TERMS = {
  credit:   { label: 'Credit',   cls: 'badge-yellow' },
  prepaid:  { label: 'Prepaid',  cls: 'badge-green'  },
  partial:  { label: 'Partial',  cls: 'badge-blue'   },
};

const PAY_METHOD = {
  cash:          { label: 'Cash',          icon: Banknote,  cls: 'badge-green' },
  cheque:        { label: 'Cheque',        icon: CreditCard, cls: 'badge-yellow' },
  bank_transfer: { label: 'Bank Transfer', icon: Building2, cls: 'badge-blue'  },
  online:        { label: 'Online',        icon: CreditCard, cls: 'badge-purple' },
};

// ─── Record Payment Modal ────────────────────────────────
function RecordPaymentModal({ vendor, orders, onClose, onSave }) {
  const [form, setForm] = useState({
    amount: '',
    method: 'cash',
    referenceNumber: '',
    notes: '',
    date: new Date().toISOString().slice(0, 10),
    purchaseOrderId: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const pendingBalance = vendor.balance || 0;
  const unpaidOrders = orders.filter(o => o.paymentStatus !== 'paid' && o.status !== 'cancelled');
  const selectedPO = unpaidOrders.find(o => o._id === form.purchaseOrderId);
  const maxForPO = selectedPO ? Math.max(0, selectedPO.grandTotal - (selectedPO.paidAmount || 0)) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) return toast.error('Enter a valid amount');
    setSaving(true);
    try {
      await api.post(`/vendors/${vendor._id}/payments`, {
        ...form,
        amount: Number(form.amount),
        purchaseOrderId: form.purchaseOrderId || undefined,
      });
      toast.success('Payment recorded');
      onSave();
    } catch (err) { toast.error(err?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const needsRef = ['cheque', 'bank_transfer', 'online'].includes(form.method);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2 className="modal-title">Record Payment to {vendor.name}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Balance reminder */}
          {pendingBalance > 0 && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13 }}>
              <span style={{ color: 'var(--red)', fontWeight: 700 }}>Outstanding balance: {fmt(pendingBalance)}</span>
            </div>
          )}

          {/* Link to a PO (optional) */}
          <div className="form-group">
            <label className="form-label">Link to Purchase Order <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
            <select className="form-input" value={form.purchaseOrderId} onChange={e => { set('purchaseOrderId', e.target.value); if (e.target.value) { const po = unpaidOrders.find(o => o._id === e.target.value); if (po) set('amount', String(Math.max(0, po.grandTotal - (po.paidAmount || 0)).toFixed(2))); } }}>
              <option value="">General payment (not PO-specific)</option>
              {unpaidOrders.map(o => (
                <option key={o._id} value={o._id}>
                  {o.poNumber} — {fmt(o.grandTotal - (o.paidAmount || 0))} remaining ({PO_STATUS[o.status]?.label})
                </option>
              ))}
            </select>
            {selectedPO && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                PO Total: {fmt(selectedPO.grandTotal)} · Paid: {fmt(selectedPO.paidAmount || 0)} · Remaining: {fmt(maxForPO)}
              </div>
            )}
          </div>

          {/* Amount */}
          <div className="form-group">
            <label className="form-label">Amount (Rs) *</label>
            <input className="form-input" type="number" step="0.01" min="0.01"
              value={form.amount} onChange={e => set('amount', e.target.value)} required />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {pendingBalance > 0 && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => set('amount', pendingBalance.toFixed(2))}>
                  Full Balance ({fmt(pendingBalance)})
                </button>
              )}
              {maxForPO > 0 && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => set('amount', maxForPO.toFixed(2))}>
                  PO Remaining ({fmt(maxForPO)})
                </button>
              )}
            </div>
          </div>

          {/* Method */}
          <div className="form-group">
            <label className="form-label">Payment Method *</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {Object.entries(PAY_METHOD).map(([val, { label, icon: Icon }]) => (
                <button key={val} type="button" onClick={() => set('method', val)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, cursor: 'pointer',
                    border: `1.5px solid ${form.method === val ? 'var(--accent)' : 'var(--border)'}`,
                    background: form.method === val ? 'var(--accent)12' : 'var(--bg-elevated)',
                    color: form.method === val ? 'var(--accent)' : 'var(--text-muted)',
                    fontWeight: form.method === val ? 700 : 400, fontSize: 13 }}>
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>
          </div>

          {/* Reference number for cheque/bank */}
          {needsRef && (
            <div className="form-group">
              <label className="form-label">
                {form.method === 'cheque' ? 'Cheque Number' : 'Reference / Transaction ID'}
              </label>
              <input className="form-input" placeholder={form.method === 'cheque' ? 'Cheque #' : 'Bank ref / TXN ID'}
                value={form.referenceNumber} onChange={e => set('referenceNumber', e.target.value)} />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Payment Date</label>
              <input className="form-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-input" placeholder="Optional notes" value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>

          <div className="modal-footer" style={{ margin: 0, padding: 0, border: 'none' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : `Record ${form.amount ? fmt(Number(form.amount)) : ''} Payment`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Vendor Modal ───────────────────────────────────
function EditVendorModal({ vendor, onClose, onSave }) {
  const [form, setForm] = useState({ ...vendor });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setAddr = (k, v) => setForm(p => ({ ...p, address: { ...p.address, [k]: v } }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/vendors/${vendor._id}`, form);
      toast.success('Vendor updated');
      onSave();
    } catch (err) { toast.error(err?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h2 className="modal-title">Edit Vendor</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid form-grid-2" style={{ gap: 12 }}>
            <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} required /></div>
            <div className="form-group"><label className="form-label">Company</label><input className="form-input" value={form.company || ''} onChange={e => set('company', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.phone || ''} onChange={e => set('phone', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Tax ID</label><input className="form-input" value={form.taxId || ''} onChange={e => set('taxId', e.target.value)} /></div>
            <div className="form-group">
              <label className="form-label">Payment Terms</label>
              <select className="form-input" value={form.paymentTerms} onChange={e => set('paymentTerms', e.target.value)}>
                {['NET7', 'NET15', 'NET30', 'NET45', 'NET60', 'COD', 'Prepaid'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Credit Limit (Rs)</label><input className="form-input" type="number" value={form.creditLimit || 0} onChange={e => set('creditLimit', +e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Rating (1-5)</label><input className="form-input" type="number" min="1" max="5" value={form.rating || 3} onChange={e => set('rating', +e.target.value)} /></div>
            <div className="form-group"><label className="form-label">City</label><input className="form-input" value={form.address?.city || ''} onChange={e => setAddr('city', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Country</label><input className="form-input" value={form.address?.country || ''} onChange={e => setAddr('country', e.target.value)} /></div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Notes</label><textarea className="form-input" rows={2} value={form.notes || ''} onChange={e => set('notes', e.target.value)} /></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <span className="spinner" /> : 'Update Vendor'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────
export default function VendorDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('orders');
  const [showPayment, setShowPayment] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get(`/vendors/${id}/detail?${params}`);
      setData(res.data);
    } catch { toast.error('Failed to load vendor details'); }
    finally { setLoading(false); }
  }, [id, dateFrom, dateTo, statusFilter]);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>
  );
  if (!data) return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Vendor not found.</div>;

  const { vendor, orders, payments, stats } = data;

  const fmtDate = (d) => d ? format(new Date(d), 'MMM d, yyyy') : '—';

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/vendors')}><ArrowLeft size={18} /></button>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>{vendor.name}</h1>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{vendor.company}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowEdit(true)}><Edit2 size={14} /> Edit</button>
          <button className="btn btn-primary" onClick={() => setShowPayment(true)}><Plus size={14} /> Record Payment</button>
          <button className="btn btn-secondary" onClick={load}><RefreshCw size={14} /></button>
        </div>
      </div>

      {/* Vendor info card */}
      <div className="card mb-16" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          {vendor.phone && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Phone size={14} color="var(--text-muted)" />
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{vendor.phone}</div>
              </div>
            </div>
          )}
          {vendor.email && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Mail size={14} color="var(--text-muted)" />
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{vendor.email}</div>
              </div>
            </div>
          )}
          {(vendor.address?.city || vendor.address?.country) && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <MapPin size={14} color="var(--text-muted)" />
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Location</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{[vendor.address?.city, vendor.address?.country].filter(Boolean).join(', ')}</div>
              </div>
            </div>
          )}
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Terms</div>
            <span className="badge badge-blue" style={{ marginTop: 4 }}>{vendor.paymentTerms}</span>
          </div>
          {vendor.taxId && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tax ID</div>
              <div style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{vendor.taxId}</div>
            </div>
          )}
          {vendor.creditLimit > 0 && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Credit Limit</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{fmt(vendor.creditLimit)}</div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} size={14} fill={i < (vendor.rating || 0) ? 'var(--yellow, #f59e0b)' : 'none'} color={i < (vendor.rating || 0) ? 'var(--yellow, #f59e0b)' : 'var(--border)'} />
            ))}
          </div>
        </div>
        {vendor.notes && <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text-muted)' }}>{vendor.notes}</div>}
      </div>

      {/* Stats strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { icon: TruckIcon, label: 'Total Orders', value: stats.totalOrders, fmt: false, color: 'var(--accent)' },
          { icon: Wallet,    label: 'Total Business', value: stats.totalValue, fmt: true, color: 'var(--text)' },
          { icon: CheckCircle, label: 'Total Paid', value: stats.totalPaid, fmt: true, color: 'var(--green)' },
          { icon: Clock,     label: 'Pending Balance', value: stats.pendingBalance, fmt: true, color: stats.pendingBalance > 0 ? 'var(--red)' : 'var(--green)' },
          { icon: TruckIcon, label: 'Pending Deliveries', value: stats.pendingDeliveries, fmt: false, color: stats.pendingDeliveries > 0 ? 'var(--yellow, #f59e0b)' : 'var(--text-muted)' },
          { icon: Wallet,    label: 'Delivery Value Due', value: stats.pendingDeliveriesValue, fmt: true, color: 'var(--text-muted)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <s.icon size={18} color={s.color} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 1 }}>{s.label}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: s.color, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                {s.fmt ? fmt(s.value) : s.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        {[['orders', `Purchase Orders (${orders.length})`], ['payments', `Payment History (${payments.length})`]].map(([val, label]) => (
          <button key={val} onClick={() => setTab(val)}
            style={{ padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              color: tab === val ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: tab === val ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: -1 }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Orders Tab ── */}
      {tab === 'orders' && (
        <>
          {/* Filters */}
          <div className="card mb-16">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ minWidth: 150 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Status</div>
                <select className="form-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                  <option value="">All Status</option>
                  {Object.entries(PO_STATUS).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
                </select>
              </div>
              <div style={{ minWidth: 140 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>From</div>
                <input className="form-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div style={{ minWidth: 140 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>To</div>
                <input className="form-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 6, paddingBottom: 1 }}>
                {[
                  { label: 'This month', action: () => { const now = new Date(); setDateFrom(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10)); setDateTo(now.toISOString().slice(0,10)); } },
                  { label: 'Clear', action: () => { setDateFrom(''); setDateTo(''); setStatusFilter(''); } },
                ].map(p => <button key={p.label} className="btn btn-secondary btn-sm" onClick={p.action}>{p.label}</button>)}
              </div>
            </div>
          </div>

          <div className="card">
            {orders.length === 0 ? (
              <div className="empty-state"><TruckIcon /><p>No orders found</p></div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>PO Number</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Payment Terms</th>
                      <th style={{ textAlign: 'center' }}>Items</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                      <th style={{ textAlign: 'right' }}>Advance</th>
                      <th style={{ textAlign: 'right' }}>Paid</th>
                      <th style={{ textAlign: 'right' }}>Remaining</th>
                      <th>Expected</th>
                      <th>Warehouse</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(o => {
                      const remaining = Math.max(0, (o.grandTotal || 0) - (o.paidAmount || 0));
                      return (
                        <tr key={o._id}>
                          <td><span className="text-mono" style={{ fontWeight: 600 }}>{o.poNumber}</span></td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(o.createdAt)}</td>
                          <td><span className={`badge ${PO_STATUS[o.status]?.cls}`}>{PO_STATUS[o.status]?.label || o.status}</span></td>
                          <td>
                            {o.poPaymentTerms
                              ? <span className={`badge ${PO_PAY_TERMS[o.poPaymentTerms]?.cls}`}>{PO_PAY_TERMS[o.poPaymentTerms]?.label}</span>
                              : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>}
                          </td>
                          <td style={{ textAlign: 'center' }}>{o.items?.length || 0}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(o.grandTotal)}</td>
                          <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{o.advanceAmount > 0 ? fmt(o.advanceAmount) : '—'}</td>
                          <td style={{ textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>{fmt(o.paidAmount || 0)}</td>
                          <td style={{ textAlign: 'right', color: remaining > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
                            {remaining > 0 ? fmt(remaining) : <span style={{ color: 'var(--green)', fontSize: 11 }}>✓ Paid</span>}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.expectedDate ? fmtDate(o.expectedDate) : '—'}</td>
                          <td style={{ fontSize: 12 }}>{o.warehouse?.name || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Orders summary footer */}
            {orders.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 32, padding: '12px 16px', borderTop: '1px solid var(--border)', marginTop: 8 }}>
                {[
                  { label: 'Total Value', value: orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.grandTotal || 0), 0) },
                  { label: 'Total Paid', value: orders.reduce((s, o) => s + (o.paidAmount || 0), 0), color: 'var(--green)' },
                  { label: 'Total Remaining', value: orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + Math.max(0, (o.grandTotal || 0) - (o.paidAmount || 0)), 0), color: 'var(--red)' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: s.color || 'var(--text)' }}>{fmt(s.value)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Payments Tab ── */}
      {tab === 'payments' && (
        <div className="card">
          {payments.length === 0 ? (
            <div className="empty-state">
              <Wallet />
              <p>No payments recorded yet</p>
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowPayment(true)}>
                <Plus size={14} /> Record First Payment
              </button>
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th>Method</th>
                      <th>Reference</th>
                      <th>Purchase Order</th>
                      <th>Recorded By</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(p => {
                      const meta = PAY_METHOD[p.method];
                      return (
                        <tr key={p._id}>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(p.date)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--green)', fontSize: 15 }}>{fmt(p.amount)}</td>
                          <td>
                            <span className={`badge ${meta?.cls || 'badge-gray'}`}>
                              {meta?.label || p.method}
                            </span>
                          </td>
                          <td style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                            {p.referenceNumber || '—'}
                          </td>
                          <td>
                            {p.purchaseOrder
                              ? <span className="text-mono" style={{ fontSize: 12, color: 'var(--accent)' }}>{p.purchaseOrder.poNumber}</span>
                              : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>General</span>}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.recordedBy?.name || '—'}</td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 200 }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.notes || '—'}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Payments summary */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border)', marginTop: 8 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {payments.length} payment{payments.length !== 1 ? 's' : ''} recorded
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Paid to Vendor</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)' }}>{fmt(payments.reduce((s, p) => s + (p.amount || 0), 0))}</div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {showPayment && (
        <RecordPaymentModal
          vendor={vendor}
          orders={orders}
          onClose={() => setShowPayment(false)}
          onSave={() => { setShowPayment(false); load(); }}
        />
      )}
      {showEdit && (
        <EditVendorModal
          vendor={vendor}
          onClose={() => setShowEdit(false)}
          onSave={() => { setShowEdit(false); load(); }}
        />
      )}
    </div>
  );
}
