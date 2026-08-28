import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export const FACILITY_SETTINGS_STORAGE_KEY = 'bh_facility_settings_v1';
export const FACILITY_SETTINGS_EVENT = 'bh-facility-settings';

/** Defaults mirror the copy that used to be hardcoded on the Admin Dashboard's Facility panel. */
export const DEFAULT_FACILITY_SETTINGS = {
  bedCapacity: 50,
  cards: {
    availableBeds: { title: 'Available beds', subtitle: 'Ready for admission' },
    staff: { title: 'Staff', subtitle: 'Admins, nurses & clinic staff' },
    occupancy: { title: 'Hospital occupancy' },
    avgStay: { title: 'Average days stayed', subtitle: 'Includes active + discharged' },
  },
};

function deepMerge(base, patch) {
  if (!patch || typeof patch !== 'object') return base;
  if (Array.isArray(patch)) return patch.slice();
  const out = { ...base };
  for (const k of Object.keys(patch)) {
    const pv = patch[k];
    const bv = base[k];
    if (pv && typeof pv === 'object' && !Array.isArray(pv) && bv && typeof bv === 'object' && !Array.isArray(bv)) {
      out[k] = deepMerge(bv, pv);
    } else if (pv !== undefined) {
      out[k] = Array.isArray(pv) ? pv.slice() : pv;
    }
  }
  return out;
}

/** Deep-merges `overrides` onto the defaults and clamps bed capacity to a sane positive integer. */
export function mergeFacilitySettings(overrides) {
  const merged = deepMerge(DEFAULT_FACILITY_SETTINGS, overrides || {});
  const capacity = Number(merged.bedCapacity);
  merged.bedCapacity = Number.isFinite(capacity) && capacity > 0 ? Math.round(capacity) : DEFAULT_FACILITY_SETTINGS.bedCapacity;
  return merged;
}

export function loadFacilitySettings() {
  if (typeof window === 'undefined') return mergeFacilitySettings({});
  try {
    const raw = localStorage.getItem(FACILITY_SETTINGS_STORAGE_KEY);
    if (!raw) return mergeFacilitySettings({});
    const o = JSON.parse(raw);
    return mergeFacilitySettings(typeof o === 'object' && o ? o : {});
  } catch {
    return mergeFacilitySettings({});
  }
}

/** Persists to the local mirror and notifies same-origin listeners (other tabs/iframes). Does not touch Supabase. */
export function saveMergedFacilitySettings(merged) {
  const next = mergeFacilitySettings(merged);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(FACILITY_SETTINGS_STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('[facilitySettings] save failed', e);
    }
    window.dispatchEvent(new CustomEvent(FACILITY_SETTINGS_EVENT));
  }
  return next;
}

/** @returns {Promise<object|null>} merged settings, or null if unconfigured/unavailable. */
export async function pullFacilitySettingsFromSupabase() {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase
    .from('site_settings')
    .select('facility_settings')
    .eq('id', 'global')
    .maybeSingle();
  if (error || !data) return null;
  return mergeFacilitySettings(data.facility_settings || {});
}

let facilityWriteChain = Promise.resolve();

/**
 * Persists facility settings to Supabase. Writes are serialized so a slow request cannot
 * apply after a later save (mirrors `setCmsMaintenanceRemote`'s write-chain pattern).
 * @returns {Promise<{ ok: boolean, error?: string, skipped?: boolean }>}
 */
export function pushFacilitySettingsToSupabase(merged) {
  const task = async () => {
    if (!isSupabaseConfigured()) {
      return { ok: true, skipped: true };
    }
    const { error } = await supabase.from('site_settings').upsert(
      {
        id: 'global',
        facility_settings: merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
    if (error) {
      return { ok: false, error: error.message || 'Could not save facility settings.' };
    }
    return { ok: true };
  };

  const next = facilityWriteChain.then(task);
  facilityWriteChain = next.then(
    () => {},
    () => {},
  );
  return next;
}
