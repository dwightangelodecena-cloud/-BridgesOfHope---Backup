import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env'
  );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl?.trim() && supabaseAnonKey?.trim());
}
