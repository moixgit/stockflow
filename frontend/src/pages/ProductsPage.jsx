import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api.js';
import toast from 'react-hot-toast';
import { Plus, Search, Edit2, Trash2, Package, RefreshCw, ExternalLink, Ruler } from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';
import { calcPricePerPiece, pricingRateLabel, dimensionDisplay } from '../utils/pricing.js';

const fmt = (n) => `Rs ${(n || 0).toFixed(2)}`;

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;
  const { isInventoryManager } = useAuthStore();
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit, ...(search && { search }), ...(categoryFilter && { category: categoryFilter }) });
      const [p, c] = await Promise.all([
        api.get(`/products?${params}`),
        api.get('/categories'),
      ]);
      setProducts(p.data);
      setTotal(p.total);
      setCategories(c.data);
    } finally { setLoading(false); }
  }, [page, search, categoryFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!confirm('Deactivate this product?')) return;
    try { await api.delete(`/products/${id}`); toast.success('Product deactivated'); load(); }
    catch (err) { toast.error(err?.message || 'Failed'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">{total} products total</p>
        </div>
        {isInventoryManager() && (
          <button className="btn btn-primary" onClick={() => navigate('/products/new')}>
            <Plus size={16} /> Add Product
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card mb-16">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
            <Search size={16} />
            <input className="form-input" placeholder="Search by name, SKU, brand, article no..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="form-input" style={{ width: 180 }} value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <button className="btn btn-secondary" onClick={load}><RefreshCw size={14} /></button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" style={{ width: 28, height: 28 }} /></div>
        ) : products.length === 0 ? (
          <div className="empty-state"><Package /><p>No products found</p></div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 48 }}></th>
                    <th>Product</th>
                    <th>Brand</th>
                    <th>Article No.</th>
                    <th>Size</th>
                    <th>SKU</th>
                    <th>Category</th>
                    <th>Cost</th>
                    <th>Price</th>
                    <th>Margin</th>
                    <th>Reorder Pt.</th>
                    <th>Stock</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => {
                    const margin = p.sellingPrice > 0 ? ((p.sellingPrice - p.costPrice) / p.sellingPrice * 100).toFixed(1) : 0;
                    return (
                      <tr key={p._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/products/${p._id}`)}>
                        <td onClick={e => e.stopPropagation()}>
                          {p.image ? (
                            <img src={p.image} alt={p.name} style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border)' }} />
                          ) : (
                            <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Package size={16} color="var(--text-muted)" />
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 500 }}>{p.name}</span>
                            {p.productType === 'box' && (
                              <span style={{ fontSize: 10, fontWeight: 600, background: 'var(--accent)18', color: 'var(--accent)', borderRadius: 4, padding: '1px 6px' }}>
                                BOX/{p.piecesPerBox}pcs
                              </span>
                            )}
                            {p.productType === 'set' && (
                              <span style={{ fontSize: 10, fontWeight: 600, background: '#8b5cf618', color: '#8b5cf6', borderRadius: 4, padding: '1px 6px' }}>
                                SET
                              </span>
                            )}
                            {p.pricingMode === 'per_sqm' && (
                              <span style={{ fontSize: 10, fontWeight: 600, background: '#0ea5e918', color: '#0ea5e9', borderRadius: 4, padding: '1px 6px' }}>
                                {dimensionDisplay(p)} · /sqm
                              </span>
                            )}
                            {p.pricingMode === 'per_meter' && (
                              <span style={{ fontSize: 10, fontWeight: 600, background: '#f59e0b18', color: '#f59e0b', borderRadius: 4, padding: '1px 6px' }}>
                                {dimensionDisplay(p)} · /m
                              </span>
                            )}
                          </div>
                          {p.vendors?.length > 0 && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {p.vendors[0].name}{p.vendors.length > 1 ? ` +${p.vendors.length - 1} more` : ''}
                            </div>
                          )}
                        </td>
                        <td>{p.brand?.name || <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>
                        <td><span className="text-mono" style={{ fontSize: 11 }}>{p.articleNumber || <span style={{ color: 'var(--text-dim)', fontFamily: 'inherit' }}>—</span>}</span></td>
                        <td>{p.size ? `${p.size} ${p.sizeUnit || ''}`.trim() : <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>
                        <td><span className="text-mono">{p.sku}</span></td>
                        <td>{p.category?.name || '—'}</td>
                        <td style={{ color: 'var(--text-muted)' }}>
                          <div>{fmt(p.costPrice)}<span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{pricingRateLabel(p)}</span></div>
                          {p.pricingMode && p.pricingMode !== 'per_piece' && (
                            <div style={{ fontSize: 10, color: 'var(--orange)' }}>{fmt(calcPricePerPiece(p, p.costPrice))}/pcs</div>
                          )}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          <div>{fmt(p.sellingPrice)}<span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 400 }}>{pricingRateLabel(p)}</span></div>
                          {p.pricingMode && p.pricingMode !== 'per_piece' && (
                            <div style={{ fontSize: 10, color: 'var(--green)' }}>{fmt(calcPricePerPiece(p, p.sellingPrice))}/pcs</div>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${margin >= 30 ? 'badge-green' : margin >= 15 ? 'badge-yellow' : 'badge-red'}`}>
                            {margin}%
                          </span>
                        </td>
                        <td><span className="text-mono">{p.reorderPoint}</span></td>
                        <td onClick={e => e.stopPropagation()}>
                          {(() => {
                            const stock = p.stock || [];
                            const total = stock.reduce((s, i) => s + i.quantity, 0);
                            const withStock = stock.filter(s => s.quantity > 0 || s.looseQuantity > 0);
                            const isBox = p.productType === 'box';
                            return (
                              <div style={{ minWidth: 80 }}>
                                <span className={`badge ${total === 0 ? 'badge-red' : total <= p.reorderPoint ? 'badge-yellow' : 'badge-green'}`}>
                                  {isBox ? `${total} boxes` : `${total} ${p.unit || 'pcs'}`}
                                </span>
                                {withStock.length > 0 && (
                                  <div style={{ marginTop: 4 }}>
                                    {withStock.map(s => (
                                      <div key={s.warehouse._id} style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                        {s.warehouse.name}: <span style={{ color: 'var(--text)', fontWeight: 500 }}>{s.quantity}{isBox ? ` box${s.quantity !== 1 ? 'es' : ''}` : ''}</span>
                                        {isBox && s.looseQuantity > 0 && <span style={{ color: 'var(--text-muted)' }}> +{s.looseQuantity}pcs</span>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => navigate(`/products/${p._id}`)} title="View details">
                              <ExternalLink size={13} />
                            </button>
                            {isInventoryManager() && (
                              <>
                                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => navigate(`/products/${p._id}/edit`)} title="Edit">
                                  <Edit2 size={13} />
                                </button>
                                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(p._id)} title="Delete" style={{ color: 'var(--red)' }}>
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              {Array.from({ length: Math.ceil(total / limit) }, (_, i) => (
                <button key={i} className={`page-btn ${page === i + 1 ? 'active' : ''}`} onClick={() => setPage(i + 1)}>{i + 1}</button>
              ))}
            </div>
          </>
        )}
      </div>

    </div>
  );
}
