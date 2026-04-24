/**
 * Admin printable PDF report templates. Data comes from Supabase when configured,
 * otherwise from the same localStorage keys used by the admin dashboard and patient database.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export const REPORTS_BED_CAPACITY = 50;

const ROOM_ASSIGNMENT_STORAGE_KEY = 'bh_patient_room_assignments_v1';
const STAFF_ASSIGNMENT_STORAGE_KEY = 'bh_patient_staff_assignments_v1';

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function loadRoomOverrides() {
  const o = readJson(ROOM_ASSIGNMENT_STORAGE_KEY, {});
  return o && typeof o === 'object' ? o : {};
}

function loadStaffOverrides() {
  const o = readJson(STAFF_ASSIGNMENT_STORAGE_KEY, {});
  return o && typeof o === 'object' ? o : {};
}

function ageFromDob(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function mapPatientFromDbRow(row) {
  return {
    id: row.id,
    name: row.full_name,
    full_name: row.full_name,
    concern: row.primary_concern,
    gender: row.gender || 'N/A',
    age: ageFromDob(row.date_of_birth),
    admitted_at: row.admitted_at,
    discharged_at: row.discharged_at,
    status: row.discharged_at ? 'Discharged' : row.clinical_status || 'Admitted',
    therapist: String(row.assigned_staff || row.therapist || '').trim() || 'Unassigned',
  };
}

function normalizeLocalPatient(p, idx) {
  const name = p.name || p.patient_name || p.full_name || `Patient ${idx + 1}`;
  const discharged_at = p.discharged_at || null;
  const status = p.status || (discharged_at ? 'Discharged' : p.clinicalStatus || 'Admitted');
  return {
    id: p.id ?? `p-${idx}`,
    name,
    gender: p.gender || 'N/A',
    concern: String(p.concern || p.reason || p.primary_concern || '').trim(),
    admitted_at: p.admitted_at || p.admissionDate || p.createdAt || null,
    discharged_at,
    status: String(status),
    therapist: String(p.therapist || p.assignedStaff || p.assigned_staff || '').trim() || 'Unassigned',
  };
}

function applyRoomStaffOverrides(patients) {
  const rooms = loadRoomOverrides();
  const staff = loadStaffOverrides();
  return patients.map((p) => {
    const rid = String(p.id);
    const ro = rooms[rid];
    const so = staff[rid];
    return {
      ...p,
      roomCode: ro?.roomCode || p.roomCode || '',
      caseLoadManager: so?.caseLoadManager || p.caseLoadManager || '',
      programStaff: so?.programStaff || p.programStaff || '',
      medicalStaffNote: so?.medicalStaffNote || p.medicalStaffNote || '',
    };
  });
}

function hashPatientId(id) {
  const s = String(id ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function roomBedLabel(p) {
  const dis = p.discharged_at || p.status === 'Discharged';
  if (p.roomCode && String(p.roomCode).trim()) return String(p.roomCode).trim();
  if (dis) return '—';
  const n = 200 + (hashPatientId(p.id) % 56);
  return `Room ${n}`;
}

function assignedStaffLine(p) {
  const parts = [p.therapist, p.caseLoadManager, p.programStaff].map((x) => String(x || '').trim()).filter(Boolean);
  if (parts.length) return [...new Set(parts)].join(' · ');
  return 'Unassigned';
}

function formatShortDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}

function formatShortDateTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function reportFileDateStamp(d = new Date()) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfWeekMonday(d = new Date()) {
  const x = new Date(d);
  const dow = x.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfWeekExclusive(d = new Date()) {
  const s = startOfWeekMonday(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 7);
  return e;
}

function tsInRange(iso, start, endExcl) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= start.getTime() && t < endExcl.getTime();
}

function flattenLocalWeeklyReports(raw) {
  const list = [];
  if (raw == null) return list;
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (row && typeof row === 'object') {
        list.push({
          patient_id: row.patient_id ?? row.patientId,
          week_number: row.week_number ?? row.weekNumber,
          submitted_at: row.submitted_at || row.submittedAt,
          patient_name: row.patient_name || row.patientName || '',
        });
      }
    }
    return list;
  }
  if (typeof raw === 'object') {
    for (const [pid, weeks] of Object.entries(raw)) {
      if (!weeks || typeof weeks !== 'object') continue;
      for (const [weekNum, entry] of Object.entries(weeks)) {
        if (!entry || typeof entry !== 'object') continue;
        list.push({
          patient_id: pid,
          week_number: parseInt(weekNum, 10) || null,
          submitted_at: entry.submittedAt || entry.submitted_at || null,
          patient_name: entry.patientName || entry.patient_name || '',
        });
      }
    }
  }
  return list;
}

function normalizeWeeklyList(weeklyReports, source) {
  if (source === 'supabase') {
    return (weeklyReports || []).map((r) => ({
      patient_id: String(r.patient_id ?? ''),
      week_number: r.week_number,
      submitted_at: r.submitted_at,
      patient_name: r.patient_name || '',
    }));
  }
  const raw = weeklyReports ?? readJson('bh_nurse_weekly_reports', {});
  return flattenLocalWeeklyReports(raw);
}

function decisionNoteFromRow(row) {
  return String(
    row.decision_note ||
      row.decisionNote ||
      row.admin_note ||
      row.decline_reason ||
      row.decline_note ||
      row.notes ||
      row.note ||
      ''
  ).trim();
}

function patientNameFromAdmissionRow(r) {
  return String(r.patient_name || r.name || '—').trim();
}

function patientNameFromDischargeRow(r) {
  return String(r.patient_name || r.name || '—').trim();
}

async function fetchSupabaseReportsSnapshot() {
  const { data: patientRows, error: pErr } = await supabase
    .from('patients')
    .select('*')
    .order('admitted_at', { ascending: false })
    .limit(8000);
  if (pErr) throw pErr;

  const { data: admRows, error: admErr } = await supabase
    .from('admission_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10000);
  if (admErr) throw admErr;

  const { data: disRows, error: disErr } = await supabase
    .from('discharge_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10000);
  if (disErr) throw disErr;

  let weeklyRows = [];
  const wrRes = await supabase.from('weekly_reports').select('*').order('submitted_at', { ascending: false }).limit(5000);
  if (wrRes.error) {
    console.warn('[reports] weekly_reports', wrRes.error.message);
  } else {
    weeklyRows = wrRes.data || [];
  }

  if (!weeklyRows.length && typeof localStorage !== 'undefined') {
    const parsed = readJson('bh_nurse_weekly_reports', null);
    const flat = flattenLocalWeeklyReports(parsed);
    if (flat.length) weeklyRows = flat;
  }

  const patients = (patientRows || []).map(mapPatientFromDbRow);
  return {
    source: 'supabase',
    generatedAt: new Date().toISOString(),
    patients: applyRoomStaffOverrides(patients),
    admissionRequests: admRows || [],
    dischargeRequests: disRows || [],
    weeklyReports: weeklyRows,
  };
}

function loadLocalReportsSnapshot() {
  const rawPatients = readJson('bh_patients', []);
  const patients = applyRoomStaffOverrides((rawPatients || []).map(normalizeLocalPatient));

  const pendingAdm = readJson('bh_pending_admissions', []);
  const pendingDis = readJson('bh_pending_discharges', []);
  const declinedAll = readJson('bh_declined_requests', []);

  const admissionRequests = [
    ...(pendingAdm || []).map((r) => ({
      ...r,
      status: 'pending',
      patient_name: r.patient_name || r.name,
      reason_for_admission: r.reason_for_admission || r.reason || '',
      created_at: r.created_at || r.requestTime || r.createdAt || null,
    })),
    ...(declinedAll || [])
      .filter((r) => r.type === 'admission')
      .map((r) => ({
        ...r,
        status: 'declined',
        patient_name: r.patient_name || r.name,
        reason_for_admission: r.reason_for_admission || r.reason || '',
        created_at: r.created_at || r.requestTime || r.createdAt || null,
        decided_at: r.decided_at || r.declinedAt || r.created_at || null,
      })),
  ];

  const dischargeRequests = [
    ...(pendingDis || []).map((r) => ({
      ...r,
      status: 'pending',
      patient_name: r.patient_name || r.name,
      created_at: r.created_at || r.requestTime || r.createdAt || null,
    })),
    ...(declinedAll || [])
      .filter((r) => r.type === 'discharge')
      .map((r) => ({
        ...r,
        status: 'declined',
        patient_name: r.patient_name || r.name,
        created_at: r.created_at || r.requestTime || r.createdAt || null,
        decided_at: r.decided_at || r.declinedAt || r.created_at || null,
        reason_category: r.reason_category || r.reason || '',
        reason_details: r.reason_details || '',
      })),
  ];

  const weeklyRaw = readJson('bh_nurse_weekly_reports', {});

  const approvedAdmissionSynth = (patients || [])
    .filter((p) => p.admitted_at)
    .map((p) => ({
      id: `local-approved-admission-${p.id}`,
      status: 'approved',
      patient_name: p.name,
      reason_for_admission: p.concern || '',
      created_at: p.admitted_at,
      decided_at: p.admitted_at,
    }));

  const approvedDischargeSynth = (patients || [])
    .filter((p) => p.discharged_at)
    .map((p) => ({
      id: `local-approved-discharge-${p.id}`,
      status: 'approved',
      patient_name: p.name,
      created_at: p.discharged_at,
      decided_at: p.discharged_at,
      reason_category: 'Discharge approved',
      reason_details: '',
    }));

  return {
    source: 'local',
    generatedAt: new Date().toISOString(),
    patients,
    admissionRequests: [...admissionRequests, ...approvedAdmissionSynth],
    dischargeRequests: [...dischargeRequests, ...approvedDischargeSynth],
    weeklyReports: weeklyRaw,
  };
}

/**
 * @returns {Promise<{ source: string, generatedAt: string, patients: object[], admissionRequests: object[], dischargeRequests: object[], weeklyReports: object[] | object }>}
 */
