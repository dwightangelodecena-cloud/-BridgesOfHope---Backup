import { supabase } from './supabase';

export function filterRowsForFamilyUser<T extends { family_id?: unknown }>(
  rows: T[] | null | undefined,
  familyUserId: string | null | undefined
): T[] {
  if (!familyUserId) return [];
  const uid = String(familyUserId);
  return (rows || []).filter((row) => String(row?.family_id) === uid);
}

export function visibleFamilyAdmissionRequests<T extends { family_id?: unknown }>(
  rows: T[] | null | undefined,
  familyUserId: string | null | undefined
): T[] {
  return filterRowsForFamilyUser(rows, familyUserId);
}

export async function fetchFamilyAdmissionRequests(familyUserId: string): Promise<Record<string, unknown>[]> {
  if (!familyUserId) return [];
  const { data, error } = await supabase
    .from('admission_requests')
    .select('*')
    .eq('family_id', familyUserId)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[familyAdmissionRequests]', error.message);
    return [];
  }
  return filterRowsForFamilyUser(data as Record<string, unknown>[], familyUserId);
}
