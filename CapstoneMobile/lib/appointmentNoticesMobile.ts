import { supabase, isSupabaseConfigured } from './supabase';

export type AppointmentNotice =
  | {
      kind: 'meeting';
      type: 'admission' | 'pickup';
      id: string;
      patientId: string;
      patientName: string;
      date: string;
      time: string;
    }
  | {
      kind: 'pickup_received';
      patientId: string;
      patientName: string;
    };

/**
 * A guardian's pending appointment notices for the Visits tab: admin-set meeting times awaiting
 * confirm/reject, plus (for discharge) a prompt to confirm an already-confirmed pickup happened.
 */
export async function fetchAppointmentNotices(familyId: string): Promise<AppointmentNotice[]> {
  if (!isSupabaseConfigured() || !familyId) return [];

  const [{ data: admissionRows }, { data: patientRows }] = await Promise.all([
    supabase
      .from('admission_requests')
      .select('id, patient_name, meeting_date, meeting_time, status, meeting_rejected_at')
      .eq('family_id', familyId)
      .eq('status', 'awaiting_guardian_response')
      .is('meeting_rejected_at', null),
    supabase
      .from('patients')
      .select(
        'id, full_name, pickup_meeting_date, pickup_meeting_time, pickup_meeting_confirmed_by_family, pickup_meeting_rejected_at, pickup_family_confirmed_at, pickup_completed_at'
      )
      .eq('family_id', familyId)
      .is('discharged_at', null),
  ]);

  const notices: AppointmentNotice[] = [];

  (admissionRows || []).forEach((r) => {
    notices.push({
      kind: 'meeting',
      type: 'admission',
      id: String(r.id),
      patientId: '',
      patientName: String(r.patient_name || ''),
      date: String(r.meeting_date || ''),
      time: String(r.meeting_time || ''),
    });
  });

  (patientRows || []).forEach((p) => {
    const patientId = String(p.id);
    const patientName = String(p.full_name || '');
    if (
      p.pickup_meeting_date &&
      !p.pickup_meeting_confirmed_by_family &&
      !p.pickup_meeting_rejected_at &&
      !p.pickup_completed_at
    ) {
      notices.push({
        kind: 'meeting',
        type: 'pickup',
        id: patientId,
        patientId,
        patientName,
        date: String(p.pickup_meeting_date || ''),
        time: String(p.pickup_meeting_time || ''),
      });
    }
    if (p.pickup_meeting_confirmed_by_family && !p.pickup_family_confirmed_at && !p.pickup_completed_at) {
      notices.push({ kind: 'pickup_received', patientId, patientName });
    }
  });

  return notices;
}
