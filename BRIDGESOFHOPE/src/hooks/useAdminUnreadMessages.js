import { useCallback, useEffect, useState } from 'react';
import {
  fetchAdminUnreadMessageCount,
  subscribeAdminInbox,
  SUPPORT_MESSAGES_CHANGED,
} from '@/lib/supportMessaging';

/** Unread family → admin support messages for sidebar badge. */
export function useAdminUnreadMessages() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const n = await fetchAdminUnreadMessageCount();
      setCount(Number(n) || 0);
    } catch {
      setCount(0);
    }
  }, []);

  useEffect(() => {
    refresh();
    const unsubRealtime = subscribeAdminInbox(() => refresh());
    const onChanged = () => refresh();
    window.addEventListener(SUPPORT_MESSAGES_CHANGED, onChanged);
    const interval = setInterval(refresh, 45_000);
    return () => {
      unsubRealtime();
      window.removeEventListener(SUPPORT_MESSAGES_CHANGED, onChanged);
      clearInterval(interval);
    };
  }, [refresh]);

  return count;
}
