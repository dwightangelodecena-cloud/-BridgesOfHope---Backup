import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const STAFF_ASSIGNMENT_STORAGE_KEY = 'bh_patient_staff_assignments_v1';

function loadStaffAssignmentOverrides() {
  try {
    const raw = localStorage.getItem(STAFF_ASSIGNMENT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Program staff identity names (lowercase) for the signed-in program user. */
export async function getProgramStaffIdentityNames() {
  if (!isSupabaseConfigured()) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();
  const emailLocal = String(user.email || '')
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .trim();
  return Array.from(
    new Set(
      [profile?.full_name, user.user_metadata?.full_name, user.user_metadata?.name, emailLocal]
        .map((x) => String(x || '').trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

/** Resident Management: Program ↔ `patients.case_load_manager`. */
export function getPatientCaseLoadManager(patientRow, patientId) {
  const pid = patientId != null ? String(patientId) : '';
  const ov = pid ? loadStaffAssignmentOverrides()[pid] : null;
  const fromDb =
    (typeof patientRow === 'object' && patientRow
      ? patientRow.case_load_manager ?? patientRow.caseLoadManager
      : '') || '';
  return String(ov?.caseLoadManager || fromDb || '').trim();
}

export function isAssignedToProgramStaff(patientRow, patientId, identityNames) {
  const assigned = getPatientCaseLoadManager(patientRow, patientId).toLowerCase();
  if (!assigned) return false;
  return (identityNames || []).includes(assigned);
}