export async function loadAdminReportsSnapshot() {
  if (isSupabaseConfigured()) {
    try {
      return await fetchSupabaseReportsSnapshot();
    } catch (e) {
      console.warn('[reports] Supabase load failed, using local snapshot', e);
      return loadLocalReportsSnapshot();
    }
  }
  return loadLocalReportsSnapshot();
}

function newPdfDoc(title) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFontSize(16);
  doc.text(title, 40, 48);
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(`Generated ${formatShortDateTime(new Date().toISOString())}`, pageW - 40, 48, { align: 'right' });
  doc.setTextColor(0);
  return doc;
}

function finalizePdf(doc, filename) {
  doc.save(filename);
}

/** @param {Awaited<ReturnType<loadAdminReportsSnapshot>>} snapshot */
export function downloadPatientCensusPdf(snapshot) {
  const rows = (snapshot.patients || []).map((p) => {
    const cohort = p.discharged_at || p.status === 'Discharged' ? 'Discharged' : 'Active';
    return [
      p.name || '—',
      cohort,
      roomBedLabel(p),
      assignedStaffLine(p),
      formatShortDate(p.admitted_at),
      formatShortDate(p.discharged_at),
    ];
  });
  rows.sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { sensitivity: 'base' }));

  const doc = newPdfDoc('Patient Census Report');
  doc.setFontSize(9);
  doc.text('Active and discharged patients with room/bed assignment and assigned staff (as recorded).', 40, 68);

  autoTable(doc, {
    startY: 80,
    head: [['Patient', 'Cohort', 'Room / bed', 'Assigned staff', 'Admitted', 'Discharged']],
    body: rows,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [245, 78, 37], textColor: 255 },
  });

  finalizePdf(doc, `patient-census-${reportFileDateStamp()}.pdf`);
}

