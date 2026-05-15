import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LayoutGrid, BookUser, LogOut, Search, Filter, User, X, ChevronDown, Users, ClipboardList, ArrowRightSquare, Stethoscope, Sparkles, BedDouble, FileText, MessageCircle, LayoutTemplate, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logoBH from '@/assets/kalingalogo.png';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { resolveAccountRole } from '@/components/RoleGuard';
import { APP_DATA_REFRESH, refreshAppData } from '@/lib/appDataRefresh';
import { computeAdmissionDisplayId } from '@/lib/admissionDischargeStore';
import { fetchWeeklyReportRecommendation } from '@/lib/weeklyReportAi';
import BehaviorProgressBoard, {
  buildBehaviorChecksForStage,
  computeBehaviorBoardProgressPercent,
} from '@/components/admin/BehaviorProgressBoard';
import { loadLadderProfiles, saveLadderProfiles } from '@/lib/recoveryLadderStorage';

const WEEKLY_REPORTS_STORAGE_KEY = 'bh_nurse_weekly_reports';
const ROOM_ASSIGNMENT_STORAGE_KEY = 'bh_patient_room_assignments_v1';
const STAFF_ASSIGNMENT_STORAGE_KEY = 'bh_patient_staff_assignments_v1';
const PROGRESS_GOVERNANCE_STORAGE_KEY = 'bh_patient_progress_governance_v1';
const LOCAL_STAFF_DIRECTORY_KEY = 'bh_staff_directory';

function normalizeLadderChecksFromDb(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const k of Object.keys(raw)) {
    out[k] = !!raw[k];
  }
  return out;
}

function parseProgressTs(iso) {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Merge list `progress` with `nurse_recovery_ladders` and `patients.progress_percent` so admin UI
 * matches what family sees (`progress_percent`), while preferring the newer of ladder vs patient row.
 * @param {Array<Record<string, unknown>>} patients
 * @param {Record<string, { patient_id?: string, current_position?: number, checks?: unknown, updated_at?: string }>} ladderByPatientId
 */
function mergeNurseRecoveryLadderProgress(patients, ladderByPatientId) {
  if (!Array.isArray(patients) || !patients.length || !ladderByPatientId || typeof ladderByPatientId !== 'object') {
    return patients;
  }
  return patients.map((p) => {
    const ladder = ladderByPatientId[String(p.id)];
    if (!ladder) return p;
    const pos = Math.max(1, Math.min(50, Number(ladder.current_position) || 1));
    const rawChecks =
      ladder.checks && typeof ladder.checks === 'object' && !Array.isArray(ladder.checks) ? ladder.checks : {};
    const normalized = normalizeLadderChecksFromDb(rawChecks);
    const hasChecks = Object.keys(normalized).length > 0;
    const checkedState = hasChecks ? normalized : buildBehaviorChecksForStage(pos);
    const fromLadder = Math.min(
      100,
      Math.max(0, Math.round(Number(computeBehaviorBoardProgressPercent(checkedState)) || 0))
    );
    const fromColumn = Math.min(100, Math.max(0, Math.round(Number(p.progress) || 0)));
    const ladderUpdated = ladder.updated_at && String(ladder.updated_at).trim() !== '' ? ladder.updated_at : null;
    const ladderT = parseProgressTs(ladderUpdated);
    const patientT = parseProgressTs(p.progressUpdatedAt);
    let pct;
    let progressUpdatedAt;
    if (ladderT > patientT) {
      pct = fromLadder;
      progressUpdatedAt = ladderUpdated || p.progressUpdatedAt;
    } else if (patientT > ladderT) {
      pct = fromColumn;
      progressUpdatedAt = p.progressUpdatedAt || ladderUpdated;
    } else {
      pct = Math.max(fromColumn, fromLadder);
      progressUpdatedAt = p.progressUpdatedAt || ladderUpdated;
    }
    return {
      ...p,
      progress: pct,
      ...(progressUpdatedAt ? { progressUpdatedAt } : {}),
    };
  });
}

/** Offline / legacy: ladder position in localStorage (no full checks). */
function mergeLocalLadderProfilesProgress(patients) {
  if (!Array.isArray(patients) || !patients.length) return patients;
  const profiles = loadLadderProfiles();
  return patients.map((p) => {
    const prof = profiles[String(p.id)];
    if (!prof || prof.currentPosition == null) return p;
    const pos = Math.max(1, Math.min(50, Number(prof.currentPosition) || 1));
    const pct = Math.min(
      100,
      Math.max(0, Math.round(Number(computeBehaviorBoardProgressPercent(buildBehaviorChecksForStage(pos))) || 0))
    );
    const updatedAt = prof.updatedAt && String(prof.updatedAt).trim() !== '' ? prof.updatedAt : null;
    return {
      ...p,
      progress: pct,
      ...(updatedAt ? { progressUpdatedAt: updatedAt } : {}),
    };
  });
}

/** Editable trajectory while in care. Discharged is derived from `discharged_at` (dashboard discharge approval), not set here. */
const CLINICAL_STATUS_OPTIONS = ['Improving', 'Stable', 'Declining'];
const RISK_LEVEL_OPTIONS = ['Low', 'Moderate', 'High', 'Highly Suicidal'];
const BUNK_LEVEL_OPTIONS = ['Bottom', 'Middle', 'Top'];
const INTERNAL_STAFF_ACCOUNT_TYPES = new Set([
  'admin',
  'nurse',
  'staff',
  'case_manager',
  'case_load_manager',
  'case manager',
  'case load manager',
]);

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

/**
 * Nurse weekly reports concatenate lines into `nurse_note`, including `Food allergies: …`.
 * For the resident card, show that line as Medical history; value prefers DB columns
 * (`patients.medical_history`, `weekly_reports.ongoing_medical_concern`) over the legacy inline text.
 */
const nurseNotesDisplayReplaceFoodAllergiesWithMedicalHistory = (rawNotes, medicalHistoryFromDb) => {
  const mh = String(medicalHistoryFromDb ?? '').trim();
  const lines = String(rawNotes ?? '').split(/\r?\n/);
  const out = lines.map((line) => {
    const m = line.match(/^\s*Food allergies:\s*(.*)$/i);
    if (!m) return line;
    const fallbackInline = String(m[1] ?? '').trim();
    const value = mh || fallbackInline;
    return value ? `Medical history: ${value}` : 'Medical history: —';
  });
  return out.join('\n');
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

const calculateStayDays = (admittedAt, dischargedAt = null) => {
  if (!admittedAt) return null;
  const admitted = new Date(admittedAt);
  if (Number.isNaN(admitted.getTime())) return null;
  const endDate = dischargedAt ? new Date(dischargedAt) : new Date();
  if (Number.isNaN(endDate.getTime())) return null;
  if (endDate < admitted) return 1;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.ceil((endDate - admitted) / MS_PER_DAY));
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
  if (patient.roomCode) return patient.roomCode;
  const n = 200 + (hashPatientId(patient.id) % 56);
  return `Room ${n}`;
};

const normalizeRiskLevel = (raw) => {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'highly suicidal' || s === 'suicidal') return 'Highly Suicidal';
  if (s === 'high') return 'High';
  if (s === 'moderate') return 'Moderate';
  return 'Low';
};

const normalizeBunkLevel = (raw) => {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'bottom') return 'Bottom';
  if (s === 'middle') return 'Middle';
  if (s === 'top') return 'Top';
  return 'Bottom';
};

const validateBedPlacementPolicy = ({ genderSegment, riskLevel, bunkLevel }) => {
  if (!genderSegment) return 'Resident gender is required before saving room assignment.';
  const normalizedRisk = normalizeRiskLevel(riskLevel);
  const normalizedBunk = normalizeBunkLevel(bunkLevel);
  if (normalizedRisk === 'Highly Suicidal' && normalizedBunk === 'Top') {
    return 'Highly suicidal patients cannot be assigned to top bunk. Use bottom or middle bunk.';
  }
  return '';
};

