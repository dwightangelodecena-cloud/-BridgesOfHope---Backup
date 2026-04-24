import { getPasswordPolicyError } from '@/lib/passwordPolicy';

const ENV_KEY = 'VITE_STAFF_DEFAULT_INITIAL_PASSWORD';

/** Built-in default; meets password policy. Change via env in production if needed. */
const BUILTIN_DEFAULT = 'BridgesHope#Staff1';

/**
 * One default password for every new staff account (same value for all hires).
 * Optional site-wide override: VITE_STAFF_DEFAULT_INITIAL_PASSWORD (must satisfy password policy).
 */
export function getStaffInitialPassword() {
  const raw =
    typeof import.meta !== 'undefined' && import.meta.env?.[ENV_KEY] != null
      ? String(import.meta.env[ENV_KEY]).trim()
      : '';
  if (raw && !getPasswordPolicyError(raw)) return raw;
  return BUILTIN_DEFAULT;
}
