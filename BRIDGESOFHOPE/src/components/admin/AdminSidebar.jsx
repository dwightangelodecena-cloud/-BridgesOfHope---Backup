import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutGrid,
  BookUser,
  ClipboardList,
  Users,
  LayoutTemplate,
  Calendar,
  FileText,
  User,
  LogOut,
  BedDouble,
} from 'lucide-react';
import logo from '@/assets/kalingalogo.png';
import { familySidebarStyle } from '@/lib/familySidebarStyle';
import { AdminCommunicationsNavItem } from '@/components/admin/AdminCommunicationsNavItem';
import { SidebarLabel } from '@/components/admin/SidebarLabel';

const NAV_SECTIONS = [
  {
    label: null,
    items: [{ path: '/admin-dashboard', label: 'Dashboard', icon: LayoutGrid }],
  },
  {
    label: 'Care Operations',
    items: [
      { path: '/admin-patient-database', label: 'Patients', icon: BookUser },
      {
        path: '/admin-admission-management',
        label: 'Patient Care',
        icon: ClipboardList,
        // Combined workspace (patient-care.jsx) — active on either of its tabs' routes.
        activePaths: ['/admin-admission-management', '/admin-discharge-management'],
      },
      { path: '/admin-ward-management', label: 'Wards & Rooms', icon: BedDouble },
      { path: '/admin-appointments', label: 'Appointments', icon: Calendar },
    ],
  },
  {
    label: 'People',
    items: [
      {
        path: '/admin-user-management',
        label: 'People',
        icon: Users,
        // Combined workspace (people.jsx) — active on either of its tabs' routes.
        activePaths: ['/admin-user-management', '/admin-staff-management'],
      },
    ],
  },
  {
    label: 'Communications',
    items: [
      {
        path: '/admin-messages',
        label: 'Communications',
        special: 'communications',
        // Combined workspace (communications.jsx) — active on any of its four tabs' routes.
        activePaths: ['/admin-messages', '/admin-requests', '/admin-notification-templates', '/admin-announcements'],
      },
    ],
  },
  {
    label: 'Content & Reports',
    items: [
      { path: '/admin-content-management', label: 'Content', icon: LayoutTemplate },
      { path: '/admin-reports', label: 'Reports', icon: FileText },
    ],
  },
];

export const ADMIN_SIDEBAR_WIDTH = { collapsed: 110, expanded: 292 };

function isNavActive(pathname, path) {
  if (path === '/admin-dashboard') {
    return pathname === '/admin-dashboard' || pathname === '/admin-dashboard/';
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

export default function AdminSidebar({
  isExpanded,
  onToggleExpanded,
  children,
  profilePath = '/admin-profile',
  profileLabel = 'Profile & Security',
  dashboardPath = '/admin-dashboard',
  brandTagline = 'Admin Portal',
  onPatientNavClick,
  onLogout,
  showProfile = true,
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const go = (e, path) => {
    e.stopPropagation();
    if (!isNavActive(pathname, path)) {
      navigate(path);
    }
  };

  const goDashboard = (e) => {
    e.stopPropagation();
    navigate(dashboardPath);
  };

  const profileActive = pathname === profilePath || pathname.startsWith(`${profilePath}/`);

  return (
    <aside
      className="desktop-sidebar"
      data-expanded={isExpanded ? 'true' : 'false'}
      style={familySidebarStyle(isExpanded)}
      onClick={() => onToggleExpanded?.()}
    >
      <div className="sidebar-accent-bar" aria-hidden="true" />

      <div
        className="sidebar-logo-container"
        onClick={goDashboard}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            goDashboard(e);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Bridges of Hope Admin — go to dashboard"
      >
        <div className="sidebar-brand-card">
          <div className="sidebar-logo-wrap">
            <img src={logo} alt="" className="sidebar-logo-watermark" aria-hidden="true" />
            <img src={logo} alt="Kalinga" className="sidebar-logo" />
          </div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-eyebrow">Bridges of Hope</span>
            <span className="sidebar-brand-name">{brandTagline}</span>
          </div>
        </div>
      </div>

      <div className="sidebar-logo-divider" aria-hidden="true" />

      <div className="sidebar-primary admin-sidebar-primary">
        {children ?? (
          <>
            {NAV_SECTIONS.map((section, sectionIndex) => (
              <div className="sidebar-section" key={section.label || `section-${sectionIndex}`}>
                {section.label ? <span className="sidebar-section-label">{section.label}</span> : null}
                {section.items.map((item) => {
                  if (item.special === 'communications') {
                    const active = item.activePaths.some((p) => isNavActive(pathname, p));
                    return (
                      <AdminCommunicationsNavItem
                        key="communications"
                        active={active}
                        onClick={(e) => go(e, item.path)}
                      />
                    );
                  }
                  const { path, label, icon: Icon, activePaths } = item;
                  const active = (activePaths || [path]).some((p) => isNavActive(pathname, p));
                  const handleClick =
                    path === '/admin-patient-database' && onPatientNavClick
                      ? (e) => {
                          e.stopPropagation();
                          onPatientNavClick(e);
                        }
                      : (e) => go(e, path);
                  return (
                    <div
                      key={path}
                      className={`sidebar-nav-item${active ? ' sidebar-nav-active' : ''}`}
                      onClick={handleClick}
                    >
                      <div className="sidebar-icon-wrap">
                        <Icon size={22} color="#707EAE" />
                      </div>
                      <SidebarLabel>{label}</SidebarLabel>
                    </div>
                  );
                })}
              </div>
            ))}
          </>
        )}
      </div>

      <div className="sidebar-footer">
        {showProfile ? (
          <div
            className={`sidebar-nav-item${profileActive ? ' sidebar-nav-active' : ''}`}
            onClick={(e) => go(e, profilePath)}
          >
            <div className="sidebar-icon-wrap">
              <User size={22} color="#707EAE" />
            </div>
            <SidebarLabel>{profileLabel}</SidebarLabel>
          </div>
        ) : null}
        <div
          className="sidebar-nav-item sidebar-nav-item--logout"
          onClick={(e) => {
            e.stopPropagation();
            if (onLogout) onLogout(e);
            else navigate('/login');
          }}
        >
          <div className="sidebar-icon-wrap">
            <LogOut size={22} color="#F54E25" />
          </div>
          <SidebarLabel>Logout</SidebarLabel>
        </div>
      </div>

      <div className="sidebar-expand-hint" aria-hidden="true">
        <span className="sidebar-expand-hint__chevron" />
      </div>
    </aside>
  );
}
