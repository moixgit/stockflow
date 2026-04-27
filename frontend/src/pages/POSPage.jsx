import React, { useState, useEffect, useRef, useCallback } from "react";
import api from "../utils/api.js";
import toast from "react-hot-toast";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CreditCard,
  Banknote,
  X,
  QrCode,
  Check,
  Printer,
} from "lucide-react";

const fmt = (n, currency = 'Rs') => `${currency} ${(n || 0).toFixed(2)}`;

function buildAddress(address) {
  if (!address) return '';
  const parts = [address.street, address.city, address.state, address.zip, address.country].filter(Boolean);
  return parts.join(', ');
}

function printThermal(sale, store = {}) {
  const date = new Date(sale.createdAt).toLocaleString('en-PK');
  const rows = sale.items.map(item => {
    const name = (item.productName || '').padEnd(20).slice(0, 20);
    const qty = String(item.quantity).padStart(3);
    const total = fmt(item.total).padStart(12);
    return `${name}${qty}${total}`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Receipt ${sale.saleNumber}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    width: 300px;
    margin: 0 auto;
    padding: 12px 8px;
    color: #000;
    background: #fff;
  }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .large { font-size: 16px; }
  .small { font-size: 10px; }
  .sep { border: none; border-top: 1px dashed #000; margin: 8px 0; }
  .row { display: flex; justify-content: space-between; margin: 2px 0; }
  .row-item { display: flex; justify-content: space-between; margin: 3px 0; font-size: 11px; }
  .item-name { flex: 1; padding-right: 6px; }
  .item-qty { width: 30px; text-align: center; }
  .item-price { width: 70px; text-align: right; }
  .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; margin: 4px 0; }
  .muted { color: #555; }
  @media print {
    @page { margin: 0; size: 80mm auto; }
    body { width: 100%; padding: 8px 4px; }
  }
</style>
</head>
<body>
${store.logo ? `<div class="center" style="margin-bottom:6px"><img src="${store.logo}" style="max-height:60px;max-width:200px;object-fit:contain"/></div>` : ''}
<div class="center bold large">${store.name || 'StockFlow POS'}</div>
${store.tagline ? `<div class="center small muted">${store.tagline}</div>` : ''}
${buildAddress(store.address) ? `<div class="center small muted">${buildAddress(store.address)}</div>` : ''}
${store.phone ? `<div class="center small muted">Tel: ${store.phone}</div>` : ''}
${store.taxNumber ? `<div class="center small muted">NTN: ${store.taxNumber}</div>` : ''}
<hr class="sep"/>
<div class="center small">${sale.saleNumber}</div>
<div class="center small">${date}</div>
${sale.warehouse?.name ? `<div class="center small">Warehouse: ${sale.warehouse.name}</div>` : ''}
${sale.customer?.name ? `<div class="center small">Customer: ${sale.customer.name}</div>` : ''}
<hr class="sep"/>
<div class="row small muted"><span>ITEM</span><span>QTY</span><span>AMOUNT</span></div>
<hr class="sep"/>
${sale.items.map(item => `
<div class="row-item">
  <span class="item-name">${item.productName || ''}</span>
  <span class="item-qty">${item.quantity}</span>
  <span class="item-price">${fmt(item.total, store.currency)}</span>
</div>
<div class="small muted" style="padding-left:0;margin-bottom:2px">@ ${fmt(item.unitPrice, store.currency)}${item.discount > 0 ? ` - ${item.discount}% disc` : ''}</div>
`).join('')}
<hr class="sep"/>
<div class="row"><span class="muted">Subtotal</span><span>${fmt(sale.subtotal, store.currency)}</span></div>
${sale.taxAmount > 0 ? `<div class="row"><span class="muted">Tax</span><span>${fmt(sale.taxAmount, store.currency)}</span></div>` : ''}
${sale.discountAmount > 0 ? `<div class="row"><span class="muted">Discount</span><span>-${fmt(sale.discountAmount, store.currency)}</span></div>` : ''}
<hr class="sep"/>
<div class="total-row"><span>TOTAL</span><span>${fmt(sale.grandTotal, store.currency)}</span></div>
<div class="row"><span class="muted">Paid (${sale.paymentMethod})</span><span>${fmt(sale.amountPaid, store.currency)}</span></div>
${sale.changeAmount > 0 ? `<div class="row"><span class="muted">Change</span><span>${fmt(sale.changeAmount, store.currency)}</span></div>` : ''}
<hr class="sep"/>
<div class="center small" style="margin-top:6px">${store.receiptFooter || 'Thank you for your purchase!'}</div>
${store.website ? `<div class="center small muted" style="margin-top:2px">${store.website}</div>` : ''}
<br/><br/>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=340,height=600');
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 400);
}

function printFullPage(sale, store = {}) {
  const date = new Date(sale.createdAt).toLocaleString('en-PK', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Invoice ${sale.saleNumber}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #1a1a2e; background: #fff; }
  .page { max-width: 760px; margin: 0 auto; padding: 40px 48px; }
  /* Header */
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; }
  .brand-name { font-size: 28px; font-weight: 900; color: #6c63ff; letter-spacing: -1px; }
  .brand-tagline { font-size: 11px; color: #888; margin-top: 2px; }
  .invoice-meta { text-align: right; }
  .invoice-title { font-size: 20px; font-weight: 700; color: #1a1a2e; }
  .invoice-num { font-size: 13px; color: #6c63ff; font-weight: 600; margin-top: 4px; }
  .invoice-date { font-size: 11px; color: #888; margin-top: 2px; }
  /* Divider */
  .hline { border: none; border-top: 2px solid #6c63ff; margin: 0 0 28px; }
  .hline-thin { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
  /* Info boxes */
  .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 32px; }
  .info-box { background: #f8f8ff; border: 1px solid #e5e0ff; border-radius: 8px; padding: 14px 16px; }
  .info-box-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #6c63ff; margin-bottom: 6px; }
  .info-box-value { font-size: 13px; color: #1a1a2e; font-weight: 500; }
  .info-box-sub { font-size: 11px; color: #888; margin-top: 2px; }
  /* Table */
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead tr { background: #6c63ff; color: #fff; }
  thead th { padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; }
  thead th:last-child { text-align: right; }
  thead th:nth-child(2), thead th:nth-child(3) { text-align: center; }
  tbody tr { border-bottom: 1px solid #f0f0f0; }
  tbody tr:nth-child(even) { background: #fafafa; }
  tbody td { padding: 10px 14px; font-size: 13px; vertical-align: middle; }
  tbody td:nth-child(2), tbody td:nth-child(3) { text-align: center; color: #555; }
  tbody td:last-child { text-align: right; font-weight: 600; }
  .item-name { font-weight: 600; color: #1a1a2e; }
  .item-sku { font-size: 10px; color: #aaa; margin-top: 2px; font-family: monospace; }
  /* Totals */
  .totals { display: flex; justify-content: flex-end; margin-bottom: 32px; }
  .totals-box { width: 260px; }
  .totals-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
  .totals-row.grand { border-top: 2px solid #6c63ff; margin-top: 8px; padding-top: 10px; font-size: 16px; font-weight: 800; color: #6c63ff; }
  .totals-row .label { color: #666; }
  /* Payment */
  .payment-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; background: ${sale.paymentMethod === 'cash' ? '#d1fae5' : '#dbeafe'}; color: ${sale.paymentMethod === 'cash' ? '#065f46' : '#1e40af'}; }
  /* Footer */
  .footer { border-top: 1px solid #e5e7eb; padding-top: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
  .footer-note { font-size: 11px; color: #aaa; max-width: 340px; }
  .footer-brand { font-size: 18px; font-weight: 900; color: #e5e0ff; letter-spacing: -0.5px; }
  @media print {
    @page { margin: 15mm 15mm; size: A4 portrait; }
    body { font-size: 12px; }
    .page { padding: 0; max-width: 100%; }
  }
</style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div style="display:flex;align-items:center;gap:16px">
      ${store.logo ? `<img src="${store.logo}" style="max-height:64px;max-width:120px;object-fit:contain"/>` : ''}
      <div>
        <div class="brand-name">${store.name || 'StockFlow'}</div>
        ${store.tagline ? `<div class="brand-tagline">${store.tagline}</div>` : ''}
        ${buildAddress(store.address) ? `<div class="brand-tagline">${buildAddress(store.address)}</div>` : ''}
        ${store.phone ? `<div class="brand-tagline">Tel: ${store.phone}</div>` : ''}
        ${store.email ? `<div class="brand-tagline">${store.email}</div>` : ''}
        ${store.taxNumber ? `<div class="brand-tagline">NTN: ${store.taxNumber}</div>` : ''}
      </div>
    </div>
    <div class="invoice-meta">
      <div class="invoice-title">INVOICE</div>
      <div class="invoice-num">${sale.saleNumber}</div>
      <div class="invoice-date">${date}</div>
    </div>
  </div>
  <hr class="hline"/>

  <!-- Info boxes -->
  <div class="info-grid">
    <div class="info-box">
      <div class="info-box-label">Warehouse</div>
      <div class="info-box-value">${sale.warehouse?.name || '—'}</div>
    </div>
    <div class="info-box">
      <div class="info-box-label">Customer</div>
      <div class="info-box-value">${sale.customer?.name || 'Walk-in Customer'}</div>
      ${sale.customer?.phone ? `<div class="info-box-sub">${sale.customer.phone}</div>` : ''}
      ${sale.customer?.email ? `<div class="info-box-sub">${sale.customer.email}</div>` : ''}
    </div>
    <div class="info-box">
      <div class="info-box-label">Payment</div>
      <div class="info-box-value"><span class="payment-badge">${sale.paymentMethod}</span></div>
      <div class="info-box-sub">Paid: ${fmt(sale.amountPaid, store.currency)}</div>
      ${sale.changeAmount > 0 ? `<div class="info-box-sub">Change: ${fmt(sale.changeAmount, store.currency)}</div>` : ''}
    </div>
  </div>

  <!-- Items table -->
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th style="text-align:left">Item Description</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${sale.items.map((item, i) => `
      <tr>
        <td style="color:#aaa;font-size:11px">${i + 1}</td>
        <td>
          <div class="item-name">${item.productName || ''}</div>
          ${item.discount > 0 ? `<div style="font-size:10px;color:#16a34a">-${item.discount}% discount applied</div>` : ''}
        </td>
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:center">
          ${item.discount > 0 ? `<span style="text-decoration:line-through;color:#aaa;font-size:11px">${fmt(item.unitPrice, store.currency)}</span><br/>` : ''}
          ${fmt(item.discount > 0 ? item.unitPrice * (1 - item.discount / 100) : item.unitPrice, store.currency)}
        </td>
        <td>${fmt(item.total, store.currency)}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>

  <!-- Totals -->
  <div class="totals">
    <div class="totals-box">
      <div class="totals-row">
        <span class="label">Subtotal</span>
        <span>${fmt(sale.subtotal, store.currency)}</span>
      </div>
      ${sale.taxAmount > 0 ? `<div class="totals-row"><span class="label">Tax</span><span>${fmt(sale.taxAmount, store.currency)}</span></div>` : ''}
      ${sale.discountAmount > 0 ? `<div class="totals-row"><span class="label">Discount</span><span>-${fmt(sale.discountAmount, store.currency)}</span></div>` : ''}
      <div class="totals-row grand">
        <span>Grand Total</span>
        <span>${fmt(sale.grandTotal, store.currency)}</span>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-note">
      ${store.receiptFooter || 'Thank you for your business!'} This is a computer-generated invoice and does not require a signature.<br/>
      For queries, please reference invoice number <strong>${sale.saleNumber}</strong>.
      ${store.website ? `<br/>${store.website}` : ''}
    </div>
    <div class="footer-brand">${store.name || 'StockFlow'}</div>
  </div>
</div>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=860,height=900');
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 400);
}

function ReceiptModal({ sale, store = {}, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2 className="modal-title">Sale Complete</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--green)1a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Check size={28} color="var(--green)" />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 800 }}>StockFlow POS</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sale.saleNumber}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(sale.createdAt).toLocaleString()}</div>
        </div>

        <div className="divider" />

        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 8 }}>Items</div>
        {sale.items.map((item, i) => (
          <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ fontWeight: 500 }}>{item.productName}</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{fmt(item.total)}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8, marginTop: 1 }}>
              <span>{fmt(item.unitPrice)} × {item.quantity}</span>
              {item.discount > 0 && <span style={{ color: 'var(--accent)' }}>-{item.discount}% disc</span>}
            </div>
          </div>
        ))}

        <div className="divider" />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
            <span>{fmt(sale.subtotal)}</span>
          </div>
          {sale.taxAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>Tax</span>
              <span>{fmt(sale.taxAmount)}</span>
            </div>
          )}
          {sale.discountAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>Discount</span>
              <span style={{ color: 'var(--red)' }}>-{fmt(sale.discountAmount)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 800, marginTop: 4, padding: '8px 0', borderTop: '2px solid var(--border)' }}>
            <span>Total</span>
            <span style={{ color: 'var(--green)' }}>{fmt(sale.grandTotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--text-muted)' }}>Paid ({sale.paymentMethod})</span>
            <span>{fmt(sale.amountPaid)}</span>
          </div>
          {sale.changeAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>Change</span>
              <span style={{ color: 'var(--green)', fontWeight: 600 }}>{fmt(sale.changeAmount)}</span>
            </div>
          )}
        </div>

        <div className="divider" />
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>Thank you for your purchase!</div>

        <div className="modal-footer" style={{ gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => printThermal(sale, store)} style={{ flex: 1 }}>
            <Printer size={14} /> Thermal
          </button>
          <button className="btn btn-secondary" onClick={() => printFullPage(sale, store)} style={{ flex: 1 }}>
            <Printer size={14} /> Full Page
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            <Check size={14} /> Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default function POSPage() {
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState("flat"); // "flat" | "pct"
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "" });
  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [storeSettings, setStoreSettings] = useState({});
  const barcodeRef = useRef();

  useEffect(() => {
    const load = async () => {
      const [p, w, s] = await Promise.all([
        api.get("/products?limit=200"),
        api.get("/warehouses"),
        api.get("/settings"),
      ]);
      setProducts(p.data);
      setWarehouses(w.data);
      if (w.data.length) setSelectedWarehouse(w.data[0]._id);
      setStoreSettings(s.data || {});
    };
    load();
  }, []);

  const filtered = products.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode?.includes(search),
  );

  const getWarehouseStock = (product) => {
    if (!selectedWarehouse || !product.stock) return null;
    const inv = product.stock.find(s => s.warehouse?._id === selectedWarehouse);
    return inv ? inv.quantity : 0;
  };

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product._id === product._id);
      if (existing)
        return prev.map((i) =>
          i.product._id === product._id
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        );
      return [
        ...prev,
        { product, quantity: 1, discount: 0, unitPrice: product.sellingPrice },
      ];
    });
  };

  const updateQty = (id, delta) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.product._id === id
            ? { ...i, quantity: Math.max(0, i.quantity + delta) }
            : i,
        )
        .filter((i) => i.quantity > 0),
    );
  };

  const updateItemPrice = (id, price) =>
    setCart((prev) => prev.map((i) => i.product._id === id ? { ...i, unitPrice: Math.max(0, parseFloat(price) || 0) } : i));

  const updateItemDiscount = (id, pct) =>
    setCart((prev) => prev.map((i) => i.product._id === id ? { ...i, discount: Math.min(100, Math.max(0, parseFloat(pct) || 0)) } : i));

  const removeItem = (id) =>
    setCart((prev) => prev.filter((i) => i.product._id !== id));

  const itemsSubtotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const itemDiscountSaving = cart.reduce((s, i) => s + i.unitPrice * i.quantity * (i.discount / 100), 0);
  const subtotal = itemsSubtotal - itemDiscountSaving;
  const orderDiscountAmt = discountType === "pct" ? subtotal * (discount / 100) : discount;
  const grandTotal = Math.max(0, subtotal - orderDiscountAmt);
  const change = Math.max(0, (parseFloat(amountPaid) || 0) - grandTotal);

  const handleBarcodeSearch = async (e) => {
    if (e.key === "Enter" && barcodeInput.trim()) {
      try {
        const res = await api.get(
          `/products/by-barcode/${barcodeInput.trim()}`,
        );
        addToCart(res.data);
        setBarcodeInput("");
      } catch {
        toast.error("Product not found");
      }
    }
  };

  const checkout = async () => {
    if (!cart.length) return toast.error("Cart is empty");
    if (!selectedWarehouse) return toast.error("Select a warehouse");
    if (
      paymentMethod === "cash" &&
      amountPaid &&
      parseFloat(amountPaid) < grandTotal
    )
      return toast.error("Insufficient payment");

    setProcessing(true);
    try {
      const res = await api.post("/pos", {
        warehouse: selectedWarehouse,
        customer,
        items: cart.map((i) => ({
          product: i.product._id,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discount: i.discount,
          taxRate: i.product.taxRate || 0,
        })),
        paymentMethod,
        amountPaid: parseFloat(amountPaid) || grandTotal,
        discountAmount: orderDiscountAmt,
      });
      setReceipt(res.data);
      setCart([]);
      setDiscount(0);
      setDiscountType("flat");
      setAmountPaid("");
      setCustomer({ name: "", phone: "", email: "" });
      toast.success(`Sale ${res.data.saleNumber} completed!`);
    } catch (err) {
      toast.error(err?.message || "Sale failed");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 380px",
        height: "calc(100vh - 64px)",
        margin: "-24px",
        gap: 0,
      }}
    >
      {/* Products panel */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "var(--bg)",
          borderRight: "1px solid var(--border)",
        }}
      >
        {/* POS Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-card)",
          }}
        >
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <select
              className="form-input"
              style={{ width: 180 }}
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
            >
              <option value="">Select Warehouse</option>
              {warehouses.map((w) => (
                <option key={w._id} value={w._id}>
                  {w.name}
                </option>
              ))}
            </select>
            <div className="search-bar" style={{ flex: 1 }}>
              <Search size={16} />
              <input
                className="form-input"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div style={{ position: "relative" }}>
              <input
                ref={barcodeRef}
                className="form-input"
                style={{ paddingLeft: 36, width: 200 }}
                placeholder="Scan barcode..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={handleBarcodeSearch}
              />
              <QrCode
                size={16}
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-dim)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Products grid */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {filtered.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: 200,
                color: "var(--text-muted)",
              }}
            >
              <ShoppingCart
                size={36}
                style={{ marginBottom: 10, opacity: 0.3 }}
              />
              <div>No products found</div>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
                gap: 12,
              }}
            >
              {filtered.map((p) => (
                <button
                  key={p._id}
                  onClick={() => addToCart(p)}
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: 0,
                    cursor: "pointer",
                    transition:
                      "border-color 0.15s, transform 0.15s, box-shadow 0.15s",
                    textAlign: "left",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--accent)";
                    e.currentTarget.style.transform = "translateY(-3px)";
                    e.currentTarget.style.boxShadow =
                      "0 8px 24px rgba(108,99,255,0.2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {/* Image area */}
                  <div
                    style={{
                      width: "100%",
                      height: 120,
                      background: "var(--bg-elevated)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      flexShrink: 0,
                      position: "relative",
                    }}
                  >
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          background: `linear-gradient(135deg, var(--accent-dim) 0%, var(--bg-elevated) 100%)`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <ShoppingCart
                          size={28}
                          color="var(--accent)"
                          style={{ opacity: 0.5 }}
                        />
                      </div>
                    )}
                    {/* Price badge */}
                    <div
                      style={{
                        position: "absolute",
                        bottom: 6,
                        right: 6,
                        background: "var(--accent)",
                        color: "#fff",
                        borderRadius: 8,
                        padding: "3px 8px",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Rs {p.sellingPrice}
                    </div>
                  </div>
                  {/* Info */}
                  <div style={{ padding: "10px 12px 12px" }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 14,
                        color: "var(--text)",
                        lineHeight: 1.3,
                        marginBottom: 4,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {p.name}
                    </div>
                    {p.brand?.name && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--accent)",
                          fontWeight: 500,
                          marginBottom: 2,
                        }}
                      >
                        {p.brand.name}
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {p.sku}
                    </div>
                    {(() => {
                      const stock = getWarehouseStock(p);
                      if (stock === null) return null;
                      const isOut = stock === 0;
                      const isLow = !isOut && stock <= (p.reorderPoint || 10);
                      return (
                        <div style={{
                          marginTop: 5,
                          fontSize: 10,
                          fontWeight: 600,
                          color: isOut ? 'var(--red)' : isLow ? 'var(--yellow)' : 'var(--green)',
                        }}>
                          {isOut ? 'Out of stock' : `Stock: ${stock}`}
                        </div>
                      );
                    })()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart panel */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-card)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <ShoppingCart size={16} color="var(--accent)" /> Cart
            {cart.length > 0 && (
              <span
                style={{
                  marginLeft: "auto",
                  background: "var(--accent)",
                  color: "#fff",
                  borderRadius: 99,
                  padding: "2px 8px",
                  fontSize: 12,
                }}
              >
                {cart.length}
              </span>
            )}
          </div>
          {/* Customer */}
          <div
            style={{
              marginTop: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <input
              className="form-input"
              placeholder="Customer name (optional)"
              style={{ fontSize: 12 }}
              value={customer.name}
              onChange={(e) =>
                setCustomer((p) => ({ ...p, name: e.target.value }))
              }
            />
            <input
              className="form-input"
              placeholder="Phone (optional)"
              style={{ fontSize: 12 }}
              value={customer.phone}
              onChange={(e) =>
                setCustomer((p) => ({ ...p, phone: e.target.value }))
              }
            />
          </div>
        </div>

        {/* Cart items */}
        <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
          {cart.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <ShoppingCart style={{ width: 32, height: 32 }} />
              <p>Cart is empty</p>
            </div>
          ) : (
            cart.map((item) => {
              const lineTotal = item.unitPrice * item.quantity * (1 - item.discount / 100);
              const hasDiscount = item.discount > 0;
              return (
                <div key={item.product._id} className="cart-item">
                  {/* Name row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ fontWeight: 500, fontSize: 13, lineHeight: 1.3, flex: 1 }}>{item.product.name}</div>
                    <button onClick={() => removeItem(item.product._id)} style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", padding: 2, marginLeft: 4 }}>
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Price + discount inputs */}
                  <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>Price</div>
                      <input
                        type="number"
                        className="form-input"
                        style={{ padding: "3px 6px", fontSize: 12, width: "100%" }}
                        value={item.unitPrice}
                        onChange={(e) => updateItemPrice(item.product._id, e.target.value)}
                      />
                    </div>
                    <div style={{ width: 72 }}>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>Disc %</div>
                      <input
                        type="number"
                        className="form-input"
                        style={{ padding: "3px 6px", fontSize: 12, width: "100%", borderColor: hasDiscount ? "var(--accent)" : undefined }}
                        min="0" max="100"
                        value={item.discount || ""}
                        placeholder="0"
                        onChange={(e) => updateItemDiscount(item.product._id, e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Qty + line total */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button onClick={() => updateQty(item.product._id, -1)} style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                        <Minus size={12} />
                      </button>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, minWidth: 20, textAlign: "center" }}>{item.quantity}</span>
                      <button onClick={() => updateQty(item.product._id, 1)} style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                        <Plus size={12} />
                      </button>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {hasDiscount && (
                        <div style={{ fontSize: 10, color: "var(--text-muted)", textDecoration: "line-through" }}>
                          {fmt(item.unitPrice * item.quantity)}
                        </div>
                      )}
                      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--green)", fontSize: 14 }}>
                        {fmt(lineTotal)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Totals & payment */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid var(--border)",
            background: "var(--bg-elevated)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text-muted)" }}>Items subtotal</span>
              <span>{fmt(itemsSubtotal)}</span>
            </div>
            {itemDiscountSaving > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--accent)" }}>
                <span>Item discounts</span>
                <span>-{fmt(itemDiscountSaving)}</span>
              </div>
            )}
            {itemDiscountSaving > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "var(--text-muted)" }}>After item discounts</span>
                <span>{fmt(subtotal)}</span>
              </div>
            )}

            {/* Order-level discount */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, fontSize: 13 }}>
              <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>Order discount</span>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <button
                  onClick={() => setDiscountType("flat")}
                  style={{ padding: "2px 8px", fontSize: 11, borderRadius: 4, border: "1px solid var(--border)", background: discountType === "flat" ? "var(--accent)" : "var(--bg)", color: discountType === "flat" ? "#fff" : "var(--text-muted)", cursor: "pointer", fontWeight: 600 }}
                >Rs</button>
                <button
                  onClick={() => setDiscountType("pct")}
                  style={{ padding: "2px 8px", fontSize: 11, borderRadius: 4, border: "1px solid var(--border)", background: discountType === "pct" ? "var(--accent)" : "var(--bg)", color: discountType === "pct" ? "#fff" : "var(--text-muted)", cursor: "pointer", fontWeight: 600 }}
                >%</button>
                <input
                  type="number"
                  className="form-input"
                  style={{ width: 70, padding: "4px 6px", fontSize: 12, textAlign: "right" }}
                  min="0"
                  max={discountType === "pct" ? 100 : undefined}
                  value={discount || ""}
                  placeholder="0"
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
            {orderDiscountAmt > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--red)" }}>
                <span>Discount saving</span>
                <span>-{fmt(orderDiscountAmt)}</span>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 17, paddingTop: 8, borderTop: "2px solid var(--border)", marginTop: 2 }}>
              <span>Total</span>
              <span style={{ color: "var(--green)" }}>{fmt(grandTotal)}</span>
            </div>
          </div>

          {/* Payment method */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 12,
            }}
          >
            {[
              { id: "cash", icon: Banknote, label: "Cash" },
              { id: "card", icon: CreditCard, label: "Card" },
              { id: "bank_transfer", icon: CreditCard, label: "Bank" },
              { id: "cheque", icon: CreditCard, label: "Cheque" },
            ].map((pm) => (
              <button
                key={pm.id}
                onClick={() => setPaymentMethod(pm.id)}
                className={`btn ${paymentMethod === pm.id ? "btn-primary" : "btn-secondary"} btn-sm`}
                style={{ justifyContent: "center" }}
              >
                <pm.icon size={13} />
                {pm.label}
              </button>
            ))}
          </div>

          {paymentMethod === "cash" && (
            <div style={{ marginBottom: 12 }}>
              <input
                className="form-input"
                type="number"
                placeholder="Amount received"
                style={{ marginBottom: 4 }}
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
              />
              {change > 0 && (
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--yellow)",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>Change:</span>
                  <span>{fmt(change)}</span>
                </div>
              )}
            </div>
          )}

          <button
            className="btn btn-success w-full"
            style={{
              justifyContent: "center",
              padding: 12,
              fontSize: 15,
              fontWeight: 700,
            }}
            onClick={checkout}
            disabled={processing || !cart.length}
          >
            {processing ? (
              <span className="spinner" />
            ) : (
              <>
                <Check size={16} /> Complete Sale
              </>
            )}
          </button>
        </div>
      </div>

      {receipt && (
        <ReceiptModal sale={receipt} store={storeSettings} onClose={() => setReceipt(null)} />
      )}
    </div>
  );
}
