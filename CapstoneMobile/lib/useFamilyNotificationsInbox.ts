import { useCallback, useEffect, useMemo, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import {
  loadFamilyNotificationsMobileAsync,
  loadFamilyNotificationsLastReadMobileAsync,
  markFamilyNotificationsReadMobileAsync,
  FAMILY_NOTIFICATIONS_CHANGED,
} from './familyNotificationsMobile';
import { fetchDbFamilyNotifications, markDbFamilyNotificationRead, type DbFamilyNotification } from './familyNotificationsDb';

export type InboxItem = {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  isRead: boolean;
  source: 'db' | 'legacy';
  relatedType?: string;
  relatedId?: string;
};

/**
 * Unified "email-like" notification inbox: real, admin-editable-template notifications
 * (admission + visitation, from `family_notifications`) merged with the legacy on-device
 * discharge/progress notifications (unchanged AsyncStorage mechanism), newest first.
 */
export function useFamilyNotificationsInbox(userId: string) {
  const [dbItems, setDbItems] = useState<DbFamilyNotification[]>([]);
  const [legacyItems, setLegacyItems] = useState<{ id: string; text: string; createdAt: number }[]>([]);
  const [legacyLastReadAt, setLegacyLastReadAt] = useState(0);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId.trim()) {
      setDbItems([]);
      setLegacyItems([]);
      setLoading(false);
      return;
    }
    try {
      const [db, legacy, lastRead] = await Promise.all([
        fetchDbFamilyNotifications(userId),
        loadFamilyNotificationsMobileAsync(userId),
        loadFamilyNotificationsLastReadMobileAsync(userId),
      ]);
      setDbItems(db);
      setLegacyItems(legacy);
      setLegacyLastReadAt(lastRead);
    } catch {
      /* ignore — keep previous items on transient failure */
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void reload();
    const sub = DeviceEventEmitter.addListener(FAMILY_NOTIFICATIONS_CHANGED, () => {
      void reload();
    });
    return () => sub.remove();
  }, [reload]);

  const items: InboxItem[] = useMemo(() => {
    const fromDb: InboxItem[] = dbItems.map((n) => ({
      id: `db-${n.id}`,
      title: n.title || 'Notification',
      body: n.body,
      createdAt: n.createdAt,
      isRead: n.readAt != null,
      source: 'db' as const,
      relatedType: n.relatedType,
      relatedId: n.relatedId,
    }));
    const fromLegacy: InboxItem[] = legacyItems.map((n) => ({
      id: `legacy-${n.id}`,
      title: 'Update',
      body: n.text,
      createdAt: n.createdAt,
      isRead: n.createdAt <= legacyLastReadAt,
      source: 'legacy' as const,
    }));
    return [...fromDb, ...fromLegacy].sort((a, b) => b.createdAt - a.createdAt);
  }, [dbItems, legacyItems, legacyLastReadAt]);

  const unreadCount = useMemo(() => items.filter((i) => !i.isRead).length, [items]);

  /** Opening an item marks it read (DB items only — legacy items share one read cursor, see markAllLegacyRead). */
  const markRead = useCallback(async (item: InboxItem) => {
    if (item.source !== 'db' || item.isRead) return;
    const rawId = item.id.replace(/^db-/, '');
    await markDbFamilyNotificationRead(rawId);
    setDbItems((prev) => prev.map((n) => (n.id === rawId ? { ...n, readAt: Date.now() } : n)));
  }, []);

  const markAllLegacyRead = useCallback(async () => {
    if (!userId.trim() || legacyItems.length === 0) return;
    await markFamilyNotificationsReadMobileAsync(legacyItems, userId);
    setLegacyLastReadAt(Date.now());
  }, [userId, legacyItems]);

  return { items, unreadCount, loading, reload, markRead, markAllLegacyRead };
}
