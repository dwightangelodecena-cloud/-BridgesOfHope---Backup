import { supabase } from '@/lib/supabase';

/** Align with Supabase `is_staff()` JWT: user_metadata, then app_metadata. */
export function getAccountTypeFromUser(user) {
  if (!user) return null;
  const raw = user.user_metadata?.account_type ?? user.app_metadata?.account_type ?? 'family';
  const r = String(raw).trim().toLowerCase();
  if (r === 'nurse' || r === 'admin' || r === 'family' || r === 'program') return r;
  if (r === 'staff' || r === 'case_load_manager' || r === 'case manager' || r === 'case_manager') return 'program';
  return 'family';
}

/**
 * Prefer `public.profiles.account_type` (Table Editor / staff records), then JWT metadata.
 * Requires RLS to allow the signed-in user to read their own profile row (typical: id = auth.uid()).
 */
export async function resolveAccountRole(user) {
  if (!user?.id) return 'family';
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('account_type')
      .eq('id', user.id)
      .maybeSingle();
    if (!error && data?.account_type != null && String(data.account_type).trim() !== '') {
      const r = String(data.account_type).trim().toLowerCase();
      if (r === 'nurse' || r === 'admin' || r === 'family' || r === 'program') return r;
      if (r === 'staff' || r === 'case_load_manager' || r === 'case manager' || r === 'case_manager') return 'program';
    }
  } catch {
    // fall through
  }
  return getAccountTypeFromUser(user);
}
