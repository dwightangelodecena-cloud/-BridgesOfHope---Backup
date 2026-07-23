import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KalingaLogoMark } from './KalingaLogoMark';
import { BH } from '../../theme/tokens';

// Sampled from new-logo.png's own mark so the wordmark reads as one color
// with the logo beside it. Plain solid color (not a gradient) — MaskedView
// gradient-text isn't reliable across every target this app renders on
// (notably React Native Web), so a flat match is the robust choice here.
const LOGO_COLOR = '#F0851F';

/** Home header brand — matches family portal orange / navy theme. */
export function FamilyHeaderBrand() {
  return (
    <View style={styles.row}>
      <View style={styles.logoPlate}>
        <Image
          source={require('../../assets/images/new-logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
          accessibilityLabel="Kalinga logo"
        />
      </View>

      <View style={styles.textCol}>
        <Text style={styles.title} numberOfLines={1}>
          Bridges of Hope
        </Text>
        <View style={styles.subRow}>
          <Ionicons name="heart" size={9} color={BH.brand} />
          <Text style={styles.sub} numberOfLines={1}>
            Family Portal
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
    paddingRight: 8,
  },
  logoPlate: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    // new-logo.png is a huge padded canvas (1332x2000) with the mark centered
    // and small — clip the plate and oversize the image below to zoom past
    // the whitespace instead of rendering a tiny glyph via plain "contain".
    overflow: 'hidden',
  },
  logoImage: {
    width: 62,
    height: 93,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 22,
    color: LOGO_COLOR,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 3,
  },
  sub: {
    fontSize: 10.5,
    fontWeight: '700',
    color: BH.slate700,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});

const pageTitleStyles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
    paddingRight: 4,
  },
  logoPlate: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: BH.brandSurface,
    borderWidth: 1,
    borderColor: 'rgba(254, 215, 170, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  accentBar: {
    width: 3,
    height: 26,
    borderRadius: 999,
    backgroundColor: BH.brand,
    flexShrink: 0,
    opacity: 0.9,
  },
  pageTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: BH.navy,
    letterSpacing: -0.3,
    lineHeight: 20,
  },
});

/** Inner-page mobile header — same brand language as home, title only (no subtitle). */
export function FamilyPageTitleBrand({ title }: { title: string }) {
  return (
    <View style={pageTitleStyles.row}>
      <View style={pageTitleStyles.logoPlate}>
        <KalingaLogoMark size={28} variant="plain" />
      </View>
      <View style={pageTitleStyles.textWrap}>
        <View style={pageTitleStyles.accentBar} />
        <Text style={pageTitleStyles.pageTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </View>
  );
}
