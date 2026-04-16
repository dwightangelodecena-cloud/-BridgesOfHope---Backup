import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { psgcNameMatchesQuery, sortPsgcOptionsForDisplay } from '@/lib/psgcApi';

/**
 * Searchable combobox — standalone styling (no dependency on page `.input-wrapper`).
 *
 * @param {object} props
 * @param {string} props.label
 * @param {string} [props.description] optional subtle hint below the field (after errors)
 * @param {import('react').ComponentType<{ className?: string; size?: number }>} props.Icon
 * @param {{ code: string, name: string }[]} props.options
 * @param {string} props.valueName
 * @param {(opt: { code: string, name: string }) => void} props.onSelect
 * @param {() => void} [props.onClear] when the user clears the field (blur/outside/Escape with empty value)
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.loading]
 * @param {boolean} [props.hasError]
 * @param {string} [props.helperText]
 * @param {string} [props.placeholder]
 * @param {string} [props.emptyText]
 * @param {string} [props.errorText]
 */
export function PsgcSearchableSelect({
  label,
  description = '',
  Icon,
  options,
  valueName,
  onSelect,
  onClear,
  disabled = false,
  loading = false,
  hasError = false,
  helperText = '',
  placeholder = 'Search or select…',
  emptyText = 'No matches.',
  errorText = '',
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const blurTimer = useRef(null);
  const pickingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim();
    const list = q ? options.filter((o) => psgcNameMatchesQuery(o.name, q)) : options;
    return sortPsgcOptionsForDisplay(list);
  }, [options, query]);

  const commitClose = useCallback(() => {
    if (pickingRef.current) {
      pickingRef.current = false;
      setOpen(false);
      setQuery('');
      return;
    }
    const input = rootRef.current?.querySelector('input');
    const raw = (input?.value ?? '').trim();
    if (onClear && raw === '' && valueName.trim() !== '') {
      onClear();
    }
    setOpen(false);
    setQuery('');
  }, [valueName, onClear]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) commitClose();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [commitClose]);

  const onPick = (opt) => {
    if (blurTimer.current) window.clearTimeout(blurTimer.current);
    onSelect(opt);
    setOpen(false);
    setQuery('');
    window.setTimeout(() => {
      pickingRef.current = false;
    }, 0);
  };

  const showList = open && !disabled && !loading;
  const dimmed = disabled || loading;
  const footHint = errorText ? '' : helperText || description || '';

  return (
    <div className={`psgc-v2 ${dimmed ? 'psgc-v2--dimmed' : ''}`} ref={rootRef}>
      <label className="psgc-v2__label" htmlFor={listId + '-input'}>
        {label}
      </label>

      <div
        className={`psgc-v2__shell ${hasError ? 'psgc-v2__shell--error' : ''} ${open ? 'psgc-v2__shell--open' : ''}`}
      >
        <div className="psgc-v2__icon-wrap" aria-hidden>
          <Icon className="psgc-v2__icon" size={18} strokeWidth={2} />
        </div>
        <input
          id={listId + '-input'}
          type="text"
          className="psgc-v2__input"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={hasError}
          placeholder={placeholder}
          disabled={dimmed}
          value={open ? query : valueName}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            if (dimmed) return;
            setOpen(true);
            setQuery(valueName || '');
          }}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => {
              commitClose();
            }, 150);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              commitClose();
            }
          }}
        />
        <div className="psgc-v2__affix">
          {loading ? (
            <Loader2 className="psgc-v2__spinner" size={18} aria-hidden />
          ) : (
            <ChevronDown className="psgc-v2__chevron" size={18} aria-hidden />
          )}
        </div>

        {showList && (
          <ul id={listId} className="psgc-v2__list" role="listbox">
            {filtered.length === 0 ? (
              <li className="psgc-v2__empty">{emptyText}</li>
            ) : (
              filtered.map((opt) => (
                <li key={opt.code} role="none">
                  <button
                    type="button"
                    className="psgc-v2__option"
                    role="option"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pickingRef.current = true;
                    }}
                    onClick={() => onPick(opt)}
                  >
                    {opt.name}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {errorText ? <p className="psgc-v2__err">{errorText}</p> : null}
      {!errorText && footHint ? <p className="psgc-v2__hint">{footHint}</p> : null}

      <style>{`
        .psgc-v2 {
          margin-bottom: 0;
          transition: opacity 0.2s ease;
        }
        .psgc-v2--dimmed {
          opacity: 0.72;
        }
        .psgc-v2__label {
          display: block;
          font-size: 0.8125rem;
          font-weight: 600;
          color: #334155;
          letter-spacing: 0.01em;
          margin-bottom: 8px;
          text-align: left;
        }
        .psgc-v2__shell {
          position: relative;
          display: flex;
          align-items: stretch;
          min-height: 48px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
          transition:
            border-color 0.18s ease,
            box-shadow 0.18s ease,
            background 0.18s ease;
        }
        .psgc-v2:not(.psgc-v2--dimmed) .psgc-v2__shell:hover {
          border-color: #cbd5e1;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.06);
        }
        .psgc-v2__shell--open {
          border-color: #fdba74;
          box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.12);
          background: #fff;
        }
        .psgc-v2__shell--error {
          border-color: #fca5a5;
          background: #fffafa;
        }
        .psgc-v2__shell--error.psgc-v2__shell--open {
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12);
        }
        .psgc-v2__icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          flex-shrink: 0;
          color: #64748b;
        }
        .psgc-v2__icon {
          opacity: 0.85;
        }
        .psgc-v2__input {
          flex: 1;
          min-width: 0;
          border: none;
          background: transparent;
          font-size: 0.9375rem;
          color: #0f172a;
          padding: 12px 40px 12px 0;
          outline: none;
          font-family: inherit;
        }
        .psgc-v2__input::placeholder {
          color: #94a3b8;
          font-size: 0.8125rem;
        }
        .psgc-v2__input:disabled {
          cursor: not-allowed;
        }
        .psgc-v2__affix {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          align-items: center;
          pointer-events: none;
          color: #94a3b8;
        }
        .psgc-v2__spinner {
          animation: psgc-v2-spin 0.75s linear infinite;
        }
        @keyframes psgc-v2-spin {
          to { transform: rotate(360deg); }
        }
        .psgc-v2__list {
          position: absolute;
          left: 0;
          right: 0;
          top: calc(100% + 6px);
          z-index: 60;
          max-height: min(280px, 50vh);
          overflow-y: auto;
          margin: 0;
          padding: 6px;
          list-style: none;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          box-shadow:
            0 10px 40px rgba(15, 23, 42, 0.1),
            0 2px 10px rgba(15, 23, 42, 0.06);
          animation: psgc-v2-drop 0.15s ease-out;
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 #f1f5f9;
          color-scheme: light;
        }
        .psgc-v2__list::-webkit-scrollbar {
          width: 8px;
        }
        .psgc-v2__list::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 999px;
          margin: 6px 2px;
        }
        .psgc-v2__list::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 999px;
          border: 2px solid #f1f5f9;
        }
        .psgc-v2__list::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        @keyframes psgc-v2-drop {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .psgc-v2__option {
          width: 100%;
          text-align: left;
          padding: 10px 12px;
          border: none;
          border-radius: 8px;
          background: transparent;
          font-size: 0.875rem;
          color: #1e293b;
          cursor: pointer;
          font-family: inherit;
          transition: background 0.12s ease, color 0.12s ease;
        }
        .psgc-v2__option:hover {
          background: linear-gradient(90deg, #fff7ed 0%, #fffbeb 100%);
          color: #c2410c;
        }
        .psgc-v2__empty {
          padding: 14px 12px;
          font-size: 0.8125rem;
          color: #94a3b8;
          text-align: center;
        }
        .psgc-v2__hint {
          margin: 8px 0 0 0;
          font-size: 0.75rem;
          color: #94a3b8;
          line-height: 1.45;
          text-align: left;
        }
        .psgc-v2__err {
          margin: 8px 0 0 0;
          font-size: 0.75rem;
          color: #ef4444;
          font-weight: 500;
          text-align: left;
        }
      `}</style>
    </div>
  );
}
