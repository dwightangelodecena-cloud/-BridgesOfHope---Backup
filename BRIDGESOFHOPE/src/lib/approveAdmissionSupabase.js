import { supabase } from '@/lib/supabase';
import { normalizedRoomSegmentFromGender, persistResidentPlacement } from '@/lib/residentPlacement';
import { insertFamilyNotification } from '@/lib/notificationTemplates';

/**
 * Approve a pending admission_request and create the patients row.
 * Supports UI objects from dbMappers (uiAdmissionRequestFromRow) or admission-management rows (buildAdmissionRow).
 *
 * @returns {{ ok: true } | { ok: false, errorMessage: string }}
 */
export async function approveAdmissionInDatabase(req) {
  const raw = req.rawAdmission;
  const admissionId = req.requestId ?? req.id ?? raw?.id;

  if (!admissionId) {
    return { ok: false, errorMessage: 'Missing admission request id. Reload and try again.' };
  }

  let dbAdmission = raw && raw.id === admissionId ? raw : null;
  if (!dbAdmission?.patient_gender) {
    const { data: fetched } = await supabase
      .from('admission_requests')
      .select('*')
      .eq('id', admissionId)
      .maybeSingle();
    if (fetched) dbAdmission = fetched;
  }

  const family_id =
    req.family_id ?? req.familyId ?? dbAdmission?.family_id ?? raw?.family_id;
  const patient_name =
    req.patient_name ?? req.patientName ?? req.name ?? dbAdmission?.patient_name ?? raw?.patient_name;
  const patient_birth_date =
    req.patient_birth_date ?? req.patientBirthDate ?? dbAdmission?.patient_birth_date ?? raw?.patient_birth_date;
  const patient_gender =
    dbAdmission?.patient_gender
    ?? req.patient_gender
    ?? req.patientGender
    ?? raw?.patient_gender;
  const reason_for_admission =
    req.reason_for_admission ?? req.reason ?? dbAdmission?.reason_for_admission ?? raw?.reason_for_admission;

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

  const genderNorm =
    normalizedRoomSegmentFromGender(patient_gender) || String(patient_gender || '').trim() || null;

  const admissionPatch = {
    status: 'approved',
    decided_at: decidedAt,
    decided_by: decidedBy,
  };
  if (genderNorm) admissionPatch.patient_gender = genderNorm;

  const { data: admissionUpdated, error: upErr } = await supabase
    .from('admission_requests')
    .update(admissionPatch)
    .eq('id', admissionId)
    .in('status', ['pending', 'processing', 'in_review'])
    .select('id');

  if (upErr) {
    return { ok: false, errorMessage: upErr.message || 'Could not approve admission request.' };
  }

  if (!admissionUpdated?.length) {
    const st = String(dbAdmission?.status || '').toLowerCase();
    if (st === 'in_review' && !dbAdmission?.documents_complete) {
      return {
        ok: false,
        errorMessage: 'Cannot admit: required documents are not complete. Ask the family to upload missing files first.',
      };
    }
    if ((st === 'processing' || st === 'pending') && !dbAdmission?.meeting_completed) {
      return {
        ok: false,
        errorMessage: 'Cannot admit yet: schedule and complete the family meeting first.',
      };
    }
    return {
      ok: false,
      errorMessage:
        'Could not approve: no eligible row was updated. Often this means your login does not have staff rights (JWT missing account_type admin/nurse). In Supabase → Authentication → Users → your admin user → set User Metadata: { "account_type": "admin" }, then log out and log back in. Or the request was already approved.',
    };
  }

  const patientInsert = {
    full_name: patient_name,
    date_of_birth: patient_birth_date || null,
    gender: genderNorm,
    primary_concern: reason_for_admission || null,
    clinical_status: 'Stable',
    progress_percent: 0,
    family_id,
    admitted_at: decidedAt,
    discharged_at: null,
  };
  let insertedPatientId = null;
  let { data: insertedPatient, error: insErr } = await supabase
    .from('patients')
    .insert(patientInsert)
    .select('id')
    .maybeSingle();
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
    ({ data: insertedPatient, error: insErr } = await supabase
      .from('patients')
      .insert(fallbackInsert)
      .select('id')
      .maybeSingle());
  }

  if (insErr) {
    return { ok: false, errorMessage: insErr.message || 'Could not create patient record.' };
  }

  insertedPatientId = insertedPatient?.id ?? null;

  if (genderNorm && insertedPatientId) {
    await persistResidentPlacement({
      patientId: insertedPatientId,
      admissionRequestId: admissionId,
      gender: genderNorm,
    });
  } else if (genderNorm) {
    await supabase
      .from('admission_requests')
      .update({ patient_gender: genderNorm })
      .eq('id', admissionId);
  }

  if (family_id) {
    void insertFamilyNotification({
      familyId: family_id,
      templateKey: 'admission_approved',
      vars: { patient_name: patient_name },
      relatedType: 'admission_request',
      relatedId: admissionId,
    });
  }

  return { ok: true };
}
