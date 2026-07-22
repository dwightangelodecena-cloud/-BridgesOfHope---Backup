import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';

// Component Imports
import LandingPage from '@/landingpage'; // Using @ for src/
import Login from '@/pages/auth/login';
import ForgotPassword from '@/pages/auth/forgot';
import Verify from '@/pages/auth/verify';
import NewPass from '@/pages/auth/newpass';
import AuthCallback from '@/pages/auth/auth-callback';
import GetTheApp from '@/pages/public/GetTheApp';
import { TermsOfService, PrivacyPolicy, CookiePolicy } from '@/pages/public/LegalPage';

// Nurse & Admin Pages
import NurseDashboard from '@/pages/nurse/nurse-dashboard';
import NurseCalendar from '@/pages/nurse/nurse-calendar';
import ProgramWeeklyReport from '@/pages/program/weekly-report';
import ProgramCalendarPage from '@/pages/program/program-calendar';
import NurseMedicalReportPage from '@/pages/nurse/medical-report';
import NurseProfile from '@/pages/nurse/nurseprofile';
import NurseChangePass from '@/pages/nurse/nursechangepass';
import AdminDashboard from '@/pages/admin/admin-dashboard';
import PatientDatabasePage from './pages/nurse/patient-database';
import { AdminPatientDatabaseGate } from '@/pages/admin/patient-database';
import Analytics from './pages/admin/analytics';
import UserManagement from '@/pages/admin/user-management';
import AdmissionManagement from '@/pages/admin/admission-management';
import DischargeManagement from '@/pages/admin/discharge-management';
import StaffManagement from '@/pages/admin/staff-management';
import ContentManagement from '@/pages/admin/content-management';
import AdminProfile from '@/pages/admin/admin-profile';
import AdminAppointmentsPage from '@/pages/admin/admin-appointments';
import AdminReportsPage from '@/pages/admin/admin-reports';
import AdminMessagesPage from '@/pages/admin/admin-messages';
import ProgramPage from '@/pages/program/program';
import ProgramDischargeManagement from '@/pages/program/program-discharge';
import kalingaLogo from '@/assets/kalingalogo.png';
import { RoleGuard } from '@/components/RoleGuard';
import AppErrorBoundary from '@/components/AppErrorBoundary';
import CookieConsentBanner from '@/components/CookieConsentBanner';

const ROUTE_TITLES = {
  '/': 'Home',
  '/login': 'Login',
  '/forgot': 'Forgot password',
  '/verify': 'Verify',
  '/newpass': 'New password',
  '/get-the-app': 'Get the App',
  '/terms': 'Terms of Service',
  '/privacy': 'Privacy Policy',
  '/cookies': 'Cookie Policy',
  '/nurse-dashboard': 'Nurse dashboard',
  '/nurse-calendar': 'Nurse calendar',
  '/nurse-medical-report': 'Medical report',
  '/program-weekly-report': 'Weekly report',
  '/program-calendar': 'Calendar',
  '/nurseprofile': 'Nurse profile',
  '/nursechangepass': 'Nurse change password',
  '/program': 'Program',
  '/program-discharge': 'Discharge management',
  '/admin-dashboard': 'Admin dashboard',
  '/patient-database': 'Resident database',
  '/admin-patient-database': 'Admin patient database',
  '/analytics': 'Analytics',
  '/admin-content-management': 'Content management',
  '/admin-profile': 'Admin profile',
  '/admin-appointments': 'Admin appointments',
  '/admin-reports': 'Printable reports',
  '/admin-messages': 'Messages',
};

