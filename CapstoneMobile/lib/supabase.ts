import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Same Supabase project as BRIDGESOFHOPE (web + admin): URL + anon key from Dashboard -> API. */
const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
const supabaseUrl =
  str(process.env.EXPO_PUBLIC_SUPABASE_URL) || str(extra?.supabaseUrl);
const supabaseAnonKey =
  str(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) || str(extra?.supabaseAnonKey);

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[supabase] Missing Supabase URL or anon key. Add CapstoneMobile/.env with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (same values as web VITE_* — see .env.example), or run: npm run sync-env"
  );
}

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  const url = supabaseUrl;
  const key = supabaseAnonKey;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Create CapstoneMobile/.env next to app.json with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (Expo does not use VITE_ variable names)."
    );
  }
  if (!client) {
    client = createClient(url, key, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = getClient();
    const value = (c as unknown as Record<PropertyKey, unknown>)[prop];
    return typeof value === "function" ? value.bind(c) : value;
  },
});

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}
