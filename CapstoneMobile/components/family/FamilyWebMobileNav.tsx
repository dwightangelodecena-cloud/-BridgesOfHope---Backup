import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type IonName = React.ComponentProps<typeof Ionicons>['name'];
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_ROUTES } from '../../lib/navigationConfig';
import { supabase } from '../../lib/supabase';

export type FamilyNavTab = 'home' | 'progress' | 'appointments' | 'reports' | 'profile';

type Props = {
  /** Use `'none'` on auxiliary screens (e.g. patient details, services) so no tab looks “selected”. */
  active: FamilyNavTab | 'none';
};

export function FamilyWebMobileNav({ active }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const go = (route: string) => {
    router.navigate(route as never);
  };

  const onLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          try {
            await supabase.auth.signOut();
          } catch {
            /* ignore */
          }
          router.replace('/login' as never);
        },
      },
    ]);
  };

  const mid = (key: FamilyNavTab, icon: IonName, route: string, a11y: string) => {
    const isActive = active !== 'none' && active === key;
    return (
      <TouchableOpacity
        key={key}
        style={styles.navItem}
        onPress={() => go(route)}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        accessibilityState={{ selected: isActive }}
      >
        <Ionicons name={icon} size={24} color={isActive ? '#F54E25' : '#A3AED0'} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => go(TAB_ROUTES.home)}
          accessibilityRole="button"
          accessibilityLabel="Home"
          accessibilityState={{ selected: active === 'home' }}
        >
          <Ionicons name="home" size={24} color={active === 'home' ? '#F54E25' : '#A3AED0'} />
          {active === 'home' ? <Text style={styles.navLabelActive}>Home</Text> : null}
        </TouchableOpacity>
        {mid('progress', 'trending-up', TAB_ROUTES.progress, 'Request management')}
        {mid('appointments', 'calendar', TAB_ROUTES.appointments, 'Appointments')}
        {mid('reports', 'bar-chart', TAB_ROUTES.reports, 'Reports')}
        {mid('profile', 'person', TAB_ROUTES.profile, 'Profile')}
        <TouchableOpacity style={styles.navItem} onPress={onLogout} accessibilityRole="button" accessibilityLabel="Log out">
          <Ionicons name="log-out-outline" size={24} color="#F54E25" />
        </TouchableOpacity>
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
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    paddingTop: 8,
    zIndex: 2000,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 12 },
    }),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    minHeight: 52,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 0,
  },
  navLabelActive: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F54E25',
  },
});
