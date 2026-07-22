import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_ROUTES } from '../../lib/navigationConfig';
import { BH } from '../../theme/tokens';

type IonName = React.ComponentProps<typeof Ionicons>['name'];

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

/** The center tab gets the raised, always-on circular treatment. */
const POPPED_KEY: FamilyNavTab = 'progress';

const INACTIVE = 'rgba(255,255,255,0.5)';
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

          if (item.key === POPPED_KEY) {
            return (
              <TouchableOpacity
                key={item.key}
                style={styles.poppedItem}
                onPress={() => go(item.route)}
                accessibilityRole="button"
                accessibilityLabel={item.a11y}
                accessibilityState={{ selected: isActive }}
              >
                <View style={styles.poppedCircle}>
                  <Ionicons name={item.icon} size={24} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            );
          }

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
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{item.label}</Text>
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
    backgroundColor: BH.navy,
    paddingTop: 10,
    minHeight: 68,
    zIndex: 2000,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
      web: { boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.18)' },
    }),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    paddingHorizontal: 2,
    minHeight: 52,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 0,
    paddingVertical: 4,
    minHeight: 48,
  },
  navLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: INACTIVE,
    letterSpacing: 0.1,
  },
  navLabelActive: {
    fontWeight: '800',
    color: ACTIVE,
  },
  poppedItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    minWidth: 0,
  },
  poppedCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: BH.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -26,
    borderWidth: 4,
    borderColor: BH.navy,
    ...Platform.select({
      ios: {
        shadowColor: BH.brand,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
      web: { boxShadow: '0 4px 14px rgba(245, 78, 37, 0.45)' },
    }),
  },
});
