import React, { useState, useRef, useEffect } from 'react';
import { Home, TrendingUp, User, LogOut, Pencil, X, ChevronRight, Calendar, ClipboardList, BarChart3, Bell, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAsyncData } from '@/hooks/useAsyncData';
import { familyDataService } from '@/services/familyDataService';
import { FAMILY_COLORS, StatusBadge, AuditLine, LoadingState, ErrorState } from '@/components/family/shared/ui';
import FloatingChatHead from '@/components/family/FloatingChatHead';

import logo from '@/assets/kalingalogo.png';

const Profile = () => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationSounds, setNotificationSounds] = useState(false);
  const [muteOption, setMuteOption] = useState('Until I change it');
  const [showMuteDropdown, setShowMuteDropdown] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');
  const [profileForm, setProfileForm] = useState(() => {
    const saved = localStorage.getItem('bh_family_profile');
    return saved ? JSON.parse(saved) : {
      fullName: 'Family User',
      email: '',
      phone: '',
      address: 'Cavite, Philippines',
    };
  });
  const [draftProfile, setDraftProfile] = useState(profileForm);
  const fileInputRef = useRef(null);
  const notificationsDesktopRef = useRef(null);
  const notificationsMobileRef = useRef(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationItems = [
    'Submit missing laboratory result before Friday.',
    'Family support session is scheduled on April 5, 10:00 AM.',
    'Weekly report reviewed by your assigned counselor.',
    'Community Update: Join the monthly Family Wellness Talk on April 9 to learn practical family recovery support strategies.',
  ];
  const {
    data: profileSnapshot,
    loading: snapshotLoading,
    error: snapshotError,
    refresh: refreshSnapshot,
  } = useAsyncData(async () => familyDataService.getProfileSnapshot(), []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setProfileImage(url);
    }
  };

  const handleProfileInput = (e) => {
    const { name, value } = e.target;
    setDraftProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditToggle = () => {
    setDraftProfile(profileForm);
    setIsEditingProfile(true);
  };

  const handleCancelEdit = () => {
    setDraftProfile(profileForm);
    setIsEditingProfile(false);
  };

  const handleSaveProfile = () => {
    setProfileForm(draftProfile);
    localStorage.setItem('bh_family_profile', JSON.stringify(draftProfile));
    setIsEditingProfile(false);
    setSaveNotice('Profile updated successfully.');
    setTimeout(() => setSaveNotice(''), 1800);
  };

  useEffect(() => {
    let isMounted = true;

    const syncProfileFromSupabase = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) return;

      const metadataName =
        user.user_metadata?.full_name ||
        [user.user_metadata?.first_name, user.user_metadata?.last_name].filter(Boolean).join(' ');
      const metadataPhone = user.user_metadata?.contact_number || '';

      let profileName = '';
      let profilePhone = '';
      if (user.id) {
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('full_name, phone')
          .eq('id', user.id)
          .maybeSingle();
        profileName = profileRow?.full_name || '';
        profilePhone = profileRow?.phone || '';
      }

      const resolved = {
        fullName: profileName || metadataName || 'Family User',
        email: user.email || '',
        phone: profilePhone || metadataPhone || '',
        address: profileForm.address || 'Cavite, Philippines',
      };

      if (isMounted) {
        setProfileForm(resolved);
        setDraftProfile(resolved);
        localStorage.setItem('bh_family_profile', JSON.stringify(resolved));
      }
    };

    syncProfileFromSupabase();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!showNotifications) return;
    const onDoc = (e) => {
      const t = e.target;
      const inDesktop = notificationsDesktopRef.current?.contains(t);
      const inMobile = notificationsMobileRef.current?.contains(t);
      if (!inDesktop && !inMobile) setShowNotifications(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [showNotifications]);

  const handleNotificationToggle = () => setShowNotifications((v) => !v);

  const userInitials =
    profileForm.fullName.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join('') || 'FU';

  return (
    <div className="app-container">
      <style>{`
        .app-container {
          display: flex;
          width: 100vw;
          height: 100vh;
          background: ${FAMILY_COLORS.background};
          font-family: 'Inter', -apple-system, sans-serif;
          overflow: hidden;
          touch-action: manipulation;
        }

        .desktop-sidebar {
          width: ${isExpanded ? '280px' : '110px'};
          background: white;
          border-right: 1px solid #F1F1F1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 25px 0 170px;
          z-index: 100;
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          position: relative;
        }

        .sidebar-logo-container {
          display: flex;
          justify-content: center;
          width: 100%;
          margin-bottom: 40px;
        }

        .sidebar-logo {
          width: ${isExpanded ? '120px' : '70px'};
          transition: width 0.3s ease;
        }

        .sidebar-nav-item {
          display: flex;
          align-items: center;
          width: 100%;
          padding: 0 ${isExpanded ? '35px' : '0'};
          justify-content: ${isExpanded ? 'flex-start' : 'center'};
          gap: 20px;
          margin-bottom: 25px;
          min-height: 52px;
          box-sizing: border-box;
          border: 2px solid transparent;
          border-radius: 12px;
        }
        .sidebar-nav-item.sidebar-nav-active { border-color: #F54E25; }

        .sidebar-label {
          display: ${isExpanded ? 'block' : 'none'};
          font-weight: 700;
          font-size: 18px;
          color: #707EAE;
          white-space: nowrap;
        }
        .sidebar-icon-wrap {
          padding: 12px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .sidebar-primary { width: 100%; }
        .sidebar-footer {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 20px;
          width: 100%;
        }
        .sidebar-footer .sidebar-nav-item { margin-bottom: 0; }
        .sidebar-footer .sidebar-nav-item + .sidebar-nav-item { margin-top: 14px; }

        .main-view {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .top-nav {
          height: 85px;
          background: white;
          display: flex;
          align-items: center;
          padding: 0 30px;
          border-bottom: 1px solid #F1F1F1;
          box-sizing: border-box;
          z-index: 300;
        }

        .top-nav-actions {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 14px;
          flex-shrink: 0;
        }

        .notifications-dropdown {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          width: min(360px, calc(100vw - 48px));
          background: white;
          border: 1px solid #E9EDF7;
          border-radius: 14px;
          box-shadow: 0 12px 40px rgba(27, 37, 89, 0.12);
          padding: 16px;
          z-index: 400;
        }

        .notifications-trigger {
          width: 40px;
          height: 40px;
          min-width: 40px;
          min-height: 40px;
          padding: 0;
          box-sizing: border-box;
          flex-shrink: 0;
          border-radius: 50%;
          border: none;
          background: #F54E25;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: white;
          box-shadow: 0 2px 10px rgba(245, 78, 37, 0.4);
        }

        .notifications-trigger:hover {
          background: #e0421a;
          box-shadow: 0 4px 14px rgba(245, 78, 37, 0.5);
        }

        .notifications-trigger:focus-visible {
          outline: 2px solid #1B2559;
          outline-offset: 2px;
        }

        .notifications-trigger svg {
          display: block;
          width: 21px;
          height: 21px;
          stroke: #ffffff;
          color: #ffffff;
          flex-shrink: 0;
        }

        .panel-title {
          color: #1B2559;
          font-weight: 800;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .interactive-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 10px;
          color: #334155;
          font-size: 13px;
        }

        .user-avatar-top {
          width: 40px;
          height: 40px;
          min-width: 40px;
          min-height: 40px;
          background: #F54E25;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 13px;
          box-sizing: border-box;
          border: none;
          cursor: pointer;
        }
        .top-nav-title {
          color: #F54E25;
          font-weight: 800;
          font-size: 23px;
          letter-spacing: -0.01em;
        }
        .top-nav-subtitle {
          color: #1B2559;
          font-weight: 600;
          font-size: 18px;
        }

        .scroll-content {
          flex: 1;
          padding: 28px 40px 40px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
<<<<<<< HEAD
=======
        }

        .profile-content-wrap {
          width: 100%;
          max-width: 980px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
>>>>>>> fb77b15a029aa3f3735eac8ec83bbc0f55f16a13
        }

        /* PROFILE CARD */
        .profile-card {
<<<<<<< HEAD
          background: white;
          border-radius: 50px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08);
          padding: 56px 45px 50px;
          border: 1px solid #f1f5f9;
=======
          background: linear-gradient(180deg, #FFFFFF 0%, #FBFDFF 100%);
          border-radius: 28px;
          box-shadow: 0 18px 44px rgba(15, 23, 42, 0.08);
          padding: 42px 36px;
          border: 1px solid #E8EEF8;
>>>>>>> fb77b15a029aa3f3735eac8ec83bbc0f55f16a13
          width: 100%;
          max-width: 760px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .profile-card-header {
          width: 100%;
          border: 1px solid #E6EDF9;
          background: linear-gradient(180deg, #FFF7F4 0%, #FFFFFF 100%);
          border-radius: 16px;
          padding: 14px;
          margin-bottom: 14px;
        }

        .avatar-wrapper {
          position: relative;
          margin-bottom: 10px;
        }

        .avatar-circle {
          width: 130px;
          height: 130px;
          border-radius: 50%;
          background: linear-gradient(145deg, #F97316, #EA580C);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          cursor: pointer;
          box-shadow: 0 14px 28px rgba(234, 88, 12, 0.24);
        }

        .avatar-circle img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .avatar-edit-btn {
          position: absolute;
          bottom: 4px;
          right: 4px;
          width: 34px;
          height: 34px;
          background: white;
          border-radius: 50%;
          border: 2px solid #F54E25;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 6px 14px rgba(15, 23, 42, 0.12);
        }

        .profile-name {
          font-size: 22px;
          font-weight: 800;
          color: #1B2559;
          margin-bottom: 20px;
          letter-spacing: -0.01em;
        }

        .save-notice {
          width: 100%;
          background: #ECFDF3;
          border: 1px solid #A7F3D0;
          color: #166534;
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 14px;
          text-align: center;
        }

        .profile-info-box {
          width: 100%;
          border: 1px solid #E6EDF9;
          border-radius: 14px;
          padding: 20px;
          margin-bottom: 16px;
          background: #ffffff;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.04);
        }

        .info-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }

        .profile-input-group {
          margin-bottom: 10px;
          text-align: left;
        }

        .profile-input-group:last-child {
          margin-bottom: 0;
        }

        .profile-input-label {
          display: block;
          font-size: 12px;
          color: #64748b;
          font-weight: 600;
          margin-bottom: 6px;
        }

        .profile-input {
          width: 100%;
          box-sizing: border-box;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          padding: 9px 12px;
          min-height: 40px;
          font-size: 13px;
          color: #1e293b;
          outline: none;
          transition: all 0.2s;
          background: #fff;
        }

        .profile-input:focus {
          border-color: #F54E25;
          box-shadow: 0 0 0 4px rgba(245, 78, 37, 0.1);
        }

        .profile-input[disabled] {
          background: #F8FAFC;
          color: #334155;
          cursor: not-allowed;
        }

        .btn-inline {
          border: 1px solid #E2E8F0;
          background: #FFFFFF;
          color: #334155;
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .btn-primary-inline {
          border: 1px solid #F54E25;
          background: #F54E25;
          color: #FFFFFF;
        }

        /* SETTINGS BOX */
        .settings-box {
          width: 100%;
          border: 1px solid #E6EDF9;
          border-radius: 14px;
          padding: 20px;
          margin-bottom: 16px;
          background: #FFFFFF;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.04);
        }

        .settings-box-title {
          font-size: 17px;
          font-weight: 700;
          color: #1B2559;
          margin-bottom: 8px;
        }

        .settings-item {
          font-size: 14px;
          color: #1B2559;
          font-weight: 600;
          padding: 14px 0;
          border-bottom: 1px solid #F0F0F0;
          cursor: pointer;
        }

        .settings-item:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        /* PREFERENCES BOX */
        .preferences-box {
          width: 100%;
          border: 1px solid #E6EDF9;
          border-radius: 14px;
          padding: 20px;
          margin-bottom: 16px;
          background: #FFFFFF;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.04);
        }

        .preferences-box-title {
          font-size: 16px;
          font-weight: 700;
          color: #1B2559;
          margin-bottom: 14px;
        }

        .pref-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .pref-label {
          font-size: 15px;
          color: #1B2559;
          font-weight: 400;
        }

        .toggle-track {
          width: 48px;
          height: 26px;
          border-radius: 13px;
          background: ${darkMode ? '#F54E25' : '#D0D5DD'};
          position: relative;
          cursor: pointer;
          transition: background 0.25s;
        }

        .toggle-thumb {
          position: absolute;
          top: 3px;
          left: ${darkMode ? '25px' : '3px'};
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.2);
          transition: left 0.25s;
        }

        /* NOTIFICATION EXPANDED */
        .notif-expanded {
          border-top: 1px solid #F0F0F0;
          margin-top: 4px;
          padding-top: 4px;
        }

        .notif-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 0;
          border-bottom: 1px solid #F0F0F0;
          font-size: 15px;
          color: #1B2559;
          font-weight: 400;
          cursor: pointer;
        }

        .notif-row:last-child { border-bottom: none; padding-bottom: 0; }

        .notif-row-right {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #A3AED0;
          font-size: 14px;
          position: relative;
        }

        .mute-dropdown {
          position: absolute;
          right: 0;
          top: 30px;
          background: white;
          border-radius: 14px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.12);
          min-width: 200px;
          z-index: 100;
          overflow: hidden;
          animation: dropIn 0.15s ease-out;
        }

        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .mute-option {
          padding: 16px 24px;
          font-size: 15px;
          color: #1B2559;
          font-weight: 400;
          cursor: pointer;
          border-bottom: 1px solid #F5F5F5;
          transition: background 0.15s;
        }

        .mute-option:last-child { border-bottom: none; }
        .mute-option:hover { background: #FFF4F1; color: #F54E25; }
        .mute-option.selected { color: #F54E25; font-weight: 600; }

        /* PHOTO MODAL */
        .photo-modal-overlay {
          position: fixed;
          top: 0; left: 0;
          width: 100vw; height: 100vh;
          background: rgba(0,0,0,0.18);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
        }

        .photo-modal {
          background: white;
          border-radius: 18px;
          padding: 28px 32px;
          width: 100%;
          max-width: 360px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.15);
          animation: modalPop 0.2s ease-out;
        }

        @keyframes modalPop {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }

        .photo-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .photo-modal-title {
          font-size: 16px;
          font-weight: 700;
          color: #1B2559;
        }

        .photo-modal-close {
          cursor: pointer;
          color: #1B2559;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .photo-modal-item {
          font-size: 15px;
          color: #1B2559;
          font-weight: 400;
          padding: 14px 0;
          border-bottom: 1px solid #F0F0F0;
          cursor: pointer;
          transition: color 0.15s;
        }

        .photo-modal-item:hover { color: #F54E25; }

        .photo-modal-item:last-child { border-bottom: none; padding-bottom: 0; }

        .mobile-only { display: none; }

        @media (max-width: 768px) {
          .desktop-sidebar, .top-nav, .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; }
          .app-container { flex-direction: column; height: 100vh; overflow: hidden; }
          .mobile-top-bar { padding: 0 20px; height: 60px; background: white; border-bottom: 1px solid #F1F1F1; align-items: center; justify-content: space-between; }
<<<<<<< HEAD
          .mobile-notifications-trigger.notifications-trigger {
            width: 34px;
            height: 34px;
            min-width: 34px;
            min-height: 34px;
            padding: 0;
          }
          .mobile-notifications-trigger.notifications-trigger svg {
            width: 18px;
            height: 18px;
          }
          .mobile-notifications-dropdown { right: 0; left: auto; width: min(340px, calc(100vw - 40px)); }
          .scroll-content { padding: 20px 15px 90px !important; align-items: center !important; justify-content: flex-start !important; overflow-y: auto; }
          .profile-card { max-width: 100%; padding: 28px 20px 24px 20px; }
=======
          .scroll-content { padding: 15px !important; padding-bottom: 90px !important; align-items: flex-start !important; overflow-y: auto; }
          .profile-content-wrap { max-width: 100%; gap: 12px; }
          .profile-card { max-width: 100%; padding: 24px 16px 20px 16px; border-radius: 18px; }
          .profile-card-header { padding: 12px; margin-bottom: 10px; }
>>>>>>> fb77b15a029aa3f3735eac8ec83bbc0f55f16a13
          .mobile-bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; height: 70px; background: white; border-top: 1px solid #EEE; display: flex; justify-content: space-around; align-items: center; padding-bottom: env(safe-area-inset-bottom); z-index: 1000; }
        }
      `}</style>

      {/* DESKTOP SIDEBAR — exact copy from home.jsx */}
      <aside className="desktop-sidebar" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="sidebar-logo-container">
          <img src={logo} alt="Kalinga" className="sidebar-logo" />
        </div>

        <div className="sidebar-primary">
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/home'); }}>
            <div className="sidebar-icon-wrap"><Home size={22} color="#707EAE" /></div>
            <span className="sidebar-label">Dashboard</span>
          </div>

          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/patient-details'); }}>
            <div className="sidebar-icon-wrap"><ClipboardList size={22} color="#707EAE" /></div>
            <span className="sidebar-label">Patient Details</span>
          </div>

          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/progress'); }}>
            <div className="sidebar-icon-wrap"><TrendingUp size={22} color="#707EAE" /></div>
            <span className="sidebar-label">Request Management</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/appointments'); }}>
            <div className="sidebar-icon-wrap"><Calendar size={22} color="#707EAE" /></div>
            <span className="sidebar-label">Appointments</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/reports'); }}>
            <div className="sidebar-icon-wrap"><BarChart3 size={22} color="#707EAE" /></div>
            <span className="sidebar-label">Reports</span>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-nav-item sidebar-nav-active" onClick={(e) => { e.stopPropagation(); navigate('/profile'); }}>
            <div className="sidebar-icon-wrap"><User size={22} color="#707EAE" /></div>
            <span className="sidebar-label">Profile</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/login'); }}>
            <div className="sidebar-icon-wrap"><LogOut size={22} color="#F54E25" style={{ cursor: 'pointer' }} /></div>
            <span className="sidebar-label" style={{ color: '#F54E25' }}>Logout</span>
          </div>
        </div>
      </aside>

      <div className="main-view">

        {/* DESKTOP TOP NAV — exact copy from home.jsx */}
        <header className="top-nav">
<<<<<<< HEAD
          <div className="top-nav-actions">
            <div ref={notificationsDesktopRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className="notifications-trigger"
                aria-expanded={showNotifications}
                aria-label="Notifications"
                onClick={handleNotificationToggle}
              >
                <Bell size={20} stroke="#ffffff" strokeWidth={2.25} aria-hidden />
              </button>
              {showNotifications && (
                <div className="notifications-dropdown">
                  <div className="panel-title" style={{ marginBottom: 12 }}>
                    <Bell size={16} color="#F54E25" /> Notifications
                  </div>
                  {notificationItems.map((item) => (
                    <div key={item} className="interactive-row">
                      <CheckCircle2 size={15} color="#2B31ED" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button type="button" className="user-avatar-top" aria-label="Open profile" onClick={() => navigate('/profile')}>
              {userInitials}
            </button>
=======
          <div style={{ display: 'flex', gap: 45 }}>
            <span className="top-nav-title">Profile</span>
            <span className="top-nav-subtitle">Welcome back</span>
          </div>
          <div style={{ marginLeft: 'auto', width: 38, height: 38, background: '#F54E25', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
            {profileForm.fullName.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join('') || 'FU'}
>>>>>>> fb77b15a029aa3f3735eac8ec83bbc0f55f16a13
          </div>
        </header>

        <div className="mobile-only mobile-top-bar">
<<<<<<< HEAD
          <img src={logo} alt="BH" style={{ width: 50 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div ref={notificationsMobileRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className="notifications-trigger mobile-notifications-trigger"
                aria-expanded={showNotifications}
                aria-label="Notifications"
                onClick={handleNotificationToggle}
              >
                <Bell size={18} stroke="#ffffff" strokeWidth={2.25} aria-hidden />
              </button>
              {showNotifications && (
                <div className="notifications-dropdown mobile-notifications-dropdown">
                  <div className="panel-title" style={{ marginBottom: 12 }}>
                    <Bell size={16} color="#F54E25" /> Notifications
                  </div>
                  {notificationItems.map((item) => (
                    <div key={`m-${item}`} className="interactive-row">
                      <CheckCircle2 size={15} color="#2B31ED" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate('/profile')}
              aria-label="Open profile"
              style={{
                width: 34,
                height: 34,
                background: '#F54E25',
                color: 'white',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '12px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {userInitials}
            </button>
=======
          <img src={logo} alt="Kalinga" style={{ width: 50 }} />
          <div style={{ width: 34, height: 34, background: '#F54E25', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px' }}>
            {profileForm.fullName.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join('') || 'FU'}
>>>>>>> fb77b15a029aa3f3735eac8ec83bbc0f55f16a13
          </div>
        </div>

        <div className="scroll-content">
          <div className="profile-content-wrap">
          <div style={{ width: '100%', maxWidth: 760, marginBottom: 0 }}>
            <div style={{ background: '#fff', border: `1px solid ${FAMILY_COLORS.surface}`, borderRadius: 16, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong style={{ color: FAMILY_COLORS.text }}>Profile Completeness</strong>
                <StatusBadge label={draftProfile?.email && draftProfile?.phone ? 'Complete' : 'Incomplete'} tone={draftProfile?.email && draftProfile?.phone ? 'success' : 'warning'} />
              </div>
              {snapshotLoading ? <LoadingState label="Checking profile snapshot..." /> : null}
              {snapshotError ? <ErrorState label={snapshotError} onRetry={refreshSnapshot} /> : null}
              {!snapshotLoading && !snapshotError ? (
                <AuditLine text={`Profile source: ${profileSnapshot?.fullName || 'Family User'} | last viewed ${new Date().toLocaleString()}`} />
              ) : null}
            </div>
          </div>
          <div className="profile-card">
            <div className="profile-card-header">

            {/* Avatar */}
            <div className="avatar-wrapper">
              <div className="avatar-circle" onClick={() => setShowPhotoModal(true)}>
                <input type="file" hidden accept="image/*" ref={fileInputRef} onChange={handleImageChange} />
                {profileImage
                  ? <img src={profileImage} alt="profile" />
                  : <User size={64} color="white" strokeWidth={1.5} />
                }
              </div>
              <div className="avatar-edit-btn" onClick={() => setShowPhotoModal(true)}>
                <Pencil size={15} color="#F54E25" />
              </div>
            </div>

            {/* Photo Modal */}
            {showPhotoModal && (
              <div className="photo-modal-overlay" onClick={() => setShowPhotoModal(false)}>
                <div className="photo-modal" onClick={e => e.stopPropagation()}>
                  <div className="photo-modal-header">
                    <span className="photo-modal-title">Add a Profile Picture</span>
                    <span className="photo-modal-close" onClick={() => setShowPhotoModal(false)}>
                      <X size={22} />
                    </span>
                  </div>
                  <div className="photo-modal-item">Take Photo</div>
                  <div className="photo-modal-item" onClick={() => { setShowPhotoModal(false); fileInputRef.current.click(); }}>From this PC</div>
                </div>
              </div>
            )}

            {/* Name */}
            <div className="profile-name">{profileForm.fullName}</div>
            </div>

            {saveNotice && <div className="save-notice">{saveNotice}</div>}

            {/* Editable Profile */}
            <div className="profile-info-box">
              <div className="info-title-row">
                <div className="settings-box-title" style={{ marginBottom: 0 }}>Profile Information</div>
                {!isEditingProfile ? (
                  <button className="btn-inline" onClick={handleEditToggle}>Edit Profile</button>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-inline" onClick={handleCancelEdit}>Cancel</button>
                    <button className="btn-inline btn-primary-inline" onClick={handleSaveProfile}>Save</button>
                  </div>
                )}
              </div>

              <div className="profile-input-group">
                <label className="profile-input-label">Full Name</label>
                <input
                  className="profile-input"
                  name="fullName"
                  value={draftProfile.fullName}
                  onChange={handleProfileInput}
                  disabled={!isEditingProfile}
                />
              </div>
              <div className="profile-input-group">
                <label className="profile-input-label">Email</label>
                <input
                  className="profile-input"
                  name="email"
                  value={draftProfile.email}
                  onChange={handleProfileInput}
                  disabled={!isEditingProfile}
                />
              </div>
              <div className="profile-input-group">
                <label className="profile-input-label">Phone Number</label>
                <input
                  className="profile-input"
                  name="phone"
                  value={draftProfile.phone}
                  onChange={handleProfileInput}
                  disabled={!isEditingProfile}
                />
              </div>
              <div className="profile-input-group">
                <label className="profile-input-label">Address</label>
                <input
                  className="profile-input"
                  name="address"
                  value={draftProfile.address}
                  onChange={handleProfileInput}
                  disabled={!isEditingProfile}
                />
              </div>
            </div>

            {/* Settings */}
            <div className="settings-box">
              <div className="settings-box-title">Settings</div>
              <div className="settings-item" onClick={() => navigate('/changepass')}>Change Password</div>
              <div className="settings-item" style={{ borderBottom: notificationOpen ? '1px solid #F0F0F0' : 'none', paddingBottom: notificationOpen ? '18px' : 0 }} onClick={() => setNotificationOpen(!notificationOpen)}>
                Notification Settings
              </div>
              {notificationOpen && (
                <div className="notif-expanded">
                  <div className="notif-row">
                    <span>Notification sounds</span>
                    <div
                      onClick={() => setNotificationSounds(!notificationSounds)}
                      style={{ width: 48, height: 26, borderRadius: 13, background: notificationSounds ? '#F54E25' : '#D0D5DD', position: 'relative', cursor: 'pointer', transition: 'background 0.25s', flexShrink: 0 }}
                    >
                      <div style={{ position: 'absolute', top: 3, left: notificationSounds ? 25 : 3, width: 20, height: 20, borderRadius: '50%', background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: 'left 0.25s' }} />
                    </div>
                  </div>
                  <div className="notif-row" onClick={() => setShowMuteDropdown(!showMuteDropdown)}>
                    <span>Mute Notifications</span>
                    <div className="notif-row-right">
                      <span>{muteOption}</span>
                      <ChevronRight size={16} />
                      {showMuteDropdown && (
                        <div className="mute-dropdown" onClick={e => e.stopPropagation()}>
                          {['1 Hour', '5 Hours', '12 Hours', '1 Day', 'Until I change it'].map(opt => (
                            <div
                              key={opt}
                              className={`mute-option${muteOption === opt ? ' selected' : ''}`}
                              onClick={() => { setMuteOption(opt); setShowMuteDropdown(false); }}
                            >
                              {opt}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Preferences */}
            <div className="preferences-box">
              <div className="preferences-box-title">Preferences</div>
              <div className="pref-row">
                <span className="pref-label">Translate to Tagalog</span>
                <div className="toggle-track" onClick={() => setDarkMode(!darkMode)}>
                  <div className="toggle-thumb" />
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* MOBILE BOTTOM NAV — exact copy from home.jsx */}
        <div className="mobile-only mobile-bottom-nav">
          <Home size={24} color="#A3AED0" onClick={() => navigate('/home')} />
          <TrendingUp size={24} color="#A3AED0" onClick={() => navigate('/progress')} />
          <BarChart3 size={24} color="#A3AED0" onClick={() => navigate('/reports')} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }} onClick={() => navigate('/profile')}>
            <User size={24} color="#F54E25" />
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#F54E25' }}>Profile</span>
          </div>
        </div>

      </div>
      <FloatingChatHead />
    </div>
  );
};

export default Profile;