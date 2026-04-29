import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api.js';
import toast from 'react-hot-toast';
import { Plus, RefreshCw, AlertTriangle, Package, Search, X, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';

const SOURCE_LABELS = { shipping: 'Shipping', handling: 'Handling', storage: 'Storage', inspection: 'Inspection', other: 'Other' };
const SOURCE_COLORS = { shipping: 'badge-red', handling: 'badge-yellow', storage: 'badge-yellow', inspection: 'badge-blue', other: 'badge-gray' };
const STATUS_COLORS = { pending: 'badge-yellow', confirmed: 'badge-red', resolved: 'badge-green' };
const TYPE_META = { broken: { cls: 'badge-red', label: 'Broken' }, missing: { cls: 'badge-purple', label: 'Missing' } };

function ProductSearch({ products, value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef();
  const inputRef = useRef();

  useEffect(() => {
    const handler = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = products.filter(p => {
    if (!query) return true;
    const q = query.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q);
  }).slice(0, 40);

  const select = (p) => { onChange(p); setQuery(''); setOpen(false); };
  const clear = (e) => { e.stopPropagation(); onChange(null); setQuery(''); setTimeout(() => inputRef.current?.focus(), 0); };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {value ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent)', background: 'var(--bg-elevated)' }}>
          <Package size={14} color="var(--accent)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{value.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {value.sku}{value.productType === 'box' ? ` · Box (${value.piecesPerBox} pcs/box)` : ''}
            </div>
          </div>
          <button type="button" onClick={clear} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}><X size={14} /></button>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input ref={inputRef} className="form-input" style={{ paddingLeft: 32 }} placeholder="Search by name or SKU..."
            value={query} onChange={e => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} autoComplete="off" />
        </div>
      )}
      {open && !value && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', maxHeight: 260, overflowY: 'auto' }}>
          {filtered.length === 0
            ? <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No products found</div>
            : filtered.map(p => (
              <button key={p._id} type="button" onClick={() => select(p)}
                style={{ width: '100%', display: 'flex', gap: 10, padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {p.sku}{p.productType === 'box' ? ` · Box/${p.piecesPerBox}pcs` : ''}
                  </div>
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

function RecordModal({ warehouses, onClose, onSave }) {
  const [allProducts, setAllProducts] = useState([]);
  const [product, setProduct] = useState(null);
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?._id || '');
  const [type, setType] = useState('broken');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('pieces');
  const [savedPieces, setSavedPieces] = useState('');
  const [source, setSource] = useState('other');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const isBox = product?.productType === 'box';
  const piecesPerBox = product?.piecesPerBox || 1;
  const showSavedPieces = isBox && unit === 'boxes' && type === 'broken';

  // Live preview for box breakage
  const boxQty = Number(quantity) || 0;
  const savedPcsNum = Number(savedPieces) || 0;
  const totalPcsInBoxes = boxQty * piecesPerBox;
  const brokenPcs = totalPcsInBoxes - savedPcsNum;

  useEffect(() => { api.get('/products?limit=500').then(r => setAllProducts(r.data || [])).catch(() => {}); }, []);

  // Reset saved pieces when unit changes away from boxes
  useEffect(() => { if (unit !== 'boxes') setSavedPieces(''); }, [unit]);
  useEffect(() => { if (!isBox) setUnit('pieces'); }, [isBox]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!product) return toast.error('Select a product');
    if (!warehouseId) return toast.error('Select a warehouse');
    if (showSavedPieces && savedPcsNum > totalPcsInBoxes)
      return toast.error(`Saved pieces (${savedPcsNum}) cannot exceed total pieces in broken boxes (${totalPcsInBoxes})`);
    setSaving(true);
    try {
      await api.post('/breakages', {
        productId: product._id, warehouseId,
        quantity: +quantity, unit, type, source, notes, date,
        savedPieces: showSavedPieces ? savedPcsNum : 0,
      });
      toast.success(`${type === 'missing' ? 'Missing item' : 'Breakage'} recorded`);
      onSave();
    } catch (err) { toast.error(err?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <h2 className="modal-title">Record Broken / Missing Item</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Type toggle */}
          <div className="form-group">
            <label className="form-label">Record Type *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['broken', '🔴 Broken / Damaged'], ['missing', '🟣 Missing / Lost']].map(([val, label]) => (
                <button key={val} type="button" onClick={() => setType(val)}
                  style={{ flex: 1, padding: '8px', borderRadius: 6, border: `1.5px solid ${type === val ? (val === 'broken' ? 'var(--red)' : 'var(--accent)') : 'var(--border)'}`,
                    background: type === val ? (val === 'broken' ? '#ef444418' : 'var(--accent)15') : 'var(--bg-elevated)',
                    color: type === val ? (val === 'broken' ? 'var(--red)' : 'var(--accent)') : 'var(--text-muted)',
                    fontWeight: type === val ? 700 : 400, cursor: 'pointer', fontSize: 13 }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Product *</label>
            <ProductSearch products={allProducts} value={product} onChange={p => { setProduct(p); setQuantity(''); setSavedPieces(''); }} />
          </div>

          <div className="form-group">
            <label className="form-label">Warehouse *</label>
            <select className="form-input" value={warehouseId} onChange={e => setWarehouseId(e.target.value)} required>
              <option value="">Select warehouse</option>
              {warehouses.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>

          {isBox && (
            <div className="form-group">
              <label className="form-label">Unit</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['boxes', 'Whole Boxes'], ['pieces', 'Individual Pieces']].map(([val, label]) => (
                  <button key={val} type="button" onClick={() => setUnit(val)}
                    style={{ flex: 1, padding: '7px', borderRadius: 6, border: `1px solid ${unit === val ? 'var(--red)' : 'var(--border)'}`,
                      background: unit === val ? '#ef444418' : 'var(--bg-elevated)',
                      color: unit === val ? 'var(--red)' : 'var(--text-muted)',
                      fontWeight: unit === val ? 600 : 400, cursor: 'pointer', fontSize: 13 }}>
                    {label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                1 box = {piecesPerBox} pcs
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: showSavedPieces ? '1fr 1fr' : '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">
                Broken {isBox && unit === 'boxes' ? 'Boxes' : (product?.unit || 'pcs')} *
              </label>
              <input className="form-input" type="number" min="1" placeholder="0"
                value={quantity} onChange={e => { setQuantity(e.target.value); setSavedPieces(''); }} required />
            </div>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          {/* Saved pieces — only shown for box-unit breakage */}
          {showSavedPieces && boxQty > 0 && (
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>
                Partial Box Recovery
              </div>
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label className="form-label">
                  Intact pieces saved from {boxQty} broken box{boxQty > 1 ? 'es' : ''}
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> (max {totalPcsInBoxes})</span>
                </label>
                <input className="form-input" type="number" min="0" max={totalPcsInBoxes}
                  placeholder="0 — leave blank if nothing salvageable"
                  value={savedPieces} onChange={e => setSavedPieces(e.target.value)} />
              </div>
              {/* Live preview */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ background: savedPcsNum > 0 ? '#d1fae520' : 'var(--bg-tertiary)', border: `1px solid ${savedPcsNum > 0 ? 'var(--green)' : 'var(--border)'}`, borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Added to Loose Stock</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: savedPcsNum > 0 ? 'var(--green)' : 'var(--text-muted)' }}>
                    +{savedPcsNum} pcs
                  </div>
                </div>
                <div style={{ background: brokenPcs > 0 ? '#fef2f220' : 'var(--bg-tertiary)', border: `1px solid ${brokenPcs > 0 ? 'var(--red)' : 'var(--border)'}`, borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Pieces Written Off</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: brokenPcs > 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                    -{brokenPcs} pcs
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Source / Cause</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {Object.entries(SOURCE_LABELS).filter(([v]) => v !== 'inspection').map(([val, label]) => (
                <button key={val} type="button" onClick={() => setSource(val)}
                  style={{ padding: '8px', borderRadius: 6, border: `1px solid ${source === val ? 'var(--red)' : 'var(--border)'}`,
                    background: source === val ? '#ef444418' : 'var(--bg-elevated)',
                    color: source === val ? 'var(--red)' : 'var(--text-muted)',
                    fontWeight: source === val ? 600 : 400, cursor: 'pointer', fontSize: 13 }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
            <textarea className="form-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Describe what happened..." />
          </div>

          <div className="modal-footer" style={{ margin: 0, padding: 0, border: 'none' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}
              style={{ background: type === 'missing' ? 'var(--accent)' : 'var(--red)', borderColor: type === 'missing' ? 'var(--accent)' : 'var(--red)' }}>
              {saving ? <span className="spinner" /> : `Record ${type === 'missing' ? 'Missing Item' : 'Breakage'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BreakagePage() {
  const [records, setRecords] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [total, setTotal] = useState(0);
  const { isInventoryManager } = useAuthStore();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 100 });
      if (warehouseFilter) params.append('warehouse', warehouseFilter);
      if (sourceFilter) params.append('source', sourceFilter);
      if (typeFilter) params.append('type', typeFilter);
      const [b, w] = await Promise.all([api.get(`/breakages?${params}`), api.get('/warehouses')]);
      setRecords(b.data || []);
      setTotal(b.total || 0);
      setWarehouses(w.data || []);
    } finally { setLoading(false); }
  }, [warehouseFilter, sourceFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const totalPiecesLost = records.filter(b => b.type !== 'missing').reduce((s, b) => s + (b.unit === 'boxes' ? b.quantity * (b.product?.piecesPerBox || 1) : b.quantity), 0);
  const brokenCount = records.filter(b => b.type === 'broken' || !b.type).length;
  const missingCount = records.filter(b => b.type === 'missing').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Broken &amp; Missing Items</h1>
          <p className="page-subtitle">{total} records</p>
        </div>
        {isInventoryManager() && (
          <button className="btn btn-primary" style={{ background: 'var(--red)', borderColor: 'var(--red)' }} onClick={() => setModalOpen(true)}>
            <Plus size={16} /> Record Item
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Total Records', value: total, color: 'var(--text)' },
          { label: 'Broken / Damaged', value: brokenCount, color: 'var(--red)' },
          { label: 'Missing / Lost', value: missingCount, color: 'var(--accent)' },
          { label: 'Pieces Written Off', value: totalPiecesLost, color: 'var(--red)' },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{stat.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="card mb-16">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <select className="form-input" style={{ width: 180 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            <option value="broken">Broken / Damaged</option>
            <option value="missing">Missing / Lost</option>
          </select>
          <select className="form-input" style={{ width: 190 }} value={warehouseFilter} onChange={e => setWarehouseFilter(e.target.value)}>
            <option value="">All Warehouses</option>
            {warehouses.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
          </select>
          <select className="form-input" style={{ width: 180 }} value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
            <option value="">All Sources</option>
            {Object.entries(SOURCE_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
          </select>
          <button className="btn btn-secondary" onClick={load}><RefreshCw size={14} /></button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" style={{ width: 28, height: 28 }} /></div>
        ) : records.length === 0 ? (
          <div className="empty-state">
            <AlertTriangle />
            <p>No records found</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Record broken or missing items using the button above</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Record #</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Warehouse</th>
                  <th>Quantity</th>
                  <th>Source</th>
                  <th>Reference</th>
                  <th>Reported By</th>
                  <th>Notes</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map(b => {
                  const pcsLost = b.unit === 'boxes' ? b.quantity * (b.product?.piecesPerBox || 1) : b.quantity;
                  const meta = TYPE_META[b.type] || TYPE_META.broken;
                  return (
                    <tr key={b._id}>
                      <td><span className="text-mono" style={{ fontWeight: 600 }}>{b.breakageNumber}</span></td>
                      <td><span className={`badge ${meta.cls}`}>{meta.label}</span></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{fmtDate(b.date)}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{b.product?.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{b.product?.sku}</div>
                      </td>
                      <td>{b.warehouse?.name} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({b.warehouse?.code})</span></td>
                      <td>
                        <span className="text-mono" style={{ fontWeight: 600, color: b.type === 'missing' ? 'var(--accent)' : 'var(--red)' }}>
                          {b.quantity} {b.unit === 'boxes' ? `box${b.quantity !== 1 ? 'es' : ''}` : 'pcs'}
                        </span>
                        {b.unit === 'boxes' && b.type !== 'missing' && (
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{pcsLost} pcs lost</div>
                        )}
                      </td>
                      <td><span className={`badge ${SOURCE_COLORS[b.source] || 'badge-gray'}`}>{SOURCE_LABELS[b.source] || b.source}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {b.purchaseOrder?.poNumber && <span>{b.purchaseOrder.poNumber}</span>}
                        {b.inspection?.inspectionNumber && <span>{b.inspection.inspectionNumber}</span>}
                        {!b.purchaseOrder && !b.inspection && '—'}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{b.reportedBy?.name || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 180 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.notes || '—'}</div>
                      </td>
                      <td><span className={`badge ${STATUS_COLORS[b.status] || 'badge-yellow'}`}>{b.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <RecordModal
          warehouses={warehouses}
          onClose={() => setModalOpen(false)}
          onSave={() => { setModalOpen(false); load(); }}
        />
      )}
    </div>
  );
}
