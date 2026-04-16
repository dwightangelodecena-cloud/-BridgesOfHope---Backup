/** Philippine Standard Geographic Code public API. @see https://psgc.gitlab.io/api/ */

const BASE = 'https://psgc.gitlab.io/api';

export const PSGC_NCR_REGION_CODE = '130000000';

const listCache = new Map<string, unknown[]>();

function normalizeList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && 'value' in data && Array.isArray((data as { value: unknown[] }).value)) {
    return (data as { value: unknown[] }).value;
  }
  return [];
}

export async function psgcFetchList(path: string): Promise<unknown[]> {
  if (listCache.has(path)) {
    return listCache.get(path)!;
  }
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    throw new Error(`Could not load address data (${res.status}). Please try again.`);
  }
  const json = await res.json();
  const list = normalizeList(json);
  listCache.set(path, list);
  return list;
}

export type ProvinceRow = { code: string; name: string; kind: 'province' | 'region' };

export async function fetchProvinceOptions(): Promise<ProvinceRow[]> {
  const raw = (await psgcFetchList('/provinces')) as { code: string; name: string }[];
  const provinces = raw
    .map((p) => ({
      code: String(p.code),
      name: String(p.name || ''),
      kind: 'province' as const,
    }))
    .filter((p) => p.name && p.code);

  provinces.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

  const ncr: ProvinceRow = {
    code: PSGC_NCR_REGION_CODE,
    name: 'Metro Manila (NCR)',
    kind: 'region',
  };

  return [ncr, ...provinces];
}

export async function fetchCitiesMunicipalities(parentCode: string, parentKind: 'province' | 'region'): Promise<unknown[]> {
  const code = String(parentCode);
  if (parentKind === 'region' || code === PSGC_NCR_REGION_CODE) {
    return psgcFetchList(`/regions/${PSGC_NCR_REGION_CODE}/cities-municipalities`);
  }
  return psgcFetchList(`/provinces/${code}/cities-municipalities`);
}

export async function fetchBarangays(cityCode: string): Promise<unknown[]> {
  return psgcFetchList(`/cities-municipalities/${String(cityCode)}/barangays`);
}

/** Trailing Roman numerals in official PSGC names (e.g. Langkaan II) — normalize for search vs Arabic digits */
const TRAILING_ROMAN =
  /\s+(i{1,3}|iv|vi{0,3}|ix|x|xi{1,3}|xii|xiii|xiv|xv|xvi|xvii|xviii|xix|xx)\s*$/i;

const ROMAN_TO_DIGIT: Record<string, string> = {
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

/** Roman → digit for sort/search; UI shows official PSGC Roman labels. */
export function formatPsgcNameDisplay(str: string): string {
  const raw = String(str || '').trim();
  if (!raw) return raw;
  return raw.replace(TRAILING_ROMAN, (match, rom) => {
    const key = rom.toUpperCase();
    const d = ROMAN_TO_DIGIT[key];
    return d != null ? ` ${d}` : match;
  });
}

export function normalizePsgcNameForSearch(str: string): string {
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

export function psgcNameMatchesQuery(name: string, query: string): boolean {
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

export function sortPsgcOptionsForDisplay<T extends { name: string }>(options: T[]): T[] {
  return [...options].sort((a, b) =>
    formatPsgcNameDisplay(a.name).localeCompare(formatPsgcNameDisplay(b.name), 'en', {
      numeric: true,
      sensitivity: 'base',
    })
  );
}

export function toOption(row: unknown): { code: string; name: string } {
  const r = row as { code: string; name: string };
  return {
    code: String(r.code),
    name: String(r.name || '').trim(),
  };
}
