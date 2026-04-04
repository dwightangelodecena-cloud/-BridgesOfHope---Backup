import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from './supabase';

/** Local fallback key — aligned with BRIDGESOFHOPE `ACTIVITY_FEED_KEY`. */
export const ACTIVITY_FEED_KEY = 'bh_activity_feed';

const MAX_ITEMS = 40;

export type ActivityFeedItem = {
  id: string;
  at: string;
  text: string;
};

/** Same labels as BRIDGESOFHOPE `activityDayLabel`. */
export function activityDayLabel(iso: string | null | undefined): string {
  if (!iso) return 'Recently';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Recently';
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startToday.getTime() - startThat.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function loadLocalItems(): Promise<ActivityFeedItem[]> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVITY_FEED_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? (list as ActivityFeedItem[]) : [];
  } catch {
    return [];
  }
}

/**
 * Loads merged activity from `activity_log` (RLS) + optional AsyncStorage fallback.
 * Mirrors BRIDGESOFHOPE `fetchActivityFeedForCurrentUser`.
 */
export async function fetchActivityFeedForCurrentUser(): Promise<ActivityFeedItem[]> {
  const localItems = await loadLocalItems();

  if (!isSupabaseConfigured()) {
    return localItems.slice(0, MAX_ITEMS);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return localItems.slice(0, MAX_ITEMS);
  }

  const { data, error } = await supabase
    .from('activity_log')
    .select('id, description, title, created_at, family_id, actor_id')
    .or(`family_id.eq.${user.id},actor_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(40);

  if (error) {
    console.warn('[activity_log fetch]', error.message);
    return localItems.slice(0, MAX_ITEMS);
  }

  const remoteItems: ActivityFeedItem[] = (data || []).map((row: { id: string; description?: string | null; title?: string | null; created_at: string }) => ({
    id: row.id,
    at: row.created_at,
    text: (row.description || row.title || '').trim(),
  }));

  const seen = new Set<string>();
  const merged: ActivityFeedItem[] = [];
  for (const item of [...remoteItems, ...localItems]) {
    if (!item?.id) continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  merged.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return merged.slice(0, MAX_ITEMS);
}

async function appendLocalFeedItem(text: string): Promise<void> {
  const message = String(text || '').trim();
  if (!message) return;
  try {
    const raw = await AsyncStorage.getItem(ACTIVITY_FEED_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    const entry: ActivityFeedItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      at: new Date().toISOString(),
      text: message,
    };
    const next = [entry, ...(Array.isArray(list) ? (list as ActivityFeedItem[]) : [])].slice(0, MAX_ITEMS);
    await AsyncStorage.setItem(ACTIVITY_FEED_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/**
 * Inserts into `activity_log` when Supabase is configured (mirrors BRIDGESOFHOPE `appendActivityFeed`).
 */
export async function appendActivityFeed(
  text: string,
  opts: { familyId?: string | null; title?: string; iconName?: string | null } = {}
): Promise<void> {
  const message = String(text || '').trim();
  if (!message) return;

  if (!isSupabaseConfigured()) {
    await appendLocalFeedItem(message);
    return;
  }

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    await appendLocalFeedItem(message);
    return;
  }

  const title = (opts.title || message).slice(0, 200);
  const { error } = await supabase.from('activity_log').insert({
    title,
    description: message,
    icon_name: opts.iconName ?? null,
    actor_id: user.id,
    family_id: opts.familyId ?? null,
  });

  if (error) {
    console.warn('[activity_log insert]', error.message);
    await appendLocalFeedItem(message);
  }
}
