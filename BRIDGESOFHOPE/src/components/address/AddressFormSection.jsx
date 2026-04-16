import React from 'react';
import { MapPinned } from 'lucide-react';

/**
 * Grouped address block: title, optional notice, error banner, responsive grid for children.
 */
export function AddressFormSection({
  title = 'Address',
  subtitle = 'Complete province, city, then barangay.',
  notice,
  fetchError,
  onDismissError,
  restoredHint,
  children,
}) {
  return (
    <section className="addr-sec" aria-labelledby="addr-sec-title">
      <div className="addr-sec__head">
        <div className="addr-sec__title-row">
          <span className="addr-sec__badge" aria-hidden>
            <MapPinned size={18} strokeWidth={2} />
          </span>
          <div>
            <h2 id="addr-sec-title" className="addr-sec__title">
              {title}
            </h2>
            <p className="addr-sec__subtitle">{subtitle}</p>
          </div>
        </div>
        {notice ? <p className="addr-sec__notice">{notice}</p> : null}
        {restoredHint ? <p className="addr-sec__restored">{restoredHint}</p> : null}
      </div>

      {fetchError ? (
        <div className="addr-sec__alert" role="alert">
          <span className="addr-sec__alert-text">{fetchError}</span>
          {onDismissError ? (
            <button type="button" className="addr-sec__alert-dismiss" onClick={onDismissError}>
              Dismiss
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="addr-sec__card">
        <div className="addr-sec__grid">{children}</div>
      </div>

      <style>{`
        .addr-sec {
          margin-top: 0.75rem;
          margin-bottom: 0.5rem;
        }
        .addr-sec__head {
          margin-bottom: 1.125rem;
        }
        .addr-sec__title-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          text-align: left;
        }
        .addr-sec__badge {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: linear-gradient(145deg, #fff7ed 0%, #ffedd5 100%);
          color: #ea580c;
          flex-shrink: 0;
          border: 1px solid #fed7aa;
        }
        .addr-sec__title {
          margin: 0;
          font-size: 0.9375rem;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.02em;
        }
        .addr-sec__subtitle {
          margin: 4px 0 0 0;
          font-size: 0.8125rem;
          color: #64748b;
          line-height: 1.45;
          max-width: 42ch;
        }
        .addr-sec__notice {
          margin: 10px 0 0 0;
          font-size: 0.75rem;
          color: #64748b;
          text-align: left;
          padding-left: 52px;
        }
        .addr-sec__restored {
          margin: 8px 0 0 0;
          font-size: 0.75rem;
          color: #047857;
          font-weight: 500;
          text-align: left;
          padding-left: 52px;
        }
        .addr-sec__alert {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 14px;
          margin-bottom: 14px;
          border-radius: 12px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          text-align: left;
        }
        .addr-sec__alert-text {
          flex: 1;
          font-size: 0.8125rem;
          color: #991b1b;
          line-height: 1.4;
        }
        .addr-sec__alert-dismiss {
          flex-shrink: 0;
          background: none;
          border: none;
          color: #dc2626;
          font-weight: 700;
          font-size: 0.75rem;
          cursor: pointer;
          padding: 2px 0;
        }
        .addr-sec__card {
          background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 1.35rem 1.25rem 1.25rem;
          box-shadow:
            0 1px 2px rgba(15, 23, 42, 0.04),
            0 4px 16px rgba(15, 23, 42, 0.05);
        }
        .addr-sec__grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.125rem;
          align-items: start;
        }
        .addr-sec__grid > * {
          min-width: 0;
        }
        .addr-sec__full {
          grid-column: 1 / -1;
        }
        .addr-sec__grid .psgc-v2 {
          margin-bottom: 0;
        }
        .addr-sec__grid .addr-str {
          margin-bottom: 0;
        }
        @media (min-width: 640px) {
          .addr-sec__grid {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            column-gap: 1.25rem;
            row-gap: 1.125rem;
          }
        }
      `}</style>
    </section>
  );
}

/**
 * Manual street line — matches PSGC select visual language.
 */
export function StreetAddressInput({
  label = 'Street / Building Line',
  description = 'Building name, street name, or subdivision (not in the lists above).',
  value,
  onChange,
  name = 'street',
  placeholder = 'Enter block, lot, street, or building (e.g. Blk 2 Lot 15)',
  errorText = '',
  autoComplete = 'street-address',
}) {
  return (
    <div className="addr-str">
      <label className="addr-str__label" htmlFor={name + '-street'}>
        {label}
      </label>
      <div className={`addr-str__shell ${errorText ? 'addr-str__shell--error' : ''}`}>
        <span className="addr-str__icon" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </span>
        <input
          id={name + '-street'}
          name={name}
          type="text"
          className="addr-str__input"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={Boolean(errorText)}
        />
      </div>
      {errorText ? (
        <p className="addr-str__err">{errorText}</p>
      ) : description ? (
        <p className="addr-str__hint">{description}</p>
      ) : null}
      <style>{`
        .addr-str {
          margin-bottom: 0;
        }
        .addr-str__label {
          display: block;
          font-size: 0.8125rem;
          font-weight: 600;
          color: #334155;
          margin-bottom: 8px;
          text-align: left;
        }
        .addr-str__shell {
          display: flex;
          align-items: center;
          min-height: 48px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 0 4px 0 12px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
          transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }
        .addr-str__shell:hover {
          border-color: #cbd5e1;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.06);
        }
        .addr-str__shell:focus-within {
          border-color: #fdba74;
          box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.12);
          background: #fff;
        }
        .addr-str__shell--error {
          border-color: #fca5a5;
          background: #fffafa;
        }
        .addr-str__icon {
          display: flex;
          color: #64748b;
          margin-right: 8px;
          flex-shrink: 0;
        }
        .addr-str__input {
          flex: 1;
          min-width: 0;
          border: none;
          background: transparent;
          font-size: 0.9375rem;
          color: #0f172a;
          padding: 12px 12px 12px 0;
          outline: none;
          font-family: inherit;
        }
        .addr-str__input::placeholder {
          color: #94a3b8;
        }
        .addr-str__err {
          margin: 8px 0 0 0;
          font-size: 0.75rem;
          color: #ef4444;
          font-weight: 500;
          text-align: left;
        }
        .addr-str__hint {
          margin: 8px 0 0 0;
          font-size: 0.75rem;
          color: #94a3b8;
          line-height: 1.45;
          text-align: left;
        }
      `}</style>
    </div>
  );
}
