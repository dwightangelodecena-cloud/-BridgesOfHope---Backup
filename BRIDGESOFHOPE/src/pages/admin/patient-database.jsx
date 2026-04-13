import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LayoutGrid, BarChart2, HeartPulse, LogOut, Search, Filter, User, X, Edit2, ChevronDown, Users, ClipboardList, ArrowRightSquare, Stethoscope, Sparkles, BedDouble } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logoBH from '@/assets/logo2.png';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { APP_DATA_REFRESH, refreshAppData } from '@/lib/appDataRefresh';
import { fetchWeeklyReportRecommendation } from '@/lib/weeklyReportAi';

const WEEKLY_REPORTS_STORAGE_KEY = 'bh_nurse_weekly_reports';

/** Editable trajectory while in care. Discharged is derived from `discharged_at` (dashboard discharge approval), not set here. */
const CLINICAL_STATUS_OPTIONS = ['Improving', 'Stable', 'Declining'];

const COHORT_FILTER_OPTIONS = [
  { value: 'all', label: 'All records' },
  { value: 'in_care', label: 'Active / in care' },
  { value: 'admitted_only', label: 'In care only' },
  { value: 'discharged', label: 'Discharged' },
];

const STATUS_FILTER_OPTIONS = [
  { value: 'All', label: 'All Status' },
  { value: 'Discharged', label: 'Discharged' },
  ...CLINICAL_STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
];

const CONCERN_CATEGORY_OPTIONS = [
  { value: 'all', label: 'All concerns' },
  { value: 'drugs', label: 'Drugs' },
  { value: 'alcohol', label: 'Alcohol' },
  { value: 'gambling', label: 'Gambling' },
  { value: 'mental_health', label: 'Mental health' },
];

/** Match free-text primary concern to a category (case-insensitive). */
const concernMatchesCategory = (concernRaw, category) => {
  if (category === 'all') return true;
  const c = String(concernRaw || '').toLowerCase();
  if (category === 'drugs') return c.includes('drug') || c.includes('substance');
  if (category === 'alcohol') return c.includes('alcohol');
  if (category === 'gambling') return c.includes('gambling') || c.includes('betting');
  if (category === 'mental_health') {
    return (
      c.includes('mental health') ||
      c.includes('psychiatr') ||
      c.includes('psycholog') ||
      c.includes('depression') ||
      c.includes('anxiety')
    );
  }
  return true;
};

const STATUS_ORDER = ['Discharged', 'Declining', 'Stable', 'Improving'].reduce((acc, s, i) => {
  acc[s] = i;
  return acc;
}, {});

const formatDate = (iso) => {
  if (!iso) return 'N/A';
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return 'N/A';
  }
};

const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return 'N/A';
  const d = new Date(dateOfBirth);
  if (Number.isNaN(d.getTime())) return 'N/A';
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 ? age : 'N/A';
};

/** Stable small hash for bed room label until rooms are stored in the DB. */
const hashPatientId = (id) => {
  const s = String(id ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return Math.abs(h);
};

const displayBedRoomLabel = (patient) => {
  if (!patient || patient.status === 'Discharged') return '—';
  const n = 200 + (hashPatientId(patient.id) % 56);
  return `Room ${n}`;
};

const toUiPatient = (row) => {
  const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const discharged = row.discharged_at != null && String(row.discharged_at).trim() !== '';
  const rawCs = (row.clinical_status && String(row.clinical_status).trim()) || 'Stable';
  const clinicalNorm = CLINICAL_STATUS_OPTIONS.includes(rawCs) ? rawCs : 'Stable';
  const overallStatus = discharged ? 'Discharged' : clinicalNorm;
  return {
    id: row.id,
    name: row.full_name || 'Unknown Patient',
    age: calculateAge(row.date_of_birth),
    gender: row.gender || 'N/A',
    concern: row.primary_concern || 'N/A',
    status: overallStatus,
    clinicalStatus: clinicalNorm,
    admissionDate: row.admitted_at,
    date: formatDate(row.admitted_at),
    progress: row.progress_percent ?? 0,
    contact: prof?.phone || 'N/A',
    familyName: prof?.full_name || 'N/A',
    familyId: row.family_id,
    dischargedAt: row.discharged_at,
    dateOfBirth: row.date_of_birth,
  };
};

/** Quick-edit dropdown: clinical trajectory only (in-care rows). */
const clinicalSelectValue = (patient) => {
  if (!patient) return 'Stable';
  const s = patient.clinicalStatus || patient.status;
  return CLINICAL_STATUS_OPTIONS.includes(s) ? s : 'Stable';
};

/** One row per menu option; admission uses two entries (no duplicate “Admission Date” row). */
const SORT_MENU_ITEMS = [
  { id: 'patient_name', label: 'Patient Name (A to Z)', sortKey: 'Patient Name', direction: 'asc' },
  {
    id: 'admission_closest',
    label: 'Admission dates closest to now',
    sortKey: 'Admission Date',
    direction: 'desc',
  },
  {
    id: 'admission_farthest',
    label: 'Admission dates farthest from now',
    sortKey: 'Admission Date',
    direction: 'asc',
  },
  { id: 'age_youngest', label: 'Age (youngest to oldest)', sortKey: 'Age', direction: 'asc' },
  { id: 'age_oldest', label: 'Age (oldest to youngest)', sortKey: 'Age', direction: 'desc' },
];

const sortPatients = (rows, sortKey, direction) => {
  const cp = [...rows];
  const asc = direction === 'asc';
  cp.sort((a, b) => {
    let r = 0;
    if (sortKey === 'Admission Date') {
      const da = new Date(a.admissionDate || 0).getTime();
      const db = new Date(b.admissionDate || 0).getTime();
      r = da - db;
    } else if (sortKey === 'Patient Name') {
      r = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    } else if (sortKey === 'Status') {
      const oa = STATUS_ORDER[a.status] ?? 99;
      const ob = STATUS_ORDER[b.status] ?? 99;
      r = oa !== ob ? oa - ob : a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    } else if (sortKey === 'Age') {
      const na = typeof a.age === 'number' ? a.age : -1;
      const nb = typeof b.age === 'number' ? b.age : -1;
      r = na !== nb ? na - nb : a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    } else {
      r = a.concern.localeCompare(b.concern, undefined, { sensitivity: 'base' });
    }
    return asc ? r : -r;
  });
  return cp;
};

/** Right column in Edit Patient card — reserved for nurse-entered records. */
function NursingRecordsPlaceholder() {
  return (
    <div
      style={{
        border: '1px dashed #CBD5E1',
        borderRadius: 16,
        background: 'linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%)',
        padding: 28,
        minHeight: 300,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 14,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: 'white',
          border: '1px solid #E9EDF7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(27, 37, 89, 0.06)',
        }}
      >
        <ClipboardList size={26} color="#94a3b8" strokeWidth={1.75} aria-hidden />
      </div>
      <div>
        <p style={{ fontWeight: 800, color: '#475569', fontSize: 15, margin: 0 }}>Nursing & clinical records</p>
        <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.55, margin: '8px 0 0', maxWidth: 280 }}>
          Shift notes, vitals history, medications, and assessments will be managed here once nursing workflows are connected.
        </p>
      </div>
    </div>
  );
}

