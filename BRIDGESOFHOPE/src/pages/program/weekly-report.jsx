import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { FileText, ChevronLeft, Users, ArrowRightSquare, Calendar as CalendarIcon } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import logo from '@/assets/kalingalogo.png';
import AdminSidebar from '@/components/admin/AdminSidebar';
import ReportPatientDashboard from '@/components/reports/ReportPatientDashboard';
import PatientReportFolders from '@/components/reports/PatientReportFolders';
import { ProgramMobileBottomNav } from '@/components/program/ProgramSidebar';
import { familySidebarStyle } from '@/lib/familySidebarStyle';
import BulletedListFieldInput from '@/components/clinical/BulletedListFieldInput';
import MedicationTableField from '@/components/clinical/MedicationTableField';
import CompiledDailyReportsList from '@/components/clinical/CompiledDailyReportsList';
import { appendActivityFeed } from '@/lib/activityFeed';
import { formatBulletedListNoteSection } from '@/lib/bulletedListField';
import { formatMedicationTableNoteSection } from '@/lib/medicationTableField';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { APP_DATA_REFRESH } from '@/lib/appDataRefresh';
import {
  fetchDailyReportsForRange,
  fetchDailyReportsForPatients,
  fetchDailyReportsForWeek,
  upsertDailyReport,
  weekDateRange,
  weekDateList,
  snapshotDailyReports,
} from '@/lib/dailyReports';

/** {maxWeek, addWeeklyTarget:{week,mode}, currentWorkingWeek} from a patient's weekly_reports rows. */
function deriveWeekPlan(weeklyRows) {
  const nums = (weeklyRows || []).map((r) => Number(r.week_number)).filter((n) => Number.isFinite(n) && n > 0);
  const maxWeek = nums.length ? Math.max(...nums) : 0;
  const maxRow = (weeklyRows || []).find((r) => Number(r.week_number) === maxWeek) || null;
  const concludedNums = (weeklyRows || [])
    .filter((r) => r.concluded_at)
    .map((r) => Number(r.week_number))
    .filter((n) => Number.isFinite(n));
  const maxConcluded = concludedNums.length ? Math.max(...concludedNums) : 0;
  const addWeeklyTarget = maxRow && !maxRow.concluded_at
    ? { week: maxWeek, mode: 'open-draft' }
    : { week: maxWeek + 1, mode: 'new' };
  return { maxWeek, addWeeklyTarget, currentWorkingWeek: maxConcluded + 1 };
}

const INITIAL_BASICS = {
  weekLabel: '',
  admissionDate: '',
  patientName: '',
  age: '',
  primaryConcern: '',
};

const INITIAL_VITALS = {
  weight: '',
  height: '',
  bmi: '',
  bp: '',
  pr: '',
  rr: '',
  spo2: '',
  temperature: '',
};

const INITIAL_REPORT_DETAILS = {
  currentMedications: '',
  interventionMedication: '',
  dietaryRestrictions: '',
  foodAllergies: '',
  interventionNutrition: '',
  ongoingMedicalConcern: '',
  upcomingProcedureDescription: '',
  upcomingProcedureDate: '',
};

const WEEKLY_REPORTS_STORAGE_KEY = 'bh_nurse_weekly_reports';

const asText = (v) => (v == null ? '' : String(v));

const deriveVitalsFromPatient = (patient) => {
  const weight = asText(patient.current_weight ?? patient.weight_kg ?? patient.weight);
  const height = asText(patient.height_cm ?? patient.height);
  const bmiFromDb = asText(patient.bmi);
  const bp = asText(patient.bp ?? patient.blood_pressure);
  const pr = asText(patient.pr ?? patient.pulse_rate);
  const rr = asText(patient.rr ?? patient.respiratory_rate);
  const spo2 = asText(patient.spo2 ?? patient.oxygen_saturation);
  const temperature = asText(patient.temperature_f ?? patient.temperature ?? patient.temp_f);

  let computedBmi = bmiFromDb;
  const w = Number(weight);
  const hCm = Number(height);
  if (!computedBmi && Number.isFinite(w) && Number.isFinite(hCm) && hCm > 0) {
    const m = hCm / 100;
    const bmiNum = w / (m * m);
    if (Number.isFinite(bmiNum)) computedBmi = bmiNum.toFixed(1);
  }

  return { weight, height, bmi: computedBmi, bp, pr, rr, spo2, temperature };
};

const computeBmiFromWeightHeight = (weightRaw, heightRaw) => {
  const w = Number(weightRaw);
  const hCm = Number(heightRaw);
  if (!Number.isFinite(w) || !Number.isFinite(hCm) || hCm <= 0) return '';
  const hM = hCm / 100;
  const bmi = w / (hM * hM);
  return Number.isFinite(bmi) ? bmi.toFixed(1) : '';
};

const deriveAge = (row) => {
  const directAge = Number(row?.age);
  if (Number.isFinite(directAge) && directAge > 0) return String(Math.floor(directAge));
  const dob = row?.date_of_birth;
  if (!dob) return '';
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 ? String(age) : '';
};

const isSupabasePatientId = (id) =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/** Map a `weekly_reports` row into partial vitals + reportDetails for the form (nurse medical + program weekly share this table). */
const partialFormFromWeeklyDbRow = (row) => {
  if (!row || typeof row !== 'object') return null;
  const vitals = {};
  const w = asText(row.vitals_weight);
  const h = asText(row.vitals_height);
  const bmi = asText(row.vitals_bmi);
  const bp = asText(row.vitals_bp);
  const pr = asText(row.vitals_pr);
  const rr = asText(row.vitals_rr);
  const spo2 = asText(row.vitals_spo2);
  const temp = asText(row.vitals_temperature);
  if (w) vitals.weight = w;
  if (h) vitals.height = h;
  if (bmi) vitals.bmi = bmi;
  if (bp) vitals.bp = bp;
  if (pr) vitals.pr = pr;
  if (rr) vitals.rr = rr;
  if (spo2) vitals.spo2 = spo2;
  if (temp) vitals.temperature = temp;

  const reportDetails = {};
  const setD = (key, val) => {
    const t = asText(val);
    if (t) reportDetails[key] = t;
  };
  setD('currentMedications', row.current_medications);
  setD('interventionMedication', row.medication_intervention);
  setD('dietaryRestrictions', row.dietary_restrictions);
  setD('foodAllergies', row.food_allergies);
  setD('interventionNutrition', row.nutrition_intervention);
  setD('ongoingMedicalConcern', row.ongoing_medical_concern || row.behavior_observation);
  setD('upcomingProcedureDescription', row.upcoming_procedure_description);
  setD('upcomingProcedureDate', row.upcoming_procedure_date);

  if (Object.keys(vitals).length === 0 && Object.keys(reportDetails).length === 0) return null;
  return { vitals, reportDetails };
};

const partialFormFromLocalWeeklyEntry = (e) => {
  if (!e || typeof e !== 'object') return null;
  const vitals = {};
  const vw = asText(e.vitalsWeight ?? e.vitals_weight);
  const vh = asText(e.vitalsHeight ?? e.vitals_height);
  const vbmi = asText(e.vitalsBmi ?? e.vitals_bmi);
  const vbp = asText(e.vitalsBp ?? e.vitals_bp);
  const vpr = asText(e.vitalsPr ?? e.vitals_pr);
  const vrr = asText(e.vitalsRr ?? e.vitals_rr);
  const vspo2 = asText(e.vitalsSpo2 ?? e.vitals_spo2);
  const vtemp = asText(e.vitalsTemperature ?? e.vitals_temperature);
  if (vw) vitals.weight = vw;
  if (vh) vitals.height = vh;
  if (vbmi) vitals.bmi = vbmi;
  if (vbp) vitals.bp = vbp;
  if (vpr) vitals.pr = vpr;
  if (vrr) vitals.rr = vrr;
  if (vspo2) vitals.spo2 = vspo2;
  if (vtemp) vitals.temperature = vtemp;

  const reportDetails = {};
  const cm = asText(e.currentMedications ?? e.current_medications);
  const dr = asText(e.dietaryRestrictions);
  const fa = asText(e.foodAllergies);
  const om = asText(e.ongoingMedicalConcern ?? e.behaviorObservation ?? e.behavior_observation);
  if (cm) reportDetails.currentMedications = cm;
  if (dr) reportDetails.dietaryRestrictions = dr;
  if (fa) reportDetails.foodAllergies = fa;
  if (om) reportDetails.ongoingMedicalConcern = om;

  if (Object.keys(vitals).length === 0 && Object.keys(reportDetails).length === 0) return null;
  return { vitals, reportDetails };
};

const mergePartialFormLayers = (a, b) => {
  if (!a) return b;
  if (!b) return a;
  return {
    vitals: { ...a.vitals, ...b.vitals },
    reportDetails: { ...a.reportDetails, ...b.reportDetails },
  };
};

const mergeVitalsPreferReport = (base, overlay = {}) => {
  const out = { ...base };
  for (const key of Object.keys(INITIAL_VITALS)) {
    const v = overlay[key];
    if (v != null && String(v).trim() !== '') out[key] = String(v);
  }
  const recomputed = computeBmiFromWeightHeight(out.weight, out.height);
  if (!out.bmi && recomputed) out.bmi = recomputed;
  return out;
};

