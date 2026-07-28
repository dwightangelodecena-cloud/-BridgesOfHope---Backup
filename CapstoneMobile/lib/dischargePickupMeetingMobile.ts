import { supabase, isSupabaseConfigured } from './supabase';

export type PickupMeetingRow = {
  patientId: string;
  patientName: string;
  pickupMeetingDate: string;
  pickupMeetingTime: string;
  pickupMeetingConfirmedByFamily: boolean;
  pickupMeetingRejectedAt: string;
  pickupMeetingRejectedReason: string;
  pickupCompletedAt: string;
  pickupFamilyConfirmedAt: string;
};

function mapRow(r: Record<string, unknown>): PickupMeetingRow {
  return {
    patientId: String(r.id),
    patientName: String(r.full_name || ''),
    pickupMeetingDate: String(r.pickup_meeting_date || ''),
    pickupMeetingTime: String(r.pickup_meeting_time || ''),
    pickupMeetingConfirmedByFamily: Boolean(r.pickup_meeting_confirmed_by_family),
    pickupMeetingRejectedAt: String(r.pickup_meeting_rejected_at || ''),
    pickupMeetingRejectedReason: String(r.pickup_meeting_rejected_reason || ''),
    pickupCompletedAt: String(r.pickup_completed_at || ''),
    pickupFamilyConfirmedAt: String(r.pickup_family_confirmed_at || ''),
  };
}

export async function fetchPatientPickupMeeting(patientId: string): Promise<PickupMeetingRow | null> {
  if (!isSupabaseConfigured() || !patientId) return null;
  const { data, error } = await supabase.from('patients').select('*').eq('id', patientId).maybeSingle();
  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

/** True while there's a scheduled pickup time the guardian hasn't confirmed or rejected yet. */
export function isAwaitingFamilyPickupResponse(row: PickupMeetingRow | null): boolean {
  if (!row) return false;
  return Boolean(row.pickupMeetingDate) && !row.pickupMeetingConfirmedByFamily && !row.pickupMeetingRejectedAt && !row.pickupCompletedAt;
}

/** True once the meeting is confirmed but the guardian hasn't yet told us they picked the resident up. */
export function canConfirmPickupReceived(row: PickupMeetingRow | null): boolean {
  if (!row) return false;
  return row.pickupMeetingConfirmedByFamily && !row.pickupFamilyConfirmedAt && !row.pickupCompletedAt;
}

async function callRpc(fn: string, args: Record<string, unknown>): Promise<{ ok: true } | { ok: false; errorMessage: string }> {
  const { error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, errorMessage: error.message || 'Could not save your response.' };
  return { ok: true };
}

export async function confirmPickupMeeting(patientId: string) {
  return callRpc('bh_family_confirm_pickup_meeting', { p_patient_id: patientId });
}

export async function rejectPickupMeeting(patientId: string, reason: string) {
  return callRpc('bh_family_reject_pickup_meeting', { p_patient_id: patientId, p_reason: reason });
}

export async function confirmPickupReceived(patientId: string) {
  return callRpc('bh_family_confirm_pickup_received', { p_patient_id: patientId });
}
