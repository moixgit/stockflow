import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api.js';
import toast from 'react-hot-toast';
import { Plus, RefreshCw, ClipboardCheck, Eye, CheckCircle, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '../store/authStore.js';

const STATUS_META = {
  draft:     { label: 'Draft',     cls: 'badge-gray'   },
  submitted: { label: 'Submitted', cls: 'badge-yellow' },
  verified:  { label: 'Verified',  cls: 'badge-green'  },
};

// ─── Create Inspection Modal ─────────────────────────────
function CreateInspectionModal({ warehouses, onClose, onSave }) {
  const [warehouseId, setWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!warehouseId) return toast.error('Select a warehouse');
    setSaving(true);
    try {
      const res = await api.post('/inspections', { warehouseId, notes });
      toast.success(`Inspection ${res.data.inspectionNumber} created`);
      onSave(res.data);
    } catch (err) { toast.error(err?.message || 'Failed to create inspection'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2 className="modal-title">Start New Inspection</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: '12px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 13, color: '#1e40af' }}>
            The system will load current stock levels as expected quantities. You fill in what you actually count.
          </div>
          <div className="form-group">
            <label className="form-label">Warehouse *</label>
            <select className="form-input" value={warehouseId} onChange={e => setWarehouseId(e.target.value)} required>
              <option value="">Select warehouse</option>
              {warehouses.map(w => <option key={w._id} value={w._id}>{w.name} ({w.code})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Reason for inspection..." />
          </div>
          <div className="modal-footer" style={{ margin: 0, padding: 0, border: 'none' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : 'Start Inspection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Inspection Detail Modal ──────────────────────────────
function InspectionDetailModal({ inspection: init, onClose, onRefresh, isAdmin }) {
  const [inspection, setInspection] = useState(init);
  const [items, setItems] = useState(
    () => init.items.map(i => ({
      _id: i._id,
      product: i.product,
      expectedQty: i.expectedQty,
      expectedLooseQty: i.expectedLooseQty,
      actualQty: i.actualQty ?? '',
      actualLooseQty: i.actualLooseQty ?? '',
      discrepancyType: i.discrepancyType || '',
      notes: i.notes || '',
    }))
  );
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [filter, setFilter] = useState('all');

  const locked = inspection.status === 'verified';
  const canSubmit = inspection.status === 'draft';
  const canVerify = inspection.status === 'submitted' && isAdmin;

  const updateItem = (id, key, val) => {
    setItems(prev => prev.map(i => i._id === id ? { ...i, [key]: val } : i));
  };

  const discrepancyQty = (item) => {
    const aqty = item.actualQty === '' ? null : Number(item.actualQty);
    if (aqty === null) return null;
    const boxDiff = aqty - item.expectedQty;
    const isBox = item.product?.productType === 'box';
    const looseActual = item.actualLooseQty === '' ? item.expectedLooseQty : Number(item.actualLooseQty);
    const looseDiff = isBox ? looseActual - item.expectedLooseQty : 0;
    return { boxDiff, looseDiff, hasShortage: boxDiff < 0 || looseDiff < 0, hasSurplus: boxDiff > 0 || looseDiff > 0 };
  };

  const visibleItems = items.filter(item => {
    if (filter === 'all') return true;
    const d = discrepancyQty(item);
    if (filter === 'shortage') return d && d.hasShortage;
    if (filter === 'surplus') return d && d.hasSurplus;
    if (filter === 'ok') return d && !d.hasShortage && !d.hasSurplus && item.actualQty !== '';
    if (filter === 'pending') return item.actualQty === '';
    return true;
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.put(`/inspections/${inspection._id}`, { items });
      setInspection(res.data);
      toast.success('Progress saved');
      onRefresh();
    } catch (err) { toast.error(err?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await api.put(`/inspections/${inspection._id}`, { items });
      const res = await api.post(`/inspections/${inspection._id}/submit`);
      setInspection(res.data);
      toast.success('Inspection submitted for verification');
      onRefresh();
    } catch (err) { toast.error(err?.message || 'Failed to submit'); }
    finally { setSubmitting(false); }
  };

  const handleVerify = async () => {
    if (!window.confirm('Verify this inspection? Inventory will be adjusted to actual counts and discrepancies will be logged.')) return;
    setVerifying(true);
    try {
      const res = await api.post(`/inspections/${inspection._id}/verify`);
      setInspection(res.data);
      toast.success('Inspection verified — inventory adjusted');
      onRefresh();
    } catch (err) { toast.error(err?.message || 'Failed to verify'); }
    finally { setVerifying(false); }
  };

  const filled = items.filter(i => i.actualQty !== '').length;
  const shortages = items.filter(i => { const d = discrepancyQty(i); return d && d.hasShortage; });

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg" style={{ maxWidth: 980, maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-header" style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
          <div>
            <h2 className="modal-title" style={{ margin: 0 }}>{inspection.inspectionNumber}</h2>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <span className={`badge ${STATUS_META[inspection.status]?.cls}`}>{STATUS_META[inspection.status]?.label}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{inspection.warehouse?.name}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!locked && <button className="btn btn-secondary" onClick={handleSave} disabled={saving}>{saving ? <span className="spinner" /> : 'Save Progress'}</button>}
            {canSubmit && <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || filled === 0}>{submitting ? <span className="spinner" /> : 'Submit for Verification'}</button>}
            {canVerify && (
              <button className="btn btn-primary" style={{ background: 'var(--green)', borderColor: 'var(--green)' }} onClick={handleVerify} disabled={verifying}>
                <CheckCircle size={14} /> {verifying ? 'Verifying…' : 'Verify & Adjust Inventory'}
              </button>
            )}
            <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
          </div>
        </div>

        <div style={{ padding: '16px 24px' }}>
          {/* Summary strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Total Items', value: items.length },
              { label: 'Counted', value: filled, color: 'var(--accent)' },
              { label: 'Shortages', value: shortages.length, color: shortages.length > 0 ? 'var(--red)' : 'var(--green)' },
              { label: 'Remaining', value: items.length - filled, color: items.length - filled > 0 ? 'var(--yellow, #f59e0b)' : 'var(--green)' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color || 'var(--text)' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 14 }}>
            {[['all', 'All'], ['pending', 'Not Counted'], ['shortage', 'Shortages'], ['surplus', 'Surplus'], ['ok', 'Match']].map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)}
                style={{ padding: '7px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  color: filter === val ? 'var(--accent)' : 'var(--text-muted)',
                  borderBottom: filter === val ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: -1 }}>
                {label}
              </button>
            ))}
          </div>

          {inspection.status === 'verified' && (
            <div style={{ marginBottom: 14, padding: '10px 14px', background: '#d1fae520', border: '1px solid var(--green)', borderRadius: 8, fontSize: 13, color: 'var(--green)', fontWeight: 600 }}>
              ✓ This inspection has been verified. Inventory was adjusted and discrepancies were logged.
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)' }}>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Product</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Expected (boxes)</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Expected (loose)</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>Actual (boxes)</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>Actual (loose)</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Discrepancy</th>
                {!locked && <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, color: 'var(--red)', fontWeight: 600 }}>Type</th>}
                <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map(item => {
                const isBox = item.product?.productType === 'box';
                const d = discrepancyQty(item);
                const rowColor = !d ? 'transparent' : d.hasShortage ? '#fef2f240' : d.hasSurplus ? '#f0fdf440' : 'transparent';
                return (
                  <tr key={item._id} style={{ borderBottom: '1px solid var(--border)', background: rowColor }}>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{item.product?.name || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {item.product?.sku}
                        {isBox && <span style={{ marginLeft: 6, background: 'var(--accent)20', color: 'var(--accent)', padding: '1px 5px', borderRadius: 4, fontWeight: 700, fontSize: 10 }}>BOX·{item.product.piecesPerBox}pcs</span>}
                      </div>
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>{item.expectedQty}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>{isBox ? item.expectedLooseQty : '—'}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      {locked ? (
                        <span style={{ color: d?.hasShortage ? 'var(--red)' : d?.hasSurplus ? 'var(--green)' : 'var(--text)' }}>{item.actualQty !== '' ? item.actualQty : '—'}</span>
                      ) : (
                        <input type="number" min="0" className="form-input"
                          style={{ width: 72, textAlign: 'center', padding: '4px 6px', fontSize: 13 }}
                          placeholder={String(item.expectedQty)}
                          value={item.actualQty}
                          onChange={e => updateItem(item._id, 'actualQty', e.target.value)} />
                      )}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      {!isBox ? <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                        : locked ? (
                          <span style={{ color: 'var(--text-muted)' }}>{item.actualLooseQty !== '' ? item.actualLooseQty : '—'}</span>
                        ) : (
                          <input type="number" min="0" className="form-input"
                            style={{ width: 72, textAlign: 'center', padding: '4px 6px', fontSize: 13 }}
                            placeholder={String(item.expectedLooseQty)}
                            value={item.actualLooseQty}
                            onChange={e => updateItem(item._id, 'actualLooseQty', e.target.value)} />
                        )}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      {!d ? <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span> : (
                        <div>
                          {d.boxDiff !== 0 && (
                            <div style={{ fontWeight: 700, fontSize: 13, color: d.boxDiff < 0 ? 'var(--red)' : 'var(--green)' }}>
                              {d.boxDiff > 0 ? '+' : ''}{d.boxDiff} {isBox ? 'box' : 'pcs'}
                            </div>
                          )}
                          {isBox && d.looseDiff !== 0 && (
                            <div style={{ fontWeight: 600, fontSize: 11, color: d.looseDiff < 0 ? 'var(--red)' : 'var(--green)' }}>
                              {d.looseDiff > 0 ? '+' : ''}{d.looseDiff} loose
                            </div>
                          )}
                          {d.boxDiff === 0 && (!isBox || d.looseDiff === 0) && (
                            <span style={{ color: 'var(--green)', fontSize: 12 }}>✓ Match</span>
                          )}
                        </div>
                      )}
                    </td>
                    {!locked && (
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        {d && d.hasShortage ? (
                          <select className="form-input" style={{ padding: '4px 6px', fontSize: 12, width: 100 }}
                            value={item.discrepancyType}
                            onChange={e => updateItem(item._id, 'discrepancyType', e.target.value)}>
                            <option value="">Select…</option>
                            <option value="broken">Broken</option>
                            <option value="missing">Missing</option>
                          </select>
                        ) : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}
                      </td>
                    )}
                    <td style={{ padding: '6px 8px' }}>
                      {locked ? (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.notes || '—'}</span>
                      ) : (
                        <input type="text" className="form-input" style={{ padding: '4px 6px', fontSize: 12 }}
                          placeholder="Notes…" value={item.notes}
                          onChange={e => updateItem(item._id, 'notes', e.target.value)} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {visibleItems.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No items match this filter</div>
          )}

          {inspection.verifiedBy && (
            <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              Verified by <strong>{inspection.verifiedBy?.name}</strong> on {inspection.verifiedAt ? format(new Date(inspection.verifiedAt), 'MMM d, yyyy h:mm a') : '—'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────
export default function InspectionPage() {
  const [inspections, setInspections] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [detailInspection, setDetailInspection] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const { user } = useAuthStore();

  const isAdmin = user?.role === 'admin';
  const canCreate = ['admin', 'inventory_manager'].includes(user?.role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const [ins, whs] = await Promise.all([
        api.get(`/inspections?${params}`),
        api.get('/warehouses'),
      ]);
      setInspections(ins.data || []);
      setWarehouses(whs.data || []);
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id) => {
    try {
      const res = await api.get(`/inspections/${id}`);
      setDetailInspection(res.data);
    } catch { toast.error('Failed to load inspection'); }
  };

  const deleteInspection = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this draft inspection?')) return;
    try {
      await api.delete(`/inspections/${id}`);
      toast.success('Inspection deleted');
      load();
    } catch (err) { toast.error(err?.message || 'Failed to delete'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory Inspections</h1>
          <p className="page-subtitle">Stock count verification — compare expected vs actual</p>
        </div>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> New Inspection
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Total Inspections', value: inspections.length },
          { label: 'Pending Verification', value: inspections.filter(i => i.status === 'submitted').length, color: 'var(--yellow, #f59e0b)' },
          { label: 'Verified', value: inspections.filter(i => i.status === 'verified').length, color: 'var(--green)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color || 'var(--text)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card mb-16">
        <div style={{ display: 'flex', gap: 12 }}>
          <select className="form-input" style={{ width: 180 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            {Object.entries(STATUS_META).map(([val, { label }]) => <option key={val} value={val}>{label}</option>)}
          </select>
          <button className="btn btn-secondary" onClick={load}><RefreshCw size={14} /></button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" style={{ width: 28, height: 28 }} /></div>
        ) : inspections.length === 0 ? (
          <div className="empty-state">
            <ClipboardCheck />
            <p>No inspections yet</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Start an inspection to compare expected vs actual stock</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Inspection #</th>
                  <th>Warehouse</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Items</th>
                  <th>Performed By</th>
                  <th>Verified By</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {inspections.map(ins => (
                  <tr key={ins._id} style={{ cursor: 'pointer' }} onClick={() => openDetail(ins._id)}>
                    <td><span className="text-mono" style={{ fontWeight: 600 }}>{ins.inspectionNumber}</span></td>
                    <td>{ins.warehouse?.name} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({ins.warehouse?.code})</span></td>
                    <td><span className={`badge ${STATUS_META[ins.status]?.cls}`}>{STATUS_META[ins.status]?.label}</span></td>
                    <td style={{ textAlign: 'center' }}><span className="text-mono">{ins.items?.length || 0}</span></td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{ins.performedBy?.name || '—'}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{ins.verifiedBy?.name || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{format(new Date(ins.createdAt), 'MMM d, yyyy')}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-icon" title="Open" onClick={() => openDetail(ins._id)}><Eye size={14} /></button>
                        {ins.status === 'draft' && canCreate && (
                          <button className="btn btn-ghost btn-icon" title="Delete" style={{ color: 'var(--red)' }} onClick={e => deleteInspection(ins._id, e)}>✕</button>
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

      {showCreate && (
        <CreateInspectionModal
          warehouses={warehouses}
          onClose={() => setShowCreate(false)}
          onSave={(ins) => { setShowCreate(false); load(); openDetail(ins._id); }}
        />
      )}

      {detailInspection && (
        <InspectionDetailModal
          inspection={detailInspection}
          isAdmin={isAdmin}
          onClose={() => setDetailInspection(null)}
          onRefresh={load}
        />
      )}
    </div>
  );
}
