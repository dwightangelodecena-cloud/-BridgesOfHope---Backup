import { useCallback } from 'react';
import type { FamilyNotificationRow } from './familyNotificationsMobile';
import { useFamilyNotificationsMobile } from './useFamilyNotificationsMobileHook';

/**
 * @deprecated Prefer `useFamilyNotificationsMobile` or `FamilyMobilePageHeader`.
 * Kept for screens not yet migrated — no auto-save loop.
 */
export function useFamilyNotificationsState(familyUserId: string): {
  notificationItems: FamilyNotificationRow[];
  setNotificationItems: React.Dispatch<React.SetStateAction<FamilyNotificationRow[]>>;
} {
  const hook = useFamilyNotificationsMobile(familyUserId);
  const setNotificationItems = useCallback(
    (action: React.SetStateAction<FamilyNotificationRow[]>) => {
      void hook.persist(action);
    },
    [hook]
  );
  return { notificationItems: hook.items, setNotificationItems };
}
