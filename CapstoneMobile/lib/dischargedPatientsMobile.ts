import { supabase, isSupabaseConfigured } from './supabase';

export type DischargedPatientIdentity = {
  ids: Set<string>;
  names: Set<string>;
};

function normalizeName(name: unknown): string {
  return String(name || '').trim().toLowerCase();
}

/**
 * A family's discharged resident ids + normalized names, for filtering old request rows
 * (appointment status, admission requests) out of the guardian's active-facing screens once a
 * resident is discharged. Names are needed too because admission_requests has no patient_id
 * column — only patient_name text (same reason the web side does name-based matching in
 * BRIDGESOFHOPE's admissionDischargeStore.js).
 */
export async function fetchDischargedPatientIdentity(familyId: string): Promise<DischargedPatientIdentity> {
  if (!isSupabaseConfigured() || !familyId) return { ids: new Set(), names: new Set() };
  const { data } = await supabase
    .from('patients')
    .select('id, full_name')
    .eq('family_id', familyId)
    .not('discharged_at', 'is', null);
  return {
    ids: new Set((data || []).map((r) => String(r.id))),
    names: new Set((data || []).map((r) => normalizeName(r.full_name))),
  };
}
