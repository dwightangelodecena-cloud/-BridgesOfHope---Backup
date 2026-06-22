import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Home, User, LogOut, Calendar, BookUser, ClipboardList, FileText, X,
  CheckCircle2, TrendingUp, Stethoscope,
  ArrowRight, ChevronRight, Shield
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logo from '@/assets/kalingalogo.png';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { uiPatientFromRow } from '@/lib/dbMappers';
import { computeAdmissionDisplayId } from '@/lib/admissionDischargeStore';
import { APP_DATA_REFRESH, refreshAppData } from '@/lib/appDataRefresh';
import {
  isPatientOnTemporaryLeave,
  mergePatientTemporaryDischargeFields,
  patientTemporaryDischargeStatusLabel,
} from '@/lib/dischargeRequestTypes';
import { returnResidentFromTemporaryLeave } from '@/lib/dischargeRequestWorkflow';
import {
  mergePatientWithRequestTemporaryLeave,
  syncPatientTemporaryLeaveFromRequests,
} from '@/lib/temporaryLeaveSync';
import {
  ResidentReturnedConfirmModal,
  ResidentReturnedHeaderButton,
  TemporaryDischargeCardBanner,
  TemporaryDischargeNotePanel,
} from '@/components/TemporaryDischargeNotice';
import FloatingChatHead from '@/components/family/FloatingChatHead';
import FamilyPageHeader from '@/components/family/FamilyPageHeader';
import { useFamilyPatientProgressRealtime } from '@/hooks/useFamilyPatientProgressRealtime';
import {
  canonicalPatientId,
  fetchWeeklyReportsForPatientId,
  isSupabasePatientId,
  mergeReportsIntoByPatient,
  resolveWeeklyReportsForPatient,
} from '@/lib/familyWeeklyReports';

/* ─── unchanged helpers ─── */
const formatDate = (iso) => {
  if (!iso) return 'N/A';
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return 'N/A'; }
};
const calculateAge = (dob) => {
  if (!dob) return 'N/A';
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return 'N/A';
  const n = new Date(); let age = n.getFullYear() - d.getFullYear();
  const m = n.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < d.getDate())) age -= 1;
  return age >= 0 ? age : 'N/A';
};

/* ─── design-only components ─── */
function ProgressRing({ pct = 0, size = 56, stroke = 5, color = '#F54E25' }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, pct)) / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F1F5F9" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${filled} ${circ-filled}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x={size/2} y={size/2+1} textAnchor="middle" fontSize="11" fontWeight="900" fill="#0F172A" dominantBaseline="middle">{pct}%</text>
    </svg>
  );
}

function StatusPill({ progress, dischargedAt, onTemporaryLeave }) {
  if (onTemporaryLeave) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 800, background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}>
        Temporarily discharged
      </span>
    );
  }
  if (dischargedAt) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 800, background: '#E2E8F0', color: '#475569', border: '1px solid #CBD5E1' }}>
        Discharged
      </span>
    );
  }
  const p = Number(progress) || 0;
  const cfg = p >= 70
    ? { label: 'Stable', bg: '#DCFCE7', color: '#166534' }
    : p >= 40
    ? { label: 'Recovering', bg: '#FEF3C7', color: '#92400E' }
    : { label: 'Needs Attention', bg: '#FEE2E2', color: '#991B1B' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 800, background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function VitalRow({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #F8FAFC' }}>
      <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 800, color: '#0F172A' }}>{value}</span>
    </div>
  );
}

function DataRow({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: '1px solid #F8FAFC' }}>
      <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', textAlign: 'right' }}>{value || '—'}</span>
    </div>
  );
}

function SectionCard({ children, style = {}, onTemporaryLeave = false, temporaryPatient = null, temporaryLeaveRequestFields = null }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E9EDF7', borderRadius: 20, padding: '18px 20px', boxShadow: '0 4px 20px rgba(15,23,42,0.05)', overflow: 'hidden', ...style }}>
      {onTemporaryLeave ? (
        <TemporaryDischargeCardBanner
          patient={temporaryPatient}
          variant="section"
          requestFields={temporaryLeaveRequestFields}
        />
      ) : null}
      {children}
    </div>
  );
}

function CardTitle({ icon: Icon, children, color = '#F54E25' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: '#FFF1EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={14} color={color} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.01em' }}>{children}</span>
    </div>
  );
}

