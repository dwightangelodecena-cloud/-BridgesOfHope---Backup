/**
 * Dynamic Expo config so `extra` picks up EXPO_PUBLIC_* at build time (EAS / local).
 * Base UI settings stay in app.json.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const base = require("./app.json");

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

module.exports = {
  expo: {
    ...base.expo,
    extra: {
      ...(base.expo.extra || {}),
      supabaseUrl,
      supabaseAnonKey,
    },
  },
};
