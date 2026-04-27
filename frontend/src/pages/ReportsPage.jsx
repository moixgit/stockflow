import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import api from '../utils/api';
import toast from 'react-hot-toast';

const COLORS = ['#6c63ff', '#22d3a0', '#f59e0b', '#ff5757', '#3b82f6', '#ec4899'];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('sales');
  const [salesData, setSalesData] = useState(null);
  const [inventoryData, setInventoryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [groupBy, setGroupBy] = useState('day');

  useEffect(() => {
    if (activeTab === 'sales') fetchSales();
    if (activeTab === 'inventory') fetchInventory();
  }, [activeTab]);

  const fetchSales = async (overrides = {}) => {
    setLoading(true);
    const from = 'from' in overrides ? overrides.from : dateFrom;
    const to = 'to' in overrides ? overrides.to : dateTo;
    const gb = overrides.groupBy || groupBy;
    const params = new URLSearchParams({ groupBy: gb });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    try {
      const res = await api.get(`/reports/sales?${params}`);
      setSalesData(res.data);
    } catch { toast.error('Failed to load sales report'); }
    finally { setLoading(false); }
  };

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/inventory-valuation');
      setInventoryData(res.data);
    } catch { toast.error('Failed to load inventory report'); }
    finally { setLoading(false); }
  };

  const handleSalesFilter = (e) => { e.preventDefault(); fetchSales(); };

  const exportCSV = (data, filename) => {
    if (!data?.length) return;
    const keys = Object.keys(data[0]);
    const csv = [keys.join(','), ...data.map(row => keys.map(k => row[k]).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px 16px' }}>
        <div style={{ color: 'var(--text-muted)', marginBottom: '8px', fontSize: '13px' }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color, fontSize: '14px', fontWeight: 600 }}>
            {p.name}: {typeof p.value === 'number' && p.name.toLowerCase().includes('revenue') ? `Rs ${p.value.toFixed(2)}` : p.value}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Business insights and financial reports</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {['sales', 'inventory', 'payments'].map(tab => (
          <button key={tab} className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab(tab)}>
            {tab === 'sales' && '📈 '}
            {tab === 'inventory' && '📦 '}
            {tab === 'payments' && '💳 '}
            {tab.charAt(0).toUpperCase() + tab.slice(1)} Report
          </button>
        ))}
      </div>

      {/* SALES REPORT */}
      {activeTab === 'sales' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Filter bar */}
          <form className="card" style={{ padding: '16px' }} onSubmit={handleSalesFilter}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ margin: 0, flex: '1', minWidth: '140px' }}>
                <label className="form-label" style={{ marginBottom: '6px' }}>From</label>
                <input type="date" className="form-input" style={{ margin: 0 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0, flex: '1', minWidth: '140px' }}>
                <label className="form-label" style={{ marginBottom: '6px' }}>To</label>
                <input type="date" className="form-input" style={{ margin: 0 }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0, flex: '1', minWidth: '140px' }}>
                <label className="form-label" style={{ marginBottom: '6px' }}>Group By</label>
                <select className="form-input" style={{ margin: 0 }} value={groupBy} onChange={e => setGroupBy(e.target.value)}>
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>Apply Filter</button>
              <button type="button" className="btn btn-ghost" style={{ whiteSpace: 'nowrap' }} onClick={() => { setDateFrom(''); setDateTo(''); fetchSales({ from: '', to: '' }); }}>Show All</button>
              {salesData?.sales && (
                <button type="button" className="btn btn-ghost" style={{ whiteSpace: 'nowrap' }}
                  onClick={() => exportCSV(salesData.sales, `sales-report-${dateFrom}-${dateTo}.csv`)}>
                  ⬇️ Export CSV
                </button>
              )}
            </div>
          </form>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>Loading report…</div>
          ) : salesData ? (
            <>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' }}>
                {[
                  { label: 'Total Revenue', value: `Rs ${(salesData.summary?.totalRevenue || 0).toFixed(2)}`, icon: '💰', color: 'var(--green)' },
                  { label: 'Total Orders', value: salesData.summary?.totalSales || 0, icon: '🧾', color: 'var(--accent)' },
                  { label: 'Avg Order Value', value: `Rs ${(salesData.summary?.avgOrderValue || 0).toFixed(2)}`, icon: '📊', color: 'var(--yellow)' },
                  { label: 'Items Sold', value: salesData.summary?.totalItems || 0, icon: '📦', color: 'var(--blue)' },
                ].map(s => (
                  <div key={s.label} className="stat-card">
                    <div className="stat-icon" style={{ background: s.color + '20', color: s.color }}>{s.icon}</div>
                    <div>
                      <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                      <div className="stat-label">{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Revenue Chart */}
              {salesData.chart?.length > 0 && (
                <div className="card">
                  <h3 style={{ marginBottom: '20px', color: 'var(--text-primary)' }}>Revenue Over Time</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={salesData.chart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="_id" stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
                      <YAxis stroke="var(--text-muted)" tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="revenue" stroke="var(--green)" strokeWidth={2} dot={false} name="Revenue" />
                      <Line type="monotone" dataKey="count" stroke="var(--accent)" strokeWidth={2} dot={false} name="Orders" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Payment method breakdown */}
              {salesData.byPaymentMethod?.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div className="card">
                    <h3 style={{ marginBottom: '20px', color: 'var(--text-primary)' }}>Sales by Payment Method</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={salesData.byPaymentMethod} dataKey="total" nameKey="_id" outerRadius={80} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                          {salesData.byPaymentMethod.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v) => `Rs ${v.toFixed(2)}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="card">
                    <h3 style={{ marginBottom: '20px', color: 'var(--text-primary)' }}>Top Products</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {(salesData.topProducts || []).slice(0, 6).map((p, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '28px', height: '28px', borderRadius: '6px',
                              background: COLORS[i % COLORS.length] + '30',
                              color: COLORS[i % COLORS.length],
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '12px', fontWeight: 700
                            }}>{i + 1}</div>
                            <span style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{p._id}</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ color: 'var(--green)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>Rs {(p.revenue || 0).toFixed(2)}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{p.qty} units</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {salesData.sales?.length === 0 && (
                <div className="card" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
                  <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>No sales found</div>
                  <div>No sales match the selected date range. Try clicking <strong>Show All</strong> to see all sales.</div>
                </div>
              )}

              {/* Sales Table */}
              {salesData.sales?.length > 0 && (
                <div className="card">
                  <h3 style={{ marginBottom: '16px', color: 'var(--text-primary)' }}>Sales Transactions</h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Sale #</th>
                          <th>Date</th>
                          <th>Customer</th>
                          <th>Items</th>
                          <th>Payment</th>
                          <th>Status</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesData.sales.map(s => (
                          <tr key={s._id}>
                            <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--accent)' }}>{s.saleNumber}</span></td>
                            <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{new Date(s.createdAt).toLocaleDateString()}</td>
                            <td>{s.customer?.name || <span style={{ color: 'var(--text-muted)' }}>Walk-in</span>}</td>
                            <td style={{ color: 'var(--text-muted)' }}>{s.items?.length || 0}</td>
                            <td><span className="badge badge-info" style={{ textTransform: 'capitalize' }}>{s.paymentMethod}</span></td>
                            <td><span className={`badge ${s.status === 'completed' ? 'badge-success' : s.status === 'refunded' ? 'badge-danger' : 'badge-warning'}`}>{s.status}</span></td>
                            <td><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)', fontWeight: 600 }}>Rs {(s.grandTotal || 0).toFixed(2)}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* INVENTORY REPORT */}
      {activeTab === 'inventory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button className="btn btn-primary" onClick={fetchInventory}>🔄 Refresh</button>
            {inventoryData?.products && (
              <button className="btn btn-ghost"
                onClick={() => exportCSV(inventoryData.products.map(p => ({
                  name: p.name, sku: p.sku, costPrice: p.costPrice, sellingPrice: p.sellingPrice,
                  totalQty: p.inventory?.reduce((s, i) => s + i.quantity, 0) || 0
                })), 'inventory-valuation.csv')}>
                ⬇️ Export CSV
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>Loading report…</div>
          ) : inventoryData ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' }}>
                {[
                  { label: 'Total Products', value: inventoryData.summary?.totalProducts || 0, icon: '📦', color: 'var(--accent)' },
                  { label: 'Total Stock Value', value: `Rs ${(inventoryData.summary?.totalCostValue || 0).toFixed(2)}`, icon: '💰', color: 'var(--green)' },
                  { label: 'Retail Value', value: `Rs ${(inventoryData.summary?.totalRetailValue || 0).toFixed(2)}`, icon: '🏷️', color: 'var(--yellow)' },
                  { label: 'Potential Profit', value: `Rs ${((inventoryData.summary?.totalRetailValue || 0) - (inventoryData.summary?.totalCostValue || 0)).toFixed(2)}`, icon: '📈', color: 'var(--blue)' },
                ].map(s => (
                  <div key={s.label} className="stat-card">
                    <div className="stat-icon" style={{ background: s.color + '20', color: s.color }}>{s.icon}</div>
                    <div>
                      <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                      <div className="stat-label">{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="card">
                <h3 style={{ marginBottom: '16px', color: 'var(--text-primary)' }}>Inventory Valuation by Product</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>SKU</th>
                        <th>Total Qty</th>
                        <th>Cost/Unit</th>
                        <th>Retail/Unit</th>
                        <th>Cost Value</th>
                        <th>Retail Value</th>
                        <th>Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(inventoryData.products || []).map(p => {
                        const totalQty = p.inventory?.reduce((s, i) => s + i.quantity, 0) || 0;
                        const costValue = totalQty * (p.costPrice || 0);
                        const retailValue = totalQty * (p.sellingPrice || 0);
                        const margin = p.sellingPrice > 0 ? ((p.sellingPrice - p.costPrice) / p.sellingPrice * 100) : 0;
                        return (
                          <tr key={p._id}>
                            <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{p.name}</td>
                            <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>{p.sku}</span></td>
                            <td style={{ textAlign: 'center' }}>{totalQty}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Rs {(p.costPrice || 0).toFixed(2)}</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>Rs {(p.sellingPrice || 0).toFixed(2)}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--yellow)' }}>Rs {costValue.toFixed(2)}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)', fontWeight: 600 }}>Rs {retailValue.toFixed(2)}</td>
                            <td>
                              <span className={`badge ${margin > 30 ? 'badge-success' : margin > 15 ? 'badge-warning' : 'badge-danger'}`}>
                                {margin.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📦</div>
              <div>Click Refresh to load inventory report</div>
            </div>
          )}
        </div>
      )}

      {/* PAYMENTS REPORT */}
      {activeTab === 'payments' && (
        <div className="card" style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>💳</div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Payment Analytics</div>
          <div>Switch to Sales Report and filter by payment method to view payment breakdowns.</div>
          <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={() => setActiveTab('sales')}>Go to Sales Report</button>
        </div>
      )}
    </div>
  );
}
