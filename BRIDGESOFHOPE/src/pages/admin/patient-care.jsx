import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { AdminWorkspaceTabs } from '@/components/admin/AdminWorkspaceTabs';
import { familySidebarStyle } from '@/lib/familySidebarStyle';
import { AdmissionManagementContent } from './admission-management';
import { DischargeManagementContent } from './discharge-management';

/**
 * Old routes stay real, deep-linkable paths — each just maps to a tab of this one workspace.
 * Named "Patient Care" (not "Admissions & Discharges") because Patients, Wards & Rooms,
 * Appointments, and Reports are planned to join as further tabs later — see the approved
 * consolidation plan. Adding them later just means adding entries here, no restructuring.
 */
const TABS = [
  { id: 'admissions', label: 'Admissions', path: '/admin-admission-management' },
  { id: 'discharges', label: 'Discharges', path: '/admin-discharge-management' },
];

function tabIdForPath(pathname) {
  return TABS.find((t) => pathname === t.path || pathname.startsWith(`${t.path}/`))?.id || TABS[0].id;
}

/**
 * Patient Care workspace — currently combines Admission Management and Discharge Management
 * (previously two separate sidebar entries). Both are admin-only, so no per-tab role gating is
 * needed here (unlike Communications/the eventual full Patient Care group once Patients joins,
 * which is staff-visible).
 */
export default function PatientCareWorkspace() {
  const [isExpanded, setIsExpanded] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  // Derived directly from the URL on every render — see people.jsx for why (no state to
  // desync, browser back/forward and deep links just naturally reflect the current tab).
  const activeTab = tabIdForPath(location.pathname);

  const handleTabChange = (id) => {
    const tab = TABS.find((t) => t.id === id);
    if (tab && tab.path !== location.pathname) navigate(tab.path);
  };

  return (
    <div
      className="family-portal admin-portal-layout patient-care-outer"
      style={{ display: 'flex', minHeight: '100vh', background: '#F8F9FD', fontFamily: "'Inter', sans-serif", color: '#1B2559', ...familySidebarStyle(isExpanded) }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        .patient-care-outer { width: 100%; overflow-x: clip; }
        .patient-care-main { flex: 0 0 auto; min-height: 100vh; box-sizing: border-box; }
        .patient-care-head { padding: 24px 24px 0; }
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .patient-care-head { padding: 16px 12px 0; }
        }
      `}</style>

      <AdminSidebar isExpanded={isExpanded} onToggleExpanded={() => setIsExpanded(!isExpanded)} />

      <main className="patient-care-main admin-sidebar-offset">
        <div className="patient-care-head">
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0F172A' }}>Patient Care</h1>
          <p style={{ fontSize: 13, color: '#707EAE', marginTop: 8, marginBottom: 4, fontWeight: 500 }}>
            Admissions and discharges, in one workspace.
          </p>
          <AdminWorkspaceTabs tabs={TABS} activeTab={activeTab} onChange={handleTabChange} />
        </div>

        {activeTab === 'admissions' ? <AdmissionManagementContent /> : <DischargeManagementContent />}
      </main>
    </div>
  );
}
