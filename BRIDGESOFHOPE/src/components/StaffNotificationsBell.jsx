import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X } from 'lucide-react';
import { useUnreadStaffNotifications } from '@/hooks/useAdminUnreadStaffNotifications';
import {
  fetchStaffNotifications,
  markStaffNotificationRead,
  markAllStaffNotificationsRead,
} from '@/lib/staffNotifications';

const DROPDOWN_WIDTH = 320;
const DROPDOWN_MAX_HEIGHT = 420;
const VIEWPORT_MARGIN = 12;

function timeAgo(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Fixed-position coords for the dropdown, computed from the trigger's own screen rect — flips
 * above/clamps horizontally so it never gets clipped by a scroll/overflow-hidden ancestor
 * (e.g. ProgramSidebar's fixed, overflow:hidden container) regardless of where the bell sits. */
function computeDropdownRect(triggerRect) {
  const openBelow = triggerRect.bottom + DROPDOWN_MAX_HEIGHT + VIEWPORT_MARGIN <= window.innerHeight;
  const top = openBelow
    ? triggerRect.bottom + 8
    : Math.max(VIEWPORT_MARGIN, triggerRect.top - DROPDOWN_MAX_HEIGHT - 8);
  const left = Math.min(
    Math.max(VIEWPORT_MARGIN, triggerRect.right - DROPDOWN_WIDTH),
    window.innerWidth - DROPDOWN_WIDTH - VIEWPORT_MARGIN
  );
  return { top, left };
}

/**
 * Role-agnostic bell + badge + dropdown for staff_notifications — used by nurse and program
 * pages (admin has its own sidebar-integrated AdminRequestsNavItem instead, styled for that
 * layout). RLS scopes which rows each caller actually sees, so this needs no role prop.
 * Dropdown renders through a portal at fixed viewport coordinates rather than
 * position:absolute — several host containers (e.g. ProgramSidebar) are fixed + overflow:hidden,
 * which would otherwise clip it no matter which direction it opened.
 * @param {boolean} dark - true when placed on a dark header background (nurse dashboard banner).
 * @param {(relatedType: string) => string|null} resolveTargetPath - maps a notification's
 *   related_type to a route for this role; return null/undefined to not navigate on click.
 * @param {(path: string) => void} onNavigate
 */
export function StaffNotificationsBell({ dark = false, resolveTargetPath, onNavigate }) {
  const unread = useUnreadStaffNotifications();
  const badge = unread > 99 ? '99+' : String(unread);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [dropdownRect, setDropdownRect] = useState(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    if (triggerRef.current) {
      setDropdownRect(computeDropdownRect(triggerRef.current.getBoundingClientRect()));
    }
    (async () => {
      setItems(await fetchStaffNotifications());
    })();
    const onDoc = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        panelRef.current && !panelRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const onViewportChange = () => {
      if (triggerRef.current) setDropdownRect(computeDropdownRect(triggerRef.current.getBoundingClientRect()));
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

  const openItem = async (item) => {
    setOpen(false);
    if (!item.read_at) void markStaffNotificationRead(item.id);
    const path = resolveTargetPath ? resolveTargetPath(item.related_type) : null;
    if (path && onNavigate) onNavigate(path);
  };

  const iconColor = dark ? '#fff' : '#707EAE';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        style={{
          position: 'relative',
          background: dark ? 'rgba(255,255,255,0.12)' : '#F4F7FE',
          border: 'none',
          borderRadius: 12,
          width: 42,
          height: 42,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <Bell size={20} color={iconColor} />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              padding: '0 5px',
              borderRadius: 9,
              background: '#dc2626',
              color: '#fff',
              fontSize: 10,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {badge}
          </span>
        ) : null}
      </button>

      {open && dropdownRect
        ? createPortal(
            <div
              ref={panelRef}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: dropdownRect.top,
                left: dropdownRect.left,
                width: DROPDOWN_WIDTH,
                maxHeight: DROPDOWN_MAX_HEIGHT,
                overflowY: 'auto',
                background: '#FFFFFF',
                border: '1px solid #E9EDF7',
                borderRadius: 14,
                boxShadow: '0 20px 50px rgba(15,23,42,0.18)',
                zIndex: 999999,
                fontFamily: "'Inter', sans-serif",
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderBottom: '1px solid #F1F5F9',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 800, color: '#1B2559' }}>Notifications</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {unread > 0 ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await markAllStaffNotificationsRead();
                        setItems(await fetchStaffNotifications());
                      }}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#2563EB' }}
                    >
                      Mark all read
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              {items.length === 0 ? (
                <div style={{ padding: 18, fontSize: 12, color: '#94A3B8' }}>No notifications yet.</div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => void openItem(item)}
                    style={{
                      padding: '10px 14px',
                      borderBottom: '1px solid #F8FAFC',
                      cursor: 'pointer',
                      background: item.read_at ? '#FFFFFF' : '#FFF7F4',
                    }}
                  >
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1B2559' }}>{item.title}</div>
                    <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>{item.body}</div>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>{timeAgo(item.created_at)}</div>
                  </div>
                ))
              )}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
