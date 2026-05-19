import { useCallback, useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import {
  clearAllFamilyNotificationsMobileAsync,
  FAMILY_NOTIFICATIONS_CHANGED,
  loadFamilyNotificationsMobileAsync,
  saveFamilyNotificationsMobileAsync,
  type FamilyNotificationRow,
  notificationTextMobile,
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

  useEffect(() => {
    if (!userId.trim()) {
      setItems([]);
      return undefined;
    }
    const reload = async () => {
      const next = await loadFamilyNotificationsMobileAsync(userId);
      setItems((prev) => (itemsEqual(prev, next) ? prev : next));
    };
    void reload();
    const sub = DeviceEventEmitter.addListener(FAMILY_NOTIFICATIONS_CHANGED, () => {
      void reload();
    });
    return () => sub.remove();
  }, [userId]);

  const toggle = useCallback(() => setOpen((v) => !v), []);
  const close = useCallback(() => setOpen(false), []);

  const clearAll = useCallback(async () => {
    if (!userId.trim()) return;
    const cleared = await clearAllFamilyNotificationsMobileAsync(userId);
    setItems(cleared);
  }, [userId]);

  const removeItem = useCallback(
    (item: FamilyNotificationRow, idx: number) => {
      void persist((prev) => prev.filter((row, i) => (item?.id ? row.id !== item.id : i !== idx)));
    },
    [persist]
  );

  return {
    items,
    open,
    toggle,
    close,
    clearAll,
    removeItem,
    persist,
    notificationDisplayText: notificationTextMobile,
  };
}
