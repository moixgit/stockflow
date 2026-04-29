// InventoryPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api.js';
import toast from 'react-hot-toast';
import { RefreshCw, AlertTriangle, Edit2, Plus, Search, X, Package, ChevronDown, PackageOpen } from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';

function ProductSearch({ products, value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef();
  const inputRef = useRef();

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = products.filter(p => {
    if (!query) return true;
    const q = query.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.brand?.name?.toLowerCase().includes(q);
  }).slice(0, 40);

  const select = (p) => {
    onChange(p);
    setQuery('');
    setOpen(false);
  };

  const clear = (e) => {
    e.stopPropagation();
    onChange(null);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {value ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--accent)', background: 'var(--bg-elevated)',
          cursor: 'default',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 6, background: 'var(--accent)18',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {value.image
              ? <img src={value.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
              : <Package size={14} color="var(--accent)" />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {value.sku}{value.brand?.name ? ` · ${value.brand.name}` : ''}
            </div>
          </div>
          <button type="button" onClick={clear} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
            <X size={14} />
          </button>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            ref={inputRef}
            className="form-input"
            style={{ paddingLeft: 32, paddingRight: 32 }}
            placeholder="Search by name, SKU or brand..."
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            autoComplete="off"
          />
          <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        </div>
      )}

      {open && !value && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          maxHeight: 260, overflowY: 'auto',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No products found
            </div>
          ) : filtered.map(p => (
            <button
              key={p._id}
              type="button"
              onClick={() => select(p)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', background: 'none', border: 'none',
                borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <div style={{
                width: 30, height: 30, borderRadius: 6, background: 'var(--bg-elevated)',
                border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0, overflow: 'hidden',
              }}>
                {p.image
                  ? <img src={p.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Package size={13} color="var(--text-muted)" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {p.sku}{p.brand?.name ? ` · ${p.brand.name}` : ''}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AddStockModal({ warehouses, onClose, onSave }) {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?._id || '');
  const [unit, setUnit] = useState('pieces');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const isBox = selectedProduct?.productType === 'box';
  const piecesPerBox = selectedProduct?.piecesPerBox || 1;

  useEffect(() => {
    api.get('/products?limit=500').then(res => setProducts(res.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (isBox) setUnit('boxes');
    else setUnit('pieces');
  }, [isBox]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return toast.error('Select a product');
    if (!warehouseId) return toast.error('Select a warehouse');
    setSaving(true);
    try {
      await api.post('/inventory/adjust', { productId: selectedProduct._id, warehouseId, quantity: +quantity, type: 'in', notes, unit });
      toast.success('Stock added successfully');
      onSave();
    } catch (err) { toast.error(err?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h2 className="modal-title">Add Stock</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Warehouse</label>
            <select className="form-input" value={warehouseId} onChange={e => setWarehouseId(e.target.value)} required>
              <option value="">Select warehouse</option>
              {warehouses.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Product</label>
            <ProductSearch products={products} value={selectedProduct} onChange={setSelectedProduct} />
          </div>

          {isBox && (
            <div className="form-group">
              <label className="form-label">Add as</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['boxes', 'Whole Boxes'], ['pieces', 'Loose Pieces']].map(([val, label]) => (
                  <button key={val} type="button" onClick={() => setUnit(val)}
                    style={{ flex: 1, padding: '7px', borderRadius: 6, border: `1px solid ${unit === val ? 'var(--accent)' : 'var(--border)'}`, background: unit === val ? 'var(--accent)18' : 'var(--bg-elevated)', color: unit === val ? 'var(--accent)' : 'var(--text-muted)', fontWeight: unit === val ? 600 : 400, cursor: 'pointer', fontSize: 13 }}>
                    {label}
                  </button>
                ))}
              </div>
              {unit === 'boxes' && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>1 box = {piecesPerBox} pieces</div>}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Quantity ({isBox ? unit : (selectedProduct?.unit || 'pcs')})</label>
            <input className="form-input" type="number" min="1" placeholder="Enter quantity..." value={quantity} onChange={e => setQuantity(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Notes <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(optional)</span></label>
            <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Received from vendor, PO-001..." />
          </div>

          <div className="modal-footer" style={{ margin: 0, padding: 0, border: 'none' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : 'Add Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdjustModal({ inv, onClose, onSave }) {
  const isBox = inv.product?.productType === 'box';
  const piecesPerBox = inv.product?.piecesPerBox || 1;
  const [type, setType] = useState('adjustment');
  const [unit, setUnit] = useState(isBox ? 'boxes' : 'pieces');
  const [qty, setQty] = useState(isBox ? inv.quantity : inv.quantity);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const currentDisplay = isBox
    ? `${inv.quantity} box${inv.quantity !== 1 ? 'es' : ''} + ${inv.looseQuantity || 0} loose pcs (${inv.quantity * piecesPerBox + (inv.looseQuantity || 0)} pcs total)`
    : `${inv.quantity} ${inv.product?.unit || 'pcs'}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/inventory/adjust', { productId: inv.product._id, warehouseId: inv.warehouse._id, quantity: +qty, type, notes, unit });
      toast.success('Stock adjusted');
      onSave();
    } catch (err) { toast.error(err?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2 className="modal-title">Adjust Stock</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg-elevated)', borderRadius: 8 }}>
          <div style={{ fontWeight: 500 }}>{inv.product.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{inv.warehouse.name} • Current: {currentDisplay}</div>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {isBox && (
            <div className="form-group">
              <label className="form-label">Adjust</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['boxes', 'Whole Boxes'], ['pieces', 'Loose Pieces']].map(([val, label]) => (
                  <button key={val} type="button" onClick={() => setUnit(val)}
                    style={{ flex: 1, padding: '7px', borderRadius: 6, border: `1px solid ${unit === val ? 'var(--accent)' : 'var(--border)'}`, background: unit === val ? 'var(--accent)18' : 'var(--bg-elevated)', color: unit === val ? 'var(--accent)' : 'var(--text-muted)', fontWeight: unit === val ? 600 : 400, cursor: 'pointer', fontSize: 13 }}>
                    {label}
                  </button>
                ))}
              </div>
              {unit === 'boxes' && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>1 box = {piecesPerBox} pieces</div>}
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Adjustment Type</label>
            <select className="form-input" value={type} onChange={e => setType(e.target.value)}>
              <option value="adjustment">Set Exact Quantity</option>
              <option value="in">Add Stock</option>
              <option value="out">Remove Stock</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{type === 'adjustment' ? 'New Quantity' : 'Quantity'} ({isBox ? unit : (inv.product?.unit || 'pcs')})</label>
            <input className="form-input" type="number" min="0" value={qty} onChange={e => setQty(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div className="modal-footer" style={{ margin: 0, padding: 0, border: 'none' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <span className="spinner" /> : 'Adjust Stock'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function OpenBoxModal({ inv, onClose, onSave }) {
  const piecesPerBox = inv.product?.piecesPerBox || 1;
  const [boxCount, setBoxCount] = useState(1);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const piecesReleased = boxCount * piecesPerBox;
  const newBoxes = inv.quantity - boxCount;
  const newLoose = (inv.looseQuantity || 0) + piecesReleased;
  const valid = boxCount >= 1 && boxCount <= inv.quantity;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    try {
      await api.post('/inventory/open-box', {
        productId: inv.product._id,
        warehouseId: inv.warehouse._id,
        boxCount: +boxCount,
        notes,
      });
      toast.success(`Opened ${boxCount} box${boxCount > 1 ? 'es' : ''} → ${piecesReleased} loose pieces`);
      onSave();
    } catch (err) { toast.error(err?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PackageOpen size={18} /> Open Box
          </h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* Current state */}
        <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg-elevated)', borderRadius: 8 }}>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>{inv.product.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{inv.warehouse.name} · {piecesPerBox} pcs/box</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Whole Boxes</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{inv.quantity}</div>
            </div>
            <div style={{ background: 'var(--bg-card)', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Loose Pieces</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{inv.looseQuantity || 0}</div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Boxes to Open</label>
            <input className="form-input" type="number" min="1" max={inv.quantity} value={boxCount}
              onChange={e => setBoxCount(+e.target.value)} required />
            {boxCount > inv.quantity && (
              <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>Only {inv.quantity} box{inv.quantity !== 1 ? 'es' : ''} available</div>
            )}
          </div>

          {/* Preview */}
          {valid && boxCount > 0 && (
            <div style={{ background: 'var(--accent)0d', border: '1px solid var(--accent)33', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>After opening</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Boxes</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{newBoxes}</div>
                  <div style={{ fontSize: 10, color: 'var(--red)' }}>-{boxCount}</div>
                </div>
                <div style={{ color: 'var(--text-dim)', fontSize: 18 }}>→</div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Loose Pcs</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{newLoose}</div>
                  <div style={{ fontSize: 10, color: 'var(--green)' }}>+{piecesReleased}</div>
                </div>
              </div>
              <div style={{ marginTop: 8, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                Total pieces unchanged: {inv.quantity * piecesPerBox + (inv.looseQuantity || 0)}
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Notes <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(optional)</span></label>
            <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Opened for loose sale counter..." />
          </div>

          <div className="modal-footer" style={{ margin: 0, padding: 0, border: 'none' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !valid}>
              {saving ? <span className="spinner" /> : `Open ${boxCount || ''} Box${boxCount !== 1 ? 'es' : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [adjustItem, setAdjustItem] = useState(null);
  const [openBoxItem, setOpenBoxItem] = useState(null);
  const [addStockOpen, setAddStockOpen] = useState(false);
  const { isInventoryManager } = useAuthStore();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, w] = await Promise.all([
        api.get(`/inventory${warehouseFilter ? `?warehouse=${warehouseFilter}` : ''}`),
        api.get('/warehouses'),
      ]);
      setInventory(inv.data);
      setWarehouses(w.data);
    } finally { setLoading(false); }
  }, [warehouseFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Inventory</h1><p className="page-subtitle">{inventory.length} stock records</p></div>
        {isInventoryManager() && (
          <button className="btn btn-primary" onClick={() => setAddStockOpen(true)}>
            <Plus size={16} /> Add Stock Entry
          </button>
        )}
      </div>

      <div className="card mb-16">
        <div style={{ display: 'flex', gap: 12 }}>
          <select className="form-input" style={{ width: 200 }} value={warehouseFilter} onChange={e => setWarehouseFilter(e.target.value)}>
            <option value="">All Warehouses</option>
            {warehouses.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
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
              <thead><tr><th>Product</th><th>SKU</th><th>Warehouse</th><th>In Stock</th><th>Loose Pcs</th><th>Reserved</th><th>Available</th><th>Reorder Pt.</th><th>Status</th>{isInventoryManager() && <th></th>}</tr></thead>
              <tbody>
                {inventory.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No inventory records</td></tr>
                ) : inventory.map(inv => {
                  const isBox = inv.product?.productType === 'box';
                  const piecesPerBox = inv.product?.piecesPerBox || 1;
                  const available = inv.quantity - inv.reservedQuantity;
                  const totalPieces = isBox ? inv.quantity * piecesPerBox + (inv.looseQuantity || 0) : inv.quantity;
                  const isLow = inv.quantity <= (inv.product?.reorderPoint || 10);
                  return (
                    <tr key={inv._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 500 }}>{inv.product?.name}</span>
                          {isBox && <span style={{ fontSize: 10, fontWeight: 600, background: 'var(--accent)18', color: 'var(--accent)', borderRadius: 4, padding: '1px 5px' }}>BOX</span>}
                          {inv.product?.productType === 'set' && <span style={{ fontSize: 10, fontWeight: 600, background: '#8b5cf618', color: '#8b5cf6', borderRadius: 4, padding: '1px 5px' }}>SET</span>}
                        </div>
                      </td>
                      <td><span className="text-mono">{inv.product?.sku}</span></td>
                      <td>{inv.warehouse?.name} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({inv.warehouse?.code})</span></td>
                      <td>
                        <span className="text-mono" style={{ fontWeight: 600 }}>
                          {isBox ? `${inv.quantity} box${inv.quantity !== 1 ? 'es' : ''}` : inv.quantity}
                        </span>
                        {isBox && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{totalPieces} pcs total</div>}
                      </td>
                      <td>
                        {isBox ? (
                          <span className="text-mono" style={{ color: (inv.looseQuantity || 0) > 0 ? 'var(--accent)' : 'var(--text-dim)' }}>
                            {inv.looseQuantity || 0}
                          </span>
                        ) : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                      </td>
                      <td><span className="text-mono" style={{ color: 'var(--text-muted)' }}>{inv.reservedQuantity}</span></td>
                      <td><span className="text-mono" style={{ fontWeight: 600, color: available <= 0 ? 'var(--red)' : 'var(--text)' }}>{available}</span></td>
                      <td><span className="text-mono">{inv.product?.reorderPoint}</span></td>
                      <td>
                        {isLow ? (
                          <span className="badge badge-red"><AlertTriangle size={10} /> Low</span>
                        ) : (
                          <span className="badge badge-green">OK</span>
                        )}
                      </td>
                      {isInventoryManager() && (
                        <td>
                          <div style={{ display: 'flex', gap: 2 }}>
                            {isBox && inv.quantity > 0 && (
                              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setOpenBoxItem(inv)}
                                title="Open box → loose pieces" style={{ color: 'var(--accent)' }}>
                                <PackageOpen size={13} />
                              </button>
                            )}
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setAdjustItem(inv)} title="Adjust stock">
                              <Edit2 size={13} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {adjustItem && <AdjustModal inv={adjustItem} onClose={() => setAdjustItem(null)} onSave={() => { setAdjustItem(null); load(); }} />}
      {openBoxItem && <OpenBoxModal inv={openBoxItem} onClose={() => setOpenBoxItem(null)} onSave={() => { setOpenBoxItem(null); load(); }} />}
      {addStockOpen && <AddStockModal warehouses={warehouses} onClose={() => setAddStockOpen(false)} onSave={() => { setAddStockOpen(false); load(); }} />}
    </div>
  );
}
