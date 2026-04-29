import React, { useState, useRef, useEffect } from 'react';
import { Home, TrendingUp, User, LogOut, MessageCircle, X, Send, FileText, Bell, Calendar, CheckCircle2, Clock3, ChevronDown, ClipboardList, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  fetchActivityFeedForCurrentUser,
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

import logo from '@/assets/kalingalogo.png';
import servicesIcon from '@/assets/services.png';

const HomeDashboard = () => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [weeklyReportExpandedPatientId, setWeeklyReportExpandedPatientId] = useState(null);
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
    'Community Update: Join the monthly Family Wellness Talk on April 9 to learn practical family recovery support strategies.',
  ];
  const [activityFeed, setActivityFeed] = useState([]);
  const [supabaseReadError, setSupabaseReadError] = useState(null);

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
  const [pendingAdmissions, setPendingAdmissions] = useState([]);
  const [pendingDischarges, setPendingDischarges] = useState([]);
  const [nurseWeeklyReportsByPatient, setNurseWeeklyReportsByPatient] = useState({});
  const [averageStayDays, setAverageStayDays] = useState(0);

  const computeStayDays = (admittedAt, dischargedAt) => {
    const a = new Date(admittedAt || 0).getTime();
    if (!a || Number.isNaN(a)) return 0;
    const d = dischargedAt ? new Date(dischargedAt).getTime() : Date.now();
    if (!d || Number.isNaN(d)) return 0;
    if (d < a) return 1;
    return Math.max(1, Math.ceil((d - a) / (24 * 60 * 60 * 1000)));
  };

  const computeAverageStayDays = (list) => {
    const stays = (list || [])
      .map((p) => computeStayDays(p.admitted_at || p.admissionDate || p.admittedAt, p.discharged_at || p.dischargedAt))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!stays.length) return 0;
    return Math.round(stays.reduce((sum, n) => sum + n, 0) / stays.length);
  };

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
        const parsed = saved ? JSON.parse(saved) : defaultDemoPatients;
        setPatients(parsed);
        setAverageStayDays(computeAverageStayDays(parsed));
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
      const { data: allFamilyRows } = await supabase
        .from('patients')
        .select('admitted_at, discharged_at')
        .eq('family_id', user.id);

      if (cancelled) return;
      if (pErr) {
        console.warn('[home patients]', pErr.message);
        setPatients([]);
      } else {
        setPatients((pRows || []).map((r) => uiPatientFromRow(r)).filter(Boolean));
      }
      setAverageStayDays(computeAverageStayDays(allFamilyRows || []));

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

  const patientCardInitials = (name) =>
    name
      ? String(name)
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0].toUpperCase())
          .join('')
      : '?';
  const firstName =
    String(displayName || 'Family User')
      .trim()
      .split(/\s+/)
      .filter(Boolean)[0] || 'Family';

  const totalPendingRequests = pendingAdmissions.length + pendingDischarges.length;
  const reportsReceivedCount = Object.values(nurseWeeklyReportsByPatient || {}).reduce(
    (count, patientWeeks) => count + Object.keys(patientWeeks || {}).length,
    0
  );
  const summaryGraphData = [
    { label: 'Patients', value: patients.length, color: '#F54E25' },
    { label: 'Admissions', value: pendingAdmissions.length, color: '#EA580C' },
    { label: 'Discharges', value: pendingDischarges.length, color: '#2B31ED' },
    {
      label: 'Avg Progress',
      value: patients.length
        ? Math.round(patients.reduce((sum, p) => sum + (Number(p.progress) || 0), 0) / patients.length)
        : 0,
      color: '#16A34A',
    },
    { label: 'Reports', value: reportsReceivedCount, color: '#7C3AED' },
    { label: 'Avg Stay', value: averageStayDays, color: '#0369A1' },
  ];
  const summaryGraphMax = Math.max(5, ...summaryGraphData.map((d) => Number(d.value) || 0));
  const averageProgress = patients.length
    ? Math.round(patients.reduce((sum, p) => sum + (Number(p.progress) || 0), 0) / patients.length)
    : 0;
  const reportCoverageRate = patients.length
    ? Math.min(100, Math.round((reportsReceivedCount / Math.max(1, patients.length * 7)) * 100))
    : 0;
  const metricInsights = [
    {
      label: 'Care Load',
      value: totalPendingRequests,
      note: totalPendingRequests > 5 ? 'High queue' : totalPendingRequests > 0 ? 'Manageable queue' : 'No pending requests',
      color: '#F59E0B',
    },
    {
      label: 'Avg Recovery Progress',
      value: `${averageProgress}%`,
      note: averageProgress >= 70 ? 'Strong recovery trend' : averageProgress >= 40 ? 'Steady recovery' : 'Needs support focus',
      color: '#16A34A',
    },
    {
      label: 'Report Coverage',
      value: `${reportCoverageRate}%`,
      note: 'Submitted nurse reports versus expected weekly slots',
      color: '#7C3AED',
    },
    {
      label: 'Admission Pressure',
      value: pendingAdmissions.length,
      note: pendingAdmissions.length ? 'Follow up with admin review' : 'No pending admissions',
      color: '#EA580C',
    },
    {
      label: 'Average Days Stayed',
      value: averageStayDays,
      note: 'Includes active and discharged stays',
      color: '#0369A1',
    },
  ];
  const patientTableRows = (patients || []).slice(0, 5);
  const resolveRequestPatientName = (row) => {
    const directName = row?.patientName || row?.patient_name || row?.patient || '';
    if (directName && String(directName).trim() && String(directName).trim().toLowerCase() !== 'patient') {
      return directName;
    }
    const match = (patients || []).find((p) => String(p?.id || '') === String(row?.id || row?.patientId || row?.patient_id || ''));
    return match?.name || 'Unknown';
  };
  const requestTableRows = [
    ...pendingAdmissions.map((row) => ({
      type: 'Admission',
      name: resolveRequestPatientName(row),
      status: row?.status || 'Pending',
      date: row?.createdAt || row?.created_at || '',
    })),
    ...pendingDischarges.map((row) => ({
      type: 'Discharge',
      name: resolveRequestPatientName(row),
      status: row?.status || 'Pending',
      date: row?.createdAt || row?.created_at || '',
    })),
  ].slice(0, 6);
  const patientReportCount = (patientId) => Object.keys(nurseWeeklyReportsByPatient[String(patientId)] || {}).length;
  const patientStatus = (progress) => {
    const p = Number(progress) || 0;
    if (p >= 70) return { label: 'Stable', color: '#166534', bg: '#DCFCE7' };
    if (p >= 40) return { label: 'Recovering', color: '#92400E', bg: '#FEF3C7' };
    return { label: 'Needs Attention', color: '#991B1B', bg: '#FEE2E2' };
  };

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

  const handleNotificationToggle = () => {
    setShowNotifications((v) => !v);
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

        .dashboard-stack {
          display: grid;
          gap: 16px;
        }

        .dashboard-stack > .panel-card,
        .dashboard-stack > .dashboard-insights,
        .dashboard-stack > .bottom-layout {
          margin: 0;
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

        .patient-carousel-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }

        .patient-carousel-btn {
          border: 1px solid #E2E8F0;
          background: #fff;
          color: #1B2559;
          border-radius: 10px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
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
          gap: 16px;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }

        .dashboard-insights {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 16px;
          align-items: stretch;
        }

        .chart-card {
          height: 100%;
          background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
          border: 1px solid #E4EAF6;
          border-radius: 18px;
          padding: 20px;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.06);
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

        .insights-split {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          align-items: stretch;
        }

        .insight-panel {
          min-width: 0;
          border: 1px solid #E9EDF7;
          border-radius: 14px;
          background: #fff;
          padding: 14px;
        }

        .stat-svg {
          width: 100%;
          height: 280px;
          display: block;
          border-radius: 12px;
          background: linear-gradient(180deg, #fff7ed 0%, #ffffff 70%);
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-top: 12px;
          flex: 1;
          align-content: stretch;
        }

        .kpi-item {
          border: 1px solid #E9EDF7;
          border-radius: 12px;
          padding: 16px 14px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          min-height: 130px;
        }
        .kpi-note {
          margin-top: 6px;
          color: #64748B;
          font-size: 11px;
          line-height: 1.35;
          font-weight: 600;
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

        .dashboard-overview-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-top: 4px;
        }

        .overview-item {
          border: 1px solid #E9EDF7;
          border-radius: 14px;
          background: #fff;
          padding: 14px 16px;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.03);
          min-height: 95px;
        }

        .overview-label {
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.02em;
          margin-bottom: 8px;
          text-transform: uppercase;
        }

        .overview-value {
          color: #1B2559;
          font-size: 1.4rem;
          font-weight: 800;
          line-height: 1.1;
        }

        .overview-subtext {
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
          margin-top: 6px;
        }

        .dashboard-bottom-grid {
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: 16px;
        }

        .clean-list {
          display: grid;
          gap: 10px;
          margin-top: 10px;
        }

        .clean-list-item {
          border: 1px solid #E9EDF7;
          border-radius: 12px;
          background: #FCFDFF;
          padding: 12px 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .mini-pill {
          font-size: 11px;
          font-weight: 700;
          border-radius: 999px;
          padding: 4px 10px;
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
          min-height: 196px;
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
        .action-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 26px rgba(15, 23, 42, 0.08);
          border-color: #d9e3f5;
        }
        .action-main {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          text-align: center;
        }
        .action-title {
          font-size: 0.92rem;
          font-weight: 800;
          color: #1B2559;
          letter-spacing: 0.01em;
        }
        .action-subtitle {
          font-size: 12px;
          color: #64748B;
          font-weight: 600;
          line-height: 1.25;
          max-width: 240px;
        }
        .action-badge {
          margin-top: 4px;
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 5px 11px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.02em;
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

        .icon-square svg {
          width: 30px;
          height: 30px;
          stroke: #fff;
          stroke-width: 2.2;
        }

        .summary-bars {
          margin-top: 10px;
          padding: 14px;
          background: #F8FAFE;
          border: 1px solid #E6EDF9;
          border-radius: 12px;
        }
        .summary-vertical-chart {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
          align-items: end;
          min-height: 230px;
        }
        .summary-bar-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .summary-bar-stage {
          width: 100%;
          max-width: 72px;
          height: 160px;
          background: linear-gradient(180deg, #f3f6fd 0%, #e9eff8 100%);
          border-radius: 12px;
          border: 1px solid #e2eaf7;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: 8px;
        }
        .summary-bar-fill {
          width: 100%;
          border-radius: 8px;
          min-height: 8px;
          box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.2);
        }
        .summary-bar-label-wrap {
          min-height: 2.6em;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
        }
        .summary-bar-label {
          color: #334155;
          font-size: 11px;
          font-weight: 800;
          text-align: center;
          line-height: 1.25;
          width: 100%;
        }
        .summary-bar-value {
          color: #0F172A;
          font-size: 16px;
          font-weight: 900;
          line-height: 1;
        }

        .summary-callout {
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          background: #EEF4FF;
          border: 1px solid #DCE7FF;
          color: #334155;
          font-size: 12px;
          font-weight: 600;
        }
        .tables-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
          margin-top: 18px;
        }
        .table-card {
          background: #fff;
          border: 1px solid #E6EDF9;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);
        }
        .table-head {
          padding: 14px 16px;
          border-bottom: 1px solid #EEF3FB;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .table-scroll {
          overflow-x: auto;
        }
        .dashboard-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .dashboard-table th {
          text-align: left;
          color: #64748B;
          font-weight: 800;
          background: #F8FAFE;
          padding: 12px 14px;
          border-bottom: 1px solid #EEF3FB;
        }
        .dashboard-table td {
          padding: 12px 14px;
          color: #1E293B;
          border-bottom: 1px solid #F3F6FC;
          font-weight: 600;
        }
        .dashboard-table tr:last-child td {
          border-bottom: none;
        }
        .table-patient-wrap {
          display: flex;
          flex-direction: column;
          gap: 5px;
          min-width: 0;
        }
        .table-patient-name {
          color: #0F172A;
          font-weight: 800;
          font-size: 12px;
        }
        .table-progress-wrap {
          display: grid;
          gap: 6px;
          min-width: 120px;
        }
        .table-progress-track {
          height: 7px;
          border-radius: 999px;
          background: #EAF0FA;
          overflow: hidden;
        }
        .table-progress-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #F54E25 0%, #EA580C 100%);
        }
        .table-mini-text {
          color: #64748B;
          font-size: 10px;
          font-weight: 700;
        }
        .patient-status-pill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 3px 8px;
          font-size: 10px;
          font-weight: 800;
        }
        .table-status-pill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 3px 8px;
          font-size: 10px;
          font-weight: 800;
          text-transform: capitalize;
          background: #FEF3C7;
          color: #92400E;
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
          .dashboard-overview-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .dashboard-bottom-grid { grid-template-columns: 1fr !important; }
          .tables-grid { grid-template-columns: 1fr !important; }
          .summary-vertical-chart { grid-template-columns: repeat(5, minmax(58px, 1fr)) !important; }
          .action-section { order: -1; margin-bottom: 20px; } 
          .patient-section { order: 1; }
          .patient-card { width: 100% !important; height: auto !important; padding: 15px !important; margin-bottom: 10px !important; flex-direction: row !important; }
          .patient-img-placeholder { width: 50px !important; height: 50px !important; margin-right: 15px !important; }
          .insights-split { grid-template-columns: 1fr !important; }
          .mobile-action-grid { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 10px !important; }
          .action-grid-desktop { grid-template-columns: repeat(3, 1fr) !important; }
          .mobile-action-grid .action-card { width: 100% !important; height: 122px !important; border-radius: 15px !important; }
          .mobile-action-grid .icon-square { width: 40px !important; height: 40px !important; margin-bottom: 5px !important; }
          .mobile-action-grid .icon-square svg { width: 20px !important; height: 20px !important; }
          .mobile-action-grid span { font-size: 10px !important; }
          .action-subtitle, .action-badge { display: none !important; }
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
          <img src={logo} alt="Kalinga" className="sidebar-logo" />
        </div>
        <div className="sidebar-primary">
          <div className="sidebar-nav-item sidebar-nav-active" onClick={(e) => { e.stopPropagation(); navigate('/home'); }}>
            <div className="sidebar-icon-wrap">
              <Home size={22} color="#707EAE" />
            </div>
            <span className="sidebar-label">Dashboard</span>
          </div>

          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/patient-details'); }}>
            <div className="sidebar-icon-wrap">
              <ClipboardList size={22} color="#707EAE" />
            </div>
            <span className="sidebar-label">Patient Details</span>
          </div>

          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/progress'); }}>
            <div className="sidebar-icon-wrap">
              <TrendingUp size={22} color="#707EAE" />
            </div>
            <span className="sidebar-label">Request Management</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/appointments'); }}>
            <div className="sidebar-icon-wrap">
              <Calendar size={22} color="#707EAE" />
            </div>
            <span className="sidebar-label">Appointments</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/reports'); }}>
            <div className="sidebar-icon-wrap">
              <BarChart3 size={22} color="#707EAE" />
            </div>
            <span className="sidebar-label">Reports</span>
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
          <img src={logo} alt="Kalinga" style={{ width: 50 }} />
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
          <div className="dashboard-stack">
          <div>
            <div style={{ color: '#64748B', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Welcome back</div>
            <div className="recovery-text-mobile" style={{ color: '#1B2559', fontWeight: 800, fontSize: 22, lineHeight: 1.25 }}>
              {displayName}
            </div>
          </div>
          <div className="panel-card">
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
                <div className="icon-square"><FileText aria-hidden /></div>
                <div className="action-main">
                  <span className="action-title">Weekly Report</span>
                  <span className="action-subtitle">Review submitted weekly care updates</span>
                  <span className="action-badge" style={{ background: '#FFF1EB', color: '#C2410C' }}>{reportsReceivedCount} received</span>
                </div>
              </div>
              <div className="action-card" onClick={() => navigate('/progress', { state: { tab: 'admission' } })}>
                <div className="icon-square"><ClipboardList aria-hidden /></div>
                <div className="action-main">
                  <span className="action-title">Admission</span>
                  <span className="action-subtitle">Submit new admission request forms</span>
                  <span className="action-badge" style={{ background: '#FEF3C7', color: '#92400E' }}>{pendingAdmissions.length} pending</span>
                </div>
              </div>
              <div className="action-card" onClick={() => navigate('/services')}>
                <div className="icon-square">
                  <img src={servicesIcon} alt="Services" style={{ width: 28, height: 28, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
                </div>
                <div className="action-main">
                  <span className="action-title">Services</span>
                  <span className="action-subtitle">Open billing, inclusions, and support details</span>
                  <span className="action-badge" style={{ background: '#EEF2FF', color: '#3730A3' }}>Care resources</span>
                </div>
              </div>
            </div>
          </div>

          <div className="dashboard-insights">
            <div className="chart-card">
              <div className="chart-top">
                <div>
                  <div style={{ color: '#1B2559', fontWeight: 800, fontSize: 16 }}>
                    Dashboard Summary
                  </div>
                  <div style={{ color: '#64748B', fontSize: 12 }}>
                    Clear overview of patient, request, and report data
                  </div>
                </div>
                <div style={{ color: '#64748B', fontSize: 12, fontWeight: 700 }}>
                  Updated from live dashboard data
                </div>
              </div>
              <div className="insights-split">
                <div className="insight-panel">
                  <div style={{ color: '#1B2559', fontWeight: 800, fontSize: 14, marginBottom: 8 }}>Graph View</div>
                  <div className="summary-bars">
                    <div className="summary-vertical-chart">
                      {summaryGraphData.map((item) => (
                        <div className="summary-bar-item" key={item.label}>
                          <div className="summary-bar-value">{item.value}</div>
                          <div className="summary-bar-stage">
                            <div
                              className="summary-bar-fill"
                              style={{
                                height: `${Math.max(8, Math.round(((Number(item.value) || 0) / summaryGraphMax) * 100))}%`,
                                background: item.color,
                              }}
                            />
                          </div>
                          <div className="summary-bar-label-wrap">
                            <div className="summary-bar-label">{item.label}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="summary-callout">
                    Highest metric right now: <strong>{summaryGraphData.reduce((max, item) => (item.value > max.value ? item : max), summaryGraphData[0]).label}</strong>
                  </div>
                </div>
                <div className="insight-panel">
                  <div style={{ color: '#1B2559', fontWeight: 800, fontSize: 14, marginBottom: 8 }}>Operational Insights</div>
                  <div className="kpi-grid">
                    {metricInsights.map((item) => (
                      <div key={item.label} className="kpi-item">
                        <div style={{ color: '#64748B', fontSize: 11, fontWeight: 700 }}>{item.label}</div>
                        <div style={{ color: '#1B2559', fontWeight: 800, fontSize: 22, marginTop: 6 }}>{item.value}</div>
                        <div style={{ marginTop: 8, width: 26, height: 6, borderRadius: 99, background: item.color }} />
                        <div className="kpi-note">{item.note}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="tables-grid">
                <div className="table-card">
                  <div className="table-head">
                    <div className="panel-title" style={{ marginBottom: 0 }}><User size={16} color="#F54E25" /> Patient Snapshot</div>
                    <span style={{ color: '#64748B', fontSize: 11, fontWeight: 700 }}>{patients.length} total</span>
                  </div>
                  <div className="table-scroll">
                    <table className="dashboard-table">
                      <thead>
                        <tr>
                          <th>Patient</th>
                          <th>Admission</th>
                          <th>Progress</th>
                          <th>Status</th>
                          <th>Reports</th>
                        </tr>
                      </thead>
                      <tbody>
                        {patientTableRows.length ? patientTableRows.map((p) => {
                          const pProgress = Number(p.progress) || 0;
                          const status = patientStatus(pProgress);
                          return (
                          <tr key={p.id}>
                            <td>
                              <div className="table-patient-wrap">
                                <span className="table-patient-name">{p.name}</span>
                                <span className="table-mini-text">ID: {String(p.id).slice(0, 8)}</span>
                              </div>
                            </td>
                            <td>{p.date || 'N/A'}</td>
                            <td>
                              <div className="table-progress-wrap">
                                <div style={{ fontSize: 11, fontWeight: 800, color: '#1B2559' }}>{pProgress}%</div>
                                <div className="table-progress-track">
                                  <div className="table-progress-fill" style={{ width: `${pProgress}%` }} />
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="patient-status-pill" style={{ background: status.bg, color: status.color }}>
                                {status.label}
                              </span>
                            </td>
                            <td>{patientReportCount(p.id)}/7</td>
                          </tr>
                        )}) : (
                          <tr>
                            <td colSpan={5} style={{ color: '#94A3B8' }}>No patient records yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="table-card">
                  <div className="table-head">
                    <div className="panel-title" style={{ marginBottom: 0 }}><ClipboardList size={16} color="#F54E25" /> Request Tracker</div>
                    <span style={{ color: '#64748B', fontSize: 11, fontWeight: 700 }}>{totalPendingRequests} pending</span>
                  </div>
                  <div className="table-scroll">
                    <table className="dashboard-table">
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Patient</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {requestTableRows.length ? requestTableRows.map((r, idx) => (
                          <tr key={`${r.type}-${r.name}-${idx}`}>
                            <td>{r.type}</td>
                            <td>{r.name}</td>
                            <td><span className="table-status-pill">{String(r.status || 'pending').toLowerCase()}</span></td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={3} style={{ color: '#94A3B8' }}>No pending requests.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              {isSupabaseConfigured() && supabaseReadError && (
                <div style={{ color: '#ef4444', fontSize: 11, fontWeight: 700, marginTop: 10 }}>
                  {String(supabaseReadError).slice(0, 100)}
                </div>
              )}
            </div>
          </div>  

          <div className="bottom-layout">
            <div className="panel-card" style={{ marginBottom: 0 }}>
              <div className="panel-title" style={{ marginBottom: 12 }}>
                <BarChart3 size={16} color="#F54E25" /> Dashboard Highlights
              </div>
              <div className="dashboard-overview-grid">
                <div className="overview-item">
                  <div className="overview-label">Active Patients</div>
                  <div className="overview-value">{patients.length}</div>
                  <div className="overview-subtext">Currently under care</div>
                </div>
                <div className="overview-item">
                  <div className="overview-label">Pending Requests</div>
                  <div className="overview-value">{totalPendingRequests}</div>
                  <div className="overview-subtext">Admissions and discharges</div>
                </div>
                <div className="overview-item">
                  <div className="overview-label">Average Progress</div>
                  <div className="overview-value">
                    {patients.length
                      ? `${Math.round(
                          patients.reduce((sum, p) => sum + (Number(p.progress) || 0), 0) / patients.length
                        )}%`
                      : '0%'}
                  </div>
                  <div className="overview-subtext">Across all assigned patients</div>
                </div>
                <div className="overview-item">
                  <div className="overview-label">Reports Received</div>
                  <div className="overview-value">{reportsReceivedCount}</div>
                  <div className="overview-subtext">Weekly reports submitted by nurse</div>
                </div>
              </div>
            </div>

            <div className="dashboard-bottom-grid">
              <div className="panel-card" style={{ marginBottom: 0 }}>
                <div className="panel-title" style={{ marginBottom: 8 }}>
                  <Calendar size={16} color="#F54E25" /> Next Steps
                </div>
                <div style={{ color: '#64748B', fontSize: 13, marginBottom: 8 }}>
                  Suggested actions to keep care coordination on track.
                </div>
                <div className="clean-list">
                  <div className="clean-list-item">
                    <div>
                      <div style={{ color: '#1B2559', fontWeight: 700, fontSize: 13 }}>Review request management queue</div>
                      <div style={{ color: '#64748B', fontSize: 12 }}>Check admission/discharge updates from staff</div>
                    </div>
                    <span className="mini-pill" style={{ background: '#FEF3C7', color: '#92400E' }}>
                      {totalPendingRequests || 0} pending
                    </span>
                  </div>
                  <div className="clean-list-item">
                    <div>
                      <div style={{ color: '#1B2559', fontWeight: 700, fontSize: 13 }}>Open patient details tab</div>
                      <div style={{ color: '#64748B', fontSize: 12 }}>View status and progress of all patients</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/patient-details')}
                      style={{ border: 'none', borderRadius: 8, background: '#EEF2FF', color: '#3730A3', padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Open
                    </button>
                  </div>
                  <div className="clean-list-item">
                    <div>
                      <div style={{ color: '#1B2559', fontWeight: 700, fontSize: 13 }}>Check appointment slots</div>
                      <div style={{ color: '#64748B', fontSize: 12 }}>Plan follow-ups and visit schedules</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/appointments')}
                      style={{ border: 'none', borderRadius: 8, background: '#ECFDF3', color: '#065F46', padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                    >
                      View
                    </button>
                  </div>
                </div>
              </div>

              <div className="panel-card" style={{ marginBottom: 0 }}>
                <div className="panel-title" style={{ marginBottom: 8 }}>
                  <FileText size={16} color="#F54E25" /> Care Resources
                </div>
                <div className="clean-list">
                  <div className="clean-list-item">
                    <div style={{ color: '#1B2559', fontWeight: 700, fontSize: 13 }}>View Weekly Reports</div>
                    <button
                      type="button"
                      onClick={() => {
                        setWeeklyReportExpandedPatientId(null);
                        setShowReport(true);
                      }}
                      style={{ border: 'none', borderRadius: 8, background: '#FFF1EB', color: '#C2410C', padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Open
                    </button>
                  </div>
                  <div className="clean-list-item">
                    <div style={{ color: '#1B2559', fontWeight: 700, fontSize: 13 }}>Go to Services</div>
                    <button
                      type="button"
                      onClick={() => navigate('/services')}
                      style={{ border: 'none', borderRadius: 8, background: '#EEF2FF', color: '#3730A3', padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Open
                    </button>
                  </div>
                  <div className="clean-list-item">
                    <div style={{ color: '#1B2559', fontWeight: 700, fontSize: 13 }}>Manage Your Profile</div>
                    <button
                      type="button"
                      onClick={() => navigate('/profile')}
                      style={{ border: 'none', borderRadius: 8, background: '#ECFDF3', color: '#065F46', padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Open
                    </button>
                  </div>
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
          <BarChart3 size={24} color="#A3AED0" onClick={() => navigate('/reports')} />
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