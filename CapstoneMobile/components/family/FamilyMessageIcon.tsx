import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  /** `md` — action card (48px); `sm` — compact list row */
  size?: 'sm' | 'md';
  badge?: number;
};

const SIZES = {
  sm: { box: 36, icon: 18, radius: 10, badgeMin: 16, badgeFont: 9 },
  md: { box: 48, icon: 22, radius: 12, badgeMin: 18, badgeFont: 10 },
} as const;

/** Soft coral message tile — matches admin web Messages nav icon. */
export function FamilyMessageIcon({ size = 'md', badge = 0 }: Props) {
  const s = SIZES[size];
  const count = Number(badge) || 0;
  const label = count > 99 ? '99+' : String(count);

  return (
    <View
      style={[
        styles.box,
        {
          width: s.box,
          height: s.box,
          borderRadius: s.radius,
        },
      ]}
    >
      <Ionicons name="chatbubble-ellipses-outline" size={s.icon} color="#F54E25" />
      {count > 0 ? (
        <View
          style={[
            styles.badge,
            { minWidth: s.badgeMin, height: s.badgeMin, borderRadius: s.badgeMin / 2 },
          ]}
        >
          <Text style={[styles.badgeText, { fontSize: s.badgeFont }]}>{label}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#FFF5F2',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#DC2626',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
