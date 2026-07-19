import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  loadFamilyNotifications,
  saveFamilyNotifications,
  clearAllFamilyNotifications,
  FAMILY_NOTIFICATIONS_CHANGED,
  notificationDisplayText,
  loadFamilyNotificationsLastRead,
  countUnreadFamilyNotifications,
  markFamilyNotificationsRead,
} from '@/lib/familyNotifications';

function itemsEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i]?.id !== b[i]?.id || a[i]?.text !== b[i]?.text) return false;
  }
  return true;
}

/**
 * Family notification dropdown state without save/reload feedback loops.
 */
export function useFamilyNotifications(userId) {
  const [items, setItems] = useState([]);
  const [lastReadAt, setLastReadAt] = useState(0);
  const [open, setOpen] = useState(false);
  const desktopRef = useRef(null);
  const mobileRef = useRef(null);

  const reloadAll = useCallback(() => {
    if (!userId) {
      setItems([]);
      setLastReadAt(0);
      return;
    }
    const next = loadFamilyNotifications(userId);
    setItems((prev) => (itemsEqual(prev, next) ? prev : next));
    setLastReadAt(loadFamilyNotificationsLastRead(userId));
  }, [userId]);

  const updateItems = useCallback(
    (updater) => {
      setItems((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (!userId) return next;
        const saved = saveFamilyNotifications(next, userId);
        return itemsEqual(prev, saved) ? prev : saved;
      });
    },
    [userId]
  );

  useEffect(() => {
    reloadAll();
    window.addEventListener('storage', reloadAll);
    window.addEventListener(FAMILY_NOTIFICATIONS_CHANGED, reloadAll);
    return () => {
      window.removeEventListener('storage', reloadAll);
      window.removeEventListener(FAMILY_NOTIFICATIONS_CHANGED, reloadAll);
    };
  }, [reloadAll]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      const t = e.target;
      if (!desktopRef.current?.contains(t) && !mobileRef.current?.contains(t)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !userId) return;
    const ts = markFamilyNotificationsRead(items, userId);
    setLastReadAt(ts);
  }, [open, userId, items]);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  const clearAll = useCallback(() => {
    if (!userId) return;
    const cleared = clearAllFamilyNotifications(userId);
    setItems((prev) => (itemsEqual(prev, cleared) ? prev : cleared));
    setLastReadAt(loadFamilyNotificationsLastRead(userId));
  }, [userId]);

  const removeItem = useCallback(
    (item, idx) => {
      updateItems((prev) => prev.filter((row, i) => (item?.id ? row.id !== item.id : i !== idx)));
    },
    [updateItems]
  );

  const unreadCount = useMemo(
    () => countUnreadFamilyNotifications(items, lastReadAt),
    [items, lastReadAt]
  );

  return {
    items,
    unreadCount,
    open,
    toggle,
    clearAll,
    removeItem,
    desktopRef,
    mobileRef,
    notificationDisplayText,
  };
}
