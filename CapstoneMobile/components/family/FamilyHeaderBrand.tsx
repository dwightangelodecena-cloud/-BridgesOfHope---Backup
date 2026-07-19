import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KalingaLogoMark } from './KalingaLogoMark';

/** Home header brand — matches family portal orange / navy theme. */
export function FamilyHeaderBrand() {
  return (
    <View style={styles.row}>
      <View style={styles.logoPlate}>
        <KalingaLogoMark size={46} variant="plain" />
      </View>

      <View style={styles.textWrap}>
        <View style={styles.accentBar} />
        <View style={styles.textCol}>
          <Text style={styles.kalinga} numberOfLines={1}>
            Kalinga
          </Text>
          <Text style={styles.title} numberOfLines={1}>
            <Text style={styles.titleLead}>Bridges of </Text>
            <Text style={styles.titleAccent}>Hope</Text>
          </Text>
          <View style={styles.subRow}>
            <Ionicons name="heart" size={11} color="#F54E25" />
            <Text style={styles.sub} numberOfLines={1}>
              Family Portal
            </Text>
          </View>
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
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#F54E25',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  textWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  accentBar: {
    width: 3,
    height: 38,
    borderRadius: 2,
    backgroundColor: '#F54E25',
    flexShrink: 0,
    opacity: 0.85,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  kalinga: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F54E25',
    letterSpacing: 0.15,
    lineHeight: 16,
  },
  title: {
    marginTop: 1,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.35,
    lineHeight: 21,
  },
  titleLead: {
    color: '#1B2559',
  },
  titleAccent: {
    color: '#F54E25',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  sub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.1,
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
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  accentBar: {
    width: 3,
    height: 28,
    borderRadius: 2,
    backgroundColor: '#F54E25',
    flexShrink: 0,
    opacity: 0.85,
  },
  pageTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: '#1B2559',
    letterSpacing: -0.3,
    lineHeight: 22,
  },
});

/** Inner-page mobile header — same brand language as home, title only (no subtitle). */
export function FamilyPageTitleBrand({ title }: { title: string }) {
  return (
    <View style={pageTitleStyles.row}>
      <View style={pageTitleStyles.logoPlate}>
        <KalingaLogoMark size={34} variant="plain" />
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
