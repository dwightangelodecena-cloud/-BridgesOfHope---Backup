import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';

// Component Imports
import LandingPage from '@/landingpage'; // Using @ for src/
import Login from '@/pages/auth/login';
import SignUp from '@/pages/auth/signup';
import ForgotPassword from '@/pages/auth/forgot';
import Verify from '@/pages/auth/verify';
import NewPass from '@/pages/auth/newpass';

// Family/User Pages
import HomeDashboard from '@/pages/family/home';
import Admission from '@/pages/family/admission';
import Service from '@/pages/family/service';
import Progress from '@/pages/family/progress';
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
import kalingaLogo from '@/assets/kalingalogo.png';

const ROUTE_TITLES = {
  '/': 'Home',
  '/home': 'Home',
  '/login': 'Login',
  '/signup': 'Sign up',
  '/forgot': 'Forgot password',
  '/verify': 'Verify',
  '/newpass': 'New password',
  '/admission': 'Admission',
  '/services': 'Services',
  '/progress': 'Progress',
  '/profile': 'Profile',
  '/changepass': 'Change password',
  '/nurse-dashboard': 'Nurse dashboard',
  '/nurseprofile': 'Nurse profile',
  '/nursechangepass': 'Nurse change password',
  '/admin-dashboard': 'Admin dashboard',
  '/patient-database': 'Patient database',
  '/admin-patient-database': 'Admin patient database',
  '/analytics': 'Analytics',
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

        {/* Family/User Routes */}
        <Route path="/home" element={<HomeDashboard />} />
        <Route path="/admission" element={<Admission />} />
        <Route path="/services" element={<Service />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/changepass" element={<ChangePass />} />

        {/* Nurse & Admin Routes */}
        <Route path="/nurse-dashboard" element={<NurseDashboard />} />
        <Route path="/nurseprofile" element={<NurseProfile />} />
        <Route path="/nursechangepass" element={<NurseChangePass />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/patient-database" element={<PatientDatabasePage />} />
        <Route path="/admin-patient-database" element={<AdminPatientDatabase />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/admin-user-management" element={<UserManagement />} />
        <Route path="/admin-staff-management" element={<StaffManagement />} />
        <Route path="/admin-admission-management" element={<AdmissionManagement />} />
        <Route path="/admin-discharge-management" element={<DischargeManagement />} />
      </Routes>
    </Router>
  );
}

export default App;