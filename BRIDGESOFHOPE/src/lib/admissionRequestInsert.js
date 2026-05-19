import { supabase } from '@/lib/supabase';

const SCHEMA_ERROR = /column|schema cache|does not exist|PGRST204/i;

function isSchemaError(message) {
  return SCHEMA_ERROR.test(String(message || ''));
}

/**
 * Insert an admission_requests row, trying progressively smaller payloads so
 * patient_gender is not dropped when optional guardian address columns are missing.
 *
 * @returns {{ ok: true, id: string } | { ok: false, errorMessage: string }}
 */
export async function insertAdmissionRequest(rowVariants) {
  let lastError = null;
  for (const row of rowVariants) {
    if (!row || typeof row !== 'object') continue;
    const { data, error } = await supabase
      .from('admission_requests')
      .insert(row)
      .select('id')
      .maybeSingle();
    if (!error && data?.id) {
      return { ok: true, id: data.id };
    }
    lastError = error;
    if (!error || !isSchemaError(error.message)) {
      break;
    }
  }
  return {
    ok: false,
    errorMessage: lastError?.message || 'Could not submit admission request.',
  };
}

/**
 * After a successful insert, persist patient_gender when the initial row omitted it.
 */
export async function patchAdmissionRequestGender(admissionId, patientGender) {
  const gender = String(patientGender || '').trim();
  if (!admissionId || !gender) return;
  const { error } = await supabase
    .from('admission_requests')
    .update({ patient_gender: gender })
    .eq('id', admissionId);
  if (error && !isSchemaError(error.message)) {
    console.warn('[admission] patient_gender patch:', error.message);
  }
}
