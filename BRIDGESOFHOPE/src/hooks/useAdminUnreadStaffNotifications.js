import { useCallback, useEffect, useState } from 'react';
import {
  fetchUnreadStaffNotificationCount,
  subscribeStaffNotifications,
  STAFF_NOTIFICATIONS_CHANGED,
} from '@/lib/staffNotifications';

/**
 * Unread staff notifications for a badge — works for admin (shared broadcast), nurse, and program
 * alike, since RLS (not this query) scopes which rows a given user actually sees.
 */
export function useUnreadStaffNotifications() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const n = await fetchUnreadStaffNotificationCount();
      setCount(Number(n) || 0);
    } catch {
      setCount(0);
    }
  }, []);

  useEffect(() => {
    refresh();
    const unsubRealtime = subscribeStaffNotifications(() => refresh());
    const onChanged = () => refresh();
    window.addEventListener(STAFF_NOTIFICATIONS_CHANGED, onChanged);
    const interval = setInterval(refresh, 45_000);
    return () => {
      unsubRealtime();
      window.removeEventListener(STAFF_NOTIFICATIONS_CHANGED, onChanged);
      clearInterval(interval);
    };
  }, [refresh]);

  return count;
}
