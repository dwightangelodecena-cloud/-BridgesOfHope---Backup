import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Home, TrendingUp, User, LogOut, MessageCircle, X, Send, FileText, Bell, Calendar, CheckCircle2, Clock3, ChevronDown, ClipboardList, BookUser, Heart, Activity, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  fetchActivityFeedForCurrentUser,
  ACTIVITY_FEED_UPDATED,
} from '@/lib/activityFeed';
import { APP_DATA_REFRESH, refreshAppData } from '@/lib/appDataRefresh';
import {
  uiPatientFromRow,
  uiAdmissionRequestFromRow,
  uiDischargeRequestFromRow,
} from '@/lib/dbMappers';
import { computeAdmissionDisplayId } from '@/lib/admissionDischargeStore';
import {
  loadVisitationSettings,
  loadFamilyVisitationRequests,
  createVisitationRequest,
  deleteVisitationRequestPermanent,
  normalizeVisitationStatus,
} from '@/lib/visitationAppointments';
import { FAMILY_COLORS } from '@/components/family/shared/ui';
import FamilyFeesInclusionsPanel from '@/components/family/FamilyFeesInclusionsPanel';
import FamilyPageHeader from '@/components/family/FamilyPageHeader';
import { useFamilyPatientProgressRealtime } from '@/hooks/useFamilyPatientProgressRealtime';
import { useFamilyUser } from '@/hooks/useFamilyUser';
import { useSupportChat } from '@/hooks/useSupportChat';

import logo from '@/assets/kalingalogo.png';
import servicesIcon from '@/assets/services.png';

/* ─────────────────────────────────────────
   Mini UI helpers (design-only, no logic)
───────────────────────────────────────── */

function ProgressRing({ pct = 0, size = 44, stroke = 4, color = '#F54E25' }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, pct)) / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F1F5F9" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${filled} ${circ-filled}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x={size/2} y={size/2+1} textAnchor="middle" fontSize="10" fontWeight="800" fill="#0F172A" dominantBaseline="middle">{pct}%</text>
    </svg>
  );
}

function MiniBar({ value, max, color }) {
  const pct = max > 0 ? Math.max(4, Math.round((Math.min(value, max) / max) * 100)) : 0;
  return (
    <div style={{ height: 6, background: '#F1F5F9', borderRadius: 999, overflow: 'hidden', flex: 1 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999 }} />
    </div>
  );
}

function StatusPill({ label, color, bg }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 999,
      fontSize: 10, fontWeight: 800, background: bg, color }}>
      {label}
    </span>
  );
}

const HomeDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const {
    messages,
    loading: chatLoading,
    sending: chatSending,
    isChatOpen,
    setIsChatOpen,
    sendMessage: sendSupportMessage,
    sendError: chatSendError,
  } = useSupportChat();
  const [showReport, setShowReport] = useState(false);
  const [showServicesModal, setShowServicesModal] = useState(false);
  const [weeklyReportExpandedPatientId, setWeeklyReportExpandedPatientId] = useState(null);
  const [weeklyReportDetail, setWeeklyReportDetail] = useState(null);
  const { displayName, userId: familyUserId } = useFamilyUser();
  const [visitationSettings, setVisitationSettings] = useState(() => loadVisitationSettings());
  const [familyVisitationRequests, setFamilyVisitationRequests] = useState([]);
  const [visitationSaving, setVisitationSaving] = useState(false);
  const [requestDeleteBusy, setRequestDeleteBusy] = useState(null);
  const [visitationForm, setVisitationForm] = useState({
    patientId: '', patientName: '', preferredDate: '', preferredTime: '', note: '',
  });

  const [inputValue, setInputValue] = useState('');
  const chatBodyRef = useRef(null);

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTo({ top: chatBodyRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isChatOpen, chatSending]);

  useEffect(() => {
    if (location.state?.openServices) {
      setShowServicesModal(true);
      navigate('/home', { replace: true, state: {} });
    }
  }, [location.state?.openServices, navigate]);

  useEffect(() => {
    if (!familyUserId) return;
    let cancelled = false;
    const loadVisitation = async () => {
      setVisitationSettings(loadVisitationSettings());
      const rows = await loadFamilyVisitationRequests(familyUserId);
      if (!cancelled) setFamilyVisitationRequests(rows);
    };
    void loadVisitation();
    const onRefresh = () => {
      void loadVisitation();
    };
    window.addEventListener('storage', onRefresh);
    window.addEventListener(APP_DATA_REFRESH, onRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener('storage', onRefresh);
      window.removeEventListener(APP_DATA_REFRESH, onRefresh);
    };
  }, [familyUserId]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || chatSending) return;
    const text = inputValue;
    setInputValue('');
    await sendSupportMessage(text);
  };

  const [patientImages, setPatientImages] = useState({});
  const fileInputRefs = useRef([]);
  const [activityFeed, setActivityFeed] = useState([]);
  const [supabaseReadError, setSupabaseReadError] = useState(null);
  useFamilyPatientProgressRealtime();

  const PENDING_ADMISSIONS_KEY = 'bh_pending_admissions';
  const PENDING_DISCHARGES_KEY = 'bh_pending_discharges';
  const NURSE_REPORTS_KEY = 'bh_nurse_weekly_reports';

  const defaultDemoPatients = [
    { id: 0, name: 'John Doe', date: 'January 15, 2026', progress: 65 },
    { id: 1, name: 'Ivan Doe', date: 'January 15, 2026', progress: 65 },
    { id: 2, name: 'Jay Doe', date: 'January 15, 2026', progress: 65 },
  ];

  const parseJsonArray = (raw, fallback = []) => {
    try { const v = JSON.parse(raw || 'null'); return Array.isArray(v) ? v : fallback; } catch { return fallback; }
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
    const stays = (list || []).map((p) => computeStayDays(p.admitted_at || p.admissionDate || p.admittedAt, p.discharged_at || p.dischargedAt)).filter((n) => Number.isFinite(n) && n > 0);
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
      createVisitationRequest({ familyId: familyUserId || 'local-family', familyName: displayName, patientId: visitationForm.patientId || '', patientName, preferredDate, preferredTime, note: String(visitationForm.note || '').trim() });
      setVisitationForm({ patientId: '', patientName: '', preferredDate: '', preferredTime: '', note: '' });
      const rows = await loadFamilyVisitationRequests(familyUserId || 'local-family');
      setFamilyVisitationRequests(rows);
      window.dispatchEvent(new Event('storage'));
    } finally { setVisitationSaving(false); }
  };

  useEffect(() => {
    let cancelled = false;
    const loadLegacy = async () => {
      const saved = localStorage.getItem('bh_patients');
      if (!cancelled) { const parsed = saved ? JSON.parse(saved) : defaultDemoPatients; setPatients(parsed); setAverageStayDays(computeAverageStayDays(parsed)); }
      if (!cancelled) { setPendingAdmissions(parseJsonArray(localStorage.getItem(PENDING_ADMISSIONS_KEY), [])); setPendingDischarges(parseJsonArray(localStorage.getItem(PENDING_DISCHARGES_KEY), [])); }
      try { const raw = localStorage.getItem(NURSE_REPORTS_KEY); if (!cancelled) setNurseWeeklyReportsByPatient(raw ? JSON.parse(raw) : {}); } catch { if (!cancelled) setNurseWeeklyReportsByPatient({}); }
      const feed = await fetchActivityFeedForCurrentUser();
      if (!cancelled) setActivityFeed(feed);
    };
    const loadSupabase = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!cancelled) { setPatients([]); setPendingAdmissions([]); setPendingDischarges([]); setNurseWeeklyReportsByPatient({}); } const feed = await fetchActivityFeedForCurrentUser(); if (!cancelled) setActivityFeed(feed); return; }
      if (!cancelled) setSupabaseReadError(null);
      const { data: pRows, error: pErr } = await supabase
        .from('patients')
        .select(
          'id, full_name, admitted_at, created_at, progress_percent, progress_updated_at, clinical_status, primary_concern, family_id, discharged_at, case_load_manager, program_staff'
        )
        .eq('family_id', user.id)
        .order('admitted_at', { ascending: false });
      const { data: allFamilyRows } = await supabase.from('patients').select('admitted_at, discharged_at').eq('family_id', user.id);
      if (cancelled) return;
      if (pErr) { console.warn('[home patients]', pErr.message); setPatients([]); } else { setPatients((pRows || []).map((r) => uiPatientFromRow(r)).filter(Boolean)); }
      setAverageStayDays(computeAverageStayDays(allFamilyRows || []));
      const [{ data: aRows, error: aErr }, { data: dRows, error: dErr }] = await Promise.all([supabase.from('admission_requests').select('*').eq('family_id', user.id).eq('status', 'pending'), supabase.from('discharge_requests').select('*, patients(full_name)').eq('family_id', user.id).eq('status', 'pending')]);
      if (!cancelled) {
        if (aErr) { console.warn('[home admission_requests]', aErr.message); setSupabaseReadError(aErr.message); }
        if (dErr) { console.warn('[home discharge_requests]', dErr.message); setSupabaseReadError((prev) => prev || dErr.message); }
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
            byPatient[pid][String(row.week_number)] = { submittedAt: row.submitted_at, nurseName: row.nurse_name || '', reportDate: row.report_date || '', summary: row.summary || row.report_summary || '', progressPercent: row.progress_percent, nurseNote: row.nurse_note || row.notes || '', behaviorObservation: row.behavior_observation || '', recommendations: row.recommendations || row.plan_next_week || '', currentMedications: row.current_medications || '', medicationIntervention: row.medication_intervention || '' };
          }
        }
      }
      if (!cancelled) setNurseWeeklyReportsByPatient(byPatient);
      const feed = await fetchActivityFeedForCurrentUser();
      if (!cancelled) setActivityFeed(feed);
    };
    const load = async () => { if (!isSupabaseConfigured()) { await loadLegacy(); return; } await loadSupabase(); };
    load();
    window.addEventListener('storage', load);
    window.addEventListener(APP_DATA_REFRESH, load);
    window.addEventListener(ACTIVITY_FEED_UPDATED, load);
    return () => { cancelled = true; window.removeEventListener('storage', load); window.removeEventListener(APP_DATA_REFRESH, load); window.removeEventListener(ACTIVITY_FEED_UPDATED, load); };
  }, []);

  const formatNurseReportDate = (iso) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return ''; }
  };

  const handleImageChange = (index, event) => {
    const file = event.target.files[0];
    if (file) { const imageUrl = URL.createObjectURL(file); setPatientImages(prev => ({ ...prev, [index]: imageUrl })); }
  };

  const triggerFileInput = (index) => { fileInputRefs.current[index].click(); };

  const patientCardInitials = (name) =>
    name ? String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') : '?';

  const firstName = String(displayName || 'Family User').trim().split(/\s+/).filter(Boolean)[0] || 'Family';

  const pendingAppointmentRequests = (familyVisitationRequests || []).filter((row) => normalizeVisitationStatus(row?.status) === 'Requested');
  const totalPendingRequests = pendingAdmissions.length + pendingDischarges.length + pendingAppointmentRequests.length;
  const reportsReceivedCount = Object.values(nurseWeeklyReportsByPatient || {}).reduce((count, patientWeeks) => count + Object.keys(patientWeeks || {}).length, 0);
  const summaryGraphData = [
    { label: 'Residents', value: patients.length, color: '#F54E25' },
    { label: 'Admissions', value: pendingAdmissions.length, color: '#EA580C' },
    { label: 'Discharges', value: pendingDischarges.length, color: '#6366F1' },
    { label: 'Avg Progress', value: patients.length ? Math.round(patients.reduce((sum, p) => sum + (Number(p.progress) || 0), 0) / patients.length) : 0, color: '#16A34A' },
    { label: 'Reports', value: reportsReceivedCount, color: '#7C3AED' },
    { label: 'Avg Stay', value: averageStayDays, color: '#0369A1' },
  ];
  const summaryGraphMax = Math.max(5, ...summaryGraphData.map((d) => Number(d.value) || 0));
  const averageProgress = patients.length ? Math.round(patients.reduce((sum, p) => sum + (Number(p.progress) || 0), 0) / patients.length) : 0;
  const reportCoverageRate = patients.length ? Math.min(100, Math.round((reportsReceivedCount / Math.max(1, patients.length * 7)) * 100)) : 0;
  const metricInsights = [
    { label: 'Care Load', value: totalPendingRequests, note: totalPendingRequests > 5 ? 'High queue' : totalPendingRequests > 0 ? 'Manageable queue' : 'No pending requests', color: '#F59E0B' },
    { label: 'Avg Recovery', value: `${averageProgress}%`, note: averageProgress >= 70 ? 'Strong recovery trend' : averageProgress >= 40 ? 'Steady recovery' : 'Needs support focus', color: '#16A34A' },
    { label: 'Report Coverage', value: `${reportCoverageRate}%`, note: 'Nurse reports vs expected weekly slots', color: '#7C3AED' },
    { label: 'Admission Pressure', value: pendingAdmissions.length, note: pendingAdmissions.length ? 'Follow up with admin' : 'No pending admissions', color: '#EA580C' },
    { label: 'Avg Stay Days', value: averageStayDays, note: 'Includes active and discharged', color: '#0369A1' },
  ];
  const patientTableRows = patients || [];
  const resolveRequestPatientName = (row) => {
    const directName = row?.patientName || row?.patient_name || row?.patient || '';
    if (directName && String(directName).trim() && String(directName).trim().toLowerCase() !== 'patient') return directName;
    const match = (patients || []).find((p) => String(p?.id || '') === String(row?.id || row?.patientId || row?.patient_id || ''));
    return match?.name || 'Unknown';
  };
  const requestTableRows = [
    ...pendingAdmissions.map((row, idx) => ({
      key: `admission-${row?.requestId || row?.id || idx}`,
      type: 'Admission',
      name: resolveRequestPatientName(row),
      status: row?.status || 'Pending',
      date: row?.createdAt || row?.created_at || '',
      sourceId: row?.requestId || row?.id,
    })),
    ...pendingDischarges.map((row, idx) => ({
      key: `discharge-${row?.dischargeRequestId || row?.requestId || row?.id || idx}`,
      type: 'Discharge',
      name: resolveRequestPatientName(row),
      status: row?.status || 'Pending',
      date: row?.createdAt || row?.created_at || '',
      sourceId: row?.dischargeRequestId || row?.requestId || row?.id,
    })),
    ...familyVisitationRequests.map((row, idx) => ({
      key: `appointment-${row?.id || idx}`,
      type: 'Appointment',
      name: resolveRequestPatientName(row),
      status: normalizeVisitationStatus(row?.status),
      date: row?.createdAt || row?.preferredDate || '',
      sourceId: row?.id,
    })),
  ];

  const removeRequestTrackerRow = async (row) => {
    const key = String(row?.key || '');
    if (!key || requestDeleteBusy) return;
    if (!window.confirm(`Permanently remove this ${row.type} request for ${row.name}?`)) return;
    setRequestDeleteBusy(key);
    try {
      if (key.startsWith('appointment-')) {
        const id = key.slice('appointment-'.length);
        const res = await deleteVisitationRequestPermanent(id);
        if (!res.ok) {
          window.alert(res.errorMessage || 'Could not delete appointment.');
          return;
        }
        setFamilyVisitationRequests((prev) => prev.filter((r) => String(r.id) !== String(id)));
      } else if (key.startsWith('admission-') && isSupabaseConfigured() && familyUserId) {
        const id = key.slice('admission-'.length);
        const { error } = await supabase
          .from('admission_requests')
          .delete()
          .eq('id', id)
          .eq('family_id', familyUserId);
        if (error) {
          window.alert(error.message || 'Could not delete admission request.');
          return;
        }
        setPendingAdmissions((prev) => prev.filter((r) => String(r.requestId || r.id) !== String(id)));
      } else if (key.startsWith('discharge-') && isSupabaseConfigured() && familyUserId) {
        const id = key.slice('discharge-'.length);
        const { error } = await supabase
          .from('discharge_requests')
          .delete()
          .eq('id', id)
          .eq('family_id', familyUserId);
        if (error) {
          window.alert(error.message || 'Could not delete discharge request.');
          return;
        }
        setPendingDischarges((prev) => prev.filter((r) => String(r.dischargeRequestId || r.id) !== String(id)));
      }
      refreshAppData();
    } finally {
      setRequestDeleteBusy(null);
    }
  };

  const patientReportCount = (patientId) => Object.keys(nurseWeeklyReportsByPatient[String(patientId)] || {}).length;
  const patientStatus = (progress) => {
    const p = Number(progress) || 0;
    if (p >= 70) return { label: 'Stable', color: '#166534', bg: '#DCFCE7' };
    if (p >= 40) return { label: 'Recovering', color: '#92400E', bg: '#FEF3C7' };
    return { label: 'Needs Attention', color: '#991B1B', bg: '#FEE2E2' };
  };

  const [layoutCompact, setLayoutCompact] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 899px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 899px)');
    const onChange = () => setLayoutCompact(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="app-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=DM+Mono:wght@500&display=swap');

        * { box-sizing: border-box; }

        .app-container {
          display: flex;
          width: 100%;
          max-width: 100vw;
          min-height: 100vh;
          min-height: 100dvh;
          height: 100vh;
          height: 100dvh;
          background: #F8FAFF;
          font-family: 'DM Sans', -apple-system, sans-serif;
          overflow: hidden;
          touch-action: manipulation;
        }

        /* ── Sidebar (structure UNCHANGED) ── */
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
        .sidebar-logo-container { display: flex; justify-content: center; width: 100%; margin-bottom: 40px; }
        .sidebar-logo { width: ${isExpanded ? '120px' : '70px'}; transition: width 0.3s ease; }
        .sidebar-nav-item {
          display: flex; align-items: center; width: 100%;
          padding: 0 ${isExpanded ? '35px' : '0'};
          justify-content: ${isExpanded ? 'flex-start' : 'center'};
          gap: 20px; margin-bottom: 25px; min-height: 52px; box-sizing: border-box;
          border: 2px solid transparent; border-radius: 12px;
        }
        .sidebar-nav-item.sidebar-nav-active { border-color: #F54E25; }
        .sidebar-icon-wrap { padding: 12px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .sidebar-label { display: ${isExpanded ? 'block' : 'none'}; font-weight: 700; font-size: 18px; color: #707EAE; max-width: 140px; white-space: normal; overflow-wrap: anywhere; line-height: 1.2; }
        .sidebar-primary { width: 100%; }
        .sidebar-footer { position: absolute; left: 0; right: 0; bottom: 20px; width: 100%; }
        .sidebar-footer .sidebar-nav-item { margin-bottom: 0; }
        .sidebar-footer .sidebar-nav-item + .sidebar-nav-item { margin-top: 14px; }

        /* ── Top nav ── */
        .top-nav-actions { margin-left: auto; display: flex; align-items: center; gap: 14px; flex-shrink: 0; }
        .notifications-dropdown {
          position: absolute; top: calc(100% + 10px); right: 0;
          width: min(360px, calc(100vw - 48px));
          background: white; border: 1px solid #E9EDF7; border-radius: 18px;
          box-shadow: 0 16px 48px rgba(15,23,42,0.14); padding: 18px; z-index: 400;
        }
        .notifications-trigger {
          width: 40px; height: 40px; min-width: 40px; min-height: 40px; padding: 0; box-sizing: border-box;
          flex-shrink: 0; border-radius: 50%; border: none; background: #F54E25;
          display: flex; align-items: center; justify-content: center; cursor: pointer; color: white;
          box-shadow: 0 4px 12px rgba(245,78,37,0.35);
        }
        .notifications-trigger:hover { background: #e0421a; }
        .notifications-trigger svg { display: block; width: 21px; height: 21px; stroke: #fff; color: #fff; flex-shrink: 0; }
        .notif-dropdown-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
        .notif-clear-all { border: none; background: transparent; color: #94a3b8; font-size: 12px; font-weight: 700; cursor: pointer; padding: 4px 6px; border-radius: 8px; flex-shrink: 0; }
        .notif-clear-all:hover { color: #64748b; background: #f1f5f9; }
        .main-view { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .top-nav {
          height: 72px; background: white; display: flex; align-items: center;
          padding: 0 28px; border-bottom: 1px solid #F1F5F9; box-sizing: border-box; z-index: 300;
          box-shadow: 0 1px 0 rgba(15,23,42,0.06);
        }
        .top-nav-left { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; min-width: 0; }
        .view-title { color: #F54E25; font-weight: 800; font-size: 18px; letter-spacing: -0.01em; }
        .welcome-text { color: #64748B; font-weight: 500; font-size: 14px; }
        .user-avatar-top {
          width: 40px; height: 40px; min-width: 40px; min-height: 40px;
          background: linear-gradient(135deg,#F54E25,#EA580C); color: white; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 13px; box-sizing: border-box;
          box-shadow: 0 4px 12px rgba(245,78,37,0.3);
        }

        /* ── Scroll area ── */
        .scroll-content { flex: 1; padding: 24px 28px 40px; overflow-y: auto; background: #F8FAFF; }
        .content-wrap { width: 100%; max-width: min(1560px, 100%); margin: 0 auto; }
        .dashboard-stack { display: grid; gap: 18px; }

        /* ── Hero banner ── */
        .hero-banner {
          background: linear-gradient(135deg,#1E293B 0%,#1D2D50 55%,#312e81 100%);
          border-radius: 22px; padding: 26px 28px;
          box-shadow: 0 12px 40px rgba(15,23,42,0.18);
          position: relative; overflow: hidden;
        }
        .hero-deco-1 { position: absolute; top: -40px; right: -40px; width: 180px; height: 180px; border-radius: 50%; background: rgba(255,255,255,0.04); }
        .hero-deco-2 { position: absolute; bottom: -20px; right: 120px; width: 100px; height: 100px; border-radius: 50%; background: rgba(255,255,255,0.05); }
        .hero-deco-3 { position: absolute; top: 20px; right: 200px; width: 60px; height: 60px; border-radius: 50%; background: rgba(245,78,37,0.15); }
        .hero-banner-inner { position: relative; }

        /* ── Stat cards ── */
        .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
        .stat-card {
          background: #fff; border-radius: 18px; padding: 16px 18px;
          border: 1px solid #E9EDF7; box-shadow: 0 4px 16px rgba(15,23,42,0.05);
          position: relative; overflow: hidden;
        }
        .stat-card-deco { position: absolute; top: 0; right: 0; width: 70px; height: 70px; border-radius: '0 18px 0 70px'; opacity: 0.6; }

        /* ── Action cards ── */
        .action-grid-desktop { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
        .action-card {
          background: white; border-radius: 20px; padding: 22px 20px;
          display: flex; flex-direction: column; align-items: flex-start; gap: 10px;
          cursor: pointer; border: 1px solid #E9EDF7;
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
          box-shadow: 0 4px 14px rgba(15,23,42,0.05);
        }
        .action-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(15,23,42,0.1); border-color: #D0DBF5; }
        .icon-square {
          width: 52px; height: 52px; background: #F54E25; border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 6px 16px rgba(245,78,37,0.3);
        }
        .icon-square svg { width: 24px; height: 24px; stroke: #fff; stroke-width: 2.2; }
        .action-title { font-size: 15px; font-weight: 800; color: #0F172A; letter-spacing: -0.01em; }
        .action-subtitle { font-size: 12px; color: #64748B; font-weight: 500; line-height: 1.4; }
        .action-badge { display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 10px; font-size: 11px; font-weight: 800; }
        .action-arrow { margin-left: auto; width: 28px; height: 28px; border-radius: 8px; background: #F8FAFF; display: flex; align-items: center; justify-content: center; color: #94A3B8; }

        /* ── Section card ── */
        .section-card {
          background: white; border: 1px solid #E9EDF7; border-radius: 20px; padding: 20px 22px;
          box-shadow: 0 4px 20px rgba(15,23,42,0.05);
        }
        .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; gap: 12px; }
        .section-title { font-size: 14px; font-weight: 800; color: #0F172A; letter-spacing: -0.01em; display: flex; align-items: center; gap: 8px; }
        .section-sub { font-size: 11px; color: #94A3B8; margin-top: 2px; }
        .section-badge { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px; }

        /* ── Tables ── */
        .tables-row { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; }
        .table-card { background: #fff; border: 1px solid #E9EDF7; border-radius: 18px; overflow: hidden; box-shadow: 0 4px 16px rgba(15,23,42,0.04); }
        .table-head { padding: 14px 18px; border-bottom: 1px solid #F1F5F9; display: flex; align-items: center; justify-content: space-between; gap: 8px; background: #FAFBFF; }
        .table-scroll { overflow-x: auto; }
        .table-scroll-patients { max-height: 340px; overflow-y: auto; }
        .table-scroll-requests { max-height: 400px; overflow-y: auto; }
        .dashboard-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .dashboard-table th { text-align: left; color: #64748B; font-weight: 700; background: #F8FAFF; padding: 10px 14px; border-bottom: 1px solid #F1F5F9; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
        .dashboard-table td { padding: 11px 14px; color: #1E293B; border-bottom: 1px solid #F8FAFC; font-weight: 600; }
        .dashboard-table tr:last-child td { border-bottom: none; }
        .dashboard-table tr:hover td { background: #FAFBFF; }

        /* ── Bottom grid ── */
        .bottom-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 16px; }
        .clean-list { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
        .clean-list-item {
          border: 1px solid #F1F5F9; border-radius: 14px; background: #FAFBFF;
          padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px;
          transition: border-color 0.15s;
        }
        .clean-list-item:hover { border-color: #DDE6F7; }
        .mini-pill { font-size: 11px; font-weight: 700; border-radius: 999px; padding: 4px 10px; }

        /* ── Overview highlights ── */
        .highlights-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .highlight-item {
          border: 1px solid #F1F5F9; border-radius: 16px; background: #fff;
          padding: 14px 16px; box-shadow: 0 2px 10px rgba(15,23,42,0.03);
        }
        .highlight-label { color: #94A3B8; font-size: 10px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 6px; }
        .highlight-value { color: #0F172A; font-size: 26px; font-weight: 900; line-height: 1; letter-spacing: -0.02em; }
        .highlight-sub { color: #94A3B8; font-size: 11px; font-weight: 500; margin-top: 4px; }

        /* ── Graph bars ── */
        .graph-bars-wrap { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; align-items: flex-end; min-height: 180px; padding-top: 8px; }
        .graph-bar-item { display: flex; flex-direction: column; align-items: center; gap: 6px; }
        .graph-bar-track { width: 100%; height: 130px; background: #F8FAFC; border-radius: 10px; display: flex; align-items: flex-end; overflow: hidden; border: 1px solid #F1F5F9; }
        .graph-bar-fill { width: 100%; border-radius: 8px 8px 4px 4px; min-height: 8px; }
        .graph-bar-value { font-size: 14px; font-weight: 900; color: #0F172A; }
        .graph-bar-label { font-size: 10px; font-weight: 700; color: #64748B; text-align: center; }

        /* ── KPI grid ── */
        .kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .kpi-item { border: 1px solid #F1F5F9; border-radius: 14px; padding: 14px; background: #fff; }
        .kpi-dot { width: 24px; height: 4px; border-radius: 999px; margin-top: 8px; }
        .kpi-note { margin-top: 5px; color: #64748B; font-size: 11px; line-height: 1.35; font-weight: 500; }

        /* ── Insights split ── */
        .insights-split { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .insight-panel { border: 1px solid #F1F5F9; border-radius: 14px; background: #fff; padding: 16px; }

        /* ── Report modal (structure UNCHANGED) ── */
        .report-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15,23,42,0.3); backdrop-filter: blur(8px); display: flex; justify-content: center; align-items: center; z-index: 3000; padding: 16px; box-sizing: border-box; }
        .report-modal { width: min(640px,100%); max-height: min(88vh,900px); background: #fff; border-radius: 22px; overflow: hidden; box-shadow: 0 8px 40px rgba(15,23,42,0.18); display: flex; flex-direction: column; border: 1px solid #e8eaef; border-top: 3px solid #F54E25; }
        .report-header { background: linear-gradient(180deg,#fffdfb 0%,#fafbfc 100%); padding: 20px 24px 16px; color: #1e293b; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 1px solid #f0e8e4; }
        .report-header-text { min-width: 0; flex: 1; }
        .report-title-kicker { font-size: 11px; font-weight: 700; color: #c2410c; letter-spacing: 0.06em; margin-bottom: 4px; text-transform: uppercase; }
        .report-title-main { font-size: 1.2rem; font-weight: 800; color: #0f172a; line-height: 1.3; letter-spacing: -0.02em; }
        .report-title-accent { color: #F54E25; }
        .report-title-desc { font-size: 13px; color: #64748b; margin-top: 6px; line-height: 1.5; font-weight: 400; max-width: 32rem; }
        .report-header-badge { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; padding: 5px 10px; background: #fff5f0; border-radius: 8px; font-size: 12px; font-weight: 600; color: #b45309; border: 1px solid #ffdfd3; }
        .report-header-close { border: none; background: transparent; border-radius: 10px; padding: 8px; cursor: pointer; color: #94a3b8; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.15s, color 0.15s; }
        .report-header-close:hover { background: #fff5f0; color: #F54E25; }
        .report-status-chip { background: #fff7f3; color: #9a3412; font-size: 10px; padding: 3px 8px; border-radius: 6px; font-weight: 700; border: 1px solid #ffdfd3; }
        .report-modal-body { flex: 1; min-height: 0; overflow-y: auto; padding: 18px 20px 20px; background: #f9f9fb; }
        .report-patient-block { border: 1px solid #eaecef; border-radius: 14px; margin-bottom: 10px; overflow: hidden; background: #fff; transition: border-color 0.15s; }
        .report-patient-block:hover { border-color: #f5d0c4; }
        .report-patient-block:last-child { margin-bottom: 0; }
        .report-patient-row { display: flex; align-items: center; gap: 12px; width: 100%; padding: 14px 16px; border: none; background: transparent; cursor: pointer; text-align: left; font-family: inherit; }
        .report-patient-row:hover { background: #fffdfb; }
        .report-patient-avatar { width: 44px; height: 44px; border-radius: 12px; background: #fff5f0; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; border: 1px solid #ffeee6; }
        .report-patient-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .report-patient-main { flex: 1; min-width: 0; }
        .report-patient-name { font-size: 0.95rem; font-weight: 800; color: #0f172a; }
        .report-patient-meta { font-size: 12px; color: #64748b; margin-top: 3px; font-weight: 500; }
        .report-chevron { color: #fdba9a; flex-shrink: 0; transition: transform 0.2s, color 0.15s; }
        .report-chevron.open { transform: rotate(180deg); color: #F54E25; }
        .report-weeks-panel { padding: 12px 14px 16px; background: linear-gradient(180deg,#fffdfb,#fafbfc); border-top: 1px solid #f0e8e4; }
        .report-weeks-hint { font-size: 12px; font-weight: 600; color: #475569; margin: 0 2px 12px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
        .report-weeks-hint-label { display: inline-flex; align-items: center; gap: 10px; min-width: 0; }
        .report-weeks-hint-bar { width: 3px; height: 14px; background: #F54E25; border-radius: 2px; flex-shrink: 0; }
        .report-week-summary-pill { font-size: 11px; font-weight: 700; color: #9a3412; background: #fff; padding: 4px 10px; border-radius: 8px; border: 1px solid #ffd4c4; }
        .report-week-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        .report-week-card { background: #fff; border: 1px solid #e8eaef; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
        .report-week-card--empty { border-color: #eceff3; background: #fcfcfd; }
        .report-week-card--done { border-color: #f5d0c4; background: #fffcfa; cursor: pointer; }
        .report-week-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .report-week-num { font-size: 13px; font-weight: 700; color: #334155; }
        .report-week-badge { font-size: 10px; font-weight: 700; letter-spacing: 0.02em; padding: 3px 8px; border-radius: 8px; flex-shrink: 0; }
        .report-week-badge--pending { background: #f1f5f9; color: #64748b; }
        .report-week-badge--submitted { background: #fff5f0; color: #c2410c; border: 1px solid #ffd4c4; }
        .report-week-empty-msg { margin: 0; font-size: 12px; font-weight: 500; color: #94a3b8; line-height: 1.45; }
        .report-week-detail { display: flex; gap: 8px; align-items: flex-start; }
        .report-week-detail-text { font-size: 12px; color: #475569; line-height: 1.45; font-weight: 500; }
        .report-week-detail-sub { font-size: 11px; color: #94a3b8; font-weight: 500; margin-top: 3px; }
        .report-detail-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.45); z-index: 3200; display: flex; align-items: center; justify-content: center; padding: 16px; }
        .report-detail-modal { width: min(760px,100%); max-height: 88vh; overflow-y: auto; background: #fff; border-radius: 20px; border: 1px solid #E9EDF7; box-shadow: 0 24px 48px rgba(15,23,42,0.18); padding: 22px; }
        .report-detail-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin: -22px -22px 0; padding: 20px 22px 18px; border-radius: 20px 20px 0 0; background: linear-gradient(180deg,#fffdfb 0%,#fafbfc 100%); border-bottom: 1px solid #f0e8e4; }
        .report-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
        .report-detail-item { border: 1px solid #F1F5F9; border-radius: 12px; padding: 12px 14px; background: #FAFBFF; }
        .report-detail-label { color: #94A3B8; font-size: 11px; font-weight: 700; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.06em; }
        .report-detail-value { color: #1B2559; font-size: 13px; font-weight: 700; line-height: 1.45; white-space: pre-wrap; }
        .report-footer-bar { padding: 14px 20px 18px; background: #fafbfc; border-top: 1px solid #eef0f4; }
        .report-close-btn { background: #fff; color: #c2410c; border: 1px solid #F54E25; width: 100%; padding: 12px 16px; border-radius: 12px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all 0.15s; }
        .report-close-btn:hover { background: #fff5f0; color: #9a3412; border-color: #ea580c; }
        .report-empty-modal { text-align: center; padding: 32px 20px; color: #94a3b8; font-size: 13px; line-height: 1.55; font-weight: 500; }
        .report-dot { width: 8px; height: 8px; background: #F54E25; border-radius: 50%; opacity: 0.5; }

        /* ── Fees & inclusions (modal) ── */
        .fees-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 3150;
          background: rgba(15,23,42,0.35);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          box-sizing: border-box;
        }
        .fees-modal-shell {
          width: min(920px, 100%);
          max-height: min(92dvh, 900px);
          background: #fff;
          border-radius: 22px;
          overflow: hidden;
          box-shadow: 0 24px 48px rgba(15,23,42,0.2);
          border: 1px solid #E9EDF7;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        /* ── Chat ── */
        .chat-window { position: fixed; bottom: 100px; right: 20px; width: 350px; height: 500px; background: white; border-radius: 24px; box-shadow: 0 20px 60px rgba(0,0,0,0.15); display: flex; flex-direction: column; z-index: 2000; overflow: hidden; border: 1px solid rgba(0,0,0,0.05); animation: slideUp 0.3s ease; }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .chat-header { padding: 18px 20px; display: flex; align-items: center; justify-content: space-between; background: white; border-bottom: 1px solid #F1F5F9; }
        .chat-body { flex: 1; padding: 20px; background: #F8FAFF; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; scrollbar-width: none; }
        .chat-body::-webkit-scrollbar { display: none; }
        .msg-bubble { max-width: 85%; padding: 12px 16px; font-size: 13px; line-height: 1.5; position: relative; }
        .msg-received { background: white; color: #1B2559; align-self: flex-start; border-radius: 18px 18px 18px 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .msg-sent { background: #F54E25; color: white; align-self: flex-end; border-radius: 18px 18px 4px 18px; }
        .typing-indicator { display: flex; gap: 4px; padding: 12px 16px; background: white; width: fit-content; border-radius: 18px 18px 18px 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .dot { width: 6px; height: 6px; background: #A3AED0; border-radius: 50%; animation: bounce 1.4s infinite ease-in-out; }
        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }

        /* ── Panel title helper ── */
        .panel-title { color: #0F172A; font-weight: 800; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; font-size: 14px; }

        /* ── Interactive row ── */
        .interactive-row { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; color: #334155; font-size: 13px; }
        .notif-row-text { flex: 1; }
        .notif-remove-btn { border: none; background: transparent; color: #94A3B8; cursor: pointer; font-size: 15px; line-height: 1; padding: 0 2px; }
        .notif-remove-btn:hover { color: #EF4444; }

        /* ── Table helpers ── */
        .table-patient-wrap { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .table-patient-name { color: #0F172A; font-weight: 800; font-size: 12px; }
        .table-mini-text { color: #94A3B8; font-size: 10px; font-weight: 600; }
        .table-progress-wrap { display: grid; gap: 5px; min-width: 110px; }
        .table-progress-track { height: 5px; border-radius: 999px; background: #F1F5F9; overflow: hidden; }
        .table-progress-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg,#F54E25,#EA580C); }
        .patient-status-pill { display: inline-flex; align-items: center; border-radius: 999px; padding: 3px 9px; font-size: 10px; font-weight: 800; }
        .table-status-pill { display: inline-flex; align-items: center; border-radius: 999px; padding: 3px 9px; font-size: 10px; font-weight: 800; text-transform: capitalize; background: #FEF3C7; color: #92400E; }
        .table-remove-btn { border: none; background: transparent; color: #94A3B8; border-radius: 6px; padding: 0 2px; font-size: 16px; line-height: 1; font-weight: 700; cursor: pointer; }
        .table-remove-btn:hover { color: #EF4444; }
        .request-status-cell { display: flex; align-items: center; gap: 8px; }
        .request-status-cell .table-remove-btn { margin-left: auto; }

        /* ── Mobile / compact (tablets + phones) ── */
        .mobile-only { display: none; }
        @media (max-width: 899px) {
          .desktop-sidebar, .top-nav, .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; }
          .app-container { flex-direction: column; height: 100vh; overflow: hidden; }
          .mobile-top-bar { padding: 0 20px; height: 60px; background: white; border-bottom: 1px solid #F1F1F1; align-items: center; justify-content: space-between; }
          .mobile-notifications-trigger.notifications-trigger { width: 34px; height: 34px; min-width: 34px; min-height: 34px; padding: 0; }
          .mobile-notifications-trigger.notifications-trigger svg { width: 18px; height: 18px; }
          .mobile-notifications-dropdown { right: 0; left: auto; width: min(340px, calc(100vw - 40px)); }
          .scroll-content { padding: 15px !important; padding-bottom: 90px !important; }
          .stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .highlights-grid { grid-template-columns: repeat(2, 1fr) !important; }
          /* Quick actions: one column — same rich cards as desktop (Weekly Report + Services) */
          .action-grid-desktop { grid-template-columns: 1fr !important; gap: 12px !important; }
          .tables-row { grid-template-columns: 1fr !important; }
          .insights-split { grid-template-columns: 1fr !important; }
          .bottom-grid { grid-template-columns: 1fr !important; }
          .graph-bars-wrap { grid-template-columns: repeat(6, 1fr) !important; }
          .report-week-grid { grid-template-columns: 1fr; gap: 10px; }
          .report-detail-grid { grid-template-columns: 1fr; gap: 10px; }
          /* Weekly report modal: bottom sheet + hero-matched header */
          .report-overlay {
            align-items: flex-end;
            justify-content: stretch;
            padding: 0;
            padding-bottom: env(safe-area-inset-bottom);
          }
          .report-modal {
            width: 100%;
            max-width: 100%;
            max-height: min(92dvh, 100%);
            border-radius: 22px 22px 0 0;
            border: none;
            border-top: 3px solid #F54E25;
            box-shadow: 0 -8px 40px rgba(15,23,42,0.2);
          }
          .report-header {
            background: linear-gradient(135deg,#1E293B 0%,#1D2D50 55%,#312e81 100%);
            border-bottom: 1px solid rgba(255,255,255,0.08);
            padding: 18px 18px 16px;
          }
          .report-title-kicker { color: #FDBA74; }
          .report-title-main { color: #fff; }
          .report-title-accent { color: #FB923C; }
          .report-title-desc { color: rgba(255,255,255,0.7); font-size: 12px; max-width: none; }
          .report-header-badge {
            background: rgba(255,255,255,0.1);
            border-color: rgba(255,255,255,0.18);
            color: #FED7AA;
          }
          .report-header-badge svg { color: #FED7AA; stroke: #FED7AA; }
          .report-header-close { color: rgba(255,255,255,0.75); }
          .report-header-close:hover { background: rgba(255,255,255,0.12); color: #fff; }
          .report-modal-body { padding: 14px 16px 18px; }
          .report-patient-row { padding: 16px 14px; min-height: 56px; }
          .report-patient-avatar { width: 48px; height: 48px; border-radius: 14px; }
          .report-footer-bar {
            padding: 12px 16px calc(14px + env(safe-area-inset-bottom, 0px));
            background: #fff;
            border-top: 1px solid #E9EDF7;
          }
          .report-close-btn { border-radius: 14px; padding: 14px 16px; }
          /* Report detail: second sheet, same visual language */
          .report-detail-overlay {
            align-items: flex-end;
            padding: 0;
            padding-bottom: env(safe-area-inset-bottom);
          }
          .report-detail-modal {
            width: 100%;
            max-width: 100%;
            max-height: min(90dvh, 100%);
            border-radius: 22px 22px 0 0;
            padding: 0 0 calc(20px + env(safe-area-inset-bottom, 0px));
            border: none;
            border-top: 3px solid #F54E25;
            box-shadow: 0 -12px 48px rgba(15,23,42,0.22);
          }
          .report-detail-head {
            margin: 0;
            padding: 18px 16px 16px;
            border-radius: 19px 19px 0 0;
            background: linear-gradient(135deg,#1E293B 0%,#1D2D50 55%,#312e81 100%);
            border-bottom: 1px solid rgba(255,255,255,0.08);
          }
          .report-detail-head .report-detail-kicker { color: #FDBA74 !important; }
          .report-detail-head .report-detail-title { color: #fff !important; }
          .report-detail-modal .report-detail-grid { margin: 14px 16px 0; }
          .chat-window { width: 320px; height: 450px; bottom: 85px; right: 15px; border-radius: 20px; }
          .mobile-bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; height: 70px; background: white; border-top: 1px solid #EEE; display: flex; justify-content: space-around; align-items: center; padding-bottom: env(safe-area-inset-bottom); z-index: 1000; }
          .hero-banner { border-radius: 18px; padding: 18px 16px; }
          .icon-square { width: 48px; height: 48px; border-radius: 14px; }
          .icon-square svg { width: 22px; height: 22px; }
          .action-card {
            padding: 18px 16px !important;
            border-radius: 18px;
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
          .action-title { font-size: 15px !important; font-weight: 800; }
          .action-subtitle {
            display: block !important;
            font-size: 12px !important;
            line-height: 1.45 !important;
            color: #64748B !important;
          }
          .action-badge { display: inline-flex !important; margin-top: 2px; }
          .action-arrow { margin-left: auto; }
          .fees-modal-overlay {
            align-items: flex-end;
            justify-content: stretch;
            padding: 0;
            padding-bottom: env(safe-area-inset-bottom);
          }
          .fees-modal-shell {
            width: 100%;
            max-width: 100%;
            border-radius: 22px 22px 0 0;
            max-height: min(94dvh, 100%);
            border: none;
            border-top: 3px solid #F54E25;
            box-shadow: 0 -8px 40px rgba(15,23,42,0.18);
          }
        }
      `}</style>

      {/* ── REPORT MODAL (portaled so never clipped on mobile) ── */}
      {showReport && createPortal(
        <div className="report-overlay" onClick={() => { setShowReport(false); setWeeklyReportExpandedPatientId(null); setWeeklyReportDetail(null); }}>
          <div className="report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="report-header">
              <div className="report-header-text">
                <div className="report-title-kicker">Care updates</div>
                <div className="report-title-main"><span className="report-title-accent">Weekly</span> reports</div>
                <p className="report-title-desc">Open a patient to see weeks 1–7. Filled reports from your nurse appear with a date; empty weeks show "No reports submitted yet."</p>
                {patients.length > 0 && (
                  <div className="report-header-badge"><FileText size={14} strokeWidth={2} aria-hidden />{patients.length} patient{patients.length !== 1 ? 's' : ''}</div>
                )}
              </div>
              <button type="button" className="report-header-close" onClick={() => { setShowReport(false); setWeeklyReportExpandedPatientId(null); setWeeklyReportDetail(null); }} aria-label="Close"><X size={20} strokeWidth={2} /></button>
            </div>
            <div className="report-modal-body">
              {patients.length === 0 ? (
                <div className="report-empty-modal">No admitted patients yet. When an admission is approved, patients will show here.</div>
              ) : (
                patients.map((p, i) => {
                  const reportsForPatient = nurseWeeklyReportsByPatient[String(p.id)] || {};
                  const submittedWeekCount = [1,2,3,4,5,6,7].filter((n) => reportsForPatient[String(n)]).length;
                  return (
                    <div key={p.id} className="report-patient-block">
                      <button type="button" className="report-patient-row" onClick={() => setWeeklyReportExpandedPatientId((prev) => (prev === p.id ? null : p.id))} aria-expanded={weeklyReportExpandedPatientId === p.id}>
                        <div className="report-patient-avatar">{patientImages[i] ? <img src={patientImages[i]} alt="" /> : <span style={{ fontSize: 13, fontWeight: 700, color: '#c2410c' }}>{patientCardInitials(p.name)}</span>}</div>
                        <div className="report-patient-main">
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                            <span className="report-patient-name">{p.name}</span>
                            <span className="report-status-chip">Recovering</span>
                          </div>
                          <div className="report-patient-meta">Admitted {p.date}{p.progress != null && p.progress !== '' ? ` · ${p.progress}% progress` : ''}<span style={{ color: '#94a3b8', fontWeight: 500 }}> · {submittedWeekCount}/7 reports</span></div>
                        </div>
                        <ChevronDown size={20} className={`report-chevron${weeklyReportExpandedPatientId === p.id ? ' open' : ''}`} />
                      </button>
                      {weeklyReportExpandedPatientId === p.id && (
                        <div className="report-weeks-panel">
                          <div className="report-weeks-hint">
                            <span className="report-weeks-hint-label"><span className="report-weeks-hint-bar" aria-hidden />Weekly timeline</span>
                            <span className="report-week-summary-pill">{submittedWeekCount} of 7 received</span>
                          </div>
                          <div className="report-week-grid">
                            {[1,2,3,4,5,6,7].map((w) => {
                              const rec = reportsForPatient[String(w)];
                              return (
                                <div key={w} className={`report-week-card ${rec ? 'report-week-card--done' : 'report-week-card--empty'}`} onClick={() => { if (!rec) return; setWeeklyReportDetail({ ...rec, week: w, patientName: p.name }); }}>
                                  <div className="report-week-card-top">
                                    <span className="report-week-num">Week {w}</span>
                                    {rec ? <span className="report-week-badge report-week-badge--submitted">Received</span> : <span className="report-week-badge report-week-badge--pending">Open</span>}
                                  </div>
                                  {rec ? (
                                    <div className="report-week-detail">
                                      <CheckCircle2 size={16} color="#ea580c" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
                                      <div><div className="report-week-detail-text">Received {formatNurseReportDate(rec.submittedAt)}</div>{rec.nurseName ? <div className="report-week-detail-sub">Nurse: {rec.nurseName}</div> : null}{rec.reportDate ? <div className="report-week-detail-sub">Report date: {rec.reportDate}</div> : null}</div>
                                    </div>
                                  ) : <p className="report-week-empty-msg">No reports submitted yet.</p>}
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
              <button type="button" className="report-close-btn" onClick={() => { setShowReport(false); setWeeklyReportExpandedPatientId(null); setWeeklyReportDetail(null); }}>Close Report</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
      {weeklyReportDetail && createPortal(
        <div className="report-detail-overlay" onClick={() => setWeeklyReportDetail(null)}>
          <div className="report-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="report-detail-head">
              <div>
                <div className="report-detail-kicker" style={{ fontSize: 12, color: '#ea580c', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em' }}>Weekly Report</div>
                <div className="report-detail-title" style={{ fontSize: 22, color: '#1B2559', fontWeight: 900, marginTop: 4, letterSpacing: '-0.02em', lineHeight: 1.25 }}>{weeklyReportDetail.patientName} — Week {weeklyReportDetail.week}</div>
              </div>
              <button type="button" className="report-header-close" onClick={() => setWeeklyReportDetail(null)} aria-label="Close details"><X size={20} strokeWidth={2} /></button>
            </div>
            <div className="report-detail-grid">
              {[['Submitted', formatNurseReportDate(weeklyReportDetail.submittedAt) || '—'],['Nurse', weeklyReportDetail.nurseName || '—'],['Report Date', weeklyReportDetail.reportDate || '—'],['Progress', weeklyReportDetail.progressPercent != null ? `${weeklyReportDetail.progressPercent}%` : 'N/A'],['Current Medications', weeklyReportDetail.currentMedications || '—'],['Medication Intervention', weeklyReportDetail.medicationIntervention || '—'],['Summary', weeklyReportDetail.summary || '—'],['Nurse Notes', weeklyReportDetail.nurseNote || '—'],['Behavior / Mood', weeklyReportDetail.behaviorObservation || '—'],['Recommendations', weeklyReportDetail.recommendations || '—']].map(([label, value]) => (
                <div key={label} className="report-detail-item"><div className="report-detail-label">{label}</div><div className="report-detail-value">{value}</div></div>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )}
      {showServicesModal && createPortal(
        <div
          className="fees-modal-overlay"
          onClick={() => {
            setShowServicesModal(false);
            setIsChatOpen(false);
          }}
        >
          <div className="fees-modal-shell" onClick={(e) => e.stopPropagation()}>
            <FamilyFeesInclusionsPanel
              onClose={() => {
                setShowServicesModal(false);
                setIsChatOpen(false);
              }}
            />
          </div>
        </div>,
        document.body,
      )}

      {/* ── SIDEBAR (100% unchanged) ── */}
      <aside className="desktop-sidebar" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="sidebar-logo-container"><img src={logo} alt="Kalinga" className="sidebar-logo" /></div>
        <div className="sidebar-primary">
          <div className="sidebar-nav-item sidebar-nav-active" onClick={(e) => { e.stopPropagation(); navigate('/home'); }}>
            <div className="sidebar-icon-wrap"><Home size={22} color="#707EAE" /></div>
            <span className="sidebar-label">Dashboard</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/patient-details'); }}>
            <div className="sidebar-icon-wrap"><BookUser size={22} color="#707EAE" /></div>
            <span className="sidebar-label">Resident Details</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/progress'); }}>
            <div className="sidebar-icon-wrap"><ClipboardList size={22} color="#707EAE" /></div>
            <span className="sidebar-label">Request Management</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/appointments'); }}>
            <div className="sidebar-icon-wrap"><Calendar size={22} color="#707EAE" /></div>
            <span className="sidebar-label">Appointments</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/reports'); }}>
            <div className="sidebar-icon-wrap"><FileText size={22} color="#707EAE" /></div>
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

      {/* ── MAIN VIEW ── */}
      <div className="main-view">

        <FamilyPageHeader title="Dashboard" subtitle={`${greeting}, ${displayName}`} />

        {/* ── Scroll content ── */}
        <div className="scroll-content" style={{ background: FAMILY_COLORS.background }}>
          <div className="content-wrap">
            <div className="dashboard-stack">

              {/* ── 1. Hero Banner ── */}
              <div className="hero-banner">
                <div className="hero-deco-1" /><div className="hero-deco-2" /><div className="hero-deco-3" />
                <div className="hero-banner-inner">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Heart size={16} color="#fff" />
                      </div>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Bridges of Hope — Family Portal</span>
                    </div>
                    <h1 style={{ margin: 0, color: '#fff', fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em' }}>{greeting}, {firstName} 👋</h1>
                    <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>{dateStr} · Your care overview at a glance</p>
                  </div>
                </div>
              </div>

              {/* ── 2. Stat Cards ── */}
              <div className="stat-grid">
                {[
                  { label: 'Active Residents', value: patients.length, sub: 'Currently under care', color: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE', icon: () => <Activity size={20} color="#6366F1" /> },
                  { label: 'Avg Progress', value: `${averageProgress}%`, sub: averageProgress >= 70 ? 'Strong trend' : 'Steady recovery', color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0', icon: () => <TrendingUp size={20} color="#10B981" /> },
                  { label: 'Pending Requests', value: totalPendingRequests, sub: 'Admissions, discharges, visits', color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', icon: () => <AlertCircle size={20} color="#F59E0B" /> },
                  { label: 'Reports Received', value: reportsReceivedCount, sub: 'From nursing staff', color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE', icon: () => <FileText size={20} color="#8B5CF6" /> },
                ].map((card) => (
                  <div key={card.label} className="stat-card" style={{ borderColor: card.border }}>
                    <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, background: card.bg, borderRadius: '0 18px 0 80px', opacity: 0.5 }} />
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{card.label}</p>
                        <p style={{ margin: '6px 0 2px', fontSize: 30, fontWeight: 900, color: '#0F172A', lineHeight: 1, letterSpacing: '-0.02em' }}>{card.value}</p>
                        <p style={{ margin: 0, fontSize: 11, color: '#94A3B8' }}>{card.sub}</p>
                      </div>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${card.border}` }}>
                        {card.icon()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── 3. Quick Actions ── */}
              <div className="section-card">
                <div className="section-header">
                  <div>
                    <div className="section-title"><Sparkles size={16} color="#F54E25" /> Quick Actions</div>
                    <p className="section-sub">Your most-used tools — one tap away</p>
                  </div>
                </div>
                <div className="action-grid-desktop">
                  <div className="action-card" onClick={() => { setWeeklyReportExpandedPatientId(null); setShowReport(true); setIsChatOpen(false); }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <div className="icon-square"><FileText aria-hidden /></div>
                      <div className="action-arrow"><ArrowRight size={14} /></div>
                    </div>
                    <div className="action-title">Weekly Report</div>
                    <div className="action-subtitle">Review submitted weekly care updates from nursing staff</div>
                    <span className="action-badge" style={{ background: '#FFF1EB', color: '#C2410C' }}>{reportsReceivedCount} received</span>
                  </div>
                  <div className="action-card" onClick={() => navigate('/progress', { state: { tab: 'admission' } })}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <div className="icon-square"><ClipboardList aria-hidden /></div>
                      <div className="action-arrow"><ArrowRight size={14} /></div>
                    </div>
                    <div className="action-title">Admission</div>
                    <div className="action-subtitle">Submit and track new admission request forms</div>
                    <span className="action-badge" style={{ background: '#FEF3C7', color: '#92400E' }}>{pendingAdmissions.length} pending</span>
                  </div>
                  <div
                    className="action-card"
                    onClick={() => {
                      setShowServicesModal(true);
                      setIsChatOpen(false);
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <div className="icon-square">
                        <img src={servicesIcon} alt="Services" style={{ width: 22, height: 22, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
                      </div>
                      <div className="action-arrow"><ArrowRight size={14} /></div>
                    </div>
                    <div className="action-title">Services</div>
                    <div className="action-subtitle">Open billing, inclusions, and care support details</div>
                    <span className="action-badge" style={{ background: '#EEF2FF', color: '#3730A3' }}>Care resources</span>
                  </div>
                </div>
              </div>

              {/* ── 4. Dashboard Summary ── */}
              <div className="section-card">
                <div className="section-header">
                  <div>
                    <div className="section-title"><BarChart3 size={16} color="#F54E25" /> Dashboard Summary</div>
                    <p className="section-sub">Live overview of patient, request, and report data</p>
                  </div>
                  <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>Updated from live data</span>
                </div>
                <div className="insights-split">
                  {/* Graph */}
                  <div className="insight-panel">
                    <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 800, color: '#0F172A' }}>Graph View</p>
                    <div style={{ background: '#F8FAFC', border: '1px solid #F1F5F9', borderRadius: 14, padding: '14px 12px' }}>
                      <div className="graph-bars-wrap">
                        {summaryGraphData.map((item) => (
                          <div className="graph-bar-item" key={item.label}>
                            <span className="graph-bar-value">{item.value}</span>
                            <div className="graph-bar-track">
                              <div className="graph-bar-fill" style={{ height: `${Math.max(8, Math.round(((Number(item.value)||0)/summaryGraphMax)*100))}%`, background: item.color }} />
                            </div>
                            <span className="graph-bar-label">{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: '#EEF4FF', border: '1px solid #DCE7FF', fontSize: 12, fontWeight: 600, color: '#334155' }}>
                      Highest metric: <strong>{summaryGraphData.reduce((max, item) => (item.value > max.value ? item : max), summaryGraphData[0]).label}</strong>
                    </div>
                  </div>
                  {/* KPI */}
                  <div className="insight-panel">
                    <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 800, color: '#0F172A' }}>Operational Insights</p>
                    <div className="kpi-grid">
                      {metricInsights.map((item) => (
                        <div key={item.label} className="kpi-item">
                          <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
                          <div style={{ color: '#0F172A', fontWeight: 900, fontSize: 22, marginTop: 5, letterSpacing: '-0.02em' }}>{item.value}</div>
                          <div className="kpi-dot" style={{ background: item.color }} />
                          <div className="kpi-note">{item.note}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Tables */}
                <div className="tables-row" style={{ marginTop: 16 }}>
                  <div className="table-card">
                    <div className="table-head">
                      <div className="panel-title" style={{ marginBottom: 0 }}><User size={15} color="#F54E25" /> Resident Snapshot</div>
                      <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700 }}>{patients.length} total</span>
                    </div>
                    <div className={`table-scroll ${patientTableRows.length > 5 ? 'table-scroll-patients' : ''}`}>
                      <table className="dashboard-table">
                        <thead><tr><th>Resident</th><th>Admitted</th><th>Progress</th><th>Status</th><th>Reports</th></tr></thead>
                        <tbody>
                          {patientTableRows.length ? patientTableRows.map((p) => {
                            const pProgress = Number(p.progress) || 0;
                            const status = patientStatus(pProgress);
                            return (
                              <tr key={p.id}>
                                <td>
                                  <div className="table-patient-wrap">
                                    <span className="table-patient-name">{p.name}</span>
                                    <span className="table-mini-text">ID: {p.admissionDisplayId ?? computeAdmissionDisplayId({ id: p.id, decided_at: p.admitted_at || p.admissionDate, created_at: p.created_at }, { id: p.id, admitted_at: p.admitted_at || p.admissionDate })}</span>
                                  </div>
                                </td>
                                <td style={{ fontSize: 11, color: '#64748B' }}>{p.date || 'N/A'}</td>
                                <td>
                                  <div className="table-progress-wrap">
                                    <div style={{ fontSize: 11, fontWeight: 800, color: '#0F172A' }}>{pProgress}%</div>
                                    <div className="table-progress-track"><div className="table-progress-fill" style={{ width: `${pProgress}%` }} /></div>
                                  </div>
                                </td>
                                <td><span className="patient-status-pill" style={{ background: status.bg, color: status.color }}>{status.label}</span></td>
                                <td style={{ fontWeight: 800, color: '#0F172A' }}>{patientReportCount(p.id)}/7</td>
                              </tr>
                            );
                          }) : <tr><td colSpan={5} style={{ color: '#94A3B8', textAlign: 'center', padding: '20px 14px' }}>No patient records yet.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="table-card">
                    <div className="table-head">
                      <div className="panel-title" style={{ marginBottom: 0 }}><ClipboardList size={15} color="#F54E25" /> Request Tracker</div>
                      <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700 }}>{totalPendingRequests} pending</span>
                    </div>
                    <div className={`table-scroll ${requestTableRows.length > 7 ? 'table-scroll-requests' : ''}`}>
                      <table className="dashboard-table">
                        <thead><tr><th>Type</th><th>Resident</th><th>Status</th></tr></thead>
                        <tbody>
                          {requestTableRows.length ? requestTableRows.map((r, idx) => (
                            <tr key={r.key || `${r.type}-${r.name}-${idx}`}>
                              <td>
                                <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
                                  background: r.type==='Admission'?'#EEF2FF':r.type==='Discharge'?'#FFF1F2':'#ECFDF5',
                                  color: r.type==='Admission'?'#3730A3':r.type==='Discharge'?'#9F1239':'#065F46' }}>
                                  {r.type}
                                </span>
                              </td>
                              <td style={{ fontWeight: 700, color: '#0F172A' }}>{r.name}</td>
                              <td className="request-status-cell">
                                <span className="table-status-pill">{String(r.status || 'pending').toLowerCase()}</span>
                                <button
                                  type="button"
                                  className="table-remove-btn"
                                  aria-label="Delete permanently"
                                  disabled={requestDeleteBusy === String(r.key)}
                                  onClick={() => void removeRequestTrackerRow(r)}
                                >
                                  ×
                                </button>
                              </td>
                            </tr>
                          )) : <tr><td colSpan={3} style={{ color: '#94A3B8', textAlign: 'center', padding: '20px 14px' }}>No pending requests.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {isSupabaseConfigured() && supabaseReadError && (
                  <div style={{ color: '#ef4444', fontSize: 11, fontWeight: 700, marginTop: 10 }}>{String(supabaseReadError).slice(0, 100)}</div>
                )}
              </div>

              {/* ── 5. Dashboard Highlights ── */}
              <div className="section-card">
                <div className="section-header">
                  <div className="section-title"><Activity size={16} color="#F54E25" /> Dashboard Highlights</div>
                </div>
                <div className="highlights-grid">
                  {[
                    { label: 'Active Residents', value: patients.length, sub: 'Currently under care' },
                    { label: 'Pending Requests', value: totalPendingRequests, sub: 'Admissions and discharges' },
                    { label: 'Average Progress', value: patients.length ? `${Math.round(patients.reduce((sum, p) => sum + (Number(p.progress)||0), 0)/patients.length)}%` : '0%', sub: 'Across all assigned patients' },
                    { label: 'Reports Received', value: reportsReceivedCount, sub: 'Weekly reports from nurses' },
                  ].map((item) => (
                    <div key={item.label} className="highlight-item">
                      <div className="highlight-label">{item.label}</div>
                      <div className="highlight-value">{item.value}</div>
                      <div className="highlight-sub">{item.sub}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── 6. Bottom Grid ── */}
              <div className="bottom-grid">
                <div className="section-card" style={{ margin: 0 }}>
                  <div className="section-title" style={{ marginBottom: 6 }}><Calendar size={16} color="#F54E25" /> Next Steps</div>
                  <p style={{ margin: '0 0 4px', color: '#94A3B8', fontSize: 12 }}>Suggested actions to keep care coordination on track.</p>
                  <div className="clean-list">
                    <div className="clean-list-item">
                      <div><div style={{ color: '#0F172A', fontWeight: 700, fontSize: 13 }}>Review request management queue</div><div style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }}>Check admission/discharge updates from staff</div></div>
                      <span className="mini-pill" style={{ background: '#FEF3C7', color: '#92400E', flexShrink: 0 }}>{totalPendingRequests||0} pending</span>
                    </div>
                    <div className="clean-list-item">
                      <div><div style={{ color: '#0F172A', fontWeight: 700, fontSize: 13 }}>Open patient details tab</div><div style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }}>View status and progress of all patients</div></div>
                      <button type="button" onClick={() => navigate('/patient-details')} style={{ border: 'none', borderRadius: 10, background: '#EEF2FF', color: '#3730A3', padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Open</button>
                    </div>
                    <div className="clean-list-item">
                      <div><div style={{ color: '#0F172A', fontWeight: 700, fontSize: 13 }}>Check appointment slots</div><div style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }}>Plan follow-ups and visit schedules</div></div>
                      <button type="button" onClick={() => navigate('/appointments')} style={{ border: 'none', borderRadius: 10, background: '#ECFDF5', color: '#065F46', padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>View</button>
                    </div>
                  </div>
                </div>
                <div className="section-card" style={{ margin: 0 }}>
                  <div className="section-title" style={{ marginBottom: 6 }}><FileText size={16} color="#F54E25" /> Care Resources</div>
                  <div className="clean-list" style={{ marginTop: 8 }}>
                    <div className="clean-list-item">
                      <div style={{ color: '#0F172A', fontWeight: 700, fontSize: 13 }}>View Weekly Reports</div>
                      <button type="button" onClick={() => { setWeeklyReportExpandedPatientId(null); setShowReport(true); }} style={{ border: 'none', borderRadius: 10, background: '#FFF1EB', color: '#C2410C', padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Open</button>
                    </div>
                    <div className="clean-list-item">
                      <div style={{ color: '#0F172A', fontWeight: 700, fontSize: 13 }}>Go to Services</div>
                      <button type="button" onClick={() => { setShowServicesModal(true); setIsChatOpen(false); }} style={{ border: 'none', borderRadius: 10, background: '#EEF2FF', color: '#3730A3', padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Open</button>
                    </div>
                    <div className="clean-list-item">
                      <div style={{ color: '#0F172A', fontWeight: 700, fontSize: 13 }}>Manage Your Profile</div>
                      <button type="button" onClick={() => navigate('/profile')} style={{ border: 'none', borderRadius: 10, background: '#ECFDF5', color: '#065F46', padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Open</button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ── Mobile bottom nav (unchanged) ── */}
        <div className="mobile-only mobile-bottom-nav">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }} onClick={() => navigate('/home')}>
            <Home size={24} color="#F54E25" /><span style={{ fontSize: 10, fontWeight: 700, color: '#F54E25' }}>Home</span>
          </div>
          <TrendingUp size={24} color="#A3AED0" onClick={() => navigate('/progress')} />
          <Calendar size={24} color="#A3AED0" onClick={() => navigate('/appointments')} />
          <BarChart3 size={24} color="#A3AED0" onClick={() => navigate('/reports')} />
          <User size={24} color="#A3AED0" onClick={() => navigate('/profile')} />
          <LogOut size={24} color="#F54E25" onClick={() => navigate('/login')} />
        </div>
      </div>

      {/* ── Chat Window (unchanged logic) ── */}
      {isChatOpen && !showReport && !showServicesModal && (
        <div className="chat-window">
          <div className="chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, background: 'linear-gradient(135deg,#F54E25,#EA580C)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageCircle size={20} color="white" />
              </div>
              <div><div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Bridges of Hope</div><div style={{ fontSize: 11, color: '#22C55E', fontWeight: 700 }}>● Care team</div></div>
            </div>
            <X size={20} color="#A3AED0" style={{ cursor: 'pointer' }} onClick={() => setIsChatOpen(false)} />
          </div>
          <div className="chat-body" ref={chatBodyRef}>
            {messages.map(msg => (
              <div key={msg.id} className={`msg-bubble ${msg.sender === 'staff' ? 'msg-received' : 'msg-sent'}`}>
                {msg.text}
                <div style={{ fontSize: 9, marginTop: 6, opacity: 0.6, textAlign: msg.sender === 'staff' ? 'left' : 'right' }}>{msg.time}</div>
              </div>
            ))}
            {chatSending && <div className="typing-indicator"><div className="dot"/><div className="dot"/><div className="dot"/></div>}
          </div>
          {chatSendError ? (
            <div style={{ padding: '8px 16px', fontSize: 12, color: '#DC2626', background: '#FEF2F2', borderTop: '1px solid #FECACA' }}>
              {chatSendError}
            </div>
          ) : null}
          <div style={{ padding: '14px 18px', background: 'white', display: 'flex', gap: 10, alignItems: 'center', borderTop: '1px solid #F1F5F9' }}>
            <input style={{ flex: 1, border: 'none', background: '#F8FAFF', borderRadius: 14, padding: '11px 16px', outline: 'none', fontSize: 13, color: '#0F172A', fontFamily: 'DM Sans, sans-serif' }} placeholder="Type your message..." value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} />
            <button onClick={handleSendMessage} disabled={!inputValue.trim() || chatSending} aria-label="Send message" style={{ background: inputValue.trim() ? '#F54E25' : '#E9EDF7', width: 44, height: 44, minWidth: 44, borderRadius: 12, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0, boxShadow: inputValue.trim() ? '0 4px 12px rgba(245,78,37,0.3)' : 'none' }}>
              <Send size={18} color="white" strokeWidth={2} style={{ width: 18, height: 18 }} />
            </button>
          </div>
        </div>
      )}

      {/* ── Chat FAB (unchanged logic) ── */}
      {!showReport && !showServicesModal && (
        <div onClick={() => setIsChatOpen(!isChatOpen)} style={{ position: 'fixed', bottom: layoutCompact ? 90 : 30, right: 20, width: 58, height: 58, background: 'linear-gradient(135deg,#F54E25,#EA580C)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 8px 24px rgba(245,78,37,0.4)', zIndex: 1000, cursor: 'pointer', transition: 'transform 0.2s' }}>
          {isChatOpen ? <X size={26} /> : <MessageCircle size={26} />}
        </div>
      )}
    </div>
  );
};

export default HomeDashboard;