import { useCallback, useEffect, useMemo, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import {
  clearAllFamilyNotificationsMobileAsync,
  FAMILY_NOTIFICATIONS_CHANGED,
  loadFamilyNotificationsMobileAsync,
  saveFamilyNotificationsMobileAsync,
  type FamilyNotificationRow,
  notificationTextMobile,
  loadFamilyNotificationsLastReadMobileAsync,
  countUnreadFamilyNotificationsMobile,
  markFamilyNotificationsReadMobileAsync,
} from './familyNotificationsMobile';

function itemsEqual(a: FamilyNotificationRow[], b: FamilyNotificationRow[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i]?.id !== b[i]?.id || a[i]?.text !== b[i]?.text) return false;
  }
  return true;
}

/**
 * Notification state without save/reload loops (aligned with web `useFamilyNotifications`).
 */
export function useFamilyNotificationsMobile(userId: string) {
  const [items, setItems] = useState<FamilyNotificationRow[]>([]);
  const [lastReadAt, setLastReadAt] = useState(0);
  const [open, setOpen] = useState(false);

  const persist = useCallback(
    async (updater: FamilyNotificationRow[] | ((prev: FamilyNotificationRow[]) => FamilyNotificationRow[])) => {
      setItems((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (userId.trim()) {
          void saveFamilyNotificationsMobileAsync(next, userId).then((saved) => {
            setItems((current) => (itemsEqual(current, saved) ? current : saved));
          });
        }
        return next;
      });
    },
    [userId]
  );

  const reloadAll = useCallback(async () => {
    if (!userId.trim()) {
      setItems([]);
      setLastReadAt(0);
      return;
    }
    const [next, readAt] = await Promise.all([
      loadFamilyNotificationsMobileAsync(userId),
      loadFamilyNotificationsLastReadMobileAsync(userId),
    ]);
    setItems((prev) => (itemsEqual(prev, next) ? prev : next));
    setLastReadAt(readAt);
  }, [userId]);

  useEffect(() => {
    void reloadAll();
    const sub = DeviceEventEmitter.addListener(FAMILY_NOTIFICATIONS_CHANGED, () => {
      void reloadAll();
    });
    return () => sub.remove();
  }, [reloadAll]);

  useEffect(() => {
    if (!open || !userId.trim()) return;
    void markFamilyNotificationsReadMobileAsync(items, userId).then((ts) => {
      setLastReadAt(ts);
    });
  }, [open, userId, items]);

  const toggle = useCallback(() => setOpen((v) => !v), []);
  const close = useCallback(() => setOpen(false), []);

  const clearAll = useCallback(async () => {
    if (!userId.trim()) return;
    const cleared = await clearAllFamilyNotificationsMobileAsync(userId);
    setItems(cleared);
    setLastReadAt(await loadFamilyNotificationsLastReadMobileAsync(userId));
  }, [userId]);

  const removeItem = useCallback(
    (item: FamilyNotificationRow, idx: number) => {
      void persist((prev) => prev.filter((row, i) => (item?.id ? row.id !== item.id : i !== idx)));
    },
    [persist]
  );

  const unreadCount = useMemo(
    () => countUnreadFamilyNotificationsMobile(items, lastReadAt),
    [items, lastReadAt]
  );

  return {
    items,
    unreadCount,
    open,
    toggle,
    close,
    clearAll,
    removeItem,
    persist,
    notificationDisplayText: notificationTextMobile,
  };
}
