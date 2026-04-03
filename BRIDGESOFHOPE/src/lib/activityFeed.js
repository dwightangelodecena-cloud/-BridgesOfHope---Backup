import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { refreshAppData } from '@/lib/appDataRefresh';

/** @deprecated local fallback only */
export const ACTIVITY_FEED_KEY = 'bh_activity_feed';
export const ACTIVITY_FEED_UPDATED = 'bh_activity_feed_updated';

const MAX_ITEMS_LOCAL = 40;

export function activityDayLabel(iso) {
  if (!iso) return 'Recently';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Recently';
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startToday - startThat) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function appendLocal(text) {
  try {
    const raw = localStorage.getItem(ACTIVITY_FEED_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      at: new Date().toISOString(),
      text: text,
    };
    const next = [entry, ...(Array.isArray(list) ? list : [])].slice(0, MAX_ITEMS_LOCAL);
    localStorage.setItem(ACTIVITY_FEED_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent(ACTIVITY_FEED_UPDATED));
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} text
 * @param {{ familyId?: string | null, title?: string, iconName?: string }} [opts]
 */
export async function appendActivityFeed(text, opts = {}) {
  const message = String(text || '').trim();
  if (!message) return;

  if (!isSupabaseConfigured()) {
    appendLocal(message);
    refreshAppData();
    return;
  }

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    appendLocal(message);
    refreshAppData();
    return;
  }

  const title = (opts.title || message).slice(0, 200);
  const familyId = opts.familyId ?? null;
  const iconName = opts.iconName ?? null;

  const { error } = await supabase.from('activity_log').insert({
    title,
    description: message,
    icon_name: iconName,
    actor_id: user.id,
    family_id: familyId,
  });

  if (error) {
    console.warn('[activity_log]', error.message);
    appendLocal(message);
  }
  refreshAppData();
  window.dispatchEvent(new CustomEvent(ACTIVITY_FEED_UPDATED));
}

/** @returns {Promise<Array<{ id: string, at: string, text: string }>>} */
export async function fetchActivityFeedForCurrentUser() {
  let localItems = [];
  try {
    const raw = localStorage.getItem(ACTIVITY_FEED_KEY);
    const list = raw ? JSON.parse(raw) : [];
    localItems = Array.isArray(list) ? list : [];
  } catch {
    localItems = [];
  }

  if (!isSupabaseConfigured()) {
    return localItems;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return localItems;

  const { data, error } = await supabase
    .from('activity_log')
    .select('id, description, title, created_at, family_id, actor_id')
    .or(`family_id.eq.${user.id},actor_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(40);

  if (error) {
    console.warn('[activity_log fetch]', error.message);
    return localItems;
  }

  const remoteItems = (data || []).map((row) => ({
    id: row.id,
    at: row.created_at,
    text: row.description || row.title || '',
  }));

  /** Merge: DB rows + local fallback (insert may be blocked by RLS until migration 003). */
  const seen = new Set();
  const merged = [];
  for (const item of [...remoteItems, ...localItems]) {
    if (!item || !item.id) continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  merged.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return merged.slice(0, MAX_ITEMS_LOCAL);
}
