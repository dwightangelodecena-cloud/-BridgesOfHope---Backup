import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';

// Component Imports
import LandingPage from '@/landingpage'; // Using @ for src/
import Login from '@/pages/auth/login';
import SignUp from '@/pages/auth/signup';
import ForgotPassword from '@/pages/auth/forgot';
import Verify from '@/pages/auth/verify';
import NewPass from '@/pages/auth/newpass';
import AuthCallback from '@/pages/auth/auth-callback';

// Family/User Pages
import HomeDashboard from '@/pages/family/home';
import Service from '@/pages/family/service';
import Progress from '@/pages/family/progress';
import FamilyAppointmentsPage from '@/pages/family/appointments';
import Profile from '@/pages/family/profile';
import ChangePass from '@/pages/auth/changepass';

// Nurse & Admin Pages
import NurseDashboard from '@/pages/nurse/weekly-report';
import NurseProfile from '@/pages/nurse/nurseprofile';
import NurseChangePass from '@/pages/nurse/nursechangepass';
import AdminDashboard from '@/pages/admin/admin-dashboard';
import PatientDatabasePage from './pages/nurse/patient-database';
import AdminPatientDatabase from '@/pages/admin/patient-database';
import Analytics from './pages/admin/analytics';
import UserManagement from '@/pages/admin/user-management';
import AdmissionManagement from '@/pages/admin/admission-management';
import DischargeManagement from '@/pages/admin/discharge-management';
import StaffManagement from '@/pages/admin/staff-management';
import ContentManagement from '@/pages/admin/content-management';
import AdminProfile from '@/pages/admin/admin-profile';
import AdminAppointmentsPage from '@/pages/admin/admin-appointments';
import AdminReportsPage from '@/pages/admin/admin-reports';
import kalingaLogo from '@/assets/kalingalogo.png';
import { RoleGuard } from '@/components/RoleGuard';

const ROUTE_TITLES = {
  '/': 'Home',
  '/home': 'Home',
  '/login': 'Login',
  '/signup': 'Sign up',
  '/forgot': 'Forgot password',
  '/verify': 'Verify',
  '/newpass': 'New password',
  '/services': 'Services',
  '/progress': 'Progress',
  '/appointments': 'Appointments',
  '/profile': 'Profile',
  '/changepass': 'Change password',
  '/nurse-dashboard': 'Nurse dashboard',
  '/nurseprofile': 'Nurse profile',
  '/nursechangepass': 'Nurse change password',
  '/admin-dashboard': 'Admin dashboard',
  '/patient-database': 'Patient database',
  '/admin-patient-database': 'Admin patient database',
  '/analytics': 'Analytics',
  '/admin-content-management': 'Content management',
  '/admin-profile': 'Admin profile',
  '/admin-appointments': 'Admin appointments',
  '/admin-reports': 'Printable reports',
};

function getPageTitle(pathname) {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];

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

  return null;
}

function App() {
  return (
    <Router>
      <RouteMeta />
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot" element={<ForgotPassword />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/newpass" element={<NewPass />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Family/User Routes */}
        <Route
          path="/home"
          element={
            <RoleGuard allowedRoles={['family']}>
              <HomeDashboard />
            </RoleGuard>
          }
        />
        <Route
          path="/services"
          element={
            <RoleGuard allowedRoles={['family']}>
              <Service />
            </RoleGuard>
          }
        />
        <Route
          path="/progress"
          element={
            <RoleGuard allowedRoles={['family']}>
              <Progress />
            </RoleGuard>
          }
        />
        <Route
          path="/appointments"
          element={
            <RoleGuard allowedRoles={['family']}>
              <FamilyAppointmentsPage />
            </RoleGuard>
          }
        />
        <Route
          path="/profile"
          element={
            <RoleGuard allowedRoles={['family']}>
              <Profile />
            </RoleGuard>
          }
        />
        <Route
          path="/changepass"
          element={
            <RoleGuard allowedRoles={['family']}>
              <ChangePass />
            </RoleGuard>
          }
        />

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
            <RoleGuard allowedRoles={['admin']}>
              <AdminPatientDatabase />
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
            <RoleGuard allowedRoles={['admin']}>
              <AdminAppointmentsPage />
            </RoleGuard>
          }
        />
        <Route
          path="/admin-reports"
          element={
            <RoleGuard allowedRoles={['admin']}>
              <AdminReportsPage />
            </RoleGuard>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;