import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Home, TrendingUp, User, LogOut, MessageCircle, X, FileText, Bell, Calendar, CheckCircle2, Clock3, ChevronDown, ClipboardList, BookUser, Heart, Activity, AlertCircle, ArrowRight, Sparkles, Sun, CloudSun, Moon } from 'lucide-react';
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
import BulletedListDisplay from '@/components/clinical/BulletedListDisplay';
import MedicationTableDisplay from '@/components/clinical/MedicationTableDisplay';
import FamilyPageHeader from '@/components/family/FamilyPageHeader';
import { FAMILY_PAGE_HEADERS } from '@/lib/familyPageHeaders';
import FamilyChatComposer from '@/components/family/FamilyChatComposer';
import FamilyChatMessageList from '@/components/family/FamilyChatMessageList';
import FamilyChatFab from '@/components/family/FamilyChatFab';
import FamilySidebar from '@/components/family/FamilySidebar';
import FamilyMobileBottomNav from '@/components/family/FamilyMobileBottomNav';
import FamilyChatBrandMark from '@/components/family/FamilyChatBrandMark';
import { useFamilyPatientProgressRealtime } from '@/hooks/useFamilyPatientProgressRealtime';
import { useFamilyUser } from '@/hooks/useFamilyUser';
import { useSupportChat } from '@/hooks/useSupportChat';
import { useFamilyPageScroll } from '@/hooks/useFamilyPageScroll';
import { getFamilyGreetingIcon, getFamilyTimeGreeting } from '@/lib/familyGreeting';

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
  const { scrollToTop } = useFamilyPageScroll();
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
            byPatient[pid][String(row.week_number)] = { submittedAt: row.submitted_at, nurseName: row.nurse_name || '', reportDate: row.report_date || '', summary: row.summary || row.report_summary || '', progressPercent: row.progress_percent, nurseNote: row.nurse_note || row.notes || '', behaviorObservation: row.behavior_observation || '', recommendations: row.recommendations || row.plan_next_week || '', currentMedications: row.current_medications || '', medicationIntervention: row.medication_intervention || '', dietaryRestrictions: row.dietary_restrictions || '', ongoingMedicalConcern: row.ongoing_medical_concern || row.behavior_observation || '' };
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
  const greeting = getFamilyTimeGreeting(now);
  const greetingIconKey = getFamilyGreetingIcon(now);
  const GreetingIcon = greetingIconKey === 'sun' ? Sun : greetingIconKey === 'cloud-sun' ? CloudSun : Moon;
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="family-portal app-container">
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
          font-family: 'DM Sans', -apple-system, sans-serif;
          overflow: hidden;
          touch-action: manipulation;
        }

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
        .main-view { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
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
        .scroll-content {
          flex: 1;
          padding: clamp(16px, 2.5vw, 28px) clamp(16px, 2.8vw, 32px) clamp(28px, 4vw, 44px);
          overflow-y: auto;
          background:
            radial-gradient(ellipse 80% 50% at 100% 0%, rgba(245, 78, 37, 0.04) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 0% 100%, rgba(99, 102, 241, 0.03) 0%, transparent 45%),
            #F8FAFF;
        }
        .content-wrap { width: 100%; max-width: min(1560px, 100%); margin: 0 auto; }
        .dashboard-stack { display: grid; gap: clamp(14px, 2vw, 20px); }
        .dashboard-stack > * {
          animation: dashFadeUp 0.5s ease-out both;
        }
        .dashboard-stack > *:nth-child(1) { animation-delay: 0.04s; }
        .dashboard-stack > *:nth-child(2) { animation-delay: 0.08s; }
        .dashboard-stack > *:nth-child(3) { animation-delay: 0.12s; }
        .dashboard-stack > *:nth-child(4) { animation-delay: 0.16s; }
        @keyframes dashFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ── Hero banner ── */
        .hero-banner {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 42%, #312e81 100%);
          border-radius: clamp(18px, 2.2vw, 24px);
          padding: clamp(22px, 3vw, 30px) clamp(22px, 3.2vw, 32px);
          box-shadow: 0 20px 56px rgba(15, 23, 42, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.08);
          position: relative; overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.07);
        }
        .hero-banner::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 55% 80% at 0% 0%, rgba(245, 78, 37, 0.18) 0%, transparent 55%),
            radial-gradient(ellipse 40% 60% at 100% 100%, rgba(99, 102, 241, 0.15) 0%, transparent 50%);
          pointer-events: none;
        }
        .hero-deco-1 { position: absolute; top: -50px; right: -30px; width: 200px; height: 200px; border-radius: 50%; background: rgba(255,255,255,0.05); filter: blur(2px); }
        .hero-deco-2 { position: absolute; bottom: -30px; right: 100px; width: 120px; height: 120px; border-radius: 50%; background: rgba(255,255,255,0.06); }
        .hero-deco-3 { position: absolute; top: 16px; right: 180px; width: 72px; height: 72px; border-radius: 50%; background: rgba(245,78,37,0.2); box-shadow: 0 0 40px rgba(245, 78, 37, 0.25); }
        .hero-banner-inner {
          position: relative; z-index: 1;
          display: flex; align-items: center; justify-content: space-between;
          gap: clamp(16px, 3vw, 28px); flex-wrap: wrap;
        }
        .hero-banner-main { flex: 1; min-width: 220px; }
        .hero-mini-stats {
          display: flex; gap: 10px; flex-wrap: wrap;
        }
        .hero-mini-stat {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 999px;
          padding: 10px 18px;
          min-width: 92px;
          text-align: center;
          transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease;
        }
        .hero-mini-stat:hover {
          transform: translateY(-2px);
          background: rgba(255, 255, 255, 0.14);
          border-color: rgba(255, 255, 255, 0.22);
        }
        .hero-mini-stat__label {
          margin: 0;
          font-size: 9px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .hero-mini-stat__value {
          margin: 4px 0 0;
          font-size: clamp(1.2rem, 2vw, 1.45rem);
          font-weight: 900;
          line-height: 1;
          letter-spacing: -0.03em;
        }
        .hero-banner-kicker {
          display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
        }
        .hero-banner-kicker-icon {
          width: 34px; height: 34px; border-radius: 11px;
          background: rgba(255,255,255,0.12); backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .hero-banner-eyebrow {
          font-size: clamp(0.625rem, 0.5vw + 0.5rem, 0.6875rem);
          color: rgba(255,255,255,0.55); font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
        }
        .hero-banner-title {
          margin: 0; color: #fff;
          font-size: clamp(1.375rem, 2vw + 0.75rem, 1.75rem);
          font-weight: 900; letter-spacing: -0.025em; line-height: 1.15;
        }
        .hero-banner-title-row {
          display: inline-flex; align-items: center; flex-wrap: wrap; gap: 8px;
        }
        .hero-banner-title-icon {
          flex-shrink: 0;
          margin-top: 2px;
        }
        .hero-banner-date {
          margin: 6px 0 0; color: rgba(255,255,255,0.55);
          font-size: clamp(0.75rem, 0.4vw + 0.65rem, 0.8125rem); line-height: 1.45;
        }

        /* ── Stat cards ── */
        .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: clamp(12px, 1.5vw, 16px); }
        .stat-card {
          background: #fff; border-radius: 18px; padding: clamp(14px, 1.8vw, 18px);
          border: 1px solid #e9edf7;
          box-shadow: 0 4px 18px rgba(15,23,42,0.05);
          position: relative; overflow: hidden;
          min-height: 118px;
          display: flex; flex-direction: column; justify-content: center;
          transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
        }
        .stat-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: var(--stat-accent, #f54e25);
          opacity: 0.85;
        }
        .stat-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(15, 23, 42, 0.09);
          border-color: #dde6f7;
        }
        .stat-card-label {
          margin: 0; font-size: 10px; color: #94a3b8; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.07em;
        }
        .stat-card-value {
          margin: 8px 0 4px; font-size: clamp(1.5rem, 2vw + 0.5rem, 1.875rem);
          font-weight: 900; color: #0f172a; line-height: 1; letter-spacing: -0.03em;
        }
        .stat-card-sub { margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.35; }
        .stat-card-icon {
          width: 44px; height: 44px; border-radius: 14px;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
        }
        .stat-card-deco { position: absolute; top: 0; right: 0; width: 80px; height: 80px; border-radius: 0 18px 0 80px; opacity: 0.5; }
        .stat-card-body { position: relative; display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }

        /* ── Action cards ── */
        .action-grid-desktop { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: clamp(12px, 1.8vw, 18px); }
        .action-card {
          background: white; border-radius: 18px; padding: clamp(18px, 2vw, 22px) clamp(16px, 2vw, 20px);
          display: flex; flex-direction: column; align-items: flex-start; gap: 10px;
          cursor: pointer; border: 1px solid #e9edf7;
          transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.22s ease, border-color 0.22s ease;
          box-shadow: 0 4px 16px rgba(15,23,42,0.04);
          min-height: 168px;
        }
        .action-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 40px rgba(15,23,42,0.1);
          border-color: #d0dbf5;
        }
        .action-card:active { transform: translateY(-1px); }
        .action-card-top { display: flex; align-items: center; justify-content: space-between; width: 100%; }
        .icon-square {
          width: 50px; height: 50px; background: linear-gradient(145deg, #f54e25, #ea580c);
          border-radius: 14px; display: flex; align-items: center; justify-content: center;
          box-shadow: 0 8px 20px rgba(245,78,37,0.28);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .action-card:hover .icon-square { transform: scale(1.04); box-shadow: 0 10px 24px rgba(245,78,37,0.34); }
        .icon-square svg { width: 24px; height: 24px; stroke: #fff; stroke-width: 2.2; }
        .action-title { font-size: clamp(0.875rem, 0.5vw + 0.75rem, 0.9375rem); font-weight: 800; color: #0F172A; letter-spacing: -0.015em; line-height: 1.25; }
        .action-subtitle { font-size: 12px; color: #64748B; font-weight: 500; line-height: 1.45; }
        .action-badge { display: inline-flex; align-items: center; border-radius: 999px; padding: 5px 11px; font-size: 11px; font-weight: 800; margin-top: auto; }
        .action-arrow {
          width: 32px; height: 32px; border-radius: 10px; background: #f8faff;
          display: flex; align-items: center; justify-content: center; color: #94A3B8;
          border: 1px solid #eef2f7;
          transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
        }
        .action-card:hover .action-arrow {
          background: #fff5f0; color: #f54e25; border-color: #ffd4c4;
          transform: translateX(2px);
        }

        /* ── Section card ── */
        .section-card {
          background: white; border: 1px solid #e9edf7; border-radius: 20px;
          padding: clamp(16px, 2.2vw, 22px) clamp(18px, 2.4vw, 24px);
          box-shadow: 0 6px 24px rgba(15,23,42,0.04);
          position: relative;
          overflow: hidden;
        }
        .section-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(245, 78, 37, 0.25), transparent);
        }
        .section-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: clamp(14px, 2vw, 18px); gap: 12px; }
        .section-title { font-size: clamp(0.8125rem, 0.4vw + 0.7rem, 0.875rem); font-weight: 800; color: #0F172A; letter-spacing: -0.015em; display: flex; align-items: center; gap: 8px; }
        .section-sub { font-size: 11px; color: #94A3B8; margin-top: 4px; line-height: 1.4; }
        .section-badge { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px; }

        /* ── Tables ── */
        .tables-row { display: grid; grid-template-columns: 1.4fr 1fr; gap: clamp(12px, 1.8vw, 16px); }
        .table-card {
          background: #fff; border: 1px solid #e9edf7; border-radius: 18px; overflow: hidden;
          box-shadow: 0 4px 20px rgba(15,23,42,0.04);
          transition: box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .table-card:hover { box-shadow: 0 8px 28px rgba(15,23,42,0.06); border-color: #dde6f7; }
        .table-head {
          padding: clamp(12px, 1.5vw, 14px) clamp(14px, 1.8vw, 18px);
          border-bottom: 1px solid #f1f5f9;
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
          background: linear-gradient(180deg, #fafbff 0%, #fff 100%);
        }
        .table-scroll { overflow-x: auto; }
        .table-scroll-patients { max-height: 340px; overflow-y: auto; }
        .table-scroll-requests { max-height: 400px; overflow-y: auto; }
        .dashboard-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .dashboard-table th { text-align: left; color: #64748B; font-weight: 700; background: #F8FAFF; padding: 10px 14px; border-bottom: 1px solid #F1F5F9; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
        .dashboard-table td { padding: 11px 14px; color: #1E293B; border-bottom: 1px solid #F8FAFC; font-weight: 600; }
        .dashboard-table tr:last-child td { border-bottom: none; }
        .dashboard-table tr:hover td { background: #FAFBFF; }

        /* ── Bottom grid ── */
        .bottom-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: clamp(12px, 1.8vw, 16px); }
        .clean-list { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
        .clean-list-item {
          border: 1px solid #f1f5f9; border-radius: 14px; background: #fafbff;
          padding: clamp(12px, 1.5vw, 14px) clamp(12px, 1.8vw, 16px);
          display: flex; justify-content: space-between; align-items: center; gap: 12px;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
        }
        .clean-list-item:hover { border-color: #dde6f7; box-shadow: 0 4px 16px rgba(15,23,42,0.04); transform: translateY(-1px); }
        .clean-list-title { color: #0F172A; font-weight: 700; font-size: clamp(0.8125rem, 0.4vw + 0.7rem, 0.8125rem); line-height: 1.3; }
        .clean-list-sub { color: #94A3B8; font-size: 12px; margin-top: 3px; line-height: 1.4; }
        .clean-list-btn {
          border: none; border-radius: 10px; padding: 6px 12px; font-size: 11px; font-weight: 700;
          cursor: pointer; flex-shrink: 0; transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .clean-list-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(15,23,42,0.08); }
        .mini-pill { font-size: 11px; font-weight: 700; border-radius: 999px; padding: 5px 11px; }
        .section-desc { margin: 0 0 4px; color: #94A3B8; font-size: 12px; line-height: 1.45; }

        /* ── Overview highlights ── */
        .highlights-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: clamp(10px, 1.5vw, 14px); }
        .highlight-item {
          border: 1px solid #f1f5f9; border-radius: 16px; background: #fff;
          padding: clamp(12px, 1.8vw, 16px);
          box-shadow: 0 2px 12px rgba(15,23,42,0.03);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          min-height: 96px;
        }
        .highlight-item:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(15,23,42,0.06); }
        .highlight-label { color: #94A3B8; font-size: 10px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 8px; }
        .highlight-value { color: #0F172A; font-size: clamp(1.375rem, 2vw + 0.5rem, 1.625rem); font-weight: 900; line-height: 1; letter-spacing: -0.03em; }
        .highlight-sub { color: #94A3B8; font-size: 11px; font-weight: 500; margin-top: 6px; line-height: 1.35; }

        /* ── Graph bars ── */
        .graph-bars-wrap { display: grid; grid-template-columns: repeat(6, 1fr); gap: clamp(8px, 1.2vw, 12px); align-items: flex-end; min-height: 190px; padding: 12px 4px 4px; }
        .graph-bar-item { display: flex; flex-direction: column; align-items: center; gap: 6px; }
        .graph-bar-track { width: 100%; height: 140px; background: #f8fafc; border-radius: 12px; display: flex; align-items: flex-end; overflow: hidden; border: 1px solid #f1f5f9; }
        .graph-bar-fill { width: 100%; border-radius: 10px 10px 6px 6px; min-height: 8px; transition: height 0.5s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: inset 0 1px 0 rgba(255,255,255,0.25); }
        .graph-bar-value { font-size: clamp(0.8125rem, 0.5vw + 0.65rem, 0.875rem); font-weight: 900; color: #0F172A; }
        .graph-bar-label { font-size: 10px; font-weight: 700; color: #64748B; text-align: center; line-height: 1.2; }

        /* ── KPI grid ── */
        .kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(8px, 1.2vw, 12px); }
        .kpi-item {
          border: 1px solid #f1f5f9; border-radius: 14px; padding: clamp(12px, 1.5vw, 16px);
          background: #fff; transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .kpi-item:hover { border-color: #e2e8f0; box-shadow: 0 4px 16px rgba(15,23,42,0.04); }
        .kpi-dot { width: 28px; height: 4px; border-radius: 999px; margin-top: 10px; }
        .kpi-label { font-size: 10px; color: #94A3B8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
        .kpi-value { color: #0F172A; font-weight: 900; font-size: clamp(1.125rem, 1.5vw + 0.5rem, 1.375rem); margin-top: 6px; letter-spacing: -0.02em; line-height: 1.1; }
        .kpi-note { margin-top: 6px; color: #64748B; font-size: 11px; line-height: 1.4; font-weight: 500; }
        .summary-updated-badge { font-size: 11px; color: #94A3B8; font-weight: 600; white-space: nowrap; }
        .summary-tables-wrap { margin-top: clamp(14px, 2vw, 20px); padding-top: clamp(14px, 2vw, 18px); border-top: 1px solid #f1f5f9; }

        /* ── Insights split ── */
        .insights-split { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(12px, 1.8vw, 16px); }
        .insight-panel {
          border: 1px solid #f1f5f9; border-radius: 16px; background: #fff;
          padding: clamp(14px, 2vw, 18px);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.8);
        }
        .insight-panel-title { margin: 0 0 14px; font-size: 13px; font-weight: 800; color: #0F172A; letter-spacing: -0.01em; }
        .graph-chart-shell {
          background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 14px;
          padding: clamp(12px, 1.8vw, 16px) clamp(10px, 1.5vw, 14px);
        }
        .graph-insight-banner {
          margin-top: 12px; padding: 10px 12px; border-radius: 12px;
          background: #eef4ff; border: 1px solid #dce7ff;
          font-size: 12px; font-weight: 600; color: #334155; line-height: 1.4;
        }

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

        /* ── Chat (styles in styles/family-chat.css) ── */

        /* ── Panel title helper ── */
        .panel-title { color: #0F172A; font-weight: 800; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; font-size: 14px; }

        /* ── Interactive row ── */
        .interactive-row { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; color: #334155; font-size: 13px; }
        .notif-row-text { flex: 1; }
        .notif-remove-btn { border: none; background: transparent; color: #94A3B8; cursor: pointer; font-size: 15px; line-height: 1; padding: 0 2px; }
        .notif-remove-btn:hover { color: #EF4444; }

        @media (min-width: 1600px) {
          .content-wrap { max-width: min(1680px, 100%); }
          .stat-grid { gap: 18px; }
          .action-grid-desktop { gap: 20px; }
        }

        @media (min-width: 900px) and (max-width: 1199px) {
          .stat-grid { grid-template-columns: repeat(2, 1fr); }
          .highlights-grid { grid-template-columns: repeat(2, 1fr); }
          .action-grid-desktop { grid-template-columns: repeat(2, 1fr); }
          .tables-row { grid-template-columns: 1fr; }
        }

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
          .family-chat-window { width: min(360px, calc(100vw - 16px)); right: 8px; --family-chat-bottom: 90px; }
          .family-chat-fab { --family-chat-fab-bottom: 90px; }
          .mobile-bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; height: 70px; background: white; border-top: 1px solid #EEE; display: flex; justify-content: space-around; align-items: center; padding-bottom: env(safe-area-inset-bottom); z-index: 1000; }
          .hero-banner { border-radius: 18px; padding: 18px 16px; }
          .stat-card { min-height: 108px; }
          .action-card { min-height: auto; }
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
              {[
                ['Submitted', formatNurseReportDate(weeklyReportDetail.submittedAt) || '—'],
                ['Nurse', weeklyReportDetail.nurseName || '—'],
                ['Report Date', weeklyReportDetail.reportDate || '—'],
                ['Progress', weeklyReportDetail.progressPercent != null ? `${weeklyReportDetail.progressPercent}%` : 'N/A'],
                ['Medication Intervention', weeklyReportDetail.medicationIntervention || '—'],
                ['Summary', weeklyReportDetail.summary || '—'],
                ['Nurse Notes', weeklyReportDetail.nurseNote || '—'],
                ['Behavior / Mood', weeklyReportDetail.behaviorObservation || '—'],
                ['Recommendations', weeklyReportDetail.recommendations || '—'],
              ].map(([label, value]) => (
                <div key={label} className="report-detail-item">
                  <div className="report-detail-label">{label}</div>
                  <div className="report-detail-value">{value}</div>
                </div>
              ))}
              <div className="report-detail-item" style={{ gridColumn: '1 / -1' }}>
                <div className="report-detail-label">Current Medications</div>
                <div className="report-detail-value">
                  <MedicationTableDisplay value={weeklyReportDetail.currentMedications} emptyText="—" />
                </div>
              </div>
              <div className="report-detail-item">
                <div className="report-detail-value">
                  <BulletedListDisplay value={weeklyReportDetail.dietaryRestrictions} emptyText="—" />
                </div>
              </div>
              <div className="report-detail-item">
                <div className="report-detail-label">Ongoing Medical Concern</div>
                <div className="report-detail-value">
                  <BulletedListDisplay value={weeklyReportDetail.ongoingMedicalConcern} emptyText="—" />
                </div>
              </div>
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

      <FamilySidebar
        isExpanded={isExpanded}
        onToggleExpanded={() => setIsExpanded(!isExpanded)}
      />

      {/* ── MAIN VIEW ── */}
      <div className="main-view">

        <FamilyPageHeader {...FAMILY_PAGE_HEADERS.dashboard} onBrandPress={scrollToTop} showMobileLogo={false} />

        {/* ── Scroll content ── */}
        <div className="scroll-content" style={{ background: FAMILY_COLORS.background }}>
          <div className="content-wrap">
            <div className="dashboard-stack">

              {/* ── 1. Hero Banner ── */}
              <div className="hero-banner">
                <div className="hero-deco-1" /><div className="hero-deco-2" /><div className="hero-deco-3" />
                <div className="hero-banner-inner">
                  <div className="hero-banner-main">
                    <div className="hero-banner-kicker">
                      <div className="hero-banner-kicker-icon">
                        <Heart size={16} color="#fff" />
                      </div>
                      <span className="hero-banner-eyebrow">Bridges of Hope — Family Portal</span>
                    </div>
                    <h1 className="hero-banner-title">
                      <span className="hero-banner-title-row">
                        <span>{greeting}, {firstName}</span>
                        <GreetingIcon size={22} color="#F54E25" className="hero-banner-title-icon" strokeWidth={2.25} aria-hidden />
                      </span>
                    </h1>
                    <p className="hero-banner-date">{dateStr} · Your care overview at a glance</p>
                  </div>
                  <div className="hero-mini-stats">
                    {[
                      { label: 'Residents', value: patients.length, color: '#A5B4FC' },
                      { label: 'Pending', value: totalPendingRequests, color: '#FCA5A5' },
                      { label: 'Reports', value: reportsReceivedCount, color: '#6EE7B7' },
                    ].map((s) => (
                      <div key={s.label} className="hero-mini-stat">
                        <p className="hero-mini-stat__label">{s.label}</p>
                        <p className="hero-mini-stat__value" style={{ color: s.color }}>{s.value}</p>
                      </div>
                    ))}
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
                  <div key={card.label} className="stat-card" style={{ borderColor: card.border, '--stat-accent': card.color }}>
                    <div className="stat-card-deco" style={{ background: card.bg }} />
                    <div className="stat-card-body">
                      <div>
                        <p className="stat-card-label">{card.label}</p>
                        <p className="stat-card-value">{card.value}</p>
                        <p className="stat-card-sub">{card.sub}</p>
                      </div>
                      <div className="stat-card-icon" style={{ background: card.bg, border: `1px solid ${card.border}` }}>
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
                    <div className="action-card-top">
                      <div className="icon-square"><FileText aria-hidden /></div>
                      <div className="action-arrow"><ArrowRight size={14} /></div>
                    </div>
                    <div className="action-title">Weekly Report</div>
                    <div className="action-subtitle">Review submitted weekly care updates from nursing staff</div>
                    <span className="action-badge" style={{ background: '#FFF1EB', color: '#C2410C' }}>{reportsReceivedCount} received</span>
                  </div>
                  <div className="action-card" onClick={() => navigate('/progress', { state: { tab: 'admission' } })}>
                    <div className="action-card-top">
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
                    <div className="action-card-top">
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
                    <div className="section-title"><Activity size={16} color="#F54E25" /> Dashboard Summary</div>
                    <p className="section-sub">Live overview of patient, request, and report data</p>
                  </div>
                  <span className="summary-updated-badge">Updated from live data</span>
                </div>
                <div className="insights-split">
                  {/* Graph */}
                  <div className="insight-panel">
                    <p className="insight-panel-title">Graph View</p>
                    <div className="graph-chart-shell">
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
                    <div className="graph-insight-banner">
                      Highest metric: <strong>{summaryGraphData.reduce((max, item) => (item.value > max.value ? item : max), summaryGraphData[0]).label}</strong>
                    </div>
                  </div>
                  {/* KPI */}
                  <div className="insight-panel">
                    <p className="insight-panel-title">Operational Insights</p>
                    <div className="kpi-grid">
                      {metricInsights.map((item) => (
                        <div key={item.label} className="kpi-item">
                          <div className="kpi-label">{item.label}</div>
                          <div className="kpi-value">{item.value}</div>
                          <div className="kpi-dot" style={{ background: item.color }} />
                          <div className="kpi-note">{item.note}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Tables */}
                <div className="summary-tables-wrap">
                  <div className="tables-row">
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
                  <p className="section-desc">Suggested actions to keep care coordination on track.</p>
                  <div className="clean-list">
                    <div className="clean-list-item">
                      <div>
                        <div className="clean-list-title">Review request management queue</div>
                        <div className="clean-list-sub">Check admission/discharge updates from staff</div>
                      </div>
                      <span className="mini-pill" style={{ background: '#FEF3C7', color: '#92400E', flexShrink: 0 }}>{totalPendingRequests||0} pending</span>
                    </div>
                    <div className="clean-list-item">
                      <div>
                        <div className="clean-list-title">Open patient details tab</div>
                        <div className="clean-list-sub">View status and progress of all patients</div>
                      </div>
                      <button type="button" className="clean-list-btn" onClick={() => navigate('/patient-details')} style={{ background: '#EEF2FF', color: '#3730A3' }}>Open</button>
                    </div>
                    <div className="clean-list-item">
                      <div>
                        <div className="clean-list-title">Check appointment slots</div>
                        <div className="clean-list-sub">Plan follow-ups and visit schedules</div>
                      </div>
                      <button type="button" className="clean-list-btn" onClick={() => navigate('/appointments')} style={{ background: '#ECFDF5', color: '#065F46' }}>View</button>
                    </div>
                  </div>
                </div>
                <div className="section-card" style={{ margin: 0 }}>
                  <div className="section-title" style={{ marginBottom: 6 }}><FileText size={16} color="#F54E25" /> Care Resources</div>
                  <div className="clean-list" style={{ marginTop: 8 }}>
                    <div className="clean-list-item">
                      <div className="clean-list-title">View Weekly Reports</div>
                      <button type="button" className="clean-list-btn" onClick={() => { setWeeklyReportExpandedPatientId(null); setShowReport(true); }} style={{ background: '#FFF1EB', color: '#C2410C' }}>Open</button>
                    </div>
                    <div className="clean-list-item">
                      <div className="clean-list-title">Go to Services</div>
                      <button type="button" className="clean-list-btn" onClick={() => { setShowServicesModal(true); setIsChatOpen(false); }} style={{ background: '#EEF2FF', color: '#3730A3' }}>Open</button>
                    </div>
                    <div className="clean-list-item">
                      <div className="clean-list-title">Manage Your Profile</div>
                      <button type="button" className="clean-list-btn" onClick={() => navigate('/profile')} style={{ background: '#ECFDF5', color: '#065F46' }}>Open</button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        <FamilyMobileBottomNav />
      </div>

      {/* ── Chat Window (unchanged logic) ── */}
      {isChatOpen && !showReport && !showServicesModal && (
        <div
          className="family-chat-window"
          style={{ '--family-chat-bottom': `${layoutCompact ? 90 : 100}px`, zIndex: 2000 }}
        >
          <header className="family-chat-header">
            <div className="family-chat-header__brand">
              <FamilyChatBrandMark />
              <div className="family-chat-header__text">
                <div className="family-chat-title">Bridges of Hope</div>
                <div className="family-chat-status">
                  <span className="family-chat-status__dot" aria-hidden />
                  <span>Care team</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="family-chat-close"
              onClick={() => setIsChatOpen(false)}
              aria-label="Close chat"
            >
              <X size={20} strokeWidth={2} aria-hidden />
            </button>
          </header>
          <div className="family-chat-body-wrap">
            <div className="family-chat-body" ref={chatBodyRef}>
              {chatLoading && <div className="family-chat-loading">Loading messages…</div>}
              <FamilyChatMessageList messages={messages} sending={chatSending} />
            </div>
          </div>
          {chatSendError ? (
            <div className="family-chat-error" role="alert">
              {chatSendError}
            </div>
          ) : null}
          <FamilyChatComposer
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSendMessage}
            sending={chatSending}
          />
        </div>
      )}

      {/* ── Chat FAB (unchanged logic) ── */}
      {!showReport && !showServicesModal && (
        <FamilyChatFab
          isOpen={isChatOpen}
          onClick={() => setIsChatOpen(!isChatOpen)}
          bottom={layoutCompact ? 90 : 30}
          style={{ zIndex: 1000 }}
        />
      )}
    </div>
  );
};

export default HomeDashboard;