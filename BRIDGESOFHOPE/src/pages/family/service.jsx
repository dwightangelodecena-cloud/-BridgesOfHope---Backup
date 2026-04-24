import React, { useState, useEffect, useRef } from 'react';
import { Home, User, LogOut, X, Landmark, Users, ChevronDown, ChevronUp, DollarSign, Bell, CheckCircle2, ClipboardList } from 'lucide-react';
import { Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAsyncData } from '@/hooks/useAsyncData';
import { familyDataService } from '@/services/familyDataService';
import { FAMILY_COLORS, StatusBadge, AuditLine, LoadingState } from '@/components/family/shared/ui';

// Asset import for the logo
import logo from '@/assets/logo2.png';

const Service = () => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false); // State for monthly fees expansion
  const [isAdmissionExpanded, setIsAdmissionExpanded] = useState(false); // New state for admission card expansion
  const [displayName, setDisplayName] = useState('Family User');
  const [userInitials, setUserInitials] = useState('FU');
  const notificationsDesktopRef = useRef(null);
  const notificationsMobileRef = useRef(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationItems = [
    'Submit missing laboratory result before Friday.',
    'Family support session is scheduled on April 5, 10:00 AM.',
    'Weekly report reviewed by your assigned counselor.',
  ];
  const { data: billingSnapshot, loading: billingLoading } = useAsyncData(async () => familyDataService.getBillingSnapshot(), []);

  useEffect(() => {
    let isMounted = true;
    const deriveInitials = (name) =>
      name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || '')
        .join('') || 'FU';
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      let resolvedName =
        user?.user_metadata?.full_name ||
        [user?.user_metadata?.first_name, user?.user_metadata?.last_name].filter(Boolean).join(' ') ||
        'Family User';
      if (user?.id) {
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle();
        if (profileRow?.full_name) resolvedName = profileRow.full_name;
      }
      if (isMounted) {
        setDisplayName(resolvedName);
        setUserInitials(deriveInitials(resolvedName));
      }
    };
    loadUser();
    return () => { isMounted = false; };
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

  return (
    <div className="service-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        .service-container {
          display: flex;
          width: 100vw;
          height: 100vh;
          background: ${FAMILY_COLORS.background};
          font-family: 'Plus Jakarta Sans', sans-serif;
          overflow: hidden;
        }

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
          box-sizing: border-box;
          cursor: pointer;
          border: 2px solid transparent;
          border-radius: 12px;
        }

        .sidebar-nav-item.sidebar-nav-active {
          border-color: #F54E25;
        }

        .sidebar-icon-wrap {
          padding: 12px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .sidebar-label {
          display: ${isExpanded ? 'block' : 'none'};
          font-weight: 700;
          font-size: 18px;
          color: #707EAE;
          white-space: nowrap;
        }
        .sidebar-primary { width: 100%; }
        .sidebar-footer {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 20px;
          width: 100%;
        }

        /* Main View Styling */
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

        .top-nav-left {
          display: flex;
          align-items: center;
          gap: 40px;
          flex-wrap: wrap;
          min-width: 0;
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

        .view-title {
          color: #F54E25;
          font-weight: 700;
          font-size: 20px;
        }

        .welcome-text {
          color: #1B2559;
          font-weight: 500;
          font-size: 16px;
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
        }

        .content-area {
          flex: 1;
          padding: 40px;
          overflow-y: auto;
        }

        /* Header Section */
        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 40px;
        }

        .header-main {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .header-icon-box {
          width: 80px;
          height: 80px;
          background: #F54E25;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 10px 20px rgba(245, 78, 37, 0.2);
        }

        .header-text h2 {
          color: #1B2559;
          font-size: 24px;
          font-weight: 800;
          margin: 0;
        }

        .header-text p {
          color: #A3AED0;
          font-size: 15px;
          margin: 4px 0 0 0;
          font-weight: 500;
        }

        .action-buttons {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .btn-admit {
          background: #F54E25;
          color: white;
          border: none;
          padding: 14px 28px;
          border-radius: 14px;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .btn-admit:hover { transform: translateY(-2px); }

        .btn-close {
          color: #1B2559;
          cursor: pointer;
        }

        /* Pricing Grid */
        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 30px;
          align-items: start;
        }

        .admission-fee-card {
          background: linear-gradient(135deg, #F95C4B 0%, #D94F42 100%);
          border-radius: 24px;
          padding: 40px;
          color: white;
          position: relative;
          box-shadow: 0 20px 40px rgba(245, 78, 37, 0.15);
          cursor: pointer;
        }

        .card-tag {
          position: absolute;
          top: 35px;
          right: 35px;
          font-size: 11px;
          font-weight: 600;
          opacity: 0.9;
        }

        .fee-label {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 2px;
        }

        .fee-amount {
          font-size: 56px;
          font-weight: 800;
          margin-bottom: 30px;
          letter-spacing: -1px;
        }

        .fee-details-list {
          list-style: none;
        }

        .fee-details-list li {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          font-size: 18px;
          margin-bottom: 25px;
          font-weight: 600;
          line-height: 1.3;
        }

        .fee-details-list li::before {
          content: "•";
          font-size: 24px;
        }

        /* Monthly Fees Side */
        .monthly-fees-container {
          display: flex;
          flex-direction: column;
        }

        .section-sub-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }

        .section-sub-header h3 {
          color: #1B2559;
          font-size: 20px;
          font-weight: 800;
        }

        .payable-badge {
          background: #E9EDF7;
          color: #A3AED0;
          font-size: 11px;
          padding: 6px 12px;
          border-radius: 20px;
          font-weight: 700;
        }

        .branch-card-list {
          background: white;
          border-radius: 20px;
          border: 1px solid #E9EDF7;
          margin-bottom: 20px;
          overflow: hidden;
        }

        .branch-item {
          padding: 25px 30px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .branch-info {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .branch-name {
          color: #1B2559;
          font-weight: 800;
          font-size: 17px;
          display: block;
        }

        .branch-type {
          color: #A3AED0;
          font-size: 12px;
          font-weight: 600;
        }

        .branch-price {
          color: #05CD99;
          font-weight: 800;
          font-size: 22px;
        }

        .expand-trigger {
          border-top: 1px solid #F1F1F1;
          padding: 12px;
          display: flex;
          justify-content: center;
          color: #A3AED0;
          cursor: pointer;
        }

        .expanded-details {
          padding: 0 30px 30px 30px;
          border-top: 1px solid #F1F1F1;
          background: #fff;
        }

        .admission-expanded-details {
          margin-top: 30px;
          padding-top: 30px;
          border-top: 1px solid rgba(255, 255, 255, 0.3);
        }

        .admission-expanded-details h4 {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 15px;
        }

        .admission-expanded-details ul {
          list-style: none;
          padding-left: 15px;
        }

        .admission-expanded-details li {
          font-size: 15px;
          font-weight: 600;
          margin-bottom: 10px;
          position: relative;
        }

        .admission-expanded-details li::before {
          content: "•";
          position: absolute;
          left: -15px;
        }

        .detail-group {
          margin-top: 25px;
        }

        .detail-group h4 {
          color: #1B2559;
          font-size: 16px;
          font-weight: 800;
          margin-bottom: 12px;
        }

        .detail-group ul {
          list-style: none;
          padding-left: 15px;
        }

        .detail-group li {
          color: #707EAE;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 8px;
          position: relative;
        }

        .detail-group li::before {
          content: "•";
          position: absolute;
          left: -15px;
          color: #A3AED0;
        }

        .detail-note {
          font-size: 11px;
          color: #A3AED0;
          font-weight: 500;
          margin-top: 4px;
          display: block;
        }

        .pwd-alert {
          background: #EBF3FF;
          border-radius: 12px;
          padding: 15px 25px;
          display: flex;
          align-items: center;
          gap: 12px;
          color: #4318FF;
          font-size: 14px;
          font-weight: 700;
        }

        .interactive-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 10px;
          color: #334155;
          font-size: 13px;
        }

        .panel-title {
          color: #1B2559;
          font-weight: 800;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .mobile-only { display: none; }

        /* MOBILE OVERRIDES */
        @media (max-width: 768px) {
          .desktop-sidebar, .top-nav, .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; }
          .service-container { flex-direction: column; height: 100vh; overflow: hidden; }
          .mobile-top-bar { padding: 0 20px; height: 60px; background: white; border-bottom: 1px solid #F1F1F1; align-items: center; justify-content: space-between; }
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
          .content-area { padding: 20px 15px; }
          .pricing-grid { grid-template-columns: 1fr; gap: 20px; }

          .page-header {
            flex-direction: column;
            align-items: center;
            text-align: center;
            position: relative;
          }

          .header-main { flex-direction: column; gap: 10px; }

          .action-buttons .btn-close {
            position: absolute;
            top: 0;
            right: 0;
          }

          .action-buttons .btn-admit { display: none; }
          .mobile-admit-wrapper { display: block !important; margin-top: 20px; }
          .mobile-admit-wrapper .btn-admit { display: block !important; width: 100%; padding: 16px; font-size: 16px; }

          .admission-fee-card { padding: 30px 20px; }
          .fee-amount { font-size: 42px; margin-bottom: 20px; }
          .fee-label { font-size: 22px; }
          .fee-details-list li { font-size: 15px; margin-bottom: 15px; }
          .branch-item { padding: 20px; }
          .branch-price { font-size: 18px; }
          .branch-name { font-size: 15px; }
        }

        .mobile-admit-wrapper { display: none; }
      `}</style>

      {/* Sidebar */}
      <aside className="desktop-sidebar" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="sidebar-logo-container">
          <img src={logo} alt="BH" className="sidebar-logo" />
        </div>
        <div className="sidebar-primary">
        <div className="sidebar-nav-item sidebar-nav-active" onClick={(e) => { e.stopPropagation(); navigate('/home'); }}>
          <div className="sidebar-icon-wrap">
            <Home size={22} color="#707EAE" />
          </div>
          <span className="sidebar-label">Dashboard</span>
        </div>

        <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/progress'); }}>
          <div className="sidebar-icon-wrap">
            <ClipboardList size={22} color="#707EAE" />
          </div>
          <span className="sidebar-label">Request Management</span>
        </div>

        <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/appointments'); }}>
          <div className="sidebar-icon-wrap">
            <Calendar size={22} color="#707EAE" />
          </div>
          <span className="sidebar-label">Appointments</span>
        </div>
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/profile'); }}><User size={22} color="#707EAE" /><span className="sidebar-label">Profile</span></div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/login'); }}>
            <LogOut size={22} color="#F54E25" /><span className="sidebar-label" style={{ color: '#F54E25' }}>Logout</span>
          </div>
        </div>
      </aside>

      <div className="main-view">
        <header className="top-nav">
          <div className="top-nav-left">
            <span className="view-title">Services</span>
            <span className="welcome-text">Welcome back, {displayName}</span>
          </div>
          <div className="top-nav-actions">
            <div ref={notificationsDesktopRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className="notifications-trigger"
                aria-expanded={showNotifications}
                aria-label="Notifications"
                onClick={() => setShowNotifications((v) => !v)}
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
            <button
              type="button"
              className="user-avatar-top"
              onClick={() => navigate('/profile')}
              aria-label="Open profile"
              style={{ border: 'none', cursor: 'pointer' }}
            >
              {userInitials}
            </button>
          </div>
        </header>

        <div className="mobile-only mobile-top-bar">
          <img src={logo} alt="BH" style={{ width: 50 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div ref={notificationsMobileRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className="notifications-trigger mobile-notifications-trigger"
                aria-expanded={showNotifications}
                aria-label="Notifications"
                onClick={() => setShowNotifications((v) => !v)}
              >
                <Bell size={18} stroke="#ffffff" strokeWidth={2.25} aria-hidden />
              </button>
              {showNotifications && (
                <div className="notifications-dropdown mobile-notifications-dropdown">
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
            <button
              type="button"
              onClick={() => navigate('/profile')}
              aria-label="Open profile"
              style={{ width: 34, height: 34, background: '#F54E25', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px', border: 'none', cursor: 'pointer' }}
            >
              {userInitials}
            </button>
          </div>
        </div>

        <div className="content-area">
          <div style={{ background: '#fff', border: `1px solid ${FAMILY_COLORS.surface}`, borderRadius: 16, padding: 14, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong style={{ color: FAMILY_COLORS.text }}>Billing Snapshot</strong>
              <StatusBadge label={billingSnapshot?.status || 'Pending'} tone="warning" />
            </div>
            {billingLoading ? <LoadingState label="Loading billing snapshot..." /> : null}
            {!billingLoading && billingSnapshot ? (
              <>
                <div style={{ display: 'flex', gap: 18, color: '#4A443A', fontSize: 13, fontWeight: 600 }}>
                  <span>Outstanding: PHP {billingSnapshot.outstanding?.toLocaleString?.() || billingSnapshot.outstanding}</span>
                  <span>Next due: {billingSnapshot.nextDue}</span>
                </div>
                <AuditLine text="Front-end preview for family billing transparency." />
              </>
            ) : null}
          </div>
          <div className="page-header">
            <div className="header-main">
              <div className="header-icon-box"><DollarSign size={42} strokeWidth={2.5} /></div>
              <div className="header-text">
                <h2>Fees & Inclusions</h2>
                <p>Transparent pricing for your peace of mind</p>
              </div>
            </div>
            <div className="action-buttons">
              <button className="btn-admit" onClick={() => navigate('/progress', { state: { tab: 'admission' } })}>Admit a patient</button>
              <X className="btn-close" size={32} onClick={() => navigate('/home')} />
            </div>
          </div>

          <div className="pricing-grid">
            <div className="admission-fee-card" onClick={() => setIsAdmissionExpanded(!isAdmissionExpanded)}>
              <span className="card-tag">Tap to see Inclusions</span>
              <div className="fee-label">Admission Fee</div>
              <div className="fee-amount">₱30,000</div>
              <ul className="fee-details-list">
                <li>One-time payment upon admission</li>
                <li>PWD-discounted rate</li>
                <li>The Initial Fee is paid at admission, and the <br /> Monthly Fee applies starting the NEXT MONTH.</li>
              </ul>
              {isAdmissionExpanded && (
                <div className="admission-expanded-details">
                  <h4>Includes:</h4>
                  <ul>
                    <li>Physical & Laboratory Tests</li>
                    <li>Psychiatric Evaluation</li>
                    <li>2 Psychological Evaluations (Admission & Reintegration)</li>
                    <li>Drug Test</li>
                    <li>Alcohol Test</li>
                    <li>Pregnancy Test (for female patients)</li>
                  </ul>
                </div>
              )}
            </div>

            <div className="monthly-fees-container">
              <div className="section-sub-header">
                <h3>Monthly Fees</h3>
                <span className="payable-badge">Payable within 30 days</span>
              </div>

              <div className="branch-card-list">
                <div className="branch-item">
                  <div className="branch-info">
                    <Landmark size={24} color="#707EAE" />
                    <div><span className="branch-name">Imus Branch</span><span className="branch-type">City Rate</span></div>
                  </div>
                  <div className="branch-price">₱35,000</div>
                </div>

                {isExpanded && (
                  <div className="expanded-details">
                    <div className="detail-group">
                      <h4>Accommodation & Meals</h4>
                      <ul>
                        <li>Air-conditioned rooms</li>
                        <li>Daily meals: Breakfast, Lunch, PM Snack, Dinner</li>
                      </ul>
                    </div>
                    <div className="detail-group">
                      <h4>Health & Wellness</h4>
                      <ul>
                        <li>Personalized Health & Diet Plan</li>
                        <li>Psychoeducation Sessions</li>
                        <li>Relapse Prevention Seminar</li>
                        <li>Psychiatric & Psychological Evaluations</li>
                        <li>Individual Psychotherapy</li>
                        <li>Regular Doctor Monitoring</li>
                      </ul>
                      <span className="detail-note">Note: Follow-up psychiatric consultations not included</span>
                    </div>
                    <div className="detail-group">
                      <h4>Support & Safety</h4>
                      <ul>
                        <li>24/7 Medical Team</li>
                        <li>24/7 Security</li>
                        <li>Individual & Group Counseling</li>
                      </ul>
                    </div>
                    <div className="detail-group">
                      <h4>Therapeutic & Holistic Care</h4>
                      <ul>
                        <li>Resident & Family Healing Dialogues</li>
                        <li>Spiritual Activities</li>
                        <li>Aftercare Program</li>
                      </ul>
                    </div>
                    <div className="detail-group">
                      <h4>Additional Services</h4>
                      <ul>
                        <li>Laundry & Haircut (Included)</li>
                        <li>Medications & Personal Toiletries – To be provided by family</li>
                      </ul>
                    </div>
                  </div>
                )}
                <div className="expand-trigger" onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}>
                  {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                </div>
              </div>

              <div className="pwd-alert">
                <Users size={22} />
                <span>PWD-discounted rates available for eligible patients</span>
              </div>

              <div className="mobile-admit-wrapper">
                <button className="btn-admit" onClick={() => navigate('/progress', { state: { tab: 'admission' } })}>Admit a patient</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Service;