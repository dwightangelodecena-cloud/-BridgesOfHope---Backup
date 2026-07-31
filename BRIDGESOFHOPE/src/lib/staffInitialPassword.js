import { getPasswordPolicyError } from '@/lib/passwordPolicy';

// Ambiguous-looking characters (0/O, 1/I/l) are excluded so a password read off an email is easy to type correctly.
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const SPECIAL = '!@#$%^&*';
const ALL = UPPER + LOWER + DIGITS + SPECIAL;
const LENGTH = 12;

function randomIndex(max) {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0] % max;
}

function randomChar(pool) {
  return pool[randomIndex(pool.length)];
}

function shuffled(chars) {
  const arr = [...chars];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
}

/**
 * A fresh, random password for a single new staff account (unique per hire, not shared).
 * Guaranteed to satisfy the password policy (mixed case, digit, symbol, no spaces, 12 chars).
 */
export function generateStaffInitialPassword() {
  const required = [randomChar(UPPER), randomChar(LOWER), randomChar(DIGITS), randomChar(SPECIAL)];
  const rest = Array.from({ length: LENGTH - required.length }, () => randomChar(ALL));
  const password = shuffled([...required, ...rest]);
  return getPasswordPolicyError(password) ? generateStaffInitialPassword() : password;
}
