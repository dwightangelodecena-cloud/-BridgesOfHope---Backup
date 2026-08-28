import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';

const ROW_MENU_WIDTH = 210;
const ROW_MENU_MARGIN = 8;

// Same fix as AdminRequestsNavItem/StaffNotificationsBell: a table's scroll wrapper clips a
// position:absolute dropdown no matter which direction it opens. Rendering through a portal at
// fixed viewport coordinates avoids that entirely.
//
// Anchors by `bottom` (not a `top` computed from a guessed menu height) when flipped above the
// trigger — a menu with only 1-2 items is far shorter than one with all 8, so estimating a
// fixed height and subtracting it from triggerRect.top would land the menu way higher than the
// trigger for short menus (it flew up next to unrelated rows for rows near the bottom of a long
// table). Anchoring to `bottom` lets the menu grow upward from the trigger by its own real
// height, whatever that turns out to be, with no guessing involved.
function computeRowMenuPosition(triggerRect) {
  const spaceBelow = window.innerHeight - triggerRect.bottom;
  const spaceAbove = triggerRect.top;
  const openBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove;
  const left = Math.min(
    Math.max(ROW_MENU_MARGIN, triggerRect.right - ROW_MENU_WIDTH),
    window.innerWidth - ROW_MENU_WIDTH - ROW_MENU_MARGIN
  );
  if (openBelow) {
    return { top: triggerRect.bottom + 6, left, maxHeight: Math.max(120, spaceBelow - 6 - ROW_MENU_MARGIN) };
  }
  return { bottom: window.innerHeight - triggerRect.top + 6, left, maxHeight: Math.max(120, spaceAbove - 6 - ROW_MENU_MARGIN) };
}

/**
 * "⋯ More" dropdown for a table row's less-frequent actions — keeps each row down to just its
 * primary buttons (View/Edit/...) instead of every conditionally-available action rendered as
 * its own pill. `actions` accepts falsy entries (from `condition && {...}`) so callers can
 * inline the same conditional logic the buttons used to have; they're filtered out here.
 *
 * Each action: { label, onClick, icon?, title?, disabled?, danger? }.
 */
export function RowActionsMenu({ actions }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const visibleActions = actions.filter(Boolean);

  useEffect(() => {
    if (!open) return undefined;
    if (triggerRef.current) setRect(computeRowMenuPosition(triggerRef.current.getBoundingClientRect()));
    const onDoc = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const onViewportChange = () => {
      if (triggerRef.current) setRect(computeRowMenuPosition(triggerRef.current.getBoundingClientRect()));
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [open]);

  if (visibleActions.length === 0) return null;

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className="db-action-btn"
        title="More actions"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <MoreHorizontal size={14} />
      </button>
      {open && rect
        ? createPortal(
            <div
              ref={menuRef}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: rect.top,
                bottom: rect.bottom,
                left: rect.left,
                width: ROW_MENU_WIDTH,
                maxHeight: rect.maxHeight,
                overflowY: 'auto',
                background: '#FFFFFF',
                border: '1px solid #E9EDF7',
                borderRadius: 12,
                boxShadow: '0 20px 50px rgba(15,23,42,0.18)',
                zIndex: 999999,
                fontFamily: "'Inter', sans-serif",
                padding: 6,
              }}
            >
              {visibleActions.map((a, i) => (
                <button
                  key={i}
                  type="button"
                  title={a.title}
                  disabled={a.disabled}
                  onClick={() => {
                    setOpen(false);
                    a.onClick();
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    border: 'none',
                    borderRadius: 8,
                    background: 'transparent',
                    color: a.danger ? '#B91C1C' : '#1B2559',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: a.disabled ? 'not-allowed' : 'pointer',
                    opacity: a.disabled ? 0.55 : 1,
                    textAlign: 'left',
                    fontFamily: "'Inter', sans-serif",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = a.danger ? '#FEF2F2' : '#F8FAFC';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {a.icon}
                  {a.label}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
