import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { AdminWorkspaceTabs } from '@/components/admin/AdminWorkspaceTabs';
import { familySidebarStyle } from '@/lib/familySidebarStyle';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { resolveAccountRole } from '@/components/RoleGuard';
import { useAdminUnreadMessages } from '@/hooks/useAdminUnreadMessages';
import { useUnreadStaffNotifications } from '@/hooks/useAdminUnreadStaffNotifications';
import { AdminMessagesContent } from './admin-messages';
import { AdminRequestsContent } from './admin-requests';
import { NotificationTemplatesContent } from './notification-templates';
import { AdminAnnouncementsContent } from './admin-announcements';

/**
 * Old routes stay real, deep-linkable paths — each just maps to a tab of this one workspace.
 * Messages/Requests are staff-visible (matching their route RoleGuards); Notifications/
 * Announcements are admin-only, so they're hidden here for anyone who isn't resolved as admin —
 * mirroring the tab-level permission enforcement the plan calls for (not just a page-level
 * RoleGuard). Landing directly on an admin-only tab's URL without admin access falls back to
 * the first visible tab instead of rendering nothing.
 */
const ALL_TABS = [
  { id: 'messages', label: 'Messages', path: '/admin-messages', adminOnly: false },
  { id: 'requests', label: 'Requests', path: '/admin-requests', adminOnly: false },
  { id: 'notifications', label: 'Notifications', path: '/admin-notification-templates', adminOnly: true },
  { id: 'announcements', label: 'Announcements', path: '/admin-announcements', adminOnly: true },
];

function tabIdForPath(pathname) {
  return ALL_TABS.find((t) => pathname === t.path || pathname.startsWith(`${t.path}/`))?.id || ALL_TABS[0].id;
}

/**
 * Communications workspace — combines Messages, Requests, Notification Templates, and
 * Announcements (previously four separate sidebar entries) into one page with tabs.
 *
 * Layout: unlike People/Patient Care (normal scrolling pages), this uses a fixed-viewport
 * app-shell layout (header+tabs pinned, body scrolls internally) — required by the Messages
 * tab's own chat UI (admin-messages.css assumes a bounded height with independently-scrolling
 * inbox/chat panels), and applied consistently to all four tabs rather than mixing scroll
 * models.
 */
export default function CommunicationsWorkspace() {
  const [isExpanded, setIsExpanded] = useState(false);
  // Optimistic default (admin) so the admin-only tabs don't flash-hide before role resolves;
  // corrected to false for any non-admin role once resolveAccountRole returns.
  const [isAdmin, setIsAdmin] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const unreadMessages = useAdminUnreadMessages();
  const unreadRequests = useUnreadStaffNotifications();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!isSupabaseConfigured()) {
        if (!cancelled) setIsAdmin(true);
        return;
      }
      const { data } = await supabase.auth.getUser();
      const role = await resolveAccountRole(data?.user ?? null);
      if (!cancelled) setIsAdmin(role === 'admin');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tabs = ALL_TABS.filter((t) => !t.adminOnly || isAdmin).map((t) => ({
    ...t,
    badge: t.id === 'messages' ? unreadMessages : t.id === 'requests' ? unreadRequests : undefined,
  }));

  const requestedTab = tabIdForPath(location.pathname);
  const activeTab = tabs.some((t) => t.id === requestedTab) ? requestedTab : tabs[0]?.id;

  const handleTabChange = (id) => {
    const tab = ALL_TABS.find((t) => t.id === id);
    if (tab && tab.path !== location.pathname) navigate(tab.path);
  };

  return (
    <div
      className="family-portal admin-portal-layout comm-outer"
      style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F8F9FD', fontFamily: "'Inter', sans-serif", color: '#1B2559', ...familySidebarStyle(isExpanded) }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        .comm-outer { width: 100%; overflow-x: clip; }
        .comm-main { flex: 1 1 0; min-width: 0; height: 100vh; display: flex; flex-direction: column; box-sizing: border-box; }
        .comm-head { flex-shrink: 0; padding: 24px 24px 0; }
        .comm-body { flex: 1; min-height: 0; }
        .comm-body--scroll { overflow-y: auto; padding: 0 24px 24px; }
        .comm-body--fill { overflow: hidden; padding: 0 24px 24px; }
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .comm-head { padding: 16px 12px 0; }
          .comm-body--scroll { padding: 0 12px 100px; }
          .comm-body--fill { padding: 0; }
        }
      `}</style>

      <AdminSidebar isExpanded={isExpanded} onToggleExpanded={() => setIsExpanded(!isExpanded)} />

      <main className="comm-main admin-sidebar-offset">
        <div className="comm-head">
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0F172A' }}>Communications</h1>
          <p style={{ fontSize: 13, color: '#707EAE', marginTop: 8, marginBottom: 4, fontWeight: 500 }}>
            Messages, requests, and guardian broadcasts, in one workspace.
          </p>
          <AdminWorkspaceTabs tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />
        </div>

        <div className={`comm-body ${activeTab === 'messages' ? 'comm-body--fill' : 'comm-body--scroll'}`}>
          {activeTab === 'messages' ? (
            <div style={{ height: '100%' }}>
              <AdminMessagesContent />
            </div>
          ) : activeTab === 'requests' ? (
            <AdminRequestsContent />
          ) : activeTab === 'notifications' ? (
            <NotificationTemplatesContent />
          ) : activeTab === 'announcements' ? (
            <AdminAnnouncementsContent />
          ) : null}
        </div>
      </main>
    </div>
  );
}