const loadRoomAssignments = () => {
  try {
    const raw = localStorage.getItem(ROOM_ASSIGNMENT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const saveRoomAssignments = (map) => {
  localStorage.setItem(ROOM_ASSIGNMENT_STORAGE_KEY, JSON.stringify(map || {}));
};

const loadStaffAssignments = () => {
  try {
    const raw = localStorage.getItem(STAFF_ASSIGNMENT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const saveStaffAssignments = (map) => {
  localStorage.setItem(STAFF_ASSIGNMENT_STORAGE_KEY, JSON.stringify(map || {}));
};

const loadProgressGovernance = () => {
  try {
    const raw = localStorage.getItem(PROGRESS_GOVERNANCE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const saveProgressGovernance = (map) => {
  localStorage.setItem(PROGRESS_GOVERNANCE_STORAGE_KEY, JSON.stringify(map || {}));
};

const applyRoomAssignmentOverrides = (patients) => {
  const overrides = loadRoomAssignments();
  return (patients || []).map((p) => {
    const ov = overrides[String(p.id)] || null;
    if (!ov) return p;
    return {
      ...p,
      roomCode: ov.roomCode || p.roomCode || '',
      roomGenderSegment: ov.roomGenderSegment || p.roomGenderSegment || '',
      roomPlacementNote: ov.roomPlacementNote || p.roomPlacementNote || '',
      riskLevel: ov.riskLevel || p.riskLevel || 'Low',
      bunkLevel: ov.bunkLevel || p.bunkLevel || 'Bottom',
    };
  });
};

const applyStaffAssignmentOverrides = (patients) => {
  const overrides = loadStaffAssignments();
  return (patients || []).map((p) => {
    const ov = overrides[String(p.id)] || null;
    if (!ov) return p;
    return {
      ...p,
      caseLoadManager: ov.caseLoadManager || p.caseLoadManager || '',
      programStaff: ov.programStaff || p.programStaff || '',
      medicalStaffNote: ov.medicalStaffNote || p.medicalStaffNote || '',
    };
  });
};

const applyProgressGovernanceOverrides = (patients) => {
  const overrides = loadProgressGovernance();
  return (patients || []).map((p) => {
    const ov = overrides[String(p.id)] || null;
    if (!ov) return p;
    return {
      ...p,
      progress: Number.isFinite(Number(ov.progress)) ? Number(ov.progress) : p.progress,
      clinicalStatus: ov.clinicalStatus || p.clinicalStatus || 'Stable',
      progressUpdatedBy: ov.progressUpdatedBy || p.progressUpdatedBy || '',
      progressUpdatedAt: ov.progressUpdatedAt || p.progressUpdatedAt || '',
    };
  });
};

const normalizedRoomSegmentFromGender = (genderRaw) => {
  const g = String(genderRaw || '').trim().toLowerCase();
  if (g === 'male') return 'Male';
  if (g === 'female') return 'Female';
  return '';
};

const makePatientGenderFallbackKey = ({ name, familyId, birthDate }) => {
  return `${String(name || '').trim().toLowerCase()}|${String(familyId || '')}|${String(birthDate || '')}`;
};

const renderAiInline = (text, keyPrefix) => {
  const parts = String(text || '').split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    const isBold = part.startsWith('**') && part.endsWith('**');
    if (!isBold) return <React.Fragment key={`${keyPrefix}-text-${index}`}>{part}</React.Fragment>;
    return <strong key={`${keyPrefix}-bold-${index}`}>{part.slice(2, -2)}</strong>;
  });
};

const renderAiContent = (text) => {
  const lines = String(text || '').split(/\r?\n/);
  const blocks = [];
  let pendingList = [];

  const flushList = () => {
    if (!pendingList.length) return;
    blocks.push({ type: 'list', items: pendingList });
    pendingList = [];
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      return;
    }

    const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      pendingList.push(bulletMatch[1].trim());
      return;
    }

    flushList();
    const cleanLine = line.replace(/^\*\s+\*\*/g, '**');
    const isHeading = /^\*\*[^*]+\*\*:?\s*$/.test(cleanLine);
    blocks.push({ type: isHeading ? 'heading' : 'paragraph', text: cleanLine });
  });

  flushList();

  return blocks.map((block, index) => {
    if (block.type === 'list') {
      return (
        <ul className="admin-ai-list" key={`ai-list-${index}`}>
          {block.items.map((item, itemIndex) => (
            <li key={`ai-list-${index}-item-${itemIndex}`}>{renderAiInline(item, `ai-li-${index}-${itemIndex}`)}</li>
          ))}
        </ul>
      );
    }

    if (block.type === 'heading') {
      return (
        <p className="admin-ai-heading" key={`ai-heading-${index}`}>
          {renderAiInline(block.text, `ai-heading-${index}`)}
        </p>
      );
    }

    return (
      <p className="admin-ai-paragraph" key={`ai-p-${index}`}>
        {renderAiInline(block.text, `ai-p-${index}`)}
      </p>
    );
  });
};

const toUiPatient = (row) => {
  const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const discharged = row.discharged_at != null && String(row.discharged_at).trim() !== '';
  const rawCs = (row.clinical_status && String(row.clinical_status).trim()) || 'Stable';
  const clinicalNorm = CLINICAL_STATUS_OPTIONS.includes(rawCs) ? rawCs : 'Stable';
  const overallStatus = discharged ? 'Discharged' : clinicalNorm;
  return {
    id: row.id,
    admissionDisplayId: computeAdmissionDisplayId(
      { id: row.id, decided_at: row.admitted_at, created_at: row.created_at },
      { id: row.id, admitted_at: row.admitted_at }
    ),
    name: row.full_name || 'Unknown Resident',
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
    stayDays: calculateStayDays(row.admitted_at, row.discharged_at),
    dateOfBirth: row.date_of_birth,
    roomCode: row.room_code || '',
    roomGenderSegment: row.room_gender_segment || '',
    roomPlacementNote: row.room_placement_note || '',
    riskLevel: normalizeRiskLevel(row.risk_level || row.riskLevel),
    bunkLevel: normalizeBunkLevel(row.bunk_level || row.bunkLevel),
    caseLoadManager: row.case_load_manager || '',
    programStaff: row.program_staff || '',
    medicalStaffNote: row.medical_staff_note || '',
    medicalHistory: row.medical_history || '',
    progressUpdatedBy: row.progress_updated_by || row.status_updated_by || '',
    progressUpdatedAt: row.progress_updated_at || row.status_updated_at || '',
    currentWeight: row.current_weight ?? row.weight_kg ?? row.weight ?? '',
    heightCm: row.height_cm ?? row.height ?? '',
    bp: row.bp ?? row.blood_pressure ?? '',
    pr: row.pr ?? row.pulse_rate ?? '',
    rr: row.rr ?? row.respiratory_rate ?? '',
    spo2: row.spo2 ?? row.oxygen_saturation ?? '',
    temperatureF: row.temperature_f ?? row.temperature ?? row.temp_f ?? '',
    bmi: row.bmi ?? '',
  };
};

/** Display label for clinical trajectory (from DB / mapped patient row). */
const clinicalStatusLabel = (patient) => {
  if (!patient) return 'Stable';
  if (patient.status === 'Discharged') return 'Discharged';
  const s = patient.clinicalStatus || patient.status;
  return CLINICAL_STATUS_OPTIONS.includes(s) ? s : 'Stable';
};

/** One row per menu option; admission uses two entries (no duplicate “Admission Date” row). */
const SORT_MENU_ITEMS = [
  { id: 'patient_name', label: 'Resident Name (A to Z)', sortKey: 'Resident Name', direction: 'asc' },
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
    } else if (sortKey === 'Resident Name') {
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

const mapLegacyLocalPatients = () => {
  const legacy = JSON.parse(localStorage.getItem('bh_patients') || '[]');
  return legacy.map((p, idx) => {
    const dischargedAt = p.dischargedAt || (p.status === 'Discharged' ? new Date().toISOString() : null);
    const discharged = dischargedAt != null && String(dischargedAt).trim() !== '';
    const raw = p.status || 'Stable';
    const clinicalNorm = CLINICAL_STATUS_OPTIONS.includes(raw) ? raw : 'Stable';
    const id = String(p.id ?? idx);
    const admissionDate = p.admissionDate || p.admitted_at || null;
    return {
      id,
      admissionDisplayId: computeAdmissionDisplayId(
        { id, decided_at: admissionDate, created_at: admissionDate },
        { id, admitted_at: admissionDate }
      ),
      name: p.name || 'Unknown Resident',
      age: p.age ?? 'N/A',
      gender: p.gender || 'N/A',
      concern: p.concern || p.reason || 'N/A',
      status: discharged ? 'Discharged' : clinicalNorm,
      clinicalStatus: clinicalNorm,
      admissionDate,
      date: p.date || formatDate(p.admissionDate || p.admitted_at),
      progress: p.progress ?? 0,
      contact: p.contact || 'N/A',
      familyName: p.familyName || 'N/A',
      familyId: p.family_id || null,
      dischargedAt,
      stayDays: calculateStayDays(admissionDate, dischargedAt),
      dateOfBirth: p.date_of_birth || null,
      roomCode: p.room_code || p.roomCode || '',
      roomGenderSegment: p.room_gender_segment || p.roomGenderSegment || '',
      roomPlacementNote: p.room_placement_note || p.roomPlacementNote || '',
      riskLevel: normalizeRiskLevel(p.risk_level || p.riskLevel),
      bunkLevel: normalizeBunkLevel(p.bunk_level || p.bunkLevel),
      caseLoadManager: p.case_load_manager || p.caseLoadManager || '',
      programStaff: p.program_staff || p.programStaff || '',
      medicalStaffNote: p.medical_staff_note || p.medicalStaffNote || '',
      medicalHistory: p.medical_history || p.medicalHistory || '',
      progressUpdatedBy: p.progress_updated_by || p.status_updated_by || p.progressUpdatedBy || '',
      progressUpdatedAt: p.progress_updated_at || p.status_updated_at || p.progressUpdatedAt || '',
      currentWeight: p.current_weight ?? p.weight_kg ?? p.currentWeight ?? p.weight ?? '',
      heightCm: p.height_cm ?? p.heightCm ?? p.height ?? '',
      bp: p.bp ?? p.blood_pressure ?? '',
      pr: p.pr ?? p.pulse_rate ?? '',
      rr: p.rr ?? p.respiratory_rate ?? '',
      spo2: p.spo2 ?? p.oxygen_saturation ?? '',
      temperatureF: p.temperature_f ?? p.temperatureF ?? p.temperature ?? p.temp_f ?? '',
      bmi: p.bmi ?? '',
    };
  });
};

function PatientDatabaseShell({ mode = 'admin', staffLimited = false }) {
  const firstNonEmpty = (...values) => {
    for (const v of values) {
      if (v == null) continue;
      const s = typeof v === 'string' ? v.trim() : String(v).trim();
      if (s !== '') return v;
    }
    return '';
  };
  const isNurse = mode === 'nurse';
  const isProgram = mode === 'program';
  const isLimited = isNurse || staffLimited || isProgram;
  const isAdminMode = mode === 'admin' && !staffLimited;
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
  // Default to active/in-care list. Discharged remains viewable via filter selection.
  const [cohortFilter, setCohortFilter] = useState('in_care');
  const [concernCategoryFilter, setConcernCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [weeklyReportsByWeek, setWeeklyReportsByWeek] = useState({});
  const [selectedWeeklyVitalsWeek, setSelectedWeeklyVitalsWeek] = useState(null);
  const [weeklyReportModalOpen, setWeeklyReportModalOpen] = useState(false);
  const [weeklyReportModalWeek, setWeeklyReportModalWeek] = useState(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiWeekNumber, setAiWeekNumber] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiError, setAiError] = useState('');
  const [roomForm, setRoomForm] = useState({
    roomCode: '',
    roomGenderSegment: '',
    roomPlacementNote: '',
    riskLevel: 'Low',
    bunkLevel: 'Bottom',
  });
  const [roomSaving, setRoomSaving] = useState(false);
  const [staffForm, setStaffForm] = useState({ caseLoadManager: '', programStaff: '', medicalStaffNote: '' });
  const [staffSaving, setStaffSaving] = useState(false);
  const [staffAssignmentModalOpen, setStaffAssignmentModalOpen] = useState(false);
  const [staffDirectory, setStaffDirectory] = useState({ caseLoadManagers: [], programStaff: [] });
  const [nurseIdentityNames, setNurseIdentityNames] = useState([]);
  const [behaviorChecklistChecked, setBehaviorChecklistChecked] = useState({});
  const [recoveryLadderPosition, setRecoveryLadderPosition] = useState(1);
  const [recoveryLadderSaveState, setRecoveryLadderSaveState] = useState({
    loading: false,
    error: '',
    ok: false,
  });
  const behaviorRecoveryPercent = useMemo(
    () => computeBehaviorBoardProgressPercent(behaviorChecklistChecked),
    [behaviorChecklistChecked]
  );
  const selectedPatientLadderProgressPct = useMemo(
    () => Math.min(100, Math.max(0, Math.round(Number(behaviorRecoveryPercent) || 0))),
    [behaviorRecoveryPercent]
  );

  const handleRecoveryLadderPositionChange = useCallback((next) => {
    const n = Math.max(1, Math.min(50, Number(next) || 1));
    setRecoveryLadderPosition(n);
    if (!selectedPatient?.id) return;
    const id = String(selectedPatient.id);
    const profiles = loadLadderProfiles();
    profiles[id] = {
      ...(profiles[id] || {}),
      currentPosition: n,
      updatedAt: new Date().toISOString(),
    };
    saveLadderProfiles(profiles);
  }, [selectedPatient?.id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!(isNurse || isProgram) || !isSupabaseConfigured()) {
        if (!cancelled) setNurseIdentityNames([]);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setNurseIdentityNames([]);
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
      if (!cancelled) setNurseIdentityNames(names);
    })();
    return () => {
      cancelled = true;
    };
  }, [isNurse, isProgram]);

  useEffect(() => {
    setStaffAssignmentModalOpen(false);
  }, [selectedPatient?.id]);

  const upsertName = (bucket, name) => {
    const v = String(name || '').trim();
    if (!v) return;
    if (!bucket.some((n) => n.toLowerCase() === v.toLowerCase())) bucket.push(v);
  };

  const syncPatientsLocalCache = (uiRows) => {
    try {
      const rows = Array.isArray(uiRows) ? uiRows : [];
      const compact = rows.map((p) => ({
        id: p.id,
        name: p.name || '',
        full_name: p.name || '',
        primary_concern: p.concern || '',
        concern: p.concern || '',
        admitted_at: p.admissionDate || p.admittedAt || '',
        admissionDate: p.admissionDate || p.admittedAt || '',
        clinical_status: p.clinicalStatus || p.status || 'Admitted',
        status: p.status || p.clinicalStatus || 'Admitted',
        case_load_manager: p.caseLoadManager || '',
        program_staff: p.programStaff || '',
        medical_staff_note: p.medicalStaffNote || '',
        discharged_at: p.status === 'Discharged' ? (p.dischargedAt || new Date().toISOString()) : null,
      }));
      localStorage.setItem('bh_patients', JSON.stringify(compact));
    } catch {
      /* ignore */
    }
  };

  const loadPatients = async () => {
    setLoading(true);
    setFormError('');
    try {
      if (!isSupabaseConfigured()) {
        const merged = applyProgressGovernanceOverrides(
          applyStaffAssignmentOverrides(applyRoomAssignmentOverrides(mapLegacyLocalPatients()))
        );
        const withLadder = mergeLocalLadderProfilesProgress(merged);
        setPatients(withLadder);
        syncPatientsLocalCache(withLadder);
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

      /** @type {Record<string, { patient_id?: string, current_position?: number, checks?: unknown, updated_at?: string }>} */
      const ladderByPatientId = {};
      const { data: ladderRows, error: ladderErr } = await supabase
        .from('nurse_recovery_ladders')
        .select('patient_id, current_position, checks, updated_at');
      if (ladderErr) {
        console.warn('[patient-db] nurse_recovery_ladders list:', ladderErr.message);
      } else {
        (ladderRows || []).forEach((row) => {
          if (row?.patient_id != null) ladderByPatientId[String(row.patient_id)] = row;
        });
      }

      const { data: admissionRows, error: admErr } = await supabase
        .from('admission_requests')
        .select('patient_name, family_id, patient_birth_date, patient_gender, created_at')
        .order('created_at', { ascending: false })
        .limit(10000);
      if (admErr) console.warn('[patient-db] admission gender fallback:', admErr.message);

      const fallbackGenderMap = new Map();
      (admissionRows || []).forEach((r) => {
        const key = makePatientGenderFallbackKey({
          name: r.patient_name,
          familyId: r.family_id,
          birthDate: r.patient_birth_date,
        });
        if (!key || fallbackGenderMap.has(key)) return;
        if (normalizedRoomSegmentFromGender(r.patient_gender)) {
          fallbackGenderMap.set(key, r.patient_gender);
        }
      });

      const fromDb = (data || []).map((row) => {
        const ui = toUiPatient(row);
        const normalized = normalizedRoomSegmentFromGender(ui.gender);
        if (normalized) return ui;
        const key = makePatientGenderFallbackKey({
          name: ui.name,
          familyId: ui.familyId,
          birthDate: ui.dateOfBirth,
        });
        const fallbackGender = fallbackGenderMap.get(key) || '';
        return fallbackGender ? { ...ui, gender: fallbackGender } : ui;
      });
      if (fromDb.length > 0) {
        const merged = applyProgressGovernanceOverrides(
          applyStaffAssignmentOverrides(applyRoomAssignmentOverrides(fromDb))
        );
        const withLadder = mergeNurseRecoveryLadderProgress(merged, ladderByPatientId);
        setPatients(withLadder);
        syncPatientsLocalCache(withLadder);
        return;
      }

      const legacyMapped = mapLegacyLocalPatients();
      if (legacyMapped.length > 0) {
        const merged = applyProgressGovernanceOverrides(
          applyStaffAssignmentOverrides(applyRoomAssignmentOverrides(legacyMapped))
        );
        const withLadder = mergeLocalLadderProfilesProgress(merged);
        setPatients(withLadder);
        syncPatientsLocalCache(withLadder);
        return;
      }

      setPatients([]);
      syncPatientsLocalCache([]);
    } catch (err) {
      console.error(err);
      const legacyMapped = mapLegacyLocalPatients();
      if (legacyMapped.length > 0) {
        const merged = applyProgressGovernanceOverrides(
          applyStaffAssignmentOverrides(applyRoomAssignmentOverrides(legacyMapped))
        );
        const withLadder = mergeLocalLadderProfilesProgress(merged);
        setPatients(withLadder);
        syncPatientsLocalCache(withLadder);
        setFormError(
          `${err.message || 'Failed to load from server.'} Showing locally saved patients.`
        );
      } else {
        setFormError(err.message || 'Failed to load patient records.');
        syncPatientsLocalCache([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadPatientsRef = useRef(loadPatients);
  loadPatientsRef.current = loadPatients;

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
    if (!isSupabaseConfigured()) return undefined;
    let cancelled = false;
    const channel = supabase
      .channel('patient-db-patients-progress-sync')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'patients' },
        () => {
          if (!cancelled) void loadPatientsRef.current();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'nurse_recovery_ladders' },
        () => {
          if (!cancelled) void loadPatientsRef.current();
        }
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
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
    const scopedPatients = isNurse
      ? patients.filter((p) => nurseIdentityNames.includes(String(p.programStaff || '').trim().toLowerCase()))
      : isProgram
        ? patients.filter((p) => nurseIdentityNames.includes(String(p.caseLoadManager || '').trim().toLowerCase()))
        : patients;
    const bySearch = scopedPatients.filter((p) => {
      if (!q) return true;
      return (
        String(p.admissionDisplayId || '').toLowerCase().includes(q) ||
        String(p.name || '').toLowerCase().includes(q) ||
        String(p.concern || '').toLowerCase().includes(q) ||
        String(p.status || '').toLowerCase().includes(q) ||
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
  }, [patients, isNurse, isProgram, nurseIdentityNames, search, sortSelectionId, cohortFilter, concernCategoryFilter, statusFilter]);

  const missingStaffAssignments = useMemo(() => {
    const inCare = (patients || []).filter((p) => String(p.status || '').toLowerCase() !== 'discharged');
    const rows = inCare.filter((p) => !String(p.caseLoadManager || '').trim() || !String(p.programStaff || '').trim());
    return {
      totalInCare: inCare.length,
      missingCount: rows.length,
      names: rows.slice(0, 6).map((p) => p.name),
    };
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

  const isSupabasePatientId = (id) =>
    typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const saveRecoveryLadderProgress = useCallback(async () => {
    if (!selectedPatient?.id) return;
    const id = String(selectedPatient.id);
    const pctRounded = Math.min(
      100,
      Math.max(0, Math.round(Number(computeBehaviorBoardProgressPercent(behaviorChecklistChecked)) || 0))
    );
    setRecoveryLadderSaveState({ loading: true, error: '', ok: false });
    try {
      const checksPayload = normalizeLadderChecksFromDb(behaviorChecklistChecked);

      if (isSupabaseConfigured() && isSupabasePatientId(id)) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const payload = {
          patient_id: id,
          current_position: recoveryLadderPosition,
          checks: checksPayload,
          updated_at: new Date().toISOString(),
        };
        if (user?.id) payload.updated_by = user.id;
        const { error: ladderErr } = await supabase
          .from('nurse_recovery_ladders')
          .upsert(payload, { onConflict: 'patient_id' });
        if (ladderErr) throw ladderErr;

        const patientPatch = {
          progress_percent: pctRounded,
          progress_updated_at: new Date().toISOString(),
        };
        if (user?.id) patientPatch.progress_updated_by = user.id;
        const { data: updatedPatientRows, error: patientErr } = await supabase
          .from('patients')
          .update(patientPatch)
          .eq('id', id)
          .select('id, progress_percent');
        if (patientErr) {
          throw new Error(
            patientErr.message
              || 'Could not update patients.progress_percent (family dashboard reads this column). Check patients RLS for staff UPDATE.'
          );
        }
        if (!updatedPatientRows?.length) {
          throw new Error(
            'Recovery ladder saved, but patients row was not updated (0 rows). Usually RLS on public.patients blocks UPDATE for your role, or the id does not exist. Family dashboards read progress_percent from patients — add/fix an UPDATE policy for nurse/program/admin.'
          );
        }
      }

      const profiles = loadLadderProfiles();
      profiles[id] = {
        ...(profiles[id] || {}),
        currentPosition: recoveryLadderPosition,
        updatedAt: new Date().toISOString(),
      };
      saveLadderProfiles(profiles);

      const nowIso = new Date().toISOString();
      setSelectedPatient((prev) =>
        prev && String(prev.id) === id ? { ...prev, progress: pctRounded, progressUpdatedAt: nowIso } : prev
      );
      setPatients((prev) =>
        prev.map((p) => (String(p.id) === id ? { ...p, progress: pctRounded, progressUpdatedAt: nowIso } : p))
      );

      refreshAppData();
      setRecoveryLadderSaveState({ loading: false, error: '', ok: true });
      window.setTimeout(() => setRecoveryLadderSaveState((s) => ({ ...s, ok: false })), 4000);
    } catch (e) {
      console.error(e);
      setRecoveryLadderSaveState({
        loading: false,
        error: e?.message || 'Failed to save recovery ladder.',
        ok: false,
      });
    }
  }, [selectedPatient, behaviorChecklistChecked, recoveryLadderPosition]);

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
        let { data, error } = await supabase
          .from('weekly_reports')
          .select('week_number, nurse_name, report_date, submitted_at, summary, nurse_note, notes, behavior_observation, recommendations, progress_percent, current_medications, medication_intervention, ongoing_medical_concern, created_at, vitals_weight, vitals_height, vitals_bmi, vitals_bp, vitals_pr, vitals_rr, vitals_spo2, vitals_temperature')
          .eq('patient_id', pid);
        if (error && /column .* does not exist/i.test(String(error.message || ''))) {
          ({ data, error } = await supabase
            .from('weekly_reports')
            .select('week_number, nurse_name, report_date, submitted_at, created_at')
            .eq('patient_id', pid));
        }
        if (!error && data) {
          for (const row of data) {
            map[row.week_number] = row;
          }
        }
      }

      // Always merge local nurse weekly cache as fallback, even in Supabase mode.
      try {
        const raw = localStorage.getItem(WEEKLY_REPORTS_STORAGE_KEY);
        const all = raw ? JSON.parse(raw) : {};
        const byWeek = all[pidStr] || {};
        for (const w of Object.keys(byWeek)) {
          const n = parseInt(w, 10);
          const e = byWeek[w];
          if (!Number.isNaN(n) && e && typeof e === 'object') {
            const localRow = {
              week_number: n,
              nurse_name: e.nurseName ?? e.nurse_name,
              report_date: e.reportDate ?? e.report_date,
              submitted_at: e.submittedAt ?? e.submitted_at,
              summary: e.summary ?? e.report_summary ?? '',
              nurse_note: e.nurseNote ?? e.nurse_note ?? e.notes ?? '',
              notes: e.notes ?? '',
              behavior_observation: e.behaviorObservation ?? e.behavior_observation ?? '',
              recommendations: e.recommendations ?? e.plan_next_week ?? '',
              current_medications: e.currentMedications ?? e.current_medications ?? '',
              medication_intervention: e.medicationIntervention ?? e.medication_intervention ?? '',
              ongoing_medical_concern: e.ongoingMedicalConcern ?? e.ongoing_medical_concern ?? '',
              progress_percent: e.progressPercent ?? e.progress_percent ?? null,
              vitals_weight: e.vitalsWeight ?? e.vitals_weight ?? null,
              vitals_height: e.vitalsHeight ?? e.vitals_height ?? null,
              vitals_bmi: e.vitalsBmi ?? e.vitals_bmi ?? null,
              vitals_bp: e.vitalsBp ?? e.vitals_bp ?? null,
              vitals_pr: e.vitalsPr ?? e.vitals_pr ?? null,
              vitals_rr: e.vitalsRr ?? e.vitals_rr ?? null,
              vitals_spo2: e.vitalsSpo2 ?? e.vitals_spo2 ?? null,
              vitals_temperature: e.vitalsTemperature ?? e.vitals_temperature ?? null,
              created_at: e.createdAt ?? e.created_at ?? null,
            };
            if (map[n]) {
              map[n] = {
                ...map[n],
                nurse_name: firstNonEmpty(map[n].nurse_name, localRow.nurse_name),
                report_date: firstNonEmpty(map[n].report_date, localRow.report_date),
                submitted_at: firstNonEmpty(map[n].submitted_at, localRow.submitted_at),
                summary: firstNonEmpty(map[n].summary, localRow.summary),
                nurse_note: firstNonEmpty(map[n].nurse_note, localRow.nurse_note),
                notes: firstNonEmpty(map[n].notes, localRow.notes),
                behavior_observation: firstNonEmpty(map[n].behavior_observation, localRow.behavior_observation),
                recommendations: firstNonEmpty(map[n].recommendations, localRow.recommendations),
                current_medications: firstNonEmpty(map[n].current_medications, localRow.current_medications),
                medication_intervention: firstNonEmpty(map[n].medication_intervention, localRow.medication_intervention),
                ongoing_medical_concern: firstNonEmpty(map[n].ongoing_medical_concern, localRow.ongoing_medical_concern),
                progress_percent: firstNonEmpty(map[n].progress_percent, localRow.progress_percent),
                vitals_weight: firstNonEmpty(map[n].vitals_weight, localRow.vitals_weight),
                vitals_height: firstNonEmpty(map[n].vitals_height, localRow.vitals_height),
                vitals_bmi: firstNonEmpty(map[n].vitals_bmi, localRow.vitals_bmi),
                vitals_bp: firstNonEmpty(map[n].vitals_bp, localRow.vitals_bp),
                vitals_pr: firstNonEmpty(map[n].vitals_pr, localRow.vitals_pr),
                vitals_rr: firstNonEmpty(map[n].vitals_rr, localRow.vitals_rr),
                vitals_spo2: firstNonEmpty(map[n].vitals_spo2, localRow.vitals_spo2),
                vitals_temperature: firstNonEmpty(map[n].vitals_temperature, localRow.vitals_temperature),
              };
            } else {
              map[n] = localRow;
            }
          }
        }
      } catch {
        /* ignore */
      }
      if (!cancelled) setWeeklyReportsByWeek(map);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedPatient?.id]);

  useEffect(() => {
    if (!selectedPatient?.id) {
      setRecoveryLadderPosition(1);
      setBehaviorChecklistChecked({});
      return;
    }
    const id = String(selectedPatient.id);
    let cancelled = false;

    const applyLocalFallback = () => {
      const profiles = loadLadderProfiles();
      const p = profiles[id];
      const pos = Math.max(1, Math.min(50, Number(p?.currentPosition) || 1));
      setRecoveryLadderPosition(pos);
      setBehaviorChecklistChecked(buildBehaviorChecksForStage(pos));
    };

    void (async () => {
      if (isSupabaseConfigured() && isSupabasePatientId(id)) {
        const { data: row, error } = await supabase
          .from('nurse_recovery_ladders')
          .select('current_position, checks')
          .eq('patient_id', id)
          .maybeSingle();
        if (cancelled) return;
        if (!error && row) {
          const pos = Math.max(1, Math.min(50, Number(row.current_position) || 1));
          const rawChecks =
            row.checks && typeof row.checks === 'object' && !Array.isArray(row.checks) ? row.checks : {};
          const normalized = normalizeLadderChecksFromDb(rawChecks);
          const hasChecks = Object.keys(normalized).length > 0;
          setRecoveryLadderPosition(pos);
          setBehaviorChecklistChecked(hasChecks ? normalized : buildBehaviorChecksForStage(pos));
          return;
        }
      }
      if (cancelled) return;
      applyLocalFallback();
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedPatient?.id]);

  useEffect(() => {
    setRecoveryLadderSaveState({ loading: false, error: '', ok: false });
  }, [selectedPatient?.id]);

  useEffect(() => {
    if (!selectedPatient) {
      setRoomForm({ roomCode: '', roomGenderSegment: '', roomPlacementNote: '', riskLevel: 'Low', bunkLevel: 'Bottom' });
      setStaffForm({ caseLoadManager: '', programStaff: '', medicalStaffNote: '' });
      return;
    }
    const autoSegment = normalizedRoomSegmentFromGender(selectedPatient.gender);
    setRoomForm({
      roomCode: selectedPatient.roomCode || '',
      roomGenderSegment: autoSegment || selectedPatient.roomGenderSegment || '',
      roomPlacementNote: selectedPatient.roomPlacementNote || '',
      riskLevel: normalizeRiskLevel(selectedPatient.riskLevel),
      bunkLevel: normalizeBunkLevel(selectedPatient.bunkLevel),
    });
    setStaffForm({
      caseLoadManager: selectedPatient.caseLoadManager || '',
      programStaff: selectedPatient.programStaff || '',
      medicalStaffNote: selectedPatient.medicalStaffNote || '',
    });
  }, [selectedPatient]);

  useEffect(() => {
    const isNurseAccount = (accountRaw) => String(accountRaw || '').trim().toLowerCase().includes('nurse');
    const isStaffAccount = (accountRaw) => {
      const account = String(accountRaw || '').trim().toLowerCase();
      return account.includes('staff') || account === 'clinic' || account.includes('clinic') || account.includes('case');
    };

    const classifyByAccountAccess = (accountRaw, roleLabelRaw) => {
      const roleLabel = String(roleLabelRaw || '').trim().toLowerCase();
      const isNurse = isNurseAccount(accountRaw) || roleLabel.includes('nurse');
      const isCaseLoad = (isStaffAccount(accountRaw) || roleLabel.includes('case load manager')) && !isNurse;
      return { isCaseLoad, isNurse };
    };

    const fromLocalStaffDirectory = () => {
      const clm = [];
      const program = [];
      try {
        const raw = localStorage.getItem(LOCAL_STAFF_DIRECTORY_KEY);
        const list = raw ? JSON.parse(raw) : [];
        (Array.isArray(list) ? list : []).forEach((row) => {
          const name = String(row?.full_name || row?.name || '').trim();
          const account = String(
            row?.account_type
            || row?.roleRaw
            || row?.role
            || row?.raw?.account_type
            || row?.raw?.role
            || ''
          );
          const roleLabel = String(
            row?.roleLabel
            || row?.role_label
            || row?.department
            || row?.raw?.department
            || ''
          );
          const { isCaseLoad, isNurse } = classifyByAccountAccess(account, roleLabel);
          if (!name) return;
          const normalizedAccount = String(account || '').trim().toLowerCase();
          const isInternal = INTERNAL_STAFF_ACCOUNT_TYPES.has(normalizedAccount) || isStaffAccount(normalizedAccount) || isCaseLoad || isNurse;
          if (!isInternal) return;
          if (isCaseLoad) upsertName(clm, name);
          if (isNurse) upsertName(program, name);
        });
      } catch {
        /* ignore */
      }
      return { clm, program };
    };

    const fallbackFromPatients = () => {
      const clm = [];
      const program = [];
      (patients || []).forEach((p) => {
        upsertName(clm, p.caseLoadManager);
        upsertName(program, p.programStaff);
      });
      const local = fromLocalStaffDirectory();
      local.clm.forEach((n) => upsertName(clm, n));
      local.program.forEach((n) => upsertName(program, n));
      return {
        caseLoadManagers: clm.sort((a, b) => a.localeCompare(b)),
        programStaff: program.sort((a, b) => a.localeCompare(b)),
      };
    };

    let cancelled = false;
    void (async () => {
      if (!isSupabaseConfigured()) {
        if (!cancelled) setStaffDirectory(fallbackFromPatients());
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('*');
      if (cancelled) return;
      const clm = [];
      const program = [];
      if (!error && Array.isArray(data)) {
        data.forEach((row) => {
          const name = String(row?.full_name || row?.name || '').trim();
          const role = String(row?.account_type || row?.role || '').trim();
          const roleLabel = String(row?.department || row?.role_label || '').trim();
          const { isCaseLoad, isNurse } = classifyByAccountAccess(role, roleLabel);
          const roleNorm = String(role || '').toLowerCase();
          if (!name || (!INTERNAL_STAFF_ACCOUNT_TYPES.has(roleNorm) && !isStaffAccount(roleNorm) && !isNurseAccount(roleNorm))) return;
          if (isCaseLoad) upsertName(clm, name);
          if (isNurse) upsertName(program, name);
        });
      }
      const fallback = fallbackFromPatients();
      fallback.caseLoadManagers.forEach((n) => upsertName(clm, n));
      fallback.programStaff.forEach((n) => upsertName(program, n));
      // Emergency fallback: if categorization still yields nothing but we do have profiles,
      // expose internal names so assignment is never blocked.
      if (clm.length === 0 && Array.isArray(data)) {
        data.forEach((row) => {
          const name = String(row?.full_name || row?.name || '').trim();
          const roleNorm = String(row?.account_type || row?.role || '').toLowerCase();
          if (name && (INTERNAL_STAFF_ACCOUNT_TYPES.has(roleNorm) || roleNorm.includes('staff') || roleNorm.includes('case'))) {
            upsertName(clm, name);
          }
        });
      }
      if (program.length === 0 && Array.isArray(data)) {
        data.forEach((row) => {
          const name = String(row?.full_name || row?.name || '').trim();
          const roleNorm = String(row?.account_type || row?.role || '').toLowerCase();
          if (name && roleNorm.includes('nurse')) upsertName(program, name);
        });
      }
      setStaffDirectory({
        caseLoadManagers: clm.sort((a, b) => a.localeCompare(b)),
        programStaff: program.sort((a, b) => a.localeCompare(b)),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [patients]);

  const clmOptions = useMemo(() => {
    const list = [...(staffDirectory.caseLoadManagers || [])];
    upsertName(list, staffForm.caseLoadManager);
    return list.sort((a, b) => a.localeCompare(b));
  }, [staffDirectory.caseLoadManagers, staffForm.caseLoadManager]);

  const programOptions = useMemo(() => {
    const list = [...(staffDirectory.programStaff || [])];
    upsertName(list, staffForm.programStaff);
    return list.sort((a, b) => a.localeCompare(b));
  }, [staffDirectory.programStaff, staffForm.programStaff]);

  const saveRoomAssignment = async () => {
    if (!selectedPatient?.id || isLimited) return;
    const autoSegment = normalizedRoomSegmentFromGender(selectedPatient.gender);
    if (!autoSegment) {
      setFormError('Resident gender is required before saving room assignment.');
      return;
    }
    if (!roomForm.roomCode.trim()) {
      setFormError('Room code is required.');
      return;
    }
    const policyError = validateBedPlacementPolicy({
      genderSegment: autoSegment,
      riskLevel: roomForm.riskLevel,
      bunkLevel: roomForm.bunkLevel,
    });
    if (policyError) {
      setFormError(policyError);
      return;
    }

    setFormError('');
    setRoomSaving(true);
    const payload = {
      roomCode: roomForm.roomCode.trim(),
      roomGenderSegment: autoSegment,
      roomPlacementNote: roomForm.roomPlacementNote.trim(),
      riskLevel: normalizeRiskLevel(roomForm.riskLevel),
      bunkLevel: normalizeBunkLevel(roomForm.bunkLevel),
      updatedAt: new Date().toISOString(),
    };

    try {
      if (isSupabaseConfigured() && isSupabasePatientId(selectedPatient.id)) {
        const { error } = await supabase
          .from('patients')
          .update({
            room_code: payload.roomCode,
            room_gender_segment: payload.roomGenderSegment || null,
            room_placement_note: payload.roomPlacementNote || null,
            risk_level: payload.riskLevel || null,
            bunk_level: payload.bunkLevel || null,
          })
          .eq('id', selectedPatient.id);
        if (error) {
          console.warn('[patient-db] room assignment db update skipped:', error.message);
        }
      }

      const overrides = loadRoomAssignments();
      overrides[String(selectedPatient.id)] = payload;
      saveRoomAssignments(overrides);

      setPatients((prev) => prev.map((p) => (
        String(p.id) === String(selectedPatient.id)
          ? {
              ...p,
              roomCode: payload.roomCode,
              roomGenderSegment: payload.roomGenderSegment,
              roomPlacementNote: payload.roomPlacementNote,
              riskLevel: payload.riskLevel,
              bunkLevel: payload.bunkLevel,
            }
          : p
      )));
      setSelectedPatient((prev) => (
        prev
          ? {
              ...prev,
              roomCode: payload.roomCode,
              roomGenderSegment: payload.roomGenderSegment,
              roomPlacementNote: payload.roomPlacementNote,
              riskLevel: payload.riskLevel,
              bunkLevel: payload.bunkLevel,
            }
          : prev
      ));

      refreshAppData();
      setFormError('');
    } catch (e) {
      console.error(e);
      setFormError(e.message || 'Failed to save room assignment.');
    } finally {
      setRoomSaving(false);
    }
  };

  const saveStaffAssignment = async () => {
    if (!selectedPatient?.id || isLimited) return;
    const caseLoadManager = String(staffForm.caseLoadManager || '').trim();
    const programStaff = String(staffForm.programStaff || '').trim();
    const medicalStaffNote = String(staffForm.medicalStaffNote || '').trim();
    if (!caseLoadManager || !programStaff) {
      setFormError('Program and Nurse are required.');
      return;
    }
    setFormError('');
    setStaffSaving(true);
    const payload = {
      caseLoadManager,
      programStaff,
      medicalStaffNote,
      updatedAt: new Date().toISOString(),
    };

    try {
      if (isSupabaseConfigured() && isSupabasePatientId(selectedPatient.id)) {
        const { error } = await supabase
          .from('patients')
          .update({
            case_load_manager: payload.caseLoadManager,
            program_staff: payload.programStaff,
            medical_staff_note: payload.medicalStaffNote || null,
          })
          .eq('id', selectedPatient.id);
        if (error) {
          throw new Error(`Staff assignment database update failed: ${error.message}`);
        }
      }

      const overrides = loadStaffAssignments();
      overrides[String(selectedPatient.id)] = payload;
      saveStaffAssignments(overrides);

      setPatients((prev) => {
        const next = prev.map((p) => (
          String(p.id) === String(selectedPatient.id)
            ? { ...p, caseLoadManager, programStaff, medicalStaffNote }
            : p
        ));
        syncPatientsLocalCache(next);
        return next;
      });
      setSelectedPatient((prev) => (prev
        ? { ...prev, caseLoadManager, programStaff, medicalStaffNote }
        : prev));
      refreshAppData();
      setStaffAssignmentModalOpen(false);
    } catch (e) {
      console.error(e);
      setFormError(e.message || 'Failed to save staff assignment.');
    } finally {
      setStaffSaving(false);
    }
  };

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
        `Resident: ${selectedPatient.name}`,
        `Age: ${selectedPatient.age}`,
        `Primary concern: ${selectedPatient.concern}`,
        `Clinical status: ${selectedPatient.clinicalStatus || selectedPatient.status}`,
        `Progress (recovery ladder): ${selectedPatientLadderProgressPct}%`,
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
    [selectedPatient, weeklyReportsByWeek, selectedPatientLadderProgressPct]
  );

  const openWeeklyReportModal = useCallback((weekNum) => {
    setSelectedWeeklyVitalsWeek(weekNum);
    setWeeklyReportModalWeek(weekNum);
    setWeeklyReportModalOpen(true);
  }, []);
  const weeklyReportModalRow = weeklyReportModalWeek != null ? weeklyReportsByWeek[weeklyReportModalWeek] : null;
  const latestWeeklyReport = useMemo(() => {
    const rows = Object.values(weeklyReportsByWeek || {}).filter(Boolean);
    if (!rows.length) return null;
    return rows.sort((a, b) => {
      const at = new Date(a.submitted_at || a.created_at || 0).getTime();
      const bt = new Date(b.submitted_at || b.created_at || 0).getTime();
      if (at !== bt) return bt - at;
      return (Number(b.week_number) || 0) - (Number(a.week_number) || 0);
    })[0];
  }, [weeklyReportsByWeek]);
  const latestAssignedNurse = String(
    selectedPatient?.programStaff
    || selectedPatient?.assignedNurse
    || latestWeeklyReport?.nurse_name
    || ''
  ).trim();
  const latestWeeklyRows = useMemo(() => {
    const rows = Object.values(weeklyReportsByWeek || {}).filter(Boolean);
    return rows.sort((a, b) => {
      const at = new Date(a.submitted_at || a.created_at || 0).getTime();
      const bt = new Date(b.submitted_at || b.created_at || 0).getTime();
      if (at !== bt) return bt - at;
      return (Number(b.week_number) || 0) - (Number(a.week_number) || 0);
    });
  }, [weeklyReportsByWeek]);
  /** Weeks 1–7 that have a nurse weekly report (empty weeks are hidden in the UI). */
  const weekNumbersWithReports = useMemo(
    () => [1, 2, 3, 4, 5, 6, 7].filter((w) => Boolean(weeklyReportsByWeek[w])),
    [weeklyReportsByWeek],
  );
  const effectiveVitalsRow = useMemo(() => {
    if (selectedWeeklyVitalsWeek != null && weeklyReportsByWeek[selectedWeeklyVitalsWeek]) {
      return weeklyReportsByWeek[selectedWeeklyVitalsWeek];
    }
    return latestWeeklyRows[0] || null;
  }, [selectedWeeklyVitalsWeek, weeklyReportsByWeek, latestWeeklyRows]);
  const localWeeklyVitals = useMemo(() => {
    if (!selectedPatient?.id) return null;
    try {
      const raw = localStorage.getItem(WEEKLY_REPORTS_STORAGE_KEY);
      const all = raw ? JSON.parse(raw) : {};
      const byWeek = all[String(selectedPatient.id)] || {};
      if (selectedWeeklyVitalsWeek != null && byWeek[String(selectedWeeklyVitalsWeek)]) {
        return byWeek[String(selectedWeeklyVitalsWeek)];
      }
      const entries = Object.entries(byWeek)
        .map(([w, row]) => ({ week: Number(w), row }))
        .filter((x) => Number.isFinite(x.week) && x.row && typeof x.row === 'object')
        .sort((a, b) => b.week - a.week);
      return entries[0]?.row || null;
    } catch {
      return null;
    }
  }, [selectedPatient?.id, selectedWeeklyVitalsWeek]);
  const latestVitals = useMemo(() => ({
    weight: firstNonEmpty(
      effectiveVitalsRow?.vitals_weight,
      localWeeklyVitals?.vitalsWeight,
      localWeeklyVitals?.vitals_weight,
      selectedPatient?.currentWeight,
      selectedPatient?.current_weight,
      selectedPatient?.weight_kg,
      selectedPatient?.weight
    ),
    height: firstNonEmpty(
      effectiveVitalsRow?.vitals_height,
      localWeeklyVitals?.vitalsHeight,
      localWeeklyVitals?.vitals_height,
      selectedPatient?.heightCm,
      selectedPatient?.height_cm,
      selectedPatient?.height
    ),
    bp: firstNonEmpty(
      effectiveVitalsRow?.vitals_bp,
      localWeeklyVitals?.vitalsBp,
      localWeeklyVitals?.vitals_bp,
      selectedPatient?.bp,
      selectedPatient?.blood_pressure
    ),
    pr: firstNonEmpty(
      effectiveVitalsRow?.vitals_pr,
      localWeeklyVitals?.vitalsPr,
      localWeeklyVitals?.vitals_pr,
      selectedPatient?.pr,
      selectedPatient?.pulse_rate
    ),
    rr: firstNonEmpty(
      effectiveVitalsRow?.vitals_rr,
      localWeeklyVitals?.vitalsRr,
      localWeeklyVitals?.vitals_rr,
      selectedPatient?.rr,
      selectedPatient?.respiratory_rate
    ),
    temperature: firstNonEmpty(
      effectiveVitalsRow?.vitals_temperature,
      localWeeklyVitals?.vitalsTemperature,
      localWeeklyVitals?.vitals_temperature,
      selectedPatient?.temperatureF,
      selectedPatient?.temperature_f,
      selectedPatient?.temperature
    ),
    bmi: firstNonEmpty(
      effectiveVitalsRow?.vitals_bmi,
      localWeeklyVitals?.vitalsBmi,
      localWeeklyVitals?.vitals_bmi,
      selectedPatient?.bmi
    ),
    spo2: firstNonEmpty(
      effectiveVitalsRow?.vitals_spo2,
      localWeeklyVitals?.vitalsSpo2,
      localWeeklyVitals?.vitals_spo2,
      selectedPatient?.spo2,
      selectedPatient?.oxygen_saturation
    ),
  }), [effectiveVitalsRow, localWeeklyVitals, selectedPatient]);
  const weeklyClinicalSnapshot = useMemo(() => {
    const rawNurseNotes = firstNonEmpty(
      effectiveVitalsRow?.nurse_note,
      effectiveVitalsRow?.notes,
      localWeeklyVitals?.nurseNote,
      localWeeklyVitals?.nurse_note,
      localWeeklyVitals?.notes
    );
    const medicalHistoryDb = firstNonEmpty(
      selectedPatient?.medicalHistory,
      effectiveVitalsRow?.ongoing_medical_concern,
      localWeeklyVitals?.ongoingMedicalConcern,
      localWeeklyVitals?.ongoing_medical_concern
    );
    return {
      currentMedications: firstNonEmpty(
        effectiveVitalsRow?.current_medications,
        localWeeklyVitals?.currentMedications,
        localWeeklyVitals?.current_medications
      ),
      nurseNotes: nurseNotesDisplayReplaceFoodAllergiesWithMedicalHistory(rawNurseNotes, medicalHistoryDb),
      behavior: firstNonEmpty(
        effectiveVitalsRow?.behavior_observation,
        localWeeklyVitals?.behaviorObservation,
        localWeeklyVitals?.behavior_observation
      ),
      recommendations: firstNonEmpty(
        effectiveVitalsRow?.recommendations,
        localWeeklyVitals?.recommendations
      ),
    };
  }, [effectiveVitalsRow, localWeeklyVitals, selectedPatient?.medicalHistory]);
  const formatVitalValue = (value) => {
    const text = String(value ?? '').trim();
    return text || '—';
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
        .view-top-clinical-scroll {
          max-height: 88px;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          font-variant-numeric: tabular-nums;
        }
        /* Light, high-contrast form controls (readable in dark OS / forced color themes) */
        .db-field-input,
        .db-field-textarea {
          box-sizing: border-box;
          width: 100%;
          background: #ffffff !important;
          color: #0f172a !important;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 12px;
          font-family: inherit;
          color-scheme: light;
        }
        .db-field-input::placeholder,
        .db-field-textarea::placeholder {
          color: #94a3b8;
          opacity: 1;
        }
        .db-field-input:read-only,
        .db-field-textarea:read-only {
          background: #f1f5f9 !important;
          color: #475569 !important;
        }
        select.db-field-input {
          cursor: pointer;
          background-color: #ffffff !important;
        }
        .db-field-textarea {
          resize: vertical;
          min-height: 56px;
          line-height: 1.45;
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
          max-width: 980px;
          width: 100%;
          max-height: min(90vh, 820px);
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
          white-space: normal;
        }
        .admin-ai-content {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .admin-ai-heading {
          margin: 0;
          font-size: 15px;
          line-height: 1.45;
          color: #1e293b;
          font-weight: 700;
        }
        .admin-ai-paragraph {
          margin: 0;
          font-size: 14px;
          line-height: 1.65;
          color: #334155;
        }
        .admin-ai-list {
          margin: 0;
          padding-left: 20px;
          display: grid;
          gap: 8px;
        }
        .admin-ai-list li {
          color: #334155;
          line-height: 1.6;
        }
        .admin-ai-list strong,
        .admin-ai-paragraph strong,
        .admin-ai-heading strong {
          color: #1e293b;
          font-weight: 700;
        }
        .admin-ai-modal-footer {
          padding: 12px 22px 16px;
          border-top: 1px solid #F4F7FE;
          font-size: 11px;
          color: #94a3b8;
          line-height: 1.4;
        }
        .report-row {
          background: #ffffff;
          border: 1px solid #e8eaef;
          border-radius: 10px;
          padding: 10px 12px;
        }
        .report-label {
          font-size: 12px;
          color: #475569;
          font-weight: 700;
          margin-bottom: 6px;
        }
        .report-value {
          color: #1B2559;
          font-size: 13px;
          font-weight: 600;
          line-height: 1.55;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
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
          .db-mobile-bottom-nav { position: fixed; bottom: 0; left: 0; width: 100vw; min-height: 72px; background: white; border-top: 1px solid #F1F1F1; display: flex; justify-content: space-around; align-items: center; flex-wrap: wrap; gap: 4px 2px; padding: 6px 4px calc(6px + env(safe-area-inset-bottom)); z-index: 1000; }
          .mob-nav-item { display: flex; flex-direction: column; align-items: center; font-size: 9px; font-weight: 700; color: #A3AED0; min-width: 0; flex: 1 1 0; max-width: 68px; gap: 2px; }
          .mob-nav-item.active { color: #F54E25; }
          .view-top-row { flex-direction: column !important; gap: 16px !important; }
          .view-program-weekly-tracking-row { grid-template-columns: 1fr !important; }
          .view-card2-status-row { flex-wrap: wrap !important; row-gap: 14px !important; column-gap: 8px !important; }
          .view-card2-status-row > div { flex: 1 1 calc(50% - 8px) !important; min-width: 120px !important; }
          .view-top-vitals-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .view-top-clinical-scroll { max-height: 108px !important; }
          .view-vitals-row { flex-wrap: wrap !important; gap: 12px !important; }
          .view-vitals-row > div { min-width: 45% !important; margin-bottom: 8px !important; }
          .view-weeks-row-scroll {
            flex-wrap: nowrap !important;
            overflow-x: auto !important;
            gap: 12px !important;
            -webkit-overflow-scrolling: touch !important;
            scrollbar-width: thin !important;
            scrollbar-color: #a5b4fc #f1f5f9 !important;
            padding-bottom: 12px !important;
          }
          .view-weeks-row-scroll::-webkit-scrollbar {
            height: 10px !important;
          }
          .view-weeks-row-scroll::-webkit-scrollbar-track {
            background: #f1f5f9 !important;
            border-radius: 999px !important;
            margin: 0 6px !important;
          }
          .view-weeks-row-scroll::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg, #a5b4fc 0%, #818cf8 100%) !important;
            border-radius: 999px !important;
            border: 2px solid #f1f5f9 !important;
          }
          .view-weeks-row-scroll > div { flex: 0 0 auto !important; min-width: 108px !important; width: 112px !important; max-width: none !important; }
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
        .admin-edit-summary-row {
          padding-bottom: 14px;
          border-bottom: 1px solid #F4F7FE;
        }
        .admin-edit-summary-row:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
        .view-program-weekly-tracking-row {
          display: grid;
          grid-template-columns: 1.15fr 1fr;
          gap: 24px;
          align-items: stretch;
        }
        .view-program-weekly-tracking-row > .info-card {
          min-width: 0;
          min-height: 0;
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        .view-weeks-row-scroll {
          display: flex;
          flex-direction: row;
          flex-wrap: nowrap;
          gap: 16px;
          overflow-x: auto;
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
          padding-bottom: 12px;
          margin-bottom: 2px;
          scrollbar-width: thin;
          scrollbar-color: #a5b4fc #f1f5f9;
        }
        .view-weeks-row-scroll::-webkit-scrollbar {
          height: 10px;
        }
        .view-weeks-row-scroll::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 999px;
          margin: 0 6px;
        }
        .view-weeks-row-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #a5b4fc 0%, #818cf8 100%);
          border-radius: 999px;
          border: 2px solid #f1f5f9;
          box-shadow: 0 1px 2px rgba(27, 37, 89, 0.06);
        }
        .view-weeks-row-scroll::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #818cf8 0%, #6366f1 100%);
        }
        .view-weeks-row-scroll > .week-card {
          flex: 0 0 auto;
          width: 124px;
          min-width: 124px;
          max-width: 124px;
        }
      `}</style>

      {/* SIDEBAR */}
      <aside className="desktop-sidebar" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="sidebar-logo-container">
          <img src={logoBH} alt="Kalinga" className="sidebar-logo" />
        </div>

        {isNurse ? (
          <nav className="sidebar-nav-scroll" aria-label="Nurse navigation">
            <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/nurse-dashboard'); }}>
              <LayoutGrid size={22} color="#707EAE" />
              <span className="sidebar-label">Dashboard</span>
            </div>
            <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); setSelectedPatient(null); }}>
              <div style={{ background: '#F54E25', color: '#fff', borderRadius: 12, padding: 10, display: 'flex' }}>
                <Users size={22} color="white" />
              </div>
              <span className="sidebar-label" style={{ color: '#F54E25' }}>Residents</span>
            </div>
            <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/nurse-calendar'); }}>
              <Calendar size={22} color="#707EAE" />
              <span className="sidebar-label">Calendar</span>
            </div>
            <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/nurse-medical-report'); }}>
              <FileText size={22} color="#707EAE" />
              <span className="sidebar-label">Medical Report</span>
            </div>
          </nav>
        ) : isProgram ? (
          <nav className="sidebar-nav-scroll" aria-label="Program navigation">
            <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); setSelectedPatient(null); }}>
              <div style={{ background: '#F54E25', color: '#fff', borderRadius: 12, padding: 10, display: 'flex' }}>
                <Users size={22} color="white" />
              </div>
              <span className="sidebar-label" style={{ color: '#F54E25' }}>Assigned residents</span>
            </div>
            <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/program-calendar'); }}>
              <Calendar size={22} color="#707EAE" />
              <span className="sidebar-label">Calendar</span>
            </div>
            <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/program-weekly-report'); }}>
              <FileText size={22} color="#707EAE" />
              <span className="sidebar-label">Weekly Report</span>
            </div>
          </nav>
        ) : staffLimited ? (
          <nav className="sidebar-nav-scroll" aria-label="Staff navigation">
            <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); setSelectedPatient(null); }}>
              <div className="icon-box active">
                <BookUser size={22} />
              </div>
              <span className="sidebar-label" style={{ color: '#F54E25' }}>Resident records</span>
            </div>
            <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-appointments'); }}>
              <div className="icon-box inactive"><Calendar size={22} /></div>
              <span className="sidebar-label">Appointments</span>
            </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-messages'); }}>
            <div className="icon-box inactive"><MessageCircle size={22} /></div>
            <span className="sidebar-label">Messages</span>
          </div>
            <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-reports'); }}>
              <div className="icon-box inactive"><FileText size={22} /></div>
              <span className="sidebar-label">Printable reports</span>
            </div>
          </nav>
        ) : (
          <nav className="sidebar-nav-scroll" aria-label="Admin navigation">
            <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-dashboard'); }}>
              <div className="icon-box inactive">
                <LayoutGrid size={22} />
              </div>
              <span className="sidebar-label">Dashboard</span>
            </div>

            <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); setSelectedPatient(null); }}>
              <div className="icon-box active">
                <BookUser size={22} />
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
            <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-content-management'); }}>
              <div className="icon-box inactive"><LayoutTemplate size={22} /></div>
              <span className="sidebar-label">Content management</span>
            </div>
            <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-appointments'); }}>
              <div className="icon-box inactive"><Calendar size={22} /></div>
              <span className="sidebar-label">Appointments</span>
            </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-messages'); }}>
            <div className="icon-box inactive"><MessageCircle size={22} /></div>
            <span className="sidebar-label">Messages</span>
          </div>
            <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-reports'); }}>
              <div className="icon-box inactive"><FileText size={22} /></div>
              <span className="sidebar-label">Printable reports</span>
            </div>
          </nav>
        )}

        <div className="sidebar-footer">
          {isProgram ? null : isNurse ? (
            <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/nurseprofile'); }}>
              <User size={22} color="#707EAE" />
              <span className="sidebar-label">Profile</span>
            </div>
          ) : staffLimited ? (
            <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-profile'); }}>
              <div className="icon-box inactive">
                <User size={22} />
              </div>
              <span className="sidebar-label">Profile & Security</span>
            </div>
          ) : (
            <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-profile'); }}>
              <div className="icon-box inactive">
                <User size={22} />
              </div>
              <span className="sidebar-label">Profile & Security</span>
            </div>
          )}
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/login'); }}>
            <LogOut size={22} color="#F54E25" style={{ marginLeft: isExpanded ? '0' : '10px', flexShrink: 0 }} />
            <span className="sidebar-label" style={{ color: '#F54E25' }}>Logout</span>
          </div>
        </div>
      </aside>

      {/* MOBILE TOP BAR */}
      <div className="db-mobile-only db-mobile-top-bar" style={{ padding: '0 20px', height: 64, alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F1F1' }}>
        <img src={logoBH} alt="Kalinga" style={{ height: 32 }} />
        <span style={{ fontSize: 16, fontWeight: 800, color: '#F54E25' }}>{isProgram ? 'Assigned residents' : staffLimited ? 'Resident records' : 'Resident Management'}</span>
        <div style={{ width: 36, height: 36, background: '#F54E25', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>JD</div>
      </div>

      {/* MAIN CONTENT */}
      <main className="db-main">
        {isProgram ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
            <div
              style={{
                padding: '8px 16px',
                borderRadius: 12,
                background: '#FFF7F4',
                border: '1px solid #FED7AA',
                color: '#F54E25',
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              Assigned residents
            </div>
          </div>
        ) : null}
        {/* Header Section */}
        <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1B2559', marginBottom: 4 }}>
              {isProgram ? 'Assigned residents' : staffLimited ? 'Resident records' : 'Resident Management'}
            </h1>
            <p
              onClick={() => selectedPatient && setSelectedPatient(null)}
              style={{
                fontSize: 13,
                color: selectedPatient ? '#4361EE' : '#A3AED0',
                fontWeight: 600,
                cursor: selectedPatient ? 'pointer' : 'default',
              }}
            >
              {selectedPatient ? 'Resident Information' : isProgram ? 'Assigned residents' : 'Resident Management'}
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
            <div className="view-top-row" style={{ display: 'flex', gap: 18, flexDirection: 'row', alignItems: 'stretch' }}>

              {/* Card 1: Basic Info */}
              <div className="info-card" style={{ flex: '1 1 0', minWidth: 0, display: 'flex', gap: 20, padding: '22px' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 84, height: 84, background: '#FF1F1F', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={44} color="white" />
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <p style={{ color: '#A3AED0', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Patient Name</p>
                      <p style={{ fontSize: 20, fontWeight: 800, color: '#1B2559' }}>{selectedPatient.name}</p>
                      <p style={{ color: '#64748b', fontSize: 12, fontWeight: 600, marginTop: 6 }}>
                        Resident ID: <span style={{ color: '#1B2559', fontVariantNumeric: 'tabular-nums' }}>{selectedPatient.admissionDisplayId || '—'}</span>
                      </p>
                    </div>
                    <div style={{ textAlign: 'left', minWidth: '80px' }}>
                      <p style={{ color: '#A3AED0', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Age</p>
                      <p style={{ fontSize: 20, fontWeight: 800, color: '#1B2559' }}>{selectedPatient.age}</p>
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid #F4F7FE', paddingTop: 12, marginTop: 12 }}>
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
                  <div style={{ borderTop: '1px solid #F4F7FE', paddingTop: 12, marginTop: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <p style={{ color: '#A3AED0', fontSize: 12, fontWeight: 600 }}>Progress</p>
                      <p style={{ fontSize: 13, fontWeight: 800, color: '#1B2559' }}>{selectedPatientLadderProgressPct}%</p>
                    </div>
                    <div style={{ width: '100%', height: 16, background: '#E9EDF7', borderRadius: 99, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${selectedPatientLadderProgressPct}%`,
                          height: '100%',
                          background: getProgressColor(selectedPatient),
                          borderRadius: 99,
                        }}
                      />
                    </div>
                    <p style={{ margin: '8px 0 0', fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
                      Recovery ladder (save to sync with resident list and records)
                    </p>
                  </div>
                </div>
              </div>

              {/* Card 2: Status / bed / nurse (+ room assignment; staff assignment opens as overlay) */}
              <div className="info-card" style={{ flex: '1 1 0', minWidth: 0, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 0, position: 'relative', overflow: 'hidden' }}>
                {(() => {
                  const trajectoryLabel =
                    selectedPatient.status === 'Discharged' ? 'Discharged' : selectedPatient.clinicalStatus;
                  const trajectoryStyle = getStatusStyle(
                    selectedPatient.status === 'Discharged' ? 'Discharged' : selectedPatient.clinicalStatus
                  );
                  const nurseNames = Object.values(weeklyReportsByWeek)
                    .map((r) => (r?.nurse_name && String(r.nurse_name).trim()) || '')
                    .filter(Boolean);
                  const assignedNurseDisplay = latestAssignedNurse || nurseNames[0] || '—';
                  const assignedProgramDisplay = String(selectedPatient?.caseLoadManager || '').trim() || '—';
                  return (
                    <>
                      <div className="view-card2-status-row" style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
                        <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
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
                            paddingLeft: 10,
                            paddingRight: 10,
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
                        <div
                          style={{
                            flex: 1,
                            minWidth: 0,
                            paddingLeft: 10,
                            paddingRight: 10,
                            borderLeft: '1px solid #F4F7FE',
                          }}
                        >
                          <p style={{ color: '#A3AED0', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Program</p>
                          <p style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', lineHeight: 1.3 }}>
                            {assignedProgramDisplay}
                          </p>
                        </div>
                        <div style={{ flex: 1, minWidth: 0, paddingLeft: 10, borderLeft: '1px solid #F4F7FE' }}>
                          <p style={{ color: '#A3AED0', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Assigned Nurse</p>
                          <p style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', lineHeight: 1.3 }}>
                            {assignedNurseDisplay === '—' ? '—' : assignedNurseDisplay}
                          </p>
                        </div>
                      </div>
                      {isAdminMode && selectedPatient.status !== 'Discharged' ? (
                        <div style={{ borderTop: '1px solid #F4F7FE', marginTop: 14, paddingTop: 14 }}>
                          <p style={{ color: '#475569', fontSize: 12, fontWeight: 800, marginBottom: 10 }}>Room assignment (gender-segregated)</p>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                            <input
                              type="text"
                              className="db-field-input"
                              value={roomForm.roomCode}
                              onChange={(e) => setRoomForm((prev) => ({ ...prev, roomCode: e.target.value }))}
                              placeholder="Room code (e.g., Room 203)"
                            />
                            <input
                              type="text"
                              className="db-field-input"
                              value={normalizedRoomSegmentFromGender(selectedPatient.gender) || roomForm.roomGenderSegment || 'N/A'}
                              readOnly
                              placeholder="Room gender segment"
                            />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                            <select
                              className="db-field-input"
                              value={roomForm.riskLevel}
                              onChange={(e) => setRoomForm((prev) => ({ ...prev, riskLevel: e.target.value }))}
                            >
                              {RISK_LEVEL_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                            <select
                              className="db-field-input"
                              value={roomForm.bunkLevel}
                              onChange={(e) => setRoomForm((prev) => ({ ...prev, bunkLevel: e.target.value }))}
                            >
                              {BUNK_LEVEL_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>{opt} bunk</option>
                              ))}
                            </select>
                          </div>
                          {normalizeRiskLevel(roomForm.riskLevel) === 'Highly Suicidal' && normalizeBunkLevel(roomForm.bunkLevel) === 'Top' ? (
                            <p style={{ color: '#B91C1C', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
                              Policy warning: Highly suicidal residents cannot use top bunk.
                            </p>
                          ) : null}
                          <textarea
                            className="db-field-textarea"
                            value={roomForm.roomPlacementNote}
                            onChange={(e) => setRoomForm((prev) => ({ ...prev, roomPlacementNote: e.target.value }))}
                            placeholder="Condition-based placement note (required in policy)."
                            rows={2}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => {
                                setFormError('');
                                setStaffAssignmentModalOpen(true);
                              }}
                              style={{
                                background: '#fff',
                                color: '#0F766E',
                                border: '2px solid #0F766E',
                                borderRadius: 8,
                                padding: '8px 14px',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Staff assignment
                            </button>
                            <button
                              type="button"
                              onClick={saveRoomAssignment}
                              disabled={roomSaving}
                              style={{ background: '#F54E25', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: roomSaving ? 'not-allowed' : 'pointer' }}
                            >
                              {roomSaving ? 'Saving...' : 'Save assignment'}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  );
                })()}
                {isAdminMode && selectedPatient.status !== 'Discharged' && staffAssignmentModalOpen ? (
                  <div
                    role="presentation"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      zIndex: 6,
                      background: 'rgba(15, 23, 42, 0.45)',
                      borderRadius: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 14,
                    }}
                    onClick={() => !staffSaving && setStaffAssignmentModalOpen(false)}
                  >
                    <div
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="staff-assignment-nested-title"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: '100%',
                        maxWidth: 420,
                        background: '#fff',
                        borderRadius: 16,
                        border: '1px solid #E9EDF7',
                        boxShadow: '0 16px 40px rgba(27, 37, 89, 0.12)',
                        padding: '18px 18px 16px',
                        maxHeight: 'min(90vh, 100%)',
                        overflowY: 'auto',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                        <div>
                          <h2 id="staff-assignment-nested-title" style={{ fontSize: 15, fontWeight: 800, color: '#1B2559', margin: 0 }}>
                            Staff assignment model (required)
                          </h2>
                          <p style={{ color: '#94A3B8', fontSize: 11, margin: '6px 0 0', lineHeight: 1.45 }}>
                            Per-resident ownership must include Program and Nurse. Medical coverage remains shared across the medical team.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => !staffSaving && setStaffAssignmentModalOpen(false)}
                          style={{ border: 'none', background: 'transparent', cursor: staffSaving ? 'not-allowed' : 'pointer', padding: 4, color: '#64748b', borderRadius: 8, flexShrink: 0 }}
                          aria-label="Close staff assignment"
                        >
                          <X size={20} />
                        </button>
                      </div>
                      {formError ? (
                        <p style={{ color: '#B91C1C', fontSize: 11, fontWeight: 700, margin: '0 0 10px' }}>{formError}</p>
                      ) : null}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <label htmlFor="staff-modal-program" style={{ display: 'block', color: '#A3AED0', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                            Program
                          </label>
                          <select
                            id="staff-modal-program"
                            className="db-field-input"
                            value={staffForm.caseLoadManager}
                            onChange={(e) => setStaffForm((prev) => ({ ...prev, caseLoadManager: e.target.value }))}
                          >
                            <option value="">Select program…</option>
                            {clmOptions.map((name) => (
                              <option key={`clm_${name}`} value={name}>{name}</option>
                            ))}
                          </select>
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <label htmlFor="staff-modal-nurse" style={{ display: 'block', color: '#A3AED0', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                            Nurse
                          </label>
                          <select
                            id="staff-modal-nurse"
                            className="db-field-input"
                            value={staffForm.programStaff}
                            onChange={(e) => setStaffForm((prev) => ({ ...prev, programStaff: e.target.value }))}
                          >
                            <option value="">Select nurse…</option>
                            {programOptions.map((name) => (
                              <option key={`prog_${name}`} value={name}>{name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <input
                        type="text"
                        className="db-field-input"
                        value={staffForm.medicalStaffNote}
                        onChange={(e) => setStaffForm((prev) => ({ ...prev, medicalStaffNote: e.target.value }))}
                        placeholder="Medical coverage note (optional, shared pool)"
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                        <button
                          type="button"
                          onClick={() => !staffSaving && setStaffAssignmentModalOpen(false)}
                          style={{ background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: staffSaving ? 'not-allowed' : 'pointer' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={saveStaffAssignment}
                          disabled={staffSaving}
                          style={{ background: '#0F766E', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: staffSaving ? 'not-allowed' : 'pointer' }}
                        >
                          {staffSaving ? 'Saving...' : 'Save staff model'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Card 3: Vitals + weekly clinical notes — compact; long text scrolls inside cells */}
              <div className="info-card view-top-clinical-card" style={{ flex: '1 1 0', minWidth: 0, padding: '18px 20px', display: 'flex', flexDirection: 'column' }}>
                {(() => {
                  const fieldLabelStyle = {
                    color: '#64748b',
                    fontSize: 11,
                    fontWeight: 600,
                    marginBottom: 4,
                    textTransform: 'uppercase',
                    letterSpacing: '0.045em',
                  };
                  const vitalCell = (label, value) => (
                    <div style={{ minWidth: 0 }}>
                      <p style={fieldLabelStyle}>{label}</p>
                      <p
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: String(value || '').trim() ? '#1B2559' : '#94a3b8',
                          lineHeight: 1.35,
                        }}
                      >
                        {formatVitalValue(value)}
                      </p>
                    </div>
                  );
                  const clinicalCell = (label, value) => {
                    const text = formatVitalValue(value);
                    const has = String(value ?? '').trim() !== '';
                    return (
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={fieldLabelStyle}>{label}</p>
                        <div
                          className="view-top-clinical-scroll"
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: has ? '#334155' : '#94a3b8',
                            lineHeight: 1.5,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                        >
                          {text}
                        </div>
                      </div>
                    );
                  };
                  return (
                    <>
                      <div
                        className="view-top-vitals-grid"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                          gap: '8px 10px',
                          paddingBottom: 10,
                          marginBottom: 10,
                          borderBottom: '1px solid #F4F7FE',
                        }}
                      >
                        {vitalCell('Current Weight', latestVitals.weight)}
                        {vitalCell('Height', latestVitals.height)}
                        {vitalCell('BP', latestVitals.bp)}
                        {vitalCell('PR', latestVitals.pr)}
                        {vitalCell('RR', latestVitals.rr)}
                        {vitalCell('Temperature (°F)', latestVitals.temperature)}
                        {vitalCell('BMI', latestVitals.bmi)}
                        {vitalCell('SPO2', latestVitals.spo2)}
                      </div>
                      <div
                        className="view-vitals-row"
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 10,
                          marginBottom: 10,
                          alignItems: 'flex-start',
                        }}
                      >
                        {clinicalCell('Current medications', weeklyClinicalSnapshot.currentMedications)}
                        {clinicalCell('Nurse Notes', weeklyClinicalSnapshot.nurseNotes)}
                      </div>
                      <div
                        className="view-vitals-row"
                        style={{
                          borderTop: '1px solid #F4F7FE',
                          paddingTop: 10,
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 10,
                          alignItems: 'flex-start',
                        }}
                      >
                        {clinicalCell('Behavior', weeklyClinicalSnapshot.behavior)}
                        {clinicalCell('Recommendations', weeklyClinicalSnapshot.recommendations)}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {isProgram ? (
              <>
                <div className="view-program-weekly-tracking-row">
                  <div className="info-card" style={{ padding: '32px', minWidth: 0 }}>
                    <div style={{ flexShrink: 0, marginBottom: 20 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1B2559' }}>Weekly Progress</h3>
                      <p style={{ fontSize: 12, color: '#64748b', marginTop: 8, marginBottom: 0 }}>
                        Only weeks with a submitted nurse report are shown. Click the AI icon on a card for suggestions based on patient context and that week&apos;s filing data.
                      </p>
                    </div>
                    <div
                      style={{
                        flex: 1,
                        minHeight: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                      }}
                    >
                      {weekNumbersWithReports.length === 0 ? (
                        <p style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, margin: 0, lineHeight: 1.5 }}>
                          No weekly reports have been filed for this resident yet.
                        </p>
                      ) : (
                        <div className="view-weeks-row-scroll">
                          {weekNumbersWithReports.map((w) => {
                            const row = weeklyReportsByWeek[w];
                            return (
                              <div
                                key={w}
                                className="week-card admin-week-card"
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                  setSelectedWeeklyVitalsWeek(w);
                                  openWeeklyReportModal(w);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setSelectedWeeklyVitalsWeek(w);
                                    openWeeklyReportModal(w);
                                  }
                                }}
                                style={{
                                  padding: '24px 10px',
                                  cursor: 'pointer',
                                }}
                              >
                                <button
                                  type="button"
                                  className="admin-week-ai-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openWeeklyAiModal(w);
                                  }}
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
                                      color: '#1D7A68',
                                      fontSize: 11,
                                      fontWeight: 700,
                                      marginTop: 6,
                                    }}
                                  >
                                    Submitted
                                  </p>
                                  {row?.report_date ? (
                                    <p style={{ color: '#94a3b8', fontSize: 10, marginTop: 4 }}>{row.report_date}</p>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="info-card" style={{ padding: '32px' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1B2559', marginBottom: 24, flexShrink: 0 }}>Tracking Notes</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1, minHeight: 0 }}>
                      {[
                        'All records stay visible, including discharged patients.',
                        'Discharged appears automatically when a discharge request is approved on the admin dashboard.',
                        'Clinical trajectory (Improving / Stable / Declining) can be updated from the patient list.',
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

                <div className="info-card" style={{ padding: '28px 32px 32px' }}>
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 17, fontWeight: 800, color: '#1B2559', margin: 0 }}>Recovery Ladder</h3>
                  </div>
                  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <BehaviorProgressBoard
                      checked={behaviorChecklistChecked}
                      setChecked={setBehaviorChecklistChecked}
                      patientName={selectedPatient?.name ?? ''}
                      boardPosition={recoveryLadderPosition}
                      onBoardPositionChange={handleRecoveryLadderPositionChange}
                      persistenceId={selectedPatient?.id ?? null}
                    />
                  </div>
                  <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
                    <button
                      type="button"
                      onClick={() => void saveRecoveryLadderProgress()}
                      disabled={recoveryLadderSaveState.loading || !selectedPatient}
                      style={{
                        background: recoveryLadderSaveState.loading ? '#CBD5E1' : '#F54E25',
                        color: 'white',
                        border: 'none',
                        borderRadius: 8,
                        padding: '10px 18px',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: recoveryLadderSaveState.loading || !selectedPatient ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {recoveryLadderSaveState.loading ? 'Saving…' : 'Save recovery ladder progress'}
                    </button>
                    {recoveryLadderSaveState.error ? (
                      <p style={{ margin: 0, fontSize: 12, color: '#B91C1C', fontWeight: 600 }}>{recoveryLadderSaveState.error}</p>
                    ) : null}
                    {recoveryLadderSaveState.ok ? (
                      <p style={{ margin: 0, fontSize: 12, color: '#166534', fontWeight: 600 }}>
                        Saved. {selectedPatientLadderProgressPct}% stored for this resident.
                      </p>
                    ) : null}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="view-program-weekly-tracking-row">
                  {/* Weekly Progress / Medical Report — nurse-filed reports; AI insights via sparkle control */}
                  <div className="info-card" style={{ padding: '32px', minWidth: 0 }}>
                    <div style={{ flexShrink: 0, marginBottom: 20 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1B2559' }}>{isNurse ? 'Medical Report' : 'Weekly Progress'}</h3>
                      <p style={{ fontSize: 12, color: '#64748b', marginTop: 8, marginBottom: 0 }}>
                        {isNurse
                          ? 'Only weeks with a submitted medical report are shown. Click the AI icon on a card for suggestions based on patient context and that week&apos;s filing data.'
                          : 'Only weeks with a submitted nurse report are shown. Click the AI icon on a card for suggestions based on patient context and that week&apos;s filing data.'}
                      </p>
                    </div>
                    <div
                      style={{
                        flex: 1,
                        minHeight: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                      }}
                    >
                      {weekNumbersWithReports.length === 0 ? (
                        <p style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, margin: 0, lineHeight: 1.5 }}>
                          {isNurse
                            ? 'No medical reports have been filed for this resident yet.'
                            : 'No weekly reports have been filed for this resident yet.'}
                        </p>
                      ) : (
                        <div className="view-weeks-row-scroll">
                          {weekNumbersWithReports.map((w) => {
                            const row = weeklyReportsByWeek[w];
                            return (
                              <div
                                key={w}
                                className="week-card admin-week-card"
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                  setSelectedWeeklyVitalsWeek(w);
                                  openWeeklyReportModal(w);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setSelectedWeeklyVitalsWeek(w);
                                    openWeeklyReportModal(w);
                                  }
                                }}
                                style={{
                                  padding: '24px 10px',
                                  cursor: 'pointer',
                                }}
                              >
                                <button
                                  type="button"
                                  className="admin-week-ai-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openWeeklyAiModal(w);
                                  }}
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
                                      color: '#1D7A68',
                                      fontSize: 11,
                                      fontWeight: 700,
                                      marginTop: 6,
                                    }}
                                  >
                                    Submitted
                                  </p>
                                  {row?.report_date ? (
                                    <p style={{ color: '#94a3b8', fontSize: 10, marginTop: 4 }}>{row.report_date}</p>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="info-card" style={{ padding: '32px' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1B2559', marginBottom: 24, flexShrink: 0 }}>Tracking Notes</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1, minHeight: 0 }}>
                      {[
                        'All records stay visible, including discharged patients.',
                        'Discharged appears automatically when a discharge request is approved on the admin dashboard.',
                        'Clinical trajectory (Improving / Stable / Declining) can be updated from the patient list.',
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

                {!isNurse ? (
                  <div className="info-card" style={{ padding: '28px 32px 32px' }}>
                    <div style={{ marginBottom: 20 }}>
                      <h3 style={{ fontSize: 17, fontWeight: 800, color: '#1B2559', margin: 0 }}>Recovery Ladder</h3>
                      {mode === 'admin' ? (
                        <p style={{ fontSize: 12, color: '#64748b', marginTop: 8, marginBottom: 0 }}>
                          View only here. Nurses and program staff update ladder progress from their resident workspaces.
                        </p>
                      ) : null}
                    </div>
                    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                      <BehaviorProgressBoard
                        checked={behaviorChecklistChecked}
                        setChecked={setBehaviorChecklistChecked}
                        patientName={selectedPatient?.name ?? ''}
                        boardPosition={recoveryLadderPosition}
                        onBoardPositionChange={handleRecoveryLadderPositionChange}
                        persistenceId={selectedPatient?.id ?? null}
                        readOnly={mode === 'admin'}
                      />
                    </div>
                    {mode === 'admin' ? null : (
                      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
                        <button
                          type="button"
                          onClick={() => void saveRecoveryLadderProgress()}
                          disabled={recoveryLadderSaveState.loading || !selectedPatient}
                          style={{
                            background: recoveryLadderSaveState.loading ? '#CBD5E1' : '#F54E25',
                            color: 'white',
                            border: 'none',
                            borderRadius: 8,
                            padding: '10px 18px',
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: recoveryLadderSaveState.loading || !selectedPatient ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {recoveryLadderSaveState.loading ? 'Saving…' : 'Save recovery ladder progress'}
                        </button>
                        {recoveryLadderSaveState.error ? (
                          <p style={{ margin: 0, fontSize: 12, color: '#B91C1C', fontWeight: 600 }}>{recoveryLadderSaveState.error}</p>
                        ) : null}
                        {recoveryLadderSaveState.ok ? (
                          <p style={{ margin: 0, fontSize: 12, color: '#166534', fontWeight: 600 }}>
                            Saved. {selectedPatientLadderProgressPct}% stored for this resident.
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : null}
              </>
            )}
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
                    placeholder="Search patient ID, name, concern, or status…"
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

            {isAdminMode && missingStaffAssignments.missingCount > 0 ? (
              <div
                style={{
                  marginBottom: 16,
                  border: '1px solid #FECACA',
                  background: '#FEF2F2',
                  color: '#991B1B',
                  borderRadius: 12,
                  padding: '10px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Admin alert: {missingStaffAssignments.missingCount} of {missingStaffAssignments.totalInCare} in-care patients are missing Program or Nurse.
                {missingStaffAssignments.names.length ? ` Sample: ${missingStaffAssignments.names.join(', ')}` : ''}
              </div>
            ) : null}

            {/* Table */}
            <div className="db-table-mobile">
              {formError && (
                <div style={{ marginBottom: 12, color: '#dc2626', fontWeight: 600, fontSize: 13 }}>{formError}</div>
              )}
              <table style={{ width: '100%', textAlign: 'left', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#323D4E', color: 'white' }}>
                    {['Resident ID', 'Full Name', 'Primary Concern', 'Clinical status', 'Admission Date', 'Assigned Team', 'Days Stayed', 'Progress (%)', 'Actions'].map((col, i) => (
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
                      <td style={{ padding: '16px 20px', fontWeight: 700, color: '#1B2559', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{patient.admissionDisplayId || '—'}</td>
                      <td style={{ padding: '16px 20px', fontWeight: 600, color: '#1B2559' }}>{patient.name}</td>
                      <td style={{ padding: '16px 20px', color: '#1B2559' }}>{patient.concern}</td>
                      <td
                        style={{ padding: '16px 20px', minWidth: 148, verticalAlign: 'middle' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span
                          style={{
                            ...getStatusStyle(clinicalStatusLabel(patient)),
                            padding: '6px 12px',
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 800,
                            display: 'inline-block',
                          }}
                        >
                          {clinicalStatusLabel(patient)}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', color: '#1B2559', fontVariantNumeric: 'tabular-nums' }}>{formatDate(patient.admissionDate)}</td>
                      <td style={{ padding: '16px 20px', color: '#475569', minWidth: 210 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#1B2559' }}>
                          Program: {patient.caseLoadManager?.trim() ? patient.caseLoadManager : 'Unassigned'}
                        </div>
                        <div style={{ fontSize: 11, marginTop: 3 }}>
                          Nurse: {patient.programStaff?.trim() ? patient.programStaff : 'Unassigned'}
                        </div>
                        <div style={{ fontSize: 10, marginTop: 4, color: '#64748b' }}>
                          Medical: Shared pool ({patient.medicalStaffNote?.trim() || 'all medical staff on board'})
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px', color: '#1B2559', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {patient.stayDays != null ? `${patient.stayDays} day${patient.stayDays === 1 ? '' : 's'}` : '—'}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 72, height: 6, background: '#E9EDF7', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{ width: `${patient.progress}%`, height: '100%', background: getProgressColor(patient), borderRadius: 99 }} />
                          </div>
                          <span style={{ color: '#1B2559', fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 600 }}>{patient.progress}%</span>
                        </div>
                        {!isNurse ? (
                          <div style={{ marginTop: 8 }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '3px 8px',
                                borderRadius: 999,
                                fontSize: 10,
                                fontWeight: 800,
                                letterSpacing: '0.02em',
                                background: patient.progressUpdatedAt ? '#DCFCE7' : '#FEF3C7',
                                color: patient.progressUpdatedAt ? '#166534' : '#92400E',
                                border: `1px solid ${patient.progressUpdatedAt ? '#BBF7D0' : '#FDE68A'}`,
                              }}
                            >
                              {patient.progressUpdatedAt ? 'Governance updated' : 'Governance pending'}
                            </span>
                          </div>
                        ) : null}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <button type="button" className="db-view-btn" onClick={() => setSelectedPatient(patient)}>View</button>
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
        {isNurse ? (
          <>
            <div className="mob-nav-item" onClick={() => navigate('/nurse-dashboard')}>
              <div style={{ padding: 10, borderRadius: 10, display: 'flex' }}>
                <LayoutGrid size={20} color="#A3AED0" />
              </div>
              <span>Dashboard</span>
            </div>
            <div className="mob-nav-item active" onClick={() => setSelectedPatient(null)}>
              <div style={{ background: '#F54E25', padding: 10, borderRadius: 10, display: 'flex' }}>
                <Users size={20} color="white" />
              </div>
              <span style={{ color: '#F54E25' }}>Residents</span>
            </div>
            <div className="mob-nav-item" onClick={() => navigate('/nurse-calendar')}>
              <div style={{ padding: 10, borderRadius: 10, display: 'flex' }}>
                <Calendar size={20} color="#A3AED0" />
              </div>
              <span>Calendar</span>
            </div>
            <div className="mob-nav-item" onClick={() => navigate('/nurse-medical-report')}>
              <div style={{ padding: 10, borderRadius: 10, display: 'flex' }}>
                <FileText size={20} color="#A3AED0" />
              </div>
              <span>Medical</span>
            </div>
            <div className="mob-nav-item" onClick={() => navigate('/nurseprofile')}>
              <div style={{ padding: 10, borderRadius: 10, display: 'flex' }}>
                <User size={20} color="#A3AED0" />
              </div>
              <span>Profile</span>
            </div>
            <div className="mob-nav-item" onClick={() => navigate('/login')}>
              <LogOut size={22} color="#F54E25" />
              <span style={{ color: '#F54E25' }}>Logout</span>
            </div>
          </>
        ) : isProgram ? (
          <>
            <div className="mob-nav-item active" onClick={() => setSelectedPatient(null)}>
              <div style={{ background: '#F54E25', padding: 10, borderRadius: 10, display: 'flex' }}>
                <Users size={20} color="white" />
              </div>
              <span style={{ color: '#F54E25' }}>Assigned</span>
            </div>
            <div className="mob-nav-item" onClick={() => navigate('/program-calendar')}>
              <div style={{ padding: 10, borderRadius: 10, display: 'flex' }}>
                <Calendar size={20} color="#A3AED0" />
              </div>
              <span>Calendar</span>
            </div>
            <div className="mob-nav-item" onClick={() => navigate('/program-weekly-report')}>
              <div style={{ padding: 10, borderRadius: 10, display: 'flex' }}>
                <FileText size={20} color="#A3AED0" />
              </div>
              <span>Weekly</span>
            </div>
            <div className="mob-nav-item" onClick={() => navigate('/login')}>
              <LogOut size={22} color="#F54E25" />
              <span style={{ color: '#F54E25' }}>Logout</span>
            </div>
          </>
        ) : staffLimited ? (
          <>
            <div className="mob-nav-item active" onClick={() => setSelectedPatient(null)}>
              <div style={{ background: '#F54E25', padding: 10, borderRadius: 10, display: 'flex' }}>
                <BookUser size={20} color="white" />
              </div>
              <span style={{ color: '#F54E25' }}>Records</span>
            </div>
            <div className="mob-nav-item" onClick={() => navigate('/admin-appointments')}>
              <div style={{ padding: 10, borderRadius: 10, display: 'flex' }}>
                <Calendar size={20} color="#A3AED0" />
              </div>
              <span>Visits</span>
            </div>
            <div className="mob-nav-item" onClick={() => navigate('/admin-reports')}>
              <div style={{ padding: 10, borderRadius: 10, display: 'flex' }}>
                <FileText size={20} color="#A3AED0" />
              </div>
              <span>Reports</span>
            </div>
            <div className="mob-nav-item" onClick={() => navigate('/admin-profile')}>
              <div style={{ padding: 10, borderRadius: 10, display: 'flex' }}>
                <User size={20} color="#A3AED0" />
              </div>
              <span>Profile</span>
            </div>
            <div className="mob-nav-item" onClick={() => navigate('/login')}>
              <LogOut size={22} color="#F54E25" />
              <span style={{ color: '#F54E25' }}>Logout</span>
            </div>
          </>
        ) : (
          <>
            <div className="mob-nav-item" onClick={() => navigate('/admin-dashboard')}>
              <div style={{ padding: 10, borderRadius: 10, display: 'flex' }}>
                <LayoutGrid size={20} color="#A3AED0" />
              </div>
              <span>Dashboard</span>
            </div>
            <div className="mob-nav-item active" onClick={() => setSelectedPatient(null)}>
              <div style={{ background: '#F54E25', padding: 10, borderRadius: 10, display: 'flex' }}>
                <BookUser size={20} color="white" />
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
          </>
        )}
      </div>

      {weeklyReportModalOpen &&
        createPortal(
          <div
            className="admin-ai-modal-backdrop"
            role="presentation"
            onClick={() => setWeeklyReportModalOpen(false)}
          >
            <div
              className="admin-ai-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-weekly-report-modal-title"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 980 }}
            >
              <div className="admin-ai-modal-header">
                <div>
                  <h2 id="admin-weekly-report-modal-title" style={{ fontSize: 17, fontWeight: 800, color: '#1B2559', margin: 0 }}>
                    {isNurse ? 'Medical report' : 'Nurse weekly report'}
                    {weeklyReportModalWeek != null ? ` · Week ${weeklyReportModalWeek}` : ''}
                  </h2>
                  <p style={{ fontSize: 12, color: '#64748b', margin: '6px 0 0' }}>
                    {selectedPatient?.name || 'Resident'}
                  </p>
                  <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, color: '#475569', background: '#F4F7FE', border: '1px solid #E5ECFA', borderRadius: 999, padding: '5px 10px' }}>
                    {weeklyReportModalRow ? 'Filed report' : 'No report filed'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setWeeklyReportModalOpen(false)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, color: '#64748b', borderRadius: 8 }}
                  aria-label="Close"
                >
                  <X size={22} />
                </button>
              </div>
              <div className="admin-ai-modal-body">
                {!weeklyReportModalRow ? (
                  <div style={{ color: '#94a3b8' }}>
                    {isNurse ? 'No medical report filed for this week yet.' : 'No nurse report filed for this week yet.'}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    <div className="report-row">
                      <div className="report-label">Nurse</div>
                      <div className="report-value">{weeklyReportModalRow.nurse_name || '—'}</div>
                    </div>
                    <div className="report-row">
                      <div className="report-label">Report Date</div>
                      <div className="report-value">{weeklyReportModalRow.report_date || '—'}</div>
                    </div>
                    <div className="report-row">
                      <div className="report-label">Submitted</div>
                      <div className="report-value">{weeklyReportModalRow.submitted_at ? formatDate(weeklyReportModalRow.submitted_at) : '—'}</div>
                    </div>
                    <div className="report-row">
                      <div className="report-label">Summary</div>
                      <div className="report-value">{weeklyReportModalRow.summary || weeklyReportModalRow.report_summary || 'No summary provided.'}</div>
                    </div>
                    <div className="report-row">
                      <div className="report-label">Nurse Notes</div>
                      <div className="report-value">{weeklyReportModalRow.nurse_note || weeklyReportModalRow.notes || 'No notes provided.'}</div>
                    </div>
                    <div className="report-row">
                      <div className="report-label">Behavior / Mood</div>
                      <div className="report-value">{weeklyReportModalRow.behavior_observation || weeklyReportModalRow.mood_assessment || 'No behavior notes provided.'}</div>
                    </div>
                    <div className="report-row">
                      <div className="report-label">Recommendations</div>
                      <div className="report-value">{weeklyReportModalRow.recommendations || weeklyReportModalRow.plan_next_week || 'No recommendations provided.'}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

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
                    className="admin-ai-error"
                    style={{
                      color: '#b91c1c',
                      fontWeight: 600,
                      fontSize: 14,
                      whiteSpace: 'pre-line',
                      lineHeight: 1.55,
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                    }}
                  >
                    {aiError}
                  </div>
                )}
                {!aiLoading && !aiError && aiText && <div className="admin-ai-content">{renderAiContent(aiText)}</div>}
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
}

export default function AdminPatientDatabase() {
  return <PatientDatabaseShell mode="admin" />;
}

export function NursePatientDatabase() {
  return <PatientDatabaseShell mode="nurse" />;
}

export function ProgramPatientDatabase() {
  return <PatientDatabaseShell mode="program" />;
}

export function AdminPatientDatabaseGate() {
  const [staffLimited, setStaffLimited] = useState(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!isSupabaseConfigured()) {
        if (!cancelled) setStaffLimited(false);
        return;
      }
      const { data: authData } = await supabase.auth.getUser();
      const role = await resolveAccountRole(authData?.user ?? null);
      if (cancelled) return;
      setStaffLimited(role === 'staff');
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  if (staffLimited === null) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, system-ui, sans-serif',
          color: '#64748b',
        }}
      >
        Loading…
      </div>
    );
  }
  return <PatientDatabaseShell mode="admin" staffLimited={staffLimited} />;
}