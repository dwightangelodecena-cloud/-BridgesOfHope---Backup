import React, { useEffect, useState } from 'react';
import { X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { TOAST_EVENT } from '@/lib/toastBus';

/** Mounted once (App.jsx) — renders whatever showToast()/showErrorToast() fires from anywhere. */
export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const onToast = (e) => {
      const t = e.detail;
      if (!t?.message) return;
      setToasts((prev) => [...prev, t]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, t.duration || 5000);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  const dismiss = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  if (!toasts.length) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: 360,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '12px 14px',
            borderRadius: 12,
            boxShadow: '0 10px 30px rgba(15,23,42,0.18)',
            fontFamily: "'Inter', sans-serif",
            fontSize: 13,
            fontWeight: 600,
            color: t.type === 'error' ? '#7F1D1D' : '#065F46',
            background: t.type === 'error' ? '#FEF2F2' : '#ECFDF5',
            border: `1px solid ${t.type === 'error' ? '#FCA5A5' : '#A7F3D0'}`,
          }}
        >
          {t.type === 'error' ? (
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          ) : (
            <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          )}
          <span style={{ flex: 1 }}>{t.message}</span>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
