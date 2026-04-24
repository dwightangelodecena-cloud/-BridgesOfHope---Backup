import { supabase } from '@/lib/supabase';

/**
 * Creates a staff Auth user with email already confirmed (Admin API via Edge Function).
 * Deploy `create-staff-auth-user` so new nurses can sign in without Supabase "confirm email" flow.
 *
 * @param {{ email: string, password: string, user_metadata: Record<string, unknown> }} params
 * @returns {Promise<{ ok: boolean, userId?: string, email?: string, duplicateEmail?: boolean, error?: string }>}
 */
export async function createStaffAuthUserViaEdgeFunction({ email, password, user_metadata }) {
  const { data, error } = await supabase.functions.invoke('create-staff-auth-user', {
    body: { email: email.trim(), password, user_metadata: user_metadata || {} },
  });

  if (error) {
    return { ok: false, error: error.message || 'Could not create staff account.' };
  }
  if (data == null) {
    return { ok: false, error: 'Empty response from account service.' };
  }
  if (data.ok === false) {
    return {
      ok: false,
      error: data.error || 'Could not create staff account.',
      duplicateEmail: Boolean(data.duplicateEmail),
    };
  }
  return { ok: true, userId: data.userId, email: data.email };
}
