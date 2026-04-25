import React, { useState, useRef } from 'react';
import { FileText, LayoutGrid, User, LogOut, Pencil, X, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import logo from '@/assets/kalingalogo.png';

const NurseProfile = () => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationSounds, setNotificationSounds] = useState(false);
  const [muteOption, setMuteOption] = useState('Until I change it');
  const [showMuteDropdown, setShowMuteDropdown] = useState(false);
  const fileInputRef = useRef(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setProfileImage(url);
    }
  };

  return (
    <div className="app-container">
      <style>{`
        .app-container {
          display: flex;
          width: 100vw;
          height: 100vh;
          background: #F8F9FD;
          font-family: 'Inter', -apple-system, sans-serif;
          overflow: hidden;
          touch-action: manipulation;
        }

        /* SIDEBAR — same animation/structure as weeklyreport.jsx */
        .desktop-sidebar {
          width: ${isExpanded ? '280px' : '110px'};
          background: white;
          border-right: 1px solid #F1F1F1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 25px 0;
          z-index: 100;
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          flex-shrink: 0;
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
          box-sizing: border-box;
        }

        .sidebar-label {
          display: ${isExpanded ? 'block' : 'none'};
          font-weight: 700;
          font-size: 18px;
          color: #707EAE;
          white-space: nowrap;
        }

        /* MAIN */
        .main-view {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .top-nav {
          height: 100px;
          background: white;
          display: flex;
          align-items: center;
          padding: 0 40px;
          border-bottom: 1px solid #F1F1F1;
        }

        .scroll-content {
          flex: 1;
          padding: 30px 40px;
          overflow-y: auto;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* PROFILE CARD */
        .profile-card {
          background: white;
          border-radius: 20px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.07);
          padding: 50px 50px 50px 50px;
          width: 100%;
          max-width: 700px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .avatar-wrapper {
          position: relative;
          margin-bottom: 16px;
        }

        .avatar-circle {
          width: 130px;
          height: 130px;
          border-radius: 50%;
          background: #F54E25;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          cursor: pointer;
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
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        }

        .profile-name {
          font-size: 22px;
          font-weight: 700;
          color: #1B2559;
          margin-bottom: 32px;
        }

        /* SETTINGS BOX */
        .settings-box {
          width: 100%;
          border: 1px solid #E8E8E8;
          border-radius: 14px;
          padding: 28px 32px;
          margin-bottom: 16px;
        }

        .settings-box-title {
          font-size: 17px;
          font-weight: 700;
          color: #1B2559;
          margin-bottom: 8px;
        }

        .settings-item {
          font-size: 15px;
          color: #1B2559;
          font-weight: 400;
          padding: 18px 0;
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
          border: 1px solid #E8E8E8;
          border-radius: 14px;
          padding: 28px 32px;
          margin-bottom: 16px;
        }

        .preferences-box-title {
          font-size: 17px;
          font-weight: 700;
          color: #1B2559;
          margin-bottom: 20px;
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

        /* LOGOUT ROW */
        .logout-row {
          width: 100%;
          border: 1px solid #E8E8E8;
          border-radius: 14px;
          padding: 24px 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
        }

        .logout-label {
          font-size: 16px;
          font-weight: 700;
          color: #F54E25;
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
          .mobile-top-bar {
            position: sticky;
            top: 0;
            z-index: 300;
            width: 90vw;
            padding: 0 20px;
            height: 64px;
            background: white;
            border-bottom: 1px solid #F1F1F1;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          }

          .mobile-top-bar-title {
            font-size: 16px;
            font-weight: 800;
            color: #F54E25;
          }
          .scroll-content { padding: 15px !important; padding-bottom: 100px !important; align-items: flex-start !important; overflow-y: auto; }
          .profile-card { max-width: 100%; padding: 28px 20px 24px 20px; }
          .mobile-bottom-nav {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 72px;
            background: white;
            border-top: 1px solid #F1F1F1;
            display: flex;
            justify-content: space-around;
            align-items: center;
            z-index: 1000;
            padding-bottom: env(safe-area-inset-bottom);
            box-shadow: 0 -4px 20px rgba(0,0,0,0.06);
          }
          .mob-nav-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            font-size: 10px;
            font-weight: 700;
            color: #A3AED0;
            cursor: pointer;
          }
          .mob-nav-item.active { color: #F54E25; }
        }
      `}</style>

      {/* SIDEBAR — weeklyreport.jsx style with Profile active */}
      <aside className="desktop-sidebar" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="sidebar-logo-container">
          <img src={logo} alt="Kalinga" className="sidebar-logo" />
        </div>

        <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/nurse-dashboard'); }}>
          <div style={{ background: '#F4F7FE', padding: 12, borderRadius: 12, display: 'flex' }}>
            <FileText size={22} color="#707EAE" />
          </div>
          <span className="sidebar-label">Report</span>
        </div>

        <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/patient-database'); }}>
          <div style={{ background: '#F4F7FE', padding: 12, borderRadius: 12, display: 'flex' }}>
            <LayoutGrid size={22} color="#707EAE" />
          </div>
          <span className="sidebar-label">Dashboard</span>
        </div>

        <div style={{ marginTop: 'auto', width: '100%', paddingBottom: '20px' }}>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/nurseprofile'); }}>
            <User size={22} color="#F54E25" />
            <span className="sidebar-label" style={{ color: '#F54E25' }}>Profile</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/login'); }}>
            <LogOut size={22} color="#F54E25" style={{ cursor: 'pointer' }} />
            <span className="sidebar-label" style={{ color: '#F54E25' }}>Logout</span>
          </div>
        </div>
      </aside>

      <div className="main-view">

        {/* DESKTOP TOP NAV */}
        <header className="top-nav">
          <div style={{ display: 'flex', gap: 45 }}>
            <span style={{ color: '#F54E25', fontWeight: 800, fontSize: 23 }}>Profile</span>
            <span style={{ color: '#1B2559', fontWeight: 600, fontSize: 20 }}>Welcome back</span>
          </div>
          <div style={{ marginLeft: 'auto', width: 38, height: 38, background: '#F54E25', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>JD</div>
        </header>

        {/* MOBILE TOP BAR */}
        <div className="mobile-only mobile-top-bar">
          <img src={logo} alt="Kalinga" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
          <span className="mobile-top-bar-title">Profile</span>
          <div style={{ width: 36, height: 36, background: '#F54E25', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px' }}>JD</div>
        </div>

        <div className="scroll-content">
          <div className="profile-card">

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
            <div className="profile-name">Jane Doe</div>

            {/* Settings */}
            <div className="settings-box">
              <div className="settings-box-title">Settings</div>
              <div className="settings-item" onClick={() => navigate('/nursechangepass')}>Change Password</div>
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
                <span className="pref-label">Dark Mode</span>
                <div className="toggle-track" onClick={() => setDarkMode(!darkMode)}>
                  <div className="toggle-thumb" />
                </div>
              </div>
            </div>

            {/* Logout */}
            <div className="logout-row" onClick={() => navigate('/login')}>
              <span className="logout-label">Logout</span>
              <LogOut size={20} color="#F54E25" />
            </div>

          </div>
        </div>

        {/* MOBILE BOTTOM NAV — mirrors desktop sidebar */}
        <div className="mobile-only mobile-bottom-nav">
          <div className="mob-nav-item" onClick={() => navigate('/nurse-dashboard')}>
            <div style={{ background: '#F4F7FE', padding: 10, borderRadius: 10, display: 'flex' }}>
              <FileText size={20} color="#707EAE" />
            </div>
            <span>Report</span>
          </div>
          <div className="mob-nav-item" onClick={() => navigate('/patient-database')}>
            <div style={{ background: '#F4F7FE', padding: 10, borderRadius: 10, display: 'flex' }}>
              <LayoutGrid size={20} color="#707EAE" />
            </div>
            <span>Dashboard</span>
          </div>
          <div className="mob-nav-item active" onClick={() => navigate('/nurseprofile')}>
            <User size={22} color="#F54E25" />
            <span>Profile</span>
          </div>
          <div className="mob-nav-item" onClick={() => navigate('/login')}>
            <LogOut size={22} color="#F54E25" />
            <span style={{ color: '#F54E25' }}>Logout</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default NurseProfile;