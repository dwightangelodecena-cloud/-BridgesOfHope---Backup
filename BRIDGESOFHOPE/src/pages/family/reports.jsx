import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Home, User, LogOut, Calendar, ClipboardList, BarChart3, FileText, ChevronLeft, Bell, CheckCircle2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import logo from '@/assets/logo2.png';
import { supabase } from '@/lib/supabase';
import { FAMILY_COLORS } from '@/components/family/shared/ui';

export default function FamilyReportsPage() {
  const navigate = useNavigate();
  const { patientId } = useParams();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState('Week 1');
  const [userInitials, setUserInitials] = useState('FU');
  const notificationsDesktopRef = useRef(null);
  const notificationsMobileRef = useRef(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationItems = [
    'Submit missing laboratory result before Friday.',
    'Family support session is scheduled on April 5, 10:00 AM.',
    'Weekly report reviewed by your assigned counselor.',
    'Community Update: Join the monthly Family Wellness Talk on April 9 to learn practical family recovery support strategies.',
  ];

  const samplePatients = useMemo(
    () => [
      {
        id: 'p-1',
        name: 'Maria Santos',
        age: 29,
        admissionDate: '2026-03-02',
        reports: {
          'Week 1': { summary: 'Stable week. Better sleep pattern and appetite.', progress: '65%', notes: 'No relapse signs observed.' },
          'Week 2': { summary: 'Participated in all counseling sessions.', progress: '72%', notes: 'Shows improved social interaction.' },
          'Week 3': { summary: 'Continued recovery trend with good compliance.', progress: '78%', notes: 'Responding well to structured routine.' },
          'Week 4': { summary: 'Maintained positive behavior and engagement.', progress: '83%', notes: 'Family call positively impacted motivation.' },
        },
      },
      {
        id: 'p-2',
        name: 'Elena Cruz',
        age: 35,
        admissionDate: '2026-03-09',
        reports: {
          'Week 1': { summary: 'Mild withdrawal symptoms managed successfully.', progress: '58%', notes: 'Needs close monitoring during evenings.' },
          'Week 2': { summary: 'Symptoms reduced; started active participation.', progress: '66%', notes: 'Improved emotional regulation.' },
          'Week 3': { summary: 'Attended all therapeutic activities this week.', progress: '73%', notes: 'Steady progress with treatment plan.' },
          'Week 4': { summary: 'Consistent improvement in daily routines.', progress: '79%', notes: 'More openness during individual sessions.' },
        },
      },
      {
        id: 'p-3',
        name: 'Sofia Reyes',
        age: 24,
        admissionDate: '2026-03-15',
        reports: {
          'Week 1': { summary: 'Initial adjustment week; cooperative behavior.', progress: '61%', notes: 'Requires encouragement in group sessions.' },
          'Week 2': { summary: 'Better adaptation to program schedule.', progress: '69%', notes: 'Shows stronger coping responses.' },
          'Week 3': { summary: 'Improved confidence and activity attendance.', progress: '75%', notes: 'Maintains good compliance with care plan.' },
          'Week 4': { summary: 'Positive behavioral consistency observed.', progress: '82%', notes: 'Family support remains a strong factor.' },
        },
      },
    ],
    []
  );

  const patient = patientId ? samplePatients.find((p) => p.id === patientId) : null;

  useEffect(() => {
    if (patientId && !samplePatients.some((p) => p.id === patientId)) {
      navigate('/reports', { replace: true });
    }
  }, [patientId, navigate, samplePatients]);

  useEffect(() => {
    if (patientId) setSelectedWeek('Week 1');
  }, [patientId]);

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
      const fallbackProfile = localStorage.getItem('bh_family_profile');
      const fallbackName = fallbackProfile ? JSON.parse(fallbackProfile).fullName : null;
      let resolvedName =
        user?.user_metadata?.full_name ||
        [user?.user_metadata?.first_name, user?.user_metadata?.last_name].filter(Boolean).join(' ') ||
        fallbackName ||
        'Family User';
      if (user?.id) {
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle();
        if (profileRow?.full_name) resolvedName = profileRow.full_name;
      }
      if (isMounted) setUserInitials(deriveInitials(resolvedName));
    };
    loadUser();
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

  const weeklyReport = patient ? patient.reports[selectedWeek] : null;

  return (
    <div className="app-container">
      <style>{`
        .app-container { display: flex; width: 100vw; height: 100vh; background: #F8F9FD; font-family: 'Inter', -apple-system, sans-serif; overflow: hidden; touch-action: manipulation; }
        .desktop-sidebar { width: ${isExpanded ? '280px' : '110px'}; background: #fff; border-right: 1px solid #F1F1F1; display: flex; flex-direction: column; align-items: center; padding: 25px 0 170px; position: relative; z-index: 100; transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; }
        .sidebar-logo-container { display: flex; justify-content: center; width: 100%; margin-bottom: 40px; }
        .sidebar-logo { width: ${isExpanded ? '120px' : '70px'}; transition: width .3s; }
        .sidebar-primary { width: 100%; }
        .sidebar-nav-item { display: flex; align-items: center; width: 100%; padding: 0 ${isExpanded ? '35px' : '0'}; justify-content: ${isExpanded ? 'flex-start' : 'center'}; gap: 20px; margin-bottom: 25px; min-height: 52px; border: 2px solid transparent; border-radius: 12px; box-sizing: border-box; }
        .sidebar-nav-item.sidebar-nav-active { border-color: #F54E25; }
        .sidebar-label { display: ${isExpanded ? 'block' : 'none'}; font-weight: 700; font-size: 18px; line-height: 1.2; color: #707EAE; max-width: 140px; white-space: normal; overflow-wrap: anywhere; }
        .sidebar-icon-wrap { padding: 12px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .sidebar-footer { position: absolute; left: 0; right: 0; bottom: 20px; width: 100%; }
        .sidebar-footer .sidebar-nav-item { margin-bottom: 0; }
        .sidebar-footer .sidebar-nav-item + .sidebar-nav-item { margin-top: 14px; }
        .main-view { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .top-nav { height: 85px; background: #fff; display: flex; align-items: center; padding: 0 30px; border-bottom: 1px solid #F1F1F1; box-sizing: border-box; z-index: 300; }
        .top-nav-actions { margin-left: auto; display: flex; align-items: center; gap: 14px; flex-shrink: 0; }
        .notifications-dropdown { position: absolute; top: calc(100% + 10px); right: 0; width: min(360px, calc(100vw - 48px)); background: #fff; border: 1px solid #E9EDF7; border-radius: 14px; box-shadow: 0 12px 40px rgba(27, 37, 89, 0.12); padding: 16px; z-index: 400; }
        .notifications-trigger { width: 40px; height: 40px; min-width: 40px; min-height: 40px; padding: 0; box-sizing: border-box; flex-shrink: 0; border-radius: 50%; border: none; background: #F54E25; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #fff; box-shadow: 0 2px 10px rgba(245, 78, 37, 0.4); }
        .notifications-trigger:hover { background: #e0421a; box-shadow: 0 4px 14px rgba(245, 78, 37, 0.5); }
        .notifications-trigger:focus-visible { outline: 2px solid #1B2559; outline-offset: 2px; }
        .notifications-trigger svg { display: block; width: 21px; height: 21px; stroke: #fff; color: #fff; flex-shrink: 0; }
        .panel-title { color: #1B2559; font-weight: 800; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
        .interactive-row { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; color: #334155; font-size: 13px; }
        .user-avatar-top { width: 40px; height: 40px; min-width: 40px; min-height: 40px; background: #F54E25; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; box-sizing: border-box; border: none; cursor: pointer; }
        .scroll-content { flex: 1; overflow-y: auto; padding: 30px 40px; background: ${FAMILY_COLORS.background}; }
        .content-wrap { width: 100%; max-width: min(1560px, 100%); margin: 0 auto; }
        .panel-card { background: #fff; border: 1px solid #E9EDF7; border-radius: 14px; padding: 16px; }
        .reports-header { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 14px; }
        .reports-title { color: #1B2559; font-size: 18px; font-weight: 800; line-height: 1.2; }
        .reports-subtitle { color: #64748B; font-size: 13px; font-weight: 600; margin-top: 5px; }
        .week-select { border: 1px solid #E2E8F0; border-radius: 10px; padding: 9px 11px; font-size: 12px; font-weight: 600; color: #1B2559; background: #fff; min-width: 116px; }
        .reports-back { display: inline-flex; align-items: center; gap: 8px; border: none; background: transparent; color: #64748B; font-size: 13px; font-weight: 700; cursor: pointer; padding: 0 0 12px; margin: 0; font-family: inherit; }
        .reports-back:hover { color: #F54E25; }
        .report-detail-head { margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid #E9EDF7; }
        .report-detail-kicker { font-size: 11px; font-weight: 600; color: #c2410c; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 6px; }
        .report-detail-title { font-size: 1.125rem; font-weight: 700; color: #0f172a; line-height: 1.35; }
        .report-detail-title .accent { color: #F54E25; }
        .report-detail-meta { font-size: 13px; color: #64748b; margin-top: 8px; font-weight: 500; }
        .report-detail-body { display: grid; gap: 10px; margin-top: 16px; }
        .patient-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        .patient-btn { border: 1px solid #E9EDF7; border-radius: 14px; background: #fff; padding: 14px; text-align: left; cursor: pointer; transition: border-color .15s ease, box-shadow .15s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.02); }
        .patient-btn:hover { border-color: #f5d0c4; box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06); }
        .patient-name { font-size: 1rem; font-weight: 800; color: #1B2559; margin-bottom: 8px; }
        .patient-meta { font-size: 12px; color: #64748B; font-weight: 600; margin-bottom: 4px; }
        .report-row { background: #ffffff; border: 1px solid #e8eaef; border-radius: 10px; padding: 11px 12px 10px; }
        .report-label { font-size: 12px; color: #475569; font-weight: 700; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
        .report-value { color: #1B2559; font-size: 13px; font-weight: 600; line-height: 1.6; }
        .mobile-bottom-nav, .mobile-top-bar { display: none; }
        @media (max-width: 900px) {
          .patient-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 768px) {
          .desktop-sidebar, .top-nav { display: none !important; }
          .mobile-top-bar { display: flex !important; align-items: center; justify-content: space-between; padding: 0 20px; height: 60px; background: #fff; border-bottom: 1px solid #F1F1F1; }
          .mobile-notifications-trigger.notifications-trigger { width: 34px; height: 34px; min-width: 34px; min-height: 34px; padding: 0; }
          .mobile-notifications-trigger.notifications-trigger svg { width: 18px; height: 18px; }
          .mobile-notifications-dropdown { right: 0; left: auto; width: min(340px, calc(100vw - 40px)); }
          .scroll-content { padding: 15px !important; padding-bottom: 90px !important; }
          .reports-header { flex-direction: column; align-items: stretch; }
          .mobile-bottom-nav { position: fixed; left: 0; right: 0; bottom: 0; height: 70px; background: #fff; border-top: 1px solid #EEE; display: flex; justify-content: space-around; align-items: center; z-index: 1000; }
        }
      `}</style>

      <aside className="desktop-sidebar" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="sidebar-logo-container"><img src={logo} alt="BH" className="sidebar-logo" /></div>
        <div className="sidebar-primary">
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/home'); }}><div className="sidebar-icon-wrap"><Home size={22} color="#707EAE" /></div><span className="sidebar-label">Dashboard</span></div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/progress'); }}><div className="sidebar-icon-wrap"><ClipboardList size={22} color="#707EAE" /></div><span className="sidebar-label">Request Management</span></div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/appointments'); }}><div className="sidebar-icon-wrap"><Calendar size={22} color="#707EAE" /></div><span className="sidebar-label">Appointments</span></div>
          <div className="sidebar-nav-item sidebar-nav-active" onClick={(e) => e.stopPropagation()}><div className="sidebar-icon-wrap"><BarChart3 size={22} color="#707EAE" /></div><span className="sidebar-label">Reports</span></div>
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/profile'); }}><div className="sidebar-icon-wrap"><User size={22} color="#707EAE" /></div><span className="sidebar-label">Profile</span></div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/login'); }}><div className="sidebar-icon-wrap"><LogOut size={22} color="#F54E25" /></div><span className="sidebar-label" style={{ color: '#F54E25' }}>Logout</span></div>
        </div>
      </aside>

      <main className="main-view">
        <header className="top-nav">
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
            <button type="button" className="user-avatar-top" onClick={() => navigate('/profile')} aria-label="Open profile">
              {userInitials}
            </button>
          </div>
        </header>

        <div className="mobile-top-bar">
          <img src={logo} alt="BH" style={{ width: 48 }} />
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
                color: '#fff',
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
          </div>
        </div>

        <div className="scroll-content">
          <div className="content-wrap">
            {!patientId && (
              <div className="panel-card">
                <div className="reports-header">
                  <div>
                    <div className="reports-title">Patient Weekly Reports</div>
                    <div className="reports-subtitle">Select a patient to open their reports. You will choose the week on the next screen.</div>
                  </div>
                </div>

                <div className="patient-grid">
                  {samplePatients.map((p) => (
                    <button key={p.id} type="button" className="patient-btn" onClick={() => navigate(`/reports/${p.id}`)}>
                      <div className="patient-name">{p.name}</div>
                      <div className="patient-meta">Age: {p.age}</div>
                      <div className="patient-meta">Admitted: {p.admissionDate}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {patientId && patient && (
              <div className="panel-card">
                <button type="button" className="reports-back" onClick={() => navigate('/reports')}>
                  <ChevronLeft size={18} />
                  All patients
                </button>

                <div className="reports-header">
                  <div className="report-detail-head" style={{ marginBottom: 0, paddingBottom: 0, border: 'none' }}>
                    <div className="reports-title">{patient.name}</div>
                    <div className="reports-subtitle">Age {patient.age} · Admitted {patient.admissionDate}</div>
                  </div>
                  <select className="week-select" value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)} aria-label="Report week">
                    <option value="Week 1">Week 1</option>
                    <option value="Week 2">Week 2</option>
                    <option value="Week 3">Week 3</option>
                    <option value="Week 4">Week 4</option>
                  </select>
                </div>

                <div className="report-detail-body">
                  <div className="report-detail-head">
                    <div className="report-detail-kicker">Care updates</div>
                    <div className="report-detail-title">
                      <span className="accent">{selectedWeek}</span> report
                    </div>
                    <div className="report-detail-meta">Weekly patient report for this period.</div>
                  </div>
                  <div className="report-row">
                    <div className="report-label"><FileText size={14} />Summary</div>
                    <div className="report-value">{weeklyReport?.summary || 'No report available for this week.'}</div>
                  </div>
                  <div className="report-row">
                    <div className="report-label">Progress</div>
                    <div className="report-value">{weeklyReport?.progress || 'N/A'}</div>
                  </div>
                  <div className="report-row">
                    <div className="report-label">Nurse Notes</div>
                    <div className="report-value">{weeklyReport?.notes || 'No notes available.'}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <nav className="mobile-bottom-nav">
          <Home size={24} color="#A3AED0" onClick={() => navigate('/home')} />
          <ClipboardList size={24} color="#A3AED0" onClick={() => navigate('/progress')} />
          <Calendar size={24} color="#A3AED0" onClick={() => navigate('/appointments')} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }} onClick={() => navigate('/reports')}>
            <BarChart3 size={24} color="#F54E25" />
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#F54E25' }}>Reports</span>
          </div>
          <User size={24} color="#A3AED0" onClick={() => navigate('/profile')} />
        </nav>
      </main>
    </div>
  );
}
