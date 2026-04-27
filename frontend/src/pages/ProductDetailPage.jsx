import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api.js';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Package, TrendingUp, ShoppingCart, Warehouse,
  BarChart3, RefreshCw, Edit2, AlertTriangle
} from 'lucide-react';

const fmt = (n) => `Rs ${(n || 0).toFixed(2)}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

function StatCard({ label, value, sub, icon: Icon, color }) {
  return (
    <div className="stat-card" style={{ flex: 1 }}>
      <div className="stat-icon" style={{ background: color + '20', color }}>
        <Icon size={20} />
      </div>
      <div>
        <div className="stat-value" style={{ color }}>{value}</div>
        <div className="stat-label">{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function MovementBadge({ type }) {
  const map = {
    in: { label: 'Stock In', color: 'var(--green)' },
    out: { label: 'Stock Out', color: 'var(--red)' },
    transfer: { label: 'Transfer', color: 'var(--blue)' },
    adjustment: { label: 'Adjustment', color: 'var(--yellow)' },
    return: { label: 'Return', color: 'var(--accent)' },
  };
  const m = map[type] || { label: type, color: 'var(--text-muted)' };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: m.color, background: m.color + '18', padding: '2px 8px', borderRadius: 20 }}>
      {m.label}
    </span>
  );
}

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('inventory');

  const load = async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([
        api.get(`/products/${id}`),
        api.get(`/products/${id}/stats`),
      ]);
      setProduct(p.data);
      setStats(s.data);
    } catch {
      toast.error('Failed to load product');
      navigate('/products');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );

  if (!product) return null;

  const totalStock = stats?.inventory?.reduce((s, i) => s + i.quantity, 0) || 0;
  const stockValue = totalStock * product.costPrice;
  const margin = product.sellingPrice > 0
    ? ((product.sellingPrice - product.costPrice) / product.sellingPrice * 100).toFixed(1)
    : 0;

  const tabs = [
    { id: 'inventory', label: 'Inventory', icon: Warehouse },
    { id: 'sales', label: 'Sales History', icon: ShoppingCart },
    { id: 'movements', label: 'Movements', icon: BarChart3 },
    { id: 'purchases', label: 'Purchases', icon: TrendingUp },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-ghost btn-icon" onClick={() => navigate('/products')}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 className="page-title" style={{ margin: 0 }}>{product.name}</h1>
            <span className={`badge ${product.isActive ? 'badge-success' : 'badge-danger'}`}>
              {product.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="page-subtitle" style={{ margin: 0 }}>
            {[product.brand?.name, product.category?.name].filter(Boolean).join(' · ') || 'No category'}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={load}><RefreshCw size={14} /></button>
      </div>

      {/* Product info card */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 24 }}>
          {/* Image */}
          <div style={{
            width: 180, height: 180, borderRadius: 12, overflow: 'hidden',
            border: '1px solid var(--border)', background: 'var(--bg-tertiary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {product.image ? (
              <img src={product.image} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <Package size={48} color="var(--text-muted)" />
            )}
          </div>

          {/* Details grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px 24px' }}>
            {[
              { label: 'SKU', value: product.sku, mono: true },
              { label: 'Barcode', value: product.barcode, mono: true },
              { label: 'Barcode Type', value: product.barcodeType },
              { label: 'Brand', value: product.brand?.name || '—' },
              { label: 'Article No.', value: product.articleNumber || '—', mono: true },
              { label: 'Size', value: product.size ? `${product.size} ${product.sizeUnit || ''}`.trim() : '—' },
              { label: 'Unit', value: product.unit },
              { label: 'Category', value: product.category?.name || '—' },
              { label: 'Cost Price', value: fmt(product.costPrice) },
              { label: 'Selling Price', value: fmt(product.sellingPrice) },
              { label: 'Margin', value: `${margin}%`, highlight: margin >= 30 ? 'var(--green)' : margin >= 15 ? 'var(--yellow)' : 'var(--red)' },
              { label: 'Tax Rate', value: `${product.taxRate || 0}%` },
              { label: 'Reorder Point', value: product.reorderPoint },
              { label: 'Max Stock', value: product.maxStock },
            ].map(({ label, value, mono, highlight }) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                <div style={{
                  fontSize: 13, fontWeight: 500, color: highlight || 'var(--text-primary)',
                  fontFamily: mono ? 'var(--font-mono)' : 'inherit',
                }}>
                  {value}
                </div>
              </div>
            ))}
            {product.vendors?.length > 0 && (
              <div style={{ gridColumn: '1/-1' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vendors</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {product.vendors.map(v => (
                    <span key={v._id} style={{ fontSize: 12, background: 'var(--bg-elevated)', color: 'var(--text-primary)', padding: '3px 10px', borderRadius: 20, fontWeight: 500, border: '1px solid var(--border)' }}>
                      {v.name}{v.company ? ` — ${v.company}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {product.tags?.length > 0 && (
              <div style={{ gridColumn: '1/-1' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tags</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {product.tags.map(t => (
                    <span key={t} style={{ fontSize: 11, background: 'var(--accent)18', color: 'var(--accent)', padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>{t}</span>
                  ))}
                </div>
              </div>
            )}
            {product.description && (
              <div style={{ gridColumn: '1/-1' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{product.description}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <StatCard label="Units Sold" value={stats?.stats?.totalSold ?? 0} sub={`${stats?.stats?.salesCount ?? 0} transactions`} icon={ShoppingCart} color="var(--accent)" />
        <StatCard label="Total Revenue" value={fmt(stats?.stats?.totalRevenue)} sub="from this product" icon={TrendingUp} color="var(--green)" />
        <StatCard label="Current Stock" value={totalStock}
          sub={totalStock <= product.reorderPoint ? '⚠ Below reorder point' : 'Across all warehouses'}
          icon={Warehouse}
          color={totalStock <= product.reorderPoint ? 'var(--red)' : 'var(--blue)'}
        />
        <StatCard label="Stock Value" value={fmt(stockValue)} sub="at cost price" icon={BarChart3} color="var(--yellow)" />
      </div>

      {/* Low stock alert */}
      {totalStock <= product.reorderPoint && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
          background: 'rgba(255,87,87,0.1)', border: '1px solid rgba(255,87,87,0.3)',
          borderRadius: 10, marginBottom: 20, color: 'var(--red)',
        }}>
          <AlertTriangle size={16} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>
            Stock is at or below reorder point ({product.reorderPoint} units). Consider restocking.
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px',
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1, transition: 'color 0.2s',
              }}
            >
              <tab.icon size={15} />
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ padding: 20 }}>

          {/* INVENTORY TAB */}
          {activeTab === 'inventory' && (
            <div>
              <h3 style={{ marginBottom: 16, color: 'var(--text-primary)', fontSize: 15 }}>Stock by Warehouse</h3>
              {stats?.inventory?.length === 0 ? (
                <div className="empty-state"><Warehouse size={32} /><p>No inventory records</p></div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Warehouse</th>
                      <th>Code</th>
                      <th>On Hand</th>
                      <th>Reserved</th>
                      <th>Available</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats?.inventory?.map(inv => {
                      const available = inv.quantity - inv.reservedQuantity;
                      const isLow = inv.quantity <= product.reorderPoint;
                      return (
                        <tr key={inv._id}>
                          <td style={{ fontWeight: 500 }}>{inv.warehouse?.name}</td>
                          <td><span className="text-mono">{inv.warehouse?.code}</span></td>
                          <td style={{ fontWeight: 600 }}>{inv.quantity}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{inv.reservedQuantity}</td>
                          <td style={{ fontWeight: 600, color: available > 0 ? 'var(--green)' : 'var(--red)' }}>{available}</td>
                          <td>
                            <span style={{
                              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                              color: isLow ? 'var(--red)' : 'var(--green)',
                              background: isLow ? 'rgba(255,87,87,0.12)' : 'rgba(34,211,160,0.12)',
                            }}>
                              {isLow ? 'Low Stock' : 'OK'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* SALES TAB */}
          {activeTab === 'sales' && (
            <div>
              <h3 style={{ marginBottom: 16, color: 'var(--text-primary)', fontSize: 15 }}>Recent Sales</h3>
              {stats?.recentSales?.length === 0 ? (
                <div className="empty-state"><ShoppingCart size={32} /><p>No sales recorded yet</p></div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Sale #</th>
                      <th>Date</th>
                      <th>Customer</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats?.recentSales?.map(s => (
                      <tr key={s._id}>
                        <td><span className="text-mono">{s.saleNumber}</span></td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{fmtDateTime(s.createdAt)}</td>
                        <td>{s.customer?.name || <span style={{ color: 'var(--text-dim)' }}>Walk-in</span>}</td>
                        <td style={{ fontWeight: 600 }}>{s.quantity}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{fmt(s.unitPrice)}</td>
                        <td style={{ fontWeight: 600, color: 'var(--green)' }}>{fmt(s.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* MOVEMENTS TAB */}
          {activeTab === 'movements' && (
            <div>
              <h3 style={{ marginBottom: 16, color: 'var(--text-primary)', fontSize: 15 }}>Inventory Movements</h3>
              {stats?.movements?.length === 0 ? (
                <div className="empty-state"><BarChart3 size={32} /><p>No movements recorded</p></div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Warehouse</th>
                      <th>Qty</th>
                      <th>Before</th>
                      <th>After</th>
                      <th>Reference</th>
                      <th>By</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats?.movements?.map(m => (
                      <tr key={m._id}>
                        <td><MovementBadge type={m.type} /></td>
                        <td>{m.warehouse?.name}</td>
                        <td style={{ fontWeight: 600, color: m.quantity > 0 ? 'var(--green)' : 'var(--red)' }}>
                          {m.quantity > 0 ? '+' : ''}{m.quantity}
                        </td>
                        <td className="text-mono" style={{ color: 'var(--text-muted)', fontSize: 12 }}>{m.previousQuantity ?? '—'}</td>
                        <td className="text-mono" style={{ fontSize: 12 }}>{m.newQuantity ?? '—'}</td>
                        <td><span className="text-mono" style={{ fontSize: 11 }}>{m.reference || '—'}</span></td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{m.performedBy?.name || '—'}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{fmtDateTime(m.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* PURCHASES TAB */}
          {activeTab === 'purchases' && (
            <div>
              <h3 style={{ marginBottom: 16, color: 'var(--text-primary)', fontSize: 15 }}>Purchase Orders</h3>
              {stats?.purchases?.length === 0 ? (
                <div className="empty-state"><TrendingUp size={32} /><p>No purchase orders found</p></div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>PO Number</th>
                      <th>Vendor</th>
                      <th>Status</th>
                      <th>Qty Ordered</th>
                      <th>Qty Received</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats?.purchases?.map(po => {
                      const item = po.items?.find(i => i.product?.toString() === id || i.product === id);
                      const statusColors = {
                        draft: 'var(--text-muted)', ordered: 'var(--blue)',
                        partial: 'var(--yellow)', received: 'var(--green)', cancelled: 'var(--red)',
                      };
                      return (
                        <tr key={po._id}>
                          <td><span className="text-mono">{po.poNumber}</span></td>
                          <td>{po.vendor?.name || '—'}</td>
                          <td>
                            <span style={{
                              fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
                              color: statusColors[po.status], background: statusColors[po.status] + '18',
                              padding: '2px 8px', borderRadius: 20,
                            }}>
                              {po.status}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{item?.orderedQty ?? '—'}</td>
                          <td style={{ color: 'var(--green)' }}>{item?.receivedQty ?? '—'}</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{fmtDate(po.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
