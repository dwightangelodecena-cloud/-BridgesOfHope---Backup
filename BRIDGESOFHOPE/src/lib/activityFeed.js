/** Shared timeline for family home "Recent Activity" (localStorage demo). */
export const ACTIVITY_FEED_KEY = 'bh_activity_feed';
export const ACTIVITY_FEED_UPDATED = 'bh_activity_feed_updated';

const MAX_ITEMS = 40;

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

export function getActivityFeed() {
  try {
    const raw = localStorage.getItem(ACTIVITY_FEED_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function appendActivityFeed(text) {
  const message = String(text || '').trim();
  if (!message) return;
  try {
    const list = getActivityFeed();
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      at: new Date().toISOString(),
      text: message,
    };
    const next = [entry, ...list].slice(0, MAX_ITEMS);
    localStorage.setItem(ACTIVITY_FEED_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent(ACTIVITY_FEED_UPDATED));
  } catch {
    /* ignore */
  }
}
