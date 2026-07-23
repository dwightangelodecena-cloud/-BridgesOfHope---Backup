import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BH } from '../../theme/tokens';

// Sampled from new-logo.png's own mark so the wordmark reads as one color
// with the logo beside it. Plain solid color (not a gradient) — MaskedView
// gradient-text isn't reliable across every target this app renders on
// (notably React Native Web), so a flat match is the robust choice here.
const LOGO_COLOR = '#F0851F';

/** Home header brand — matches family portal orange / navy theme. */
export function FamilyHeaderBrand({ title = 'Bridges of Hope' }: { title?: string }) {
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
          {title}
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

/** Inner-page mobile header — identical to the Home brand, just with the page title in place of "Bridges of Hope". */
export function FamilyPageTitleBrand({ title }: { title: string }) {
  return <FamilyHeaderBrand title={title} />;
}