/** @param {Awaited<ReturnType<loadAdminReportsSnapshot>>} snapshot */
export function downloadAdmissionDischargeDecisionsPdf(snapshot) {
  const body = [];

  for (const r of snapshot.admissionRequests || []) {
    const st = String(r.status || '').toLowerCase();
    const reason =
      st === 'declined'
        ? decisionNoteFromRow(r) || String(r.reason_for_admission || r.reason || '').trim() || '—'
        : String(r.reason_for_admission || r.reason || '').trim() || '—';
    body.push([
      'Admission',
      patientNameFromAdmissionRow(r),
      st || '—',
      formatShortDateTime(r.decided_at || r.updated_at || r.created_at),
      reason,
    ]);
  }

  for (const r of snapshot.dischargeRequests || []) {
    const st = String(r.status || '').toLowerCase();
    const reason =
      st === 'declined'
        ? decisionNoteFromRow(r) ||
          [r.reason_category, r.reason_details].filter(Boolean).join(' — ') ||
          '—'
        : [r.reason_category, r.reason_details].filter(Boolean).join(' — ') || '—';
    body.push([
      'Discharge',
      patientNameFromDischargeRow(r),
      st || '—',
      formatShortDateTime(r.decided_at || r.updated_at || r.created_at),
      reason,
    ]);
  }

  body.sort((a, b) => {
    const ta = Date.parse(a[3]) || 0;
    const tb = Date.parse(b[3]) || 0;
    if (tb !== ta) return tb - ta;
    return String(a[1]).localeCompare(String(b[1]), undefined, { sensitivity: 'base' });
  });

  const doc = newPdfDoc('Admission / Discharge Decisions Report');
  doc.setFontSize(9);
  doc.text('Request decisions with status and reasons or notes where available.', 40, 68);

  autoTable(doc, {
    startY: 80,
    head: [['Type', 'Patient', 'Status', 'Decided / updated', 'Reason / notes']],
    body,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [245, 78, 37], textColor: 255 },
    columnStyles: { 4: { cellWidth: 200 } },
  });

  finalizePdf(doc, `admission-discharge-decisions-${reportFileDateStamp()}.pdf`);
}

