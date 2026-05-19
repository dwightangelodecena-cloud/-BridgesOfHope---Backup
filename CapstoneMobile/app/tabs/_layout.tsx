import { Tabs, usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import { tabsScreenOptions } from "../../lib/navigationConfig";
import { runFamilyNotificationSyncMobile } from "../../lib/familyNotificationSyncMobile";
import { SupportChatProvider } from "../../contexts/SupportChatContext";

/**
 * Home, Progress, Messages, Profile — custom tab bar on each screen.
 * Switches use cross-fade (not stacked root slides).
 */
export default function TabsLayout() {
  const pathname = usePathname();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void runFamilyNotificationSyncMobile();
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [pathname]);

  return (
    <SupportChatProvider>
      <Tabs screenOptions={tabsScreenOptions} />
    </SupportChatProvider>
  );
}
