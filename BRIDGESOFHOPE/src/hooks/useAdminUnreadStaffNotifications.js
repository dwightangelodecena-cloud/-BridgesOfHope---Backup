import { useCallback, useEffect, useState } from 'react';
import {
  fetchUnreadStaffNotificationCount,
  subscribeStaffNotifications,
  STAFF_NOTIFICATIONS_CHANGED,
} from '@/lib/staffNotifications';

/** Unread staff notifications (new admission/discharge/visitation requests) for sidebar badge. */
export function useAdminUnreadStaffNotifications() {
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
