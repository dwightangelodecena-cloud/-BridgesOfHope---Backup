import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Bell, X } from 'lucide-react';
import { useUnreadStaffNotifications } from '@/hooks/useAdminUnreadStaffNotifications';
import { SidebarLabel } from '@/components/admin/SidebarLabel';
import {
  fetchStaffNotifications,
  markStaffNotificationRead,
  markAllStaffNotificationsRead,
  staffNotificationTargetPath,
} from '@/lib/staffNotifications';

const DROPDOWN_WIDTH = 320;
const DROPDOWN_MAX_HEIGHT = 420;
const VIEWPORT_MARGIN = 12;

// Same fix as StaffNotificationsBell: the admin sidebar (.desktop-sidebar) has
// overflow:hidden, which clips a position:absolute dropdown no matter which direction it
// opens. Rendering through a portal at fixed viewport coordinates avoids that entirely.
function computeDropdownRect(triggerRect) {
  const openBelow = triggerRect.bottom + DROPDOWN_MAX_HEIGHT + VIEWPORT_MARGIN <= window.innerHeight;
  const top = openBelow
    ? triggerRect.bottom + 8
    : Math.max(VIEWPORT_MARGIN, triggerRect.top - DROPDOWN_MAX_HEIGHT - 8);
  const left = Math.min(
    Math.max(VIEWPORT_MARGIN, triggerRect.left),
    window.innerWidth - DROPDOWN_WIDTH - VIEWPORT_MARGIN
  );
  return { top, left };
}

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

/** Admin sidebar "Requests" — shared inbox for new guardian-submitted admission/discharge/visitation requests. */
export function AdminRequestsNavItem({ showLabel = true }) {
  const navigate = useNavigate();
  const unread = useUnreadStaffNotifications();
  const badge = unread > 99 ? '99+' : String(unread);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [dropdownRect, setDropdownRect] = useState(null);
  const wrapRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    if (wrapRef.current) {
      setDropdownRect(computeDropdownRect(wrapRef.current.getBoundingClientRect()));
    }
    (async () => {
      setItems(await fetchStaffNotifications());
    })();
    const onDoc = (e) => {
      if (
        wrapRef.current && !wrapRef.current.contains(e.target) &&
        panelRef.current && !panelRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const onViewportChange = () => {
      if (wrapRef.current) setDropdownRect(computeDropdownRect(wrapRef.current.getBoundingClientRect()));
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
    const path = staffNotificationTargetPath(item.related_type);
    if (path) navigate(path);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div
        className="sidebar-nav-item"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        role="button"
        tabIndex={0}
      >
        <div
          className="sidebar-icon-wrap messages-nav-host"
          aria-label={unread > 0 ? `Requests, ${unread} unread` : 'Requests'}
        >
          <Bell size={22} color="#707EAE" />
          {unread > 0 ? (
            <span className="admin-msg-nav-badge" aria-hidden="true">
              {badge}
            </span>
          ) : null}
        </div>
        {showLabel ? (
          <SidebarLabel>
            Requests
            {unread > 0 ? <span className="admin-msg-nav-label-count"> ({unread > 99 ? '99+' : unread})</span> : null}
          </SidebarLabel>
        ) : null}
      </div>

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
            <span style={{ fontSize: 13, fontWeight: 800, color: '#1B2559' }}>Requests</span>
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
            <div style={{ padding: 18, fontSize: 12, color: '#94A3B8' }}>No requests yet.</div>
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
    </div>
  );
}
