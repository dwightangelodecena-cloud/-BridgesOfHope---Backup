import { supabase } from '@/lib/supabase';
import { insertFamilyNotification } from '@/lib/notificationTemplates';
import { showErrorToast } from '@/lib/toastBus';

/** Admin can schedule/reschedule a pickup meeting any time before the resident is actually picked up. */
export function canCallForPickup(patient) {
  return !patient?.pickup_completed_at;
}

export function isAwaitingFamilyPickupConfirmation(patient) {
  return (
    Boolean(patient?.pickup_meeting_date) &&
    !patient?.pickup_meeting_confirmed_by_family &&
    !patient?.pickup_completed_at
  );
}

export function canMarkPickedUp(patient) {
  return Boolean(patient?.pickup_meeting_confirmed_by_family) && !patient?.pickup_completed_at;
}

/**
 * Schedules (or reschedules) a discharge pickup meeting and notifies the guardian.
 * @returns {{ ok: true } | { ok: false, errorMessage: string }}
 */
export async function schedulePickupMeeting({ patientId, familyId, patientName, date, time, confirmedByPhone }) {
  if (!patientId || !date) {
    return { ok: false, errorMessage: 'Choose a pickup date.' };
  }
  const { error } = await supabase
    .from('patients')
    .update({
      pickup_meeting_date: date,
      pickup_meeting_time: time || null,
      pickup_meeting_scheduled_at: new Date().toISOString(),
      pickup_meeting_confirmed_by_family: Boolean(confirmedByPhone),
      pickup_meeting_rejected_at: null,
      pickup_meeting_rejected_reason: null,
    })
    .eq('id', patientId);
  if (error) {
    return { ok: false, errorMessage: error.message || 'Could not schedule pickup meeting.' };
  }

  if (familyId) {
    const notifyRes = await insertFamilyNotification({
      familyId,
      templateKey: 'discharge_pickup_scheduled',
      vars: { patient_name: patientName, pickup_date: date, pickup_time: time || '' },
      relatedType: 'discharge_pickup',
      relatedId: patientId,
    });
    // The date/time IS saved at this point — only the guardian notification failed. Surface it
    // rather than letting admin believe the guardian was told when they weren't.
    if (!notifyRes.ok) {
      showErrorToast(
        `Pickup was scheduled, but the guardian notification failed to send: ${notifyRes.errorMessage || 'unknown error'}`
      );
    }
  }

  return { ok: true };
}

/**
 * Marks the already-scheduled pickup meeting as confirmed by the family (e.g. after a phone call),
 * without changing the date/time or re-notifying the guardian.
 * @returns {{ ok: true } | { ok: false, errorMessage: string }}
 */
export async function markPickupConfirmed(patientId) {
  if (!patientId) return { ok: false, errorMessage: 'Missing resident id.' };
  const { error } = await supabase
    .from('patients')
    .update({ pickup_meeting_confirmed_by_family: true })
    .eq('id', patientId);
  if (error) {
    return { ok: false, errorMessage: error.message || 'Could not mark pickup as confirmed.' };
  }
  return { ok: true };
}

/** @returns {{ ok: true } | { ok: false, errorMessage: string }} */
export async function markPickupCompleted(patientId) {
  if (!patientId) return { ok: false, errorMessage: 'Missing resident id.' };
  const { error } = await supabase
    .from('patients')
    .update({ pickup_completed_at: new Date().toISOString() })
    .eq('id', patientId);
  if (error) {
    return { ok: false, errorMessage: error.message || 'Could not mark resident as picked up.' };
  }
  return { ok: true };
}
