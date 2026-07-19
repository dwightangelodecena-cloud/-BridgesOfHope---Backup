const LEGACY_KEY = 'bh_family_notifications_v1';
/** Pre–per-user bucket (shared across accounts on same browser). Migrated once into the active user’s v3 key. */
const GLOBAL_V2_KEY = 'bh_family_notifications_v2';
const PER_USER_PREFIX = 'bh_family_notifications_v3:';
const LAST_READ_PREFIX = 'bh_family_notifications_last_read_v1:';
const MAX_NOTIFICATIONS = 80;

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

/** Stable storage key per signed-in family user (auth uid or `local-family`). */
export function notificationStorageKeyForUser(userId) {
  const id = userId != null ? String(userId).trim() : '';
  if (!id) return null;
  return `${PER_USER_PREFIX}${id}`;
}

export function notificationLastReadKeyForUser(userId) {
  const id = userId != null ? String(userId).trim() : '';
  if (!id) return null;
  return `${LAST_READ_PREFIX}${id}`;
}

export function loadFamilyNotificationsLastRead(userId) {
  const key = notificationLastReadKeyForUser(userId);
  if (!key) return 0;
  try {
    const raw = localStorage.getItem(key);
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function saveFamilyNotificationsLastRead(userId, timestamp = Date.now()) {
  const key = notificationLastReadKeyForUser(userId);
  if (!key) return 0;
  const ts = Number.isFinite(Number(timestamp)) ? Number(timestamp) : Date.now();
  try {
    localStorage.setItem(key, String(ts));
    dispatchChanged();
  } catch {
    /* ignore */
  }
  return ts;
}

export function countUnreadFamilyNotifications(items, lastReadAt = 0) {
  const last = Number(lastReadAt) || 0;
  return (Array.isArray(items) ? items : []).filter((item) => {
    const createdAt = Number(item?.createdAt) || 0;
    return createdAt > last;
  }).length;
}

export function markFamilyNotificationsRead(items, userId) {
  const list = Array.isArray(items) ? items : [];
  const ts = list.length
    ? Math.max(...list.map((item) => Number(item?.createdAt) || 0), Date.now())
    : Date.now();
  return saveFamilyNotificationsLastRead(userId, ts);
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

/**
 * One-time: move shared v2/v1 pool into this user’s key so existing installs keep one copy
 * for the first account that loads after upgrade (then other users stay isolated).
 */
function migrateSharedPoolIntoUserKey(userId) {
  const key = notificationStorageKeyForUser(userId);
  if (!key) return;
  try {
    if (localStorage.getItem(key)) return;
    const rawV2 = localStorage.getItem(GLOBAL_V2_KEY);
    if (rawV2) {
      localStorage.setItem(key, rawV2);
      localStorage.removeItem(GLOBAL_V2_KEY);
      return;
    }
    const rawV1 = localStorage.getItem(LEGACY_KEY);
    if (!rawV1) return;
    const parsed = JSON.parse(rawV1);
    if (!Array.isArray(parsed)) return;
    const next = parsed.map((x, i) => normalizeNotificationItem(x, i)).filter(Boolean);
    localStorage.setItem(key, JSON.stringify(next));
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}

export function loadFamilyNotifications(userId) {
  migrateSharedPoolIntoUserKey(userId);
  const key = notificationStorageKeyForUser(userId);
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((x, i) => normalizeNotificationItem(x, i)).filter(Boolean);
  } catch {
    return [];
  }
}

export function saveFamilyNotifications(items, userId) {
  const key = notificationStorageKeyForUser(userId);
  if (!key) return [];
  const normalized = (Array.isArray(items) ? items : [])
    .map((x, i) => normalizeNotificationItem(x, i))
    .filter(Boolean)
    .slice(0, MAX_NOTIFICATIONS);
  const serialized = JSON.stringify(normalized);
  try {
    const existing = localStorage.getItem(key);
    if (existing === serialized) return normalized;
    localStorage.setItem(key, serialized);
    dispatchChanged();
  } catch (e) {
    console.warn('[familyNotifications] save failed (storage full?)', e);
  }
  return normalized;
}

/** Append rows with stable `id`; skips duplicates already present in storage. */
export function appendFamilyNotificationsIfNew(entries, userId) {
  const key = notificationStorageKeyForUser(userId);
  if (!key || !Array.isArray(entries) || !entries.length) return loadFamilyNotifications(userId);
  const cur = loadFamilyNotifications(userId);
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
    try {
      const capped = next.slice(0, MAX_NOTIFICATIONS);
      localStorage.setItem(key, JSON.stringify(capped));
      dispatchChanged();
    } catch (e) {
      console.warn('[familyNotifications] append failed (storage full?)', e);
    }
  }
  return changed ? next : cur;
}

export function clearAllFamilyNotifications(userId) {
  const key = notificationStorageKeyForUser(userId);
  if (!key) return [];
  const empty = '[]';
  if (localStorage.getItem(key) === empty) return [];
  localStorage.setItem(key, empty);
  saveFamilyNotificationsLastRead(userId, Date.now());
  dispatchChanged();
  return [];
}

/** Display string for dropdown (supports legacy string state during same session). */
export function notificationDisplayText(item) {
  if (item == null) return '';
  if (typeof item === 'string') return item;
  return String(item.text || '').trim();
}
