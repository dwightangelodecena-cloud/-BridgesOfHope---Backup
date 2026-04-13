import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const ACCENT = '#F54E25';
const TEXT = '#1B2559';

/**
 * Inline 4-digit PIN step before approving an admission/discharge (admin UI).
 * Styling matches Bridges of Hope dashboard (Inter, orange CTA, soft card).
 */
export function TwoFactorApproveModal({
  open,
  onClose,
  onConfirm,
  error,
  loading,
  title = 'Enter 2FA code to approve',
}) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const inputRefs = [useRef(), useRef(), useRef(), useRef()];

  useEffect(() => {
    if (!open) return;
    setDigits(['', '', '', '']);
    const t = setTimeout(() => inputRefs[0].current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  const handleChange = (index, value) => {
    const v = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = v;
    setDigits(next);
    if (v && index < 3) inputRefs[index + 1].current?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const code = digits.join('');
    if (code.length !== 4) return;
    await Promise.resolve(onConfirm(code));
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tfa-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 420,
          background: '#fff',
          borderRadius: 24,
          padding: '28px 28px 32px',
          boxShadow: '0 24px 48px rgba(27, 37, 89, 0.12), 0 0 0 1px rgba(226, 232, 240, 0.9)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 18,
            right: 18,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            padding: 6,
            borderRadius: 10,
            color: '#64748B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={22} />
        </button>

        <h2
          id="tfa-modal-title"
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: TEXT,
            margin: '0 36px 8px 0',
            lineHeight: 1.3,
          }}
        >
          {title}
        </h2>
        <p style={{ fontSize: 13, color: '#64748B', fontWeight: 500, marginBottom: 22 }}>
          Enter your 4-digit code to confirm this action.
        </p>

        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 14,
              marginBottom: 20,
            }}
          >
            {digits.map((d, i) => (
              <input
                key={i}
                ref={inputRefs[i]}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                value={d}
                disabled={loading}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  border: `1.5px solid ${d ? ACCENT : '#E2E8F0'}`,
                  textAlign: 'center',
                  fontSize: 20,
                  fontWeight: 700,
                  color: TEXT,
                  outline: 'none',
                  background: '#fff',
                  transition: 'border-color 0.15s',
                }}
              />
            ))}
          </div>

          {error ? (
            <div
              style={{
                color: '#dc2626',
                fontSize: 13,
                fontWeight: 600,
                textAlign: 'center',
                marginBottom: 14,
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || digits.join('').length !== 4}
            style={{
              width: '100%',
              padding: '14px 20px',
              borderRadius: 14,
              border: 'none',
              background: loading || digits.join('').length !== 4 ? '#FDBA9A' : ACCENT,
              color: '#fff',
              fontSize: 16,
              fontWeight: 700,
              cursor: loading || digits.join('').length !== 4 ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {loading ? 'Confirming…' : 'Confirm'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
