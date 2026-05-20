import { supabase, isSupabaseConfigured } from './supabase';
import {
  computeTemporaryLeaveUntil,
  isTemporaryDischargeRequest,
  mergePatientTemporaryDischargeFields,
} from './dischargeRequestTypesMobile';

export type TemporaryLeaveFields = {
  temporaryDischargeAt: string;
  temporary_discharge_at: string;
  temporaryLeaveType: string;
  temporary_leave_type: string;
  temporaryDischargeUntil: string | null;
  temporary_discharge_until: string | null;
  temporaryDischargeExpectedReturn: string | null;
  temporary_discharge_expected_return: string | null;
  activeTemporaryDischargeRequestId?: string;
  decisionNote?: string | null;
  decision_note?: string | null;
  reasonDetails?: string | null;
  reason_details?: string | null;
  otherInfo?: string | null;
  other_info?: string | null;
};

export function temporaryLeaveFieldsFromDischargeRequest(
  row: Record<string, unknown> | null
): TemporaryLeaveFields | null {
  if (!row || String(row.status || '').toLowerCase() !== 'approved') return null;
  if (!isTemporaryDischargeRequest(row as { discharge_type?: string })) return null;
  if (row.leave_returned_at != null && String(row.leave_returned_at).trim() !== '') return null;
  const decidedAt = row.decided_at;
  if (!decidedAt || String(decidedAt).trim() === '') return null;
  const leaveTypeId = String(row.temporary_leave_type || 'day_off_24h');
  const leaveUntilIso = computeTemporaryLeaveUntil(leaveTypeId, String(decidedAt));
  const expectedReturn =
    row.preferred_discharge_date && String(row.preferred_discharge_date).trim()
      ? String(row.preferred_discharge_date).trim().slice(0, 10)
      : leaveUntilIso
        ? leaveUntilIso.slice(0, 10)
        : null;
  return {
    temporaryDischargeAt: String(decidedAt),
    temporary_discharge_at: String(decidedAt),
    temporaryLeaveType: leaveTypeId,
    temporary_leave_type: leaveTypeId,
    temporaryDischargeUntil: leaveUntilIso,
    temporary_discharge_until: leaveUntilIso,
    temporaryDischargeExpectedReturn: expectedReturn,
    temporary_discharge_expected_return: expectedReturn,
    activeTemporaryDischargeRequestId: row.id != null ? String(row.id) : undefined,
    decisionNote: row.decision_note != null ? String(row.decision_note) : null,
    decision_note: row.decision_note != null ? String(row.decision_note) : null,
    reasonDetails: row.reason_details != null ? String(row.reason_details) : null,
    reason_details: row.reason_details != null ? String(row.reason_details) : null,
    otherInfo: row.other_info != null ? String(row.other_info) : null,
    other_info: row.other_info != null ? String(row.other_info) : null,
  };
}

const DISCHARGE_LEAVE_SELECT =
  'id, patient_id, family_id, status, discharge_type, decided_at, temporary_leave_type, preferred_discharge_date, leave_returned_at, decision_note, reason_details, reason_category, other_info';

function pickActiveLeaveFromRows(data: Record<string, unknown>[] | null) {
  if (!data?.length) return null;
  for (const row of data) {
    const fields = temporaryLeaveFieldsFromDischargeRequest(row);
    if (fields) return fields;
  }
  return null;
}

