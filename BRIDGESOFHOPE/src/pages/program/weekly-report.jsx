import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LogOut, FileText, ChevronDown, Users, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logo from '@/assets/kalingalogo.png';
import { appendActivityFeed } from '@/lib/activityFeed';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { APP_DATA_REFRESH } from '@/lib/appDataRefresh';

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

const patientInitials = (name) => {
  if (!name || !String(name).trim()) return '?';
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
};

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
  const hydrateSeqRef = useRef(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [reportBasics, setReportBasics] = useState(INITIAL_BASICS);
  const [admittedPatients, setAdmittedPatients] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expandedPatientId, setExpandedPatientId] = useState(null);
  const [activeReportPatientId, setActiveReportPatientId] = useState(null);
  const [vitals, setVitals] = useState(INITIAL_VITALS);
  const [reportDetails, setReportDetails] = useState(INITIAL_REPORT_DETAILS);
  const [submitError, setSubmitError] = useState('');
  const [staffIdentityNames, setStaffIdentityNames] = useState([]);
  const [staffSignatureName, setStaffSignatureName] = useState('');
  const [staffSignatureDate, setStaffSignatureDate] = useState(() => new Date().toLocaleDateString('en-US'));
  const pickerRef = useRef(null);

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

  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [pickerOpen]);

  const togglePatientWeeks = (id, e) => {
    e.stopPropagation();
    setExpandedPatientId((prev) => (prev === id ? null : id));
  };

  const applyPatientAndWeek = (patient, weekNum) => {
    const seq = ++hydrateSeqRef.current;
    setSubmitError('');
    setActiveReportPatientId(patient.id);
    setReportBasics((prev) => ({
      ...prev,
      weekLabel: `Week ${weekNum}`,
      admissionDate: patient.date || '',
      patientName: patient.name || '',
      age: patient.age || prev.age || '',
      primaryConcern: patient.reason || patient.primaryConcern || '',
    }));
    const baseVitals = deriveVitalsFromPatient(patient.raw || {});
    setVitals(baseVitals);
    setStaffSignatureDate(new Date().toLocaleDateString('en-US'));
    const defaultDetails = {
      ...INITIAL_REPORT_DETAILS,
      upcomingProcedureDate: new Date().toLocaleDateString('en-US'),
    };
    setReportDetails(defaultDetails);
    setPickerOpen(false);
    setExpandedPatientId(null);

    void (async () => {
      const partial = await loadExistingWeeklyReportPartial(String(patient.id), weekNum);
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
  };

  const handleVitalsFieldChange = (field, value) => {
    setVitals((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'weight' || field === 'height') {
        next.bmi = computeBmiFromWeightHeight(next.weight, next.height);
      }
      return next;
    });
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

  const persistWeeklyReport = useCallback(async () => {
    const weekMatch = String(reportBasics.weekLabel || '').match(/(\d+)/);
    const weekNum = weekMatch ? weekMatch[1] : null;

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
      setSubmitError('Select resident and week first before submitting.');
      return;
    }

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
      reportDetails.currentMedications && `Current medications: ${reportDetails.currentMedications}`,
      reportDetails.interventionMedication && `Medication intervention: ${reportDetails.interventionMedication}`,
      reportDetails.ongoingMedicalConcern && `Ongoing medical concern: ${reportDetails.ongoingMedicalConcern}`,
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
      reportDetails.dietaryRestrictions && `Dietary restrictions: ${reportDetails.dietaryRestrictions}`,
      reportDetails.foodAllergies && `Food allergies: ${reportDetails.foodAllergies}`,
      reportDetails.ongoingMedicalConcern && `Clinical notes: ${reportDetails.ongoingMedicalConcern}`,
    ]
      .filter(Boolean)
      .join('\n');
    const localEntry = {
      submittedAt,
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
          `Weekly care report filed for ${pname} (${reportBasics.weekLabel || `week ${weekNum}`}).`
        );
      } catch {
        /* ignore */
      }
      setShowConfirm(false);
      navigate('/program');
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
    let { error } = await supabase.from('weekly_reports').upsert(enrichedPayload, { onConflict: 'patient_id,week_number' });
    if (error && /column .* does not exist/i.test(String(error.message || ''))) {
      ({ error } = await supabase.from('weekly_reports').upsert(basePayload, { onConflict: 'patient_id,week_number' }));
    }

    if (error) {
      console.warn('[weekly_reports upsert]', error.message);
      setSubmitError(`Failed to save weekly report: ${error.message}`);
      setShowConfirm(false);
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
        `Weekly care report filed for ${pname} (${reportBasics.weekLabel || `week ${weekNum}`}).`,
        { familyId: patientRow?.family_id ?? null }
      );
    }

    setSubmitError('');
    setShowConfirm(false);
    navigate('/program');
  }, [activeReportPatientId, admittedPatients, reportBasics.patientName, reportBasics.weekLabel, navigate, reportDetails, vitals, staffSignatureName, staffSignatureDate]);

  return (
    <div className="wr-container">
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

        /* ---- SIDEBAR (exact home.jsx) ---- */
        .desktop-sidebar {
          width: ${isExpanded ? '280px' : '110px'};
          background: white;
          border-right: 1px solid #F1F1F1;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          padding: 25px 0 0;
          z-index: 100;
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          position: fixed;
          top: 0;
          left: 0;
          height: 100vh;
          overflow: hidden;
          box-sizing: border-box;
        }

        .sidebar-logo-container {
          display: flex;
          justify-content: center;
          width: 100%;
          margin-bottom: 28px;
          align-self: center;
        }

        .wr-sidebar-nav {
          width: 100%;
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          display: flex;
          flex-direction: column;
        }
        .wr-sidebar-footer {
          flex-shrink: 0;
          width: 100%;
          padding: 16px 0 20px;
          margin-top: auto;
          border-top: 1px solid #f1f5f9;
        }

        .sidebar-logo {
          width: ${isExpanded ? '120px' : '70px'};
          transition: width 0.3s ease;
        }

        .sidebar-nav-item {
          display: flex;
          align-items: center;
          width: 100%;
          padding: 0 ${isExpanded ? '28px' : '0'};
          justify-content: ${isExpanded ? 'flex-start' : 'center'};
          gap: 14px;
          margin-bottom: 6px;
          min-height: 48px;
          box-sizing: border-box;
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
          margin-left: ${isExpanded ? '280px' : '110px'};
          transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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

        /* ---- SECTION ---- */
        .form-section {
          margin-bottom: 18px;
          padding: 18px 18px 16px;
          border: 1px solid #E9EDF7;
          border-radius: 16px;
          background: linear-gradient(180deg, #FFFFFF 0%, #FBFCFF 100%);
          box-shadow: 0 6px 18px rgba(15,23,42,0.03);
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
          background: linear-gradient(135deg,#F54E25,#D946EF);
          color: white;
          border: none;
          padding: 14px 48px;
          border-radius: 18px;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 10px 24px rgba(217, 70, 239, 0.26);
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
          background: linear-gradient(135deg,#F54E25,#D946EF);
          border: none;
          border-radius: 10px;
          padding: 10px 20px;
          font-size: 13px;
          font-weight: 700;
          color: white;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          transition: background 0.15s;
        }

        .confirm-btn-ok:hover { filter: brightness(1.02); }

        .wr-header-btn { margin-right: 40px; }

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

      {/* DESKTOP SIDEBAR */}
      <aside className="desktop-sidebar" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="sidebar-logo-container">
          <img src={logo} alt="Kalinga" className="sidebar-logo" />
        </div>

        <div className="wr-sidebar-nav">
        <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/program'); }}>
          <Users size={22} color="#707EAE" />
          <span className="sidebar-label">Assigned residents</span>
        </div>
        <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/program-calendar'); }}>
          <Calendar size={22} color="#707EAE" />
          <span className="sidebar-label">Calendar</span>
        </div>
        <div className="sidebar-nav-item" onClick={(e) => e.stopPropagation()}>
          <div style={{ background: '#F54E25', color: 'white', padding: 12, borderRadius: 12, display: 'flex' }}>
            <FileText size={22} />
          </div>
          <span className="sidebar-label" style={{ color: '#F54E25' }}>Weekly Report</span>
        </div>
        </div>

        <div className="wr-sidebar-footer">
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/login'); }}>
            <LogOut size={22} color="#F54E25" style={{ cursor: 'pointer' }} />
            <span className="sidebar-label" style={{ color: '#F54E25' }}>Logout</span>
          </div>
        </div>
      </aside>

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
            <h1>Weekly Report</h1>
            <p>Write your Weekly Reports</p>
          </div>
          <div ref={pickerRef} className="wr-picker-wrap">
            <button
              type="button"
              className="wr-header-btn"
              onClick={(e) => {
                e.stopPropagation();
                setPickerOpen((v) => !v);
              }}
            >
              <FileText size={18} color="#FFFFFF" />
              Select resident and week
              <ChevronDown size={16} style={{ transform: pickerOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }} />
            </button>
            <button
              type="button"
              className="wr-patient-picker-btn mobile-only"
              onClick={(e) => {
                e.stopPropagation();
                setPickerOpen((v) => !v);
              }}
            >
              <FileText size={18} color="#F54E25" />
              Select patient and week
              <ChevronDown size={16} style={{ transform: pickerOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }} />
            </button>
            {pickerOpen && (
              <div className="wr-patient-picker" role="listbox" aria-label="Admitted patients">
                <div className="wr-patient-picker-title">Admitted patients</div>
                {admittedPatients.length === 0 ? (
                  <div className="wr-picker-empty">
                    No admitted patients yet. After the admin approves an admission, the patient will appear here.
                  </div>
                ) : (
                  admittedPatients.map((p) => (
                    <div key={p.id} className="wr-patient-block">
                      <button
                        type="button"
                        className="wr-patient-row-header"
                        onClick={(e) => togglePatientWeeks(p.id, e)}
                        aria-expanded={expandedPatientId === p.id}
                      >
                        <div className="wr-patient-avatar">{patientInitials(p.name)}</div>
                        <div className="wr-patient-info-text">
                          <div className="wr-patient-name">{p.name || 'Resident'}</div>
                          <div className="wr-patient-meta">
                            Admitted {p.date || '—'}
                            {p.reason ? ` · ${p.reason}` : ''}
                            {p.progress != null && p.progress !== '' ? ` · Progress ${p.progress}%` : ''}
                          </div>
                        </div>
                        <ChevronDown size={18} className={`wr-patient-chevron${expandedPatientId === p.id ? ' open' : ''}`} />
                      </button>
                      {expandedPatientId === p.id && (
                        <div className="wr-weeks-panel">
                          <div className="wr-weeks-label">
                            Weekly reports — tap a week to load the form. If your nurse filed a medical report for that week, the form prefills with their data so you can review or add to it.
                          </div>
                          <div className="wr-weeks-grid">
                            {[1, 2, 3, 4, 5, 6, 7].map((w) => (
                              <button
                                key={w}
                                type="button"
                                className="wr-week-chip"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  applyPatientAndWeek(p, w);
                                }}
                              >
                                Week {w}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Paper */}
        <div className="wr-paper">
          <div className="wr-paper-title">Weekly Report</div>

          <form onSubmit={(e) => { e.preventDefault(); setShowConfirm(true); }}>

            {/* Week & Admission Date */}
            <div className="form-grid-2">
              <div className="form-field">
                <label className="form-label">Week:</label>
                <input
                  type="text"
                  className="form-underline-input"
                  placeholder="Use Weekly Report above"
                  value={reportBasics.weekLabel}
                  onChange={(e) => setReportBasics((prev) => ({ ...prev, weekLabel: e.target.value }))}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Admission Date:</label>
                <input
                  type="text"
                  className="form-underline-input"
                  value={reportBasics.admissionDate}
                  onChange={(e) => setReportBasics((prev) => ({ ...prev, admissionDate: e.target.value }))}
                />
              </div>
            </div>

            {/* Resident Information */}
            <div className="form-section">
              <div className="section-title">Resident Information</div>
              <div className="section-fields">
                <div className="form-field">
                  <label className="form-label">Resident Name:</label>
                  <input
                    type="text"
                    className="form-underline-input"
                    value={reportBasics.patientName}
                    onChange={(e) => setReportBasics((prev) => ({ ...prev, patientName: e.target.value }))}
                  />
                </div>
                <div className="form-grid-2">
                  <div className="form-field">
                    <label className="form-label">Age:</label>
                    <input
                      type="text"
                      className="form-underline-input"
                      value={reportBasics.age}
                      onChange={(e) => setReportBasics((prev) => ({ ...prev, age: e.target.value }))}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Primary Concern:</label>
                    <input
                      type="text"
                      className="form-underline-input"
                      value={reportBasics.primaryConcern}
                      onChange={(e) => setReportBasics((prev) => ({ ...prev, primaryConcern: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Current Medications */}
            <div className="form-section">
              <div className="section-title">Current Medications</div>
              <textarea
                className="form-textarea"
                placeholder="List all current medications with dosages and frequency..."
                value={reportDetails.currentMedications}
                onChange={(e) => setReportDetails((prev) => ({ ...prev, currentMedications: e.target.value }))}
              />
            </div>

            {/* BMI / Weight / Vital Signs */}
            <div className="form-section" style={{ background: 'linear-gradient(180deg, #F8FAFF 0%, #F4F7FF 100%)' }}>
              <div className="section-title" style={{ marginBottom: 8 }}>BMI / Weight / Vital Signs</div>
              <p style={{ marginBottom: 16, color: '#64748B', fontSize: 12, lineHeight: 1.4 }}>
                Auto-filled from the selected resident profile and latest encoded values.
              </p>
              <div className="form-grid-2" style={{ rowGap: '32px' }}>
                <div className="form-field">
                  <label className="form-label">Weight (kg):</label>
                  <input
                    type="text"
                    className="form-underline-input"
                    value={vitals.weight}
                    onChange={(e) => handleVitalsFieldChange('weight', e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Height (cm):</label>
                  <input
                    type="text"
                    className="form-underline-input"
                    value={vitals.height}
                    onChange={(e) => handleVitalsFieldChange('height', e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">BMI:</label>
                  <input
                    type="text"
                    className="form-underline-input"
                    value={vitals.bmi}
                    onChange={(e) => setVitals((prev) => ({ ...prev, bmi: e.target.value }))}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Blood Pressure:</label>
                  <input
                    type="text"
                    className="form-underline-input"
                    value={vitals.bp}
                    onChange={(e) => setVitals((prev) => ({ ...prev, bp: e.target.value }))}
                    placeholder="120/80"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">PR:</label>
                  <input
                    type="text"
                    className="form-underline-input"
                    value={vitals.pr}
                    onChange={(e) => setVitals((prev) => ({ ...prev, pr: e.target.value }))}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">RR:</label>
                  <input
                    type="text"
                    className="form-underline-input"
                    value={vitals.rr}
                    onChange={(e) => setVitals((prev) => ({ ...prev, rr: e.target.value }))}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">SPO2:</label>
                  <input
                    type="text"
                    className="form-underline-input"
                    value={vitals.spo2}
                    onChange={(e) => setVitals((prev) => ({ ...prev, spo2: e.target.value }))}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Temperature (°F):</label>
                  <input
                    type="text"
                    className="form-underline-input"
                    value={vitals.temperature}
                    onChange={(e) => setVitals((prev) => ({ ...prev, temperature: e.target.value }))}
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
            <div className="form-section">
              <div className="section-title">Diet Restrictions</div>
              <div className="section-fields">
                <div>
                  <label className="form-label" style={{ marginBottom: 8 }}>Dietary Restrictions:</label>
                  <textarea
                    className="form-textarea"
                    placeholder="List any dietary restrictions, special diets, or nutritional requirements..."
                    value={reportDetails.dietaryRestrictions}
                    onChange={(e) => setReportDetails((prev) => ({ ...prev, dietaryRestrictions: e.target.value }))}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Food Allergies:</label>
                  <input
                    type="text"
                    className="form-underline-input"
                    placeholder="List any known food allergies"
                    value={reportDetails.foodAllergies}
                    onChange={(e) => setReportDetails((prev) => ({ ...prev, foodAllergies: e.target.value }))}
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
            <div className="form-section">
              <div className="section-title">Ongoing Medical Concern</div>
              <textarea
                className="form-textarea"
                placeholder="Detail any ongoing medical issues, chronic conditions, or health concerns requiring continuous monitoring..."
                value={reportDetails.ongoingMedicalConcern}
                onChange={(e) => setReportDetails((prev) => ({ ...prev, ongoingMedicalConcern: e.target.value }))}
              />
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
                  <span className="confirm-text">Ready to submit the Report?</span>
                  <button type="button" className="confirm-btn-cancel" onClick={() => setShowConfirm(false)}>Cancel</button>
                  <button type="button" className="confirm-btn-ok" onClick={persistWeeklyReport}>Confirm</button>
                </div>
              ) : (
                <button type="submit" className="btn-submit">Submit Report</button>
              )}
            </div>

          </form>
        </div>
      </main>

      {/* MOBILE BOTTOM NAV */}
      <div className="mobile-only mobile-bottom-nav">
        <div className="mob-nav-item" onClick={() => navigate('/program')}>
          <div style={{ background: '#F4F7FE', padding: 10, borderRadius: 10, display: 'flex' }}>
            <Users size={20} color="#707EAE" />
          </div>
          <span>Assigned</span>
        </div>
        <div className="mob-nav-item" onClick={() => navigate('/program-calendar')}>
          <div style={{ background: '#F4F7FE', padding: 10, borderRadius: 10, display: 'flex' }}>
            <Calendar size={20} color="#707EAE" />
          </div>
          <span>Calendar</span>
        </div>
        <div className="mob-nav-item active">
          <div style={{ background: '#F54E25', color: 'white', padding: 10, borderRadius: 10, display: 'flex' }}>
            <FileText size={20} />
          </div>
          <span>Weekly</span>
        </div>
        <div className="mob-nav-item" onClick={() => navigate('/login')}>
          <LogOut size={22} color="#F54E25" />
          <span style={{ color: '#F54E25' }}>Logout</span>
        </div>
      </div>

    </div>
  );
};

export default ProgramWeeklyReport;