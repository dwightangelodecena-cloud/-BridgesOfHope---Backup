/** Philippine Standard Geographic Code public API (PSGC). @see https://psgc.gitlab.io/api/ */

const BASE = 'https://psgc.gitlab.io/api';

/** NCR cities are under the region, not a province row. */
export const PSGC_NCR_REGION_CODE = '130000000';

const listCache = new Map();

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.value)) return data.value;
  return [];
}

/**
 * @param {string} path API path starting with /
 * @returns {Promise<object[]>}
 */
export async function psgcFetchList(path) {
  const key = path;
  if (listCache.has(key)) {
    return listCache.get(key);
  }
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    throw new Error(`Could not load address data (${res.status}). Please try again.`);
  }
  const json = await res.json();
  const list = normalizeList(json);
  listCache.set(key, list);
  return list;
}

/**
 * Provinces + synthetic NCR row (Metro Manila) so the same UX covers all areas.
 * @returns {Promise<{ code: string, name: string, kind: 'province' | 'region' }[]>}
 */
export async function fetchProvinceOptions() {
  const raw = await psgcFetchList('/provinces');
  const provinces = raw
    .map((p) => ({
      code: String(p.code),
      name: String(p.name || ''),
      kind: /** @type {const} */ ('province'),
    }))
    .filter((p) => p.name && p.code);

  provinces.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

  const ncr = {
    code: PSGC_NCR_REGION_CODE,
    name: 'Metro Manila (NCR)',
    kind: /** @type {const} */ ('region'),
  };

  return [ncr, ...provinces];
}

/**
 * @param {string} parentCode province or region code
 * @param {'province' | 'region'} parentKind
 */
export async function fetchCitiesMunicipalities(parentCode, parentKind) {
  const code = String(parentCode);
  if (parentKind === 'region' || code === PSGC_NCR_REGION_CODE) {
    return psgcFetchList(`/regions/${PSGC_NCR_REGION_CODE}/cities-municipalities`);
  }
  return psgcFetchList(`/provinces/${code}/cities-municipalities`);
}

/**
 * @param {string} cityCode PSGC city / municipality code
 */
export async function fetchBarangays(cityCode) {
  return psgcFetchList(`/cities-municipalities/${String(cityCode)}/barangays`);
}

/**
 * Trailing Roman numerals in PSGC barangay names (e.g. "Langkaan II", "Salitran I").
 * Used only for search matching so "langkaan 2" / "salitran 1" find the official spellings.
 */
/** Trailing Roman segment (PSGC barangay style: … I … XX). */
const TRAILING_ROMAN = /\s+(i{1,3}|iv|vi{0,3}|ix|x|xi{1,3}|xii|xiii|xiv|xv|xvi|xvii|xviii|xix|xx)\s*$/i;

const ROMAN_TO_DIGIT = {
  I: '1',
  II: '2',
  III: '3',
  IV: '4',
  V: '5',
  VI: '6',
  VII: '7',
  VIII: '8',
  IX: '9',
  X: '10',
  XI: '11',
  XII: '12',
  XIII: '13',
  XIV: '14',
  XV: '15',
  XVI: '16',
  XVII: '17',
  XVIII: '18',
  XIX: '19',
  XX: '20',
};

/**
 * Collapses trailing Roman numerals to digits for sort / search only.
 * Dropdowns show official PSGC names (Roman). Submitted values stay official `name`.
 * @param {string} str
 * @returns {string}
 */
export function formatPsgcNameDisplay(str) {
  const raw = String(str || '').trim();
  if (!raw) return raw;
  return raw.replace(TRAILING_ROMAN, (match, rom) => {
    const key = rom.toUpperCase();
    const d = ROMAN_TO_DIGIT[key];
    return d != null ? ` ${d}` : match;
  });
}

/**
 * @param {string} str
 * @returns {string}
 */
export function normalizePsgcNameForSearch(str) {
  let s = String(str || '')
    .toLowerCase()
    .trim();
  s = s.replace(TRAILING_ROMAN, (match, rom) => {
    const key = rom.toUpperCase();
    const d = ROMAN_TO_DIGIT[key];
    return d != null ? ` ${d}` : match;
  });
  return s.trim();
}

/**
 * @param {string} name option label from PSGC
 * @param {string} query user search text
 */
export function psgcNameMatchesQuery(name, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const n = String(name || '').toLowerCase();
  if (n.includes(q)) return true;
  const display = formatPsgcNameDisplay(name);
  if (display.toLowerCase().includes(q)) return true;
  const nNorm = normalizePsgcNameForSearch(name);
  const qNorm = normalizePsgcNameForSearch(query);
  return nNorm.includes(qNorm);
}

/**
 * Sort options by display label (numeric-aware: Langkaan 2 after Langkaan 1).
 * @param {{ name: string }[]} options
 * @returns {{ name: string }[]}
 */
export function sortPsgcOptionsForDisplay(options) {
  return [...options].sort((a, b) =>
    formatPsgcNameDisplay(a.name).localeCompare(formatPsgcNameDisplay(b.name), 'en', {
      numeric: true,
      sensitivity: 'base',
    })
  );
}

/**
 * @param {object} row raw PSGC row
 * @returns {{ code: string, name: string }}
 */
export function toOption(row) {
  return {
    code: String(row.code),
    name: String(row.name || '').trim(),
  };
}