export async function fetchActiveTemporaryLeaveFromRequests(
  patientId: string,
  options: { familyId?: string; patientName?: string } = {}
) {
  if (!isSupabaseConfigured()) return null;
  const pid = patientId ? String(patientId) : '';
  const familyId = options.familyId ? String(options.familyId) : '';
  const patientName = String(options.patientName || '').trim().toLowerCase();

  if (pid) {
    let { data, error } = await supabase
      .from('discharge_requests')
      .select(DISCHARGE_LEAVE_SELECT)
      .eq('patient_id', pid)
      .eq('status', 'approved')
      .order('decided_at', { ascending: false })
      .limit(10);
    if (error && /leave_returned_at|decision_note|column|schema cache|does not exist/i.test(error.message)) {
      ({ data, error } = await supabase
        .from('discharge_requests')
        .select(
          'id, patient_id, family_id, status, discharge_type, decided_at, temporary_leave_type, preferred_discharge_date, decision_note, reason_details, other_info'
        )
        .eq('patient_id', pid)
        .eq('status', 'approved')
        .order('decided_at', { ascending: false })
        .limit(10));
    }
    if (!error && data?.length) {
      const picked = pickActiveLeaveFromRows(data as Record<string, unknown>[]);
      if (picked) return picked;
    }
  }

  if (!familyId) return null;

  const { data: familyRows, error: famErr } = await supabase
    .from('discharge_requests')
    .select(`${DISCHARGE_LEAVE_SELECT}, patients(full_name)`)
    .eq('family_id', familyId)
    .eq('status', 'approved')
    .order('decided_at', { ascending: false })
    .limit(25);

  if (famErr || !familyRows?.length) return null;

  const filtered = (familyRows as Record<string, unknown>[]).filter((row) => {
    if (pid && String(row.patient_id) === pid) return true;
    if (!patientName) return false;
    const patients = row.patients as { full_name?: string } | null;
    return String(patients?.full_name || '').trim().toLowerCase() === patientName;
  });

  return pickActiveLeaveFromRows(filtered);
}

export async function syncPatientTemporaryLeaveFromRequests(
  patientId: string,
  options: { familyId?: string; patientName?: string } = {}
) {
  if (!patientId || !isSupabaseConfigured()) return { ok: false as const, synced: false };
  const fromRequest = await fetchActiveTemporaryLeaveFromRequests(patientId, options);
  if (!fromRequest?.temporary_discharge_at) {
    return { ok: true as const, synced: false, fields: null as TemporaryLeaveFields | null };
  }

  const { data: existing, error: readErr } = await supabase
    .from('patients')
    .select('temporary_discharge_at, discharged_at')
    .eq('id', patientId)
    .maybeSingle();
  if (readErr) return { ok: false as const, error: readErr.message, synced: false };
  if (existing?.discharged_at) {
    return { ok: true as const, synced: false, fields: null };
  }
  if (existing?.temporary_discharge_at) {
    return { ok: true as const, synced: false, fields: fromRequest };
  }

  const patch = {
    temporary_discharge_at: fromRequest.temporary_discharge_at,
    temporary_discharge_expected_return: fromRequest.temporary_discharge_expected_return,
    temporary_discharge_until: fromRequest.temporary_discharge_until,
    temporary_leave_type: fromRequest.temporary_leave_type,
  };
  let { error: upErr } = await supabase.from('patients').update(patch).eq('id', patientId);
  if (upErr && /column|schema cache|does not exist|PGRST204/i.test(upErr.message)) {
    ({ error: upErr } = await supabase
      .from('patients')
      .update({ temporary_discharge_at: fromRequest.temporary_discharge_at })
      .eq('id', patientId));
  }
  if (upErr) return { ok: false as const, error: upErr.message, fields: fromRequest, synced: false };
  return { ok: true as const, synced: true, fields: fromRequest };
}

export async function markTemporaryLeaveReturnedOnRequest(patientId: string) {
  if (!patientId || !isSupabaseConfigured()) return;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('discharge_requests')
    .update({ leave_returned_at: now })
    .eq('patient_id', patientId)
    .eq('status', 'approved')
    .is('leave_returned_at', null);
  if (error && !/leave_returned_at|column|does not exist/i.test(error.message)) {
    console.warn('[temporaryLeaveSyncMobile] mark returned:', error.message);
  }
}

export function mergePatientWithRequestTemporaryLeave<T extends Record<string, unknown>>(
  patient: T | null | undefined,
  requestFields: TemporaryLeaveFields | null
): T | null | undefined {
  if (!patient) return patient;
  const merged = mergePatientTemporaryDischargeFields(patient) as T;
  if (merged.temporaryDischargeAt || merged.temporary_discharge_at) return merged;
  if (!requestFields) return merged;
  return mergePatientTemporaryDischargeFields(merged, requestFields) as T;
}
