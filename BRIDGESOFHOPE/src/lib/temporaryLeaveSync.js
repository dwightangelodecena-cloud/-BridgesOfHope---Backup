import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  computeTemporaryLeaveUntil,
  isTemporaryDischargeRequest,
  mergePatientTemporaryDischargeFields,
} from '@/lib/dischargeRequestTypes';

/** Build temporary-leave fields from an approved discharge_requests row. */
export function temporaryLeaveFieldsFromDischargeRequest(row) {
  if (!row || String(row.status || '').toLowerCase() !== 'approved') return null;
  if (!isTemporaryDischargeRequest(row)) return null;
  if (row.leave_returned_at != null && String(row.leave_returned_at).trim() !== '') return null;
  const decidedAt = row.decided_at;
  if (!decidedAt || String(decidedAt).trim() === '') return null;
  const leaveTypeId = row.temporary_leave_type || 'day_off_24h';
  const leaveUntilIso = computeTemporaryLeaveUntil(leaveTypeId, decidedAt);
  const expectedReturn =
    row.preferred_discharge_date && String(row.preferred_discharge_date).trim()
      ? String(row.preferred_discharge_date).trim().slice(0, 10)
      : leaveUntilIso
        ? leaveUntilIso.slice(0, 10)
        : null;
  return {
    temporaryDischargeAt: decidedAt,
    temporary_discharge_at: decidedAt,
    temporaryLeaveType: leaveTypeId,
    temporary_leave_type: leaveTypeId,
    temporaryDischargeUntil: leaveUntilIso,
    temporary_discharge_until: leaveUntilIso,
    temporaryDischargeExpectedReturn: expectedReturn,
    temporary_discharge_expected_return: expectedReturn,
    activeTemporaryDischargeRequestId: row.id,
  };
}

/**
 * Latest approved temporary leave for a resident (used when patients.temporary_discharge_at was not set).
 */
export async function fetchActiveTemporaryLeaveFromRequests(patientId) {
  if (!patientId || !isSupabaseConfigured()) return null;
  const baseSelect =
    'id, patient_id, status, discharge_type, decided_at, temporary_leave_type, preferred_discharge_date, leave_returned_at';
  let { data, error } = await supabase
    .from('discharge_requests')
    .select(baseSelect)
    .eq('patient_id', patientId)
    .eq('status', 'approved')
    .order('decided_at', { ascending: false })
    .limit(10);
  if (error && /leave_returned_at|column|schema cache|does not exist/i.test(error.message)) {
    ({ data, error } = await supabase
      .from('discharge_requests')
      .select('id, patient_id, status, discharge_type, decided_at, temporary_leave_type, preferred_discharge_date')
      .eq('patient_id', patientId)
      .eq('status', 'approved')
      .order('decided_at', { ascending: false })
      .limit(10));
  }
  if (error || !data?.length) return null;
  for (const row of data) {
    const fields = temporaryLeaveFieldsFromDischargeRequest(row);
    if (fields) return fields;
  }
  return null;
}

/** Copy approved temporary leave onto patients row when approval did not update the resident. */
export async function syncPatientTemporaryLeaveFromRequests(patientId) {
  if (!patientId || !isSupabaseConfigured()) return { ok: false, synced: false };
  const fromRequest = await fetchActiveTemporaryLeaveFromRequests(patientId);
  if (!fromRequest?.temporary_discharge_at) return { ok: true, synced: false, fields: null };

  const { data: existing, error: readErr } = await supabase
    .from('patients')
    .select('temporary_discharge_at, discharged_at')
    .eq('id', patientId)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (existing?.discharged_at) return { ok: true, synced: false, fields: null };
  if (existing?.temporary_discharge_at) {
    return { ok: true, synced: false, fields: fromRequest };
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
  if (upErr) return { ok: false, error: upErr.message, fields: fromRequest };
  return { ok: true, synced: true, fields: fromRequest };
}

export async function markTemporaryLeaveReturnedOnRequest(patientId) {
  if (!patientId || !isSupabaseConfigured()) return;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('discharge_requests')
    .update({ leave_returned_at: now })
    .eq('patient_id', patientId)
    .eq('status', 'approved')
    .is('leave_returned_at', null);
  if (error && !/leave_returned_at|column|does not exist/i.test(error.message)) {
    console.warn('[temporaryLeaveSync] mark returned:', error.message);
  }
}

export function mergePatientWithRequestTemporaryLeave(patient, requestFields) {
  if (!patient) return patient;
  const merged = mergePatientTemporaryDischargeFields(patient);
  if (merged.temporaryDischargeAt || merged.temporary_discharge_at) return merged;
  if (!requestFields) return merged;
  return mergePatientTemporaryDischargeFields(merged, requestFields);
}
