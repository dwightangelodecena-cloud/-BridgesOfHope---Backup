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
import { supabase } from '@/lib/supabase';

/** Same routes & order as FamilySidebar (primary nav + profile + logout). */
const NAV_ITEMS = [
  { path: '/home', label: 'Home', icon: Home },
  { path: '/patient-details', label: 'Residents', icon: BookUser },
  { path: '/progress', label: 'Requests', icon: ClipboardList },
  { path: '/appointments', label: 'Visits', icon: Calendar },
  { path: '/reports', label: 'Reports', icon: FileText },
  { path: '/profile', label: 'Profile', icon: User },
];

function isNavActive(pathname, path) {
  if (path === '/home') return pathname === '/home' || pathname === '/';
  return pathname === path || pathname.startsWith(`${path}/`);
}

export default function FamilyMobileBottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const onLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      /* still navigate */
    }
    navigate('/login');
  };

  return (
    <nav className="family-mobile-bottom-nav mobile-only" aria-label="Family portal navigation">
      {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
        const active = isNavActive(pathname, path);
        return (
          <button
            key={path}
            type="button"
            className={`family-mobile-bottom-nav__item${active ? ' family-mobile-bottom-nav__item--active' : ''}`}
            onClick={() => navigate(path)}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={21} color={active ? '#F54E25' : '#A3AED0'} strokeWidth={2} aria-hidden />
            {active ? <span className="family-mobile-bottom-nav__label">{label}</span> : null}
          </button>
        );
      })}
      <button
        type="button"
        className="family-mobile-bottom-nav__item family-mobile-bottom-nav__item--logout"
        onClick={() => void onLogout()}
        aria-label="Log out"
      >
        <LogOut size={21} color="#F54E25" strokeWidth={2} aria-hidden />
      </button>
    </nav>
  );
}
