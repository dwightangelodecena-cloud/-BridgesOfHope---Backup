/**
 * Copies VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from BRIDGESOFHOPE/.env
 * into CapstoneMobile/.env as EXPO_PUBLIC_* (same database as web + admin web).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.join(__dirname, "..");
const webEnvPath = path.join(mobileRoot, "..", "BRIDGESOFHOPE", ".env");
const mobileEnvPath = path.join(mobileRoot, ".env");

function parseEnv(raw) {
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

if (!fs.existsSync(webEnvPath)) {
  console.error(`Missing web env file: ${webEnvPath}`);
  console.error("Create BRIDGESOFHOPE/.env from BRIDGESOFHOPE/.env.example first.");
  process.exit(1);
}

const web = parseEnv(fs.readFileSync(webEnvPath, "utf8"));
const url = web.VITE_SUPABASE_URL?.trim();
const key = web.VITE_SUPABASE_ANON_KEY?.trim();

if (!url || !key) {
  console.error("BRIDGESOFHOPE/.env must define VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  process.exit(1);
}

const lines = [
  "# Synced from BRIDGESOFHOPE/.env — same Supabase as web & admin. Regenerate: npm run sync-env",
  `EXPO_PUBLIC_SUPABASE_URL=${url}`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY=${key}`,
  "",
];

fs.writeFileSync(mobileEnvPath, lines.join("\n"), "utf8");
console.log(`Wrote ${mobileEnvPath}`);
console.log("Restart Expo: npx expo start -c");
