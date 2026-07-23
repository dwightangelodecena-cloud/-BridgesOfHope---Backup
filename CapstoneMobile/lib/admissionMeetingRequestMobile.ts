import { supabase, isSupabaseConfigured } from './supabase';

export type AdmissionMeetingRow = {
  id: string;
  patientName: string;
  status: string;
  meetingDate: string;
  meetingTime: string;
  meetingCompleted: boolean;
  meetingConfirmedByFamily: boolean;
  preferredMeetingDate: string;
  preferredMeetingTime: string;
  preferredMeetingNote: string;
};

function mapRow(r: Record<string, unknown>): AdmissionMeetingRow {
  return {
    id: String(r.id),
    patientName: String(r.patient_name || ''),
    status: String(r.status || ''),
    meetingDate: String(r.meeting_date || ''),
    meetingTime: String(r.meeting_time || ''),
    meetingCompleted: Boolean(r.meeting_completed),
    meetingConfirmedByFamily: Boolean(r.meeting_confirmed_by_family),
    preferredMeetingDate: String(r.preferred_meeting_date || ''),
    preferredMeetingTime: String(r.preferred_meeting_time || ''),
    preferredMeetingNote: String(r.preferred_meeting_note || ''),
  };
}

/**
 * A specific admission request by id — use this whenever the caller already knows which
 * one (e.g. navigated from a specific patient's status card, or a notification's related_id).
 * A family can have more than one admission request (multiple children, resubmissions), so
 * guessing "the family's latest" can show the wrong patient's meeting details.
 */
export async function fetchAdmissionRequestById(requestId: string): Promise<AdmissionMeetingRow | null> {
  if (!isSupabaseConfigured() || !requestId) return null;
  const { data, error } = await supabase
    .from('admission_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

/** Fallback when no specific request id is known: the guardian's most recently submitted one. */
export async function fetchLatestAdmissionRequest(familyId: string): Promise<AdmissionMeetingRow | null> {
  if (!isSupabaseConfigured() || !familyId) return null;
  const { data, error } = await supabase
    .from('admission_requests')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

/** True while the guardian can propose (or re-propose) a meeting date/time. */
export function canProposeMeeting(row: AdmissionMeetingRow | null): boolean {
  if (!row) return false;
  const st = row.status.toLowerCase();
  return st === 'processing' || st === 'pending' || st === 'awaiting_schedule_review';
}

/** True while admin has suggested a time the guardian hasn't accepted or countered yet. */
export function isAwaitingFamilyMeetingResponse(row: AdmissionMeetingRow | null): boolean {
  return Boolean(row) && row!.status.toLowerCase() === 'awaiting_guardian_response';
}

async function updateRequest(requestId: string, patch: Record<string, unknown>): Promise<{ ok: true } | { ok: false; errorMessage: string }> {
  const { error } = await supabase.from('admission_requests').update(patch).eq('id', requestId);
  if (error) return { ok: false, errorMessage: error.message || 'Could not update your request.' };
  return { ok: true };
}

/** Guardian proposes a meeting date/time (first ask, or re-proposing after declining admin's suggestion). */
export async function submitMeetingProposal(
  requestId: string,
  { date, time, note }: { date: string; time: string; note?: string }
) {
  return updateRequest(requestId, {
    preferred_meeting_date: date,
    preferred_meeting_time: time,
    preferred_meeting_note: note || null,
    preferred_meeting_submitted_at: new Date().toISOString(),
    status: 'awaiting_schedule_review',
  });
}

/** Guardian accepts admin's suggested meeting date/time as-is. */
export async function acceptSuggestedMeetingTime(requestId: string) {
  return updateRequest(requestId, {
    meeting_confirmed_by_family: true,
    status: 'processing',
  });
}
