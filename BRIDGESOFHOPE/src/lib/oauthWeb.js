import { supabase } from './supabase';
import { formatAuthError } from './authErrors';

export const OAUTH_EXPECTED_ROLE_KEY = 'boh_oauth_expected_role';

export function setOAuthExpectedRole(role) {
  if (role) sessionStorage.setItem(OAUTH_EXPECTED_ROLE_KEY, role);
}

export function takeOAuthExpectedRole() {
  const v = sessionStorage.getItem(OAUTH_EXPECTED_ROLE_KEY);
  sessionStorage.removeItem(OAUTH_EXPECTED_ROLE_KEY);
  return v;
}

export function getWebOAuthRedirectUrl() {
  return `${window.location.origin}/auth/callback`;
}

/**
 * Starts Google OAuth (browser redirect). On success the page navigates away.
 * Call setOAuthExpectedRole before this when the user chose a role on the login form.
 */
export async function startGoogleOAuthWeb() {
  const redirectTo = getWebOAuthRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
  if (error) throw new Error(formatAuthError(error));
  if (data?.url) {
    window.location.assign(data.url);
    return;
  }
  throw new Error('Could not start Google sign-in.');
}
