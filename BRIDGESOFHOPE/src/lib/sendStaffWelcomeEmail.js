import { supabase } from '@/lib/supabase';

/**
 * Calls Edge Function `send-staff-welcome-email` (Resend). Deploy function and set RESEND_API_KEY secret.
 * @param {{ personalEmail: string, institutionalEmail: string, temporaryPassword: string, fullName: string }} params
 * @returns {Promise<{ ok: boolean, skipped?: boolean, error?: string }>}
 */
export async function sendStaffWelcomeEmailViaEdgeFunction({
  personalEmail,
  institutionalEmail,
  temporaryPassword,
  fullName,
}) {
  const loginUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? `${window.location.origin.replace(/\/$/, '')}/login`
      : '';

  const { data, error } = await supabase.functions.invoke('send-staff-welcome-email', {
    body: {
      to: personalEmail.trim(),
      institutionalEmail: institutionalEmail.trim(),
      temporaryPassword,
      fullName: fullName.trim(),
      loginUrl,
    },
  });

  if (error) {
    return { ok: false, error: error.message || 'Could not reach email service.' };
  }
  if (data == null) {
    return { ok: false, error: 'Empty response from email service.' };
  }
  if (data?.skipped) {
    return { ok: false, skipped: true, error: data?.reason || 'Email service is not configured.' };
  }
  if (data?.ok === false) {
    return { ok: false, error: data?.error || 'Email was not sent.' };
  }
  return { ok: true };
}
