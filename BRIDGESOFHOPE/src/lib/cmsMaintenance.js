import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export const CMS_MAINTENANCE_STORAGE_KEY = 'bh_cms_maintenance_mirror';
export const CMS_MAINTENANCE_EVENT = 'bh_cms_maintenance_changed';

export const DEFAULT_CMS_MAINTENANCE_MESSAGE =
  'We are updating our website. Please check back shortly.';

/**
 * @returns {{ active: boolean, message: string }}
 */
export function readCmsMaintenanceMirror() {
  if (typeof window === 'undefined') return { active: false, message: '' };
  try {
    const raw = localStorage.getItem(CMS_MAINTENANCE_STORAGE_KEY);
    if (!raw) return { active: false, message: '' };
    const p = JSON.parse(raw);
    return {
      active: Boolean(p.active),
      message: String(p.message || '').trim(),
    };
  } catch {
    return { active: false, message: '' };
  }
}

function writeMirror(active, message) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      CMS_MAINTENANCE_STORAGE_KEY,
      JSON.stringify({
        active: !!active,
        message: message || '',
        ts: Date.now(),
      }),
    );
  } catch {
    /* ignore quota */
  }
  window.dispatchEvent(
    new CustomEvent(CMS_MAINTENANCE_EVENT, {
      detail: { active: !!active, message: message || '' },
    }),
  );
}

/**
 * Fetch maintenance flag from Supabase. Returns null if unconfigured or read failed (caller may fall back to mirror).
 * @returns {Promise<{ active: boolean, message: string } | null>}
 */
export async function fetchCmsMaintenanceFromSupabase() {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase
    .from('site_settings')
    .select('cms_maintenance, cms_maintenance_message')
    .eq('id', 'global')
    .maybeSingle();
  if (error) return null;
  if (!data) return { active: false, message: '' };
  return {
    active: Boolean(data.cms_maintenance),
    message: String(data.cms_maintenance_message || '').trim(),
  };
}

let maintWriteChain = Promise.resolve();

/**
 * Persist maintenance mode for the public landing page (Supabase + local mirror for same-origin tabs).
 * Writes are serialized so a slow request cannot apply after a later clear (e.g. leaving CMS).
 * @returns {Promise<{ ok: boolean, error?: string, localOnly?: boolean }>}
 */
export function setCmsMaintenanceRemote(active, message = '') {
  const msg = (message || '').trim() || DEFAULT_CMS_MAINTENANCE_MESSAGE;
  writeMirror(active, active ? msg : '');

  const task = async () => {
    if (!isSupabaseConfigured()) {
      return { ok: true, localOnly: true };
    }

    const { error } = await supabase.from('site_settings').upsert(
      {
        id: 'global',
        cms_maintenance: !!active,
        cms_maintenance_message: active ? msg : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );

    if (error) {
      return { ok: false, error: error.message || 'Could not update site settings.' };
    }
    return { ok: true };
  };

  const next = maintWriteChain.then(task);
  maintWriteChain = next.then(
    () => {},
    () => {},
  );
  return next;
}
