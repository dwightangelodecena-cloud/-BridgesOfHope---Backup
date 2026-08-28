import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { AdminWorkspaceTabs } from '@/components/admin/AdminWorkspaceTabs';
import { familySidebarStyle } from '@/lib/familySidebarStyle';
import { UserManagementContent } from './user-management';
import { StaffManagementContent } from './staff-management';

/** Old routes stay real, deep-linkable paths — each just maps to a tab of this one workspace. */
const TABS = [
  { id: 'users', label: 'Users', path: '/admin-user-management' },
  { id: 'staff', label: 'Staff', path: '/admin-staff-management' },
];

function tabIdForPath(pathname) {
  return TABS.find((t) => pathname === t.path || pathname.startsWith(`${t.path}/`))?.id || TABS[0].id;
}

/**
 * People workspace — combines User Management and Staff Management (previously two separate
 * sidebar entries) into one page with tabs. Both roles here are admin-only, so no per-tab role
 * gating is needed (unlike Communications/Patient Care). See the approved consolidation plan.
 *
 * Layout note: the tab content components (UserManagementContent/StaffManagementContent) each
 * already self-pad via their own `.um-main` wrapper (40px, matching the original standalone
 * pages), so this workspace only pads the header/tabs zone above them — not the whole `<main>` —
 * to avoid doubling up padding.
 */
export default function PeopleWorkspace() {
  const [isExpanded, setIsExpanded] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  // Derived directly from the URL on every render — no state to keep in sync, so switching
  // tabs or navigating via browser back/forward just naturally reflects the current route.
  const activeTab = tabIdForPath(location.pathname);

  const handleTabChange = (id) => {
    const tab = TABS.find((t) => t.id === id);
    if (tab && tab.path !== location.pathname) navigate(tab.path);
  };

  return (
    <div
      className="family-portal admin-portal-layout people-outer"
      style={{ display: 'flex', minHeight: '100vh', background: '#F8F9FD', fontFamily: "'Inter', sans-serif", color: '#1B2559', ...familySidebarStyle(isExpanded) }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        .people-outer { width: 100%; overflow-x: clip; }
        .people-main { flex: 0 0 auto; min-height: 100vh; box-sizing: border-box; }
        .people-head { padding: 24px 40px 0; }
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .people-head { padding: 16px 12px 0; }
        }
      `}</style>

      <AdminSidebar isExpanded={isExpanded} onToggleExpanded={() => setIsExpanded(!isExpanded)} />

      <main className="people-main admin-sidebar-offset">
        <div className="people-head">
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0F172A' }}>People</h1>
          <p style={{ fontSize: 13, color: '#707EAE', marginTop: 8, marginBottom: 4, fontWeight: 500 }}>
            Guardian accounts and internal staff, in one place.
          </p>
          <AdminWorkspaceTabs tabs={TABS} activeTab={activeTab} onChange={handleTabChange} />
        </div>

        {activeTab === 'users' ? <UserManagementContent /> : <StaffManagementContent />}
      </main>
    </div>
  );
}
