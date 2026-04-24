import { supabase } from '@/lib/supabase';

/**
 * Approve a pending admission_request and create the patients row.
 * Supports UI objects from dbMappers (uiAdmissionRequestFromRow) or admission-management rows (buildAdmissionRow).
 *
 * @returns {{ ok: true } | { ok: false, errorMessage: string }}
 */
export async function approveAdmissionInDatabase(req) {
  const raw = req.rawAdmission;
  const admissionId = req.requestId ?? req.id ?? raw?.id;
  const family_id = req.family_id ?? req.familyId ?? raw?.family_id;
  const patient_name =
    req.patient_name ?? req.patientName ?? req.name ?? raw?.patient_name;
  const patient_birth_date =
    req.patient_birth_date ?? req.patientBirthDate ?? raw?.patient_birth_date;
  const patient_gender =
    req.patient_gender ?? req.patientGender ?? raw?.patient_gender;
  const reason_for_admission =
    req.reason_for_admission ?? req.reason ?? raw?.reason_for_admission;

  if (!admissionId) {
    return { ok: false, errorMessage: 'Missing admission request id. Reload and try again.' };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, errorMessage: 'You are not signed in. Log in again as admin.' };
  }

  let decidedBy = user.id;
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  if (!profileRow) decidedBy = null;

  const decidedAt = new Date().toISOString();

  const { data: admissionUpdated, error: upErr } = await supabase
    .from('admission_requests')
    .update({ status: 'approved', decided_at: decidedAt, decided_by: decidedBy })
    .eq('id', admissionId)
    .eq('status', 'pending')
    .select('id');

  if (upErr) {
    return { ok: false, errorMessage: upErr.message || 'Could not approve admission request.' };
  }

  if (!admissionUpdated?.length) {
    return {
      ok: false,
      errorMessage:
        'Could not approve: no pending row was updated. Often this means your login does not have staff rights (JWT missing account_type admin/nurse). In Supabase → Authentication → Users → your admin user → set User Metadata: { "account_type": "admin" }, then log out and log back in. Or the request was already approved.',
    };
  }

  const patientInsert = {
    full_name: patient_name,
    date_of_birth: patient_birth_date || null,
    gender: patient_gender || null,
    primary_concern: reason_for_admission || null,
    clinical_status: 'Stable',
    progress_percent: 0,
    family_id,
    admitted_at: decidedAt,
    discharged_at: null,
  };
  let { error: insErr } = await supabase.from('patients').insert(patientInsert);
  if (insErr && /column|schema cache|does not exist|PGRST204/i.test(insErr.message || '')) {
    const fallbackInsert = {
      full_name: patient_name,
      date_of_birth: patient_birth_date || null,
      primary_concern: reason_for_admission || null,
      clinical_status: 'Stable',
      progress_percent: 0,
      family_id,
      admitted_at: decidedAt,
      discharged_at: null,
    };
    ({ error: insErr } = await supabase.from('patients').insert(fallbackInsert));
  }

  if (insErr) {
    return { ok: false, errorMessage: insErr.message || 'Could not create patient record.' };
  }

  return { ok: true };
}
