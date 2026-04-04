import { Tabs } from "expo-router";
import { tabsScreenOptions } from "../../lib/navigationConfig";

/**
 * Home, Progress, Messages, Profile — custom tab bar on each screen.
 * Switches use cross-fade (not stacked root slides).
 */
export default function TabsLayout() {
  return <Tabs screenOptions={tabsScreenOptions} />;
}
