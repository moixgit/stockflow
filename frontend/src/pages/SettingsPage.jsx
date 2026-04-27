import React, { useState, useEffect } from 'react';
import api, { BACKEND_URL } from '../utils/api.js';
import toast from 'react-hot-toast';
import { Save, Upload, Store, MapPin, Phone, Globe, FileText, X } from 'lucide-react';

const DEFAULT = {
  name: '', tagline: '', logo: '',
  phone: '', email: '', website: '', taxNumber: '', currency: 'Rs',
  receiptFooter: 'Thank you for your purchase!',
  address: { street: '', city: '', state: '', country: '', zip: '' },
};

function Section({ icon: Icon, title, children }) {
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent)1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={16} color="var(--accent)" />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>{title}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</label>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const [form, setForm] = useState(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api.get('/settings').then(res => {
      if (res.data && Object.keys(res.data).length) {
        setForm(f => ({ ...DEFAULT, ...res.data, address: { ...DEFAULT.address, ...(res.data.address || {}) } }));
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const setAddr = (key, val) => setForm(f => ({ ...f, address: { ...f.address, [key]: val } }));

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('logo', file);
    setUploading(true);
    try {
      const res = await api.post('/settings/logo', fd);
      set('logo', BACKEND_URL + res.url);
      toast.success('Logo uploaded');
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/settings', form);
      toast.success('Settings saved');
    } catch (err) { toast.error(err.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="loading-page"><div className="spinner" style={{ width: 32, height: 32 }} /></div>;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Store Settings</h1>
          <p className="page-subtitle">Configure your store details used across the system and on printed receipts</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={15} /> {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {/* Identity */}
      <Section icon={Store} title="Store Identity">
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 28, alignItems: 'start' }}>
          {/* Logo */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 160, height: 160, borderRadius: 12, border: '2px dashed var(--border)', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
              {form.logo ? (
                <>
                  <img src={form.logo} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  <button
                    onClick={() => set('logo', '')}
                    style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: 'var(--red)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={12} color="#fff" />
                  </button>
                </>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Store size={32} style={{ opacity: 0.3 }} />
                  <div style={{ fontSize: 11, marginTop: 6 }}>No logo</div>
                </div>
              )}
            </div>
            <label style={{ cursor: 'pointer' }}>
              <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
              <span className="btn btn-secondary" style={{ fontSize: 12, gap: 6 }}>
                <Upload size={13} /> {uploading ? 'Uploading…' : 'Upload Logo'}
              </span>
            </label>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>PNG, JPG up to 5MB</div>
          </div>

          {/* Name / tagline / currency */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Store Name *">
              <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. My Store" />
            </Field>
            <Field label="Tagline / Slogan">
              <input className="input" value={form.tagline} onChange={e => set('tagline', e.target.value)} placeholder="e.g. Quality you can trust" />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Currency Symbol">
                <input className="input" value={form.currency} onChange={e => set('currency', e.target.value)} placeholder="Rs" />
              </Field>
              <Field label="Tax / NTN Number">
                <input className="input" value={form.taxNumber} onChange={e => set('taxNumber', e.target.value)} placeholder="NTN-0000000-0" />
              </Field>
            </div>
          </div>
        </div>
      </Section>

      {/* Contact */}
      <Section icon={Phone} title="Contact Information">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Phone">
            <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+92 300 0000000" />
          </Field>
          <Field label="Email">
            <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="store@example.com" />
          </Field>
          <Field label="Website">
            <input className="input" value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://example.com" />
          </Field>
        </div>
      </Section>

      {/* Address */}
      <Section icon={MapPin} title="Store Address">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="Street Address">
            <input className="input" value={form.address.street} onChange={e => setAddr('street', e.target.value)} placeholder="123 Main Street, Shop #5" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Field label="City">
              <input className="input" value={form.address.city} onChange={e => setAddr('city', e.target.value)} placeholder="Karachi" />
            </Field>
            <Field label="State / Province">
              <input className="input" value={form.address.state} onChange={e => setAddr('state', e.target.value)} placeholder="Sindh" />
            </Field>
            <Field label="ZIP / Postal Code">
              <input className="input" value={form.address.zip} onChange={e => setAddr('zip', e.target.value)} placeholder="75500" />
            </Field>
          </div>
          <Field label="Country">
            <input className="input" value={form.address.country} onChange={e => setAddr('country', e.target.value)} placeholder="Pakistan" />
          </Field>
        </div>
      </Section>

      {/* Receipt */}
      <Section icon={FileText} title="Receipt & Invoice">
        <Field label="Receipt Footer Message">
          <textarea
            className="input"
            value={form.receiptFooter}
            onChange={e => set('receiptFooter', e.target.value)}
            rows={3}
            placeholder="Thank you for your purchase! Please keep this receipt."
            style={{ resize: 'vertical' }}
          />
        </Field>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
          This message appears at the bottom of all printed receipts and invoices.
        </div>
      </Section>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 32 }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ minWidth: 140 }}>
          <Save size={15} /> {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
