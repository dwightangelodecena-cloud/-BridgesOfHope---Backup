import { createClient } from '@supabase/supabase-js';

const supabaseUrl = typeof import.meta.env.VITE_SUPABASE_URL === 'string'
  ? import.meta.env.VITE_SUPABASE_URL.trim()
  : '';
const supabaseAnonKey = typeof import.meta.env.VITE_SUPABASE_ANON_KEY === 'string'
  ? import.meta.env.VITE_SUPABASE_ANON_KEY.trim()
  : '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});

/**
 * Sends auth emails (password reset / OTP) whose link must work on any device.
 * The main client uses PKCE, which ties the emailed link to the code verifier stored in
 * *this* browser — so a link opened on a phone, or a reset an admin triggers for someone
 * else, can never be exchanged. Implicit flow puts the session in the URL hash instead,
 * which /newpass picks up directly. Never persists a session of its own.
 */
export const supabaseEmailLinkSender = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'implicit',
    detectSessionInUrl: false,
    persistSession: false,
    autoRefreshToken: false,
    storageKey: 'bh-email-link-sender',
  },
});

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}