/** Loads nurse- or program-filed data for this patient/week (Supabase + local cache). DB row wins over local on conflicts. */
const loadExistingWeeklyReportPartial = async (patientIdStr, weekNum) => {
  const wk = parseInt(String(weekNum), 10);
  if (!patientIdStr || Number.isNaN(wk)) return null;

  let localPartial = null;
  try {
    const raw = localStorage.getItem(WEEKLY_REPORTS_STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    const entry = all[String(patientIdStr)]?.[String(wk)];
    localPartial = partialFormFromLocalWeeklyEntry(entry);
  } catch {
    /* ignore */
  }

  let dbPartial = null;
  if (isSupabaseConfigured() && isSupabasePatientId(patientIdStr)) {
    let { data, error } = await supabase
      .from('weekly_reports')
      .select(
        'week_number, current_medications, medication_intervention, dietary_restrictions, food_allergies, nutrition_intervention, ongoing_medical_concern, behavior_observation, upcoming_procedure_description, upcoming_procedure_date, vitals_weight, vitals_height, vitals_bmi, vitals_bp, vitals_pr, vitals_rr, vitals_spo2, vitals_temperature'
      )
      .eq('patient_id', patientIdStr)
      .eq('week_number', wk)
      .maybeSingle();
    if (error && /column .* does not exist/i.test(String(error.message || ''))) {
      ({ data, error } = await supabase
        .from('weekly_reports')
        .select('week_number')
        .eq('patient_id', patientIdStr)
        .eq('week_number', wk)
        .maybeSingle());
    }
    if (!error && data) dbPartial = partialFormFromWeeklyDbRow(data);
  }

  return mergePartialFormLayers(localPartial, dbPartial);
};

/** Weekly clinical filing for program staff (case load managers) — assigned residents match `case_load_manager`. */
const ProgramWeeklyReport = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlPatient = searchParams.get('patient') || '';
  const urlWeek = Number(searchParams.get('week')) || null;
  const urlForm = searchParams.get('form') || '';
  const view = !urlPatient
    ? 'dashboard'
    : urlWeek && urlForm === 'daily'
      ? 'daily-form'
      : urlWeek && urlForm === 'weekly'
        ? 'weekly-form'
        : 'folders';
  const activeWeekNumber = urlWeek;

  const goDashboard = () => setSearchParams({});
  const goFolders = (pid) => setSearchParams({ patient: pid || urlPatient });
  const goForm = (pid, week, form) => setSearchParams({ patient: pid || urlPatient, week: String(week), form });

  const hydrateSeqRef = useRef(0);
  const hydratedKeyRef = useRef('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [concludeConfirm, setConcludeConfirm] = useState(false);
  const [concluding, setConcluding] = useState(false);
  const [weeklyRefreshTick, setWeeklyRefreshTick] = useState(0);
  const [currentWeekReport, setCurrentWeekReport] = useState(null);
  const [patientWeeklyRows, setPatientWeeklyRows] = useState([]);
  const [patientWeeklyLoading, setPatientWeeklyLoading] = useState(false);
  const [patientDailyRows, setPatientDailyRows] = useState([]);
  const [statsByPatient, setStatsByPatient] = useState({});
  const [reportBasics, setReportBasics] = useState(INITIAL_BASICS);
  const [admittedPatients, setAdmittedPatients] = useState([]);
  const [activeReportPatientId, setActiveReportPatientId] = useState(null);
  const [vitals, setVitals] = useState(INITIAL_VITALS);
  const [reportDetails, setReportDetails] = useState(INITIAL_REPORT_DETAILS);
  const [submitError, setSubmitError] = useState('');
  const [staffIdentityNames, setStaffIdentityNames] = useState([]);
  const [staffSignatureName, setStaffSignatureName] = useState('');
  const [staffSignatureDate, setStaffSignatureDate] = useState(() => new Date().toLocaleDateString('en-US'));
  const [currentUserId, setCurrentUserId] = useState(null);
  const [activePatientAdmittedAtIso, setActivePatientAdmittedAtIso] = useState(null);

  // ---- Daily Report entry (program staff) — the internal source for the weekly report ----
  const [dailyObservations, setDailyObservations] = useState('');
  const [dailyAssessment, setDailyAssessment] = useState('');
  const [dailyFollowUp, setDailyFollowUp] = useState('');
  const [dailyNotes, setDailyNotes] = useState('');
  const [dailyReportDate, setDailyReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dailySaving, setDailySaving] = useState(false);
  const [dailySaveMessage, setDailySaveMessage] = useState('');
  const [dailySaveError, setDailySaveError] = useState('');
  const [dailyReportsRefreshKey, setDailyReportsRefreshKey] = useState(0);

  // ---- This week's daily reports (compiled into the weekly report on Conclude) ----
  const [weekDailyReports, setWeekDailyReports] = useState([]);
  const [weekDailyReportsLoading, setWeekDailyReportsLoading] = useState(false);
  const [weekDailyReportsError, setWeekDailyReportsError] = useState('');

  const weekDateOptions = useMemo(() => {
    const admittedIso = activePatientAdmittedAtIso ? String(activePatientAdmittedAtIso).slice(0, 10) : null;
    return weekDateList(admittedIso, activeWeekNumber);
  }, [activePatientAdmittedAtIso, activeWeekNumber]);

  const weekPlan = useMemo(() => deriveWeekPlan(patientWeeklyRows), [patientWeeklyRows]);

  const dailyCountsByWeek = useMemo(() => {
    const m = {};
    for (const r of patientDailyRows) {
      const n = Number(r.week_number);
      if (Number.isFinite(n)) m[n] = (m[n] || 0) + 1;
    }
    return m;
  }, [patientDailyRows]);

  const dashboardPatients = useMemo(
    () =>
      admittedPatients.map((p) => ({
        id: p.id,
        name: p.name,
        primaryConcern: p.reason,
        progressPercent: p.raw?.progress_percent ?? p.raw?.progress ?? 0,
        admittedIso: p.raw?.admitted_at || p.raw?.admissionDate || null,
      })),
    [admittedPatients]
  );

  const effectiveDailyDate = useMemo(() => {
    if (weekDateOptions.length === 0) return dailyReportDate;
    if (weekDateOptions.includes(dailyReportDate)) return dailyReportDate;
    const todayIso = new Date().toISOString().slice(0, 10);
    return weekDateOptions.includes(todayIso) ? todayIso : weekDateOptions[weekDateOptions.length - 1];
  }, [weekDateOptions, dailyReportDate]);

  const currentWeekConcludedAt = currentWeekReport?.concluded_at || null;

  useEffect(() => {
    const loadIdentity = async () => {
      if (!isSupabaseConfigured()) {
        setStaffIdentityNames([]);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setStaffIdentityNames([]);
        return;
      }
      setCurrentUserId(user.id);
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      const emailLocal = String(user.email || '').split('@')[0].replace(/[._-]+/g, ' ').trim();
      const names = Array.from(
        new Set(
          [profile?.full_name, user.user_metadata?.full_name, user.user_metadata?.name, emailLocal]
            .map((x) => String(x || '').trim().toLowerCase())
            .filter(Boolean)
        )
      );
      setStaffIdentityNames(names);
      const displayName =
        String(profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || emailLocal || '').trim();
      if (displayName) setStaffSignatureName(displayName);
    };
    void loadIdentity();
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!isSupabaseConfigured()) {
        try {
          const raw = localStorage.getItem('bh_patients');
          const list = raw ? JSON.parse(raw) : [];
          const arr = Array.isArray(list) ? list : [];
          const scopedRows = arr.filter((r) => {
            if (staffIdentityNames.length === 0) return false;
            const clm = String(r.case_load_manager ?? r.caseLoadManager ?? '').trim().toLowerCase();
            return staffIdentityNames.includes(clm);
          });
          setAdmittedPatients(
            scopedRows.map((r) => ({
              id: r.id,
              name: r.name || r.full_name,
              date: r.admitted_at || r.admissionDate
                ? new Date(r.admitted_at || r.admissionDate).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : '',
              reason: r.primary_concern || r.concern || '',
              age: deriveAge(r),
              dateOfBirth: r.date_of_birth || null,
              raw: r,
            }))
          );
        } catch {
          setAdmittedPatients([]);
        }
        return;
      }
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .is('discharged_at', null)
        .order('admitted_at', { ascending: false });
      if (error) {
        console.warn('[program-weekly-report patients]', error.message);
        setAdmittedPatients([]);
        return;
      }
      const scopedRows = (data || []).filter((r) => {
        if (staffIdentityNames.length === 0) return false;
        return staffIdentityNames.includes(String(r.case_load_manager || '').trim().toLowerCase());
      });
      setAdmittedPatients(
        scopedRows.map((r) => ({
          id: r.id,
          name: r.full_name,
          date: r.admitted_at
            ? new Date(r.admitted_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })
            : '',
          reason: r.primary_concern || '',
          age: deriveAge(r),
          dateOfBirth: r.date_of_birth || null,
          raw: r,
        }))
      );
    };
    load();
    window.addEventListener('storage', load);
    window.addEventListener(APP_DATA_REFRESH, load);
    return () => {
      window.removeEventListener('storage', load);
      window.removeEventListener(APP_DATA_REFRESH, load);
    };
  }, [staffIdentityNames]);

  /** Loads the selected week's daily_reports (by explicit week_number). */
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!activeReportPatientId || !activeWeekNumber || !isSupabaseConfigured()) {
        setWeekDailyReports([]);
        setWeekDailyReportsError('');
        return;
      }
      setWeekDailyReportsLoading(true);
      setWeekDailyReportsError('');
      let result = await fetchDailyReportsForWeek(activeReportPatientId, activeWeekNumber);
      if (result.ok && result.rows.length === 0) {
        const admittedIso = activePatientAdmittedAtIso ? String(activePatientAdmittedAtIso).slice(0, 10) : null;
        const range = admittedIso ? weekDateRange(admittedIso, activeWeekNumber) : null;
        if (range) result = await fetchDailyReportsForRange(activeReportPatientId, range.from, range.to);
      }
      if (cancelled) return;
      setWeekDailyReportsLoading(false);
      if (!result.ok) {
        setWeekDailyReportsError(result.errorMessage || 'Could not load daily reports.');
        setWeekDailyReports([]);
        return;
      }
      setWeekDailyReports(result.rows || []);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [activeReportPatientId, activeWeekNumber, activePatientAdmittedAtIso, dailyReportsRefreshKey]);

  // All weekly_reports rows for the selected patient (folder view + auto week numbering).
  useEffect(() => {
    if (!activeReportPatientId || !isSupabaseConfigured()) {
      setPatientWeeklyRows([]);
      return;
    }
    let cancelled = false;
    setPatientWeeklyLoading(true);
    (async () => {
      let { data, error } = await supabase
        .from('weekly_reports')
        .select('week_number, concluded_at, report_date, submitted_at')
        .eq('patient_id', activeReportPatientId)
        .order('week_number', { ascending: true });
      if (error && /column .* does not exist/i.test(String(error.message || ''))) {
        ({ data, error } = await supabase
          .from('weekly_reports')
          .select('week_number, report_date, submitted_at')
          .eq('patient_id', activeReportPatientId)
          .order('week_number', { ascending: true }));
      }
      if (cancelled) return;
      setPatientWeeklyRows(error ? [] : data || []);
      setPatientWeeklyLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeReportPatientId, weeklyRefreshTick]);

  // All daily-report rows for the selected patient (folder-view week counts).
  useEffect(() => {
    if (!activeReportPatientId || !isSupabaseConfigured()) {
      setPatientDailyRows([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const byPatient = await fetchDailyReportsForPatients([activeReportPatientId]);
      if (!cancelled) setPatientDailyRows(byPatient[activeReportPatientId] || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeReportPatientId, weeklyRefreshTick, dailyReportsRefreshKey]);

  // Dashboard card stats: weekly + daily report counts per assigned patient.
  useEffect(() => {
    if (view !== 'dashboard' || !isSupabaseConfigured() || admittedPatients.length === 0) return;
    let cancelled = false;
    (async () => {
      const ids = admittedPatients.map((p) => p.id).filter(Boolean);
      const { data: wkRows } = await supabase
        .from('weekly_reports')
        .select('patient_id, week_number, concluded_at')
        .in('patient_id', ids);
      const dailyByPatient = await fetchDailyReportsForPatients(ids);
      if (cancelled) return;
      const stats = {};
      for (const p of admittedPatients) {
        const wk = (wkRows || []).filter((r) => String(r.patient_id) === String(p.id));
        const daily = dailyByPatient[p.id] || [];
        const admittedIso = p.raw?.admitted_at ? String(p.raw.admitted_at).slice(0, 10) : null;
        let weeksElapsed = 0;
        if (admittedIso) {
          const days = Math.floor((Date.now() - new Date(`${admittedIso}T00:00:00`).getTime()) / 86400000);
          weeksElapsed = Math.max(1, Math.floor(days / 7) + 1);
        }
        stats[p.id] = {
          weeklyCount: wk.length,
          concludedCount: wk.filter((r) => r.concluded_at).length,
          dailyCount: daily.length,
          weeksElapsed,
        };
      }
      setStatsByPatient(stats);
    })();
    return () => {
      cancelled = true;
    };
  }, [view, admittedPatients, weeklyRefreshTick]);

  /** Load the weekly_reports row for the selected resident + week to know its concluded status. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!activeReportPatientId || !activeWeekNumber || !isSupabaseConfigured()) {
        setCurrentWeekReport(null);
        return;
      }
      let { data, error } = await supabase
        .from('weekly_reports')
        .select('week_number, concluded_at, concluded_by, compiled_daily_reports, submitted_at')
        .eq('patient_id', activeReportPatientId)
        .eq('week_number', activeWeekNumber)
        .maybeSingle();
      if (error && /column .* does not exist/i.test(String(error.message || ''))) {
        ({ data, error } = await supabase
          .from('weekly_reports')
          .select('week_number, submitted_at')
          .eq('patient_id', activeReportPatientId)
          .eq('week_number', activeWeekNumber)
          .maybeSingle());
      }
      if (cancelled) return;
      setCurrentWeekReport(error ? null : data || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeReportPatientId, activeWeekNumber, weeklyRefreshTick]);

  const dashboardLoading =
    isSupabaseConfigured() && admittedPatients.length === 0 && staffIdentityNames.length === 0;

  // Sync selected resident + week from the URL. Re-hydrate the form (incl. the nurse-filed
  // prefill) only when the patient/week actually changes.
  useEffect(() => {
    setActiveReportPatientId(urlPatient || null);
    const patient = admittedPatients.find((x) => String(x.id) === String(urlPatient));
    const key = `${urlPatient}|${urlWeek || ''}`;
    if (!urlPatient) {
      hydratedKeyRef.current = '';
      setReportBasics(INITIAL_BASICS);
      setActivePatientAdmittedAtIso(null);
      return;
    }
    if (hydratedKeyRef.current === key && patient) return;
    if (!patient) {
      if (hydratedKeyRef.current.startsWith(`${urlPatient}|`)) return;
    } else {
      setActivePatientAdmittedAtIso(patient.raw?.admitted_at || patient.raw?.admissionDate || null);
    }
    hydratedKeyRef.current = key;
    setSubmitError('');
    setConcludeConfirm(false);
    setDailySaveMessage('');
    setDailySaveError('');
    setDailyObservations('');
    setDailyAssessment('');
    setDailyFollowUp('');
    setDailyNotes('');
    setReportBasics((prev) => ({
      ...prev,
      weekLabel: urlWeek ? `Week ${urlWeek}` : '',
      admissionDate: patient?.date || '',
      patientName: patient?.name || '',
      age: patient?.age || prev.age || '',
      primaryConcern: patient?.reason || '',
    }));
    if (!patient || !urlWeek) return;
    const seq = ++hydrateSeqRef.current;
    const baseVitals = deriveVitalsFromPatient(patient.raw || {});
    setVitals(baseVitals);
    setStaffSignatureDate(new Date().toLocaleDateString('en-US'));
    const defaultDetails = { ...INITIAL_REPORT_DETAILS, upcomingProcedureDate: new Date().toLocaleDateString('en-US') };
    setReportDetails(defaultDetails);
    void (async () => {
      const partial = await loadExistingWeeklyReportPartial(String(patient.id), urlWeek);
      if (seq !== hydrateSeqRef.current) return;
      if (!partial) return;
      setVitals(() => mergeVitalsPreferReport(baseVitals, partial.vitals));
      setReportDetails(() => ({
        ...defaultDetails,
        ...partial.reportDetails,
        upcomingProcedureDate:
          (partial.reportDetails.upcomingProcedureDate && String(partial.reportDetails.upcomingProcedureDate).trim()) ||
          defaultDetails.upcomingProcedureDate,
      }));
    })();
  }, [urlPatient, urlWeek, admittedPatients]);

  const handleVitalsFieldChange = (field, value) => {
    setVitals((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'weight' || field === 'height') {
        next.bmi = computeBmiFromWeightHeight(next.weight, next.height);
      }
      return next;
    });
  };

  const handleSaveDailyReport = async () => {
    setDailySaveMessage('');
    setDailySaveError('');
    if (!activeReportPatientId) {
      setDailySaveError('Select a resident and week first.');
      return;
    }
    if (!isSupabaseConfigured()) {
      setDailySaveError('Daily reports require Supabase to be configured.');
      return;
    }
    if (!currentUserId) {
      setDailySaveError('Could not identify your staff account. Please sign in again.');
      return;
    }
    setDailySaving(true);
    const result = await upsertDailyReport({
      patientId: activeReportPatientId,
      reportDate: effectiveDailyDate || new Date().toISOString().slice(0, 10),
      authorId: currentUserId,
      authorRole: 'program',
      weekNumber: activeWeekNumber,
      observations: dailyObservations,
      assessment: dailyAssessment,
      followUp: dailyFollowUp,
      notes: dailyNotes,
    });
    setDailySaving(false);
    if (!result.ok) {
      setDailySaveError(result.errorMessage || 'Could not save daily report.');
      return;
    }
    setDailySaveMessage('Daily report saved.');
    setDailyReportsRefreshKey((k) => k + 1);
  };

  const handleEditDailyRow = (row) => {
    if (!row) return;
    setDailyReportDate(row.report_date);
    setDailyObservations(row.observations || '');
    setDailyAssessment(row.assessment || '');
    setDailyFollowUp(row.follow_up || '');
    setDailyNotes(row.notes || '');
    setDailySaveMessage('');
    setDailySaveError('');
  };

  const mirrorWeeklyReportToLocal = (patientId, weekNum, entry) => {
    try {
      const raw = localStorage.getItem(WEEKLY_REPORTS_STORAGE_KEY);
      const all = raw ? JSON.parse(raw) : {};
      const key = String(patientId);
      all[key] = { ...(all[key] || {}), [String(weekNum)]: entry };
      localStorage.setItem(WEEKLY_REPORTS_STORAGE_KEY, JSON.stringify(all));
    } catch {
      /* ignore */
    }
  };
  const mirrorPatientVitalsToLocal = (patientId, nextVitals) => {
    try {
      const raw = localStorage.getItem('bh_patients');
      const all = raw ? JSON.parse(raw) : [];
      const updated = (Array.isArray(all) ? all : []).map((p) => {
        if (String(p?.id) !== String(patientId)) return p;
        return {
          ...p,
          current_weight: nextVitals.weight || null,
          weight_kg: nextVitals.weight || null,
          height_cm: nextVitals.height || null,
          bmi: nextVitals.bmi || null,
          bp: nextVitals.bp || null,
          pr: nextVitals.pr || null,
          rr: nextVitals.rr || null,
          spo2: nextVitals.spo2 || null,
          temperature_f: nextVitals.temperature || null,
        };
      });
      localStorage.setItem('bh_patients', JSON.stringify(updated));
    } catch {
      /* ignore */
    }
  };

  const persistWeeklyReport = useCallback(async ({ conclude = false } = {}) => {
    const weekMatch = String(reportBasics.weekLabel || '').match(/(\d+)/);
    const weekNum = weekMatch ? weekMatch[1] : null;
    const concludedAtIso = conclude ? new Date().toISOString() : null;
    const compiledDaily = conclude ? snapshotDailyReports(weekDailyReports) : null;

    let patientId = activeReportPatientId;
    if (!patientId && reportBasics.patientName) {
      if (!isSupabaseConfigured()) {
        try {
          const pts = JSON.parse(localStorage.getItem('bh_patients') || '[]');
          const n = String(reportBasics.patientName).trim().toLowerCase();
          const match = pts.find((x) => String(x.name || '').trim().toLowerCase() === n);
          if (match) patientId = match.id;
        } catch {
          /* ignore */
        }
      } else {
        const n = String(reportBasics.patientName).trim().toLowerCase();
        const match = admittedPatients.find((x) => String(x.name || '').trim().toLowerCase() === n);
        if (match) patientId = match.id;
      }
    }

    if (patientId == null || !weekNum) {
      setShowConfirm(false);
      setConcludeConfirm(false);
      setSubmitError('Select resident and week first before submitting.');
      return;
    }
    if (conclude) setConcluding(true);

    const staffName = staffSignatureName.trim();
    const reportDateField = staffSignatureDate.trim();
    const pname = (reportBasics.patientName || 'Resident').trim();
    const submittedAt = new Date().toISOString();
    const progressFromPatient = (() => {
      const p = admittedPatients.find((x) => String(x.id) === String(patientId));
      const raw = Number(p?.raw?.progress_percent ?? p?.raw?.progress);
      return Number.isFinite(raw) ? raw : null;
    })();
    const summaryText = [
      formatMedicationTableNoteSection('Current medications', reportDetails.currentMedications),
      reportDetails.interventionMedication && `Medication intervention: ${reportDetails.interventionMedication}`,
      formatBulletedListNoteSection('Ongoing medical concern', reportDetails.ongoingMedicalConcern),
    ]
      .filter(Boolean)
      .join('\n');
    const recommendationText = [
      reportDetails.interventionNutrition && `Nutrition intervention: ${reportDetails.interventionNutrition}`,
      reportDetails.upcomingProcedureDescription && `Upcoming procedure: ${reportDetails.upcomingProcedureDescription}`,
      reportDetails.upcomingProcedureDate && `Scheduled date: ${reportDetails.upcomingProcedureDate}`,
    ]
      .filter(Boolean)
      .join('\n');
    const noteText = [
      formatBulletedListNoteSection('Dietary restrictions', reportDetails.dietaryRestrictions),
      reportDetails.foodAllergies && `Food allergies: ${reportDetails.foodAllergies}`,
      formatBulletedListNoteSection('Clinical notes', reportDetails.ongoingMedicalConcern),
    ]
      .filter(Boolean)
      .join('\n');
    const existingLocalConcludedAt = (() => {
      try {
        const all = JSON.parse(localStorage.getItem(WEEKLY_REPORTS_STORAGE_KEY) || '{}');
        return all?.[String(patientId)]?.[String(weekNum)]?.concludedAt || null;
      } catch {
        return null;
      }
    })();
    const localEntry = {
      submittedAt,
      concludedAt: concludedAtIso || existingLocalConcludedAt,
      compiledDailyReports: compiledDaily || undefined,
      patientName: reportBasics.patientName,
      nurseName: staffName,
      reportDate: reportDateField,
      summary: summaryText,
      nurseNote: noteText,
      dietaryRestrictions: reportDetails.dietaryRestrictions || '',
      foodAllergies: reportDetails.foodAllergies || '',
      ongoingMedicalConcern: reportDetails.ongoingMedicalConcern || '',
      behaviorObservation: reportDetails.ongoingMedicalConcern,
      recommendations: recommendationText,
      progressPercent: progressFromPatient,
      vitalsWeight: vitals.weight,
      vitalsHeight: vitals.height,
      vitalsBmi: vitals.bmi,
      vitalsBp: vitals.bp,
      vitalsPr: vitals.pr,
      vitalsRr: vitals.rr,
      vitalsSpo2: vitals.spo2,
      vitalsTemperature: vitals.temperature,
    };

    if (!isSupabaseConfigured()) {
      try {
        mirrorWeeklyReportToLocal(patientId, weekNum, localEntry);
        mirrorPatientVitalsToLocal(patientId, vitals);
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event(APP_DATA_REFRESH));
        await appendActivityFeed(
          conclude
            ? `Weekly report concluded for ${pname} (${reportBasics.weekLabel || `week ${weekNum}`}).`
            : `Weekly care report draft saved for ${pname} (${reportBasics.weekLabel || `week ${weekNum}`}).`
        );
      } catch {
        /* ignore */
      }
      setShowConfirm(false);
      setConcludeConfirm(false);
      setConcluding(false);
      setSubmitError('');
      setWeeklyRefreshTick((t) => t + 1);
      setSearchParams({ patient: String(patientId) });
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: patientRow } = await supabase.from('patients').select('family_id').eq('id', patientId).maybeSingle();

    const basePayload = {
      patient_id: patientId,
      week_number: parseInt(weekNum, 10),
      nurse_name: staffName || null,
      report_date: reportDateField || null,
      created_by: user?.id ?? null,
      submitted_at: submittedAt,
    };
    const enrichedPayload = {
      ...basePayload,
      summary: summaryText || null,
      nurse_note: noteText || null,
      behavior_observation: reportDetails.ongoingMedicalConcern || null,
      recommendations: recommendationText || null,
      notes: noteText || null,
      progress_percent: progressFromPatient,
      current_medications: reportDetails.currentMedications || null,
      medication_intervention: reportDetails.interventionMedication || null,
      dietary_restrictions: reportDetails.dietaryRestrictions || null,
      food_allergies: reportDetails.foodAllergies || null,
      nutrition_intervention: reportDetails.interventionNutrition || null,
      ongoing_medical_concern: reportDetails.ongoingMedicalConcern || null,
      upcoming_procedure_description: reportDetails.upcomingProcedureDescription || null,
      upcoming_procedure_date: reportDetails.upcomingProcedureDate || null,
      vitals_weight: vitals.weight || null,
      vitals_height: vitals.height || null,
      vitals_bmi: vitals.bmi || null,
      vitals_bp: vitals.bp || null,
      vitals_pr: vitals.pr || null,
      vitals_rr: vitals.rr || null,
      vitals_spo2: vitals.spo2 || null,
      vitals_temperature: vitals.temperature || null,
    };
    const concludeCols = conclude
      ? { concluded_at: concludedAtIso, concluded_by: user?.id ?? null, compiled_daily_reports: compiledDaily }
      : {};
    let { error } = await supabase
      .from('weekly_reports')
      .upsert({ ...enrichedPayload, ...concludeCols }, { onConflict: 'patient_id,week_number' });
    if (error && /column .* does not exist/i.test(String(error.message || ''))) {
      ({ error } = await supabase.from('weekly_reports').upsert(enrichedPayload, { onConflict: 'patient_id,week_number' }));
      if (error && /column .* does not exist/i.test(String(error.message || ''))) {
        ({ error } = await supabase.from('weekly_reports').upsert(basePayload, { onConflict: 'patient_id,week_number' }));
      }
    }

    if (error) {
      console.warn('[weekly_reports upsert]', error.message);
      setSubmitError(`Failed to save weekly report: ${error.message}`);
      setShowConfirm(false);
      setConcludeConfirm(false);
      setConcluding(false);
      return;
    } else {
      // Always mirror weekly report vitals locally so admin view can render latest values
      // even if some database columns are not yet available.
      mirrorWeeklyReportToLocal(patientId, weekNum, localEntry);

      const patientVitalsPayload = {
        current_weight: vitals.weight || null,
        weight_kg: vitals.weight || null,
        height_cm: vitals.height || null,
        bmi: vitals.bmi || null,
        bp: vitals.bp || null,
        pr: vitals.pr || null,
        rr: vitals.rr || null,
        spo2: vitals.spo2 || null,
        temperature_f: vitals.temperature || null,
        medical_staff_note: staffName || null,
      };
      // Keep patient master vitals in sync with the latest nurse weekly filing.
      const { error: patientVitalsError } = await supabase
        .from('patients')
        .update(patientVitalsPayload)
        .eq('id', patientId);
      if (patientVitalsError) {
        console.warn('[patients vitals update]', patientVitalsError.message);
        // Non-blocking: weekly report was saved already; keep flow moving.
        setSubmitError(`Weekly report saved, but patient vitals update failed: ${patientVitalsError.message}`);
      }
      mirrorPatientVitalsToLocal(patientId, vitals);
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event(APP_DATA_REFRESH));
      await appendActivityFeed(
        conclude
          ? `Weekly report concluded for ${pname} (${reportBasics.weekLabel || `week ${weekNum}`}).`
          : `Weekly care report draft saved for ${pname} (${reportBasics.weekLabel || `week ${weekNum}`}).`,
        { familyId: patientRow?.family_id ?? null }
      );
      // The family notification is fired by the weekly_reports "conclude" DB trigger — never
      // on a draft save.
    }

    setSubmitError('');
    setShowConfirm(false);
    setConcludeConfirm(false);
    setConcluding(false);
    setWeeklyRefreshTick((t) => t + 1);
    setSearchParams({ patient: String(patientId) });
  }, [activeReportPatientId, admittedPatients, reportBasics.patientName, reportBasics.weekLabel, setSearchParams, reportDetails, vitals, staffSignatureName, staffSignatureDate, weekDailyReports]);

  const handleConcludeWeek = useCallback(() => {
    void persistWeeklyReport({ conclude: true });
  }, [persistWeeklyReport]);

  return (
    <div className="wr-container family-portal admin-portal-layout" style={familySidebarStyle(isExpanded)}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .wr-container {
          display: flex;
          width: 100%;
          min-height: 100vh;
          background: #F8F9FD;
          font-family: 'Inter', -apple-system, sans-serif;
          color: #1B2559;
          overflow-x: hidden;
        }

        .sidebar-label {
          display: ${isExpanded ? 'block' : 'none'};
          font-weight: 600;
          font-size: 15px;
          color: #A3AED0;
          line-height: 1.25;
          white-space: normal;
          max-width: 210px;
        }

        /* ---- MAIN ---- */
        .wr-main {
          flex: 1;
          margin-left: var(--family-sidebar-w, 110px);
          transition: margin-left var(--family-sidebar-duration, 0.42s) var(--family-sidebar-ease, cubic-bezier(0.22, 1, 0.36, 1));
          padding: 28px 34px 36px;
          overflow-y: auto;
          min-height: 100vh;
          background: linear-gradient(180deg, #F8FAFF 0%, #EEF3FF 100%);
        }

        /* ---- HEADER ---- */
        .wr-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          position: relative;
          background: linear-gradient(135deg,#1E293B 0%,#1D2D50 60%,#312e81 100%);
          border-radius: 20px;
          padding: 22px 24px;
          box-shadow: 0 12px 34px rgba(15,23,42,0.16);
          overflow: visible;
        }

        .wr-header::before {
          content: '';
          position: absolute;
          top: -30px;
          right: -20px;
          width: 130px;
          height: 130px;
          border-radius: 50%;
          background: rgba(255,255,255,0.06);
          pointer-events: none;
        }

        .wr-header::after {
          content: '';
          position: absolute;
          bottom: -24px;
          right: 80px;
          width: 84px;
          height: 84px;
          border-radius: 50%;
          background: rgba(255,255,255,0.05);
          pointer-events: none;
        }

        .wr-header h1 {
          font-size: 24px;
          font-weight: 900;
          color: #FFFFFF;
          margin-bottom: 4px;
          letter-spacing: -0.02em;
          position: relative;
          z-index: 1;
        }

        .wr-header p {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255,255,255,0.68);
          position: relative;
          z-index: 1;
        }

        .wr-header-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 12px;
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 700;
          color: #FFFFFF;
          cursor: pointer;
          box-shadow: 0 6px 16px rgba(15,23,42,0.18);
          backdrop-filter: blur(6px);
          font-family: 'Inter', sans-serif;
          position: relative;
          z-index: 1;
          transition: background 0.2s, border-color 0.2s, transform 0.2s;
        }

        .wr-header-btn:hover {
          background: rgba(255,255,255,0.16);
          border-color: rgba(255,255,255,0.34);
          transform: translateY(-1px);
        }

        .wr-picker-wrap { position: relative; align-self: flex-start; z-index: 650; }

        .wr-patient-picker {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          width: min(400px, 92vw);
          max-height: min(440px, 72vh);
          overflow-y: auto;
          background: white;
          border: 1px solid #E9EDF7;
          border-radius: 16px;
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.14);
          z-index: 900;
          padding: 8px;
          color-scheme: light;
        }

        .wr-patient-picker-title {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #A3AED0;
          padding: 8px 10px 6px;
        }

        .wr-patient-search {
          position: relative;
          margin: 0 2px 10px;
        }

        .wr-patient-search input {
          width: 100%;
          box-sizing: border-box;
          padding: 9px 12px 9px 34px;
          border: 1px solid #E5ECFF;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          font-family: 'Inter', sans-serif;
          color: #1B2559;
          background: #FCFDFF;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
        }

        .wr-patient-search input::placeholder { color: #A3AED0; font-weight: 400; }

        .wr-patient-search input:focus {
          border-color: #8EA2FF;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
          background: #FFFFFF;
        }

        .wr-patient-search svg {
          position: absolute;
          left: 11px;
          top: 50%;
          transform: translateY(-50%);
          color: #A3AED0;
          pointer-events: none;
        }

        .wr-patient-block {
          border-radius: 12px;
          border: 1px solid #E9EDF7;
          margin-bottom: 8px;
          overflow: hidden;
          background: #FAFBFF;
        }

        .wr-patient-block:last-child { margin-bottom: 0; }

        .wr-patient-row-header {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 12px;
          border: none;
          background: transparent;
          cursor: pointer;
          text-align: left;
          font-family: 'Inter', sans-serif;
        }

        .wr-patient-row-header:hover { background: #F4F7FE; }

        .wr-patient-avatar {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: #FFF0ED;
          color: #F54E25;
          font-weight: 800;
          font-size: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .wr-patient-info-text { flex: 1; min-width: 0; }

        .wr-patient-name {
          font-size: 14px;
          font-weight: 800;
          color: #1B2559;
        }

        .wr-patient-meta {
          font-size: 11px;
          color: #64748B;
          margin-top: 3px;
          line-height: 1.4;
        }

        .wr-patient-chevron {
          color: #A3AED0;
          flex-shrink: 0;
          transition: transform 0.2s ease;
        }

        .wr-patient-chevron.open { transform: rotate(180deg); }

        .wr-weeks-panel {
          border-top: 1px solid #E9EDF7;
          background: white;
          padding: 10px 12px 14px;
        }

        .wr-weeks-label {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #A3AED0;
          margin-bottom: 10px;
        }

        .wr-weeks-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .wr-week-chip {
          border: 1px solid #E9EDF7;
          background: white;
          border-radius: 10px;
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 700;
          color: #1B2559;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          transition: border-color 0.15s, background 0.15s;
        }

        .wr-week-chip:hover {
          border-color: #F54E25;
          background: #FFF9F7;
          color: #F54E25;
        }

        .wr-picker-empty {
          padding: 22px 14px;
          text-align: center;
          font-size: 13px;
          color: #64748B;
          line-height: 1.55;
        }

        .wr-patient-picker-btn {
          display: none;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          margin-top: 12px;
          background: white;
          border: 1px solid #E9EDF7;
          border-radius: 12px;
          padding: 12px 16px;
          font-size: 13px;
          font-weight: 700;
          color: #1B2559;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          font-family: 'Inter', sans-serif;
        }

        /* ---- FORM PAPER ---- */
        .wr-paper {
          width: 100%;
          max-width: 1320px;
          margin: 0 auto;
          background: linear-gradient(180deg, #FFFFFF 0%, #FCFDFF 100%);
          border-radius: 24px;
          border: 1px solid #E9EDF7;
          padding: 28px;
          box-shadow: 0 18px 40px rgba(15,23,42,0.08);
        }

        .wr-paper-title {
          font-size: 20px;
          font-weight: 900;
          color: #1B2559;
          margin-bottom: 24px;
          padding-bottom: 14px;
          border-bottom: 1px solid #F4F7FE;
          letter-spacing: -0.01em;
        }

        /* ---- FORM ELEMENTS ---- */
        .form-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 22px;
        }

        .form-field { display: flex; flex-direction: column; }

        .form-label {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #1B2559;
          margin-bottom: 6px;
        }

        .form-label-required {
          color: #F54E25;
        }

        .form-underline-input {
          background: #FCFDFF;
          border: 1px solid #E5ECFF;
          border-radius: 10px;
          outline: none;
          padding: 10px 12px;
          font-size: 14px;
          font-weight: 600;
          color: #1B2559;
          font-family: 'Inter', sans-serif;
          width: 100%;
          transition: border-color 0.18s, box-shadow 0.18s, background 0.18s;
        }

        .form-underline-input::placeholder { color: #A3AED0; font-weight: 400; }
        .form-underline-input:focus {
          border-color: #8EA2FF;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
          background: #FFFFFF;
        }

        .form-underline-input--readonly,
        .form-textarea--readonly {
          background: #F1F5F9;
          border-color: #E2E8F0;
          color: #94A3B8;
          cursor: not-allowed;
        }

        .form-underline-input--readonly:focus,
        .form-textarea--readonly:focus {
          border-color: #E2E8F0;
          box-shadow: none;
          background: #F1F5F9;
        }

        .wr-nurse-only-note {
          margin: -6px 0 14px;
          font-size: 12px;
          color: #64748B;
          line-height: 1.45;
          font-weight: 500;
        }

        /* ---- SECTION ---- */
        .form-section {
          margin-bottom: 18px;
          padding: 18px 18px 16px;
          border: 1px solid #E9EDF7;
          border-radius: 16px;
          background: linear-gradient(180deg, #FFFFFF 0%, #FBFCFF 100%);
          box-shadow: 0 6px 18px rgba(15,23,42,0.03);
        }

        /* Whole-card faded treatment for sections the nurse fills and program staff can only
           review — not just the individual inputs inside them, the entire card reads as
           locked/unavailable, the way a disabled panel does elsewhere in the app. */
        .form-section--readonly {
          background: #F1F5F9;
          border-color: #E2E8F0;
          box-shadow: none;
          opacity: 0.6;
          cursor: not-allowed;
        }

        .form-section--readonly .section-title {
          color: #64748B;
        }

        .form-section--readonly .section-title::before {
          background: #94A3B8;
        }

        .section-title {
          font-size: 13px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          color: #1B2559;
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .section-title::before {
          content: '';
          display: inline-block;
          width: 3px;
          height: 14px;
          background: linear-gradient(180deg, #4F46E5 0%, #312E81 100%);
          border-radius: 2px;
        }

        /* ---- TEXTAREA ---- */
        .form-textarea {
          width: 100%;
          border: 1px solid #E5ECFF;
          border-radius: 12px;
          padding: 15px;
          height: 124px;
          background: #FCFDFF;
          outline: none;
          font-size: 13px;
          font-family: 'Inter', sans-serif;
          color: #1B2559;
          resize: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }

        .form-textarea:focus {
          border-color: #8EA2FF;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
          background: #FFFFFF;
        }
        .form-textarea::placeholder { color: #A3AED0; }

        /* ---- SECTION FIELDS ---- */
        .section-fields { display: flex; flex-direction: column; gap: 20px; }

        /* ---- SUBMIT ---- */
        .submit-row {
          display: flex;
          justify-content: flex-end;
          padding-top: 18px;
        }

        .btn-submit {
          background: linear-gradient(145deg, #F54E25, #EA5A37);
          color: white;
          border: none;
          padding: 14px 48px;
          border-radius: 18px;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 8px 18px rgba(245, 78, 37, 0.28);
          transition: all 0.2s ease;
          font-family: 'Inter', sans-serif;
        }

        .btn-submit:hover { filter: brightness(1.02); transform: translateY(-1px); }
        .btn-submit:active { transform: scale(0.98); }

        /* ---- CONFIRM DIALOG ---- */
        .confirm-bar {
          display: flex;
          align-items: center;
          gap: 16px;
          background: white;
          border: 1px solid #E9EDF7;
          border-radius: 14px;
          padding: 14px 20px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.08);
          animation: fadeInUp 0.2s ease-out;
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .confirm-text {
          font-size: 14px;
          font-weight: 600;
          color: #1B2559;
          white-space: nowrap;
        }

        .confirm-btn-cancel {
          background: white;
          border: 1px solid #E9EDF7;
          border-radius: 10px;
          padding: 10px 20px;
          font-size: 13px;
          font-weight: 700;
          color: #1B2559;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          transition: background 0.15s;
        }

        .confirm-btn-cancel:hover { background: #F4F7FE; }

        .confirm-btn-ok {
          background: linear-gradient(145deg, #F54E25, #EA5A37);
          border: none;
          border-radius: 10px;
          padding: 10px 20px;
          font-size: 13px;
          font-weight: 700;
          color: white;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          transition: background 0.15s;
          box-shadow: 0 4px 12px rgba(245, 78, 37, 0.22);
        }

        .confirm-btn-ok:hover { filter: brightness(1.02); }

        .wr-header-btn { margin-right: 40px; }

        /* ---- DAILY REPORT / AI DRAFT ---- */
        .wr-section-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }

        .wr-section-title-row .section-title { margin-bottom: 0; }

        .btn-inline-action {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #FFF0EB;
          color: #F54E25;
          border: 1px solid #FFD9CC;
          border-radius: 10px;
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          transition: background 0.15s, transform 0.15s;
          white-space: nowrap;
        }

        .btn-inline-action:hover:not(:disabled) { background: #FFE2D6; }
        .btn-inline-action:disabled { opacity: 0.6; cursor: not-allowed; }

        .wr-daily-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .wr-daily-grid .form-textarea { height: 90px; }

        .wr-save-feedback {
          margin-top: 10px;
          font-size: 12px;
          font-weight: 700;
          line-height: 1.4;
        }

        .wr-save-feedback--ok { color: #15803D; }
        .wr-save-feedback--error { color: #991B1B; }

        .wr-daily-entries-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 14px;
        }

        .wr-daily-entry-row {
          border: 1px solid #E9EDF7;
          background: #FAFBFF;
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 12px;
          color: #334155;
          line-height: 1.5;
        }

        .wr-daily-entry-date {
          font-weight: 800;
          color: #1B2559;
          margin-right: 6px;
        }

        .wr-daily-entries-empty {
          font-size: 12px;
          color: #94A3B8;
          font-weight: 600;
          margin-bottom: 14px;
        }

        /* ---- MOBILE ---- */
        .mobile-only { display: none; }

        @media (max-width: 768px) {
          html, body { overflow-x: hidden; }
          .wr-container {
            flex-direction: column;
            overflow-x: hidden;
            width: 100vw;
          }

          .desktop-sidebar { display: none !important; }
          .mobile-only { display: flex !important; }

          /* Mobile top bar */
          .mobile-top-bar {
            position: sticky;
            top: 0;
            z-index: 300;
            width: 100vw;
            padding: 0 20px;
            height: 64px;
            background: white;
            border-bottom: 1px solid #F1F1F1;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          }

          .mobile-top-bar-title {
            font-size: 16px;
            font-weight: 800;
            color: #F54E25;
          }

          /* Main area */
          .wr-main {
            margin-left: 0 !important;
            width: 100vw;
            padding: 20px 16px 100px 16px;
            min-height: 100vh;
          }

          /* Header */
          .wr-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 6px;
            margin-bottom: 24px;
            padding: 16px 16px;
            border-radius: 16px;
          }

          .wr-header h1 { font-size: 20px; }
          .wr-header p { font-size: 12px; }
          .wr-header-btn { display: none; }

          .wr-patient-picker-btn { display: flex !important; }

          .wr-picker-wrap {
            width: 100%;
            align-self: stretch;
          }

          .wr-patient-picker {
            right: auto;
            left: 0;
            width: 100%;
            max-height: min(380px, 58vh);
          }

          /* Paper */
          .wr-paper {
            padding: 24px 18px;
            border-radius: 20px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.05);
          }

          .wr-paper-title { font-size: 17px; margin-bottom: 28px; }

          /* Form grid stacks to 1 col */
          .form-grid-2 {
            grid-template-columns: 1fr;
            gap: 24px;
            margin-bottom: 28px;
          }

          .wr-daily-grid { grid-template-columns: 1fr; gap: 20px; }

          .wr-section-title-row { align-items: stretch; }
          .btn-inline-action { width: 100%; justify-content: center; }

          .form-section { margin-bottom: 28px; }
          .section-fields { gap: 24px; }

          .section-title { font-size: 12px; margin-bottom: 16px; }

          .form-label { font-size: 10px; }
          .form-underline-input { font-size: 13px; padding: 8px 0; }
          .form-textarea { font-size: 13px; height: 100px; padding: 12px; border-radius: 10px; }

          /* Confirm bar stacks on mobile */
          .confirm-bar {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
            padding: 18px;
            border-radius: 16px;
          }
          .confirm-text { font-size: 15px; text-align: center; }
          .confirm-btn-cancel, .confirm-btn-ok { padding: 14px; font-size: 14px; border-radius: 12px; }

          /* Submit button full width */
          .btn-submit { width: 100%; padding: 16px; font-size: 15px; border-radius: 14px; }
          .submit-row { padding-top: 28px; }

          /* Mobile bottom nav */
          .mobile-bottom-nav {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            min-height: 72px;
            background: white;
            border-top: 1px solid #F1F1F1;
            display: flex;
            justify-content: space-around;
            align-items: center;
            flex-wrap: wrap;
            gap: 4px 2px;
            padding: 6px 4px;
            z-index: 1000;
            padding-bottom: calc(6px + env(safe-area-inset-bottom));
            box-shadow: 0 -4px 20px rgba(0,0,0,0.06);
          }

          .mob-nav-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
            font-size: 9px;
            font-weight: 700;
            color: #A3AED0;
            cursor: pointer;
            min-width: 0;
            flex: 1 1 0;
            max-width: 72px;
          }

          .mob-nav-item.active { color: #F54E25; }
        }
      `}</style>

      {/* SIDEBAR — shared AdminSidebar, same as nurse/admin portals */}
      <AdminSidebar
        isExpanded={isExpanded}
        onToggleExpanded={() => setIsExpanded(!isExpanded)}
        dashboardPath="/program"
        brandTagline="Program Portal"
        showProfile={false}
      >
        <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/program'); }}>
          <div className="sidebar-icon-wrap"><Users size={22} color="#707EAE" /></div>
          <span className="sidebar-label">Assigned residents</span>
        </div>
        <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/program-discharge'); }}>
          <div className="sidebar-icon-wrap"><ArrowRightSquare size={22} color="#707EAE" /></div>
          <span className="sidebar-label">Discharge management</span>
        </div>
        <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/program-calendar'); }}>
          <div className="sidebar-icon-wrap"><CalendarIcon size={22} color="#707EAE" /></div>
          <span className="sidebar-label">Calendar</span>
        </div>
        <div
          className="sidebar-nav-item sidebar-nav-active"
          onClick={(e) => { e.stopPropagation(); navigate('/program-weekly-report'); }}
        >
          <div className="sidebar-icon-wrap"><FileText size={22} color="#707EAE" /></div>
          <span className="sidebar-label">Reports</span>
        </div>
      </AdminSidebar>


      {/* MOBILE TOP BAR */}
      <div className="mobile-only mobile-top-bar">
        <img src={logo} alt="Kalinga" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
          <span className="mobile-top-bar-title">Weekly Report</span>
        <div style={{ width: 36, height: 36, background: '#F54E25', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px' }}>JD</div>
      </div>

      {/* MAIN */}
      <main className="wr-main">

        {/* Header */}
        <div className="wr-header">
          <div>
            <h1>Program Reports</h1>
            <p>
              {view === 'dashboard'
                ? 'Your assigned residents and their report folders'
                : view === 'folders'
                  ? reportBasics.patientName || 'Resident'
                  : `${reportBasics.patientName || 'Resident'} · ${reportBasics.weekLabel || ''} ${view === 'daily-form' ? 'Daily Report' : 'Weekly Report'}`}
            </p>
          </div>
          {view !== 'dashboard' ? (
            <button
              type="button"
              className="wr-header-btn"
              style={{ display: 'inline-flex', marginRight: 0 }}
              onClick={() => (view === 'folders' ? goDashboard() : goFolders(urlPatient))}
            >
              <ChevronLeft size={16} color="#FFFFFF" />
              {view === 'folders' ? 'All patients' : 'Back to folders'}
            </button>
          ) : null}
        </div>

        {/* Paper */}
        <div className="wr-paper">
          {view === 'dashboard' && (
            <ReportPatientDashboard
              title="Assigned residents"
              subtitle="Search a resident, then open their report folders."
              patients={dashboardPatients}
              statsByPatient={statsByPatient}
              loading={dashboardLoading}
              onOpenPatient={(id) => goFolders(id)}
            />
          )}

          {view === 'folders' && (
            <PatientReportFolders
              patient={{ name: reportBasics.patientName, primaryConcern: reportBasics.primaryConcern }}
              weeklyRows={patientWeeklyRows}
              dailyCountsByWeek={dailyCountsByWeek}
              addWeeklyTarget={weekPlan.addWeeklyTarget}
              currentWorkingWeek={weekPlan.currentWorkingWeek}
              loading={patientWeeklyLoading}
              onBack={goDashboard}
              onOpenWeek={(n) => goForm(urlPatient, n, 'weekly')}
              onAddDaily={(w) => goForm(urlPatient, w || weekPlan.currentWorkingWeek, 'daily')}
              onAddWeekly={() => goForm(urlPatient, weekPlan.addWeeklyTarget.week, 'weekly')}
            />
          )}

          {view === 'daily-form' && (
          <div className="form-section">
            <div className="section-title">{reportBasics.weekLabel ? `${reportBasics.weekLabel} — Daily Report` : 'Daily Report'}</div>
            <p className="wr-nurse-only-note">
              Internal per-day notes for {reportBasics.patientName || 'the selected resident'}. These are the
              source records the Weekly Report is compiled from — never shown to families or admins on their own.
            </p>
            {!activeReportPatientId ? (
              <span className="wr-daily-entries-empty" style={{ marginBottom: 0 }}>No resident selected.</span>
            ) : (
              <>
                <div className="form-field" style={{ maxWidth: 260, marginBottom: 16 }}>
                  <label className="form-label">Report date:</label>
                  {weekDateOptions.length > 0 ? (
                    <select
                      className="form-underline-input"
                      value={effectiveDailyDate}
                      onChange={(e) => setDailyReportDate(e.target.value)}
                    >
                      {weekDateOptions.map((iso) => (
                        <option key={iso} value={iso}>
                          {new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="date"
                      className="form-underline-input"
                      value={effectiveDailyDate}
                      onChange={(e) => setDailyReportDate(e.target.value)}
                    />
                  )}
                </div>
                <div className="wr-daily-grid">
                  <div className="form-field">
                    <label className="form-label">Observations:</label>
                    <textarea
                      className="form-textarea"
                      placeholder="What did you observe?"
                      value={dailyObservations}
                      onChange={(e) => setDailyObservations(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Assessment:</label>
                    <textarea
                      className="form-textarea"
                      placeholder="Your assessment..."
                      value={dailyAssessment}
                      onChange={(e) => setDailyAssessment(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Follow-up:</label>
                    <textarea
                      className="form-textarea"
                      placeholder="Any follow-up needed..."
                      value={dailyFollowUp}
                      onChange={(e) => setDailyFollowUp(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Notes:</label>
                    <textarea
                      className="form-textarea"
                      placeholder="Additional notes..."
                      value={dailyNotes}
                      onChange={(e) => setDailyNotes(e.target.value)}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-inline-action"
                    onClick={handleSaveDailyReport}
                    disabled={dailySaving || !activeReportPatientId}
                  >
                    {dailySaving ? 'Saving…' : 'Save Daily Report'}
                  </button>
                  {dailySaveMessage ? <span className="wr-save-feedback wr-save-feedback--ok">{dailySaveMessage}</span> : null}
                  {dailySaveError ? <span className="wr-save-feedback wr-save-feedback--error">{dailySaveError}</span> : null}
                </div>

                <div style={{ marginTop: 20 }}>
                  <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>
                    Daily reports for {reportBasics.weekLabel || 'this week'}
                  </label>
                  {weekDailyReportsLoading ? (
                    <p className="wr-daily-entries-empty">Loading this week&rsquo;s daily reports…</p>
                  ) : weekDailyReportsError ? (
                    <p className="wr-save-feedback wr-save-feedback--error">{weekDailyReportsError}</p>
                  ) : weekDailyReports.length === 0 ? (
                    <p className="wr-daily-entries-empty">No daily reports logged for this week yet.</p>
                  ) : (
                    <div className="wr-daily-entries-list">
                      {weekDailyReports.map((r) => (
                        <div key={`${r.report_date}-${r.author_id}`} className="wr-daily-entry-row">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span className="wr-daily-entry-date">
                              {r.report_date}{r.author_role ? ` · ${r.author_role}` : ''}
                            </span>
                            {r.author_id === currentUserId ? (
                              <button
                                type="button"
                                className="confirm-btn-cancel"
                                style={{ padding: '4px 12px', fontSize: 11 }}
                                onClick={() => handleEditDailyRow(r)}
                              >
                                Edit
                              </button>
                            ) : null}
                          </div>
                          {[r.observations, r.assessment, r.follow_up, r.notes].filter(Boolean).join(' · ') || 'No details logged.'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          )}

          {view === 'weekly-form' && (
          <>
          <div className="wr-paper-title" style={{ marginTop: 4 }}>
            {reportBasics.weekLabel || 'Weekly Report'}
            {currentWeekConcludedAt ? ' — concluded' : ''}
          </div>
          <div style={{ marginBottom: 16 }}>
            <button
              type="button"
              className="btn-inline-action"
              onClick={() => goForm(urlPatient, activeWeekNumber, 'daily')}
            >
              + Add Daily Report for {reportBasics.weekLabel || 'this week'}
            </button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); setShowConfirm(true); }}>

            {/* Week & Admission Date — week is assigned automatically from the folder view */}
            <div className="form-grid-2">
              <div className="form-field">
                <label className="form-label">Week: <span className="form-label-required">*</span></label>
                <input
                  type="text"
                  className="form-underline-input form-underline-input--readonly"
                  value={reportBasics.weekLabel}
                  readOnly
                  aria-readonly="true"
                />
              </div>
              <div className="form-field">
                <label className="form-label">Admission Date: <span className="form-label-required">*</span></label>
                <input
                  type="text"
                  className="form-underline-input form-underline-input--readonly"
                  value={reportBasics.admissionDate}
                  readOnly
                  aria-readonly="true"
                />
              </div>
            </div>

            {/* Resident Information — pulled from the resident record, not editable here */}
            <div className="form-section form-section--readonly">
              <div className="section-title">Resident Information</div>
              <div className="section-fields">
                <div className="form-field">
                  <label className="form-label">Resident Name: <span className="form-label-required">*</span></label>
                  <input
                    type="text"
                    className="form-underline-input form-underline-input--readonly"
                    value={reportBasics.patientName}
                    readOnly
                    aria-readonly="true"
                  />
                </div>
                <div className="form-grid-2">
                  <div className="form-field">
                    <label className="form-label">Age: <span className="form-label-required">*</span></label>
                    <input
                      type="text"
                      className="form-underline-input form-underline-input--readonly"
                      value={reportBasics.age}
                      readOnly
                      aria-readonly="true"
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Primary Concern: <span className="form-label-required">*</span></label>
                    <input
                      type="text"
                      className="form-underline-input form-underline-input--readonly"
                      value={reportBasics.primaryConcern}
                      readOnly
                      aria-readonly="true"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Current Medications */}
            <div className="form-section form-section--readonly">
              <div className="section-title">Current Medications</div>
              <p className="wr-nurse-only-note">Filled by the assigned nurse. Program staff can review but not edit.</p>
              <div
                style={{
                  background: '#F1F5F9',
                  border: '1px solid #E2E8F0',
                  borderRadius: 10,
                  padding: 10,
                  cursor: 'not-allowed',
                }}
              >
                <MedicationTableField
                  value={reportDetails.currentMedications}
                  onChange={() => {}}
                  readOnly
                  emptyText="Not recorded by nurse yet."
                />
              </div>
            </div>

            {/* BMI / Weight / Vital Signs */}
            <div className="form-section form-section--readonly">
              <div className="section-title" style={{ marginBottom: 8 }}>BMI / Weight / Vital Signs</div>
              <p className="wr-nurse-only-note" style={{ marginBottom: 16 }}>
                Filled by the assigned nurse. Program staff can review but not edit.
              </p>
              <div className="form-grid-2" style={{ rowGap: '32px' }}>
                <div className="form-field">
                  <label className="form-label">Weight (kg):</label>
                  <input
                    type="text"
                    className="form-underline-input form-underline-input--readonly"
                    value={vitals.weight}
                    readOnly
                    aria-readonly="true"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Height (cm):</label>
                  <input
                    type="text"
                    className="form-underline-input form-underline-input--readonly"
                    value={vitals.height}
                    readOnly
                    aria-readonly="true"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">BMI:</label>
                  <input
                    type="text"
                    className="form-underline-input form-underline-input--readonly"
                    value={vitals.bmi}
                    readOnly
                    aria-readonly="true"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Blood Pressure:</label>
                  <input
                    type="text"
                    className="form-underline-input form-underline-input--readonly"
                    value={vitals.bp}
                    readOnly
                    aria-readonly="true"
                    placeholder="120/80"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">PR:</label>
                  <input
                    type="text"
                    className="form-underline-input form-underline-input--readonly"
                    value={vitals.pr}
                    readOnly
                    aria-readonly="true"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">RR:</label>
                  <input
                    type="text"
                    className="form-underline-input form-underline-input--readonly"
                    value={vitals.rr}
                    readOnly
                    aria-readonly="true"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">SPO2:</label>
                  <input
                    type="text"
                    className="form-underline-input form-underline-input--readonly"
                    value={vitals.spo2}
                    readOnly
                    aria-readonly="true"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Temperature (°F):</label>
                  <input
                    type="text"
                    className="form-underline-input form-underline-input--readonly"
                    value={vitals.temperature}
                    readOnly
                    aria-readonly="true"
                  />
                </div>
              </div>
            </div>

            {/* Intervention (Medication Management) */}
            <div className="form-section">
              <div className="section-title">Intervention (Medication Management)</div>
              <textarea
                className="form-textarea"
                placeholder="Describe any medication changes, adjustments, or interventions made this week..."
                value={reportDetails.interventionMedication}
                onChange={(e) => setReportDetails((prev) => ({ ...prev, interventionMedication: e.target.value }))}
              />
            </div>

            {/* Diet Restrictions */}
            <div className="form-section form-section--readonly">
              <div className="section-title">Diet Restrictions</div>
              <p className="wr-nurse-only-note">Filled by the assigned nurse. Program staff can review but not edit.</p>
              <div className="section-fields">
                <div>
                  <label className="form-label" style={{ marginBottom: 8 }}>Dietary Restrictions:</label>
                  <BulletedListFieldInput
                    value={reportDetails.dietaryRestrictions}
                    onChange={() => {}}
                    placeholder="e.g. Low sodium diet, no raw foods..."
                    inputClassName="form-underline-input"
                    addLabel="Add restriction"
                    readOnly
                    emptyText="Not recorded by nurse yet."
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Food Allergies:</label>
                  <input
                    type="text"
                    className="form-underline-input form-underline-input--readonly"
                    placeholder="List any known food allergies"
                    value={reportDetails.foodAllergies}
                    readOnly
                    aria-readonly="true"
                  />
                </div>
              </div>
            </div>

            {/* Intervention (Nutrition) */}
            <div className="form-section">
              <div className="section-title">Intervention (Nutrition)</div>
              <textarea
                className="form-textarea"
                placeholder="Document any nutritional interventions, meal plan adjustments, or consultations with dietitian..."
                value={reportDetails.interventionNutrition}
                onChange={(e) => setReportDetails((prev) => ({ ...prev, interventionNutrition: e.target.value }))}
              />
            </div>

            {/* Ongoing Medical Concern */}
            <div className="form-section form-section--readonly">
              <div className="section-title">Ongoing Medical Concern</div>
              <p className="wr-nurse-only-note">Filled by the assigned nurse. Program staff can review but not edit.</p>
              <BulletedListFieldInput
                value={reportDetails.ongoingMedicalConcern}
                onChange={() => {}}
                placeholder="e.g. Chronic back injury, hypertension monitoring..."
                inputClassName="form-textarea"
                multiline
                addLabel="Add concern"
                readOnly
                emptyText="Not recorded by nurse yet."
              />
            </div>

            {/* Compiled Daily Reports — verbatim preview of what "Conclude Weekly Report" snapshots. */}
            <div className="form-section">
              <div className="section-title">Compiled Daily Reports{reportBasics.weekLabel ? ` — ${reportBasics.weekLabel}` : ''}</div>
              <div style={{ marginBottom: 12 }}>
                {currentWeekConcludedAt ? (
                  <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 800, color: '#15803D', background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: 999, padding: '3px 10px' }}>
                    Concluded {new Date(currentWeekConcludedAt).toLocaleDateString('en-US')} · visible to family
                  </span>
                ) : (
                  <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 800, color: '#92400E', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 999, padding: '3px 10px' }}>
                    Draft · not yet visible to family
                  </span>
                )}
              </div>
              <p className="wr-nurse-only-note">
                Compiled verbatim into the Weekly Report when you conclude the week. You do not need all 7 days.
              </p>
              {weekDailyReportsLoading ? (
                <p className="wr-daily-entries-empty">Loading this week&rsquo;s daily reports…</p>
              ) : weekDailyReportsError ? (
                <p className="wr-save-feedback wr-save-feedback--error">{weekDailyReportsError}</p>
              ) : (
                <CompiledDailyReportsList
                  entries={weekDailyReports.map((r) => ({
                    report_date: r.report_date,
                    author_role: r.author_role,
                    observations: r.observations,
                    assessment: r.assessment,
                    follow_up: r.follow_up,
                    notes: r.notes,
                  }))}
                  emptyText="No daily reports logged for this week yet — add them on the Daily Reports tab."
                />
              )}
            </div>

            {/* Upcoming Medical Procedure */}
            <div className="form-section">
              <div className="section-title">Upcoming Medical Procedure</div>
              <div className="section-fields">
                <div>
                  <label className="form-label" style={{ marginBottom: 8 }}>Procedure Description:</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Describe any scheduled medical procedures, tests, or appointments..."
                    value={reportDetails.upcomingProcedureDescription}
                    onChange={(e) => setReportDetails((prev) => ({ ...prev, upcomingProcedureDescription: e.target.value }))}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Scheduled Date:</label>
                  <input
                    type="text"
                    className="form-underline-input"
                    value={reportDetails.upcomingProcedureDate}
                    onChange={(e) => setReportDetails((prev) => ({ ...prev, upcomingProcedureDate: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Signatures */}
            <div className="form-grid-2" style={{ marginBottom: 0 }}>
              <div className="form-field">
                <label className="form-label">Staff name:</label>
                <input
                  type="text"
                  className="form-underline-input"
                  value={staffSignatureName}
                  onChange={(e) => setStaffSignatureName(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Date:</label>
                <input
                  type="text"
                  className="form-underline-input"
                  value={staffSignatureDate}
                  onChange={(e) => setStaffSignatureDate(e.target.value)}
                />
              </div>
            </div>

            {/* Submit */}
            <div className="submit-row">
              {submitError ? (
                <div
                  style={{
                    marginRight: 12,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid #FECACA',
                    background: '#FEF2F2',
                    color: '#991B1B',
                    fontSize: 12,
                    fontWeight: 700,
                    maxWidth: 420,
                  }}
                >
                  {submitError}
                </div>
              ) : null}
              {showConfirm ? (
                <div className="confirm-bar">
                  <span className="confirm-text">Save this week&rsquo;s report as a draft?</span>
                  <button type="button" className="confirm-btn-cancel" onClick={() => setShowConfirm(false)}>Cancel</button>
                  <button type="button" className="confirm-btn-ok" onClick={() => persistWeeklyReport()}>Save draft</button>
                </div>
              ) : concludeConfirm ? (
                <div className="confirm-bar">
                  <span className="confirm-text">
                    Conclude {reportBasics.weekLabel || 'this week'}? It becomes visible to the family. You can still edit it later.
                  </span>
                  <button type="button" className="confirm-btn-cancel" onClick={() => setConcludeConfirm(false)} disabled={concluding}>Cancel</button>
                  <button type="button" className="confirm-btn-ok" onClick={handleConcludeWeek} disabled={concluding}>
                    {concluding ? 'Concluding…' : 'Conclude Weekly Report'}
                  </button>
                </div>
              ) : (
                <>
                  <button type="submit" className="btn-inline-action" style={{ padding: '14px 28px', fontSize: 13 }}>Save draft</button>
                  <button
                    type="button"
                    className="btn-submit"
                    disabled={!activeReportPatientId}
                    onClick={() => { setSubmitError(''); setConcludeConfirm(true); }}
                  >
                    {currentWeekConcludedAt ? 'Re-conclude Weekly Report' : 'Conclude Weekly Report'}
                  </button>
                </>
              )}
            </div>

          </form>
          </>
          )}
        </div>
      </main>

      <ProgramMobileBottomNav navigate={navigate} active="weekly" />


    </div>
  );
};

export default ProgramWeeklyReport;