import { supabase } from '@/lib/supabase';

/**
 * Deletes a staff account from Supabase Auth (and related profile cleanup in Edge Function).
 *
 * @param {{ userId: string }} params
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function deleteStaffAuthUserViaEdgeFunction({ userId }) {
  const id = String(userId || '').trim();
  if (!id) return { ok: false, error: 'Missing user ID.' };

  const { data, error } = await supabase.functions.invoke('delete-staff-auth-user', {
    body: { userId: id },
  });

  if (error) {
    const msg = String(error.message || '');
    if (
      /failed to send a request to the edge function/i.test(msg) ||
      /functions\/v1\/delete-staff-auth-user/i.test(msg)
    ) {
      return {
        ok: false,
        error:
          'Delete service is not available yet. Deploy Edge Function `delete-staff-auth-user` first, then try again.',
      };
    }
    return { ok: false, error: msg || 'Could not delete staff account.' };
  }
  if (data == null) {
    return { ok: false, error: 'Empty response from account service.' };
  }
  if (data.ok === false) {
    return { ok: false, error: data.error || 'Could not delete staff account.' };
  }
  return { ok: true };
}
