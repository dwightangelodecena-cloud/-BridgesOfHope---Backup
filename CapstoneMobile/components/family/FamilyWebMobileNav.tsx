import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type IonName = React.ComponentProps<typeof Ionicons>['name'];
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_ROUTES } from '../../lib/navigationConfig';
import { BH } from '../../theme/tokens';

/** Matches web FamilySidebar primary nav (Dashboard → Reports). Profile is reached via the header avatar. */
export type FamilyNavTab =
  | 'home'
  | 'patientDetails'
  | 'progress'
  | 'appointments'
  | 'reports'
  | 'profile';

type Props = {
  /** Use `'none'` on auxiliary screens so no tab looks selected. */
  active: FamilyNavTab | 'none';
};

const NAV_ITEMS: {
  key: FamilyNavTab;
  icon: IonName;
  route: string;
  label: string;
  a11y: string;
}[] = [
  { key: 'home', icon: 'home-outline', route: TAB_ROUTES.home, label: 'Home', a11y: 'Dashboard' },
  {
    key: 'patientDetails',
    icon: 'id-card-outline',
    route: TAB_ROUTES.patientDetails,
    label: 'Residents',
    a11y: 'Resident details',
  },
  {
    key: 'progress',
    icon: 'clipboard-outline',
    route: TAB_ROUTES.progress,
    label: 'Requests',
    a11y: 'Request management',
  },
  {
    key: 'appointments',
    icon: 'calendar-outline',
    route: TAB_ROUTES.appointments,
    label: 'Visits',
    a11y: 'Appointments',
  },
  {
    key: 'reports',
    icon: 'document-text-outline',
    route: TAB_ROUTES.reports,
    label: 'Reports',
    a11y: 'Reports',
  },
];

const INACTIVE = BH.textFaint;
const ACTIVE = BH.brand;

export function FamilyWebMobileNav({ active }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const go = (route: string) => {
    router.navigate(route as never);
  };

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      <View style={styles.row}>
        {NAV_ITEMS.map((item) => {
          const isActive = active !== 'none' && active === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={styles.navItem}
              onPress={() => go(item.route)}
              accessibilityRole="button"
              accessibilityLabel={item.a11y}
              accessibilityState={{ selected: isActive }}
            >
              <Ionicons name={item.icon} size={21} color={isActive ? ACTIVE : INACTIVE} />
              {isActive ? <Text style={styles.navLabelActive}>{item.label}</Text> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: BH.surface,
    borderTopWidth: 1,
    borderTopColor: BH.border,
    paddingTop: 6,
    minHeight: 64,
    zIndex: 2000,
    ...Platform.select({
      ios: {
        shadowColor: BH.slate900,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
      web: { boxShadow: '0 -4px 16px rgba(15, 23, 42, 0.06)' },
    }),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 2,
    minHeight: 52,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 0,
    paddingVertical: 4,
    minHeight: 48,
  },
  navLabelActive: {
    fontSize: 9,
    fontWeight: '800',
    color: ACTIVE,
    letterSpacing: 0.1,
  },
});
