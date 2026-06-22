import { supabase } from '@/lib/supabase';

export function filterRowsForFamilyUser(rows, familyUserId) {
  if (!familyUserId) return [];
  const uid = String(familyUserId);
  return (rows || []).filter((row) => String(row?.family_id) === uid);
}

/** Rows to show under "Submitted Admission Requests" for the logged-in family user. */
export function visibleFamilyAdmissionRequests(rows, familyUserId) {
  return filterRowsForFamilyUser(rows, familyUserId);
}

export async function fetchFamilyAdmissionRequests(familyUserId) {
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
  return filterRowsForFamilyUser(data, familyUserId);
}
