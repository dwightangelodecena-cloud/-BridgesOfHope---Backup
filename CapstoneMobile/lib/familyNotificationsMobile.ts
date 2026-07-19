import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

const LEGACY_V1_KEY = "bh_family_notifications_v1";
/** Shared pool from older web/mobile builds; migrated once into the active user’s v3 key. */
const GLOBAL_V2_KEY = "bh_family_notifications_v2";
const PER_USER_PREFIX = "bh_family_notifications_v3:";
const LAST_READ_PREFIX = "bh_family_notifications_last_read_v1:";

export const FAMILY_NOTIFICATIONS_CHANGED = "bh_family_notifications_changed";

export type FamilyNotificationRow = {
  id: string;
  text: string;
  createdAt: number;
};

function emitChanged() {
  try {
    DeviceEventEmitter.emit(FAMILY_NOTIFICATIONS_CHANGED);
  } catch {
    /* ignore */
  }
}

function randomId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function notificationStorageKeyForUser(userId: string | null | undefined): string | null {
  const id = String(userId || "").trim();
  if (!id) return null;
  return `${PER_USER_PREFIX}${id}`;
}

export function notificationLastReadKeyForUser(userId: string | null | undefined): string | null {
  const id = String(userId || "").trim();
  if (!id) return null;
  return `${LAST_READ_PREFIX}${id}`;
}

export async function loadFamilyNotificationsLastReadMobileAsync(userId: string | null): Promise<number> {
  const key = notificationLastReadKeyForUser(userId);
  if (!key) return 0;
  try {
    const raw = await AsyncStorage.getItem(key);
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export async function saveFamilyNotificationsLastReadMobileAsync(
  userId: string | null,
  timestamp: number = Date.now()
): Promise<number> {
  const key = notificationLastReadKeyForUser(userId);
  if (!key) return 0;
  const ts = Number.isFinite(Number(timestamp)) ? Number(timestamp) : Date.now();
  try {
    await AsyncStorage.setItem(key, String(ts));
    emitChanged();
  } catch {
    /* ignore */
  }
  return ts;
}

export function countUnreadFamilyNotificationsMobile(
  items: FamilyNotificationRow[],
  lastReadAt = 0
): number {
  const last = Number(lastReadAt) || 0;
  return items.filter((item) => {
    const createdAt = Number(item?.createdAt) || 0;
    return createdAt > last;
  }).length;
}

export async function markFamilyNotificationsReadMobileAsync(
  items: FamilyNotificationRow[],
  userId: string | null
): Promise<number> {
  const list = Array.isArray(items) ? items : [];
  const ts = list.length
    ? Math.max(...list.map((item) => Number(item?.createdAt) || 0), Date.now())
    : Date.now();
  return saveFamilyNotificationsLastReadMobileAsync(userId, ts);
}

function normalizeRow(raw: unknown, index: number): FamilyNotificationRow | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return null;
    return { id: randomId("legacy"), text: t, createdAt: Date.now() };
  }
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const text = String(o.text ?? o.message ?? "").trim();
    if (!text) return null;
    const id = String(o.id || "").trim() || randomId("row");
    const createdAt = Number.isFinite(Number(o.createdAt)) ? Number(o.createdAt) : Date.now();
    return { id, text, createdAt };
  }
  return null;
}

const MAX_NOTIFICATIONS = 80;

async function migrateSharedPoolIntoUserKey(userId: string): Promise<void> {
  const dest = notificationStorageKeyForUser(userId);
  if (!dest) return;
  try {
    const existing = await AsyncStorage.getItem(dest);
    if (existing) return;
    for (const src of [GLOBAL_V2_KEY, LEGACY_V1_KEY]) {
      const raw = await AsyncStorage.getItem(src);
      if (!raw) continue;
      await AsyncStorage.setItem(dest, raw);
      await AsyncStorage.removeItem(src);
      return;
    }
  } catch {
    /* ignore */
  }
}

export async function loadFamilyNotificationsMobileAsync(userId: string | null): Promise<FamilyNotificationRow[]> {
  const key = notificationStorageKeyForUser(userId);
  if (!key) return [];
  await migrateSharedPoolIntoUserKey(userId!);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((x, i) => normalizeRow(x, i)).filter(Boolean) as FamilyNotificationRow[];
  } catch {
    return [];
  }
}

export async function saveFamilyNotificationsMobileAsync(
  items: FamilyNotificationRow[],
  userId: string | null
): Promise<FamilyNotificationRow[]> {
  const key = notificationStorageKeyForUser(userId);
  const normalized = (Array.isArray(items) ? items : [])
    .map((x, i) => normalizeRow(x, i))
    .filter(Boolean)
    .slice(0, MAX_NOTIFICATIONS) as FamilyNotificationRow[];
  if (!key) return normalized;
  const serialized = JSON.stringify(normalized);
  try {
    const existing = await AsyncStorage.getItem(key);
    if (existing === serialized) return normalized;
    await AsyncStorage.setItem(key, serialized);
    emitChanged();
  } catch {
    /* ignore */
  }
  return normalized;
}

export async function appendFamilyNotificationsIfNewMobile(
  entries: { id: string; text: string; createdAt?: number }[],
  userId: string | null
): Promise<FamilyNotificationRow[]> {
  const key = notificationStorageKeyForUser(userId);
  if (!key || !entries.length) return loadFamilyNotificationsMobileAsync(userId);
  const cur = await loadFamilyNotificationsMobileAsync(userId);
  const existing = new Set(cur.map((r) => r.id));
  let changed = false;
  const next = [...cur];
  for (const e of entries) {
    const id = String(e?.id || "").trim();
    const text = String(e?.text || "").trim();
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
      const serialized = JSON.stringify(capped);
      const existing = await AsyncStorage.getItem(key);
      if (existing !== serialized) {
        await AsyncStorage.setItem(key, serialized);
        emitChanged();
      }
    } catch {
      /* ignore */
    }
  }
  return changed ? next : cur;
}

export async function clearAllFamilyNotificationsMobileAsync(userId: string | null): Promise<FamilyNotificationRow[]> {
  const key = notificationStorageKeyForUser(userId);
  if (!key) return [];
  try {
    const empty = '[]';
    const existing = await AsyncStorage.getItem(key);
    if (existing !== empty) {
      await AsyncStorage.setItem(key, empty);
      await saveFamilyNotificationsLastReadMobileAsync(userId, Date.now());
      emitChanged();
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function notificationTextMobile(item: FamilyNotificationRow | string): string {
  if (item == null) return "";
  if (typeof item === "string") return item;
  return String(item.text || "").trim();
}
