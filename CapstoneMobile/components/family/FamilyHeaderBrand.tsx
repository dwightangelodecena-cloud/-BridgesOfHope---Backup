import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { KalingaLogoMark } from './KalingaLogoMark';
import { BH } from '../../theme/tokens';

// Matches new-logo.png's own gradient (deep orange base → gold highlight).
const LOGO_GRADIENT = ['#F2541C', '#FFC93C'] as const;

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
        <MaskedView maskElement={<Text style={styles.title} numberOfLines={1}>Bridges of Hope</Text>}>
          <LinearGradient colors={LOGO_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={[styles.title, styles.titleHidden]} numberOfLines={1}>
              Bridges of Hope
            </Text>
          </LinearGradient>
        </MaskedView>
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
    color: '#000000',
  },
  titleHidden: {
    opacity: 0,
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
