/** Persist Philippine address drafts (PSGC-backed) for friendlier return visits. */

const PREFIX = 'bh_psgc_address_';

/**
 * @param {'signup'|'admission'} scope
 */
export function getAddressStorageKey(scope) {
  return `${PREFIX}${scope}`;
}

/**
 * @param {string} key
 * @returns {object|null}
 */
export function loadAddressDraft(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    if (data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * @param {string} key
 * @param {object} payload
 */
export function saveAddressDraft(key, payload) {
  try {
    localStorage.setItem(key, JSON.stringify({ version: 1, ...payload }));
  } catch {
    /* quota / private mode */
  }
}

export function clearAddressDraft(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
