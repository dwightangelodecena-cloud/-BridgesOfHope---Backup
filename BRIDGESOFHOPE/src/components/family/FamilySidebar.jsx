import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  BookUser,
  ClipboardList,
  Calendar,
  FileText,
  User,
  LogOut,
} from 'lucide-react';
import FamilyHeaderBrand from '@/components/family/FamilyHeaderBrand';
import { familySidebarStyle } from '@/lib/familySidebarStyle';

const NAV_ITEMS = [
  { path: '/home', label: 'Dashboard', icon: Home },
  { path: '/patient-details', label: 'Resident Details', icon: BookUser },
  { path: '/progress', label: 'Request Management', icon: ClipboardList },
  { path: '/appointments', label: 'Appointments', icon: Calendar },
  { path: '/reports', label: 'Reports', icon: FileText },
];

export const FAMILY_SIDEBAR_WIDTH = { collapsed: 110, expanded: 292 };

function isNavActive(pathname, path) {
  if (path === '/home') return pathname === '/home' || pathname === '/';
  return pathname === path || pathname.startsWith(`${path}/`);
}

export default function FamilySidebar({ isExpanded, onToggleExpanded }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const go = (e, path) => {
    e.stopPropagation();
    navigate(path);
  };

  const goHome = (e) => {
    e.stopPropagation();
    navigate('/home');
  };

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
        onClick={goHome}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            goHome(e);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Kalinga Family Portal — go to dashboard"
      >
        <div className="sidebar-brand-card">
          <FamilyHeaderBrand className="family-header-brand--sidebar" />
        </div>
      </div>

      <div className="sidebar-logo-divider" aria-hidden="true" />

      <div className="sidebar-primary">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const active = isNavActive(pathname, path);
          return (
            <div
              key={path}
              className={`sidebar-nav-item${active ? ' sidebar-nav-active' : ''}`}
              onClick={(e) => go(e, path)}
            >
              <div className="sidebar-icon-wrap">
                <Icon size={22} color="#707EAE" />
              </div>
              <span className="sidebar-label">{label}</span>
            </div>
          );
        })}
      </div>

      <div className="sidebar-footer">
        <div
          className={`sidebar-nav-item${pathname === '/profile' ? ' sidebar-nav-active' : ''}`}
          onClick={(e) => go(e, '/profile')}
        >
          <div className="sidebar-icon-wrap">
            <User size={22} color="#707EAE" />
          </div>
          <span className="sidebar-label">Profile</span>
        </div>
        <div className="sidebar-nav-item sidebar-nav-item--logout" onClick={(e) => go(e, '/login')}>
          <div className="sidebar-icon-wrap">
            <LogOut size={22} color="#F54E25" />
          </div>
          <span className="sidebar-label" style={{ color: '#F54E25' }}>
            Logout
          </span>
        </div>
      </div>

      <div className="sidebar-expand-hint" aria-hidden="true">
        <span className="sidebar-expand-hint__chevron" />
      </div>
    </aside>
  );
}
