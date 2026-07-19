import React, { useEffect, useMemo, useState } from 'react';
import {
  Home, User, LogOut, Calendar, BookUser, ClipboardList, FileText,
  CheckCircle2, Activity, X, ChevronRight,
  Users, Heart, Stethoscope, BookOpen
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import FamilySidebar from '@/components/family/FamilySidebar';
import FamilyMobileBottomNav from '@/components/family/FamilyMobileBottomNav';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { APP_DATA_REFRESH } from '@/lib/appDataRefresh';
import { uiPatientFromRow } from '@/lib/dbMappers';
import FloatingChatHead from '@/components/family/FloatingChatHead';
import FamilyPageHeader from '@/components/family/FamilyPageHeader';
import { FAMILY_PAGE_HEADERS } from '@/lib/familyPageHeaders';
import { useFamilyPageScroll } from '@/hooks/useFamilyPageScroll';
import BulletedListDisplay from '@/components/clinical/BulletedListDisplay';
import MedicationTableDisplay from '@/components/clinical/MedicationTableDisplay';
import { useFamilyPatientProgressRealtime } from '@/hooks/useFamilyPatientProgressRealtime';
import { isSupabasePatientId, resolveWeeklyReportsForPatient } from '@/lib/familyWeeklyReports';

/* ─── design-only helpers ─── */
function ProgressBar({ value = 0, color = '#F54E25', height = 7, className = '' }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <div className={`wr-progress${className ? ` ${className}` : ''}`} style={{ '--wr-progress-h': `${height}px` }}>
      <div className="wr-progress__track">
        <div className="wr-progress__fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function ResidentStatusPill({ progress, dischargedAt }) {
  if (dischargedAt) {
    return <span className="wr-status-pill wr-status-pill--discharged">Discharged</span>;
  }
  const p = Number(progress) || 0;
  if (p >= 70) return <span className="wr-status-pill wr-status-pill--stable">Stable</span>;
  if (p >= 40) return <span className="wr-status-pill wr-status-pill--recovering">Recovering</span>;
  return <span className="wr-status-pill wr-status-pill--attention">Needs Attention</span>;
}

function SectionLabel({ children }) {
  return <p className="wr-section-label">{children}</p>;
}

function ReportFieldRow({ label, value, icon: Icon, bulleted = false, medications = false }) {
  return (
    <div className={`wr-report-field${medications ? ' wr-report-field--wide' : ''}`}>
      <div className="wr-report-field__head">
        {Icon && <Icon size={13} color="#F54E25" />}
        <span>{label}</span>
      </div>
      <div className="wr-report-field__body">
        {medications ? (
          <MedicationTableDisplay value={value} emptyText="—" />
        ) : bulleted ? (
          <BulletedListDisplay value={value} emptyText={value || '—'} />
        ) : (
          value || '—'
        )}
      </div>
    </div>
  );
}

export default function FamilyReportsPage() {
  const navigate = useNavigate();
  const { scrollToTop } = useFamilyPageScroll();
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

  useFamilyPatientProgressRealtime();

  /* ── all data logic 100% unchanged ── */
  const formatDate = (iso) => { if (!iso) return 'N/A'; try { return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return 'N/A'; } };
  const calculateAge = (dob) => { if (!dob) return 'N/A'; const birth = new Date(dob); if (Number.isNaN(birth.getTime())) return 'N/A'; const today = new Date(); let age = today.getFullYear() - birth.getFullYear(); const m = today.getMonth() - birth.getMonth(); if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1; return age >= 0 ? age : 'N/A'; };

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setLoading(true); setLoadError('');
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
        const { data: patientRows, error: patientErr } = await supabase.from('patients').select('id, full_name, admitted_at, progress_percent, clinical_status, family_id, discharged_at, date_of_birth').eq('family_id', user.id).order('admitted_at', { ascending: false });
        if (patientErr) throw patientErr;
        let rows = patientRows || [];
        if (!rows.length) {
          const { data: admissionRows } = await supabase.from('admission_requests').select('id, patient_name, patient_birth_date, reason_for_admission, status, created_at, decided_at').eq('family_id', user.id).eq('status', 'approved').order('decided_at', { ascending: false });
          const names = [...new Set((admissionRows || []).map((a) => (a.patient_name || '').trim()).filter(Boolean))];
          let matched = [];
          if (names.length) {
            const { data: matchedRows } = await supabase.from('patients').select('id, full_name, admitted_at, progress_percent, clinical_status, family_id, discharged_at, date_of_birth').in('full_name', names).order('admitted_at', { ascending: false });
            matched = matchedRows || [];
          }
          if (matched.length) {
            rows = matched;
          } else {
            rows = (admissionRows || []).map((r) => ({ id: r.id, full_name: r.patient_name, admitted_at: r.decided_at || r.created_at, progress_percent: 0, clinical_status: 'Recovering', family_id: user.id, discharged_at: null, date_of_birth: r.patient_birth_date, primary_concern: r.reason_for_admission }));
          }
        }
        const mappedPatients = rows.map((row) => {
          const mapped = uiPatientFromRow(row);
          return {
            id: mapped?.id || row.id,
            name: mapped?.name || row.full_name || 'Resident',
            date: mapped?.date || formatDate(row.admitted_at),
            progress: mapped?.progress ?? 0,
            age: calculateAge(row.date_of_birth),
            discharged_at: row.discharged_at ?? mapped?.discharged_at ?? null,
          };
        });
        let ids = rows.map((r) => r.id).filter(isSupabasePatientId);
        try {
          const { data: familyIdRows } = await supabase.from('patients').select('id').eq('family_id', user.id);
          ids = [...new Set([...ids, ...(familyIdRows || []).map((r) => r.id).filter(isSupabasePatientId)])];
        } catch {
          /* ignore */
        }
        const byPatient = {};
        if (ids.length) {
          let reportRows = null;
          const direct = await supabase.from('weekly_reports').select('*').in('patient_id', ids).order('week_number', { ascending: true });
          reportRows = direct.data || null;
          if (direct.error || !(reportRows || []).length) {
            const rpc = await supabase.rpc('bh_family_weekly_reports');
            if (!rpc.error && rpc.data) {
              const idSet = new Set(ids.map((x) => String(x)));
              reportRows = (rpc.data || []).filter((row) => idSet.has(String(row.patient_id)));
            }
          }
          if (reportRows) {
            for (const row of reportRows) {
              const key = String(row.patient_id);
              if (!byPatient[key]) byPatient[key] = [];
              byPatient[key].push(row);
            }
            mappedPatients.forEach((p) => {
              const listId = String(p.id);
              if (byPatient[listId]) return;
              const match = rows.find(
                (r) => String(r.full_name || '').trim().toLowerCase() === String(p.name || '').trim().toLowerCase()
              );
              if (match && byPatient[String(match.id)]) byPatient[listId] = byPatient[String(match.id)];
            });
          }
        }
        if (!cancelled) {
          setPatients(mappedPatients); setWeeklyReportsByPatient(byPatient);
          setSelectedPatient((prev) => { if (!prev) return null; const next = mappedPatients.find((p) => String(p.id) === String(prev.id)); return next || null; });
        }
      } catch (e) { if (!cancelled) { setPatients([]); setWeeklyReportsByPatient({}); setLoadError(e?.message || 'Unable to load reports right now.'); } }
      finally { if (!cancelled) setLoading(false); }
    };
    loadData();
    window.addEventListener('storage', loadData); window.addEventListener(APP_DATA_REFRESH, loadData);
    return () => { cancelled = true; window.removeEventListener('storage', loadData); window.removeEventListener(APP_DATA_REFRESH, loadData); };
  }, []);

  const patientDetailsById = useMemo(() => {
    const m = {};
    patients.forEach((p) => {
      m[String(p.id)] = { id: p.id, full_name: p.name };
    });
    return m;
  }, [patients]);

  const reportsForPatient = useMemo(
    () => (patient) => resolveWeeklyReportsForPatient(patient, weeklyReportsByPatient, patientDetailsById),
    [weeklyReportsByPatient, patientDetailsById]
  );

  const allReports = useMemo(() => Object.values(weeklyReportsByPatient || {}).flat().filter(Boolean), [weeklyReportsByPatient]);
  const availableWeeks = useMemo(() => { const set = new Set(); for (const row of allReports) { if (row.week_number !== null && row.week_number !== undefined && row.week_number !== '') set.add(Number(row.week_number)); } return Array.from(set).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b); }, [allReports]);
  const selectedPatientReports = useMemo(() => {
    if (!selectedPatient) return [];
    return [...reportsForPatient(selectedPatient)].sort((a, b) => {
      const aw = Number(a.week_number) || 0;
      const bw = Number(b.week_number) || 0;
      if (aw !== bw) return bw - aw;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [selectedPatient, reportsForPatient]);
  const visibleReports = useMemo(() => selectedWeek === 'all' ? selectedPatientReports : selectedPatientReports.filter((r) => String(r.week_number) === String(selectedWeek)), [selectedPatientReports, selectedWeek]);
  const weeklyReport = visibleReports.find((r) => String(r.id) === String(selectedReportId)) || visibleReports[0] || null;

  useEffect(() => { if (!selectedPatient) { setSelectedReportId(''); return; } const next = visibleReports[0]; setSelectedReportId(next?.id ? String(next.id) : ''); }, [selectedPatient, selectedWeek, visibleReports]);
  useEffect(() => { if (!patientId || !patients.length) return; const match = patients.find((p) => String(p.id) === String(patientId)); if (match) setSelectedPatient(match); }, [patientId, patients]);
  /* derived */
  const patientInitials = (name) => name ? String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') : '?';

  return (
    <div className="family-portal wr-page app-container" style={{ touchAction: 'manipulation' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        button { font-family: inherit; }

        .wr-page.app-container {
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
        }
        .wr-page .main-view { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }

        /* ── Scroll & layout ── */
        .wr-page .scroll-content {
          flex: 1; overflow-y: auto;
          padding: clamp(16px, 2.5vw, 28px) clamp(16px, 2.8vw, 32px) clamp(28px, 4vw, 44px);
          background: #F8FAFF;
        }
        .wr-page .scroll-content::-webkit-scrollbar { width: 5px; }
        .wr-page .scroll-content::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.4); border-radius: 999px; }
        .wr-content-wrap {
          width: 100%; max-width: min(1560px, 100%); margin: 0 auto;
          display: grid; gap: clamp(16px, 2.2vw, 24px);
        }
        .wr-content-wrap > * { animation: wrFadeIn 0.28s cubic-bezier(0.4, 0, 0.2, 1) both; }
        .wr-content-wrap > *:nth-child(2) { animation-delay: 0.04s; }
        .wr-content-wrap > *:nth-child(3) { animation-delay: 0.08s; }
        @keyframes wrFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes wrSpin { to { transform: rotate(360deg); } }

        /* ── Hero ── */
        .wr-hero-banner {
          background: linear-gradient(128deg, #0f172a 0%, #1a2744 38%, #243056 62%, #3b2f7a 100%);
          border-radius: clamp(18px, 2.2vw, 24px);
          padding: clamp(24px, 3.5vw, 36px) clamp(22px, 3.2vw, 32px);
          box-shadow: 0 20px 56px rgba(15, 23, 42, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.1);
          position: relative; overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .wr-hero-banner::before {
          content: '';
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 60% 90% at 0% 0%, rgba(245, 78, 37, 0.22) 0%, transparent 58%),
            radial-gradient(ellipse 45% 65% at 100% 100%, rgba(99, 102, 241, 0.2) 0%, transparent 52%),
            radial-gradient(ellipse 30% 40% at 72% 18%, rgba(255, 255, 255, 0.06) 0%, transparent 70%);
          pointer-events: none;
        }
        .wr-hero-deco-1 { position: absolute; top: -55px; right: -35px; width: 220px; height: 220px; border-radius: 50%; background: rgba(255,255,255,0.05); }
        .wr-hero-deco-2 { position: absolute; bottom: -35px; right: 90px; width: 140px; height: 140px; border-radius: 50%; background: rgba(255,255,255,0.06); }
        .wr-hero-deco-3 { position: absolute; top: 20px; right: 200px; width: 80px; height: 80px; border-radius: 50%; background: rgba(245,78,37,0.18); box-shadow: 0 0 48px rgba(245, 78, 37, 0.28); }
        .wr-hero-inner { position: relative; z-index: 1; max-width: 640px; }
        .wr-hero-kicker { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .wr-hero-kicker-icon {
          width: 40px; height: 40px; border-radius: 13px;
          background: rgba(255,255,255,0.14); backdrop-filter: blur(10px);
          display: flex; align-items: center; justify-content: center;
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        }
        .wr-hero-eyebrow {
          font-size: clamp(0.625rem, 0.5vw + 0.5rem, 0.6875rem);
          color: rgba(255,255,255,0.6); font-weight: 600; letter-spacing: 0.11em; text-transform: uppercase;
        }
        .wr-hero-title {
          margin: 0; color: #fff;
          font-size: clamp(1.625rem, 2.8vw + 0.75rem, 2.125rem);
          font-weight: 900; letter-spacing: -0.03em; line-height: 1.1;
        }
        .wr-hero-sub {
          margin: 10px 0 0; color: rgba(255,255,255,0.62);
          font-size: clamp(0.8125rem, 0.5vw + 0.7rem, 0.9375rem); line-height: 1.55; max-width: 520px;
        }

        /* ── Selector section ── */
        .wr-selector-card {
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid #e9edf7;
          border-radius: 22px;
          padding: clamp(20px, 2.6vw, 26px) clamp(22px, 2.8vw, 28px);
          box-shadow: 0 8px 28px rgba(15, 23, 42, 0.05);
        }
        .wr-selector-head {
          display: flex; align-items: flex-start; justify-content: space-between;
          margin-bottom: clamp(16px, 2vw, 20px); flex-wrap: wrap; gap: 12px;
        }
        .wr-selector-title {
          margin: 0;
          font-size: clamp(0.9375rem, 0.5vw + 0.8rem, 1rem);
          font-weight: 900; color: #0f172a; letter-spacing: -0.02em;
          display: flex; align-items: center; gap: 10px;
        }
        .wr-selector-title__icon {
          width: 34px; height: 34px; border-radius: 11px;
          background: linear-gradient(145deg, #fff5f0, #fff1eb);
          border: 1px solid #ffdfd3;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(245, 78, 37, 0.1);
        }
        .wr-selector-sub { margin: 6px 0 0; font-size: 12px; color: #94a3b8; line-height: 1.45; }
        .wr-week-select {
          border: 1px solid #e9edf7; border-radius: 12px;
          padding: 10px 14px; font-size: 12px; font-weight: 700; color: #0f172a;
          background: #f8faff; cursor: pointer; outline: none; font-family: inherit;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
          transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }
        .wr-week-select:hover, .wr-week-select:focus {
          border-color: #d0dbf5;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
        }

        /* ── Resident grid & cards ── */
        .wr-resident-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: clamp(14px, 1.8vw, 18px);
        }
        .wr-resident-card {
          border: 1px solid #e9edf7;
          border-radius: 20px;
          background: #fff;
          padding: clamp(20px, 2.4vw, 24px);
          text-align: left;
          cursor: pointer;
          min-height: 168px;
          display: flex; flex-direction: column;
          box-shadow: 0 6px 22px rgba(15, 23, 42, 0.05);
          transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease, background 0.22s ease;
          position: relative; overflow: hidden;
        }
        .wr-resident-card::before {
          content: '';
          position: absolute; left: 0; top: 0; bottom: 0; width: 0;
          background: linear-gradient(180deg, #f54e25, #ea580c);
          border-radius: 20px 0 0 20px;
          transition: width 0.22s ease;
        }
        .wr-resident-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.1);
          border-color: #d0dbf5;
        }
        .wr-resident-card--selected {
          background: linear-gradient(180deg, #fffaf8 0%, #fff 100%);
          border-color: rgba(245, 78, 37, 0.35);
          box-shadow: 0 12px 32px rgba(245, 78, 37, 0.12), inset 0 0 0 1px rgba(245, 78, 37, 0.08);
        }
        .wr-resident-card--selected::before { width: 4px; }
        .wr-resident-card__top {
          display: flex; align-items: center; gap: 14px; margin-bottom: 14px;
        }
        .wr-resident-card__avatar {
          width: 56px; height: 56px; border-radius: 16px;
          background: linear-gradient(135deg, #eef2ff, #c7d2fe);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          border: 2px solid #e0e7ff;
          box-shadow: 0 8px 18px rgba(67, 56, 202, 0.12);
          transition: transform 0.2s ease, background 0.2s ease;
        }
        .wr-resident-card--selected .wr-resident-card__avatar {
          background: linear-gradient(135deg, #f54e25, #ea580c);
          border-color: rgba(255,255,255,0.2);
          box-shadow: 0 8px 20px rgba(245, 78, 37, 0.28);
        }
        .wr-resident-card__avatar span { font-size: 18px; font-weight: 900; color: #4338ca; }
        .wr-resident-card--selected .wr-resident-card__avatar span { color: #fff; }
        .wr-resident-card__info { min-width: 0; flex: 1; }
        .wr-resident-card__name {
          font-size: clamp(0.9375rem, 0.5vw + 0.8rem, 1.0625rem);
          font-weight: 900; color: #0f172a; letter-spacing: -0.02em; line-height: 1.2;
        }
        .wr-resident-card__meta {
          font-size: 11px; color: #94a3b8; margin-top: 4px; line-height: 1.45;
        }
        .wr-resident-card__progress-row {
          display: flex; align-items: center; gap: 10px; margin-bottom: 14px;
        }
        .wr-resident-card__progress-pct {
          font-size: 12px; font-weight: 800; color: #0f172a; flex-shrink: 0; min-width: 36px; text-align: right;
        }
        .wr-resident-card__footer {
          display: flex; align-items: center; justify-content: space-between;
          margin-top: auto; gap: 8px;
        }

        /* ── Progress bar ── */
        .wr-progress { flex: 1; min-width: 0; }
        .wr-progress__track {
          height: var(--wr-progress-h, 7px);
          background: #f1f5f9; border-radius: 999px; overflow: hidden;
          border: 1px solid #e9edf7;
        }
        .wr-progress__fill {
          height: 100%; border-radius: 999px;
          transition: width 0.45s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* ── Status & report badges ── */
        .wr-status-pill {
          display: inline-flex; align-items: center;
          padding: 5px 11px; border-radius: 999px;
          font-size: 10px; font-weight: 800; letter-spacing: 0.02em;
          line-height: 1.2; white-space: nowrap;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
          border: 1px solid transparent;
        }
        .wr-status-pill--stable { background: #ecfdf5; color: #166534; border-color: #bbf7d0; }
        .wr-status-pill--recovering { background: #fffbeb; color: #92400e; border-color: #fde68a; }
        .wr-status-pill--attention { background: #fef2f2; color: #991b1b; border-color: #fecaca; }
        .wr-status-pill--discharged { background: #f1f5f9; color: #475569; border-color: #e2e8f0; }
        .wr-report-count {
          display: inline-flex; align-items: center;
          padding: 5px 11px; border-radius: 999px;
          font-size: 10px; font-weight: 800; letter-spacing: 0.02em;
          border: 1px solid transparent;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
        }
        .wr-report-count--has { background: #eef2ff; color: #3730a3; border-color: #e0e7ff; }
        .wr-report-count--none { background: #f8fafc; color: #94a3b8; border-color: #e9edf7; }

        /* ── Loading & empty states ── */
        .wr-loading {
          display: flex; align-items: center; gap: 10px;
          padding: 20px 0; color: #64748b; font-size: 13px; font-weight: 600;
        }
        .wr-loading__spinner {
          width: 18px; height: 18px; border-radius: 50%;
          border: 2px solid #f54e25; border-top-color: transparent;
          animation: wrSpin 0.8s linear infinite;
        }
        .wr-empty-residents {
          text-align: center; padding: 44px 24px;
          border: 1px dashed #e9edf7; border-radius: 20px;
          background: linear-gradient(180deg, #fafbff 0%, #fff 100%);
        }
        .wr-empty-residents__icon {
          width: 64px; height: 64px; border-radius: 20px;
          background: linear-gradient(145deg, #f8fafc, #f1f5f9);
          border: 1px solid #e9edf7;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 16px;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
        }
        .wr-empty-residents__title { margin: 0; font-weight: 900; color: #1e293b; font-size: 16px; }
        .wr-empty-residents__sub { margin: 8px 0 0; color: #94a3b8; font-size: 13px; line-height: 1.55; }

        .wr-empty-viewer {
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid #e9edf7;
          border-radius: 22px;
          padding: clamp(40px, 6vw, 64px) clamp(24px, 4vw, 40px);
          text-align: center;
          box-shadow: 0 8px 28px rgba(15, 23, 42, 0.05);
          position: relative; overflow: hidden;
          min-height: 280px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
        }
        .wr-empty-viewer::before {
          content: '';
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 50% 60% at 20% 20%, rgba(245, 78, 37, 0.06) 0%, transparent 55%),
            radial-gradient(ellipse 40% 50% at 80% 80%, rgba(99, 102, 241, 0.06) 0%, transparent 50%);
          pointer-events: none;
        }
        .wr-empty-viewer__deco {
          position: absolute; width: 120px; height: 120px; border-radius: 50%;
          background: rgba(99, 102, 241, 0.04); top: -40px; right: -20px;
        }
        .wr-empty-viewer__icon-wrap {
          position: relative; z-index: 1;
          width: 72px; height: 72px; border-radius: 22px;
          background: linear-gradient(145deg, #fff5f0, #fff1eb);
          border: 1px solid #ffdfd3;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 18px;
          box-shadow: 0 12px 32px rgba(245, 78, 37, 0.12);
        }
        .wr-empty-viewer__title {
          position: relative; z-index: 1;
          margin: 0; font-weight: 900; color: #0f172a;
          font-size: clamp(1rem, 0.6vw + 0.85rem, 1.125rem); letter-spacing: -0.02em;
        }
        .wr-empty-viewer__sub {
          position: relative; z-index: 1;
          margin: 10px 0 0; color: #64748b; font-size: 13px; line-height: 1.55;
          max-width: 380px;
        }
        .wr-empty-viewer__hint {
          position: relative; z-index: 1;
          margin-top: 18px; display: inline-flex; align-items: center; gap: 8px;
          font-size: 12px; font-weight: 700; color: #4338ca;
          background: #eef2ff; border: 1px solid #e0e7ff;
          padding: 10px 16px; border-radius: 12px;
        }

        /* ── Modal ── */
        .wr-modal-overlay {
          position: fixed; inset: 0;
          background: rgba(15, 23, 42, 0.55);
          backdrop-filter: blur(12px);
          display: flex; justify-content: center; align-items: center;
          z-index: 3000; padding: 16px; box-sizing: border-box;
        }
        .wr-modal-shell {
          width: min(960px, 100%);
          max-height: min(90vh, 920px);
          background: #fff; border-radius: 24px; overflow: hidden;
          box-shadow: 0 32px 80px rgba(15, 23, 42, 0.28);
          display: flex; flex-direction: column;
          border: 1px solid #e9edf7;
          animation: wrFadeIn 0.25s ease;
        }
        .wr-modal-header {
          background: linear-gradient(128deg, #0f172a 0%, #1a2744 38%, #243056 62%, #3b2f7a 100%);
          padding: clamp(20px, 2.5vw, 24px) clamp(22px, 2.8vw, 26px);
          position: relative; overflow: hidden; flex-shrink: 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .wr-modal-header::before {
          content: '';
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 50% 80% at 100% 0%, rgba(99, 102, 241, 0.2) 0%, transparent 55%),
            radial-gradient(ellipse 40% 60% at 0% 100%, rgba(245, 78, 37, 0.15) 0%, transparent 50%);
          pointer-events: none;
        }
        .wr-modal-header-inner { position: relative; display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
        .wr-modal-kicker {
          font-size: 10px; color: rgba(255,255,255,0.5); font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px;
        }
        .wr-modal-title {
          font-size: clamp(1.125rem, 1.5vw + 0.75rem, 1.375rem);
          color: #fff; font-weight: 900; letter-spacing: -0.02em; line-height: 1.25;
        }
        .wr-modal-title-accent { color: #fda4af; }
        .wr-modal-meta { font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 6px; line-height: 1.5; }
        .wr-modal-progress-wrap {
          margin-top: 14px; height: 6px;
          background: rgba(255,255,255,0.12); border-radius: 999px; overflow: hidden; max-width: 400px;
        }
        .wr-modal-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #6ee7b7, #34d399);
          border-radius: 999px;
          transition: width 0.45s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .wr-modal-close {
          width: 38px; height: 38px; border-radius: 12px; border: none;
          background: rgba(255,255,255,0.1); color: #fff;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; flex-shrink: 0;
          transition: background 0.18s ease, transform 0.18s ease;
        }
        .wr-modal-close:hover { background: rgba(255,255,255,0.18); transform: scale(1.04); }
        .wr-modal-body {
          flex: 1; min-height: 0; overflow: hidden;
          display: grid; grid-template-columns: 260px minmax(0, 1fr);
          background: #f8faff;
        }
        .wr-modal-timeline {
          border-right: 1px solid #e9edf7;
          padding: clamp(14px, 2vw, 18px);
          overflow-y: auto; background: #fff;
        }
        .wr-section-label {
          margin: 0 0 12px;
          font-size: 10px; font-weight: 700; color: #94a3b8;
          text-transform: uppercase; letter-spacing: 0.08em;
        }
        .wr-timeline-item {
          width: 100%; border: 1px solid #e9edf7; border-radius: 16px;
          background: #fff; padding: 14px 16px; text-align: left;
          margin-bottom: 10px; cursor: pointer;
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease;
          box-shadow: 0 2px 10px rgba(15, 23, 42, 0.03);
        }
        .wr-timeline-item:hover {
          border-color: #d0dbf5;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
          transform: translateX(2px);
        }
        .wr-timeline-item--active {
          border-color: rgba(245, 78, 37, 0.4);
          background: linear-gradient(180deg, #fffaf8 0%, #fff 100%);
          box-shadow: 0 8px 22px rgba(245, 78, 37, 0.1);
        }
        .wr-timeline-item__top {
          display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;
        }
        .wr-timeline-item__week {
          font-size: 13px; font-weight: 900; color: #0f172a; letter-spacing: -0.01em;
        }
        .wr-timeline-item--active .wr-timeline-item__week { color: #f54e25; }
        .wr-timeline-item__dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #f54e25; box-shadow: 0 0 8px rgba(245, 78, 37, 0.5);
        }
        .wr-timeline-item__date { font-size: 11px; color: #94a3b8; font-weight: 600; }
        .wr-modal-detail {
          overflow-y: auto;
          padding: clamp(18px, 2.4vw, 24px) clamp(20px, 2.6vw, 26px);
          animation: wrFadeIn 0.28s ease;
        }
        .wr-report-detail-head { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9; }
        .wr-report-detail-eyebrow {
          font-size: 10px; color: #94a3b8; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px;
        }
        .wr-report-detail-title {
          font-size: clamp(1.0625rem, 1vw + 0.85rem, 1.25rem);
          font-weight: 900; color: #0f172a; letter-spacing: -0.02em;
        }
        .wr-report-detail-progress {
          display: flex; align-items: center; gap: 10px; margin-top: 12px;
        }
        .wr-report-detail-progress span {
          font-size: 12px; font-weight: 900; color: #f54e25; flex-shrink: 0;
        }
        .wr-report-fields {
          display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
        }
        .wr-report-field {
          background: #fff; border: 1px solid #e9edf7;
          border-radius: 16px; padding: 16px 18px;
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
          transition: box-shadow 0.18s ease;
        }
        .wr-report-field:hover { box-shadow: 0 8px 22px rgba(15, 23, 42, 0.06); }
        .wr-report-field--wide { grid-column: 1 / -1; }
        .wr-report-field__head {
          display: flex; align-items: center; gap: 6px; margin-bottom: 8px;
        }
        .wr-report-field__head span {
          font-size: 10px; font-weight: 700; color: #94a3b8;
          text-transform: uppercase; letter-spacing: 0.07em;
        }
        .wr-report-field__body {
          font-size: 13px; font-weight: 700; color: #0f172a; line-height: 1.55;
        }
        .wr-modal-empty {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          height: 100%; color: #94a3b8; gap: 12px; padding: 24px;
        }
        .wr-modal-empty__icon {
          width: 56px; height: 56px; border-radius: 18px;
          background: #f1f5f9; border: 1px solid #e9edf7;
          display: flex; align-items: center; justify-content: center;
        }

        .mobile-top-bar { display: none; }
        .mobile-bottom-nav { display: none; }

        @media (min-width: 1600px) {
          .wr-content-wrap { max-width: min(1680px, 100%); }
        }
        @media (max-width: 899px) {
          .wr-resident-grid { grid-template-columns: 1fr; }
          .wr-modal-body { grid-template-columns: 1fr; }
          .wr-modal-timeline { border-right: none; border-bottom: 1px solid #e9edf7; max-height: 220px; }
          .wr-report-fields { grid-template-columns: 1fr; }
        }
        @media (max-width: 768px) {
          .wr-page .scroll-content { padding: 14px !important; padding-bottom: 90px !important; }
          .mobile-bottom-nav { display: flex !important; }
        }
      `}</style>

      <FamilySidebar
        isExpanded={isExpanded}
        onToggleExpanded={() => setIsExpanded(!isExpanded)}
      />

      {/* ── MAIN ── */}
      <div className="main-view">

        <FamilyPageHeader
          title={FAMILY_PAGE_HEADERS.reports.title}
          subtitle={`${patients.length} resident${patients.length !== 1 ? 's' : ''} · ${FAMILY_PAGE_HEADERS.reports.subtitle}`}
          onBrandPress={scrollToTop}
          showMobileLogo={false}
        />

        <div className="scroll-content">
          <div className="wr-content-wrap">

            {/* ① HERO BANNER */}
            <div className="wr-hero-banner">
              <div className="wr-hero-deco-1" /><div className="wr-hero-deco-2" /><div className="wr-hero-deco-3" />
              <div className="wr-hero-inner">
                <div className="wr-hero-kicker">
                  <div className="wr-hero-kicker-icon">
                    <FileText size={16} color="#fff" />
                  </div>
                  <span className="wr-hero-eyebrow">Family Portal · Weekly Reports</span>
                </div>
                <h1 className="wr-hero-title">Patient Weekly Reports</h1>
                <p className="wr-hero-sub">Select a resident to view their full report history and care updates</p>
              </div>
            </div>

            {/* ② PATIENT SELECTOR */}
            <div className="wr-selector-card">
              <div className="wr-selector-head">
                <div>
                  <h3 className="wr-selector-title">
                    <span className="wr-selector-title__icon"><Users size={14} color="#F54E25" /></span>
                    Select a Resident
                  </h3>
                  <p className="wr-selector-sub">Tap a card to view that resident&apos;s full report history</p>
                </div>
                {selectedPatient && (
                  <select value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)} className="wr-week-select">
                    <option value="all">All Weeks</option>
                    {availableWeeks.map((w) => <option key={w} value={String(w)}>Week {w}</option>)}
                  </select>
                )}
              </div>

              {loading && (
                <div className="wr-loading">
                  <div className="wr-loading__spinner" />
                  Loading live reports…
                </div>
              )}
              {loadError && <div style={{ color: '#EF4444', fontSize: 12, fontWeight: 700, padding: '10px 0' }}>{loadError}</div>}
              {!loading && !patients.length && !loadError && (
                <div className="wr-empty-residents">
                  <div className="wr-empty-residents__icon"><FileText size={26} color="#CBD5E1" /></div>
                  <p className="wr-empty-residents__title">No Assigned Patients</p>
                  <p className="wr-empty-residents__sub">Once patients are admitted, their reports will appear here.</p>
                </div>
              )}

              <div className="wr-resident-grid">
                {patients.map((p) => {
                  const reportCount = reportsForPatient(p).length;
                  const progress = Number(p.progress) || 0;
                  const isActive = selectedPatient && String(selectedPatient.id) === String(p.id);
                  const isDischarged = Boolean(p.discharged_at);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`wr-resident-card${isActive ? ' wr-resident-card--selected' : ''}`}
                      onClick={() => setSelectedPatient(p)}
                    >
                      <div className="wr-resident-card__top">
                        <div className="wr-resident-card__avatar">
                          <span>{patientInitials(p.name)}</span>
                        </div>
                        <div className="wr-resident-card__info">
                          <div className="wr-resident-card__name">{p.name}</div>
                          <div className="wr-resident-card__meta">
                            Age {p.age} · Admitted {p.date || 'N/A'}
                            {isDischarged ? ` · Discharged ${formatDate(p.discharged_at)}` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="wr-resident-card__progress-row">
                        <ProgressBar value={progress} color={isActive ? '#F54E25' : '#6366F1'} />
                        <span className="wr-resident-card__progress-pct">{progress}%</span>
                      </div>
                      <div className="wr-resident-card__footer">
                        <ResidentStatusPill progress={progress} dischargedAt={p.discharged_at} />
                        <span className={`wr-report-count ${reportCount > 0 ? 'wr-report-count--has' : 'wr-report-count--none'}`}>
                          {reportCount} report{reportCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ③ EMPTY VIEWER STATE */}
            {!loading && patients.length > 0 && !selectedPatient && (
              <div className="wr-empty-viewer">
                <div className="wr-empty-viewer__deco" />
                <div className="wr-empty-viewer__icon-wrap">
                  <BookOpen size={30} color="#F54E25" />
                </div>
                <h2 className="wr-empty-viewer__title">Select a resident to view weekly reports</h2>
                <p className="wr-empty-viewer__sub">
                  Resident reports will appear here after selection. Choose a card above to open the full care timeline and weekly summaries.
                </p>
                <span className="wr-empty-viewer__hint">
                  <ChevronRight size={14} /> Tap any resident card to get started
                </span>
              </div>
            )}

          </div>
        </div>

        <FamilyMobileBottomNav />
      </div>

      {/* ══════════════════════════════════
          REPORT MODAL (functionality 100% unchanged, design improved)
      ══════════════════════════════════ */}
      {selectedPatient && (
        <div className="wr-modal-overlay" onClick={() => setSelectedPatient(null)}>
          <div className="wr-modal-shell" onClick={(e) => e.stopPropagation()}>

            <div className="wr-modal-header">
              <div className="wr-modal-header-inner">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="wr-modal-kicker">Care Updates · Bridges of Hope</div>
                  <div className="wr-modal-title">
                    <span className="wr-modal-title-accent">{selectedWeek === 'all' ? 'Full Report History' : `Week ${selectedWeek}`}</span>
                    {' '}— {selectedPatient.name}
                  </div>
                  <div className="wr-modal-meta">
                    {visibleReports.length} report{visibleReports.length !== 1 ? 's' : ''} · Progress: {Number(selectedPatient.progress) || 0}%
                    {selectedPatient.discharged_at ? (
                      <span style={{ display: 'block', marginTop: 6, color: 'rgba(253,164,175,0.95)', fontWeight: 700 }}>
                        Discharged {formatDate(selectedPatient.discharged_at)}
                      </span>
                    ) : null}
                  </div>
                  <div className="wr-modal-progress-wrap">
                    <div className="wr-modal-progress-fill" style={{ width: `${Number(selectedPatient.progress) || 0}%` }} />
                  </div>
                </div>
                <button type="button" className="wr-modal-close" onClick={() => setSelectedPatient(null)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="wr-modal-body">
              <div className="wr-modal-timeline">
                <SectionLabel>Report History</SectionLabel>
                {!visibleReports.length ? (
                  <div style={{ color: '#94A3B8', fontSize: 12, fontWeight: 600, padding: '12px 0' }}>No reports for this filter.</div>
                ) : visibleReports.map((row) => {
                  const isActive = weeklyReport && String(weeklyReport.id) === String(row.id);
                  return (
                    <button
                      key={row.id || `${row.patient_id}-${row.week_number}-${row.created_at}`}
                      type="button"
                      className={`wr-timeline-item${isActive ? ' wr-timeline-item--active' : ''}`}
                      onClick={() => setSelectedReportId(String(row.id))}
                    >
                      <div className="wr-timeline-item__top">
                        <span className="wr-timeline-item__week">Week {row.week_number || '-'}</span>
                        {isActive && <div className="wr-timeline-item__dot" />}
                      </div>
                      <div className="wr-timeline-item__date">{formatDate(row.submitted_at || row.created_at)}</div>
                      {row.progress_percent != null && (
                        <div style={{ marginTop: 10 }}>
                          <ProgressBar value={row.progress_percent} color={isActive ? '#F54E25' : '#6366F1'} height={5} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="wr-modal-detail" key={weeklyReport?.id || 'empty'}>
                {!weeklyReport ? (
                  <div className="wr-modal-empty">
                    <div className="wr-modal-empty__icon"><FileText size={24} color="#CBD5E1" /></div>
                    <p style={{ margin: 0, fontWeight: 700, color: '#64748B', fontSize: 14 }}>No report selected</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#94A3B8' }}>Choose a week from the left panel</p>
                  </div>
                ) : (
                  <>
                    <div className="wr-report-detail-head">
                      <div className="wr-report-detail-eyebrow">
                        Week {weeklyReport.week_number || '-'} · {formatDate(weeklyReport.submitted_at || weeklyReport.created_at)}
                      </div>
                      <div className="wr-report-detail-title">{selectedPatient.name}</div>
                      {weeklyReport.progress_percent != null && (
                        <div className="wr-report-detail-progress">
                          <ProgressBar value={weeklyReport.progress_percent} color="#F54E25" />
                          <span>{weeklyReport.progress_percent}%</span>
                        </div>
                      )}
                    </div>

                    <div className="wr-report-fields">
                      <ReportFieldRow icon={Stethoscope} label="Current Medications" value={weeklyReport?.current_medications} medications />
                      <ReportFieldRow icon={BookOpen} label="Summary" value={weeklyReport?.summary || weeklyReport?.report_summary || 'No report available.'} />
                      <ReportFieldRow icon={Activity} label="Progress" value={weeklyReport?.progress_percent != null ? `${weeklyReport.progress_percent}%` : 'N/A'} />
                      <ReportFieldRow icon={FileText} label="Dietary Restrictions" value={weeklyReport?.dietary_restrictions} bulleted />
                      <ReportFieldRow icon={Heart} label="Ongoing Medical Concern" value={weeklyReport?.ongoing_medical_concern || weeklyReport?.behavior_observation} bulleted />
                      <ReportFieldRow icon={FileText} label="Nurse Notes" value={weeklyReport?.nurse_note || weeklyReport?.notes || 'No notes available.'} />
                      <ReportFieldRow icon={Heart} label="Behavior / Mood" value={weeklyReport?.behavior_observation || weeklyReport?.mood_assessment || 'No behavior notes.'} />
                      <ReportFieldRow icon={CheckCircle2} label="Recommendations" value={weeklyReport?.recommendations || weeklyReport?.plan_next_week || 'No recommendations.'} />
                      <ReportFieldRow icon={Calendar} label="Submitted" value={formatDate(weeklyReport?.submitted_at || weeklyReport?.created_at)} />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <FloatingChatHead />
    </div>
  );
}