import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  HeartPulse,
  User,
  LogOut,
  Calendar,
  ClipboardList,
  FileText,
  BookOpen,
} from 'lucide-react';
import logoBH from '@/assets/kalingalogo.png';
import { useCaseLoad } from './CaseLoadContext';
import ClmShellStyles from './ClmShellStyles';

const MOBILE_LINKS = [
  { to: '/case-dashboard', end: true, label: 'Home', icon: LayoutGrid },
  { to: '/case-dashboard/residents', label: 'Residents', icon: HeartPulse },
  { to: '/case-dashboard/appointments', label: 'Visits', icon: Calendar },
  { to: '/case-dashboard/incidents', label: 'Incidents', icon: ClipboardList },
  { to: '/case-dashboard/reports', label: 'Reports', icon: FileText },
  { to: '/case-dashboard/resources', label: 'Guide', icon: BookOpen },
  { to: '/case-dashboard/profile', label: 'Profile', icon: User },
];

/** Same routes admin uses for patient data, visits, PDF packs, and recovery ladder. */
const ADMIN_BRIDGE_LINKS = [
  { to: '/admin-patient-database', label: 'Patient records' },
  { to: '/admin-appointments', label: 'Visit scheduling' },
  { to: '/admin-reports', label: 'Printable reports' },
  { to: '/admin-recovery-roadmap', label: 'Recovery roadmap' },
];

export default function CaseLoadLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { formError, saveMsg } = useCaseLoad();
  const [isExpanded, setIsExpanded] = useState(false);

  const isActive = (to, end) => {
    if (end) return pathname === to || pathname === `${to}/`;
    return pathname === to || pathname.startsWith(`${to}/`);
  };

  const NavRow = ({ to, end, label, Icon }) => {
    const active = isActive(to, end);
    return (
      <NavLink
        to={to}
        end={end}
        onClick={(e) => e.stopPropagation()}
        className={`sidebar-nav-item ${active ? 'cl-nav-active' : ''}`}
      >
        <div className={`icon-box ${active ? 'active' : 'inactive'}`}>
          <Icon size={22} />
        </div>
        <span className="sidebar-label" style={active ? { color: '#F54E25' } : undefined}>{label}</span>
      </NavLink>
    );
  };

  return (
    <div
      className={`cl-outer ${isExpanded ? '' : 'sidebar-collapsed'}`}
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: '#F8F9FD',
        fontFamily: "'Inter', -apple-system, sans-serif",
        color: '#1B2559',
      }}
    >
      <ClmShellStyles />

      <aside
        className={`desktop-sidebar ${isExpanded ? '' : 'sidebar-collapsed'}`}
        onClick={() => setIsExpanded((p) => !p)}
      >
        <div
          className="sidebar-logo-container"
          title={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          style={{ cursor: 'pointer' }}
        >
          <img src={logoBH} alt="Kalinga" className="sidebar-logo" />
        </div>
        <nav className="sidebar-nav-scroll" aria-label="Case load navigation">
          <NavRow to="/case-dashboard" end label="Dashboard" Icon={LayoutGrid} />
          <NavRow to="/case-dashboard/residents" label="Assigned residents" Icon={HeartPulse} />
          <NavRow to="/case-dashboard/appointments" label="Appointments" Icon={Calendar} />
          <NavRow to="/case-dashboard/incidents" label="Incident tagging" Icon={ClipboardList} />
          <NavRow to="/case-dashboard/reports" label="Report history" Icon={FileText} />
          <NavRow to="/case-dashboard/resources" label="Operations guide" Icon={BookOpen} />
        </nav>
        <div className="sidebar-footer">
          <NavRow to="/case-dashboard/profile" label="Profile" Icon={User} />
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/login'); }}>
            <LogOut size={22} color="#F54E25" style={{ marginLeft: isExpanded ? '0' : '10px', flexShrink: 0 }} />
            <span className="sidebar-label" style={{ color: '#F54E25' }}>Logout</span>
          </div>
        </div>
      </aside>

      <div className="db-mobile-only db-mobile-top-bar">
        <img src={logoBH} alt="Kalinga" style={{ height: 32 }} />
        <span style={{ fontSize: 15, fontWeight: 800, color: '#F54E25' }}>CLM Workspace</span>
        <div style={{
          width: 36,
          height: 36,
          background: '#F54E25',
          color: 'white',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
        }}
        >
          CM
        </div>
      </div>

      <main className="cl-main">
        {formError ? (
          <div className="cl-card" style={{ marginBottom: 14, borderColor: '#FECACA', background: '#FEF2F2', color: '#991B1B', fontSize: 12, fontWeight: 700 }}>
            {formError}
          </div>
        ) : null}
        {saveMsg ? (
          <div className="cl-card" style={{ marginBottom: 14, borderColor: '#BBF7D0', background: '#F0FDF4', color: '#166534', fontSize: 12, fontWeight: 700 }}>
            {saveMsg}
          </div>
        ) : null}
        <div
          className="cl-card"
          style={{
            marginBottom: 16,
            padding: '12px 16px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '8px 10px',
          }}
        >
          <span style={{
            fontSize: 11,
            fontWeight: 800,
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginRight: 4,
          }}
          >
            Facility admin
          </span>
          <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Open the same tools administrators use:</span>
          {ADMIN_BRIDGE_LINKS.map((l) => (
            <button
              key={l.to}
              type="button"
              onClick={() => navigate(`${l.to}?mode=clm`)}
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#1B2559',
                background: '#F1F5F9',
                border: '1px solid #E2E8F0',
                borderRadius: 8,
                padding: '6px 11px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {l.label}
            </button>
          ))}
        </div>
        <Outlet />
      </main>

      <div className="db-mobile-only db-mobile-bottom-nav">
        {MOBILE_LINKS.map(({ to, end, label, icon: Icon }) => {
          const active = isActive(to, end);
          return (
            <div
              key={to}
              className={`mob-nav-item ${active ? 'active' : ''}`}
              onClick={() => navigate(to)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') navigate(to); }}
            >
              <Icon size={16} color={active ? '#F54E25' : '#A3AED0'} />
              <span style={active ? { color: '#F54E25' } : undefined}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