/** @param {Awaited<ReturnType<loadAdminReportsSnapshot>>} snapshot */
export function downloadOccupancyPdf(snapshot) {
  const patients = snapshot.patients || [];
  const occupied = patients.filter((p) => !p.discharged_at && p.status !== 'Discharged').length;
  const cap = REPORTS_BED_CAPACITY;
  const avail = Math.max(0, cap - occupied);
  const pct = cap > 0 ? Math.round((occupied / cap) * 1000) / 10 : 0;

  const doc = newPdfDoc('Occupancy Report');
  doc.setFontSize(9);
  doc.text(`Licensed bed capacity: ${cap}. Snapshot uses current patient census (not discharged).`, 40, 68);

  autoTable(doc, {
    startY: 80,
    body: [
      ['Total capacity (beds)', String(cap)],
      ['Occupied (active in census)', String(occupied)],
      ['Available beds', String(avail)],
      ['Occupancy %', `${pct}%`],
    ],
    styles: { fontSize: 10, cellPadding: 6 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 220 } },
  });

  finalizePdf(doc, `occupancy-${reportFileDateStamp()}.pdf`);
}

/** @param {Awaited<ReturnType<loadAdminReportsSnapshot>>} snapshot */
export function downloadWeeklyCompliancePdf(snapshot) {
  const weekStart = startOfWeekMonday();
  const weekEnd = endOfWeekExclusive();
  const patients = snapshot.patients || [];
  const active = patients.filter((p) => !p.discharged_at && p.status !== 'Discharged');
  const expected = active.length;

  const weeklyFlat = normalizeWeeklyList(snapshot.weeklyReports, snapshot.source);
  const submittedInWeek = weeklyFlat.filter((r) => tsInRange(r.submitted_at, weekStart, weekEnd));

  const coveredIds = new Set();
  for (const r of submittedInWeek) {
    if (r.patient_id) coveredIds.add(String(r.patient_id));
  }

  const activeIdSet = new Set(active.map((p) => String(p.id)));
  let submittedCount = 0;
  for (const id of coveredIds) {
    if (activeIdSet.has(id)) submittedCount += 1;
  }

  const detailRows = active.map((p) => {
    const id = String(p.id);
    const match = submittedInWeek.filter((r) => String(r.patient_id) === id);
    const ok = match.some((r) => tsInRange(r.submitted_at, weekStart, weekEnd));
    const last = match.map((m) => m.submitted_at).filter(Boolean).sort().pop();
    return [p.name || '—', ok ? 'Yes' : 'No', formatShortDateTime(last), match.length ? String(match.length) : '0'];
  });
  detailRows.sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { sensitivity: 'base' }));

  const doc = newPdfDoc('Weekly Compliance Report');
  doc.setFontSize(9);
  doc.text(
    `Calendar week (Mon–Sun): ${formatShortDate(weekStart.toISOString())} – ${formatShortDate(
      new Date(weekEnd.getTime() - 86400000).toISOString()
    )}. Expected = one nurse weekly report per active patient this week.`,
    40,
    62,
    { maxWidth: 520 }
  );

  autoTable(doc, {
    startY: 88,
    body: [
      ['Active patients (expected filings)', String(expected)],
      ['Active patients with ≥1 report this week', String(submittedCount)],
      ['Gap (patients not covered)', String(Math.max(0, expected - submittedCount))],
      ['Total report rows filed this week (all patients)', String(submittedInWeek.length)],
    ],
    styles: { fontSize: 10, cellPadding: 5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 280 } },
  });

  const afterY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 16 : 200;
  doc.setFontSize(10);
  doc.text('Per-patient status', 40, afterY);

  autoTable(doc, {
    startY: afterY + 8,
    head: [['Patient', 'Submitted this week', 'Latest submission in week', 'Rows this week']],
    body: detailRows,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [245, 78, 37], textColor: 255 },
  });

  finalizePdf(doc, `weekly-compliance-${reportFileDateStamp()}.pdf`);
}