const mapLegacyLocalPatients = () => {
  const legacy = JSON.parse(localStorage.getItem('bh_patients') || '[]');
  return legacy.map((p, idx) => {
    const dischargedAt = p.dischargedAt || (p.status === 'Discharged' ? new Date().toISOString() : null);
    const discharged = dischargedAt != null && String(dischargedAt).trim() !== '';
    const raw = p.status || 'Stable';
    const clinicalNorm = CLINICAL_STATUS_OPTIONS.includes(raw) ? raw : 'Stable';
    return {
      id: String(p.id ?? idx),
      name: p.name || 'Unknown Patient',
      age: p.age ?? 'N/A',
      gender: p.gender || 'N/A',
      concern: p.concern || p.reason || 'N/A',
      status: discharged ? 'Discharged' : clinicalNorm,
      clinicalStatus: clinicalNorm,
      admissionDate: p.admissionDate || p.admitted_at || null,
      date: p.date || formatDate(p.admissionDate || p.admitted_at),
      progress: p.progress ?? 0,
      contact: p.contact || 'N/A',
      familyName: p.familyName || 'N/A',
      familyId: p.family_id || null,
      dischargedAt,
      dateOfBirth: p.date_of_birth || null,
    };
  });
};

const AdminPatientDatabase = () => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [sortSelectionId, setSortSelectionId] = useState('admission_closest');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const sortDropdownRef = useRef(null);
  const [cohortDropdownOpen, setCohortDropdownOpen] = useState(false);
  const cohortDropdownRef = useRef(null);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef(null);
  const [concernDropdownOpen, setConcernDropdownOpen] = useState(false);
  const concernDropdownRef = useRef(null);
  const [cohortFilter, setCohortFilter] = useState('all');
  const [concernCategoryFilter, setConcernCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({
    full_name: '',
    primary_concern: '',
    progress_percent: 0,
    clinical_status: 'Stable',
  });
  const [weeklyReportsByWeek, setWeeklyReportsByWeek] = useState({});
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiWeekNumber, setAiWeekNumber] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiError, setAiError] = useState('');

  const loadPatients = async () => {
    setLoading(true);
    setFormError('');
    try {
      if (!isSupabaseConfigured()) {
        setPatients(mapLegacyLocalPatients());
        return;
      }

      const { data, error } = await supabase
        .from('patients')
        .select(`
          *,
          profiles (
            full_name,
            phone
          )
        `)
        .order('admitted_at', { ascending: false });

      if (error) throw error;

      const fromDb = (data || []).map(toUiPatient);
      if (fromDb.length > 0) {
        setPatients(fromDb);
        return;
      }

      const legacyMapped = mapLegacyLocalPatients();
      if (legacyMapped.length > 0) {
        setPatients(legacyMapped);
        return;
      }

      setPatients([]);
    } catch (err) {
      console.error(err);
      const legacyMapped = mapLegacyLocalPatients();
      if (legacyMapped.length > 0) {
        setPatients(legacyMapped);
        setFormError(
          `${err.message || 'Failed to load from server.'} Showing locally saved patients.`
        );
      } else {
        setFormError(err.message || 'Failed to load patient records.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPatients();
    const onRefresh = () => void loadPatients();
    window.addEventListener('storage', onRefresh);
    window.addEventListener(APP_DATA_REFRESH, onRefresh);
    return () => {
      window.removeEventListener('storage', onRefresh);
      window.removeEventListener(APP_DATA_REFRESH, onRefresh);
    };
  }, []);

  useEffect(() => {
    if (!sortDropdownOpen && !cohortDropdownOpen && !statusDropdownOpen && !concernDropdownOpen) return;
    const onDoc = (e) => {
      const t = e.target;
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(t)) setSortDropdownOpen(false);
      if (cohortDropdownRef.current && !cohortDropdownRef.current.contains(t)) setCohortDropdownOpen(false);
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(t)) setStatusDropdownOpen(false);
      if (concernDropdownRef.current && !concernDropdownRef.current.contains(t)) setConcernDropdownOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [sortDropdownOpen, cohortDropdownOpen, statusDropdownOpen, concernDropdownOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const bySearch = patients.filter((p) => {
      if (!q) return true;
      return (
        String(p.name || '').toLowerCase().includes(q) ||
        String(p.concern || '').toLowerCase().includes(q) ||
        String(p.status || '').toLowerCase().includes(q) ||
        String(p.contact || '').toLowerCase().includes(q) ||
        String(p.familyName || '').toLowerCase().includes(q)
      );
    });
    const byCohort = bySearch.filter((p) => {
      if (cohortFilter === 'all') return true;
      if (cohortFilter === 'in_care') return p.status !== 'Discharged';
      if (cohortFilter === 'admitted_only') return p.status !== 'Discharged';
      if (cohortFilter === 'discharged') return p.status === 'Discharged';
      return true;
    });
    const byConcern = byCohort.filter((p) => concernMatchesCategory(p.concern, concernCategoryFilter));
    const byStatus = byConcern.filter((p) => statusFilter === 'All' || p.status === statusFilter);
    const sel = SORT_MENU_ITEMS.find((i) => i.id === sortSelectionId) ?? SORT_MENU_ITEMS[1];
    return sortPatients(byStatus, sel.sortKey, sel.direction);
  }, [patients, search, sortSelectionId, cohortFilter, concernCategoryFilter, statusFilter]);

  const counts = useMemo(() => {
    const total = patients.length;
    const discharged = patients.filter((p) => p.status === 'Discharged').length;
    const admitted = patients.filter((p) => p.status !== 'Discharged').length;
    return { total, admitted, discharged };
  }, [patients]);

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Improving':
        return { background: '#E6FFFA', color: '#1D7A68', border: '1px solid #B2F5EA' };
      case 'Stable':
        return { background: '#E6F0FF', color: '#1D58A6', border: '1px solid #B2CCFF' };
      case 'Declining':
        return { background: '#FFF5F5', color: '#A61D24', border: '1px solid #FEB2B2' };
      case 'Discharged':
        return { background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB' };
      default:
        return { background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB' };
    }
  };

  const getProgressColor = (patientOrStatus) => {
    const s = typeof patientOrStatus === 'object' && patientOrStatus !== null
      ? patientOrStatus.clinicalStatus || patientOrStatus.status
      : patientOrStatus;
    return s === 'Declining' ? '#F87171' : '#2563EB';
  };

  const openEditor = (patient) => {
    setEditingId(patient.id);
    setEditDraft({
      full_name: patient.name,
      primary_concern: patient.concern === 'N/A' ? '' : patient.concern,
      progress_percent: Number(patient.progress || 0),
      clinical_status: clinicalSelectValue(patient),
    });
  };

  const savePatient = async (patientId) => {
    const progress = Number(editDraft.progress_percent);
    if (Number.isNaN(progress) || progress < 0 || progress > 100) {
      setFormError('Progress must be between 0 and 100.');
      return;
    }
    const clinical = CLINICAL_STATUS_OPTIONS.includes(editDraft.clinical_status)
      ? editDraft.clinical_status
      : 'Stable';
    setSavingId(patientId);
    setFormError('');

    const payload = {
      full_name: editDraft.full_name.trim() || 'Unknown Patient',
      primary_concern: editDraft.primary_concern.trim() || null,
      progress_percent: progress,
      clinical_status: clinical,
    };

    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('patients').update(payload).eq('id', patientId);
        if (error) throw error;
        refreshAppData();
        await loadPatients();
      } else {
        setPatients((prev) =>
          prev.map((p) =>
            p.id !== patientId
              ? p
              : {
                  ...p,
                  name: payload.full_name,
                  concern: payload.primary_concern || 'N/A',
                  progress: payload.progress_percent,
                  clinicalStatus: clinical,
                  status:
                    p.dischargedAt != null && String(p.dischargedAt).trim() !== ''
                      ? 'Discharged'
                      : clinical,
                }
          )
        );
        refreshAppData();
      }

      if (selectedPatient?.id === patientId) {
        setSelectedPatient((prev) =>
          prev
            ? {
                ...prev,
                name: payload.full_name,
                concern: payload.primary_concern || 'N/A',
                progress: payload.progress_percent,
                clinicalStatus: clinical,
                status:
                  prev.dischargedAt != null && String(prev.dischargedAt).trim() !== ''
                    ? 'Discharged'
                    : clinical,
              }
            : prev
        );
      }
      setEditingId(null);
    } catch (err) {
      console.error(err);
      setFormError(err.message || 'Failed to update patient.');
    } finally {
      setSavingId(null);
    }
  };

  const isSupabasePatientId = (id) =>
    typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  useEffect(() => {
    if (!selectedPatient?.id) {
      setWeeklyReportsByWeek({});
      return;
    }
    let cancelled = false;
    const pid = selectedPatient.id;
    const pidStr = String(pid);

    (async () => {
      const map = {};
      if (isSupabaseConfigured() && isSupabasePatientId(pidStr)) {
        const { data, error } = await supabase
          .from('weekly_reports')
          .select('week_number, nurse_name, report_date, submitted_at')
          .eq('patient_id', pid);
        if (!error && data) {
          for (const row of data) {
            map[row.week_number] = row;
          }
        }
      } else {
        try {
          const raw = localStorage.getItem(WEEKLY_REPORTS_STORAGE_KEY);
          const all = raw ? JSON.parse(raw) : {};
          const byWeek = all[pidStr] || {};
          for (const w of Object.keys(byWeek)) {
            const n = parseInt(w, 10);
            const e = byWeek[w];
            if (!Number.isNaN(n) && e && typeof e === 'object') {
              map[n] = {
                week_number: n,
                nurse_name: e.nurseName ?? e.nurse_name,
                report_date: e.reportDate ?? e.report_date,
                submitted_at: e.submittedAt ?? e.submitted_at,
              };
            }
          }
        } catch {
          /* ignore */
        }
      }
      if (!cancelled) setWeeklyReportsByWeek(map);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedPatient?.id]);

  const openWeeklyAiModal = useCallback(
    (weekNum) => {
      if (!selectedPatient) return;
      const row = weeklyReportsByWeek[weekNum];
      setAiWeekNumber(weekNum);
      setAiModalOpen(true);
      setAiText('');
      setAiError('');
      setAiLoading(true);

      const patientSummary = [
        `Patient: ${selectedPatient.name}`,
        `Age: ${selectedPatient.age}`,
        `Primary concern: ${selectedPatient.concern}`,
        `Clinical status: ${selectedPatient.clinicalStatus || selectedPatient.status}`,
        `Progress: ${selectedPatient.progress}%`,
        `Admission: ${selectedPatient.date}`,
        `Family contact name: ${selectedPatient.familyName}`,
      ].join('\n');

      const weekBlock = row
        ? [
            `Week number: ${weekNum}`,
            `Nurse (as filed): ${row.nurse_name || '—'}`,
            `Report date (as filed): ${row.report_date || '—'}`,
            `Submitted: ${row.submitted_at ? formatDate(row.submitted_at) : '—'}`,
            'Note: Only filing metadata is stored; narrative notes are not in this record.',
          ].join('\n')
        : `Week number: ${weekNum}\nNo weekly report has been filed for this week in the system.`;

      void fetchWeeklyReportRecommendation({ patientSummary, weekBlock })
        .then((text) => {
          setAiText(text);
          setAiLoading(false);
        })
        .catch((err) => {
          setAiError(err instanceof Error ? err.message : 'Could not generate recommendations.');
          setAiLoading(false);
        });
    },
    [selectedPatient, weeklyReportsByWeek]
  );

  const saveQuickClinicalStatus = async (patient, newClinical) => {
    if (patient.status === 'Discharged') return;
    if (!CLINICAL_STATUS_OPTIONS.includes(newClinical) || newClinical === patient.clinicalStatus) return;
    setSavingId(patient.id);
    setFormError('');
    try {
      if (isSupabaseConfigured()) {
        if (!isSupabasePatientId(String(patient.id))) {
          setFormError('This record is offline-only. Use full edit or sync patients to the database to update status here.');
          return;
        }
        const { error } = await supabase
          .from('patients')
          .update({ clinical_status: newClinical })
          .eq('id', patient.id);
        if (error) throw error;
        refreshAppData();
        await loadPatients();
      } else {
        setPatients((prev) =>
          prev.map((p) =>
            p.id !== patient.id
              ? p
              : {
                  ...p,
                  clinicalStatus: newClinical,
                  status: newClinical,
                }
          )
        );
        refreshAppData();
      }
      if (selectedPatient?.id === patient.id) {
        setSelectedPatient((prev) =>
          prev
            ? {
                ...prev,
                clinicalStatus: newClinical,
                status: newClinical,
              }
            : prev
        );
      }
    } catch (err) {
      console.error(err);
      setFormError(err.message || 'Could not update clinical status.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="db-outer" style={{ display: 'flex', minHeight: '100vh', background: '#F8F9FD', fontFamily: "'Inter', -apple-system, sans-serif", color: '#1B2559' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

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
        }

        .sidebar-logo-container {
          display: flex;
          justify-content: center;
          width: 100%;
          margin-bottom: 28px;
          align-self: center;
        }

        .sidebar-logo {
          width: ${isExpanded ? '120px' : '70px'};
          transition: width 0.3s ease;
        }

        .sidebar-nav-scroll {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          width: 100%;
          display: flex;
          flex-direction: column;
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

        .sidebar-footer {
          flex-shrink: 0;
          width: 100%;
          padding: 16px 0 20px;
          margin-top: auto;
          border-top: 1px solid #f1f5f9;
        }

        .icon-box {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s;
        }
        
        .icon-box.active {
          background: #F54E25;
          color: white;
        }
        
        .icon-box.inactive {
          background: transparent;
          color: #A3AED0;
        }

        .db-main {
          flex: 1;
          width: 94vw;
          min-height: 100vh;
          margin-left: ${isExpanded ? '280px' : '110px'};
          transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          padding: 40px;
        }

        .db-view-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: white;
          background: #323D4E;
          padding: 6px 14px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s;
          font-family: 'Inter', sans-serif;
        }
        .db-view-btn:hover { background: #1f2937; }

        .db-row:hover { background: rgba(249,250,251,0.8); }

        .db-search-input {
          padding: 10px 12px 10px 36px;
          border: 1px solid #E9EDF7;
          border-radius: 12px;
          font-size: 13px;
          width: 250px;
          outline: none;
          font-family: 'Inter', sans-serif;
          color: #1B2559;
          background: white;
          transition: border-color 0.15s;
        }
        .db-search-input:focus { border-color: #2563EB; }

        .db-filter-btn, .db-status-select {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border: 1px solid #E9EDF7;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 700;
          color: #1B2559;
          background: white;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
        }

        .db-sort-select {
          border: 1px solid #E9EDF7;
          border-radius: 8px;
          padding: 4px 8px;
          font-size: 13px;
          font-weight: 600;
          outline: none;
          color: #1B2559;
          cursor: pointer;
        }

        .db-sort-by-wrap { position: relative; }
        .db-sort-by-trigger {
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          min-width: min(100%, 320px);
          max-width: 100%;
          padding: 8px 12px;
          border: 1px solid #0f172a;
          border-radius: 8px;
          background: white;
          font-size: 13px;
          font-weight: 700;
          color: #1B2559;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
        }
        .db-sort-by-trigger-prefix {
          font-weight: 600;
          color: #1B2559;
          flex-shrink: 0;
        }
        .db-sort-by-trigger-value {
          flex: 1;
          text-align: left;
          font-weight: 700;
          min-width: 0;
        }
        .db-sort-by-trigger:hover { border-color: #cbd5e1; }
        .db-sort-by-trigger:focus-visible {
          outline: 2px solid #2563EB;
          outline-offset: 1px;
        }
        .db-sort-by-trigger-icon {
          flex-shrink: 0;
          color: #1B2559;
          transition: transform 0.15s ease;
        }
        .db-sort-by-trigger-icon--open { transform: rotate(180deg); }
        .db-sort-by-trigger--compact {
          min-width: min(100%, 200px);
        }
        .db-sort-by-menu {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          min-width: 100%;
          margin: 0;
          padding: 4px 0;
          list-style: none;
          background: white;
          border: 1px solid #1B2559;
          border-radius: 8px;
          box-shadow: 0 4px 14px rgba(27, 37, 89, 0.12);
          z-index: 50;
        }
        .db-sort-by-option {
          display: block;
          width: 100%;
          padding: 10px 14px;
          border: none;
          background: transparent;
          text-align: left;
          font-size: 13px;
          font-weight: 600;
          color: #1B2559;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
        }
        .db-sort-by-option:hover:not(.db-sort-by-option--active) {
          background: #f1f5f9;
        }
        .db-sort-by-option--active {
          background: #2563EB;
          color: white;
        }

        .db-edit-btn {
          background: #F54E25;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 7px 16px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          transition: background 0.15s;
          display: inline-flex;
          gap: 6px;
          align-items: center;
        }
        .db-edit-btn:hover { background: #d43d1a; }

        .info-card {
          background: white;
          border: 1px solid #E9EDF7;
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.02);
        }
        .vital-label { color: #A3AED0; font-size: 11px; font-weight: 600; margin-bottom: 2px; text-transform: uppercase; }
        .vital-value { color: #1B2559; font-size: 16px; font-weight: 800; }
        
        .week-card {
          flex: 1;
          background: white;
          border: 1px solid #E9EDF7;
          border-radius: 16px;
          padding: 30px 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .week-number { font-size: 42px; font-weight: 800; color: #1B2559; }

        .admin-week-card { position: relative; cursor: default !important; }
        .admin-week-ai-btn {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 32px;
          height: 32px;
          border-radius: 10px;
          border: 1px solid #E9EDF7;
          background: #f8fafc;
          color: #4f46e5;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: 0;
          transition: background 0.15s, border-color 0.15s;
          z-index: 2;
        }
        .admin-week-ai-btn:hover:not(:disabled) {
          background: #eef2ff;
          border-color: #c7d2fe;
        }
        .admin-week-ai-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .admin-ai-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .admin-ai-modal {
          background: white;
          border-radius: 20px;
          border: 1px solid #E9EDF7;
          box-shadow: 0 24px 48px rgba(27, 37, 89, 0.12);
          max-width: 560px;
          width: 100%;
          max-height: min(85vh, 640px);
          display: flex;
          flex-direction: column;
          font-family: 'Inter', sans-serif;
        }
        .admin-ai-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 20px 22px 12px;
          border-bottom: 1px solid #F4F7FE;
        }
        .admin-ai-modal-body {
          padding: 16px 22px 20px;
          overflow-y: auto;
          flex: 1;
          font-size: 14px;
          line-height: 1.55;
          color: #334155;
          white-space: pre-wrap;
        }
        .admin-ai-modal-footer {
          padding: 12px 22px 16px;
          border-top: 1px solid #F4F7FE;
          font-size: 11px;
          color: #94a3b8;
          line-height: 1.4;
        }

        @keyframes admin-ai-spin {
          to { transform: rotate(360deg); }
        }

        .db-mobile-only { display: none; }

        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .db-mobile-only { display: flex !important; }
          .db-outer { flex-direction: column !important; width: 100vw; overflow-x: hidden; }
          .db-mobile-top-bar { display: flex !important; width: 100vw; background: white; z-index: 1001; position: sticky; top: 0; }
          .db-main { margin-left: 0 !important; width: 100vw !important; padding: 20px 12px 100px 12px !important; }
          .db-main > div:nth-child(2) { padding: 20px 12px !important; border-radius: 20px !important; width: 100% !important; }
          .db-table-mobile { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .db-controls-mobile { flex-direction: column !important; align-items: stretch !important; gap: 15px !important; }
          .db-search-input { width: 100% !important; }
          .db-mobile-bottom-nav { position: fixed; bottom: 0; left: 0; width: 100vw; height: 72px; background: white; border-top: 1px solid #F1F1F1; display: flex; justify-content: space-around; align-items: center; z-index: 1000; }
          .mob-nav-item { display: flex; flex-direction: column; align-items: center; font-size: 10px; color: #A3AED0; }
          .mob-nav-item.active { color: #F54E25; }
          .view-top-row { flex-direction: column !important; gap: 16px !important; }
          .view-bottom-row { display: flex !important; flex-direction: column !important; gap: 16px !important; }
          .view-vitals-row { flex-wrap: wrap !important; gap: 12px !important; }
          .view-vitals-row > div { min-width: 45% !important; margin-bottom: 8px !important; }
          .view-weeks-row { flex-wrap: wrap !important; gap: 12px !important; }
          .view-weeks-row > div { min-width: 45% !important; flex: 1 1 45% !important; }
          .admin-edit-split {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 20px !important;
          }
        }

        .admin-edit-split {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 28px;
          align-items: start;
        }
        .admin-edit-label {
          display: block;
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
          margin-bottom: 6px;
          letter-spacing: 0.01em;
        }
        .admin-edit-field {
          width: 100%;
          padding: 12px 14px;
          border: 1px solid #E9EDF7;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          color: #1B2559;
          outline: none;
          font-family: 'Inter', sans-serif;
          background: #fff;
          transition: border-color 0.15s, box-shadow 0.15s;
          box-sizing: border-box;
        }
        .admin-edit-field:focus {
          border-color: #2563EB;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }
        .admin-edit-field--select {
          cursor: pointer;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          padding-right: 40px;
        }
        .admin-edit-summary-row {
          padding-bottom: 14px;
          border-bottom: 1px solid #F4F7FE;
        }
        .admin-edit-summary-row:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
      `}</style>

      {/* SIDEBAR */}
      <aside className="desktop-sidebar" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="sidebar-logo-container">
          <img src={logoBH} alt="BH" className="sidebar-logo" />
        </div>

        <nav className="sidebar-nav-scroll" aria-label="Admin navigation">
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-dashboard'); }}>
            <div className="icon-box inactive">
              <LayoutGrid size={22} />
            </div>
            <span className="sidebar-label">Dashboard</span>
          </div>

          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/analytics'); }}>
            <div className="icon-box inactive">
              <BarChart2 size={24} />
            </div>
            <span className="sidebar-label">Analytics</span>
          </div>

          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); setSelectedPatient(null); }}>
            <div className="icon-box active">
              <HeartPulse size={22} />
            </div>
            <span className="sidebar-label" style={{ color: '#F54E25' }}>Patient Management</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-admission-management'); }}>
            <div className="icon-box inactive"><ClipboardList size={22} /></div>
            <span className="sidebar-label">Admission Management</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-discharge-management'); }}>
            <div className="icon-box inactive"><ArrowRightSquare size={22} /></div>
            <span className="sidebar-label">Discharge Management</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-user-management'); }}>
            <div className="icon-box inactive">
              <Users size={22} />
            </div>
            <span className="sidebar-label">User Management</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-staff-management'); }}>
            <div className="icon-box inactive">
              <Stethoscope size={22} />
            </div>
            <span className="sidebar-label">Staff Management</span>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/login'); }}>
            <LogOut size={22} color="#F54E25" style={{ marginLeft: isExpanded ? '0' : '10px', flexShrink: 0 }} />
            <span className="sidebar-label" style={{ color: '#F54E25' }}>Logout</span>
          </div>
        </div>
      </aside>

      {/* MOBILE TOP BAR */}
      <div className="db-mobile-only db-mobile-top-bar" style={{ padding: '0 20px', height: 64, alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F1F1' }}>
        <img src={logoBH} alt="BH" style={{ height: 32 }} />
        <span style={{ fontSize: 16, fontWeight: 800, color: '#F54E25' }}>Patient Management</span>
        <div style={{ width: 36, height: 36, background: '#F54E25', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>JD</div>
      </div>

      {/* MAIN CONTENT */}
      <main className="db-main">
        {/* Header Section */}
        <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1B2559', marginBottom: 4 }}>
              Patient Management
            </h1>
            <p
              onClick={() => setSelectedPatient(null)}
              style={{ fontSize: 13, color: selectedPatient ? '#4361EE' : '#A3AED0', fontWeight: 600, cursor: selectedPatient ? 'pointer' : 'default' }}
            >
              {selectedPatient ? 'Patient Information' : 'Patient Management'}
            </p>
          </div>
          {selectedPatient && (
            <X
              size={32}
              color="#1B2559"
              style={{ cursor: 'pointer', flexShrink: 0 }}
              onClick={() => setSelectedPatient(null)}
            />
          )}
        </div>

        {selectedPatient ? (
          /* VIEW MODE */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="view-top-row" style={{ display: 'flex', gap: 24, flexDirection: 'row' }}>

              {/* Card 1: Basic Info */}
              <div className="info-card" style={{ flex: '1.2', display: 'flex', gap: 24, padding: '24px' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 84, height: 84, background: '#FF1F1F', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={44} color="white" />
                  </div>
                  <div style={{ position: 'absolute', bottom: -4, right: -4, background: 'white', padding: 6, borderRadius: '50%', border: '1px solid #E9EDF7', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <Edit2 size={14} color="#FF1F1F" />
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <p style={{ color: '#A3AED0', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Patient Name</p>
                      <p style={{ fontSize: 20, fontWeight: 800, color: '#1B2559' }}>{selectedPatient.name}</p>
                    </div>
                    <div style={{ textAlign: 'left', minWidth: '80px' }}>
                      <p style={{ color: '#A3AED0', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Age</p>
                      <p style={{ fontSize: 20, fontWeight: 800, color: '#1B2559' }}>{selectedPatient.age}</p>
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid #F4F7FE', paddingTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ color: '#A3AED0', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Primary Concern</p>
                        <p style={{ fontSize: 15, fontWeight: 800, color: '#1B2559' }}>{selectedPatient.concern}</p>
                      </div>
                      <div style={{ textAlign: 'left', minWidth: '80px' }}>
                        <p style={{ color: '#A3AED0', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Admission Date</p>
                        <p style={{ fontSize: 15, fontWeight: 800, color: '#1B2559' }}>{selectedPatient.date}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Status, bed, assigned nurse + progress (layout matches nurse reference) */}
              <div className="info-card" style={{ flex: '1.4', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                {(() => {
                  const trajectoryLabel =
                    selectedPatient.status === 'Discharged' ? 'Discharged' : selectedPatient.clinicalStatus;
                  const trajectoryStyle = getStatusStyle(
                    selectedPatient.status === 'Discharged' ? 'Discharged' : selectedPatient.clinicalStatus
                  );
                  const nurseNames = Object.values(weeklyReportsByWeek)
                    .map((r) => (r?.nurse_name && String(r.nurse_name).trim()) || '')
                    .filter(Boolean);
                  const assignedNurseDisplay = nurseNames[0] || '—';
                  return (
                    <div style={{ borderBottom: '1px solid #F4F7FE', paddingBottom: 16, marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
                        <div style={{ flex: 1, minWidth: 0, paddingRight: 14 }}>
                          <p style={{ color: '#A3AED0', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Status</p>
                          <span
                            style={{
                              ...trajectoryStyle,
                              padding: '6px 14px',
                              borderRadius: '20px',
                              fontSize: 13,
                              fontWeight: 800,
                              display: 'inline-block',
                            }}
                          >
                            {trajectoryLabel}
                          </span>
                        </div>
                        <div
                          style={{
                            flex: 1,
                            minWidth: 0,
                            paddingLeft: 14,
                            paddingRight: 14,
                            borderLeft: '1px solid #F4F7FE',
                          }}
                        >
                          <p style={{ color: '#A3AED0', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Bed Status</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <BedDouble size={18} color="#64748b" strokeWidth={2} aria-hidden />
                            <span style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>
                              {displayBedRoomLabel(selectedPatient)}
                            </span>
                          </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0, paddingLeft: 14, borderLeft: '1px solid #F4F7FE' }}>
                          <p style={{ color: '#A3AED0', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Assigned Nurse</p>
                          <p style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', lineHeight: 1.3 }}>
                            {assignedNurseDisplay === '—' ? '—' : `Nurse ${assignedNurseDisplay}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <p style={{ color: '#A3AED0', fontSize: 12, fontWeight: 600 }}>Progress</p>
                    <p style={{ fontSize: 13, fontWeight: 800, color: '#1B2559' }}>{selectedPatient.progress}%</p>
                  </div>
                  <div style={{ width: '100%', height: 16, background: '#E9EDF7', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${selectedPatient.progress}%`, height: '100%', background: getProgressColor(selectedPatient), borderRadius: 99 }} />
                  </div>
                </div>
              </div>

              {/* Card 3: Vitals grid — labels only; nurses will populate values later */}
              <div className="info-card" style={{ flex: '1.4', padding: '24px', display: 'flex', flexDirection: 'column' }}>
                {(() => {
                  const blank = '—';
                  const cell = (label) => (
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          color: '#A3AED0',
                          fontSize: 11,
                          fontWeight: 600,
                          marginBottom: 4,
                          textTransform: 'uppercase',
                          letterSpacing: '0.02em',
                        }}
                      >
                        {label}
                      </p>
                      <p style={{ fontSize: 16, fontWeight: 800, color: '#94a3b8' }}>{blank}</p>
                    </div>
                  );
                  return (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                        {cell('Current Weight')}
                        {cell('Height')}
                        {cell('BP')}
                        {cell('PR')}
                      </div>
                      <div
                        className="view-vitals-row"
                        style={{
                          borderTop: '1px solid #F4F7FE',
                          paddingTop: 16,
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 12,
                          flex: 1,
                          alignItems: 'flex-start',
                        }}
                      >
                        {cell('RR')}
                        {cell('T')}
                        {cell('BMI')}
                        {cell('SPO2')}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Weekly Progress — nurse-filed reports; AI insights via sparkle control */}
            <div className="info-card" style={{ padding: '32px' }}>
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1B2559' }}>Weekly Progress</h3>
                <p style={{ fontSize: 12, color: '#64748b', marginTop: 8, marginBottom: 0 }}>
                  Weekly reports filed for this patient (weeks 1–7). Click the AI icon on a card for suggestions based on patient context and that week&apos;s filing data.
                </p>
              </div>
              <div className="view-weeks-row" style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                {[1, 2, 3, 4, 5, 6, 7].map((w) => {
                  const row = weeklyReportsByWeek[w];
                  return (
                    <div
                      key={w}
                      className="week-card admin-week-card"
                      style={{
                        flex: '1 1 120px',
                        minWidth: 100,
                        maxWidth: 160,
                        padding: '24px 10px',
                      }}
                    >
                      <button
                        type="button"
                        className="admin-week-ai-btn"
                        onClick={() => openWeeklyAiModal(w)}
                        aria-label={`AI recommendations for week ${w}`}
                        title="AI recommendations"
                      >
                        <Sparkles size={16} strokeWidth={2} aria-hidden />
                      </button>
                      <p className="week-number" style={{ fontSize: 34, lineHeight: 1, marginTop: 8 }}>
                        {w}
                      </p>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ color: '#64748B', fontSize: 12, fontWeight: 600 }}>Week {w}</p>
                        <p
                          style={{
                            color: row ? '#1D7A68' : '#94a3b8',
                            fontSize: 11,
                            fontWeight: 700,
                            marginTop: 6,
                          }}
                        >
                          {row ? 'Submitted' : 'No report'}
                        </p>
                        {row?.report_date ? (
                          <p style={{ color: '#94a3b8', fontSize: 10, marginTop: 4 }}>{row.report_date}</p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="view-bottom-row" style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: 24 }}>
              {/* Edit Section */}
              <div className="info-card" style={{ padding: '28px 32px 32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 800, color: '#1B2559', margin: 0 }}>Edit Patient Information</h3>
                    <p style={{ fontSize: 12, color: '#94a3b8', margin: '6px 0 0', lineHeight: 1.45 }}>
                      Admin: update identity, primary concern, progress, and clinical trajectory. Discharge status follows the discharge workflow.
                    </p>
                  </div>
                  {editingId !== selectedPatient.id ? (
                    <button type="button" className="db-edit-btn" onClick={() => openEditor(selectedPatient)}>
                      <Edit2 size={14} /> Edit
                    </button>
                  ) : (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#F54E25',
                        background: '#FFF5F2',
                        border: '1px solid #FED7CC',
                        padding: '8px 12px',
                        borderRadius: 8,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Editing
                    </span>
                  )}
                </div>

                {editingId === selectedPatient.id ? (
                  <div className="admin-edit-split">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                      <div>
                        <label htmlFor="admin-edit-full-name" className="admin-edit-label">
                          Patient full name
                        </label>
                        <input
                          id="admin-edit-full-name"
                          className="admin-edit-field"
                          value={editDraft.full_name}
                          onChange={(e) => setEditDraft((prev) => ({ ...prev, full_name: e.target.value }))}
                          autoComplete="name"
                        />
                      </div>
                      <div>
                        <label htmlFor="admin-edit-concern" className="admin-edit-label">
                          Primary concern
                        </label>
                        <input
                          id="admin-edit-concern"
                          className="admin-edit-field"
                          value={editDraft.primary_concern}
                          onChange={(e) => setEditDraft((prev) => ({ ...prev, primary_concern: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label htmlFor="admin-edit-progress" className="admin-edit-label">
                          Recovery progress (%)
                        </label>
                        <input
                          id="admin-edit-progress"
                          className="admin-edit-field"
                          type="number"
                          min={0}
                          max={100}
                          value={editDraft.progress_percent}
                          onChange={(e) => setEditDraft((prev) => ({ ...prev, progress_percent: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label htmlFor="admin-edit-clinical" className="admin-edit-label">
                          Clinical trajectory
                        </label>
                        <select
                          id="admin-edit-clinical"
                          className="admin-edit-field admin-edit-field--select"
                          value={editDraft.clinical_status}
                          onChange={(e) => setEditDraft((prev) => ({ ...prev, clinical_status: e.target.value }))}
                        >
                          {CLINICAL_STATUS_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                      <div
                        style={{
                          background: '#F8FAFC',
                          border: '1px solid #E9EDF7',
                          borderRadius: 12,
                          padding: '12px 14px',
                        }}
                      >
                        <p style={{ fontSize: 12, color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                          <strong style={{ color: '#475569' }}>Discharged status</strong> is set automatically when a discharge request is approved on the dashboard—not on this form.
                        </p>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, paddingTop: 4 }}>
                        <button
                          type="button"
                          className="db-edit-btn"
                          disabled={savingId === selectedPatient.id}
                          onClick={() => savePatient(selectedPatient.id)}
                        >
                          {savingId === selectedPatient.id ? 'Saving…' : 'Save changes'}
                        </button>
                        <button type="button" className="db-filter-btn" onClick={() => setEditingId(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                    <NursingRecordsPlaceholder />
                  </div>
                ) : (
                  <div className="admin-edit-split">
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Current record
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {[
                          ['Patient full name', selectedPatient.name],
                          ['Primary concern', selectedPatient.concern],
                          ['Recovery progress', `${selectedPatient.progress}%`],
                          ['Clinical trajectory', selectedPatient.clinicalStatus],
                        ].map(([label, value]) => (
                          <div key={label} className="admin-edit-summary-row">
                            <p style={{ fontSize: 11, color: '#A3AED0', fontWeight: 600, marginBottom: 4 }}>{label}</p>
                            <p style={{ fontSize: 15, fontWeight: 800, color: '#1B2559', margin: 0 }}>{value}</p>
                          </div>
                        ))}
                      </div>
                      <p style={{ fontSize: 12, color: '#94a3b8', margin: '16px 0 0', lineHeight: 1.5 }}>
                        Select <strong style={{ color: '#64748b' }}>Edit</strong> to change these fields.
                      </p>
                    </div>
                    <NursingRecordsPlaceholder />
                  </div>
                )}
              </div>

              {/* Additional Notes */}
              <div className="info-card" style={{ padding: '32px' }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1B2559', marginBottom: 24 }}>Tracking Notes</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {[
                    'All records stay visible, including discharged patients.',
                    'Discharged appears automatically when a discharge request is approved on the admin dashboard.',
                    'Use the list or detail editor to set clinical status (Improving / Stable / Declining) only.',
                    'Use search, cohort, and status filters to track care from admission through discharge.',
                  ].map((note) => (
                    <div key={note} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 4, height: 4, background: '#1B2559', borderRadius: '50%', marginTop: 8, flexShrink: 0 }} />
                      <p style={{ fontSize: 12, color: '#1E293B', lineHeight: 1.6, fontWeight: 500 }}>{note}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* TABLE VIEW */
          <div style={{
            background: 'white',
            padding: 40,
            border: '1px solid #E9EDF7',
            borderRadius: 30,
            boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
          }}>
            {/* Controls */}
            <div className="db-controls-mobile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 26, fontWeight: 800, color: '#2563EB' }}>{counts.total}</span>
                  <span style={{ fontSize: 17, fontWeight: 700, color: '#1B2559' }}>Patients</span>
                  <span style={{ fontSize: 12, color: '#64748b', marginLeft: 10 }}>Admitted: {counts.admitted} | Discharged: {counts.discharged}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13, color: '#1B2559' }}>
                  <div className="db-sort-by-wrap" ref={sortDropdownRef}>
                    <button
                      type="button"
                      className="db-sort-by-trigger"
                      onClick={() => {
                        setCohortDropdownOpen(false);
                        setStatusDropdownOpen(false);
                        setConcernDropdownOpen(false);
                        setSortDropdownOpen((o) => !o);
                      }}
                      aria-expanded={sortDropdownOpen}
                      aria-haspopup="listbox"
                      aria-label="Sort by"
                    >
                      <span className="db-sort-by-trigger-prefix">Sort by:</span>
                      <span className="db-sort-by-trigger-value">
                        {(SORT_MENU_ITEMS.find((i) => i.id === sortSelectionId) ?? SORT_MENU_ITEMS[1]).label}
                      </span>
                      <ChevronDown
                        size={16}
                        className={`db-sort-by-trigger-icon${sortDropdownOpen ? ' db-sort-by-trigger-icon--open' : ''}`}
                        aria-hidden
                      />
                    </button>
                    {sortDropdownOpen && (
                      <ul className="db-sort-by-menu" role="listbox" aria-label="Sort options">
                        {SORT_MENU_ITEMS.map((item) => (
                          <li key={item.id} role="none">
                            <button
                              type="button"
                              role="option"
                              aria-selected={sortSelectionId === item.id}
                              className={`db-sort-by-option${sortSelectionId === item.id ? ' db-sort-by-option--active' : ''}`}
                              onClick={() => {
                                setSortSelectionId(item.id);
                                setSortDropdownOpen(false);
                              }}
                            >
                              {item.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              <div className="db-search-row-mobile" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#A3AED0' }} />
                  <input
                    type="text"
                    className="db-search-input"
                    placeholder="Search name, concern, status, contact…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <div className="db-sort-by-wrap" ref={cohortDropdownRef}>
                  <button
                    type="button"
                    className="db-sort-by-trigger db-sort-by-trigger--compact"
                    onClick={() => {
                      setSortDropdownOpen(false);
                      setStatusDropdownOpen(false);
                      setConcernDropdownOpen(false);
                      setCohortDropdownOpen((o) => !o);
                    }}
                    aria-expanded={cohortDropdownOpen}
                    aria-haspopup="listbox"
                    aria-label="Group filter"
                    title="Current, admitted, or discharged cohort"
                  >
                    <span className="db-sort-by-trigger-prefix">Group:</span>
                    <span className="db-sort-by-trigger-value">
                      {(COHORT_FILTER_OPTIONS.find((o) => o.value === cohortFilter) ?? COHORT_FILTER_OPTIONS[0]).label}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`db-sort-by-trigger-icon${cohortDropdownOpen ? ' db-sort-by-trigger-icon--open' : ''}`}
                      aria-hidden
                    />
                  </button>
                  {cohortDropdownOpen && (
                    <ul className="db-sort-by-menu" role="listbox" aria-label="Group">
                      {COHORT_FILTER_OPTIONS.map((opt) => (
                        <li key={opt.value} role="none">
                          <button
                            type="button"
                            role="option"
                            aria-selected={cohortFilter === opt.value}
                            className={`db-sort-by-option${cohortFilter === opt.value ? ' db-sort-by-option--active' : ''}`}
                            onClick={() => {
                              setCohortFilter(opt.value);
                              setCohortDropdownOpen(false);
                            }}
                          >
                            {opt.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="db-sort-by-wrap" ref={concernDropdownRef}>
                  <button
                    type="button"
                    className="db-sort-by-trigger db-sort-by-trigger--compact"
                    onClick={() => {
                      setSortDropdownOpen(false);
                      setCohortDropdownOpen(false);
                      setStatusDropdownOpen(false);
                      setConcernDropdownOpen((o) => !o);
                    }}
                    aria-expanded={concernDropdownOpen}
                    aria-haspopup="listbox"
                    aria-label="Concern filter"
                  >
                    <span className="db-sort-by-trigger-prefix">Concern:</span>
                    <span className="db-sort-by-trigger-value">
                      {(CONCERN_CATEGORY_OPTIONS.find((o) => o.value === concernCategoryFilter) ?? CONCERN_CATEGORY_OPTIONS[0]).label}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`db-sort-by-trigger-icon${concernDropdownOpen ? ' db-sort-by-trigger-icon--open' : ''}`}
                      aria-hidden
                    />
                  </button>
                  {concernDropdownOpen && (
                    <ul className="db-sort-by-menu" role="listbox" aria-label="Concern category">
                      {CONCERN_CATEGORY_OPTIONS.map((opt) => (
                        <li key={opt.value} role="none">
                          <button
                            type="button"
                            role="option"
                            aria-selected={concernCategoryFilter === opt.value}
                            className={`db-sort-by-option${concernCategoryFilter === opt.value ? ' db-sort-by-option--active' : ''}`}
                            onClick={() => {
                              setConcernCategoryFilter(opt.value);
                              setConcernDropdownOpen(false);
                            }}
                          >
                            {opt.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="db-sort-by-wrap" ref={statusDropdownRef}>
                  <button
                    type="button"
                    className="db-sort-by-trigger db-sort-by-trigger--compact"
                    onClick={() => {
                      setSortDropdownOpen(false);
                      setCohortDropdownOpen(false);
                      setConcernDropdownOpen(false);
                      setStatusDropdownOpen((o) => !o);
                    }}
                    aria-expanded={statusDropdownOpen}
                    aria-haspopup="listbox"
                    aria-label="Status filter"
                  >
                    <Filter size={16} color="#A3AED0" style={{ flexShrink: 0 }} aria-hidden />
                    <span className="db-sort-by-trigger-prefix">Status:</span>
                    <span className="db-sort-by-trigger-value">
                      {(STATUS_FILTER_OPTIONS.find((o) => o.value === statusFilter) ?? STATUS_FILTER_OPTIONS[0]).label}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`db-sort-by-trigger-icon${statusDropdownOpen ? ' db-sort-by-trigger-icon--open' : ''}`}
                      aria-hidden
                    />
                  </button>
                  {statusDropdownOpen && (
                    <ul className="db-sort-by-menu" role="listbox" aria-label="Status">
                      {STATUS_FILTER_OPTIONS.map((opt) => (
                        <li key={opt.value} role="none">
                          <button
                            type="button"
                            role="option"
                            aria-selected={statusFilter === opt.value}
                            className={`db-sort-by-option${statusFilter === opt.value ? ' db-sort-by-option--active' : ''}`}
                            onClick={() => {
                              setStatusFilter(opt.value);
                              setStatusDropdownOpen(false);
                            }}
                          >
                            {opt.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="db-table-mobile">
              {formError && (
                <div style={{ marginBottom: 12, color: '#dc2626', fontWeight: 600, fontSize: 13 }}>{formError}</div>
              )}
              <table style={{ width: '100%', textAlign: 'left', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#323D4E', color: 'white' }}>
                    {['Full Name', 'Age', 'Gender', 'Contact', 'Primary Concern', 'Clinical status', 'Admission Date', 'Progress (%)', 'Actions'].map((col, i) => (
                      <th key={col} style={{
                        padding: '12px 20px',
                        fontWeight: 500,
                        borderRight: i < 8 ? '1px solid #4B5563' : 'none',
                        whiteSpace: 'nowrap',
                      }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={9} style={{ padding: 20, color: '#64748b' }}>Loading patient records...</td></tr>
                  )}
                  {!loading && filtered.length === 0 && (
                    <tr><td colSpan={9} style={{ padding: 20, color: '#64748b' }}>No patients match this search/filter.</td></tr>
                  )}
                  {!loading && filtered.map((patient) => (
                    <tr key={patient.id} className="db-row" style={{ borderBottom: '1px solid #F4F7FE', transition: 'background 0.15s' }}>
                      <td style={{ padding: '16px 20px', fontWeight: 600, color: '#1B2559' }}>{patient.name}</td>
                      <td style={{ padding: '16px 20px', color: '#707EAE' }}>{patient.age}</td>
                      <td style={{ padding: '16px 20px', color: '#707EAE' }}>{patient.gender}</td>
                      <td style={{ padding: '16px 20px', color: '#707EAE' }}>{patient.contact}</td>
                      <td style={{ padding: '16px 20px', color: '#1B2559' }}>{patient.concern}</td>
                      <td
                        style={{ padding: '16px 20px', minWidth: 148, verticalAlign: 'middle' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {patient.status === 'Discharged' ? (
                          <span
                            style={{ ...getStatusStyle('Discharged'), padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 800, display: 'inline-block' }}
                          >
                            Discharged
                          </span>
                        ) : (
                          <select
                            className="db-sort-select"
                            style={{ maxWidth: 168, fontWeight: 600, width: '100%' }}
                            value={clinicalSelectValue(patient)}
                            disabled={savingId === patient.id}
                            onChange={(e) => void saveQuickClinicalStatus(patient, e.target.value)}
                            aria-label={`Clinical status for ${patient.name}`}
                          >
                            {CLINICAL_STATUS_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td style={{ padding: '16px 20px', color: '#1B2559', fontVariantNumeric: 'tabular-nums' }}>{formatDate(patient.admissionDate)}</td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 72, height: 6, background: '#E9EDF7', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{ width: `${patient.progress}%`, height: '100%', background: getProgressColor(patient), borderRadius: 99 }} />
                          </div>
                          <span style={{ color: '#1B2559', fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 600 }}>{patient.progress}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button className="db-view-btn" onClick={() => setSelectedPatient(patient)}>View</button>
                          <button
                            className="db-edit-btn"
                            onClick={() => {
                              setSelectedPatient(patient);
                              openEditor(patient);
                            }}
                          >
                            <Edit2 size={14} /> Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MOBILE BOTTOM NAV */}
      <div className="db-mobile-only db-mobile-bottom-nav">
        <div className="mob-nav-item" onClick={() => navigate('/admin-dashboard')}>
          <div style={{ padding: 10, borderRadius: 10, display: 'flex' }}>
            <LayoutGrid size={20} color="#A3AED0" />
          </div>
          <span>Dashboard</span>
        </div>
        <div className="mob-nav-item" onClick={() => navigate('/analytics')}>
          <div style={{ padding: 10, borderRadius: 10, display: 'flex' }}>
            <BarChart2 size={20} color="#A3AED0" />
          </div>
          <span>Analytics</span>
        </div>
        <div className="mob-nav-item active" onClick={() => setSelectedPatient(null)}>
          <div style={{ background: '#F54E25', padding: 10, borderRadius: 10, display: 'flex' }}>
            <HeartPulse size={20} color="white" />
          </div>
          <span style={{ color: '#F54E25' }}>Patient Management</span>
        </div>
        <div className="mob-nav-item" onClick={() => navigate('/admin-user-management')}>
          <div style={{ padding: 10, borderRadius: 10, display: 'flex' }}>
            <Users size={20} color="#A3AED0" />
          </div>
          <span>Users</span>
        </div>
        <div className="mob-nav-item" onClick={() => navigate('/admin-staff-management')}>
          <div style={{ padding: 10, borderRadius: 10, display: 'flex' }}>
            <Stethoscope size={20} color="#A3AED0" />
          </div>
          <span>Staff</span>
        </div>
        <div className="mob-nav-item" onClick={() => navigate('/login')}>
          <LogOut size={22} color="#F54E25" />
          <span style={{ color: '#F54E25' }}>Logout</span>
        </div>
      </div>

      {aiModalOpen &&
        createPortal(
          <div
            className="admin-ai-modal-backdrop"
            role="presentation"
            onClick={() => {
              if (!aiLoading) setAiModalOpen(false);
            }}
          >
            <div
              className="admin-ai-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-ai-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="admin-ai-modal-header">
                <div>
                  <h2 id="admin-ai-modal-title" style={{ fontSize: 17, fontWeight: 800, color: '#1B2559', margin: 0 }}>
                    AI care considerations
                    {aiWeekNumber != null ? ` · Week ${aiWeekNumber}` : ''}
                  </h2>
                  <p style={{ fontSize: 12, color: '#64748b', margin: '6px 0 0' }}>
                    For {selectedPatient?.name || 'patient'} — not a substitute for clinical judgment.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!aiLoading) setAiModalOpen(false);
                  }}
                  disabled={aiLoading}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: aiLoading ? 'not-allowed' : 'pointer',
                    padding: 4,
                    color: '#64748b',
                    borderRadius: 8,
                  }}
                  aria-label="Close"
                >
                  <X size={22} />
                </button>
              </div>
              <div className="admin-ai-modal-body">
                {aiLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#64748b' }}>
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        border: '2px solid #E9EDF7',
                        borderTopColor: '#4f46e5',
                        borderRadius: '50%',
                        animation: 'admin-ai-spin 0.7s linear infinite',
                        display: 'inline-block',
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontWeight: 600 }}>Generating recommendations…</span>
                  </div>
                )}
                {!aiLoading && aiError && (
                  <div
                    style={{
                      color: '#b91c1c',
                      fontWeight: 600,
                      fontSize: 14,
                      whiteSpace: 'pre-line',
                      lineHeight: 1.55,
                    }}
                  >
                    {aiError}
                  </div>
                )}
                {!aiLoading && !aiError && aiText && <div>{aiText}</div>}
                {!aiLoading && !aiError && !aiText && (
                  <div style={{ color: '#94a3b8' }}>No content returned.</div>
                )}
              </div>
              <div className="admin-ai-modal-footer">
                Suggestions are generated by AI from available metadata and may be incomplete. Verify before acting; do not use as a sole basis for medical decisions.
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default AdminPatientDatabase;