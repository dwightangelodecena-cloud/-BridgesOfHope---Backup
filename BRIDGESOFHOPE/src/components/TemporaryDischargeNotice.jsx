import React from 'react';
import { createPortal } from 'react-dom';
import { UserCheck, X } from 'lucide-react';
import { temporaryLeaveLabel } from '@/lib/dischargeRequestTypes';

const bannerStyle = {
  margin: '-22px -22px 14px',
  padding: '10px 14px',
  background: '#FEF3C7',
  borderBottom: '1px solid #FDE68A',
  color: '#92400E',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
  borderRadius: '12px 12px 0 0',
};

const bannerStyleCompact = {
  margin: '-18px -20px 12px',
  padding: '8px 12px',
  background: '#FEF3C7',
  borderBottom: '1px solid #FDE68A',
  color: '#92400E',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
};

const bannerStyleSection = {
  margin: '-18px -20px 14px',
  padding: '8px 12px',
  background: '#FEF3C7',
  borderBottom: '1px solid #FDE68A',
  color: '#92400E',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
  borderRadius: '20px 20px 0 0',
};

const bannerStyleLarge = {
  margin: '-32px -32px 18px',
  padding: '8px 12px',
  background: '#FEF3C7',
  borderBottom: '1px solid #FDE68A',
  color: '#92400E',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
};

/** Amber strip shown at the top of resident detail cards while on temporary leave. */
export function TemporaryDischargeCardBanner({ patient, variant = 'default' }) {
  const leave = temporaryLeaveLabel(patient?.temporaryLeaveType ?? patient?.temporary_leave_type);
  const style =
    variant === 'compact'
      ? bannerStyleCompact
      : variant === 'section'
        ? bannerStyleSection
        : variant === 'large'
          ? bannerStyleLarge
          : bannerStyle;
  return (
    <div role="status" style={style} aria-live="polite">
      Temporarily discharged
      {leave ? (
        <span style={{ fontWeight: 600, textTransform: 'none', marginLeft: 6, color: '#78350F' }}>
          · {leave}
        </span>
      ) : null}
    </div>
  );
}

/** Small in-app confirmation instead of the browser confirm dialog. */
export function ResidentReturnedConfirmModal({
  open,
  residentName = 'this resident',
  busy = false,
  onClose,
  onConfirm,
}) {
  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="resident-returned-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
      onClick={busy ? undefined : onClose}
    >
      <div
        className="app-modal-panel"
        style={{
          maxWidth: 400,
          padding: '24px 24px 20px',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          disabled={busy}
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            border: 'none',
            background: 'transparent',
            cursor: busy ? 'not-allowed' : 'pointer',
            padding: 6,
            borderRadius: 8,
            color: '#64748B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16, paddingRight: 28 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#ECFDF5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <UserCheck size={22} strokeWidth={2.2} aria-hidden />
          </div>
          <div style={{ minWidth: 0 }}>
            <h2
              id="resident-returned-modal-title"
              style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: '#1B2559', lineHeight: 1.3 }}
            >
              Mark as returned?
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: '#64748B', lineHeight: 1.55 }}>
              Mark <strong style={{ color: '#334155', fontWeight: 700 }}>{residentName}</strong> as returned?
              They will no longer be on temporary discharge and will show as active in care.
            </p>
          </div>
        </div>

        <div className="app-modal-actions">
          <button
            type="button"
            className="app-btn-secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="app-btn-primary-green"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? 'Saving…' : 'Confirm return'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function ResidentReturnedHeaderButton({ busy, onClick, compact = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      style={{
        padding: compact ? '8px 14px' : '10px 18px',
        borderRadius: 10,
        border: 'none',
        background: '#10B981',
        color: '#fff',
        fontWeight: 800,
        fontSize: compact ? 12 : 13,
        cursor: busy ? 'wait' : 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        boxShadow: '0 4px 14px rgba(16,185,129,0.35)',
      }}
    >
      {busy ? 'Saving…' : 'Resident returned'}
    </button>
  );
}
