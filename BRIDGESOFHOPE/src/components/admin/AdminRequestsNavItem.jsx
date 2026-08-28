import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useUnreadStaffNotifications } from '@/hooks/useAdminUnreadStaffNotifications';
import { SidebarLabel } from '@/components/admin/SidebarLabel';

/** Admin sidebar "Requests" — links to the full Requests page (new guardian-submitted admission/discharge/visitation requests). */
export function AdminRequestsNavItem({ showLabel = true }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const unread = useUnreadStaffNotifications();
  const badge = unread > 99 ? '99+' : String(unread);
  const active = pathname === '/admin-requests' || pathname.startsWith('/admin-requests/');

  return (
    <div
      className={`sidebar-nav-item${active ? ' sidebar-nav-active' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        if (!active) navigate('/admin-requests');
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
          {unread > 0 && !active ? <span className="admin-msg-nav-label-count"> ({unread > 99 ? '99+' : unread})</span> : null}
        </SidebarLabel>
      ) : null}
    </div>
  );
}
