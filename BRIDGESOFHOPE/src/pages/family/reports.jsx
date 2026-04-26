import React, { useEffect, useEffect, useMemo, useRef, useState } from 'react';
import { Home, User, LogOut, Calendar, ClipboardList, BarChart3, FileText, ChevronLeft, Bell, CheckCircle2, TrendingUp, Activity } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import logo from '@/assets/kalingalogo.png';
import { supabase } from '@/lib/supabase';
import { FAMILY_COLORS } from '@/components/family/shared/ui';

export default function FamilyReportsPage() {
  const navigate = useNavigate();
  const { patientId } = useParams();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState('all');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedReportId, setSelectedReportId] = useState('');
  const [patients, setPatients] = useState([]);
  const [weeklyReportsByPatient, setWeeklyReportsByPatient] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [firstName, setFirstName] = useState('Family');

  const formatDate = (iso) => {
    if (!iso) return 'N/A';
    try {
      return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return 'N/A';
    }
  };

  const calculateAge = (dob) => {
    if (!dob) return 'N/A';
    const birth = new Date(dob);
    if (Number.isNaN(birth.getTime())) return 'N/A';
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
    return age >= 0 ? age : 'N/A';
  };

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setLoading(true);
      setLoadError('');
      try {
        if (!isSupabaseConfigured()) {
          if (!cancelled) {
            setPatients([]);
            setWeeklyReportsByPatient({});
            setLoadError('Supabase is not configured.');
          }
          return;
        }
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData?.user) {
          if (!cancelled) {
            setPatients([]);
            setWeeklyReportsByPatient({});
            setLoadError('Please sign in to view reports.');
          }
          return;
        }
        const user = authData.user;
        const displayName = user.user_metadata?.full_name || user.email || 'Family User';
        const nextFirstName = String(displayName).trim().split(/\s+/)[0] || 'Family';
        if (!cancelled) setFirstName(nextFirstName);

        const { data: patientRows, error: patientErr } = await supabase
          .from('patients')
          .select('id, full_name, admitted_at, progress_percent, clinical_status, family_id, discharged_at, date_of_birth')
          .eq('family_id', user.id)
          .is('discharged_at', null)
          .order('admitted_at', { ascending: false });

        if (patientErr) throw patientErr;
        let rows = patientRows || [];

        if (!rows.length) {
          const { data: admissionRows } = await supabase
            .from('admission_requests')
            .select('id, patient_name, patient_birth_date, reason_for_admission, status, created_at, decided_at')
            .eq('family_id', user.id)
            .eq('status', 'approved')
            .order('decided_at', { ascending: false });

          rows = (admissionRows || []).map((r) => ({
            id: r.id,
            full_name: r.patient_name,
            admitted_at: r.decided_at || r.created_at,
            progress_percent: 0,
            clinical_status: 'Recovering',
            family_id: user.id,
            discharged_at: null,
            date_of_birth: r.patient_birth_date,
            primary_concern: r.reason_for_admission,
          }));
        }

        const mappedPatients = rows.map((row) => {
          const mapped = uiPatientFromRow(row);
          return {
            id: mapped?.id || row.id,
            name: mapped?.name || row.full_name || 'Patient',
            date: mapped?.date || formatDate(row.admitted_at),
            progress: mapped?.progress ?? 0,
            age: calculateAge(row.date_of_birth),
          };
        });

        const ids = rows.map((r) => r.id).filter(Boolean);
        const byPatient = {};
        if (ids.length) {
          const { data: reportRows, error: reportErr } = await supabase
            .from('weekly_reports')
            .select('*')
            .in('patient_id', ids)
            .order('week_number', { ascending: true });

          if (!reportErr && reportRows) {
            for (const row of reportRows) {
              const key = String(row.patient_id);
              if (!byPatient[key]) byPatient[key] = [];
              byPatient[key].push(row);
            }
          }
        }

        if (!cancelled) {
          setPatients(mappedPatients);
          setWeeklyReportsByPatient(byPatient);
          setSelectedPatient((prev) => {
            if (!prev) return null;
            const next = mappedPatients.find((p) => String(p.id) === String(prev.id));
            return next || null;
          });
        }
      } catch (e) {
        if (!cancelled) {
          setPatients([]);
          setWeeklyReportsByPatient({});
          setLoadError(e?.message || 'Unable to load reports right now.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    window.addEventListener('storage', loadData);
    window.addEventListener(APP_DATA_REFRESH, loadData);
    return () => {
      cancelled = true;
      window.removeEventListener('storage', loadData);
      window.removeEventListener(APP_DATA_REFRESH, loadData);
    };
  }, []);

  const allReports = useMemo(
    () => Object.values(weeklyReportsByPatient || {}).flat().filter(Boolean),
    [weeklyReportsByPatient]
  );
  const availableWeeks = useMemo(() => {
    const set = new Set();
    for (const row of allReports) {
      if (row.week_number !== null && row.week_number !== undefined && row.week_number !== '') {
        set.add(Number(row.week_number));
      }
    }
    return Array.from(set).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b);
  }, [allReports]);
  const selectedPatientReports = useMemo(() => {
    if (!selectedPatient) return [];
    const rows = weeklyReportsByPatient[String(selectedPatient.id)] || [];
    return [...rows].sort((a, b) => {
      const aw = Number(a.week_number) || 0;
      const bw = Number(b.week_number) || 0;
      if (aw !== bw) return bw - aw;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [selectedPatient, weeklyReportsByPatient]);
  const visibleReports = useMemo(() => {
    if (selectedWeek === 'all') return selectedPatientReports;
    return selectedPatientReports.filter((r) => String(r.week_number) === String(selectedWeek));
  }, [selectedPatientReports, selectedWeek]);
  const weeklyReport = visibleReports.find((r) => String(r.id) === String(selectedReportId)) || visibleReports[0] || null;

  useEffect(() => {
    if (!selectedPatient) {
      setSelectedReportId('');
      return;
    }
    const next = visibleReports[0];
    setSelectedReportId(next?.id ? String(next.id) : '');
  }, [selectedPatient, selectedWeek, visibleReports]);
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
        .patient-kpi { margin-top: 8px; display: inline-flex; padding: 4px 9px; border-radius: 999px; font-size: 10px; font-weight: 800; background: #EEF4FF; color: #3758D5; }
        .empty-state { border: 1px dashed #D6E0F5; border-radius: 14px; background: #FBFDFF; text-align: center; padding: 24px; color: #64748B; font-size: 13px; font-weight: 700; }
        .report-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.28); backdrop-filter: blur(6px); display: flex; justify-content: center; align-items: center; z-index: 3000; padding: 16px; box-sizing: border-box; }
        .report-modal { width: min(920px, 100%); max-height: min(88vh, 900px); background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(15, 23, 42, 0.06), 0 24px 48px rgba(15, 23, 42, 0.06); display: flex; flex-direction: column; border: 1px solid #e8eaef; border-top: 3px solid #F54E25; }
        .report-header { background: linear-gradient(180deg, #fffdfb 0%, #fafbfc 100%); padding: 18px 22px 16px; color: #1e293b; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 1px solid #f0e8e4; }
        .report-title-kicker { font-size: 11px; font-weight: 600; color: #c2410c; letter-spacing: 0.04em; margin-bottom: 4px; text-transform: uppercase; }
        .report-title-main { font-size: 1.125rem; font-weight: 700; color: #0f172a; line-height: 1.35; letter-spacing: -0.02em; }
        .report-title-accent { color: #F54E25; font-weight: 700; }
        .report-title-desc { font-size: 13px; color: #64748b; margin-top: 8px; line-height: 1.5; font-weight: 400; max-width: 32rem; }
        .report-header-close { border: none; background: transparent; border-radius: 10px; padding: 8px; cursor: pointer; color: #94a3b8; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background .15s, color .15s; }
        .report-header-close:hover { background: #fff5f0; color: #F54E25; }
        .report-modal-body { flex: 1; min-height: 0; overflow: hidden; padding: 18px 20px 20px; color-scheme: light; background: #f9f9fb; display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 12px; }
        .report-history { border: 1px solid #E5ECFA; background: #fff; border-radius: 12px; padding: 10px; overflow: auto; }
        .report-history-title { color: #475569; font-size: 11px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; margin-bottom: 8px; }
        .history-btn { width: 100%; border: 1px solid #E6EDF9; background: #fff; border-radius: 10px; padding: 10px; text-align: left; margin-bottom: 8px; cursor: pointer; }
        .history-btn.active { border-color: #F54E25; background: #FFF7F4; }
        .history-week { color: #1B2559; font-size: 13px; font-weight: 800; }
        .history-meta { color: #64748B; font-size: 11px; font-weight: 600; margin-top: 3px; }
        .report-details-col { overflow: auto; display: grid; gap: 10px; align-content: start; }
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
          .reports-toolbar { justify-content: space-between; }
          .report-modal { width: 94%; max-height: 86vh; }
          .report-header { padding: 16px 16px 14px; }
          .report-modal-body { padding: 14px 14px 16px; grid-template-columns: 1fr; }
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
            <div className="panel-card">
              <div className="reports-header">
                <div>
                  <div className="reports-title">Patient Weekly Reports</div>
                  <div className="reports-subtitle">View latest and past weekly reports from your actual patient records.</div>
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

              {loading ? <div className="loading-msg">Loading live reports...</div> : null}
              {loadError ? <div className="error-msg">{loadError}</div> : null}
              {!loading && !patients.length ? (
                <div className="empty-state">No assigned patients found yet for this account.</div>
              ) : (
                <div className="patient-grid">
                  {patients.map((patient) => {
                    const reportCount = (weeklyReportsByPatient[String(patient.id)] || []).length;
                    return (
                      <button
                        key={patient.id}
                        type="button"
                        className={`patient-btn ${selectedPatient && String(selectedPatient.id) === String(patient.id) ? 'active' : ''}`}
                        onClick={() => setSelectedPatient(patient)}
                      >
                        <div className="patient-name">{patient.name}</div>
                        <div className="patient-meta">Age: {patient.age}</div>
                        <div className="patient-meta">Admitted: {patient.date || 'N/A'}</div>
                        <div className="patient-kpi">{reportCount} report{reportCount === 1 ? '' : 's'}</div>
                      </button>
                    );
                  })}
                </div>
              )}
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

      {selectedPatient && (
        <div className="report-overlay" onClick={() => setSelectedPatient(null)}>
          <div className="report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="report-header">
              <div>
                <div className="report-title-kicker">Care updates</div>
                <div className="report-title-main">
                  <span className="report-title-accent">
                    {selectedWeek === 'all' ? 'Latest' : `Week ${selectedWeek}`}
                  </span> report
                </div>
                <div className="report-title-desc">{selectedPatient.name} weekly patient report details and history.</div>
              </div>
              <button type="button" className="report-header-close" onClick={() => setSelectedPatient(null)} aria-label="Close report">
                <X size={20} />
              </button>
            </div>
            <div className="report-modal-body">
              <div className="report-history">
                <div className="report-history-title">Past Reports</div>
                {!visibleReports.length ? (
                  <div className="history-meta">No reports available for this filter.</div>
                ) : visibleReports.map((row) => (
                  <button
                    key={row.id || `${row.patient_id}-${row.week_number}-${row.created_at}`}
                    type="button"
                    className={`history-btn ${weeklyReport && String(weeklyReport.id) === String(row.id) ? 'active' : ''}`}
                    onClick={() => setSelectedReportId(String(row.id))}
                  >
                    <div className="history-week">Week {row.week_number || '-'}</div>
                    <div className="history-meta">{formatDate(row.submitted_at || row.created_at)}</div>
                  </button>
                ))}
              </div>
              <div className="report-details-col">
                <div className="report-row">
                  <div className="report-label"><FileText size={14} />Summary</div>
                  <div className="report-value">{weeklyReport?.summary || weeklyReport?.report_summary || 'No report available for this week.'}</div>
                </div>
                <div className="report-row">
                  <div className="report-label"><Activity size={14} />Progress</div>
                  <div className="report-value">
                    {weeklyReport?.progress_percent !== undefined && weeklyReport?.progress_percent !== null
                      ? `${weeklyReport.progress_percent}%`
                      : 'N/A'}
                  </div>
                </div>
                <div className="report-row">
                  <div className="report-label">Nurse Notes</div>
                  <div className="report-value">{weeklyReport?.nurse_note || weeklyReport?.notes || 'No notes available.'}</div>
                </div>
                <div className="report-row">
                  <div className="report-label">Behavior / Mood</div>
                  <div className="report-value">{weeklyReport?.behavior_observation || weeklyReport?.mood_assessment || 'No behavior notes recorded.'}</div>
                </div>
                <div className="report-row">
                  <div className="report-label">Recommendations</div>
                  <div className="report-value">{weeklyReport?.recommendations || weeklyReport?.plan_next_week || 'No recommendations recorded.'}</div>
                </div>
                <div className="report-row">
                  <div className="report-label">Submitted</div>
                  <div className="report-value">{formatDate(weeklyReport?.submitted_at || weeklyReport?.created_at)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <FloatingChatHead />
    </div>
  );
}
