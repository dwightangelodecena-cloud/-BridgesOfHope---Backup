import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Home, User, LogOut, Calendar, BookUser, ClipboardList, FileText, X,
  CheckCircle2, TrendingUp, Stethoscope,
  ArrowRight, ChevronRight, Shield
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import FamilySidebar from '@/components/family/FamilySidebar';
import FamilyMobileBottomNav from '@/components/family/FamilyMobileBottomNav';
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
import { FAMILY_PAGE_HEADERS } from '@/lib/familyPageHeaders';
import { useFamilyPageScroll } from '@/hooks/useFamilyPageScroll';
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
function ProgressRing({ pct = 0, size = 68, stroke = 6, color = '#F54E25', className = '' }) {
  const safePct = Math.min(100, Math.max(0, Number(pct) || 0));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (safePct / 100) * circ;
  return (
    <div
      className={`rd-progress-ring${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size }}
      aria-label={`${safePct}% recovery`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rd-progress-ring__svg" aria-hidden>
        <circle className="rd-progress-ring__track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className="rd-progress-ring__fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
    </svg>
      <span className="rd-progress-ring__value">{safePct}%</span>
    </div>
  );
}

function StatusPill({ progress, dischargedAt, onTemporaryLeave }) {
  if (onTemporaryLeave) {
    return <span className="rd-status-pill rd-status-pill--temp">Temporarily discharged</span>;
  }
  if (dischargedAt) {
    return <span className="rd-status-pill rd-status-pill--discharged">Discharged</span>;
  }
  const p = Number(progress) || 0;
  if (p >= 70) return <span className="rd-status-pill rd-status-pill--stable">Stable</span>;
  if (p >= 40) return <span className="rd-status-pill rd-status-pill--recovering">Recovering</span>;
  return <span className="rd-status-pill rd-status-pill--attention">Needs Attention</span>;
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

function SectionCard({ children, style = {}, className = '', onTemporaryLeave = false, temporaryPatient = null, temporaryLeaveRequestFields = null }) {
  return (
    <div className={`rd-section-card${className ? ` ${className}` : ''}`} style={style}>
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

function CardTitle({ icon: Icon, children, color = '#F54E25', className = '' }) {
  return (
    <div className={`rd-card-title${className ? ` ${className}` : ''}`}>
      <div className="rd-card-title__icon">
        <Icon size={14} color={color} />
      </div>
      <span className="rd-card-title__text">{children}</span>
    </div>
  );
}

/* ══════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════ */
const PatientDetailsPage = () => {
  const navigate = useNavigate();
  const { scrollToTop } = useFamilyPageScroll();
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
    <div className="family-portal app-container rd-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        button { font-family: inherit; }

        .rd-page.app-container {
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

        .rd-page .main-view { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }

        /* ── Scroll & layout ── */
        .rd-page .scroll-content {
          flex: 1;
          overflow-y: auto;
          padding: clamp(16px, 2.5vw, 28px) clamp(16px, 2.8vw, 32px) clamp(28px, 4vw, 44px);
          background: #F8FAFF;
        }
        .rd-page .scroll-content::-webkit-scrollbar { width: 5px; }
        .rd-page .scroll-content::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.4); border-radius: 999px; }
        .rd-content-wrap { width: 100%; max-width: min(1560px, 100%); margin: 0 auto; display: grid; gap: clamp(16px, 2.2vw, 24px); }
        .rd-content-wrap > * { animation: rdFadeIn 0.28s cubic-bezier(0.4, 0, 0.2, 1) both; }
        .rd-content-wrap > *:nth-child(2) { animation-delay: 0.04s; }
        .rd-content-wrap > *:nth-child(3) { animation-delay: 0.08s; }
        .rd-content-wrap > *:nth-child(4) { animation-delay: 0.12s; }
        .rd-content-wrap > *:nth-child(n+5) { animation-delay: 0.16s; }
        @keyframes rdFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ── Hero ── */
        .rd-hero-banner {
          background: linear-gradient(128deg, #0f172a 0%, #1a2744 38%, #243056 62%, #3b2f7a 100%);
          border-radius: clamp(18px, 2.2vw, 24px);
          padding: clamp(24px, 3.5vw, 36px) clamp(22px, 3.2vw, 32px);
          box-shadow: 0 20px 56px rgba(15, 23, 42, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.1);
          position: relative; overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .rd-hero-banner::before {
          content: '';
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 60% 90% at 0% 0%, rgba(245, 78, 37, 0.22) 0%, transparent 58%),
            radial-gradient(ellipse 45% 65% at 100% 100%, rgba(99, 102, 241, 0.2) 0%, transparent 52%),
            radial-gradient(ellipse 30% 40% at 72% 18%, rgba(255, 255, 255, 0.06) 0%, transparent 70%);
          pointer-events: none;
        }
        .rd-hero-deco-1 { position: absolute; top: -55px; right: -35px; width: 220px; height: 220px; border-radius: 50%; background: rgba(255,255,255,0.05); filter: blur(1px); }
        .rd-hero-deco-2 { position: absolute; bottom: -35px; right: 90px; width: 140px; height: 140px; border-radius: 50%; background: rgba(255,255,255,0.06); }
        .rd-hero-deco-3 { position: absolute; top: 20px; right: 200px; width: 80px; height: 80px; border-radius: 50%; background: rgba(245,78,37,0.18); box-shadow: 0 0 48px rgba(245, 78, 37, 0.28); }
        .rd-hero-inner { position: relative; z-index: 1; max-width: 640px; }
        .rd-hero-kicker { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .rd-hero-kicker-icon {
          width: 40px; height: 40px; border-radius: 13px;
          background: rgba(255,255,255,0.14); backdrop-filter: blur(10px);
          display: flex; align-items: center; justify-content: center;
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        }
        .rd-hero-eyebrow {
          font-size: clamp(0.625rem, 0.5vw + 0.5rem, 0.6875rem);
          color: rgba(255,255,255,0.6); font-weight: 600; letter-spacing: 0.11em; text-transform: uppercase;
        }
        .rd-hero-title {
          margin: 0; color: #fff;
          font-size: clamp(1.625rem, 2.8vw + 0.75rem, 2.125rem);
          font-weight: 900; letter-spacing: -0.03em; line-height: 1.1;
        }
        .rd-hero-sub {
          margin: 10px 0 0; color: rgba(255,255,255,0.62);
          font-size: clamp(0.8125rem, 0.5vw + 0.7rem, 0.9375rem); line-height: 1.55; max-width: 520px;
        }

        /* ── Section cards ── */
        .rd-section-card {
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid #e9edf7;
          border-radius: 20px;
          padding: clamp(18px, 2.4vw, 24px) clamp(20px, 2.6vw, 26px);
          box-shadow: 0 8px 28px rgba(15, 23, 42, 0.05);
          overflow: hidden;
          transition: box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .rd-section-card--flush { padding: 0; }
        .rd-card-title {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: clamp(14px, 2vw, 18px);
        }
        .rd-card-title__icon {
          width: 34px; height: 34px; border-radius: 11px;
          background: linear-gradient(145deg, #fff5f0, #fff1eb);
          border: 1px solid #ffdfd3;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(245, 78, 37, 0.1);
        }
        .rd-card-title__text {
          font-size: clamp(0.875rem, 0.5vw + 0.75rem, 0.9375rem);
          font-weight: 800; color: #0f172a; letter-spacing: -0.02em;
        }
        .rd-card-title--inline { margin-bottom: 0; }

        /* ── Status pills ── */
        .rd-status-pill {
          display: inline-flex; align-items: center;
          padding: 5px 11px; border-radius: 999px;
          font-size: 10px; font-weight: 800; letter-spacing: 0.02em;
          line-height: 1.2; white-space: nowrap;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
          border: 1px solid transparent;
        }
        .rd-status-pill--stable { background: #ecfdf5; color: #166534; border-color: #bbf7d0; }
        .rd-status-pill--recovering { background: #fffbeb; color: #92400e; border-color: #fde68a; }
        .rd-status-pill--attention { background: #fef2f2; color: #991b1b; border-color: #fecaca; }
        .rd-status-pill--temp { background: #fffbeb; color: #92400e; border-color: #fde68a; }
        .rd-status-pill--discharged { background: #f1f5f9; color: #475569; border-color: #e2e8f0; }

        /* ── Progress ring ── */
        .rd-progress-ring {
          position: relative; flex-shrink: 0;
          filter: drop-shadow(0 4px 12px rgba(15, 23, 42, 0.08));
        }
        .rd-progress-ring__svg { display: block; }
        .rd-progress-ring__track { stroke: #f1f5f9; }
        .rd-progress-ring__fill {
          transition: stroke-dasharray 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .rd-progress-ring__value {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 900; color: #0f172a; letter-spacing: -0.02em;
        }

        /* ── Weekly report strip ── */
        .rd-report-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: clamp(12px, 1.8vw, 16px);
          align-content: start;
          min-height: 168px;
        }
        .rd-report-card {
          background: linear-gradient(180deg, #fff 0%, #fafbff 100%);
          border: 1px solid #e9edf7;
          border-radius: 18px;
          padding: clamp(16px, 2vw, 20px);
          cursor: pointer;
          transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
          min-height: 168px;
          display: flex; flex-direction: column;
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
        }
        .rd-report-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.1);
          border-color: #d0dbf5;
        }
        .rd-report-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; gap: 8px; }
        .rd-report-week {
          font-size: 10px; font-weight: 800; color: #7c3aed;
          text-transform: uppercase; letter-spacing: 0.08em;
          background: #f5f3ff; border: 1px solid #ede9fe;
          padding: 4px 10px; border-radius: 999px;
        }
        .rd-report-status {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 10px; font-weight: 700; color: #059669;
          background: #ecfdf5; border: 1px solid #bbf7d0;
          padding: 4px 8px; border-radius: 999px;
        }
        .rd-report-id {
          font-size: clamp(0.875rem, 0.5vw + 0.75rem, 0.9375rem);
          font-weight: 800; color: #0f172a; margin-bottom: 6px; letter-spacing: -0.01em;
        }
        .rd-report-meta { font-size: 12px; color: #64748b; margin-bottom: 4px; line-height: 1.45; }
        .rd-report-meta--muted { color: #94a3b8; font-size: 11px; }
        .rd-report-cta {
          margin-top: auto; padding-top: 14px;
        }
        .rd-report-cta-btn {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12px; font-weight: 700; color: #4338ca;
          background: #eef2ff; border: 1px solid #e0e7ff;
          padding: 8px 12px; border-radius: 10px;
          transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
        }
        .rd-report-card:hover .rd-report-cta-btn {
          background: #e0e7ff; color: #3730a3; transform: translateX(2px);
        }

        /* ── Directory table ── */
        .rd-table-head {
          padding: clamp(14px, 1.8vw, 18px) clamp(18px, 2.2vw, 22px);
          border-bottom: 1px solid #f1f5f9;
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          background: linear-gradient(180deg, #fafbff 0%, #fff 100%);
        }
        .rd-table-count {
          font-size: 11px; color: #64748b; font-weight: 700;
          background: #f8fafc; border: 1px solid #e9edf7;
          padding: 5px 12px; border-radius: 999px;
        }
        .rd-table-scroll {
          overflow-x: auto;
          border-radius: 0 0 20px 20px;
        }
        .rd-table-scroll--tall {
          max-height: min(420px, 55vh);
          overflow-y: auto;
        }
        .rd-table-scroll--tall thead th {
          position: sticky; top: 0; z-index: 2;
          box-shadow: 0 1px 0 #f1f5f9;
        }
        .rd-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
        .rd-table th {
          text-align: left; color: #64748b; font-weight: 700;
          padding: 12px 16px; background: #f8faff;
          border-bottom: 1px solid #e9edf7;
          font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em;
          white-space: nowrap;
        }
        .rd-table td {
          padding: 13px 16px; color: #0f172a;
          border-bottom: 1px solid #f1f5f9; font-weight: 600; font-size: 12px;
          line-height: 1.4; vertical-align: middle;
        }
        .rd-table tbody tr:nth-child(even) td { background: #fcfdff; }
        .rd-table tbody tr { cursor: pointer; transition: background 0.18s ease, transform 0.18s ease; }
        .rd-table tbody tr:hover td { background: #f0f4ff !important; }
        .rd-table tbody tr:last-child td { border-bottom: none; }
        .rd-resident-cell { display: flex; align-items: center; gap: 12px; min-width: 150px; }
        .rd-resident-avatar {
          width: 36px; height: 36px; border-radius: 11px;
          background: linear-gradient(135deg, #eef2ff, #c7d2fe);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          box-shadow: 0 4px 10px rgba(67, 56, 202, 0.12);
          border: 1px solid #e0e7ff;
        }
        .rd-resident-avatar span { font-size: 11px; font-weight: 900; color: #4338ca; }
        .rd-resident-name { font-weight: 800; color: #0f172a; letter-spacing: -0.01em; }
        .rd-progress-cell { display: flex; align-items: center; gap: 10px; min-width: 120px; }
        .rd-progress-track {
          flex: 1; height: 6px; background: #f1f5f9; border-radius: 999px;
          overflow: hidden; border: 1px solid #e9edf7;
        }
        .rd-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #f54e25, #ea580c);
          border-radius: 999px;
          transition: width 0.45s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .rd-progress-pct { font-weight: 800; color: #0f172a; font-size: 11px; flex-shrink: 0; min-width: 32px; text-align: right; }
        .rd-review-pill {
          display: inline-flex; align-items: center;
          font-size: 10px; font-weight: 800;
          padding: 5px 10px; border-radius: 999px;
          border: 1px solid transparent;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
        }
        .rd-review-pill--ready { background: #ecfdf5; color: #065f46; border-color: #bbf7d0; }
        .rd-review-pill--wait { background: #f8fafc; color: #94a3b8; border-color: #e9edf7; }
        .rd-table-empty { text-align: center; color: #cbd5e1; padding: 32px 16px; font-weight: 600; }

        /* ── Patient row cards ── */
        .rd-patient-card {
          background: #fff;
          border: 1px solid #e9edf7;
          border-radius: 22px;
          padding: clamp(18px, 2.4vw, 24px) clamp(20px, 2.6vw, 28px);
          display: grid;
          grid-template-columns: auto 1fr auto auto;
          gap: clamp(16px, 2vw, 24px);
          align-items: center;
          cursor: pointer;
          min-height: 128px;
          box-shadow: 0 6px 24px rgba(15, 23, 42, 0.05);
          transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.22s ease, border-color 0.22s ease;
        }
        .rd-patient-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 18px 44px rgba(15, 23, 42, 0.11);
          border-color: #d0dbf5;
        }
        .rd-patient-card-avatar {
          width: 64px; height: 64px; border-radius: 18px;
          background: linear-gradient(135deg, #eef2ff, #c7d2fe);
          display: flex; align-items: center; justify-content: center;
          overflow: hidden; border: 2px solid #e0e7ff; cursor: pointer; flex-shrink: 0;
          box-shadow: 0 8px 20px rgba(67, 56, 202, 0.14);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .rd-patient-card:hover .rd-patient-card-avatar { transform: scale(1.03); }
        .rd-patient-card-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .rd-patient-card-avatar span { font-size: 20px; font-weight: 900; color: #4338ca; }
        .rd-patient-card-info { min-width: 0; }
        .rd-patient-card-name-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
        .rd-patient-card-name {
          font-weight: 900;
          font-size: clamp(1rem, 0.6vw + 0.85rem, 1.125rem);
          color: #0f172a; letter-spacing: -0.02em; line-height: 1.2;
        }
        .rd-patient-card-meta { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
        .rd-patient-card-meta span { font-size: 12px; color: #64748b; line-height: 1.5; }
        .rd-patient-card-meta strong { color: #334155; font-weight: 700; }
        .rd-patient-card-progress {
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          padding: 4px 8px;
        }
        .rd-patient-card-progress-label {
          font-size: 10px; color: #94a3b8; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.06em;
        }
        .rd-patient-cta {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          min-height: 44px; padding: 0 20px; border-radius: 14px; border: none;
          background: linear-gradient(145deg, #f54e25, #ea580c);
          color: #fff; font-size: 13px; font-weight: 800; cursor: pointer;
          box-shadow: 0 8px 22px rgba(245, 78, 37, 0.32);
          white-space: nowrap;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .rd-patient-cta:hover {
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 12px 28px rgba(245, 78, 37, 0.38);
        }
        .rd-patient-cta:active { transform: translateY(0) scale(0.98); }

        .rd-patient-list {
          display: grid;
          gap: clamp(12px, 1.8vw, 16px);
        }

        /* ── Empty state ── */
        .rd-empty-state { text-align: center; padding: 48px 24px; }
        .rd-empty-icon {
          width: 64px; height: 64px; border-radius: 20px;
          background: linear-gradient(145deg, #f8fafc, #f1f5f9);
          border: 1px solid #e9edf7;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 16px;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
        }
        .rd-empty-title { margin: 0; font-weight: 900; color: #1e293b; font-size: 16px; letter-spacing: -0.02em; }
        .rd-empty-sub { margin: 8px 0 0; color: #94a3b8; font-size: 13px; line-height: 1.55; max-width: 320px; margin-inline: auto; }

        /* ── Detail modal (visual only) ── */
        .rd-modal-overlay {
          position: fixed; inset: 0;
          background: rgba(15, 23, 42, 0.55);
          backdrop-filter: blur(10px);
          display: flex; align-items: center; justify-content: center;
          z-index: 4000; padding: 16px;
        }
        .rd-modal-shell {
          width: min(900px, 100%); max-height: 90vh; overflow: hidden;
          border-radius: 24px; background: #fff;
          box-shadow: 0 30px 80px rgba(15, 23, 42, 0.28);
          display: flex; flex-direction: column;
          border: 1px solid #e9edf7;
        }
        .rd-modal-header {
          background: linear-gradient(128deg, #0f172a 0%, #1a2744 38%, #243056 62%, #3b2f7a 100%);
          padding: clamp(18px, 2.5vw, 22px) clamp(20px, 2.8vw, 26px);
          position: relative; overflow: hidden; flex-shrink: 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .rd-modal-header::before {
          content: '';
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 50% 80% at 100% 0%, rgba(99, 102, 241, 0.2) 0%, transparent 55%),
            radial-gradient(ellipse 40% 60% at 0% 100%, rgba(245, 78, 37, 0.15) 0%, transparent 50%);
          pointer-events: none;
        }
        .rd-modal-header-inner { position: relative; display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
        .rd-modal-kicker { font-size: 10px; color: rgba(255,255,255,0.5); font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px; }
        .rd-modal-title { font-size: clamp(1.125rem, 1.5vw + 0.75rem, 1.375rem); color: #fff; font-weight: 900; letter-spacing: -0.02em; }
        .rd-modal-meta { font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 6px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .rd-modal-meta-dot { width: 4px; height: 4px; border-radius: 50%; background: rgba(255,255,255,0.25); display: inline-block; }
        .rd-modal-close {
          width: 36px; height: 36px; border-radius: 10px; border: none;
          background: rgba(255,255,255,0.1); color: #fff;
          display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;
          transition: background 0.18s ease;
        }
        .rd-modal-close:hover { background: rgba(255,255,255,0.18); }
        .rd-modal-progress-wrap {
          margin-top: 16px; background: rgba(255,255,255,0.08);
          border-radius: 12px; padding: 10px 14px; border: 1px solid rgba(255,255,255,0.1);
        }
        .rd-modal-progress-labels { display: flex; justify-content: space-between; font-size: 10px; color: rgba(255,255,255,0.45); margin-bottom: 6px; }
        .rd-modal-progress-labels strong { font-weight: 900; color: #6ee7b7; }
        .rd-modal-progress-track { height: 6px; background: rgba(255,255,255,0.15); border-radius: 999px; overflow: hidden; }
        .rd-modal-progress-fill { height: 100%; background: linear-gradient(90deg, #6ee7b7, #34d399); border-radius: 999px; }
        .rd-modal-body { flex: 1; overflow: auto; padding: clamp(16px, 2.2vw, 20px) clamp(18px, 2.4vw, 24px) clamp(20px, 2.8vw, 24px); background: #f8faff; }

        @media (min-width: 1600px) {
          .rd-content-wrap { max-width: min(1680px, 100%); }
        }
        @media (max-width: 1199px) {
          .rd-report-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 899px) {
          .rd-report-grid { grid-template-columns: 1fr; }
          .rd-patient-card {
            grid-template-columns: auto 1fr;
            grid-template-areas: 'avatar info' 'progress cta';
          }
          .rd-patient-card-avatar { grid-area: avatar; }
          .rd-patient-card-info { grid-area: info; }
          .rd-patient-card-progress { grid-area: progress; justify-self: start; }
          .rd-patient-cta { grid-area: cta; justify-self: end; }
        }
        @media (max-width: 768px) {
          .rd-page .scroll-content { padding: 14px !important; }
        }
      `}</style>

      <FamilySidebar
        isExpanded={isExpanded}
        onToggleExpanded={() => setIsExpanded(!isExpanded)}
      />

      {/* ── MAIN ── */}
      <div className="main-view">

        <FamilyPageHeader
          title={FAMILY_PAGE_HEADERS.residents.title}
          subtitle={`${patients.length} resident${patients.length !== 1 ? 's' : ''} · ${FAMILY_PAGE_HEADERS.residents.subtitle}`}
          onBrandPress={scrollToTop}
          showMobileLogo={false}
        />

        <div className="scroll-content">
          <div className="rd-content-wrap">

            {/* ── HERO BANNER ── */}
            <div className="rd-hero-banner">
              <div className="rd-hero-deco-1" /><div className="rd-hero-deco-2" /><div className="rd-hero-deco-3" />
              <div className="rd-hero-inner">
                <div className="rd-hero-kicker">
                  <div className="rd-hero-kicker-icon">
                    <BookUser size={16} color="#fff" />
                  </div>
                  <span className="rd-hero-eyebrow">Family Portal · Resident Overview</span>
                </div>
                <h1 className="rd-hero-title">Resident Details</h1>
                <p className="rd-hero-sub">Monitor progress, vitals, and care updates in one place</p>
              </div>
            </div>

            {/* ── RECENT REPORTS STRIP ── */}
            {latestWeeklyReports.length > 0 && (
              <SectionCard>
                <CardTitle icon={FileText}>Recent Weekly Reports</CardTitle>
                <div className="rd-report-grid">
                  {latestWeeklyReports.map((item, idx) => (
                    <div
                      key={`${item.patientId}-${item.week}-${idx}`}
                      className="rd-report-card"
                      onClick={() => { const t = patients.find((p) => String(p.id) === String(item.patientId)); if (t) setSelectedPatient(t); }}
                    >
                      <div className="rd-report-card-top">
                        <span className="rd-report-week">Week {item.week}</span>
                        <span className="rd-report-status">
                          <CheckCircle2 size={12} /> Submitted
                        </span>
                      </div>
                      <div className="rd-report-id">ID: {formatResidentDisplayId(item.patientId)}</div>
                      <div className="rd-report-meta">{formatDate(item.submittedAt)}</div>
                      <div className="rd-report-meta rd-report-meta--muted">Nurse: {item.nurseName}</div>
                      <div className="rd-report-cta">
                        <span className="rd-report-cta-btn">
                        View Resident <ArrowRight size={12} />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* ── DIRECTORY TABLE ── */}
            <SectionCard className="rd-section-card--flush">
              <div className="rd-table-head">
                <CardTitle icon={BookUser} className="rd-card-title--inline">Resident Directory</CardTitle>
                <span className="rd-table-count">{patients.length} entries</span>
              </div>
              <div className={`rd-table-scroll${patients.length > 6 ? ' rd-table-scroll--tall' : ''}`}>
                <table className="rd-table">
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
                      <tr key={p.id} onClick={() => setSelectedPatient(p)}>
                        <td>
                          <div className="rd-resident-cell">
                            <div className="rd-resident-avatar">
                              <span>{patientInitials(p.name)}</span>
                            </div>
                            <span className="rd-resident-name">{p.name}</span>
                          </div>
                        </td>
                        <td style={{ color: '#64748B' }}>{p.date || 'N/A'}</td>
                        <td>
                          <div className="rd-progress-cell">
                            <div className="rd-progress-track">
                              <div className="rd-progress-fill" style={{ width: `${Number(p.progress) || 0}%` }} />
                            </div>
                            <span className="rd-progress-pct">{Number(p.progress) || 0}%</span>
                          </div>
                        </td>
                        <td><StatusPill progress={p.progress} dischargedAt={p.discharged_at || patientDetailsById[String(p.id)]?.discharged_at} onTemporaryLeave={isResidentOnTemporaryLeave(p)} /></td>
                        <td style={{ color: '#64748B' }}>{patientDetailsById[String(p.id)]?.primary_concern || p.reason || 'N/A'}</td>
                        <td style={{ color: '#64748B' }}>{patientDetailsById[String(p.id)]?.room_code || p.roomCode || 'Unassigned'}</td>
                        <td style={{ fontWeight: 800 }}>{reportsForPatient(p).length}</td>
                        <td>
                          <span className={`rd-review-pill ${reportsForPatient(p).length ? 'rd-review-pill--ready' : 'rd-review-pill--wait'}`}>
                            {reportsForPatient(p).length ? 'Available' : 'Waiting'}
                          </span>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={8} className="rd-table-empty">No residents yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            {/* ── PATIENT CARDS ── */}
            {patients.length === 0 ? (
              <SectionCard>
                <div className="rd-empty-state">
                  <div className="rd-empty-icon">
                    <ClipboardList size={24} color="#CBD5E1" />
                  </div>
                  <p className="rd-empty-title">No residents yet</p>
                  <p className="rd-empty-sub">Once admissions are approved, resident details will appear here.</p>
                </div>
              </SectionCard>
            ) : (
              <div className="rd-patient-list">
              {patients.map((p, i) => {
                const tone = patientStatusTone(p.progress);
                const progress = Number(p.progress) || 0;
                const reportCount = reportsForPatient(p).length;
                return (
                  <div key={p.id || i} className="rd-patient-card" onClick={() => setSelectedPatient(p)}>
                    <div onClick={(e) => { e.stopPropagation(); triggerFileInput(i); }}>
                      <input type="file" hidden accept="image/*" ref={(el) => { fileInputRefs.current[i] = el; }} onChange={(e) => handleImageChange(i, e)} />
                      <div className="rd-patient-card-avatar">
                        {patientImages[i]
                          ? <img src={patientImages[i]} alt="" />
                          : <span>{patientInitials(p.name)}</span>}
                      </div>
                    </div>
                    <div className="rd-patient-card-info">
                      <div className="rd-patient-card-name-row">
                        <span className="rd-patient-card-name">{p.name}</span>
                        <StatusPill progress={p.progress} dischargedAt={p.discharged_at || patientDetailsById[String(p.id)]?.discharged_at} onTemporaryLeave={isResidentOnTemporaryLeave(p)} />
                      </div>
                      <div className="rd-patient-card-meta">
                        <span>Admitted <strong>{p.date}</strong></span>
                        <span>Concern: <strong>{patientDetailsById[String(p.id)]?.primary_concern || 'N/A'}</strong></span>
                        <span>Reports: <strong>{reportCount}</strong></span>
                      </div>
                    </div>
                    <div className="rd-patient-card-progress">
                      <ProgressRing pct={progress} size={68} stroke={6} color={tone.color} />
                      <span className="rd-patient-card-progress-label">Recovery</span>
                    </div>
                    <button
                      type="button"
                      className="rd-patient-cta"
                      onClick={(e) => { e.stopPropagation(); setSelectedPatient(p); }}
                    >
                      View Details <ChevronRight size={14} />
                    </button>
                  </div>
                );
              })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════
          DETAIL MODAL (functionality 100% unchanged, design improved)
      ══════════════════════════════════ */}
      {selectedPatient && (
        <div className="rd-modal-overlay" onClick={() => setSelectedPatient(null)}>
          <div className="rd-modal-shell" onClick={(e) => e.stopPropagation()}>
            <div className="rd-modal-header">
              <div className="rd-modal-header-inner">
                <div>
                  <div className="rd-modal-kicker">Resident Detail View</div>
                  <div className="rd-modal-title">{selectedPatient.name}</div>
                  <div className="rd-modal-meta">
                    <span>Admitted {selectedPatient.date || 'N/A'}</span>
                    <span className="rd-modal-meta-dot" />
                    <span>Progress: {Number(selectedPatient.progress) || 0}%</span>
                    <span className="rd-modal-meta-dot" />
                    <span>{selectedReports.length} reports</span>
                    {(selectedPatientDetails?.discharged_at || selectedPatient.discharged_at) ? (
                      <>
                        <span className="rd-modal-meta-dot" />
                        <span style={{ color: 'rgba(253,164,175,0.95)', fontWeight: 700 }}>Discharged {formatDate(selectedPatientDetails?.discharged_at || selectedPatient.discharged_at)}</span>
                      </>
                    ) : null}
                    {onTemporaryLeave ? (
                      <>
                        <span className="rd-modal-meta-dot" />
                        <span style={{ color: '#FDE68A', fontWeight: 700 }}>{patientTemporaryDischargeStatusLabel(selectedPatientCare) || 'Temporarily discharged'}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  {onTemporaryLeave ? (
                    <ResidentReturnedHeaderButton compact busy={residentReturnBusy} onClick={() => setShowResidentReturnConfirm(true)} />
                  ) : null}
                  <button type="button" className="rd-modal-close" onClick={() => setSelectedPatient(null)} aria-label="Close">
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className="rd-modal-progress-wrap">
                <div className="rd-modal-progress-labels">
                  <span style={{ fontWeight: 700 }}>Recovery Progress</span>
                  <strong>{Number(selectedPatient.progress) || 0}%</strong>
                </div>
                <div className="rd-modal-progress-track">
                  <div className="rd-modal-progress-fill" style={{ width: `${Number(selectedPatient.progress) || 0}%` }} />
                </div>
              </div>
            </div>

            <div className="rd-modal-body">
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

      <FamilyMobileBottomNav />
      <FloatingChatHead />
    </div>
  );
};

export default PatientDetailsPage;