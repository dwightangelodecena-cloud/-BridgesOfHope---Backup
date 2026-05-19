import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useAdminUnreadMessages } from '@/hooks/useAdminUnreadMessages';

/**
 * Admin sidebar Messages — inactive: gray outline like other nav items; active: solid orange + white (Appointments).
 */
export function AdminMessagesNavItem({ active = false, onClick, showLabel = true }) {
  const unread = useAdminUnreadMessages();
  const badge = unread > 99 ? '99+' : String(unread);

  return (
    <div className="sidebar-nav-item" onClick={onClick} role="button" tabIndex={0}>
      <div
        className={`icon-box messages-nav-host ${active ? 'active messages-nav-selected' : 'inactive'}`}
        aria-label={unread > 0 ? `Messages, ${unread} unread` : 'Messages'}
      >
        <MessageCircle size={22} strokeWidth={2} />
        {unread > 0 ? (
          <span className="admin-msg-nav-badge" aria-hidden="true">
            {badge}
          </span>
        ) : null}
      </div>
      {showLabel ? (
        <span className="sidebar-label" style={active ? { color: '#F54E25' } : undefined}>
          Messages
          {unread > 0 && !active ? (
            <span className="admin-msg-nav-label-count"> ({unread > 99 ? '99+' : unread})</span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
