const LEGACY_KEY = 'bh_family_notifications_v1';
const STORAGE_KEY = 'bh_family_notifications_v2';

export const FAMILY_NOTIFICATIONS_CHANGED = 'bh_family_notifications_changed';

function dispatchChanged() {
  try {
    window.dispatchEvent(new CustomEvent(FAMILY_NOTIFICATIONS_CHANGED));
  } catch {
    /* ignore */
  }
}

function randomId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Normalize stored row to { id, text, createdAt }. */
export function normalizeNotificationItem(raw, index = 0) {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const t = String(raw).trim();
    if (!t) return null;
    return { id: randomId('legacy'), text: t, createdAt: Date.now() };
  }
  if (typeof raw === 'object') {
    const text = String(raw.text ?? raw.message ?? '').trim();
    if (!text) return null;
    const id = String(raw.id || '').trim() || randomId('row');
    const createdAt = Number.isFinite(Number(raw.createdAt)) ? Number(raw.createdAt) : Date.now();
    return { id, text, createdAt };
  }
  return null;
}

function migrateLegacyIfNeeded() {
  if (localStorage.getItem(STORAGE_KEY)) return;
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    const next = parsed.map((x, i) => normalizeNotificationItem(x, i)).filter(Boolean);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function loadFamilyNotifications() {
  migrateLegacyIfNeeded();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((x, i) => normalizeNotificationItem(x, i)).filter(Boolean);
  } catch {
    return [];
  }
}

export function saveFamilyNotifications(items) {
  const normalized = (Array.isArray(items) ? items : [])
    .map((x, i) => normalizeNotificationItem(x, i))
    .filter(Boolean);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  dispatchChanged();
  return normalized;
}

/** Append rows with stable `id`; skips duplicates already present in storage. */
export function appendFamilyNotificationsIfNew(entries) {
  if (!Array.isArray(entries) || !entries.length) return loadFamilyNotifications();
  const cur = loadFamilyNotifications();
  const existing = new Set(cur.map((r) => r.id));
  let changed = false;
  const next = [...cur];
  for (const e of entries) {
    const id = String(e?.id || '').trim();
    const text = String(e?.text || '').trim();
    if (!id || !text || existing.has(id)) continue;
    existing.add(id);
    next.unshift({
      id,
      text,
      createdAt: Number.isFinite(Number(e.createdAt)) ? Number(e.createdAt) : Date.now(),
    });
    changed = true;
  }
  if (changed) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    dispatchChanged();
  }
  return changed ? next : cur;
}

export function clearAllFamilyNotifications() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  dispatchChanged();
  return [];
}

/** Display string for dropdown (supports legacy string state during same session). */
export function notificationDisplayText(item) {
  if (item == null) return '';
  if (typeof item === 'string') return item;
  return String(item.text || '').trim();
}
