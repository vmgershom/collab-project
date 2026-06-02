import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { getToken } from '../auth.js';
import { Button } from './ui.jsx';

const linkBtn = { background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600, fontSize: 14 };
const timeOf = (iso) => new Date(iso).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState([]);
  const wrapRef = useRef(null);

  async function loadCount() {
    try { const d = await api('/notifications/unread-count', { token: getToken() }); setCount(d.count); } catch {}
  }
  useEffect(() => {
    loadCount();
    const t = setInterval(loadCount, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onDoc(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) { setOpen(false); setShowSettings(false); } }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  async function togglePanel() {
    const next = !open;
    setOpen(next); setShowSettings(false);
    if (next) {
      try {
        const list = await api('/notifications', { token: getToken() });
        setItems(list);
        if (list.some((n) => !n.read)) {
          await api('/notifications/read-all', { method: 'POST', token: getToken() });
          setCount(0);
          setItems((prev) => prev.map((n) => ({ ...n, read: true })));
        }
      } catch {}
    }
  }

  async function openSettings() {
    try { setSettings(await api('/notifications/settings', { token: getToken() })); setShowSettings(true); } catch {}
  }
  function toggleSetting(type) {
    setSettings((s) => s.map((x) => (x.type === type ? { ...x, enabled: !x.enabled } : x)));
  }
  async function saveSettings() {
    try {
      await api('/notifications/settings', { method: 'PUT', body: { settings: settings.map((s) => ({ type: s.type, enabled: s.enabled })) }, token: getToken() });
      setShowSettings(false);
    } catch {}
  }
  function openItem(n) {
    setOpen(false);
    if (n.link) navigate(n.link);
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <a href="#" onClick={(e) => { e.preventDefault(); togglePanel(); }} className="nav-link" style={{ position: 'relative', cursor: 'pointer' }}>
        <svg style={{ width: 18, height: 18, flexShrink: 0 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
        </svg>
        <span className="nav-text">Сповіщення</span>
        {count > 0 && <span style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, background: 'var(--color-danger)', borderRadius: '50%' }} />}
      </a>

      {open && (
        <div style={{
          position: 'fixed',
          top: 56,
          right: 8,
          width: 'calc(100vw - 16px)',
          maxWidth: 340,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          zIndex: 1000,
          maxHeight: '80vh',
          overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}>
            <strong>{showSettings ? 'Налаштування' : 'Сповіщення'}</strong>
            {showSettings
              ? <button onClick={() => setShowSettings(false)} style={linkBtn}>Назад</button>
              : <button onClick={openSettings} style={linkBtn}>Налаштувати</button>}
          </div>

          {!showSettings ? (
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {items.length === 0 && <p style={{ color: 'var(--color-muted)', textAlign: 'center', padding: 20 }}>Сповіщень немає</p>}
              {items.map((n) => (
                <div key={n.id} onClick={() => openItem(n)}
                  style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', cursor: n.link ? 'pointer' : 'default', background: n.read ? 'transparent' : 'var(--color-primary-light)' }}>
                  <div style={{ fontWeight: 600, fontSize: 14, overflowWrap: 'anywhere' }}>{n.title}</div>
                  {n.body && <div style={{ fontSize: 13, color: 'var(--color-muted)', overflowWrap: 'anywhere' }}>{n.body}</div>}
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{timeOf(n.createdAt)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ maxHeight: 400, overflowY: 'auto', padding: '8px 14px' }}>
              {settings.map((s) => (
                <label key={s.type} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer' }}>
                  <input type="checkbox" checked={s.enabled} onChange={() => toggleSetting(s.type)} />
                  <span style={{ fontSize: 14 }}>{s.label}</span>
                </label>
              ))}
              <Button onClick={saveSettings} block style={{ marginTop: 10 }}>Зберегти</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}