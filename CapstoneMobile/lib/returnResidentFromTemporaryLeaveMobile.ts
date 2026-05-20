import { supabase, isSupabaseConfigured } from './supabase';
import { appendActivityFeed } from './activityFeed';
import { isPatientOnTemporaryLeave } from './dischargeRequestTypesMobile';
import { markTemporaryLeaveReturnedOnRequest } from './temporaryLeaveSyncMobile';

export async function returnResidentFromTemporaryLeave(patient: Record<string, unknown>) {
  const patientId = patient?.id;
  if (!patientId) return { ok: false as const, error: 'Missing resident id.' };
  const onLeave =
    isPatientOnTemporaryLeave(patient) ||
    patient?.activeTemporaryDischargeRequestId ||
    patient?._temporaryLeaveFromRequest;
  if (!onLeave) {
    return { ok: false as const, error: 'This resident is not on temporary discharge.' };
  }

  const displayName = String(patient.name || patient.full_name || 'Resident');

  if (!isSupabaseConfigured()) {
    return { ok: false as const, error: 'Supabase is not configured.' };
  }

  const patch = {
    temporary_discharge_at: null,
    temporary_discharge_until: null,
    temporary_discharge_expected_return: null,
    temporary_leave_type: null,
  };
  let { data, error } = await supabase.from('patients').update(patch).eq('id', patientId).select('id');
  if (error && /column|schema cache|does not exist|PGRST204/i.test(error.message)) {
    ({ data, error } = await supabase
      .from('patients')
      .update({ temporary_discharge_at: null })
      .eq('id', patientId)
      .select('id'));
  }
  if (error) return { ok: false as const, error: error.message || 'Could not update resident record.' };
  if (!data?.length) {
    return { ok: false as const, error: 'Resident record was not updated.' };
  }

  await markTemporaryLeaveReturnedOnRequest(String(patientId));
  await appendActivityFeed(
    `${displayName} has returned to the facility and is no longer on temporary discharge.`,
    { familyId: (patient.family_id ?? patient.familyId) as string | undefined }
  );

  return { ok: true as const };
}
