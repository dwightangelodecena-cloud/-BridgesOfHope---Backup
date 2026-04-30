export const STAFF_ASSIGNMENT_STORAGE_KEY = 'bh_patient_staff_assignments_v1';
export const CLM_WEEKLY_REPORTS_KEY = 'bh_clm_weekly_reports_v1';
export const GUARDIAN_CONSOLIDATED_KEY = 'bh_guardian_weekly_consolidated_v1';
export const CLM_INCIDENT_LOG_KEY = 'bh_clm_incident_log_v1';
export const LADDER_PROFILE_KEY = 'bh_recovery_ladder_profiles_v1';

export const EMPTY_FORM = {
  weekNumber: '',
  socialCaseStudy: '',
  psychologicalExam: '',
  behaviorObservation: '',
  interventions: '',
  accomplishments: '',
  nextPlan: '',
  summary: '',
};

export const CHART_COLORS = ['#F54E25', '#1B2559', '#0F766E', '#6366F1', '#CA8A04', '#64748B'];

export function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function normalizeName(v) {
  return String(v || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function displayNameFromEmail(email) {
  const local = String(email || '').split('@')[0] || '';
  return local.replace(/[._-]+/g, ' ').trim();
}

export function patientMatchesClm(patientClm, me) {
  const target = normalizeName(patientClm);
  if (!target) return false;
  const meFull = normalizeName(me.fullName);
  const meEmailLocal = normalizeName(displayNameFromEmail(me.email));
  return Boolean(
    (meFull && target.includes(meFull))
    || (meEmailLocal && target.includes(meEmailLocal))
    || target === normalizeName(me.email)
  );
}

/**
 * Merge staff fields the same way as admin Patient Management:
 * `bh_patient_staff_assignments_v1` (written when admin saves) overrides Supabase `patients` columns.
 */
export function mergeStaffAssignmentFields(patientId, assignmentMap, row) {
  const ov = assignmentMap[String(patientId)] || {};
  const caseLoadManager = String(
    ov.caseLoadManager || row?.case_load_manager || row?.caseLoadManager || ''
  ).trim();
  const programStaff = String(
    ov.programStaff || row?.program_staff || row?.programStaff || ''
  ).trim();
  return { caseLoadManager, programStaff };
}

export function weekNumberNow() {
  const d = new Date();
  const oneJan = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d - oneJan) / 86400000);
  return Math.ceil((days + oneJan.getDay() + 1) / 7);
}

export function normalizeAppointmentStatus(a) {
  const st = String(a.status ?? a.Status ?? '').trim().toLowerCase();
  if (!st || st === 'pending') return 'Pending';
  if (st === 'requested') return 'Requested';
  if (st.includes('confirm') || st === 'approved' || st === 'scheduled') return 'Confirmed';
  if (st.includes('reject') || st.includes('declin') || st === 'cancelled' || st === 'canceled') return 'Declined';
  return st ? st.charAt(0).toUpperCase() + st.slice(1) : 'Other';
}

export function loadLadderProfiles() {
  const raw = readJson(LADDER_PROFILE_KEY, {});
  return raw && typeof raw === 'object' ? raw : {};
}

export function saveLadderProfiles(map) {
  localStorage.setItem(LADDER_PROFILE_KEY, JSON.stringify(map || {}));
}

export function clmReportFromRow(row, patientNameById) {
  const pid = String(row.patient_id);
  return {
    id: String(row.id),
    patientId: pid,
    patientName: patientNameById[pid] || '',
    clmName: row.clm_name || '',
    weekNumber: String(row.week_number || '').trim(),
    socialCaseStudy: String(row.social_case_study || '').trim(),
    psychologicalExam: String(row.psychological_exam || '').trim(),
    behaviorObservation: String(row.behavior_observation || '').trim(),
    interventions: String(row.interventions || '').trim(),
    accomplishments: String(row.accomplishments || '').trim(),
    nextPlan: String(row.next_plan || '').trim(),
    summary: String(row.summary || '').trim(),
    submittedAt: row.submitted_at || new Date().toISOString(),
  };
}

export function clmReportToInsertPayload(report, createdBy) {
  return {
    patient_id: report.patientId,
    week_number: String(report.weekNumber || '').trim(),
    social_case_study: report.socialCaseStudy || null,
    psychological_exam: report.psychologicalExam || null,
    behavior_observation: report.behaviorObservation || null,
    interventions: report.interventions || null,
    accomplishments: report.accomplishments || null,
    next_plan: report.nextPlan || null,
    summary: report.summary,
    clm_name: report.clmName || null,
    created_by: createdBy || null,
    submitted_at: report.submittedAt || new Date().toISOString(),
  };
}

export function clmIncidentFromRow(row, patientNameById) {
  const pid = String(row.patient_id);
  return {
    id: String(row.id),
    patientId: pid,
    patientName: patientNameById[pid] || '',
    behaviorType: String(row.behavior_type || '').trim(),
    severity: row.severity === 'demotion_trigger' ? 'demotion_trigger' : 'intervention_only',
    intervention: String(row.intervention || '').trim(),
    note: String(row.note || '').trim(),
    createdAt: row.created_at || new Date().toISOString(),
    clmName: row.clm_name || '',
  };
}

export function clmIncidentToInsertPayload(item, createdBy) {
  return {
    patient_id: item.patientId,
    behavior_type: item.behaviorType,
    severity: item.severity,
    intervention: item.intervention,
    note: item.note || null,
    clm_name: item.clmName || null,
    created_at: item.createdAt || new Date().toISOString(),
    created_by: createdBy || null,
  };
}

function sortReportsDesc(arr) {
  return [...arr].sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
}

/**
 * Merge localStorage report map with Supabase rows; dedupe by id; sort each list.
 */
export function mergeClmReportsMap(localMap, dbRows, patientNameById) {
  const out = {};
  if (localMap && typeof localMap === 'object') {
    Object.keys(localMap).forEach((k) => {
      out[k] = Array.isArray(localMap[k]) ? [...localMap[k]] : [];
    });
  }
  const seen = new Set();
  Object.values(out).forEach((list) => {
    (Array.isArray(list) ? list : []).forEach((r) => { if (r?.id) seen.add(String(r.id)); });
  });
  (dbRows || []).forEach((row) => {
    const mapped = clmReportFromRow(row, patientNameById);
    const pid = mapped.patientId;
    if (!out[pid]) out[pid] = [];
    if (seen.has(mapped.id)) return;
    seen.add(mapped.id);
    out[pid].push(mapped);
  });
  Object.keys(out).forEach((pid) => {
    out[pid] = sortReportsDesc(Array.isArray(out[pid]) ? out[pid] : []);
  });
  return out;
}

export function mergeClmIncidentsList(localList, dbRows, patientIdSet, patientNameById) {
  const byId = new Map();
  (Array.isArray(localList) ? localList : []).forEach((i) => {
    if (!i?.id || !patientIdSet.has(String(i.patientId))) return;
    byId.set(String(i.id), i);
  });
  (dbRows || []).forEach((row) => {
    const m = clmIncidentFromRow(row, patientNameById);
    if (!patientIdSet.has(String(m.patientId))) return;
    if (!byId.has(m.id)) byId.set(m.id, m);
  });
  return Array.from(byId.values())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 200);
}
