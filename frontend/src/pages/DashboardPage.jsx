import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import api from '../utils/api.js';
import { TrendingUp, TrendingDown, Package, ShoppingCart, AlertTriangle, Warehouse, DollarSign, Users, Store, ArrowUpRight } from 'lucide-react';
import { format } from 'date-fns';

const fmt = (n) => `Rs ${new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0 }).format(n || 0)}`;
const fmtNum = (n) => new Intl.NumberFormat('en-US').format(n || 0);

function StatCard({ label, value, icon: Icon, color, sub, subPositive }) {
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div className="stat-icon" style={{ background: `${color}1a` }}>
          <Icon size={18} color={color} />
        </div>
        {sub !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: subPositive ? 'var(--green)' : 'var(--red)' }}>
            {subPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {sub}%
          </div>
        )}
      </div>
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || 'var(--text)' }}>{p.name}: {p.name === 'Revenue' || p.name === 'total' ? fmt(p.value) : fmtNum(p.value)}</p>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [salesChart, setSalesChart] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [warehouseStock, setWarehouseStock] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [brandSales, setBrandSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, sc, tp, ws, rs, bs] = await Promise.all([
          api.get('/dashboard/stats'),
          api.get('/dashboard/sales-chart?days=30'),
          api.get('/dashboard/top-products'),
          api.get('/dashboard/warehouse-stock'),
          api.get('/dashboard/recent-sales'),
          api.get('/dashboard/brand-sales'),
        ]);
        setStats(s.data);
        setSalesChart(sc.data.map(d => ({ date: d._id, Revenue: d.total, Orders: d.count })));
        setTopProducts(tp.data);
        setWarehouseStock(ws.data);
        setRecentSales(rs.data);
        setBrandSales(bs.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="loading-page"><div className="spinner" style={{ width: 32, height: 32 }} /></div>;

  const COLORS = ['#6c63ff', '#22d3a0', '#38bdf8', '#fbbf24', '#fb923c'];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview for {format(new Date(), 'MMMM d, yyyy')}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-4 mb-24">
        <StatCard label="Today's Sales" value={fmt(stats?.todaySales?.total)} icon={DollarSign} color="var(--accent)" sub={stats?.salesGrowth} subPositive={stats?.salesGrowth >= 0} />
        <StatCard label="Monthly Revenue" value={fmt(stats?.monthSales?.total)} icon={TrendingUp} color="var(--green)" />
        <StatCard label="Total Products" value={fmtNum(stats?.totalProducts)} icon={Package} color="var(--blue)" />
        <StatCard label="Low Stock Alerts" value={fmtNum(stats?.lowStockCount)} icon={AlertTriangle} color="var(--red)" />
        <StatCard label="Today's Orders" value={fmtNum(stats?.todaySales?.count)} icon={ShoppingCart} color="var(--yellow)" />
        <StatCard label="Pending POs" value={fmtNum(stats?.pendingPOs)} icon={Warehouse} color="var(--orange)" />
        <StatCard label="Total Vendors" value={fmtNum(stats?.totalVendors)} icon={Store} color="var(--green)" />
        <StatCard label="Active Users" value={fmtNum(stats?.totalUsers)} icon={Users} color="var(--accent)" />
      </div>

      {/* Charts row */}
      <div className="grid-2 mb-24">
        <div className="card">
          <div className="card-header">
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>Revenue — Last 30 Days</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{fmt(stats?.monthSales?.total)} this month</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={salesChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={v => v.slice(5)} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={v => `Rs ${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="Revenue" stroke="var(--accent)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header">
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>Orders per Day</div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={salesChart.slice(-14)}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={v => v.slice(5)} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Orders" fill="var(--green)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid-3">
        {/* Top Products */}
        <div className="card" style={{ gridColumn: '1 / 3' }}>
          <div className="card-header">
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>Top Selling Products</div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Last 30 days</span>
          </div>
          {topProducts.length === 0 ? (
            <div className="empty-state"><Package /><p>No sales data yet</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Product</th><th>Units Sold</th><th>Revenue</th><th></th></tr></thead>
                <tbody>
                  {topProducts.slice(0,8).map((p, i) => (
                    <tr key={p._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 24, height: 24, borderRadius: 6, background: `${COLORS[i % 5]}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: COLORS[i % 5] }}>{i+1}</div>
                          {p.name || 'Unknown'}
                        </div>
                      </td>
                      <td><span className="text-mono">{fmtNum(p.totalQty)}</span></td>
                      <td style={{ color: 'var(--green)' }}>{fmt(p.totalRevenue)}</td>
                      <td>
                        <div style={{ width: '80px', height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: COLORS[i % 5], width: `${Math.min(100, (p.totalRevenue / (topProducts[0]?.totalRevenue || 1)) * 100)}%`, borderRadius: 3 }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Warehouse stock */}
        <div className="card">
          <div className="card-header">
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>Warehouse Stock</div>
          </div>
          {warehouseStock.length === 0 ? (
            <div className="empty-state"><Warehouse /><p>No warehouses</p></div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={warehouseStock} dataKey="totalQuantity" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70}>
                    {warehouseStock.map((_, i) => <Cell key={i} fill={COLORS[i % 5]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [fmtNum(v), 'Units']} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {warehouseStock.map((wh, i) => (
                  <div key={wh._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % 5] }} />
                      <span>{wh.name}</span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>{fmtNum(wh.totalQuantity)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Brand Sales */}
      {brandSales.length > 0 && (
        <div className="card mt-24">
          <div className="card-header">
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>Sales by Brand</div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Last 30 days</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {brandSales.map((b, i) => {
              const color = COLORS[i % COLORS.length];
              const pct = Math.min(100, (b.totalRevenue / (brandSales[0]?.totalRevenue || 1)) * 100);
              return (
                <div key={b._id} style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: color + '22', color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>
                      {b.brandName?.[0] || '?'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.brandName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.totalQty} units sold</div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, color, fontSize: 15, marginBottom: 6 }}>{fmt(b.totalRevenue)}</div>
                  <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: color, width: `${pct}%`, borderRadius: 2, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Sales */}
      <div className="card mt-24">
        <div className="card-header">
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>Recent Sales</div>
        </div>
        {recentSales.length === 0 ? (
          <div className="empty-state"><ShoppingCart /><p>No recent sales</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Sale #</th><th>Warehouse</th><th>Customer</th><th>Total</th><th>Payment</th><th>By</th><th>Date</th></tr></thead>
              <tbody>
                {recentSales.map(sale => (
                  <tr key={sale._id}>
                    <td><span className="text-mono">{sale.saleNumber}</span></td>
                    <td>{sale.warehouse?.name}</td>
                    <td>{sale.customer?.name || '—'}</td>
                    <td style={{ color: 'var(--green)', fontWeight: 600 }}>{fmt(sale.grandTotal)}</td>
                    <td><span className={`badge badge-${sale.paymentMethod === 'cash' ? 'green' : 'blue'}`}>{sale.paymentMethod}</span></td>
                    <td>{sale.soldBy?.name}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{format(new Date(sale.createdAt), 'MMM d, h:mm a')}</td>
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
