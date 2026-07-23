import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform, type Insets } from 'react-native';
import { DeviceEventEmitter } from 'react-native';
import {
  FAMILY_PROFILE_AVATAR_CHANGED,
  resolveFamilyProfileAvatarMobile,
} from '../../lib/familyProfileAvatarMobile';
import { BH } from '../../theme/tokens';

type Props = {
  userId: string;
  initials: string;
  onPress: () => void;
  size?: number;
  /** Expands the tappable area without growing the visual circle. */
  hitSlop?: Insets;
};

export function FamilyHeaderAvatarMobile({ userId, initials, onPress, size = 36, hitSlop }: Props) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!userId.trim()) {
        if (mounted) setSrc(null);
        return;
      }
      const url = await resolveFamilyProfileAvatarMobile(userId);
      if (mounted) setSrc(url);
    };
    void load();
    const sub = DeviceEventEmitter.addListener(FAMILY_PROFILE_AVATAR_CHANGED, () => {
      void load();
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, [userId]);

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Profile"
      hitSlop={hitSlop}
      style={[styles.shadowWrap, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
        {src ? (
          <Image source={{ uri: src }} style={styles.img} />
        ) : (
          <View style={[styles.fallback, { borderRadius: size / 2 }]}>
            <Text style={[styles.initials, { fontSize: size * 0.34 }]}>{initials}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Shadow lives on the outer, non-clipping wrapper — a View with both
  // overflow:hidden (for the rounded image clip) and a shadow would clip
  // its own shadow away.
  shadowWrap: {
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.18,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
      web: { boxShadow: '0 3px 8px rgba(15, 23, 42, 0.18)' },
    }),
  },
  wrap: {
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  img: { width: '100%', height: '100%' },
  fallback: {
    width: '100%',
    height: '100%',
    backgroundColor: BH.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: BH.brandContrast, fontWeight: '700' },
});
