import { supabase } from './supabase';

const SCHEMA_ERROR = /column|schema cache|does not exist|PGRST204/i;

function isSchemaError(message: string | undefined): boolean {
  return SCHEMA_ERROR.test(String(message || ''));
}

export async function insertAdmissionRequest(
  rowVariants: Record<string, unknown>[]
): Promise<{ ok: true; id: string } | { ok: false; errorMessage: string }> {
  let lastError: { message?: string } | null = null;
  for (const row of rowVariants) {
    if (!row || typeof row !== 'object') continue;
    const { data, error } = await supabase
      .from('admission_requests')
      .insert(row)
      .select('id')
      .maybeSingle();
    if (!error && data?.id) {
      return { ok: true, id: String(data.id) };
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

export async function patchAdmissionRequestGender(admissionId: string, patientGender: string): Promise<void> {
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
