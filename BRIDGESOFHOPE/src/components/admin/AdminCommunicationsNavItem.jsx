import React from 'react';
import { Megaphone } from 'lucide-react';
import { useAdminUnreadMessages } from '@/hooks/useAdminUnreadMessages';
import { useUnreadStaffNotifications } from '@/hooks/useAdminUnreadStaffNotifications';
import { SidebarLabel } from '@/components/admin/SidebarLabel';

/**
 * Admin sidebar "Communications" — links to the Communications workspace (Messages, Requests,
 * Notifications, Announcements). Badge combines Messages' and Requests' unread counts, since
 * both used to show their own separate badge before being folded into one sidebar row.
 */
export function AdminCommunicationsNavItem({ active = false, onClick, showLabel = true }) {
  const unreadMessages = useAdminUnreadMessages();
  const unreadRequests = useUnreadStaffNotifications();
  const unread = unreadMessages + unreadRequests;
  const badge = unread > 99 ? '99+' : String(unread);

  return (
    <div
      className={`sidebar-nav-item${active ? ' sidebar-nav-active' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div
        className="sidebar-icon-wrap messages-nav-host"
        aria-label={unread > 0 ? `Communications, ${unread} unread` : 'Communications'}
      >
        <Megaphone size={22} color="#707EAE" />
        {unread > 0 ? (
          <span className="admin-msg-nav-badge" aria-hidden="true">
            {badge}
          </span>
        ) : null}
      </div>
      {showLabel ? (
        <SidebarLabel>
          Communications
          {unread > 0 && !active ? <span className="admin-msg-nav-label-count"> ({badge})</span> : null}
        </SidebarLabel>
      ) : null}
    </div>
  );
}