function getPageTitle(pathname) {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
  if (pathname.startsWith('/reports/')) return ROUTE_TITLES['/reports'];

  const segment = pathname.split('/').filter(Boolean).pop();
  if (!segment) return 'Home';

  return segment
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function RouteMeta() {
  const location = useLocation();

  useEffect(() => {
    const pageTitle = getPageTitle(location.pathname);
    document.title = `${pageTitle} | Kalinga`;

    let favicon = document.querySelector("link[rel~='icon']");
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.setAttribute('rel', 'icon');
      document.head.appendChild(favicon);
    }
    favicon.setAttribute('href', kalingaLogo);
    favicon.setAttribute('type', 'image/png');
  }, [location.pathname]);

  useEffect(() => {
    // React Router doesn't reset scroll position on navigation — without
    // this, following a link from partway down a long page (e.g. the
    // landing page's footer) lands you at the same scrollY on the new,
    // often much shorter page, which can put you right at its bottom.
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return null;
}

function App() {
  return (
    <AppErrorBoundary>
      <Router>
        <RouteMeta />
        <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot" element={<ForgotPassword />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/newpass" element={<NewPass />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/get-the-app" element={<GetTheApp />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/cookies" element={<CookiePolicy />} />

        {/* Nurse Routes */}
        <Route
          path="/nurse-dashboard"
          element={
            <RoleGuard allowedRoles={['nurse']}>
              <NurseDashboard />
            </RoleGuard>
          }
        />
        <Route
          path="/nurse-calendar"
          element={
            <RoleGuard allowedRoles={['nurse']}>
              <NurseCalendar />
            </RoleGuard>
          }
        />
        <Route
          path="/nurse-medical-report"
          element={
            <RoleGuard allowedRoles={['nurse']}>
              <NurseMedicalReportPage />
            </RoleGuard>
          }
        />
        <Route
          path="/program-weekly-report"
          element={
            <RoleGuard allowedRoles={['program']}>
              <ProgramWeeklyReport />
            </RoleGuard>
          }
        />
        <Route
          path="/program-calendar"
          element={
            <RoleGuard allowedRoles={['program']}>
              <ProgramCalendarPage />
            </RoleGuard>
          }
        />
        <Route
          path="/nurseprofile"
          element={
            <RoleGuard allowedRoles={['nurse']}>
              <NurseProfile />
            </RoleGuard>
          }
        />
        <Route
          path="/nursechangepass"
          element={
            <RoleGuard allowedRoles={['nurse']}>
              <NurseChangePass />
            </RoleGuard>
          }
        />
        <Route
          path="/patient-database"
          element={
            <RoleGuard allowedRoles={['nurse']}>
              <PatientDatabasePage />
            </RoleGuard>
          }
        />

        {/* Admin Routes */}
        <Route
          path="/program"
          element={
            <RoleGuard allowedRoles={['program']}>
              <ProgramPage />
            </RoleGuard>
          }
        />
        <Route
          path="/program-discharge"
          element={
            <RoleGuard allowedRoles={['program']}>
              <ProgramDischargeManagement />
            </RoleGuard>
          }
        />
        <Route
          path="/admin-dashboard"
          element={
            <RoleGuard allowedRoles={['admin']}>
              <AdminDashboard />
            </RoleGuard>
          }
        />
        <Route
          path="/admin-patient-database"
          element={
            <RoleGuard allowedRoles={['admin', 'staff']}>
              <AdminPatientDatabaseGate />
            </RoleGuard>
          }
        />
        <Route
          path="/analytics"
          element={
            <RoleGuard allowedRoles={['admin']}>
              <Analytics />
            </RoleGuard>
          }
        />
        <Route
          path="/admin-user-management"
          element={
            <RoleGuard allowedRoles={['admin']}>
              <UserManagement />
            </RoleGuard>
          }
        />
        <Route
          path="/admin-staff-management"
          element={
            <RoleGuard allowedRoles={['admin']}>
              <StaffManagement />
            </RoleGuard>
          }
        />
        <Route
          path="/admin-admission-management"
          element={
            <RoleGuard allowedRoles={['admin']}>
              <AdmissionManagement />
            </RoleGuard>
          }
        />
        <Route
          path="/admin-discharge-management"
          element={
            <RoleGuard allowedRoles={['admin']}>
              <DischargeManagement />
            </RoleGuard>
          }
        />
        <Route
          path="/admin-content-management"
          element={
            <RoleGuard allowedRoles={['admin']}>
              <ContentManagement />
            </RoleGuard>
          }
        />
        <Route
          path="/admin-profile"
          element={
            <RoleGuard allowedRoles={['admin']}>
              <AdminProfile />
            </RoleGuard>
          }
        />
        <Route
          path="/admin-appointments"
          element={
            <RoleGuard allowedRoles={['admin', 'staff']}>
              <AdminAppointmentsPage />
            </RoleGuard>
          }
        />
        <Route
          path="/admin-reports"
          element={
            <RoleGuard allowedRoles={['admin', 'staff']}>
              <AdminReportsPage />
            </RoleGuard>
          }
        />
        <Route
          path="/admin-messages"
          element={
            <RoleGuard allowedRoles={['admin', 'staff']}>
              <AdminMessagesPage />
            </RoleGuard>
          }
        />
        </Routes>
        <CookieConsentBanner />
      </Router>
    </AppErrorBoundary>
  );
}

export default App;