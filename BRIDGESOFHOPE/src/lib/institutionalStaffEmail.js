/**
 * Staff login addresses: lastname + first letter of first name @ role-based domain
 * (e.g. decenad@nurse.bridgesofhope.ph, decenad@staff.bridgesofhope.ph).
 *
 * Root domain: VITE_STAFF_EMAIL_ROOT_DOMAIN (e.g. bridgesofhope.ph), or derived from
 * legacy VITE_STAFF_INSTITUTIONAL_EMAIL_DOMAIN (e.g. staff.bridgesofhope.ph → bridgesofhope.ph).
 */

const ROOT_ENV_KEY = 'VITE_STAFF_EMAIL_ROOT_DOMAIN';
const LEGACY_INSTITUTIONAL_KEY = 'VITE_STAFF_INSTITUTIONAL_EMAIL_DOMAIN';
const DEFAULT_ROOT_DOMAIN = 'bridgesofhope.ph';

/**
 * Organization root host: bridgesofhope.ph → logins use nurse.bridgesofhope.ph / staff.bridgesofhope.ph
 */
export function getStaffEmailRootDomain() {
  const rawRoot =
    typeof import.meta !== 'undefined' ? import.meta.env?.[ROOT_ENV_KEY] : '';
  const rootTrim = typeof rawRoot === 'string' ? rawRoot.trim().replace(/^@/, '') : '';
  if (rootTrim) return rootTrim;

  const rawLegacy =
    typeof import.meta !== 'undefined' ? import.meta.env?.[LEGACY_INSTITUTIONAL_KEY] : '';
  const legacy = typeof rawLegacy === 'string' ? rawLegacy.trim().replace(/^@/, '') : '';
  if (legacy) {
    const parts = legacy.split('.').filter(Boolean);
    if (parts.length >= 2) return parts.slice(-2).join('.');
  }
  return DEFAULT_ROOT_DOMAIN;
}

/**
 * Full login domain for the selected staff role (nurse | staff).
 */
export function getStaffLoginDomainForRole(role) {
  const slug = role === 'nurse' ? 'nurse' : 'staff';
  return `${slug}.${getStaffEmailRootDomain()}`;
}

/** @deprecated Use getStaffLoginDomainForRole('staff') or getStaffEmailRootDomain */
export function getStaffInstitutionalDomain() {
  return getStaffLoginDomainForRole('staff');
}

function asciiSlug(s) {
  return String(s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Local part: lastname (ascii) + first letter of first name, e.g. decena + d → decenad.
 * @param {string} suffixToken - on duplicate auth email, appended as .token
 */
export function buildStaffLoginLocalPart(firstName, lastName, suffixToken = '') {
  const l = asciiSlug(lastName).slice(0, 48);
  const f = asciiSlug(firstName);
  const firstLetter = f.slice(0, 1) || 'x';
  let base = `${l}${firstLetter}`;
  if (!base.replace(/[^a-z0-9]/g, '')) base = `staff${Date.now().toString(36)}`;
  const suf = suffixToken ? `.${String(suffixToken).replace(/[^a-z0-9]/gi, '').slice(0, 12)}` : '';
  return `${base}${suf}`.slice(0, 64);
}

export function buildStaffLoginEmail({ firstName, lastName }, domain, suffixToken = '') {
  const local = buildStaffLoginLocalPart(firstName, lastName, suffixToken);
  return `${local}@${domain}`;
}

/** @deprecated Use buildStaffLoginEmail (lastname + first initial). Kept for any old imports. */
export function buildInstitutionalLocalPart(firstName, lastName, middleInitial, suffixToken = '') {
  return buildStaffLoginLocalPart(firstName, lastName, suffixToken);
}

/** @deprecated Use buildStaffLoginEmail */
export function buildInstitutionalStaffEmail({ firstName, lastName }, domain, suffixToken = '') {
  return buildStaffLoginEmail({ firstName, lastName }, domain, suffixToken);
}

export function randomEmailDisambiguator() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
