import { computeTotalServiceCostPhp } from '@/lib/servicePricing';

const WORKFLOW_KEY = 'bh_admission_workflow_overrides_v1';
const DISCHARGE_KEY = 'bh_discharge_management_records_v1';
const ACTIVITY_KEY = 'bh_admission_mgmt_activity_v1';

export const ADMISSION_WORKFLOW_STATUSES = [
  'Pending',
  'Approved',
  'Ongoing',
  'Completed',
  'Cancelled',
  'For Discharge',
];

export const DISCHARGE_FINAL_STATUSES = ['Ready for Discharge', 'Discharged', 'Completed', 'Archived'];

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event('storage'));
}

export function loadWorkflowOverrides() {
  const data = readJson(WORKFLOW_KEY, {});
  return data && typeof data === 'object' ? data : {};
}

export function saveWorkflowOverrides(map) {
  writeJson(WORKFLOW_KEY, map);
}

export function patchWorkflowOverride(requestId, partial) {
  const keys = Object.keys(partial || {});
  if (keys.length === 0) {
    const cur = loadWorkflowOverrides()[requestId];
    return cur && typeof cur === 'object' ? cur : {};
  }
  const map = { ...loadWorkflowOverrides() };
  const prev = map[requestId] || {};
  const hasChange = keys.some((k) => prev[k] !== partial[k]);
  if (!hasChange) {
    return prev;
  }
  map[requestId] = { ...prev, ...partial, updatedAt: new Date().toISOString() };
  saveWorkflowOverrides(map);
  return map[requestId];
}

export function loadDischargeRecords() {
  const rows = readJson(DISCHARGE_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

export function saveDischargeRecords(rows) {
  writeJson(DISCHARGE_KEY, rows);
}

export function appendDischargeRecord(rec) {
  const rows = loadDischargeRecords();
  rows.unshift(rec);
  saveDischargeRecords(rows);
  return rows;
}

export function updateDischargeRecord(id, partial) {
  const rows = loadDischargeRecords().map((r) =>
    r.id === id ? { ...r, ...partial, updatedAt: new Date().toISOString() } : r
  );
  saveDischargeRecords(rows);
  return rows;
}

export function pushActivity(message) {
  const list = readJson(ACTIVITY_KEY, []);
  const next = [{ id: `act-${Date.now()}`, message, at: new Date().toISOString() }, ...list].slice(0, 40);
  writeJson(ACTIVITY_KEY, next);
  return next;
}

export function loadActivity() {
  const list = readJson(ACTIVITY_KEY, []);
  return Array.isArray(list) ? list : [];
}

function normName(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function patientMatchesAdmission(patient, admission) {
  if (!patient || !admission) return false;
  if (patient.family_id && admission.family_id && patient.family_id !== admission.family_id) return false;
  return normName(patient.full_name) === normName(admission.patient_name);
}

export function findPatientForAdmission(patients, admission) {
  const list = patients || [];
  const direct = list.find((p) => patientMatchesAdmission(p, admission));
  if (direct) return direct;
  return list.find((p) => p.family_id === admission.family_id && normName(p.full_name) === normName(admission.patient_name));
}

/** Given one patient row and a list of admission_requests rows, return the matching request (same logic as admission management pairing). */
export function findAdmissionForPatient(patientRow, admissionRows) {
  if (!patientRow || !Array.isArray(admissionRows) || admissionRows.length === 0) return null;
  return admissionRows.find((ar) => findPatientForAdmission([patientRow], ar)) || null;
}

/**
 * Derive workflow label when no override.workflowStatus is stored.
 */
export function deriveWorkflowStatusFromDb(admissionRow, patientRow) {
  const st = String(admissionRow?.status || '').toLowerCase();
  if (st === 'declined') return 'Cancelled';
  if (st === 'pending') return 'Pending';
  if (st === 'approved') {
    if (patientRow && !patientRow.discharged_at) return 'Ongoing';
    if (patientRow?.discharged_at) return 'Completed';
    return 'Approved';
  }
  return 'Pending';
}

/** Stable 6-digit tracking suffix derived from UUID (same request always maps to same digits). */
function stableTrackingSuffix(id) {
  const hex = String(id).replace(/-/g, '');
  let n = 0;
  for (let i = 0; i < hex.length; i++) {
    const ch = hex[i];
    const v = parseInt(ch, 16);
    n = (n * 16 + (Number.isNaN(v) ? ch.charCodeAt(0) : v)) >>> 0;
  }
  return String(n % 1000000).padStart(6, '0');
}

/**
 * Human-readable patient ID (UI label): year admitted + 6-digit tracking, e.g. 2026-042817.
 * Year: patient admitted_at, else request decided_at, else request created_at.
 */
export function computeAdmissionDisplayId(admissionRow, patientRow) {
  const admissionDate =
    patientRow?.admitted_at ||
    admissionRow?.decided_at ||
    admissionRow?.created_at ||
    null;
  let year = new Date().getFullYear();
  if (admissionDate) {
    const d = new Date(admissionDate);
    if (!Number.isNaN(d.getTime())) year = d.getFullYear();
  }
  const idSource = admissionRow?.id ?? patientRow?.id;
  if (!idSource) return '—';
  return `${year}-${stableTrackingSuffix(idSource)}`;
}

export function buildAdmissionRow(admissionRow, patientRow, override) {
  const requestId = admissionRow.id;
  const o = override || {};
  const workflowStatus = o.workflowStatus || deriveWorkflowStatusFromDb(admissionRow, patientRow);

  const branch = o.branch || 'imus';
  const monthsOfCare = o.monthsOfCare != null ? Number(o.monthsOfCare) : 1;
  const includeAdmissionFee = o.includeAdmissionFee !== false;
  const includeMonthly = o.includeMonthly !== false;

  const estimatedCost = computeTotalServiceCostPhp({
    branch,
    monthsOfCare,
    includeAdmissionFee,
    includeMonthly,
  });

  const admissionDate =
    patientRow?.admitted_at ||
    admissionRow.decided_at ||
    admissionRow.created_at ||
    null;

  const admissionDisplayId = computeAdmissionDisplayId(admissionRow, patientRow);

  return {
    requestId,
    admissionDisplayId,
    patientName: admissionRow.patient_name || 'Unknown',
    assignedStaff: o.assignedStaff || '—',
    admissionType: o.admissionType || 'Residential',
    reason: admissionRow.reason_for_admission || '—',
    admissionDate,
    status: workflowStatus,
    estimatedCost,
    pricingDetail: {
      branch,
      monthsOfCare,
      includeAdmissionFee,
      includeMonthly,
    },
    patientId: o.patientId || patientRow?.id || null,
    familyId: admissionRow.family_id,
    guardianName: admissionRow.guardian_full_name,
    guardianEmail: admissionRow.guardian_email,
    guardianPhone: admissionRow.guardian_phone,
    patientBirthDate: admissionRow.patient_birth_date,
    patientGender: admissionRow.patient_gender || '',
    dbStatus: admissionRow.status,
    archived: Boolean(o.archived),
    rawAdmission: admissionRow,
    rawPatient: patientRow || null,
  };
}

export function summarizeDischargeCost(pricingDetail) {
  return computeTotalServiceCostPhp({
    branch: pricingDetail?.branch || 'imus',
    monthsOfCare: pricingDetail?.monthsOfCare ?? 1,
    includeAdmissionFee: pricingDetail?.includeAdmissionFee !== false,
    includeMonthly: pricingDetail?.includeMonthly !== false,
  });
}