/* ══════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════ */
const PatientDetailsPage = () => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [patients, setPatients] = useState([]);
  const [patientDetailsById, setPatientDetailsById] = useState({});
  const [weeklyReportsByPatient, setWeeklyReportsByPatient] = useState({});
  const [patientImages, setPatientImages] = useState({});
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [residentReturnBusy, setResidentReturnBusy] = useState(false);
  const [showResidentReturnConfirm, setShowResidentReturnConfirm] = useState(false);
  const [temporaryLeaveFromRequest, setTemporaryLeaveFromRequest] = useState(null);
  const [familyUserId, setFamilyUserId] = useState('');
  const fileInputRefs = useRef([]);

  useFamilyPatientProgressRealtime();

  /* ── all data-loading useEffects UNCHANGED ── */
  useEffect(() => {
    let cancelled = false;
    const loadPatients = async () => {
      if (!isSupabaseConfigured()) {
        const saved = localStorage.getItem('bh_patients');
        if (!cancelled) { setPatients(saved ? JSON.parse(saved) : []); setPatientDetailsById({}); setWeeklyReportsByPatient({}); }
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!cancelled) { setPatients([]); setPatientDetailsById({}); setWeeklyReportsByPatient({}); setFamilyUserId(''); } return; }
      if (!cancelled) setFamilyUserId(user.id);

      const fetchPatientsRows = async () => {
        const safeSelect = 'id, full_name, admitted_at, created_at, progress_percent, clinical_status, primary_concern, family_id, discharged_at';
        const runQuery = (selectClause, scopeFamily = true) => {
          let q = supabase.from('patients').select(selectClause).order('admitted_at', { ascending: false });
          if (scopeFamily) q = q.eq('family_id', user.id);
          return q;
        };
        return runQuery(safeSelect, true);
      };

      const { data: rows, error } = await fetchPatientsRows();

      const mapApprovedAdmissionsToPatients = async () => {
        const { data: admissions, error: admissionsError } = await supabase.from('admission_requests').select('id, patient_name, patient_birth_date, reason_for_admission, status, created_at, decided_at').eq('family_id', user.id).eq('status', 'approved').order('decided_at', { ascending: false });
        if (admissionsError || !(admissions || []).length) return [];
        const names = [...new Set((admissions || []).map((a) => (a.patient_name || '').trim()).filter(Boolean))];
        const detailsByName = {};
        if (names.length) {
          const { data: matchedRows } = await supabase.from('patients').select('id, full_name, admitted_at, progress_percent, clinical_status, family_id, discharged_at, date_of_birth, gender, primary_concern, room_code, room_gender_segment, case_load_manager, program_staff, medical_staff_note, progress_updated_at, current_weight, weight_kg, height_cm, bmi, bp, pr, rr, spo2, temperature_f, blood_pressure, pulse_rate, respiratory_rate, oxygen_saturation, temperature').in('full_name', names).order('admitted_at', { ascending: false });
          (matchedRows || []).forEach((row) => { const key = String(row.full_name || '').trim().toLowerCase(); if (key && !detailsByName[key]) detailsByName[key] = row; });
        }
        return admissions.map((a) => {
          const name = a.patient_name || 'Approved Resident';
          const matched = detailsByName[String(name).trim().toLowerCase()] || null;
          return { id: matched?.id || `admission-${a.id}`, name, date: formatDate(a.decided_at || a.created_at), progress: Number(matched?.progress_percent) || 0, reason: a.reason_for_admission || '', status: matched?.clinical_status || 'Recovering', dateOfBirth: matched?.date_of_birth || a.patient_birth_date || '', roomCode: matched?.room_code || '', discharged_at: matched?.discharged_at ?? null };
        });
      };

      const fetchPatientsFromApprovedAdmissions = async () => {
        const safeSelect = 'id, full_name, admitted_at, created_at, progress_percent, clinical_status, primary_concern, family_id, discharged_at';
        const { data: admissions, error: admissionsError } = await supabase.from('admission_requests').select('patient_name').eq('family_id', user.id).eq('status', 'approved');
        if (admissionsError || !(admissions || []).length) return [];
        const names = [...new Set((admissions || []).map((a) => (a.patient_name || '').trim()).filter(Boolean))];
        if (!names.length) return [];
        const { data: matchedRows, error: queryError } = await supabase.from('patients').select(safeSelect).in('full_name', names).order('admitted_at', { ascending: false });
        if (queryError) return [];
        return matchedRows || [];
      };

      if (!cancelled) {
        if (error) {
          const approvedFallback = await mapApprovedAdmissionsToPatients();
          if (approvedFallback.length) {
            setPatients(approvedFallback);
            const fallbackIds = approvedFallback.map((p) => p.id).filter((id) => id && !String(id).startsWith('admission-'));
            if (fallbackIds.length) {
              const { data: reportRows } = await supabase.from('weekly_reports').select('*').in('patient_id', fallbackIds).order('week_number', { ascending: true });
              const byPatient = {};
              (reportRows || []).forEach((row) => { const key = String(row.patient_id); if (!byPatient[key]) byPatient[key] = []; byPatient[key].push(row); });
              setWeeklyReportsByPatient(byPatient);
            } else { setWeeklyReportsByPatient({}); }
          } else { setPatients([]); setWeeklyReportsByPatient({}); }
          setPatientDetailsById({});
        } else {
          const mappedPatients = (rows || []).map((r) => uiPatientFromRow(r)).filter(Boolean);
          if (mappedPatients.length > 0) {
            setPatients(mappedPatients);
          } else {
            const resolvedFromApproved = await fetchPatientsFromApprovedAdmissions();
            if (resolvedFromApproved.length) {
              const resolvedMapped = resolvedFromApproved.map((r) => uiPatientFromRow(r)).filter(Boolean);
              setPatients(resolvedMapped);
              const resolvedDetails = {};
              for (const row of resolvedFromApproved) resolvedDetails[String(row.id)] = row;
              setPatientDetailsById(resolvedDetails);
            } else {
              const approvedFallback = await mapApprovedAdmissionsToPatients();
              if (approvedFallback.length) { setPatients(approvedFallback); } else { setPatients([]); }
            }
          }
          const details = {};
          for (const row of rows || []) details[String(row.id)] = row;
          const activeRows = (rows && rows.length) ? rows : await fetchPatientsFromApprovedAdmissions();
          const detailsForIds = {};
          for (const row of rows || []) detailsForIds[String(row.id)] = row;
          let ids = [
            ...new Set(
              [
                ...(activeRows || []).map((r) => r.id),
                ...(mappedPatients.length ? mappedPatients : []).map((p) =>
                  canonicalPatientId(p, detailsForIds)
                ),
              ]
                .filter(Boolean)
                .filter(isSupabasePatientId)
            ),
          ];
          try {
            const { data: familyIdRows } = await supabase
              .from('patients')
              .select('id')
              .eq('family_id', user.id);
            ids = [
              ...new Set([
                ...ids,
                ...(familyIdRows || []).map((r) => r.id).filter(isSupabasePatientId),
              ]),
            ];
          } catch {
            /* ignore */
          }
          if (ids.length) {
            const { data: detailRows } = await supabase.from('patients').select('*').in('id', ids);
            if ((detailRows || []).length) {
              const fullDetails = {};
              for (const row of detailRows) fullDetails[String(row.id)] = row;
              setPatientDetailsById(fullDetails);
              setPatients((prev) =>
                prev.map((p) => {
                  const d = fullDetails[String(p.id)];
                  if (!d) return p;
                  const raw = d.progress_percent;
                  if (raw === undefined || raw === null || raw === '') return p;
                  const pct = Math.min(100, Math.max(0, Number(raw)));
                  if (!Number.isFinite(pct) || Number(p.progress) === pct) return p;
                  return { ...p, progress: pct };
                })
              );
            } else if (Object.keys(details).length) { setPatientDetailsById(details); }
          } else if (Object.keys(details).length) { setPatientDetailsById(details); }
          if (!ids.length) { setWeeklyReportsByPatient({}); return; }
          let reportRows = null, reportError = null;
          const directReports = await supabase.from('weekly_reports').select('*').in('patient_id', ids).order('week_number', { ascending: true });
          reportRows = directReports.data || null; reportError = directReports.error || null;
          if (reportError || !(reportRows || []).length) {
            const rpcReports = await supabase.rpc('bh_family_weekly_reports');
            if (!rpcReports.error && rpcReports.data) {
              const idSet = new Set(ids.map((x) => String(x)));
              reportRows = (rpcReports.data || []).filter((row) => idSet.has(String(row.patient_id)));
              reportError = null;
            }
          }
          const byPatient = {};
          if (!reportError && reportRows) {
            for (const row of reportRows) { const key = String(row.patient_id); if (!byPatient[key]) byPatient[key] = []; byPatient[key].push(row); }
          }
          try {
            const raw = localStorage.getItem('bh_nurse_weekly_reports');
            const localAll = raw ? JSON.parse(raw) : {};
            const makeLocalReport = (pid, weekNum, entry) => ({ id: `local-${pid}-${weekNum}`, patient_id: pid, week_number: Number(weekNum), submitted_at: entry.submittedAt ?? null, nurse_name: entry.nurseName ?? entry.nurse_name ?? '', report_date: entry.reportDate ?? entry.report_date ?? '', summary: entry.summary ?? entry.report_summary ?? '', nurse_note: entry.nurseNote ?? entry.nurse_note ?? entry.notes ?? '', notes: entry.notes ?? '', behavior_observation: entry.behaviorObservation ?? entry.behavior_observation ?? '', recommendations: entry.recommendations ?? entry.plan_next_week ?? '', vitals_weight: entry.vitalsWeight ?? entry.vitals_weight ?? '', vitals_height: entry.vitalsHeight ?? entry.vitals_height ?? '', vitals_bp: entry.vitalsBp ?? entry.vitals_bp ?? '', vitals_pr: entry.vitalsPr ?? entry.vitals_pr ?? '', vitals_rr: entry.vitalsRr ?? entry.vitals_rr ?? '', vitals_temperature: entry.vitalsTemperature ?? entry.vitals_temperature ?? '', vitals_bmi: entry.vitalsBmi ?? entry.vitals_bmi ?? '', vitals_spo2: entry.vitalsSpo2 ?? entry.vitals_spo2 ?? '' });
            ids.forEach((pid) => {
              const key = String(pid);
              const localWeeks = localAll?.[key];
              if (!localWeeks || typeof localWeeks !== 'object') return;
              if (!byPatient[key]) byPatient[key] = [];
              const existingWeeks = new Set(byPatient[key].map((r) => String(r.week_number)));
              Object.entries(localWeeks).forEach(([weekNum, entry]) => { if (!entry || typeof entry !== 'object') return; if (existingWeeks.has(String(weekNum))) return; byPatient[key].push(makeLocalReport(key, weekNum, entry)); });
              byPatient[key].sort((a, b) => (Number(a.week_number) || 0) - (Number(b.week_number) || 0));
            });
            const rowsByName = {};
            (activeRows || []).forEach((row) => { const n = String(row.full_name || '').trim().toLowerCase(); if (!n) return; rowsByName[n] = row; });
            Object.entries(localAll || {}).forEach(([cachePid, weeks]) => {
              if (!weeks || typeof weeks !== 'object') return;
              Object.entries(weeks).forEach(([weekNum, entry]) => {
                const residentName = String(entry?.patientName || '').trim().toLowerCase();
                if (!residentName || !rowsByName[residentName]) return;
                const realPid = String(rowsByName[residentName].id);
                if (!byPatient[realPid]) byPatient[realPid] = [];
                const hasWeek = byPatient[realPid].some((r) => String(r.week_number) === String(weekNum));
                if (!hasWeek) byPatient[realPid].push(makeLocalReport(realPid, weekNum, entry));
              });
            });
            Object.keys(byPatient).forEach((pidKey) => { byPatient[pidKey].sort((a, b) => (Number(a.week_number) || 0) - (Number(b.week_number) || 0)); });
          } catch { /* ignore */ }
          if (Object.keys(byPatient).length === 0) {
            try {
              const { data: familyRows } = await supabase.from('patients').select('id, full_name').eq('family_id', user.id);
              const familyIds = (familyRows || []).map((r) => r.id).filter(Boolean);
              if (familyIds.length) {
                const { data: homeRows, error: homeErr } = await supabase.from('weekly_reports').select('*').in('patient_id', familyIds);
                if (!homeErr && homeRows) {
                  const byNameCurrent = {};
                  (activeRows || []).forEach((r) => { const n = String(r.full_name || '').trim().toLowerCase(); if (n) byNameCurrent[n] = String(r.id); });
                  (familyRows || []).forEach((r) => { const n = String(r.full_name || '').trim().toLowerCase(); if (n && !byNameCurrent[n]) byNameCurrent[n] = String(r.id); });
                  for (const row of homeRows) {
                    const pid = String(row.patient_id);
                    const familyRow = (familyRows || []).find((fr) => String(fr.id) === pid);
                    const mappedPid = familyRow ? (byNameCurrent[String(familyRow.full_name || '').trim().toLowerCase()] || pid) : pid;
                    if (!byPatient[mappedPid]) byPatient[mappedPid] = [];
                    byPatient[mappedPid].push(row);
                  }
                  Object.keys(byPatient).forEach((pidKey) => { byPatient[pidKey].sort((a, b) => (Number(a.week_number) || 0) - (Number(b.week_number) || 0)); });
                }
              }
            } catch { /* ignore */ }
          }
          setWeeklyReportsByPatient(byPatient);
        }
      }
    };
    loadPatients();
    window.addEventListener('storage', loadPatients);
    window.addEventListener(APP_DATA_REFRESH, loadPatients);
    return () => { cancelled = true; window.removeEventListener('storage', loadPatients); window.removeEventListener(APP_DATA_REFRESH, loadPatients); };
  }, []);

  useEffect(() => {
    setSelectedPatient((prev) => {
      if (!prev) return null;
      const next = patients.find((p) => String(p.id) === String(prev.id));
      if (!next) return prev;
      return { ...next };
    });
  }, [patients]);

  /* ── unchanged handlers ── */
  const handleImageChange = (index, event) => {
    const file = event.target.files?.[0]; if (!file) return;
    const imageUrl = URL.createObjectURL(file);
    setPatientImages((prev) => ({ ...prev, [index]: imageUrl }));
  };
  const triggerFileInput = (index) => { fileInputRefs.current[index]?.click(); };
  const patientStatusTone = (progress) => {
    const v = Number(progress) || 0;
    if (v >= 70) return { label: 'Stable', bg: '#DCFCE7', color: '#166534' };
    if (v >= 40) return { label: 'Recovering', bg: '#FEF3C7', color: '#92400E' };
    return { label: 'Needs Attention', bg: '#FEE2E2', color: '#991B1B' };
  };
  const patientSummaryPayload = (patient) => {
    const value = Number(patient?.progress) || 0;
    const adherence = Math.min(100, Math.max(0, value + 8));
    const emotional = Math.min(100, Math.max(0, value + 5));
    const physical = Math.min(100, Math.max(0, value + 10));
    return {
      status: patientStatusTone(value).label,
      summary: value >= 70 ? 'Resident shows consistent recovery and strong response to the care plan.' : value >= 40 ? 'Resident shows moderate progress and benefits from continued monitoring.' : 'Resident requires closer follow-up and additional recovery support.',
      goals: ['Maintain appointment attendance and family check-ins.', 'Complete weekly counseling and progress documentation.', 'Monitor medication and wellness adherence daily.'],
      reviewRows: [
        { label: 'Treatment Adherence', value: `${adherence}%`, note: 'Based on latest care updates' },
        { label: 'Emotional Stability', value: `${emotional}%`, note: 'Counselor observations' },
        { label: 'Physical Wellness', value: `${physical}%`, note: 'Nurse wellness checks' },
      ],
    };
  };

  const selectedPatientDetails = selectedPatient ? patientDetailsById[String(selectedPatient.id)] : null;
  const selectedPatientCare = useMemo(() => {
    if (!selectedPatient) return null;
    const base = mergePatientTemporaryDischargeFields(selectedPatient, selectedPatientDetails);
    return mergePatientWithRequestTemporaryLeave(base, temporaryLeaveFromRequest);
  }, [selectedPatient, selectedPatientDetails, temporaryLeaveFromRequest]);
  const onTemporaryLeave = isPatientOnTemporaryLeave(selectedPatientCare);

  useEffect(() => {
    if (!selectedPatient?.id || !isSupabaseConfigured()) {
      setTemporaryLeaveFromRequest(null);
      return undefined;
    }
    const patientId = String(selectedPatient.id);
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(patientId);
    if (!isUuid) {
      setTemporaryLeaveFromRequest(null);
      return undefined;
    }
    let cancelled = false;
    void (async () => {
      const result = await syncPatientTemporaryLeaveFromRequests(patientId, {
        familyId: familyUserId,
        patientName: selectedPatient?.name,
      });
      if (cancelled) return;
      if (result.fields) {
        setTemporaryLeaveFromRequest(result.fields);
        if (result.synced) {
          setPatientDetailsById((prev) => ({
            ...prev,
            [patientId]: { ...(prev[patientId] || {}), ...result.fields },
          }));
        }
      } else {
        setTemporaryLeaveFromRequest(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedPatient?.id, selectedPatient?.name, familyUserId]);

  useEffect(() => {
    const patient = selectedPatientCare || selectedPatient;
    if (!patient || !isSupabaseConfigured()) return undefined;
    const listId = String(patient.id || '');
    const pid = canonicalPatientId(patient, patientDetailsById);
    if (!isSupabasePatientId(pid)) return undefined;

    const existing = resolveWeeklyReportsForPatient(patient, weeklyReportsByPatient, patientDetailsById);
    if (existing.length) return undefined;

    let cancelled = false;
    void (async () => {
      const rows = await fetchWeeklyReportsForPatientId(pid);
      if (cancelled || !rows?.length) return;
      setWeeklyReportsByPatient((prev) =>
        mergeReportsIntoByPatient(prev, pid, rows, listId !== pid ? listId : null)
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedPatient?.id, selectedPatient?.name, onTemporaryLeave, patientDetailsById]);

  const handleResidentReturned = async () => {
    if (!selectedPatientCare?.id || !onTemporaryLeave) return;
    setResidentReturnBusy(true);
    const result = await returnResidentFromTemporaryLeave(selectedPatientCare);
    setResidentReturnBusy(false);
    if (!result.ok) {
      window.alert(result.error || 'Could not mark resident as returned.');
      return;
    }
    const cleared = {
      ...selectedPatientCare,
      temporaryDischargeAt: null,
      temporaryDischargeUntil: null,
      temporaryDischargeExpectedReturn: null,
      temporaryLeaveType: null,
      temporary_discharge_at: null,
      temporary_discharge_until: null,
      temporary_discharge_expected_return: null,
      temporary_leave_type: null,
    };
    setTemporaryLeaveFromRequest(null);
    setShowResidentReturnConfirm(false);
    setSelectedPatient(cleared);
    setPatientDetailsById((prev) => ({
      ...prev,
      [String(selectedPatientCare.id)]: {
        ...(prev[String(selectedPatientCare.id)] || {}),
        temporary_discharge_at: null,
        temporary_discharge_until: null,
        temporary_discharge_expected_return: null,
        temporary_leave_type: null,
      },
    }));
    setPatients((prev) =>
      prev.map((p) => (String(p.id) === String(selectedPatientCare.id) ? { ...p, ...cleared } : p))
    );
    refreshAppData();
  };
  const reportsForPatient = useMemo(
    () => (patient) =>
      resolveWeeklyReportsForPatient(patient, weeklyReportsByPatient, patientDetailsById),
    [weeklyReportsByPatient, patientDetailsById]
  );

  const selectedReports = useMemo(
    () => reportsForPatient(selectedPatientCare || selectedPatient),
    [reportsForPatient, selectedPatientCare, selectedPatient]
  );

  const latestSelectedReport = [...selectedReports].sort((a, b) => new Date(b.submitted_at || b.created_at || 0).getTime() - new Date(a.submitted_at || a.created_at || 0).getTime())[0] || null;
  const latestWeeklyReports = Object.entries(weeklyReportsByPatient || {}).flatMap(([patientId, rows]) =>
    (rows || []).map((row) => ({ patientId, week: row.week_number || '-', submittedAt: row.submitted_at || row.created_at || null, nurseName: row.nurse_name || 'Assigned Nurse' }))
  ).sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime()).slice(0, 4);

  const assignedNurseDisplay =
    latestSelectedReport?.nurse_name ||
    selectedPatientDetails?.program_staff ||
    'N/A';
  const assignedProgramStaffDisplay =
    selectedPatientDetails?.case_load_manager || 'N/A';
  const resolveVital = (reportVal, ...fallbacks) => { const first = [reportVal, ...fallbacks].find((v) => String(v ?? '').trim() !== ''); return String(first ?? '').trim() || '—'; };
  const formatResidentDisplayId = (patientId) => {
    const key = String(patientId || '');
    const detail = patientDetailsById[key] || null;
    const patient = (patients || []).find((p) => String(p.id) === key) || null;
    const admittedAt = detail?.admitted_at || patient?.admitted_at || patient?.admissionDate || null;
    const createdAt = detail?.created_at || patient?.created_at || admittedAt || null;
    return computeAdmissionDisplayId({ id: key, decided_at: admittedAt, created_at: createdAt }, { id: key, admitted_at: admittedAt });
  };
  const patientInitials = (name) => name ? String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') : '?';
  const isResidentOnTemporaryLeave = (p) =>
    isPatientOnTemporaryLeave(mergePatientTemporaryDischargeFields(p, patientDetailsById[String(p?.id)]));
  const tempLeaveCardProps = {
    onTemporaryLeave,
    temporaryPatient: selectedPatientCare,
    temporaryLeaveRequestFields: temporaryLeaveFromRequest,
  };

  /* ── RENDER ── */
  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: '#F0F4FF', fontFamily: "'DM Sans',-apple-system,sans-serif", overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        button { font-family: inherit; }

        /* SIDEBAR (structure 100% unchanged) */
        .desktop-sidebar {
          width: ${isExpanded ? '280px' : '110px'};
          background: #fff; border-right: 1px solid #F1F1F1;
          display: flex; flex-direction: column; align-items: center;
          padding: 25px 0 170px; z-index: 100;
          transition: width 0.3s cubic-bezier(0.4,0,0.2,1); cursor: pointer; position: relative;
        }
        .sidebar-logo-container { display: flex; justify-content: center; width: 100%; margin-bottom: 40px; }
        .sidebar-logo { width: ${isExpanded ? '120px' : '70px'}; transition: width .3s; }
        .sidebar-nav-item { display: flex; align-items: center; width: 100%; padding: 0 ${isExpanded ? '35px' : '0'}; justify-content: ${isExpanded ? 'flex-start' : 'center'}; gap: 20px; margin-bottom: 25px; min-height: 52px; box-sizing: border-box; border: 2px solid transparent; border-radius: 12px; }
        .sidebar-nav-item.sidebar-nav-active { border-color: #F54E25; }
        .sidebar-icon-wrap { padding: 12px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .sidebar-label { display: ${isExpanded ? 'block' : 'none'}; font-weight: 700; font-size: 18px; color: #707EAE; max-width: 140px; white-space: normal; overflow-wrap: anywhere; line-height: 1.2; }
        .sidebar-primary { width: 100%; }
        .sidebar-footer { position: absolute; left: 0; right: 0; bottom: 20px; width: 100%; }
        .sidebar-footer .sidebar-nav-item { margin-bottom: 0; }
        .sidebar-footer .sidebar-nav-item + .sidebar-nav-item { margin-top: 14px; }

        /* SCROLL */
        .scroll-content::-webkit-scrollbar { width: 4px; }
        .scroll-content::-webkit-scrollbar-track { background: transparent; }
        .scroll-content::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 999px; }

        /* PATIENT CARD HOVER */
        .patient-row-card { transition: transform .15s, box-shadow .15s, border-color .15s; }
        .patient-row-card:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(15,23,42,0.1) !important; border-color: #FECDD3 !important; }

        /* DETAIL TABLE */
        .dt th { text-align: left; color: #94A3B8; font-weight: 700; padding: 8px 14px; background: #F8FAFF; border-bottom: 1px solid #F1F5F9; font-size: 10px; text-transform: uppercase; letter-spacing: .07em; }
        .dt td { padding: 10px 14px; color: #0F172A; border-bottom: 1px solid #F8FAFC; font-weight: 600; font-size: 12px; }
        .dt tr:last-child td { border-bottom: none; }
        .dt tbody tr:hover td { background: #FAFBFF; }

        @media (max-width: 768px) {
          .desktop-sidebar { display: none; }
          .scroll-content { padding: 14px !important; }
        }
      `}</style>

      {/* ── SIDEBAR (100% unchanged) ── */}
      <aside className="desktop-sidebar" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="sidebar-logo-container"><img src={logo} alt="Kalinga" className="sidebar-logo" /></div>
        <div className="sidebar-primary">
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/home'); }}><div className="sidebar-icon-wrap"><Home size={22} color="#707EAE" /></div><span className="sidebar-label">Dashboard</span></div>
          <div className="sidebar-nav-item sidebar-nav-active" onClick={(e) => { e.stopPropagation(); navigate('/patient-details'); }}><div className="sidebar-icon-wrap"><BookUser size={22} color="#707EAE" /></div><span className="sidebar-label">Resident Details</span></div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/progress'); }}><div className="sidebar-icon-wrap"><ClipboardList size={22} color="#707EAE" /></div><span className="sidebar-label">Request Management</span></div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/appointments'); }}><div className="sidebar-icon-wrap"><Calendar size={22} color="#707EAE" /></div><span className="sidebar-label">Appointments</span></div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/reports'); }}><div className="sidebar-icon-wrap"><FileText size={22} color="#707EAE" /></div><span className="sidebar-label">Reports</span></div>
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/profile'); }}><div className="sidebar-icon-wrap"><User size={22} color="#707EAE" /></div><span className="sidebar-label">Profile</span></div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/login'); }}><div className="sidebar-icon-wrap"><LogOut size={22} color="#F54E25" /></div><span className="sidebar-label" style={{ color: '#F54E25' }}>Logout</span></div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <FamilyPageHeader
          title="Resident Details"
          subtitle={`${patients.length} resident${patients.length !== 1 ? 's' : ''}`}
        />

        <div className="scroll-content" style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 48px', background: '#F0F4FF' }}>
          <div style={{ width: '100%', maxWidth: 1560, margin: '0 auto', display: 'grid', gap: 20 }}>

            {/* ── HERO BANNER ── */}
            <div style={{ background: 'linear-gradient(135deg,#0F172A 0%,#1E2D4F 50%,#2D1B69 100%)', borderRadius: 24, padding: '26px 30px', boxShadow: '0 16px 48px rgba(15,23,42,0.22)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.2),transparent 70%)' }} />
              <div style={{ position: 'absolute', bottom: -20, left: '40%', width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle,rgba(245,78,37,0.15),transparent 70%)' }} />
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ClipboardList size={16} color="#fff" />
                  </div>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Family Portal · Resident Overview</span>
                </div>
                <h1 style={{ margin: 0, color: '#fff', fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em' }}>Resident Details</h1>
                <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Monitor progress, vitals, and care updates in one place</p>
              </div>
            </div>

            {/* ── RECENT REPORTS STRIP ── */}
            {latestWeeklyReports.length > 0 && (
              <SectionCard>
                <CardTitle icon={FileText}>Recent Weekly Reports</CardTitle>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                  {latestWeeklyReports.map((item, idx) => (
                    <div key={`${item.patientId}-${item.week}-${idx}`} onClick={() => { const t = patients.find((p) => String(p.id) === String(item.patientId)); if (t) setSelectedPatient(t); }} style={{ background: '#FAFBFF', border: '1px solid #E9EDF7', borderRadius: 16, padding: '14px 16px', cursor: 'pointer', transition: 'border-color .15s, box-shadow .15s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: '#8B5CF6', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Week {item.week}</span>
                        <CheckCircle2 size={14} color="#10B981" />
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>ID: {formatResidentDisplayId(item.patientId)}</div>
                      <div style={{ fontSize: 11, color: '#64748B', marginBottom: 3 }}>{formatDate(item.submittedAt)}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>Nurse: {item.nurseName}</div>
                      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#6366F1' }}>
                        View Resident <ArrowRight size={12} />
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* ── DIRECTORY TABLE ── */}
            <SectionCard style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FAFBFF' }}>
                <CardTitle icon={BarChart3} style={{ marginBottom: 0 }}>Resident Directory</CardTitle>
                <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, background: '#F1F5F9', padding: '3px 10px', borderRadius: 999 }}>{patients.length} entries</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="dt" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Resident</th>
                      <th>Admission Date</th>
                      <th>Progress</th>
                      <th>Status</th>
                      <th>Primary Concern</th>
                      <th>Room</th>
                      <th>Reports</th>
                      <th>Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patients.length ? patients.map((p) => (
                      <tr key={p.id} onClick={() => setSelectedPatient(p)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg,#EEF2FF,#C7D2FE)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span style={{ fontSize: 11, fontWeight: 900, color: '#4338CA' }}>{patientInitials(p.name)}</span>
                            </div>
                            <span style={{ fontWeight: 800, color: '#0F172A' }}>{p.name}</span>
                          </div>
                        </td>
                        <td style={{ color: '#64748B' }}>{p.date || 'N/A'}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 100 }}>
                            <div style={{ flex: 1, height: 5, background: '#F1F5F9', borderRadius: 999, overflow: 'hidden' }}>
                              <div style={{ width: `${Number(p.progress)||0}%`, height: '100%', background: 'linear-gradient(90deg,#F54E25,#EA580C)', borderRadius: 999 }} />
                            </div>
                            <span style={{ fontWeight: 800, color: '#0F172A', fontSize: 11 }}>{Number(p.progress)||0}%</span>
                          </div>
                        </td>
                        <td><StatusPill progress={p.progress} dischargedAt={p.discharged_at || patientDetailsById[String(p.id)]?.discharged_at} onTemporaryLeave={isResidentOnTemporaryLeave(p)} /></td>
                        <td style={{ color: '#64748B' }}>{patientDetailsById[String(p.id)]?.primary_concern || p.reason || 'N/A'}</td>
                        <td style={{ color: '#64748B' }}>{patientDetailsById[String(p.id)]?.room_code || p.roomCode || 'Unassigned'}</td>
                        <td style={{ fontWeight: 800, color: '#0F172A' }}>{reportsForPatient(p).length}</td>
                        <td>
                          <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999,
                            background: reportsForPatient(p).length ? '#ECFDF5' : '#F1F5F9',
                            color: reportsForPatient(p).length ? '#065F46' : '#94A3B8' }}>
                            {reportsForPatient(p).length ? 'Available' : 'Waiting'}
                          </span>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={8} style={{ textAlign: 'center', color: '#CBD5E1', padding: '28px 14px' }}>No residents yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            {/* ── PATIENT CARDS ── */}
            {patients.length === 0 ? (
              <SectionCard>
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 18, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                    <ClipboardList size={24} color="#CBD5E1" />
                  </div>
                  <p style={{ margin: 0, fontWeight: 800, color: '#334155', fontSize: 15 }}>No residents yet</p>
                  <p style={{ margin: '6px 0 0', color: '#94A3B8', fontSize: 13 }}>Once admissions are approved, resident details will appear here.</p>
                </div>
              </SectionCard>
            ) : (
              patients.map((p, i) => {
                const tone = patientStatusTone(p.progress);
                const progress = Number(p.progress) || 0;
                const reportCount = reportsForPatient(p).length;
                return (
                  <div key={p.id || i} className="patient-row-card" onClick={() => setSelectedPatient(p)}
                    style={{ background: '#fff', border: '1px solid #E9EDF7', borderRadius: 22, padding: '20px 24px', display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: '16px 20px', alignItems: 'center', cursor: 'pointer', boxShadow: '0 4px 20px rgba(15,23,42,0.05)' }}>
                    {/* Avatar */}
                    <div style={{ position: 'relative' }} onClick={(e) => { e.stopPropagation(); triggerFileInput(i); }}>
                      <input type="file" hidden accept="image/*" ref={(el) => { fileInputRefs.current[i] = el; }} onChange={(e) => handleImageChange(i, e)} />
                      <div style={{ width: 56, height: 56, borderRadius: 18, background: 'linear-gradient(135deg,#EEF2FF,#C7D2FE)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '2px solid #E0E7FF', cursor: 'pointer', flexShrink: 0 }}>
                        {patientImages[i]
                          ? <img src={patientImages[i]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: 18, fontWeight: 900, color: '#4338CA' }}>{patientInitials(p.name)}</span>}
                      </div>
                    </div>
                    {/* Info */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 900, fontSize: 16, color: '#0F172A', letterSpacing: '-0.01em' }}>{p.name}</span>
                        <StatusPill progress={p.progress} dischargedAt={p.discharged_at || patientDetailsById[String(p.id)]?.discharged_at} onTemporaryLeave={isResidentOnTemporaryLeave(p)} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: '#64748B' }}>Admitted <strong style={{ color: '#334155' }}>{p.date}</strong></span>
                        <span style={{ fontSize: 12, color: '#64748B' }}>Concern: <strong style={{ color: '#334155' }}>{patientDetailsById[String(p.id)]?.primary_concern || 'N/A'}</strong></span>
                        <span style={{ fontSize: 12, color: '#64748B' }}>Reports: <strong style={{ color: '#334155' }}>{reportCount}</strong></span>
                      </div>
                    </div>
                    {/* Progress ring */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <ProgressRing pct={progress} size={60} stroke={6} color={tone.color} />
                      <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>Recovery</span>
                    </div>
                    {/* CTA */}
                    <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedPatient(p); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#F54E25,#EA580C)', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 14px rgba(245,78,37,0.28)', whiteSpace: 'nowrap' }}>
                      View Details <ChevronRight size={14} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════
          DETAIL MODAL (functionality 100% unchanged, design improved)
      ══════════════════════════════════ */}
      {selectedPatient && (
        <div onClick={() => setSelectedPatient(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(900px,100%)', maxHeight: '90vh', overflow: 'hidden', borderRadius: 24, background: '#fff', boxShadow: '0 30px 80px rgba(15,23,42,0.28)', display: 'flex', flexDirection: 'column' }}>
            {/* Modal Header */}
            <div style={{ background: 'linear-gradient(135deg,#0F172A,#1E2D4F)', padding: '22px 26px', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: -30, right: -30, width: 130, height: 130, borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.25),transparent 70%)' }} />
              <div style={{ position: 'absolute', bottom: -20, left: '40%', width: 90, height: 90, borderRadius: '50%', background: 'radial-gradient(circle,rgba(245,78,37,0.18),transparent 70%)' }} />
              <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Resident Detail View</div>
                  <div style={{ fontSize: 22, color: '#fff', fontWeight: 900, letterSpacing: '-0.02em' }}>{selectedPatient.name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span>Admitted {selectedPatient.date || 'N/A'}</span>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'inline-block' }} />
                    <span>Progress: {Number(selectedPatient.progress)||0}%</span>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'inline-block' }} />
                    <span>{selectedReports.length} reports</span>
                    {(selectedPatientDetails?.discharged_at || selectedPatient.discharged_at) ? (
                      <>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'inline-block' }} />
                        <span style={{ color: 'rgba(253,164,175,0.95)', fontWeight: 700 }}>Discharged {formatDate(selectedPatientDetails?.discharged_at || selectedPatient.discharged_at)}</span>
                      </>
                    ) : null}
                    {onTemporaryLeave ? (
                      <>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'inline-block' }} />
                        <span style={{ color: '#FDE68A', fontWeight: 700 }}>{patientTemporaryDischargeStatusLabel(selectedPatientCare) || 'Temporarily discharged'}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  {onTemporaryLeave ? (
                    <ResidentReturnedHeaderButton compact busy={residentReturnBusy} onClick={() => setShowResidentReturnConfirm(true)} />
                  ) : null}
                  <button type="button" onClick={() => setSelectedPatient(null)} style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    <X size={16} />
                  </button>
                </div>
              </div>
              {/* Progress bar in header */}
              <div style={{ marginTop: 16, background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700 }}>Recovery Progress</span>
                  <span style={{ fontWeight: 900, color: '#6EE7B7' }}>{Number(selectedPatient.progress)||0}%</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${Number(selectedPatient.progress)||0}%`, height: '100%', background: 'linear-gradient(90deg,#6EE7B7,#34D399)', borderRadius: 999 }} />
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px 24px', background: '#F8FAFF' }}>
              {onTemporaryLeave ? (
                <TemporaryDischargeNotePanel
                  patient={selectedPatientCare}
                  requestFields={temporaryLeaveFromRequest}
                />
              ) : null}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14, marginBottom: 14 }}>
                <SectionCard {...tempLeaveCardProps}>
                  <CardTitle icon={ClipboardList}>Patient Data</CardTitle>
                  {[
                    ['Patient Name', selectedPatient.name],
                    ['Admission Date', selectedPatient.date || 'N/A'],
                    ...(selectedPatientDetails?.discharged_at || selectedPatient.discharged_at
                      ? [['Discharge Date', formatDate(selectedPatientDetails?.discharged_at || selectedPatient.discharged_at)]]
                      : []),
                    ['Progress', `${Number(selectedPatient.progress)||0}%`],
                    ['Status', (selectedPatientDetails?.discharged_at || selectedPatient.discharged_at)
                      ? 'Discharged'
                      : onTemporaryLeave
                        ? patientTemporaryDischargeStatusLabel(selectedPatientCare) || 'Temporarily discharged'
                        : patientStatusTone(selectedPatient.progress).label],
                    ['Primary Concern', selectedPatientDetails?.primary_concern || selectedPatient.reason || 'N/A'],
                    ['Age', calculateAge(selectedPatientDetails?.date_of_birth || selectedPatient.dateOfBirth)],
                    ['Gender', selectedPatientDetails?.gender || selectedPatient.gender || 'N/A'],
                    ['Reports Submitted', selectedReports.length],
                  ].map(([l, v]) => <DataRow key={l} label={l} value={String(v)} />)}
                </SectionCard>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
                {/* Weekly Timeline */}
                <SectionCard {...tempLeaveCardProps}>
                  <CardTitle icon={FileText}>Report Timeline</CardTitle>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead><tr>
                      <th style={{ textAlign: 'left', padding: '8px 16px', background: '#F8FAFF', color: '#94A3B8', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', borderBottom: '1px solid #F1F5F9' }}>Week</th>
                      <th style={{ textAlign: 'left', padding: '8px 16px', background: '#F8FAFF', color: '#94A3B8', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', borderBottom: '1px solid #F1F5F9' }}>Submitted</th>
                      <th style={{ textAlign: 'left', padding: '8px 16px', background: '#F8FAFF', color: '#94A3B8', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', borderBottom: '1px solid #F1F5F9' }}>Status</th>
                    </tr></thead>
                    <tbody>
                      {selectedReports.length ? selectedReports.map((row) => (
                        <tr key={String(row.id)} style={{ borderBottom: '1px solid #F8FAFC' }}>
                          <td style={{ padding: '10px 16px', fontWeight: 800, color: '#0F172A' }}>Week {row.week_number || '-'}</td>
                          <td style={{ padding: '10px 16px', color: '#64748B', fontSize: 11 }}>{formatDate(row.submitted_at || row.created_at)}</td>
                          <td style={{ padding: '10px 16px' }}><span style={{ fontSize: 9, fontWeight: 800, background: '#DCFCE7', color: '#166534', padding: '3px 8px', borderRadius: 999 }}>✓ Done</span></td>
                        </tr>
                      )) : <tr><td colSpan={3} style={{ padding: '20px 16px', textAlign: 'center', color: '#CBD5E1', fontSize: 12 }}>No reports yet.</td></tr>}
                    </tbody>
                  </table>
                </SectionCard>
                {/* Summary Table */}
                <SectionCard {...tempLeaveCardProps}>
                  <CardTitle icon={Shield}>Care Summary</CardTitle>
                  {[
                    ['Patient Name', selectedPatient.name],
                    ['Admission Date', selectedPatient.date || 'N/A'],
                    ['Progress', `${Number(selectedPatient.progress)||0}%`],
                    ['Room Assignment', selectedPatientDetails?.room_code || selectedPatient.roomCode || 'Unassigned'],
                    ['Nurse', assignedNurseDisplay],
                    ['Program Staff', assignedProgramStaffDisplay],
                    ['Reports Submitted', selectedReports.length],
                  ].map(([l, v]) => <DataRow key={l} label={l} value={String(v)} />)}
                </SectionCard>
                {/* Vitals */}
                <SectionCard {...tempLeaveCardProps}>
                  <CardTitle icon={Stethoscope}>Vital Signs</CardTitle>
                  {[
                    ['Weight', resolveVital(latestSelectedReport?.vitals_weight, selectedPatientDetails?.current_weight, selectedPatientDetails?.weight_kg)],
                    ['Height', resolveVital(latestSelectedReport?.vitals_height, selectedPatientDetails?.height_cm)],
                    ['Blood Pressure', resolveVital(latestSelectedReport?.vitals_bp, selectedPatientDetails?.bp, selectedPatientDetails?.blood_pressure)],
                    ['Pulse Rate', resolveVital(latestSelectedReport?.vitals_pr, selectedPatientDetails?.pr, selectedPatientDetails?.pulse_rate)],
                    ['Resp. Rate', resolveVital(latestSelectedReport?.vitals_rr, selectedPatientDetails?.rr, selectedPatientDetails?.respiratory_rate)],
                    ['Temperature', resolveVital(latestSelectedReport?.vitals_temperature, selectedPatientDetails?.temperature_f, selectedPatientDetails?.temperature)],
                    ['BMI', resolveVital(latestSelectedReport?.vitals_bmi, selectedPatientDetails?.bmi)],
                    ['SPO2', resolveVital(latestSelectedReport?.vitals_spo2, selectedPatientDetails?.spo2, selectedPatientDetails?.oxygen_saturation)],
                  ].map(([l, v]) => <VitalRow key={l} label={l} value={v} />)}
                </SectionCard>
              </div>

              {/* Next Steps */}
              <SectionCard {...tempLeaveCardProps}>
                <CardTitle icon={CheckCircle2}>Recommended Next Steps</CardTitle>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  {patientSummaryPayload(selectedPatient).goals.map((goal, i) => (
                    <div key={goal} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#FAFBFF', border: '1px solid #F1F5F9', borderRadius: 14, padding: '12px 14px' }}>
                      <div style={{ width: 24, height: 24, borderRadius: 8, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <CheckCircle2 size={13} color="#10B981" />
                      </div>
                      <span style={{ fontSize: 12, color: '#334155', lineHeight: 1.5, fontWeight: 600 }}>{goal}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          </div>
        </div>
      )}

      <ResidentReturnedConfirmModal
        open={showResidentReturnConfirm}
        residentName={selectedPatientCare?.name || selectedPatient?.name || 'this resident'}
        busy={residentReturnBusy}
        onClose={() => !residentReturnBusy && setShowResidentReturnConfirm(false)}
        onConfirm={() => void handleResidentReturned()}
      />

      <FloatingChatHead />
    </div>
  );
};

export default PatientDetailsPage;