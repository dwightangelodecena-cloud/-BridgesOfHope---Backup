import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutGrid,
  BookUser,
  ClipboardList,
  ArrowRightSquare,
  Users,
  Stethoscope,
  LayoutTemplate,
  Calendar,
  FileText,
  User,
  LogOut,
  MessageSquare,
  BedDouble,
  Megaphone,
} from 'lucide-react';
import logo from '@/assets/kalingalogo.png';
import { familySidebarStyle } from '@/lib/familySidebarStyle';
import { AdminMessagesNavItem } from '@/components/admin/AdminMessagesNavItem';
import { AdminRequestsNavItem } from '@/components/admin/AdminRequestsNavItem';
import { SidebarLabel } from '@/components/admin/SidebarLabel';

const NAV_SECTIONS = [
  {
    label: null,
    items: [{ path: '/admin-dashboard', label: 'Dashboard', icon: LayoutGrid }],
  },
  {
    label: 'Care Operations',
    items: [
      { path: '/admin-patient-database', label: 'Patient Management', icon: BookUser },
      { path: '/admin-ward-management', label: 'Ward & Room Management', icon: BedDouble },
      { path: '/admin-admission-management', label: 'Admission Management', icon: ClipboardList },
      { path: '/admin-discharge-management', label: 'Discharge Management', icon: ArrowRightSquare },
      { path: '/admin-appointments', label: 'Appointments', icon: Calendar },
    ],
  },
  {
    label: 'People',
    items: [
      { path: '/admin-user-management', label: 'User Management', icon: Users },
      { path: '/admin-staff-management', label: 'Staff Management', icon: Stethoscope },
    ],
  },
  {
    label: 'Communications',
    items: [
      { special: 'messages' },
      { special: 'requests' },
      { path: '/admin-notification-templates', label: 'Notification Templates', icon: MessageSquare },
      { path: '/admin-announcements', label: 'Announcements', icon: Megaphone },
    ],
  },
  {
    label: 'Content & Reports',
    items: [
      { path: '/admin-content-management', label: 'Content management', icon: LayoutTemplate },
      { path: '/admin-reports', label: 'Printable reports', icon: FileText },
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
                  if (item.special === 'messages') {
                    return (
                      <AdminMessagesNavItem
                        key="messages"
                        active={isNavActive(pathname, '/admin-messages')}
                        onClick={(e) => go(e, '/admin-messages')}
                      />
                    );
                  }
                  if (item.special === 'requests') {
                    return <AdminRequestsNavItem key="requests" />;
                  }
                  const { path, label, icon: Icon } = item;
                  const active = isNavActive(pathname, path);
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
        <div
          className={`sidebar-nav-item${profileActive ? ' sidebar-nav-active' : ''}`}
          onClick={(e) => go(e, profilePath)}
        >
          <div className="sidebar-icon-wrap">
            <User size={22} color="#707EAE" />
          </div>
          <SidebarLabel>{profileLabel}</SidebarLabel>
        </div>
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
