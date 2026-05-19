import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { DeviceEventEmitter } from 'react-native';
import {
  FAMILY_PROFILE_AVATAR_CHANGED,
  resolveFamilyProfileAvatarMobile,
} from '../../lib/familyProfileAvatarMobile';

type Props = {
  userId: string;
  initials: string;
  onPress: () => void;
  size?: number;
};

export function FamilyHeaderAvatarMobile({ userId, initials, onPress, size = 36 }: Props) {
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
      style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }]}
    >
      {src ? (
        <Image source={{ uri: src }} style={styles.img} />
      ) : (
        <View style={[styles.fallback, { borderRadius: size / 2 }]}>
          <Text style={[styles.initials, { fontSize: size * 0.34 }]}>{initials}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  fallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F54E25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: '#FFFFFF', fontWeight: '700' },
});
