import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

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
import AdminDashboard from '@/pages/admin/patient-database';

function App() {
  return (
    <Router>
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
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;