import { Home, BookUser, ClipboardList, Calendar, FileText, User, LogOut } from 'lucide-react';

/** Shared family portal sidebar navigation (Kalinga icon revisions). */
export const FAMILY_NAV_ITEMS = [
  { key: 'home', path: '/home', label: 'Dashboard', Icon: Home },
  { key: 'resident', path: '/patient-details', label: 'Resident Details', Icon: BookUser },
  { key: 'requests', path: '/progress', label: 'Request Management', Icon: ClipboardList },
  { key: 'appointments', path: '/appointments', label: 'Appointments', Icon: Calendar },
  { key: 'reports', path: '/reports', label: 'Reports', Icon: FileText },
];

export { User, LogOut };
