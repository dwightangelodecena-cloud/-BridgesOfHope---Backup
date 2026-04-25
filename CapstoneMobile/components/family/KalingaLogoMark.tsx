import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

type Props = {
  /** Outer box size (default matches previous “BH” badge). */
  size?: number;
};

export function KalingaLogoMark({ size = 44 }: Props) {
  const inner = Math.max(24, Math.round(size * 0.72));
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: Math.round(size * 0.27) }]}>
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
  wrap: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E9EDF7',
    overflow: 'hidden',
  },
});
