import React, { useState, useRef, useEffect } from 'react';
import { Home, TrendingUp, User, LogOut, MessageCircle, X, Send, FileText, Bell, Calendar, CheckCircle2, Clock3, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  fetchActivityFeedForCurrentUser,
  activityDayLabel,
  ACTIVITY_FEED_UPDATED,
} from '@/lib/activityFeed';
import { APP_DATA_REFRESH } from '@/lib/appDataRefresh';
import {
  uiPatientFromRow,
  uiAdmissionRequestFromRow,
  uiDischargeRequestFromRow,
} from '@/lib/dbMappers';
import {
  loadVisitationSettings,
  listVisitationRequestsByFamily,
  createVisitationRequest,
} from '@/lib/visitationAppointments';
import {
  FAMILY_COLORS,
} from '@/components/family/shared/ui';

// Asset imports
import logo from '@/assets/logo2.png';
import weeklyIcon from '@/assets/weekly.png';
import servicesIcon from '@/assets/services.png';
import admissionIcon from '@/assets/admission.png';

const HomeDashboard = () => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [weeklyReportExpandedPatientId, setWeeklyReportExpandedPatientId] = useState(null);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const [completedReminders, setCompletedReminders] = useState([]);
  const [displayName, setDisplayName] = useState('Family User');
  const [userInitials, setUserInitials] = useState('FU');
  const [familyUserId, setFamilyUserId] = useState('');
  const [visitationSettings, setVisitationSettings] = useState(() => loadVisitationSettings());
  const [familyVisitationRequests, setFamilyVisitationRequests] = useState([]);
  const [visitationSaving, setVisitationSaving] = useState(false);
  const [visitationForm, setVisitationForm] = useState({
    patientId: '',
    patientName: '',
    preferredDate: '',
    preferredTime: '',
    note: '',
  });

  // AI Chat Logic State
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, text: "Hello! How can I help you today?", sender: 'bot', time: '3:18 PM' }
  ]);
  const chatBodyRef = useRef(null);

  // Auto-scroll logic
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTo({
        top: chatBodyRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isChatOpen, isTyping]);

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

      if (isMounted) {
        setDisplayName(resolvedName);
        setUserInitials(deriveInitials(resolvedName));
        setFamilyUserId(user?.id || 'local-family');
      }
    };

    loadUser();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!familyUserId) return;
    const loadVisitation = () => {
      setVisitationSettings(loadVisitationSettings());
      setFamilyVisitationRequests(listVisitationRequestsByFamily(familyUserId));
    };
    loadVisitation();
    window.addEventListener('storage', loadVisitation);
    window.addEventListener(APP_DATA_REFRESH, loadVisitation);
    return () => {
      window.removeEventListener('storage', loadVisitation);
      window.removeEventListener(APP_DATA_REFRESH, loadVisitation);
    };
  }, [familyUserId]);

  const handleSendMessage = () => {
    if (!inputValue.trim() || isTyping) return;

    const userMsg = {
      id: Date.now(),
      text: inputValue,
      sender: 'user',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      const botMsg = {
        id: Date.now() + 1,
        text: "Thank you for reaching out to Bridges of Hope. How can I assist you with your recovery journey today?",
        sender: 'bot',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMsg]);
    }, 1500);
  };

  const [patientImages, setPatientImages] = useState({});
  const fileInputRefs = useRef([]);
  const notificationsDesktopRef = useRef(null);
  const notificationsMobileRef = useRef(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationItems = [
    'Submit missing laboratory result before Friday.',
    'Family support session is scheduled on April 5, 10:00 AM.',
    'Weekly report reviewed by your assigned counselor.',
  ];
  const [activityFeed, setActivityFeed] = useState([]);
  const [supabaseReadError, setSupabaseReadError] = useState(null);

  const reminderItems = [
    'Complete profile details',
    'Upload latest medical test result',
    'Review appointment schedule',
  ];

  // --- SYNC: patients, pending requests, weekly reports, activity (Supabase or legacy) ---
  const PENDING_ADMISSIONS_KEY = 'bh_pending_admissions';
  const PENDING_DISCHARGES_KEY = 'bh_pending_discharges';
  const NURSE_REPORTS_KEY = 'bh_nurse_weekly_reports';

  const defaultDemoPatients = [
    { id: 0, name: 'John Doe', date: 'January 15, 2026', progress: 65 },
    { id: 1, name: 'Ivan Doe', date: 'January 15, 2026', progress: 65 },
    { id: 2, name: 'Jay Doe', date: 'January 15, 2026', progress: 65 },
  ];

  const parseJsonArray = (raw, fallback = []) => {
    try {
      const v = JSON.parse(raw || 'null');
      return Array.isArray(v) ? v : fallback;
    } catch {
      return fallback;
    }
  };

  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [pendingAdmissions, setPendingAdmissions] = useState([]);
  const [pendingDischarges, setPendingDischarges] = useState([]);
  const [nurseWeeklyReportsByPatient, setNurseWeeklyReportsByPatient] = useState({});

  const submitVisitationRequest = async () => {
    const patientName = String(visitationForm.patientName || '').trim();
    const preferredDate = String(visitationForm.preferredDate || '').trim();
    const preferredTime = String(visitationForm.preferredTime || '').trim();
    if (!patientName || !preferredDate || !preferredTime) return;
    setVisitationSaving(true);
    try {
      createVisitationRequest({
        familyId: familyUserId || 'local-family',
        familyName: displayName,
        patientId: visitationForm.patientId || '',
        patientName,
        preferredDate,
        preferredTime,
        note: String(visitationForm.note || '').trim(),
      });
      setVisitationForm({ patientId: '', patientName: '', preferredDate: '', preferredTime: '', note: '' });
      setFamilyVisitationRequests(listVisitationRequestsByFamily(familyUserId || 'local-family'));
      window.dispatchEvent(new Event('storage'));
    } finally {
      setVisitationSaving(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadLegacy = async () => {
      const saved = localStorage.getItem('bh_patients');
      if (!cancelled) {
        setPatients(saved ? JSON.parse(saved) : defaultDemoPatients);
      }
      if (!cancelled) {
        setPendingAdmissions(parseJsonArray(localStorage.getItem(PENDING_ADMISSIONS_KEY), []));
        setPendingDischarges(parseJsonArray(localStorage.getItem(PENDING_DISCHARGES_KEY), []));
      }
      try {
        const raw = localStorage.getItem(NURSE_REPORTS_KEY);
        if (!cancelled) setNurseWeeklyReportsByPatient(raw ? JSON.parse(raw) : {});
      } catch {
        if (!cancelled) setNurseWeeklyReportsByPatient({});
      }
      const feed = await fetchActivityFeedForCurrentUser();
      if (!cancelled) setActivityFeed(feed);
    };

    const loadSupabase = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) {
          setPatients([]);
          setPendingAdmissions([]);
          setPendingDischarges([]);
          setNurseWeeklyReportsByPatient({});
        }
        const feed = await fetchActivityFeedForCurrentUser();
        if (!cancelled) setActivityFeed(feed);
        return;
      }

      if (!cancelled) setSupabaseReadError(null);

      const { data: pRows, error: pErr } = await supabase
        .from('patients')
        .select('id, full_name, admitted_at, progress_percent, clinical_status, primary_concern, family_id, discharged_at')
        .eq('family_id', user.id)
        .is('discharged_at', null)
        .order('admitted_at', { ascending: false });

      if (cancelled) return;
      if (pErr) {
        console.warn('[home patients]', pErr.message);
        setPatients([]);
      } else {
        setPatients((pRows || []).map((r) => uiPatientFromRow(r)).filter(Boolean));
      }

      const [{ data: aRows, error: aErr }, { data: dRows, error: dErr }] =
        await Promise.all([
          supabase
            .from('admission_requests')
            .select('*')
            .eq('family_id', user.id)
            .eq('status', 'pending'),
          supabase
            .from('discharge_requests')
            .select('*, patients(full_name)')
            .eq('family_id', user.id)
            .eq('status', 'pending'),
        ]);

      if (!cancelled) {
        if (aErr) {
          console.warn('[home admission_requests]', aErr.message);
          setSupabaseReadError(aErr.message);
        }
        if (dErr) {
          console.warn('[home discharge_requests]', dErr.message);
          setSupabaseReadError((prev) => prev || dErr.message);
        }
        setPendingAdmissions((aRows || []).map((r) => uiAdmissionRequestFromRow(r)).filter(Boolean));
        setPendingDischarges((dRows || []).map((r) => uiDischargeRequestFromRow(r)).filter(Boolean));
      }

      const ids = (pRows || []).map((r) => r.id).filter(Boolean);
      let byPatient = {};
      if (ids.length) {
        const { data: wRows, error: wErr } = await supabase.from('weekly_reports').select('*').in('patient_id', ids);
        if (!cancelled && !wErr && wRows) {
          for (const row of wRows) {
            const pid = String(row.patient_id);
            if (!byPatient[pid]) byPatient[pid] = {};
            byPatient[pid][String(row.week_number)] = {
              submittedAt: row.submitted_at,
              nurseName: row.nurse_name || '',
              reportDate: row.report_date || '',
            };
          }
        }
      }
      if (!cancelled) setNurseWeeklyReportsByPatient(byPatient);

      const feed = await fetchActivityFeedForCurrentUser();
      if (!cancelled) setActivityFeed(feed);
    };

    const load = async () => {
      if (!isSupabaseConfigured()) {
        await loadLegacy();
        return;
      }
      await loadSupabase();
    };

    load();
    window.addEventListener('storage', load);
    window.addEventListener(APP_DATA_REFRESH, load);
    window.addEventListener(ACTIVITY_FEED_UPDATED, load);
    return () => {
      cancelled = true;
      window.removeEventListener('storage', load);
      window.removeEventListener(APP_DATA_REFRESH, load);
      window.removeEventListener(ACTIVITY_FEED_UPDATED, load);
    };
  }, []);

  const formatNurseReportDate = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const handleImageChange = (index, event) => {
    const file = event.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setPatientImages(prev => ({ ...prev, [index]: imageUrl }));
    }
  };

  const triggerFileInput = (index) => {
    fileInputRefs.current[index].click(); // Fixed: Added missing closing parenthesis here
  };

  const toggleReminder = (item) => {
    setCompletedReminders((prev) =>
      prev.includes(item) ? prev.filter((entry) => entry !== item) : [...prev, item]
    );
  };

  const patientCardInitials = (name) =>
    name
      ? String(name)
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0].toUpperCase())
          .join('')
      : '?';

  useEffect(() => {
    if (!patients.length) {
      setSelectedPatientId(null);
      return;
    }
    const hasSelected = patients.some((p) => String(p.id) === String(selectedPatientId));
    if (!hasSelected) {
      setSelectedPatientId(patients[0].id);
    }
  }, [patients, selectedPatientId]);

  const selectedPatient = patients.find((p) => String(p.id) === String(selectedPatientId)) || patients[0] || null;
  const selectedPatientProgress = Number(selectedPatient?.progress) || 0;
  const activeTreatmentDays = selectedPatient?.date
    ? Math.max(1, Math.round((Date.now() - new Date(selectedPatient.date).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const recoveryRate = Math.min(100, Math.max(0, Math.round(selectedPatientProgress * 0.92 + 6)));
  const progressTrend = Math.max(1, Math.round(selectedPatientProgress / 4));
  const patientProgressSeries = [12, 25, 38, 52, Math.max(58, selectedPatientProgress - progressTrend), selectedPatientProgress].map((value) =>
    Math.min(100, Math.max(0, value))
  );
  const averageProgress = patients.length
    ? Math.round(patients.reduce((sum, p) => sum + (Number(p.progress) || 0), 0) / patients.length)
    : 0;
  const kpiCards = [
    { label: 'Progress Percentage', value: `${selectedPatientProgress}%` },
    { label: 'Recovery Rate', value: `${recoveryRate}%` },
    { label: 'Active Treatment Days', value: `${activeTreatmentDays}` },
    { label: 'Total Active Patients', value: `${patients.length}` },
    { label: 'Average Cohort Progress', value: `${averageProgress}%` },
    { label: 'Pending Requests', value: `${pendingAdmissions.length + pendingDischarges.length}` },
  ];

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
          max-width: 140px;
          white-space: normal;
          overflow-wrap: anywhere;
          line-height: 1.2;
        }
        .sidebar-primary {
          width: 100%;
        }
        .sidebar-footer {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 20px;
          width: 100%;
        }
        .sidebar-footer .sidebar-nav-item { margin-bottom: 0; }
        .sidebar-footer .sidebar-nav-item + .sidebar-nav-item { margin-top: 14px; }

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

        .scroll-content {
          flex: 1;
          padding: 30px 40px;
          overflow-y: auto;
        }

        .content-wrap {
          width: 100%;
          max-width: min(1560px, 100%);
          margin: 0 auto;
        }

        .patient-card {
          width: 100%;
          min-height: 120px;
          background: white;
          border-radius: 20px;
          padding: 20px 24px;
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 16px 20px;
          align-items: center;
          margin-bottom: 16px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.02);
          border: 1px solid #E9EDF7;
          box-sizing: border-box;
        }

        .patient-card .patient-progress {
          grid-column: 1 / -1;
        }

        .bottom-layout {
          display: flex;
          flex-direction: column;
          gap: 20px;
          align-items: stretch;
          width: 100%;
        }

        .patient-section {
          min-width: 0;
          width: 100%;
        }

        .dashboard-panels {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          width: 100%;
          align-items: start;
        }

        .dashboard-panels-col {
          display: flex;
          flex-direction: column;
          gap: 14px;
          min-width: 0;
        }

        .action-section {
          width: 100%;
        }

        .action-grid-desktop {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }

        .dashboard-insights {
          display: grid;
          grid-template-columns: 1.45fr 1fr;
          gap: 16px;
          margin-bottom: 20px;
          align-items: stretch;
        }

        .chart-card {
          height: 100%;
          background: white;
          border: 1px solid #E9EDF7;
          border-radius: 16px;
          padding: 18px;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);
          display: flex;
          flex-direction: column;
        }

        .chart-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .patient-select {
          border: 1px solid #E2E8F0;
          border-radius: 10px;
          padding: 8px 10px;
          font-size: 12px;
          font-weight: 600;
          color: #1B2559;
          background: #fff;
        }

        .chart-svg {
          width: 100%;
          height: 280px;
          display: block;
          border-radius: 12px;
          background: linear-gradient(180deg, #f8fbff 0%, #ffffff 70%);
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 10px;
          flex: 1;
          align-content: stretch;
        }

        .kpi-item {
          border: 1px solid #E9EDF7;
          border-radius: 12px;
          padding: 14px 12px;
          background: #fbfdff;
          min-height: 96px;
        }

        .empty-dashboard-card {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
          min-height: 220px;
          border: 1px dashed #dbe5f3;
          border-radius: 12px;
          color: #64748b;
          font-size: 14px;
          font-weight: 700;
          background: #fbfdff;
        }

        .metric-card {
          background: white;
          border: 1px solid #E9EDF7;
          border-radius: 14px;
          padding: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.02);
        }

        .panel-card {
          background: white;
          border: 1px solid #E9EDF7;
          border-radius: 14px;
          padding: 16px;
          margin-bottom: 14px;
        }

        .panel-title {
          color: #1B2559;
          font-weight: 800;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-chip {
          font-size: 12px;
          font-weight: 700;
          border-radius: 999px;
          padding: 4px 10px;
        }

        .interactive-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 10px;
          color: #334155;
          font-size: 13px;
        }

        .reminder-btn {
          width: 100%;
          border: 1px solid #E2E8F0;
          border-radius: 10px;
          padding: 10px 12px;
          background: white;
          text-align: left;
          cursor: pointer;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13px;
          color: #1E293B;
        }

        .reminder-btn.completed {
          background: #ECFDF3;
          border-color: #A7F3D0;
          color: #065F46;
        }

        @media (min-width: 900px) {
          .patient-card {
            grid-template-columns: auto 1fr minmax(200px, 280px);
          }
          .patient-card .patient-progress {
            grid-column: auto;
          }
        }

        .patient-img-placeholder {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: #F4F7FE;
          margin-right: 25px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px dashed #A3AED0;
          cursor: pointer;
          overflow: hidden;
          position: relative;
        }

        .patient-attached-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .action-card {
          width: 100%;
          min-height: 120px;
          background: white;
          border-radius: 18px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border: 1px solid #E9EDF7;
          transition: all 0.2s ease;
        }

        .icon-square {
          width: 64px;
          height: 64px;
          background: #F54E25;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
        }

        .icon-square img {
          width: 30px;
          height: auto;
          filter: brightness(0) invert(1);
        }

        .chat-window {
          position: fixed;
          bottom: 100px;
          right: 20px;
          width: 350px;
          height: 500px;
          background: white;
          border-radius: 24px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.15);
          display: flex;
          flex-direction: column;
          z-index: 2000;
          overflow: hidden;
          border: 1px solid rgba(0,0,0,0.05);
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .chat-header {
          padding: 18px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: white;
          border-bottom: 1px solid #F1F1F1;
        }

        .chat-body {
          flex: 1;
          padding: 20px;
          background: #F8F9FD;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
          scrollbar-width: none;
        }

        .chat-body::-webkit-scrollbar { display: none; }

        .msg-bubble {
          max-width: 85%;
          padding: 12px 16px;
          font-size: 13.5px;
          line-height: 1.4;
          position: relative;
        }

        .msg-received {
          background: white;
          color: #1B2559;
          align-self: flex-start;
          border-radius: 18px 18px 18px 4px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.03);
        }

        .msg-sent {
          background: #F54E25;
          color: white;
          align-self: flex-end;
          border-radius: 18px 18px 4px 18px;
        }

        .typing-indicator {
          display: flex;
          gap: 4px;
          padding: 12px 16px;
          background: white;
          width: fit-content;
          border-radius: 18px 18px 18px 4px;
        }

        .dot {
          width: 6px;
          height: 6px;
          background: #A3AED0;
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out;
        }
        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }

        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }

        .report-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(15, 23, 42, 0.28);
          backdrop-filter: blur(6px);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 3000;
          padding: 16px;
          box-sizing: border-box;
        }

        .report-modal {
          width: min(640px, 100%);
          max-height: min(88vh, 900px);
          background: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(15, 23, 42, 0.06), 0 24px 48px rgba(15, 23, 42, 0.06);
          display: flex;
          flex-direction: column;
          border: 1px solid #e8eaef;
          border-top: 3px solid #F54E25;
        }

        .report-header {
          background: linear-gradient(180deg, #fffdfb 0%, #fafbfc 100%);
          padding: 18px 22px 16px;
          color: #1e293b;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          border-bottom: 1px solid #f0e8e4;
        }

        .report-header-text { min-width: 0; flex: 1; }

        .report-title-kicker {
          font-size: 11px;
          font-weight: 600;
          color: #c2410c;
          letter-spacing: 0.04em;
          margin-bottom: 4px;
          text-transform: uppercase;
        }

        .report-title-main {
          font-size: 1.125rem;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.35;
          letter-spacing: -0.02em;
        }

        .report-title-accent {
          color: #F54E25;
          font-weight: 700;
        }

        .report-title-desc {
          font-size: 13px;
          color: #64748b;
          margin-top: 8px;
          line-height: 1.5;
          font-weight: 400;
          max-width: 32rem;
        }

        .report-header-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 12px;
          padding: 5px 10px;
          background: #fff5f0;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          color: #b45309;
          border: 1px solid #ffdfd3;
        }

        .report-header-badge svg {
          color: #F54E25;
        }

        .report-header-close {
          border: none;
          background: transparent;
          border-radius: 10px;
          padding: 8px;
          cursor: pointer;
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 0.15s, color 0.15s;
        }

        .report-header-close:hover {
          background: #fff5f0;
          color: #F54E25;
        }

        .report-status-chip {
          background: #fff7f3;
          color: #9a3412;
          font-size: 10px;
          padding: 3px 8px;
          border-radius: 6px;
          font-weight: 600;
          border: 1px solid #ffdfd3;
        }

        .report-section {
          padding: 20px 35px;
        }

        .section-title {
          color: #1B2559;
          font-weight: 800;
          font-size: 16px;
          margin-bottom: 15px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .section-title::before {
          content: "";
          width: 4px;
          height: 20px;
          background: #F54E25;
          border-radius: 10px;
        }

        .report-content-box {
          background: #F8F9FD;
          padding: 15px;
          border-radius: 12px;
          font-size: 13px;
          line-height: 1.6;
          color: #707EAE;
        }

        .report-list-item {
          background: #F8F9FD;
          padding: 12px 15px;
          border-radius: 10px;
          font-size: 13px;
          color: #1B2559;
          font-weight: 600;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 8px;
        }

        .report-modal-body {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 18px 20px 20px;
          color-scheme: light;
          background: #f9f9fb;
        }

        .report-patient-block {
          border: 1px solid #eaecef;
          border-radius: 12px;
          margin-bottom: 10px;
          overflow: hidden;
          background: #ffffff;
          box-shadow: none;
          transition: border-color 0.15s ease;
        }

        .report-patient-block:focus-within,
        .report-patient-block:hover {
          border-color: #f5d0c4;
        }

        .report-patient-block:last-child { margin-bottom: 0; }

        .report-patient-row {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 12px 14px;
          border: none;
          background: transparent;
          cursor: pointer;
          text-align: left;
          font-family: inherit;
        }

        .report-patient-row:hover { background: #fffdfb; }

        .report-patient-avatar {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: #fff5f0;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex-shrink: 0;
          border: 1px solid #ffeee6;
        }

        .report-patient-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .report-patient-main { flex: 1; min-width: 0; }

        .report-patient-name {
          font-size: 0.95rem;
          font-weight: 700;
          color: #0f172a;
        }

        .report-patient-meta {
          font-size: 12px;
          color: #64748b;
          margin-top: 3px;
          font-weight: 500;
        }

        .report-chevron {
          color: #fdba9a;
          flex-shrink: 0;
          transition: transform 0.2s ease, color 0.15s ease;
        }

        .report-chevron.open {
          transform: rotate(180deg);
          color: #F54E25;
        }

        .report-weeks-panel {
          padding: 10px 12px 14px;
          background: linear-gradient(180deg, #fffdfb 0%, #fafbfc 100%);
          border-top: 1px solid #f0e8e4;
        }

        .report-weeks-hint {
          font-size: 12px;
          font-weight: 600;
          color: #475569;
          margin: 0 2px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
        }

        .report-weeks-hint-label {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .report-weeks-hint-bar {
          width: 3px;
          height: 14px;
          background: #F54E25;
          border-radius: 2px;
          flex-shrink: 0;
        }

        .report-week-summary-pill {
          font-size: 11px;
          font-weight: 600;
          color: #9a3412;
          background: #ffffff;
          padding: 4px 10px;
          border-radius: 6px;
          border: 1px solid #ffd4c4;
        }

        .report-week-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .report-week-card {
          background: #ffffff;
          border: 1px solid #e8eaef;
          border-radius: 10px;
          padding: 11px 12px 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-height: 0;
        }

        .report-week-card--empty {
          border-color: #eceff3;
          background: #fcfcfd;
        }

        .report-week-card--done {
          border-color: #f5d0c4;
          background: #fffcfa;
        }

        .report-week-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .report-week-num {
          font-size: 13px;
          font-weight: 600;
          color: #334155;
        }

        .report-week-badge {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.02em;
          padding: 3px 7px;
          border-radius: 6px;
          flex-shrink: 0;
        }

        .report-week-badge--pending {
          background: #f1f5f9;
          color: #64748b;
        }

        .report-week-badge--submitted {
          background: #fff5f0;
          color: #c2410c;
          border: 1px solid #ffd4c4;
        }

        .report-week-empty-msg {
          margin: 0;
          font-size: 12px;
          font-weight: 500;
          color: #94a3b8;
          line-height: 1.45;
        }

        .report-week-detail {
          display: flex;
          gap: 8px;
          align-items: flex-start;
        }

        .report-week-detail-text {
          font-size: 12px;
          color: #475569;
          line-height: 1.45;
          font-weight: 500;
        }

        .report-week-detail-sub {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 500;
          margin-top: 3px;
        }

        .report-footer-bar {
          padding: 14px 20px 18px;
          background: #fafbfc;
          border-top: 1px solid #eef0f4;
        }

        .report-close-btn {
          background: #ffffff;
          color: #c2410c;
          border: 1px solid #F54E25;
          width: 100%;
          padding: 11px 16px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: none;
          font-family: inherit;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }

        .report-close-btn:hover {
          background: #fff5f0;
          color: #9a3412;
          border-color: #ea580c;
        }

        .report-close-btn:active { transform: scale(0.995); }

        .report-empty-modal {
          text-align: center;
          padding: 28px 20px;
          color: #94a3b8;
          font-size: 13px;
          line-height: 1.55;
          font-weight: 500;
        }

        .report-dot {
          width: 8px;
          height: 8px;
          background: #F54E25;
          border-radius: 50%;
          opacity: 0.5;
        }

        .mobile-only { display: none; }

        @media (max-width: 768px) {
          .desktop-sidebar, .top-nav, .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; }
          .app-container { flex-direction: column; height: 100vh; overflow: hidden; }
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
          .scroll-content { padding: 15px !important; padding-bottom: 90px !important; }
          .layout-flex-mobile { flex-direction: column !important; }
          .bottom-layout { width: 100%; }
          .dashboard-panels { grid-template-columns: 1fr !important; }
          .patient-card {
            grid-template-columns: 1fr !important;
            padding: 15px !important;
          }
          .patient-card .patient-img-placeholder {
            margin-right: 0 !important;
            justify-self: start;
          }
          .patient-card .patient-progress {
            grid-column: 1 / -1 !important;
          }
          .dashboard-grid { grid-template-columns: 1fr !important; }
          .dashboard-insights { grid-template-columns: 1fr !important; }
          .action-section { order: -1; margin-bottom: 20px; } 
          .patient-section { order: 1; }
          .patient-card { width: 100% !important; height: auto !important; padding: 15px !important; margin-bottom: 10px !important; flex-direction: row !important; }
          .patient-img-placeholder { width: 50px !important; height: 50px !important; margin-right: 15px !important; }
          .mobile-action-grid { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 10px !important; }
          .action-grid-desktop { grid-template-columns: repeat(3, 1fr) !important; }
          .mobile-action-grid .action-card { width: 100% !important; height: 100px !important; border-radius: 15px !important; }
          .mobile-action-grid .icon-square { width: 40px !important; height: 40px !important; margin-bottom: 5px !important; }
          .mobile-action-grid .icon-square img { width: 20px !important; }
          .mobile-action-grid span { font-size: 10px !important; }
          .mobile-bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; height: 70px; background: white; border-top: 1px solid #EEE; display: flex; justify-content: space-around; align-items: center; padding-bottom: env(safe-area-inset-bottom); z-index: 1000; }
          .recovery-text-mobile { font-size: 24px !important; }
          .chat-window { width: 320px; height: 450px; bottom: 85px; right: 15px; border-radius: 20px; }
          .report-modal { width: 94%; max-height: 86vh; }
          .report-week-grid { grid-template-columns: 1fr; }
          .report-header { padding: 16px 16px 14px !important; }
          .report-modal-body { padding: 14px 14px 16px !important; }
        }
      `}</style>

      {/* REPORT MODAL */}
      {showReport && (
        <div
          className="report-overlay"
          onClick={() => {
            setShowReport(false);
            setWeeklyReportExpandedPatientId(null);
          }}
        >
          <div className="report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="report-header">
              <div className="report-header-text">
                <div className="report-title-kicker">Care updates</div>
                <div className="report-title-main">
                  <span className="report-title-accent">Weekly</span> reports
                </div>
                <p className="report-title-desc">
                  Open a patient to see weeks 1–7. Filled reports from your nurse appear with a date; empty weeks show &quot;No reports submitted yet.&quot;
                </p>
                {patients.length > 0 && (
                  <div className="report-header-badge">
                    <FileText size={14} strokeWidth={2} aria-hidden />
                    {patients.length} patient{patients.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="report-header-close"
                onClick={() => {
                  setShowReport(false);
                  setWeeklyReportExpandedPatientId(null);
                }}
                aria-label="Close"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>
            <div className="report-modal-body">
              {patients.length === 0 ? (
                <div className="report-empty-modal">No admitted patients yet. When an admission is approved, patients will show here.</div>
              ) : (
                patients.map((p, i) => {
                  const reportsForPatient = nurseWeeklyReportsByPatient[String(p.id)] || {};
                  const submittedWeekCount = [1, 2, 3, 4, 5, 6, 7].filter((n) => reportsForPatient[String(n)]).length;

                  return (
                    <div key={p.id} className="report-patient-block">
                      <button
                        type="button"
                        className="report-patient-row"
                        onClick={() =>
                          setWeeklyReportExpandedPatientId((prev) => (prev === p.id ? null : p.id))
                        }
                        aria-expanded={weeklyReportExpandedPatientId === p.id}
                      >
                        <div className="report-patient-avatar">
                          {patientImages[i] ? (
                            <img src={patientImages[i]} alt="" />
                          ) : (
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#c2410c' }}>{patientCardInitials(p.name)}</span>
                          )}
                        </div>
                        <div className="report-patient-main">
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                            <span className="report-patient-name">{p.name}</span>
                            <span className="report-status-chip">Recovering</span>
                          </div>
                          <div className="report-patient-meta">
                            Admitted {p.date}
                            {p.progress != null && p.progress !== '' ? ` · ${p.progress}% progress` : ''}
                            <span style={{ color: '#94a3b8', fontWeight: 500 }}> · {submittedWeekCount}/7 reports</span>
                          </div>
                        </div>
                        <ChevronDown
                          size={20}
                          className={`report-chevron${weeklyReportExpandedPatientId === p.id ? ' open' : ''}`}
                        />
                      </button>
                      {weeklyReportExpandedPatientId === p.id && (
                        <div className="report-weeks-panel">
                          <div className="report-weeks-hint">
                            <span className="report-weeks-hint-label">
                              <span className="report-weeks-hint-bar" aria-hidden />
                              Weekly timeline
                            </span>
                            <span className="report-week-summary-pill">{submittedWeekCount} of 7 received</span>
                          </div>
                          <div className="report-week-grid">
                            {[1, 2, 3, 4, 5, 6, 7].map((w) => {
                              const rec = reportsForPatient[String(w)];
                              return (
                                <div
                                  key={w}
                                  className={`report-week-card ${rec ? 'report-week-card--done' : 'report-week-card--empty'}`}
                                >
                                  <div className="report-week-card-top">
                                    <span className="report-week-num">Week {w}</span>
                                    {rec ? (
                                      <span className="report-week-badge report-week-badge--submitted">Received</span>
                                    ) : (
                                      <span className="report-week-badge report-week-badge--pending">Open</span>
                                    )}
                                  </div>
                                  {rec ? (
                                    <div className="report-week-detail">
                                      <CheckCircle2 size={16} color="#ea580c" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
                                      <div>
                                        <div className="report-week-detail-text">
                                          Received {formatNurseReportDate(rec.submittedAt)}
                                        </div>
                                        {rec.nurseName ? (
                                          <div className="report-week-detail-sub">Nurse: {rec.nurseName}</div>
                                        ) : null}
                                        {rec.reportDate ? (
                                          <div className="report-week-detail-sub">Report date: {rec.reportDate}</div>
                                        ) : null}
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="report-week-empty-msg">No reports submitted yet.</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <div className="report-footer-bar">
              <button
                type="button"
                className="report-close-btn"
                onClick={() => {
                  setShowReport(false);
                  setWeeklyReportExpandedPatientId(null);
                }}
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

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
              <TrendingUp size={22} color="#707EAE" />
            </div>
            <span className="sidebar-label">Progress</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/appointments'); }}>
            <div className="sidebar-icon-wrap">
              <Calendar size={22} color="#707EAE" />
            </div>
            <span className="sidebar-label">Appointments</span>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/profile'); }}>
            <User size={22} color="#707EAE" />
            <span className="sidebar-label">Profile</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/login'); }}>
            <LogOut size={22} color="#F54E25" style={{ cursor: 'pointer' }} />
            <span className="sidebar-label" style={{ color: '#F54E25' }}>Logout</span>
          </div>
        </div>
      </aside>

      <div className="main-view">
        <header className="top-nav">
          <div className="top-nav-left">
            <span className="view-title">Dashboard</span>
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

        <div className="scroll-content" style={{ background: FAMILY_COLORS.background }}>
          <div className="content-wrap">
          <div className="panel-card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 className="recovery-text-mobile" style={{ fontSize: '30px', fontWeight: 800, color: '#1B2559', margin: 0 }}>
                Quick <span style={{ color: '#F54E25' }}>Actions</span>
              </h2>
              <span style={{ color: '#64748B', fontWeight: 600, fontSize: 13 }}>
                Start with your most-used tools
              </span>
            </div>
            <div className="mobile-action-grid action-grid-desktop">
              <div
                className="action-card"
                onClick={() => {
                  setWeeklyReportExpandedPatientId(null);
                  setShowReport(true);
                  setIsChatOpen(false);
                }}
              >
                <div className="icon-square"><img src={weeklyIcon} alt="Report" /></div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1B2559' }}>Weekly Report</span>
              </div>
              <div className="action-card" onClick={() => navigate('/services')}>
                <div className="icon-square"><img src={servicesIcon} alt="Services" /></div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1B2559' }}>Services</span>
              </div>
              <div className="action-card" onClick={() => navigate('/progress', { state: { tab: 'admission' } })}>
                <div className="icon-square"><img src={admissionIcon} alt="Admission" /></div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1B2559' }}>Admission</span>
              </div>
            </div>
          </div>

          <div className="dashboard-insights">
            <div className="chart-card">
              <div className="chart-top">
                <div>
                  <div style={{ color: '#1B2559', fontWeight: 800, fontSize: 16 }}>Patient Progress</div>
                  <div style={{ color: '#64748B', fontSize: 12 }}>
                    {selectedPatient ? `Tracking ${selectedPatient.name}` : 'No patient admitted'}
                  </div>
                </div>
                {patients.length > 0 && (
                  <select
                    className="patient-select"
                    value={selectedPatient?.id ?? ''}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                  >
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {patients.length > 0 ? (
                <svg className="chart-svg" viewBox="0 0 560 220" role="img" aria-label="Patient progress over time">
                  {[0, 1, 2, 3, 4].map((row) => (
                    <line key={row} x1="42" y1={25 + row * 40} x2="530" y2={25 + row * 40} stroke="#E9EDF7" strokeWidth="1" />
                  ))}
                  {patientProgressSeries.map((point, index) => {
                    const x = 42 + index * 97;
                    const y = 185 - point * 1.5;
                    return (
                      <g key={index}>
                        <circle cx={x} cy={y} r="4.5" fill="#F54E25" />
                        <text x={x} y={208} textAnchor="middle" fontSize="11" fill="#64748B">{`W${index + 1}`}</text>
                      </g>
                    );
                  })}
                  <polyline
                    fill="none"
                    stroke="#F54E25"
                    strokeWidth="3"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={patientProgressSeries
                      .map((point, index) => `${42 + index * 97},${185 - point * 1.5}`)
                      .join(' ')}
                  />
                </svg>
              ) : (
                <div className="empty-dashboard-card">No patient admitted</div>
              )}
            </div>
            <div className="chart-card">
              <div style={{ color: '#1B2559', fontWeight: 800, fontSize: 16 }}>Patient Statistics</div>
              <div style={{ color: '#64748B', fontSize: 12, marginTop: 4 }}>
                {patients.length > 0
                  ? 'Key performance indicators for the selected patient'
                  : 'No patient admitted'}
              </div>
              {patients.length > 0 ? (
                <div className="kpi-grid">
                  {kpiCards.map((kpi) => (
                    <div key={kpi.label} className="kpi-item">
                      <div style={{ color: '#64748B', fontSize: 11, fontWeight: 700 }}>{kpi.label}</div>
                      <div style={{ color: '#1B2559', fontWeight: 800, fontSize: 18, marginTop: 4 }}>{kpi.value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-dashboard-card" style={{ minHeight: 300 }}>No patient admitted</div>
              )}
              {isSupabaseConfigured() && supabaseReadError && (
                <div style={{ color: '#ef4444', fontSize: 11, fontWeight: 700, marginTop: 10 }}>
                  {String(supabaseReadError).slice(0, 100)}
                </div>
              )}
            </div>
          </div>  

          <div className="panel-card" style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div className="panel-title" style={{ marginBottom: 0 }}>
                <Calendar size={16} color="#F54E25" /> Visitation Appointment
              </div>
              <span className="status-chip" style={{ background: '#EEF2FF', color: '#3730A3' }}>
                Fixed schedule: {visitationSettings.days.join(', ')} · {visitationSettings.startTime} - {visitationSettings.endTime}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <select
                value={visitationForm.patientId}
                onChange={(e) => {
                  const selected = patients.find((p) => String(p.id) === String(e.target.value));
                  setVisitationForm((prev) => ({
                    ...prev,
                    patientId: e.target.value,
                    patientName: selected?.name || '',
                  }));
                }}
                style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '9px 10px', fontSize: 12 }}
              >
                <option value="">Select patient</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <input
                type="date"
                value={visitationForm.preferredDate}
                onChange={(e) => setVisitationForm((prev) => ({ ...prev, preferredDate: e.target.value }))}
                style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '9px 10px', fontSize: 12 }}
              />
              <input
                type="time"
                value={visitationForm.preferredTime}
                onChange={(e) => setVisitationForm((prev) => ({ ...prev, preferredTime: e.target.value }))}
                style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '9px 10px', fontSize: 12 }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
              <input
                type="text"
                value={visitationForm.note}
                onChange={(e) => setVisitationForm((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="Note (optional): preferred reason or constraints"
                style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '9px 10px', fontSize: 12 }}
              />
              <button
                type="button"
                onClick={submitVisitationRequest}
                disabled={visitationSaving}
                style={{ border: 'none', background: '#F54E25', color: 'white', borderRadius: 8, padding: '9px 12px', fontSize: 12, fontWeight: 700, cursor: visitationSaving ? 'not-allowed' : 'pointer' }}
              >
                {visitationSaving ? 'Submitting...' : 'Request slot'}
              </button>
            </div>
            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              {familyVisitationRequests.slice(0, 4).map((row) => (
                <div key={row.id} className="interactive-row">
                  <div>
                    <div style={{ fontSize: 13, color: '#1E293B', fontWeight: 700 }}>
                      {row.patientName} · {row.preferredDate} {row.preferredTime}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>
                      {row.status === 'Approved' || row.status === 'Rescheduled'
                        ? `Confirmed: ${row.confirmedDate || row.preferredDate} ${row.confirmedTime || row.preferredTime}`
                        : 'Waiting for admin confirmation'}
                    </div>
                  </div>
                  <span
                    className="status-chip"
                    style={{
                      background: row.status === 'Approved' ? '#DCFCE7' : row.status === 'Declined' ? '#FEE2E2' : row.status === 'Rescheduled' ? '#E0E7FF' : '#FEF3C7',
                      color: row.status === 'Approved' ? '#166534' : row.status === 'Declined' ? '#991B1B' : row.status === 'Rescheduled' ? '#3730A3' : '#92400E',
                    }}
                  >
                    {row.status}
                  </span>
                </div>
              ))}
              {familyVisitationRequests.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: 12 }}>No visitation requests yet.</div>
              ) : null}
            </div>
          </div>

          {showAnnouncement && (
            <div className="panel-card" style={{ borderColor: '#FED7AA', background: '#FFF7ED' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ color: '#9A3412', fontWeight: 800, marginBottom: 4 }}>Community Update: Family Wellness Talk</div>
                  <div style={{ color: '#7C2D12', fontSize: 13 }}>
                    Join the monthly support session on April 9 to learn practical family recovery support strategies.
                  </div>
                </div>
                <button onClick={() => setShowAnnouncement(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9A3412' }}>
                  <X size={18} />
                </button>
              </div>
            </div>
          )}

          <div className="bottom-layout">
            <div className="patient-section">
              <h3 style={{ color: '#1B2559', fontWeight: 800, marginBottom: 16, fontSize: '1.25rem' }}>Patient Details</h3>
              {patients.map((p, i) => (
                <div key={p.id} className="patient-card">
                  <div className="patient-img-placeholder" onClick={() => triggerFileInput(i)}>
                    <input type="file" hidden accept="image/*" ref={el => fileInputRefs.current[i] = el} onChange={(e) => handleImageChange(i, e)} />
                    {patientImages[i] ? <img src={patientImages[i]} alt="" className="patient-attached-img" /> : <User size={24} color="#A3AED0" opacity={0.5} />}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 5 }}>
                      <span style={{ fontWeight: 800, fontSize: '1.2rem', color: '#1B2559' }}>{p.name}</span>
                      <span style={{ background: '#FFF9C4', color: '#856404', fontSize: '0.7rem', padding: '4px 12px', borderRadius: 20, fontWeight: 700 }}>Recovering</span>
                    </div>
                    <div style={{ color: '#1B2559', fontSize: '0.9rem', fontWeight: 600 }}>{p.date}</div>
                    <div style={{ color: '#A3AED0', fontSize: '0.7rem' }}>Date of Admission</div>
                  </div>
                  <div className="desktop-only patient-progress">
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, marginBottom: 8 }}>
                      <span style={{ color: '#A3AED0' }}>Recovery Progress</span>
                      <span style={{ color: '#1B2559' }}>{p.progress}%</span>
                    </div>
                    <div style={{ height: 8, background: '#F4F7FE', borderRadius: 10 }}><div style={{ width: `${p.progress}%`, height: '100%', background: '#4318FF', borderRadius: 10 }}></div></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="dashboard-panels">
              <div className="dashboard-panels-col">
                <div className="panel-card" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div className="panel-title" style={{ marginBottom: 0 }}><Clock3 size={16} color="#F54E25" /> Recent Activity</div>
                    {activityFeed.length > 3 && (
                      <button
                        type="button"
                        onClick={() => setShowAllActivity(!showAllActivity)}
                        style={{ border: 'none', background: '#EEF2FF', color: '#3730A3', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                      >
                        {showAllActivity ? 'Show Less' : 'View All'}
                      </button>
                    )}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    {activityFeed.length === 0 ? (
                      <div
                        style={{
                          color: '#94a3b8',
                          fontSize: 13,
                          lineHeight: 1.5,
                          padding: '8px 0 4px',
                        }}
                      >
                        No activity yet. Admission requests, discharge requests, admin decisions, and care team
                        reports will appear here as they happen.
                      </div>
                    ) : (
                      (showAllActivity ? activityFeed : activityFeed.slice(0, 3)).map((item) => (
                        <div key={item.id} className="interactive-row">
                          <div
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: '#F54E25',
                              marginTop: 6,
                              flexShrink: 0,
                            }}
                          />
                          <div>
                            <div style={{ color: '#64748B', fontSize: 11, fontWeight: 700 }}>
                              {activityDayLabel(item.at)}
                            </div>
                            <div style={{ fontSize: 13 }}>{item.text}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div className="dashboard-panels-col">
                <div className="panel-card" style={{ marginBottom: 0 }}>
                  <div className="panel-title"><Calendar size={16} color="#F54E25" /> Calendar & Reminders</div>
                  {reminderItems.map((item) => (
                    <button
                      type="button"
                      key={item}
                      className={`reminder-btn ${completedReminders.includes(item) ? 'completed' : ''}`}
                      onClick={() => toggleReminder(item)}
                    >
                      <span>{item}</span>
                      {completedReminders.includes(item) ? <CheckCircle2 size={16} /> : <Clock3 size={16} color="#94A3B8" />}
                    </button>
                  ))}
                </div>
                <div className="panel-card" style={{ marginBottom: 0 }}>
                  <div className="panel-title"><FileText size={16} color="#F54E25" /> Request Status</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ color: '#334155', fontSize: 13 }}>Admission Request</span>
                    <span className="status-chip" style={{ background: '#FEF3C7', color: '#92400E' }}>In Review</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ color: '#334155', fontSize: 13 }}>Medical Requirements</span>
                    <span className="status-chip" style={{ background: '#FEE2E2', color: '#991B1B' }}>Needs Action</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#334155', fontSize: 13 }}>Weekly Report</span>
                    <span className="status-chip" style={{ background: '#DCFCE7', color: '#166534' }}>Approved</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>

        <div className="mobile-only mobile-bottom-nav">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }} onClick={() => navigate('/home')}>
            <Home size={24} color="#F54E25" />
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#F54E25' }}>Home</span>
          </div>
          <TrendingUp size={24} color="#A3AED0" onClick={() => navigate('/progress')} />
          <Calendar size={24} color="#A3AED0" onClick={() => navigate('/appointments')} />
          <User size={24} color="#A3AED0" onClick={() => navigate('/profile')} />
          <LogOut size={24} color="#F54E25" onClick={() => navigate('/login')} />
        </div>
      </div>

      {isChatOpen && !showReport && (
        <div className="chat-window">
          <div className="chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, background: '#F54E25', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageCircle size={20} color="white" />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#1B2559' }}>Support AI</div>
                <div style={{ fontSize: '11px', color: '#22C55E', fontWeight: 600 }}>Active now</div>
              </div>
            </div>
            <X size={20} color="#A3AED0" style={{ cursor: 'pointer' }} onClick={() => setIsChatOpen(false)} />
          </div>

          <div className="chat-body" ref={chatBodyRef}>
            {messages.map(msg => (
              <div key={msg.id} className={`msg-bubble ${msg.sender === 'bot' ? 'msg-received' : 'msg-sent'}`}>
                {msg.text}
                <div style={{ fontSize: '9px', marginTop: 6, opacity: 0.6, textAlign: msg.sender === 'bot' ? 'left' : 'right' }}>{msg.time}</div>
              </div>
            ))}
            {isTyping && (
              <div className="typing-indicator">
                <div className="dot"></div><div className="dot"></div><div className="dot"></div>
              </div>
            )}
          </div>

          <div style={{ padding: '15px 20px', background: 'white', display: 'flex', gap: 12, alignItems: 'center', borderTop: '1px solid #F1F1F1' }}>
            <input
              style={{ flex: 1, border: 'none', background: '#F4F7FE', borderRadius: '15px', padding: '12px 18px', outline: 'none', fontSize: '13px', color: '#1B2559' }}
              placeholder="Type your message..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isTyping}
              style={{ background: inputValue.trim() ? '#F54E25' : '#E9EDF7', width: 40, height: 40, borderRadius: '12px', border: 'none', cursor: 'pointer' }}
            >
              <Send size={18} color="white" />
            </button>
          </div>
        </div>
      )}

      {!showReport && (
        <div
          onClick={() => setIsChatOpen(!isChatOpen)}
          style={{ position: 'fixed', bottom: window.innerWidth < 768 ? 90 : 30, right: 20, width: 60, height: 60, background: '#F54E25', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 10px 25px rgba(245,78,37,0.4)', zIndex: 1000, cursor: 'pointer' }}
        >
          {isChatOpen ? <X size={28} /> : <MessageCircle size={28} />}
        </div>
      )}
    </div>
  );
};

export default HomeDashboard;