import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { LogOut, FileText, ChevronDown, Users, Calendar, LayoutGrid, User, X, Copy, ClipboardCheck } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '@/assets/kalingalogo.png';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { familySidebarStyle } from '@/lib/familySidebarStyle';
import BulletedListFieldInput from '@/components/clinical/BulletedListFieldInput';
import MedicationTableField from '@/components/clinical/MedicationTableField';
import { appendActivityFeed } from '@/lib/activityFeed';
import { formatBulletedListNoteSection, bulletedListHasContent } from '@/lib/bulletedListField';
import { formatMedicationTableNoteSection, medicationTableHasContent } from '@/lib/medicationTableField';
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
  dietaryRestrictions: '',
  foodAllergies: '',
  ongoingMedicalConcern: '',
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

const RequiredMark = () => (
  <span className="wr-required-mark" aria-hidden="true">
    *
  </span>
);

const FormLabel = ({ children, required = false, className = '', style }) => (
  <label className={`form-label ${className}`.trim()} style={style}>
    {children}
    {required ? <RequiredMark /> : null}
  </label>
);

const SectionTitle = ({ children, required = false }) => (
  <div className="section-title">
    {children}
    {required ? <RequiredMark /> : null}
  </div>
);

/** Nurse medical report filing — same workflow as weekly reports; assigned residents match `program_staff` (nurse). */
const NurseMedicalReportPage = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
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
  const [nurseIdentityNames, setNurseIdentityNames] = useState([]);
  const [nurseSignatureName, setNurseSignatureName] = useState('');
  const [nurseSignatureDate, setNurseSignatureDate] = useState(() => new Date().toLocaleDateString('en-US'));
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [summaryCopied, setSummaryCopied] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    const loadIdentity = async () => {
      if (!isSupabaseConfigured()) {
        setNurseIdentityNames([]);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setNurseIdentityNames([]);
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
      setNurseIdentityNames(names);
      const displayName =
        String(profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || emailLocal || '').trim();
      if (displayName) setNurseSignatureName(displayName);
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
            if (nurseIdentityNames.length === 0) return false;
            const ns = String(r.program_staff ?? r.programStaff ?? '').trim().toLowerCase();
            return nurseIdentityNames.includes(ns);
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
        console.warn('[nurse-medical-report patients]', error.message);
        setAdmittedPatients([]);
        return;
      }
      const scopedRows = (data || []).filter((r) => {
        if (nurseIdentityNames.length === 0) return false;
        return nurseIdentityNames.includes(String(r.program_staff || '').trim().toLowerCase());
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
  }, [nurseIdentityNames]);

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
    setVitals(deriveVitalsFromPatient(patient.raw || {}));
    setNurseSignatureDate(new Date().toLocaleDateString('en-US'));
    setPickerOpen(false);
    setExpandedPatientId(null);
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

    const nurseNameSigned = nurseSignatureName.trim();
    const reportDateField = nurseSignatureDate.trim();
    const pname = (reportBasics.patientName || 'Resident').trim();
    const submittedAt = new Date().toISOString();
    const progressFromPatient = (() => {
      const p = admittedPatients.find((x) => String(x.id) === String(patientId));
      const raw = Number(p?.raw?.progress_percent ?? p?.raw?.progress);
      return Number.isFinite(raw) ? raw : null;
    })();
    const summaryText = [
      formatMedicationTableNoteSection('Current medications', reportDetails.currentMedications),
      formatBulletedListNoteSection('Ongoing medical concern', reportDetails.ongoingMedicalConcern),
    ]
      .filter(Boolean)
      .join('\n');
    const recommendationText = '';
    const noteText = [
      formatBulletedListNoteSection('Dietary restrictions', reportDetails.dietaryRestrictions),
      reportDetails.foodAllergies && `Food allergies: ${reportDetails.foodAllergies}`,
      formatBulletedListNoteSection('Clinical notes', reportDetails.ongoingMedicalConcern),
    ]
      .filter(Boolean)
      .join('\n');
    const localEntry = {
      submittedAt,
      patientName: reportBasics.patientName,
      nurseName: nurseNameSigned,
      reportDate: reportDateField,
      summary: summaryText,
      nurseNote: noteText,
      currentMedications: reportDetails.currentMedications || '',
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
          `Medical report filed for ${pname} (${reportBasics.weekLabel || `week ${weekNum}`}).`
        );
      } catch {
        /* ignore */
      }
      setShowConfirm(false);
      navigate('/patient-database');
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: patientRow } = await supabase.from('patients').select('family_id').eq('id', patientId).maybeSingle();

    const basePayload = {
      patient_id: patientId,
      week_number: parseInt(weekNum, 10),
      nurse_name: nurseNameSigned || null,
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
      medication_intervention: null,
      dietary_restrictions: reportDetails.dietaryRestrictions || null,
      food_allergies: reportDetails.foodAllergies || null,
      nutrition_intervention: null,
      ongoing_medical_concern: reportDetails.ongoingMedicalConcern || null,
      upcoming_procedure_description: null,
      upcoming_procedure_date: null,
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
      setSubmitError(`Failed to save medical report: ${error.message}`);
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
        medical_staff_note: nurseNameSigned || null,
      };
      // Keep patient master vitals in sync with the latest nurse weekly filing.
      const { error: patientVitalsError } = await supabase
        .from('patients')
        .update(patientVitalsPayload)
        .eq('id', patientId);
      if (patientVitalsError) {
        console.warn('[patients vitals update]', patientVitalsError.message);
        // Non-blocking: weekly report was saved already; keep flow moving.
        setSubmitError(`Medical report saved, but patient vitals update failed: ${patientVitalsError.message}`);
      }
      mirrorPatientVitalsToLocal(patientId, vitals);
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event(APP_DATA_REFRESH));
      await appendActivityFeed(
        `Medical report filed for ${pname} (${reportBasics.weekLabel || `week ${weekNum}`}).`,
        { familyId: patientRow?.family_id ?? null }
      );
    }

    setSubmitError('');
    setShowConfirm(false);
    navigate('/patient-database');
  }, [activeReportPatientId, admittedPatients, reportBasics.patientName, reportBasics.weekLabel, navigate, reportDetails, vitals, nurseSignatureName, nurseSignatureDate]);

  const isReportComplete = useMemo(() => Boolean(
    reportBasics.weekLabel.trim() &&
    reportBasics.patientName.trim() &&
    medicationTableHasContent(reportDetails.currentMedications) &&
    vitals.weight.trim() &&
    vitals.bp.trim() &&
    vitals.pr.trim() &&
    vitals.rr.trim() &&
    vitals.spo2.trim() &&
    vitals.temperature.trim() &&
    bulletedListHasContent(reportDetails.ongoingMedicalConcern) &&
    nurseSignatureName.trim() &&
    nurseSignatureDate.trim()
  ), [
    reportBasics.weekLabel,
    reportBasics.patientName,
    reportDetails.currentMedications,
    reportDetails.ongoingMedicalConcern,
    vitals.weight,
    vitals.bp,
    vitals.pr,
    vitals.rr,
    vitals.spo2,
    vitals.temperature,
    nurseSignatureName,
    nurseSignatureDate,
  ]);

  const buildReportSummary = useCallback(() => {
    const lines = [];
    lines.push(`Medical Report Summary — ${reportBasics.weekLabel || 'Week not set'}`);
    lines.push(`Resident: ${reportBasics.patientName || '—'}${reportBasics.age ? `, Age ${reportBasics.age}` : ''}`);
    if (reportBasics.admissionDate.trim()) lines.push(`Admission Date: ${reportBasics.admissionDate.trim()}`);
    if (reportBasics.primaryConcern.trim()) lines.push(`Primary Concern: ${reportBasics.primaryConcern.trim()}`);

    const vitalsParts = [
      vitals.weight.trim() && `Weight ${vitals.weight.trim()} kg`,
      vitals.height.trim() && `Height ${vitals.height.trim()} cm`,
      vitals.bmi.trim() && `BMI ${vitals.bmi.trim()}`,
      vitals.bp.trim() && `BP ${vitals.bp.trim()}`,
      vitals.pr.trim() && `PR ${vitals.pr.trim()}`,
      vitals.rr.trim() && `RR ${vitals.rr.trim()}`,
      vitals.spo2.trim() && `SPO2 ${vitals.spo2.trim()}`,
      vitals.temperature.trim() && `Temperature ${vitals.temperature.trim()}°F`,
    ].filter(Boolean);
    if (vitalsParts.length) lines.push('', 'Vitals:', vitalsParts.join(' | '));

    const medsBlock = formatMedicationTableNoteSection('Current Medications', reportDetails.currentMedications);
    if (medsBlock) lines.push('', medsBlock);

    const dietBlock = formatBulletedListNoteSection('Dietary Restrictions', reportDetails.dietaryRestrictions);
    if (dietBlock) lines.push('', dietBlock);

    if (reportDetails.foodAllergies.trim()) lines.push('', `Food Allergies:\n${reportDetails.foodAllergies.trim()}`);

    const concernBlock = formatBulletedListNoteSection('Ongoing Medical Concern', reportDetails.ongoingMedicalConcern);
    if (concernBlock) lines.push('', concernBlock);

    lines.push('', `Reported by: ${nurseSignatureName || '—'} on ${nurseSignatureDate || '—'}`);

    return lines.join('\n');
  }, [reportBasics, vitals, reportDetails, nurseSignatureName, nurseSignatureDate]);

  const handleCreateSummary = useCallback(() => {
    setSummaryText(buildReportSummary());
    setSummaryCopied(false);
    setShowSummaryModal(true);
  }, [buildReportSummary]);

  const handleCopySummary = useCallback(async () => {
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summaryText);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      const textarea = document.createElement('textarea');
      textarea.value = summaryText;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        copied = document.execCommand('copy');
      } catch {
        copied = false;
      }
      document.body.removeChild(textarea);
    }

    setSummaryCopied(copied);
    if (!copied) {
      window.alert('Could not copy automatically — please select and copy the text manually.');
    }
  }, [summaryText]);

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

        /* ---- MAIN ---- */
        .wr-main {
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

        .wr-required-mark {
          color: #F54E25;
          margin-left: 2px;
        }

        .wr-required-note {
          font-size: 12px;
          color: #64748B;
          margin: -12px 0 20px;
          font-weight: 500;
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

        /* Whole-card faded treatment for sections pulled from the resident record — not just the
           individual inputs inside them, the entire card reads as locked/unavailable, the way a
           disabled panel does elsewhere in the app. */
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
          align-items: center;
          gap: 14px;
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

        .btn-summary {
          background: white;
          color: #1B2559;
          border: 1.5px solid #E9EDF7;
          padding: 13px 30px;
          border-radius: 18px;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: 'Inter', sans-serif;
        }

        .btn-summary:hover:not(:disabled) { background: #F4F7FE; transform: translateY(-1px); }
        .btn-summary:active:not(:disabled) { transform: scale(0.98); }
        .btn-summary:disabled { opacity: 0.45; cursor: not-allowed; }

        /* ---- SUMMARY MODAL ---- */
        .mr-summary-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1100;
          padding: 20px;
        }

        .mr-summary-modal {
          width: min(92vw, 640px);
          max-height: 85vh;
          overflow-y: auto;
          background: white;
          border: 1px solid #E9EDF7;
          border-radius: 20px;
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
        }

        .mr-summary-head {
          position: sticky;
          top: 0;
          background: white;
          padding: 18px 20px;
          border-bottom: 1px solid #EEF2FF;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .mr-summary-title { font-size: 16px; font-weight: 800; color: #1B2559; }

        .mr-summary-close {
          background: none;
          border: none;
          cursor: pointer;
          color: #707EAE;
          display: flex;
          padding: 4px;
          border-radius: 8px;
        }
        .mr-summary-close:hover { background: #F4F7FE; }

        .mr-summary-body {
          padding: 20px;
          white-space: pre-wrap;
          font-size: 13.5px;
          line-height: 1.6;
          color: #2B3674;
          font-family: 'Inter', sans-serif;
        }

        .mr-summary-foot {
          padding: 14px 20px 20px;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

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

      <AdminSidebar
        isExpanded={isExpanded}
        onToggleExpanded={() => setIsExpanded(!isExpanded)}
        dashboardPath="/nurse-dashboard"
        brandTagline="Nurse Portal"
        profilePath="/nurseprofile"
        profileLabel="Profile"
      >
        <div
          className={`sidebar-nav-item${pathname === '/nurse-dashboard' ? ' sidebar-nav-active' : ''}`}
          onClick={(e) => { e.stopPropagation(); navigate('/nurse-dashboard'); }}
        >
          <div className="sidebar-icon-wrap"><LayoutGrid size={22} color="#707EAE" /></div>
          <span className="sidebar-label">Dashboard</span>
        </div>
        <div
          className={`sidebar-nav-item${pathname === '/patient-database' ? ' sidebar-nav-active' : ''}`}
          onClick={(e) => { e.stopPropagation(); navigate('/patient-database'); }}
        >
          <div className="sidebar-icon-wrap"><Users size={22} color="#707EAE" /></div>
          <span className="sidebar-label">Residents</span>
        </div>
        <div
          className={`sidebar-nav-item${pathname === '/nurse-pending-admissions' ? ' sidebar-nav-active' : ''}`}
          onClick={(e) => { e.stopPropagation(); navigate('/nurse-pending-admissions'); }}
        >
          <div className="sidebar-icon-wrap"><ClipboardCheck size={22} color="#707EAE" /></div>
          <span className="sidebar-label">Pending Admissions</span>
        </div>
        <div
          className={`sidebar-nav-item${pathname === '/nurse-calendar' ? ' sidebar-nav-active' : ''}`}
          onClick={(e) => { e.stopPropagation(); navigate('/nurse-calendar'); }}
        >
          <div className="sidebar-icon-wrap"><Calendar size={22} color="#707EAE" /></div>
          <span className="sidebar-label">Calendar</span>
        </div>
        <div
          className={`sidebar-nav-item${pathname === '/nurse-medical-report' ? ' sidebar-nav-active' : ''}`}
          onClick={(e) => { e.stopPropagation(); navigate('/nurse-medical-report'); }}
        >
          <div className="sidebar-icon-wrap"><FileText size={22} color="#707EAE" /></div>
          <span className="sidebar-label">Medical Report</span>
        </div>
      </AdminSidebar>

      {/* MOBILE TOP BAR */}
      <div className="mobile-only mobile-top-bar">
        <img src={logo} alt="Kalinga" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
          <span className="mobile-top-bar-title">Medical Report</span>
        <div style={{ width: 36, height: 36, background: '#F54E25', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px' }}>JD</div>
      </div>

      {/* MAIN */}
      <main className="wr-main admin-sidebar-offset">

        {/* Header */}
        <div className="wr-header">
          <div>
            <h1>Medical Report</h1>
            <p>File weekly medical documentation for assigned residents</p>
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
                          <div className="wr-weeks-label">Medical reports by week — tap a week to load the form</div>
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
          <div className="wr-paper-title">Medical Report</div>
          <p className="wr-required-note">
            Fields marked with <RequiredMark /> are required.
          </p>

          <form onSubmit={(e) => { e.preventDefault(); setShowConfirm(true); }}>

            {/* Week & Admission Date */}
            <div className="form-grid-2">
              <div className="form-field">
                <FormLabel required>Week:</FormLabel>
                <input
                  type="text"
                  className="form-underline-input"
                  placeholder="Select week above"
                  value={reportBasics.weekLabel}
                  onChange={(e) => setReportBasics((prev) => ({ ...prev, weekLabel: e.target.value }))}
                />
              </div>
              <div className="form-field">
                <FormLabel>Admission Date:</FormLabel>
                <input
                  type="text"
                  className="form-underline-input"
                  value={reportBasics.admissionDate}
                  onChange={(e) => setReportBasics((prev) => ({ ...prev, admissionDate: e.target.value }))}
                />
              </div>
            </div>

            {/* Resident Information — pulled from the resident record, not editable here */}
            <div className="form-section form-section--readonly">
              <SectionTitle>Resident Information</SectionTitle>
              <div className="section-fields">
                <div className="form-field">
                  <FormLabel required>Resident Name:</FormLabel>
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
                    <FormLabel>Age:</FormLabel>
                    <input
                      type="text"
                      className="form-underline-input form-underline-input--readonly"
                      value={reportBasics.age}
                      readOnly
                      aria-readonly="true"
                    />
                  </div>
                  <div className="form-field">
                    <FormLabel>Primary Concern:</FormLabel>
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
            <div className="form-section">
              <SectionTitle required>Current Medications</SectionTitle>
              <MedicationTableField
                value={reportDetails.currentMedications}
                onChange={(next) => setReportDetails((prev) => ({ ...prev, currentMedications: next }))}
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
                  <FormLabel required>Weight (kg):</FormLabel>
                  <input
                    type="text"
                    className="form-underline-input"
                    value={vitals.weight}
                    onChange={(e) => handleVitalsFieldChange('weight', e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <FormLabel>Height (cm):</FormLabel>
                  <input
                    type="text"
                    className="form-underline-input"
                    value={vitals.height}
                    onChange={(e) => handleVitalsFieldChange('height', e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <FormLabel>BMI:</FormLabel>
                  <input
                    type="text"
                    className="form-underline-input"
                    value={vitals.bmi}
                    onChange={(e) => setVitals((prev) => ({ ...prev, bmi: e.target.value }))}
                  />
                </div>
                <div className="form-field">
                  <FormLabel required>Blood Pressure:</FormLabel>
                  <input
                    type="text"
                    className="form-underline-input"
                    value={vitals.bp}
                    onChange={(e) => setVitals((prev) => ({ ...prev, bp: e.target.value }))}
                    placeholder="120/80"
                  />
                </div>
                <div className="form-field">
                  <FormLabel required>PR:</FormLabel>
                  <input
                    type="text"
                    className="form-underline-input"
                    value={vitals.pr}
                    onChange={(e) => setVitals((prev) => ({ ...prev, pr: e.target.value }))}
                  />
                </div>
                <div className="form-field">
                  <FormLabel required>RR:</FormLabel>
                  <input
                    type="text"
                    className="form-underline-input"
                    value={vitals.rr}
                    onChange={(e) => setVitals((prev) => ({ ...prev, rr: e.target.value }))}
                  />
                </div>
                <div className="form-field">
                  <FormLabel required>SPO2:</FormLabel>
                  <input
                    type="text"
                    className="form-underline-input"
                    value={vitals.spo2}
                    onChange={(e) => setVitals((prev) => ({ ...prev, spo2: e.target.value }))}
                  />
                </div>
                <div className="form-field">
                  <FormLabel required>Temperature (°F):</FormLabel>
                  <input
                    type="text"
                    className="form-underline-input"
                    value={vitals.temperature}
                    onChange={(e) => setVitals((prev) => ({ ...prev, temperature: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Diet Restrictions */}
            <div className="form-section">
              <SectionTitle>Diet Restrictions</SectionTitle>
              <div className="section-fields">
                <div>
                  <FormLabel style={{ marginBottom: 8 }}>Dietary Restrictions:</FormLabel>
                  <BulletedListFieldInput
                    value={reportDetails.dietaryRestrictions}
                    onChange={(next) => setReportDetails((prev) => ({ ...prev, dietaryRestrictions: next }))}
                    placeholder="e.g. Low sodium diet, no raw foods..."
                    inputClassName="form-underline-input"
                    addLabel="Add restriction"
                  />
                </div>
                <div className="form-field">
                  <FormLabel>Food Allergies:</FormLabel>
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

            {/* Ongoing Medical Concern */}
            <div className="form-section">
              <SectionTitle required>Ongoing Medical Concern</SectionTitle>
              <BulletedListFieldInput
                value={reportDetails.ongoingMedicalConcern}
                onChange={(next) => setReportDetails((prev) => ({ ...prev, ongoingMedicalConcern: next }))}
                placeholder="e.g. Chronic back injury, hypertension monitoring..."
                inputClassName="form-textarea"
                multiline
                addLabel="Add concern"
              />
            </div>

            {/* Signatures */}
            <div className="form-grid-2" style={{ marginBottom: 0 }}>
              <div className="form-field">
                <FormLabel required>Nurse&apos;s name:</FormLabel>
                <input
                  type="text"
                  className="form-underline-input"
                  value={nurseSignatureName}
                  onChange={(e) => setNurseSignatureName(e.target.value)}
                />
              </div>
              <div className="form-field">
                <FormLabel required>Date:</FormLabel>
                <input
                  type="text"
                  className="form-underline-input"
                  value={nurseSignatureDate}
                  onChange={(e) => setNurseSignatureDate(e.target.value)}
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
                  <span className="confirm-text">Ready to submit the medical report?</span>
                  <button type="button" className="confirm-btn-cancel" onClick={() => setShowConfirm(false)}>Cancel</button>
                  <button type="button" className="confirm-btn-ok" onClick={persistWeeklyReport}>Confirm</button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn-summary"
                    disabled={!isReportComplete}
                    onClick={handleCreateSummary}
                    title={isReportComplete ? 'Combine and preview everything filled out on this report' : 'Fill out all required fields to create a summary'}
                  >
                    Create Summary
                  </button>
                  <button type="submit" className="btn-submit">Submit Medical Report</button>
                </>
              )}
            </div>

          </form>
        </div>
      </main>

      {/* MOBILE BOTTOM NAV */}
      <div className="mobile-only mobile-bottom-nav">
        <div className="mob-nav-item" onClick={() => navigate('/nurse-dashboard')}>
          <div style={{ background: '#F4F7FE', padding: 10, borderRadius: 10, display: 'flex' }}>
            <LayoutGrid size={20} color="#707EAE" />
          </div>
          <span>Dashboard</span>
        </div>
        <div className="mob-nav-item" onClick={() => navigate('/patient-database')}>
          <div style={{ background: '#F4F7FE', padding: 10, borderRadius: 10, display: 'flex' }}>
            <Users size={20} color="#707EAE" />
          </div>
          <span>Residents</span>
        </div>
        <div className="mob-nav-item" onClick={() => navigate('/nurse-calendar')}>
          <div style={{ background: '#F4F7FE', padding: 10, borderRadius: 10, display: 'flex' }}>
            <Calendar size={20} color="#707EAE" />
          </div>
          <span>Calendar</span>
        </div>
        <div className="mob-nav-item active">
          <div style={{ background: '#F54E25', color: 'white', padding: 10, borderRadius: 10, display: 'flex' }}>
            <FileText size={20} />
          </div>
          <span>Medical</span>
        </div>
        <div className="mob-nav-item" onClick={() => navigate('/nurseprofile')}>
          <User size={22} color="#707EAE" />
          <span>Profile</span>
        </div>
        <div className="mob-nav-item" onClick={() => navigate('/login')}>
          <LogOut size={22} color="#F54E25" />
          <span style={{ color: '#F54E25' }}>Logout</span>
        </div>
      </div>

      {showSummaryModal ? (
        <div className="mr-summary-backdrop" onClick={() => setShowSummaryModal(false)}>
          <div className="mr-summary-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mr-summary-head">
              <span className="mr-summary-title">Report Summary</span>
              <button type="button" className="mr-summary-close" onClick={() => setShowSummaryModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="mr-summary-body">{summaryText}</div>
            <div className="mr-summary-foot">
              <button type="button" className="confirm-btn-cancel" onClick={() => setShowSummaryModal(false)}>Close</button>
              <button type="button" className="confirm-btn-ok" onClick={handleCopySummary}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Copy size={14} />
                  {summaryCopied ? 'Copied' : 'Copy'}
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
};

export default NurseMedicalReportPage;