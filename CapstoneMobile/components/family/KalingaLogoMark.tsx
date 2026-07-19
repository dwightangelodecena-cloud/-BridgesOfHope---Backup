import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

type Props = {
  size?: number;
  /** `plain` — logo only. `boxed` — light frame for fallback headers. */
  variant?: 'plain' | 'boxed';
};

export function KalingaLogoMark({ size = 48, variant = 'plain' }: Props) {
  const height = Math.round(size * 0.92);

  if (variant === 'plain') {
    return (
      <Image
        source={require('../../assets/images/kalingalogo.png')}
        style={[styles.image, { width: size, height }]}
        resizeMode="contain"
        accessibilityLabel="Kalinga logo"
      />
    );
  }

  const inner = Math.max(24, Math.round(size * 0.76));
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: Math.round(size * 0.22) }]}>
      <Image
        source={require('../../assets/images/kalingalogo.png')}
        style={{ width: inner, height: inner }}
        resizeMode="contain"
        accessibilityLabel="Kalinga logo"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    flexShrink: 0,
  },
  wrap: {
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FED7AA',
    overflow: 'hidden',
  },
});
