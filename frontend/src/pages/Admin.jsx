import React, { useState, useEffect } from 'react';
import { T, mono } from '../utils/theme';
import { fetchApps, fetchHealthchecks as fetchHCs, adminLogin, adminSaveApp, adminDeleteApp, adminSaveHealthcheck, adminDeleteHealthcheck } from '../utils/api';
import Header from '../components/common/Header';
import { Footer } from '../components/common/Shared';
import Card from '../components/common/Card';

export default function Admin() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [apps, setApps] = useState([]);
  const [healthchecks, setHealthchecks] = useState([]);
  const [editingApp, setEditingApp] = useState(null);
  const [editingHC, setEditingHC] = useState(null);
  const [activeTab, setActiveTab] = useState('apps');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = 'Admin Panel - SandboxAI';
    if (isLoggedIn) {
      loadApps();
      loadHealthchecks();
    }
  }, [isLoggedIn]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const { ok, data } = await adminLogin(password);
      if (ok) {
        setIsLoggedIn(true);
        setApiKey(data.api_key);
        setPassword('');
      } else {
        setError('Invalid password');
      }
    } catch {
      setError('Connection error');
    }
  };

  const loadApps = async () => {
    try {
      const data = await fetchApps();
      setApps(data.apps);
    } catch (err) {}
  };

  const loadHealthchecks = async () => {
    try {
      const data = await fetchHCs();
      setHealthchecks(data.healthchecks);
    } catch (err) {}
  };

  const handleDeleteApp = async (id) => {
    if (!confirm('Delete this application?')) return;
    if (await adminDeleteApp(id, apiKey)) loadApps();
  };

  const handleDeleteHC = async (id) => {
    if (!confirm('Delete this healthcheck?')) return;
    if (await adminDeleteHealthcheck(id, apiKey)) loadHealthchecks();
  };

  const handleSaveApp = async (app) => {
    setSaving(true);
    if (await adminSaveApp(app, apiKey)) {
      setEditingApp(null);
      loadApps();
    }
    setSaving(false);
  };

  const handleSaveHC = async (hc) => {
    setSaving(true);
    if (await adminSaveHealthcheck(hc, apiKey)) {
      setEditingHC(null);
      loadHealthchecks();
    }
    setSaving(false);
  };

  // ─── LOGIN SCREEN ───
  if (!isLoggedIn) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="animate-fade-in-up">
          <Card style={{ maxWidth: 400, width: '100%', textAlign: 'center', padding: '48px 40px' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: T.accentSurface,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: 24,
              }}
            >
              ⚙️
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: T.text }}>Admin Panel</h2>
            <p style={{ fontSize: 13, color: T.textDim, marginBottom: 24 }}>Enter password to continue</p>
            <form onSubmit={handleLogin}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: `1px solid ${error ? T.red : T.border}`,
                  background: T.bgInput,
                  color: T.text,
                  fontSize: 14,
                  fontFamily: 'inherit',
                  outline: 'none',
                  marginBottom: error ? 12 : 16,
                  transition: 'border-color 0.2s',
                }}
              />
              {error && (
                <div style={{ padding: '10px 14px', background: T.redSurface, color: T.red, borderRadius: 8, fontSize: 13, marginBottom: 16, fontWeight: 500 }}>
                  {error}
                </div>
              )}
              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '12px 0',
                  borderRadius: 10,
                  border: 'none',
                  background: `linear-gradient(135deg, ${T.accent}, ${T.purple})`,
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                }}
              >
                Login
              </button>
            </form>
            <button
              onClick={() => (window.location.href = '/')}
              style={{
                width: '100%',
                padding: '12px 0',
                background: 'transparent',
                color: T.textDim,
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                cursor: 'pointer',
                marginTop: 12,
                fontFamily: 'inherit',
              }}
            >
              ← Back to Dashboard
            </button>
          </Card>
        </div>
      </div>
    );
  }

  // ─── ADMIN PANEL ───
  const tabs = [
    { key: 'apps', label: 'Applications', count: apps.length },
    { key: 'healthchecks', label: 'Health Checks', count: healthchecks.length },
  ];

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', flexDirection: 'column' }}>
      <Header />

      {/* Tabs */}
      <div style={{ position: 'sticky', top: 60, zIndex: 99, background: 'rgba(10,14,26,0.9)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ maxWidth: 1440, margin: '0 auto', padding: '8px 32px', display: 'flex', gap: 4 }}>
          <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: 3 }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  padding: '8px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: activeTab === t.key ? T.accent : 'transparent',
                  color: activeTab === t.key ? '#fff' : T.textDim,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {t.label}
                <span
                  style={{
                    fontFamily: mono,
                    fontSize: 10,
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: activeTab === t.key ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)',
                  }}
                >
                  {t.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <main style={{ flex: 1, maxWidth: 1440, margin: '0 auto', padding: '28px 32px', width: '100%' }}>
        <div className="animate-fade-in">
          {activeTab === 'apps' && (
            <AppsManager
              apps={apps}
              editing={editingApp}
              saving={saving}
              onEdit={setEditingApp}
              onSave={handleSaveApp}
              onDelete={handleDeleteApp}
              onCancel={() => setEditingApp(null)}
            />
          )}
          {activeTab === 'healthchecks' && (
            <HealthchecksManager
              healthchecks={healthchecks}
              editing={editingHC}
              saving={saving}
              onEdit={setEditingHC}
              onSave={handleSaveHC}
              onDelete={handleDeleteHC}
              onCancel={() => setEditingHC(null)}
            />
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

// ─── INPUT COMPONENT ─────────────────────────────────────────────────────

function Input({ label, ...props }) {
  return (
    <div>
      {label && <label style={{ display: 'block', fontSize: 11, color: T.textDim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</label>}
      <input
        {...props}
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: 8,
          border: `1px solid ${T.border}`,
          background: T.bgInput,
          color: T.text,
          fontSize: 13,
          fontFamily: 'inherit',
          outline: 'none',
          transition: 'border-color 0.2s',
          ...props.style,
        }}
      />
    </div>
  );
}

function Select({ label, children, ...props }) {
  return (
    <div>
      {label && <label style={{ display: 'block', fontSize: 11, color: T.textDim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</label>}
      <select
        {...props}
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: 8,
          border: `1px solid ${T.border}`,
          background: T.bgElevated,
          color: T.text,
          fontSize: 13,
          fontFamily: 'inherit',
          outline: 'none',
          cursor: 'pointer',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%235b6480' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 14px center',
          paddingRight: 38,
          ...props.style,
        }}
      >
        {children}
      </select>
      <style>{`
        select option {
          background: #0f1424;
          color: #e8edf5;
          padding: 8px 14px;
        }
        select option:checked {
          background: #6366f1;
          color: white;
        }
        select option:hover {
          background: rgba(99,102,241,0.2);
        }
      `}</style>
    </div>
  );
}

function Btn({ children, variant = 'primary', ...props }) {
  const styles = {
    primary: { background: T.accent, color: '#fff', border: 'none' },
    danger: { background: T.redSurface, color: T.red, border: `1px solid rgba(239,68,68,0.2)` },
    ghost: { background: 'transparent', color: T.textDim, border: `1px solid ${T.border}` },
  };
  const s = styles[variant] || styles.primary;

  return (
    <button
      {...props}
      style={{
        padding: '8px 18px',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'inherit',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        ...s,
        ...props.style,
      }}
    >
      {children}
    </button>
  );
}

// ─── APPS MANAGER ────────────────────────────────────────────────────────

function AppsManager({ apps, editing, saving, onEdit, onSave, onDelete, onCancel }) {
  const [form, setForm] = useState({ name: '', description: '', url: '', icon: '' });

  useEffect(() => {
    if (editing) setForm(editing);
  }, [editing]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
    if (!editing) setForm({ name: '', description: '', url: '', icon: '' });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }}>
      {/* Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Applications</span>
          <Btn
            onClick={() => {
              onCancel();
              setForm({ name: '', description: '', url: '', icon: '' });
              onEdit(null);
            }}
          >
            + Add New
          </Btn>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Icon', 'Name', 'URL', ''].map((h) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: h === '' ? 'right' : 'left', fontSize: 11, color: T.textDim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${T.border}` }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {apps.map((app) => (
              <tr key={app.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                <td style={{ padding: '12px 16px', fontSize: 20 }}>{app.icon}</td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: T.text }}>{app.name}</div>
                  <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>{app.description}</div>
                </td>
                <td style={{ padding: '12px 16px', fontFamily: mono, fontSize: 11, color: T.textDim }}>{app.url}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <Btn variant="ghost" onClick={() => onEdit(app)}>Edit</Btn>
                    <Btn variant="danger" onClick={() => onDelete(app.id)}>Delete</Btn>
                  </div>
                </td>
              </tr>
            ))}
            {apps.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 32, textAlign: 'center', color: T.textDim, fontSize: 13 }}>No applications yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Form */}
      <Card>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 20 }}>
          {editing ? 'Edit Application' : 'New Application'}
        </h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 14 }}>
            <Input label="Name" placeholder="My App" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input label="Icon" placeholder="🚀" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} required />
          </div>
          <Input label="Description" placeholder="What does this app do?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input label="URL" type="url" placeholder="http://..." value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} required />
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <Btn type="submit" style={{ flex: 1, opacity: saving ? 0.6 : 1 }} disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Update' : 'Add Application'}
            </Btn>
            {editing && (
              <Btn
                type="button"
                variant="ghost"
                onClick={() => {
                  onCancel();
                  setForm({ name: '', description: '', url: '', icon: '' });
                }}
              >
                Cancel
              </Btn>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}

// ─── HEALTHCHECKS MANAGER ────────────────────────────────────────────────

function HealthchecksManager({ healthchecks, editing, saving, onEdit, onSave, onDelete, onCancel }) {
  const [form, setForm] = useState({ id: '', name: '', type: 'http', check_url: '', models_url: '', show_models: false, isNew: true });

  useEffect(() => {
    if (editing) setForm({ ...editing, isNew: false });
  }, [editing]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
    if (!editing) setForm({ id: '', name: '', type: 'http', check_url: '', models_url: '', show_models: false, isNew: true });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }}>
      {/* Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Health Checks</span>
          <Btn
            onClick={() => {
              onCancel();
              setForm({ id: '', name: '', type: 'http', check_url: '', models_url: '', show_models: false, isNew: true });
              onEdit(null);
            }}
          >
            + Add New
          </Btn>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['ID', 'Name', 'Type', 'URL', ''].map((h) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: h === '' ? 'right' : 'left', fontSize: 11, color: T.textDim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${T.border}` }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {healthchecks.map((hc) => (
              <tr key={hc.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                <td style={{ padding: '12px 16px', fontFamily: mono, fontSize: 12, color: T.accent }}>{hc.id}</td>
                <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: 13, color: T.text }}>{hc.name}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span
                    style={{
                      fontFamily: mono,
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: 4,
                      background: hc.type === 'ollama' ? T.accentSurface : 'rgba(255,255,255,0.04)',
                      color: hc.type === 'ollama' ? T.accent : T.textDim,
                      textTransform: 'uppercase',
                    }}
                  >
                    {hc.type}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontFamily: mono, fontSize: 11, color: T.textDim }}>{hc.check_url}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <Btn variant="ghost" onClick={() => onEdit(hc)}>Edit</Btn>
                    <Btn variant="danger" onClick={() => onDelete(hc.id)}>Delete</Btn>
                  </div>
                </td>
              </tr>
            ))}
            {healthchecks.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: T.textDim, fontSize: 13 }}>No healthchecks yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Form */}
      <Card>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 20 }}>
          {editing ? 'Edit Health Check' : 'New Health Check'}
        </h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {form.isNew && <Input label="ID" placeholder="e.g. postgres, redis" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} required />}
          <Input label="Name" placeholder="Service Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="http">HTTP</option>
            <option value="ollama">Ollama</option>
          </Select>
          <Input label="Check URL" type="url" placeholder="http://..." value={form.check_url} onChange={(e) => setForm({ ...form, check_url: e.target.value })} required />
          {form.type === 'ollama' && (
            <>
              <Input label="Models URL (optional)" type="url" placeholder="http://..." value={form.models_url || ''} onChange={(e) => setForm({ ...form, models_url: e.target.value })} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 0' }}>
                <input
                  type="checkbox"
                  checked={form.show_models || false}
                  onChange={(e) => setForm({ ...form, show_models: e.target.checked })}
                  style={{ width: 16, height: 16, accentColor: T.accent }}
                />
                <span style={{ fontSize: 13, color: T.textMid }}>Show models list</span>
              </label>
            </>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <Btn type="submit" style={{ flex: 1, opacity: saving ? 0.6 : 1 }} disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Update' : 'Add Health Check'}
            </Btn>
            {editing && (
              <Btn
                type="button"
                variant="ghost"
                onClick={() => {
                  onCancel();
                  setForm({ id: '', name: '', type: 'http', check_url: '', models_url: '', show_models: false, isNew: true });
                }}
              >
                Cancel
              </Btn>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
