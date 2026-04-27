import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function BarcodePage() {
  const [activeTab, setActiveTab] = useState('generator');
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [customBarcode, setCustomBarcode] = useState('');
  const [barcodeType, setBarcodeType] = useState('code128');
  const [barcodeImg, setBarcodeImg] = useState(null);
  const [loadingBarcode, setLoadingBarcode] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [manualScan, setManualScan] = useState('');
  const [foundProduct, setFoundProduct] = useState(null);
  const [printCount, setPrintCount] = useState(1);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scannerRef = useRef(null);

  useEffect(() => {
    fetchProducts();
    return () => stopCamera();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products?limit=200');
      setProducts(res.data || []);
    } catch {}
  };

  const generateBarcode = async () => {
    const barcode = customBarcode || products.find(p => p._id === selectedProduct)?.barcode;
    if (!barcode) return toast.error('Select a product or enter a barcode');
    setLoadingBarcode(true);
    try {
      const res = await api.get(`/barcode/generate/${barcode}?type=${barcodeType}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      setBarcodeImg(url);
    } catch {
      toast.error('Failed to generate barcode');
    } finally {
      setLoadingBarcode(false);
    }
  };

  const generateForProduct = async (productId) => {
    try {
      const res = await api.get(`/barcode/product/${productId}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      setBarcodeImg(url);
      setActiveTab('generator');
    } catch {
      toast.error('Failed to generate barcode');
    }
  };

  const printBarcode = () => {
    if (!barcodeImg) return;
    const win = window.open('', '_blank');
    const labels = Array(Number(printCount)).fill(
      `<img src="${barcodeImg}" style="display:block;margin:4px;" />`
    ).join('');
    win.document.write(`
      <html><head><title>Print Barcode</title>
      <style>body{margin:0;display:flex;flex-wrap:wrap;gap:8px;padding:8px;} img{width:200px;}</style>
      </head><body>${labels}<script>window.onload=()=>{window.print();window.close();}<\/script></body></html>
    `);
    win.document.close();
  };

  const downloadBarcode = () => {
    if (!barcodeImg) return;
    const a = document.createElement('a');
    a.href = barcodeImg;
    a.download = `barcode-${customBarcode || 'product'}.png`;
    a.click();
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setScanning(true);
      startZXing();
    } catch {
      toast.error('Camera access denied. Use manual entry below.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (scannerRef.current) {
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const startZXing = async () => {
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/library');
      const reader = new BrowserMultiFormatReader();
      scannerRef.current = reader;
      reader.decodeFromVideoDevice(null, videoRef.current, async (result, err) => {
        if (result) {
          const code = result.getText();
          setScanResult(code);
          stopCamera();
          await lookupBarcode(code);
        }
      });
    } catch {
      // zxing not available, manual mode only
    }
  };

  const lookupBarcode = async (code) => {
    try {
      const res = await api.get(`/products/by-barcode/${code}`);
      setFoundProduct(res.data);
      toast.success('Product found!');
    } catch {
      setFoundProduct(null);
      toast.error('No product found for this barcode');
    }
  };

  const handleManualScan = async (e) => {
    e.preventDefault();
    if (!manualScan.trim()) return;
    setScanResult(manualScan.trim());
    await lookupBarcode(manualScan.trim());
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Barcode Center</h1>
          <p className="page-subtitle">Generate, print & scan product barcodes</p>
        </div>
      </div>

      <div className="tab-bar" style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {['generator', 'scanner', 'bulk'].map(tab => (
          <button
            key={tab}
            className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'generator' && '⚡ '}
            {tab === 'scanner' && '📷 '}
            {tab === 'bulk' && '📦 '}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* GENERATOR TAB */}
      {activeTab === 'generator' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div className="card">
            <h3 style={{ marginBottom: '20px', color: 'var(--text-primary)' }}>Generate Barcode</h3>

            <div className="form-group">
              <label className="form-label">Select Product</label>
              <select
                className="form-input"
                value={selectedProduct}
                onChange={e => { setSelectedProduct(e.target.value); setCustomBarcode(''); }}
              >
                <option value="">-- Choose product --</option>
                {products.map(p => (
                  <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>
                ))}
              </select>
            </div>

            <div style={{ textAlign: 'center', color: 'var(--text-muted)', margin: '12px 0' }}>— or —</div>

            <div className="form-group">
              <label className="form-label">Custom Barcode Value</label>
              <input
                className="form-input"
                placeholder="Enter barcode number..."
                value={customBarcode}
                onChange={e => { setCustomBarcode(e.target.value); setSelectedProduct(''); }}
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Barcode Type</label>
              <select className="form-input" value={barcodeType} onChange={e => setBarcodeType(e.target.value)}>
                <option value="code128">Code 128 (General)</option>
                <option value="ean13">EAN-13 (Retail)</option>
                <option value="ean8">EAN-8 (Small items)</option>
                <option value="upca">UPC-A (North America)</option>
                <option value="qrcode">QR Code</option>
                <option value="pdf417">PDF417</option>
                <option value="datamatrix">Data Matrix</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Print Quantity</label>
              <input
                type="number"
                className="form-input"
                min="1"
                max="100"
                value={printCount}
                onChange={e => setPrintCount(e.target.value)}
              />
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={generateBarcode}
              disabled={loadingBarcode}
            >
              {loadingBarcode ? '⏳ Generating...' : '⚡ Generate Barcode'}
            </button>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '360px' }}>
            {barcodeImg ? (
              <>
                <div style={{
                  background: 'white',
                  padding: '24px',
                  borderRadius: '12px',
                  marginBottom: '20px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
                }}>
                  <img src={barcodeImg} alt="barcode" style={{ maxWidth: '100%', display: 'block' }} />
                </div>
                {selectedProduct && (() => {
                  const p = products.find(x => x._id === selectedProduct);
                  return p ? (
                    <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.name}</div>
                      <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{p.sku}</div>
                    </div>
                  ) : null;
                })()}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn btn-primary" onClick={printBarcode}>🖨️ Print ×{printCount}</button>
                  <button className="btn btn-ghost" onClick={downloadBarcode}>⬇️ Download</button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '64px', marginBottom: '16px' }}>▦</div>
                <div>Configure options and click Generate</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SCANNER TAB */}
      {activeTab === 'scanner' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div className="card">
            <h3 style={{ marginBottom: '20px', color: 'var(--text-primary)' }}>Scan Barcode</h3>

            <div style={{
              background: 'var(--bg-tertiary)',
              borderRadius: '12px',
              overflow: 'hidden',
              aspectRatio: '4/3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              position: 'relative',
              border: scanning ? '2px solid var(--accent)' : '2px solid var(--border)'
            }}>
              <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', display: scanning ? 'block' : 'none' }} />
              {!scanning && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>📷</div>
                  <div>Camera preview will appear here</div>
                </div>
              )}
              {scanning && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '10%',
                  right: '10%',
                  height: '2px',
                  background: 'var(--accent)',
                  transform: 'translateY(-50%)',
                  boxShadow: '0 0 8px var(--accent)',
                  animation: 'scan-line 2s ease-in-out infinite'
                }} />
              )}
            </div>

            <style>{`
              @keyframes scan-line {
                0%, 100% { top: 20%; }
                50% { top: 80%; }
              }
            `}</style>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              {!scanning ? (
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={startCamera}>
                  📷 Start Camera
                </button>
              ) : (
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={stopCamera}>
                  ⏹ Stop Camera
                </button>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '12px' }}>
                Or enter barcode manually:
              </p>
              <form onSubmit={handleManualScan} style={{ display: 'flex', gap: '8px' }}>
                <input
                  className="form-input"
                  style={{ flex: 1, fontFamily: 'var(--font-mono)' }}
                  placeholder="Scan or type barcode..."
                  value={manualScan}
                  onChange={e => setManualScan(e.target.value)}
                  autoFocus
                />
                <button type="submit" className="btn btn-primary">Search</button>
              </form>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '20px', color: 'var(--text-primary)' }}>Scan Result</h3>
            {foundProduct ? (
              <div>
                <div style={{
                  background: 'rgba(34,211,160,0.1)',
                  border: '1px solid var(--green)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ color: 'var(--green)', fontSize: '18px' }}>✓</span>
                  <div>
                    <div style={{ color: 'var(--green)', fontWeight: 600 }}>Product Found</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>{scanResult}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    ['Product Name', foundProduct.name],
                    ['SKU', foundProduct.sku],
                    ['Barcode', foundProduct.barcode],
                    ['Category', foundProduct.category?.name || 'N/A'],
                    ['Selling Price', `Rs ${foundProduct.sellingPrice?.toFixed(2)}`],
                    ['Cost Price', `Rs ${foundProduct.costPrice?.toFixed(2)}`],
                    ['Unit', foundProduct.unit],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{label}</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontFamily: label === 'SKU' || label === 'Barcode' ? 'var(--font-mono)' : 'inherit' }}>{value}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => generateForProduct(foundProduct._id)}>
                    ⚡ Generate Barcode
                  </button>
                  <button className="btn btn-ghost" onClick={() => { setFoundProduct(null); setScanResult(null); setManualScan(''); }}>
                    Clear
                  </button>
                </div>
              </div>
            ) : scanResult ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>❌</div>
                <div style={{ color: 'var(--red)', fontWeight: 600, marginBottom: '8px' }}>No Product Found</div>
                <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{scanResult}</div>
                <button className="btn btn-ghost" style={{ marginTop: '16px' }} onClick={() => { setFoundProduct(null); setScanResult(null); setManualScan(''); }}>
                  Try Again
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔍</div>
                <div>Scan a barcode to look up product details</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BULK TAB */}
      {activeTab === 'bulk' && (
        <div className="card">
          <h3 style={{ marginBottom: '4px', color: 'var(--text-primary)' }}>Bulk Barcode Generator</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '14px' }}>Generate barcodes for all products at once</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {products.map(product => (
              <div key={product._id} style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{product.name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>{product.sku}</div>
                  </div>
                  <span className={`badge ${product.isActive ? 'badge-success' : 'badge-danger'}`}>
                    {product.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {product.barcode && (
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    background: 'var(--bg)',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    wordBreak: 'break-all'
                  }}>
                    {product.barcode}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                  {product.barcode ? (
                    <>
                      <button
                        className="btn btn-primary"
                        style={{ flex: 1, fontSize: '12px', padding: '6px 10px' }}
                        onClick={() => generateForProduct(product._id)}
                      >
                        ⚡ Generate
                      </button>
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic' }}>No barcode assigned</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