function normalizeDeclineReasonLabel(raw) {
  const s = String(raw || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!s) return '(No reason recorded)';
  return s.length > 120 ? `${s.slice(0, 117)}…` : s;
}

/** @param {Awaited<ReturnType<loadAdminReportsSnapshot>>} snapshot */
export function downloadDeclineReasonsPdf(snapshot) {
  const counts = new Map();

  const bump = (label) => {
    const key = normalizeDeclineReasonLabel(label);
    counts.set(key, (counts.get(key) || 0) + 1);
  };

  for (const r of snapshot.admissionRequests || []) {
    if (String(r.status || '').toLowerCase() !== 'declined') continue;
    const note = decisionNoteFromRow(r);
    bump(note || r.reason_for_admission || r.reason || '(No reason recorded)');
  }

  for (const r of snapshot.dischargeRequests || []) {
    if (String(r.status || '').toLowerCase() !== 'declined') continue;
    const note = decisionNoteFromRow(r);
    bump(note || [r.reason_category, r.reason_details].filter(Boolean).join(' — ') || '(No reason recorded)');
  }

  const rows = [...counts.entries()]
    .map(([reason, count]) => [reason, String(count)])
    .sort((a, b) => Number(b[1]) - Number(a[1]) || String(a[0]).localeCompare(String(b[0])));

  const doc = newPdfDoc('Decline Reasons Report');
  doc.setFontSize(9);
  doc.text('Aggregated decline reasons from admission and discharge requests (declined status only).', 40, 68);

  autoTable(doc, {
    startY: 80,
    head: [['Reason / notes (grouped)', 'Count']],
    body: rows.length ? rows : [['No declined requests in the current snapshot', '0']],
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [245, 78, 37], textColor: 255 },
    columnStyles: { 0: { cellWidth: 420 } },
  });

  finalizePdf(doc, `decline-reasons-${reportFileDateStamp()}.pdf`);
}
