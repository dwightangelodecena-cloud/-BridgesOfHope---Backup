import React from 'react';
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
} from 'lucide-react';
import { AdminMessagesNavItem } from './AdminMessagesNavItem';

const NAV_ITEMS = [
  { path: '/admin-dashboard', label: 'Dashboard', Icon: LayoutGrid },
  { path: '/admin-patient-database', label: 'Patient Management', Icon: BookUser },
  { path: '/admin-admission-management', label: 'Admission Management', Icon: ClipboardList },
  { path: '/admin-discharge-management', label: 'Discharge Management', Icon: ArrowRightSquare },
  { path: '/admin-user-management', label: 'User Management', Icon: Users },
  { path: '/admin-staff-management', label: 'Staff Management', Icon: Stethoscope },
  { path: '/admin-content-management', label: 'Content management', Icon: LayoutTemplate },
  { path: '/admin-appointments', label: 'Appointments', Icon: Calendar },
  { path: '/admin-messages', label: 'Messages', isMessages: true },
  { path: '/admin-reports', label: 'Printable reports', Icon: FileText },
];

export function AdminSidebarNav({ activePath, navigate }) {
  return (
    <nav className="sidebar-nav-scroll" aria-label="Admin navigation">
      {NAV_ITEMS.map(({ path, label, Icon, isMessages }) => {
        const active = activePath === path;
        if (isMessages) {
          return (
            <AdminMessagesNavItem
              key={path}
              active={active}
              onClick={
                active
                  ? (e) => e.stopPropagation()
                  : (e) => {
                      e.stopPropagation();
                      navigate(path);
                    }
              }
            />
          );
        }
        return (
          <div
            key={path}
            className="sidebar-nav-item"
            onClick={
              active
                ? undefined
                : (e) => {
                    e.stopPropagation();
                    navigate(path);
                  }
            }
          >
            <div className={`icon-box ${active ? 'active' : 'inactive'}`}>
              <Icon size={22} />
            </div>
            <span className="sidebar-label" style={active ? { color: '#F54E25' } : undefined}>
              {label}
            </span>
          </div>
        );
      })}
    </nav>
  );
}

export function AdminSidebarFooter({ navigate, isExpanded }) {
  return (
    <div className="sidebar-footer">
      <div
        className="sidebar-nav-item"
        onClick={(e) => {
          e.stopPropagation();
          navigate('/admin-profile');
        }}
      >
        <div className="icon-box inactive">
          <User size={22} />
        </div>
        <span className="sidebar-label">Profile & Security</span>
      </div>
      <div
        className="sidebar-nav-item"
        onClick={(e) => {
          e.stopPropagation();
          navigate('/login');
        }}
      >
        <LogOut size={22} color="#F54E25" style={{ marginLeft: isExpanded ? 0 : 10, flexShrink: 0 }} />
        <span className="sidebar-label" style={{ color: '#F54E25' }}>
          Logout
        </span>
      </div>
    </div>
  );
}
