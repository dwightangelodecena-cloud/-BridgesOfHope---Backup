import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { TAB_ROUTES } from '../../lib/navigationConfig';
import { FamilyWebMobileNav } from '../../components/family/FamilyWebMobileNav';
import { FamilyMobilePageHeader } from '../../components/family/FamilyMobilePageHeader';
import { useFamilyPageScroll } from '../../lib/useFamilyPageScroll';
import { ScalePressable } from '../../components/auth/ScalePressable';

const C = {
  orange: '#F54E25',
  orangeLight: '#FF6A3D',
  orangeDark: '#E8441A',
  navy: '#1A2B4A',
  muted: '#64748B',
  white: '#FFFFFF',
};

const MONTHLY_SECTIONS = [
  {
    title: 'Accommodation & Meals',
    icon: 'bed-outline' as const,
    items: [
      'Air-conditioned rooms',
      'Daily meals: Breakfast, Lunch, PM Snack, Dinner',
      'Personalized health & diet plan',
    ],
  },
  {
    title: 'Health & Wellness',
    icon: 'heart-outline' as const,
    items: [
      'Psychoeducation sessions',
      'Relapse prevention seminar',
      'Psychiatric & psychological evaluations',
      'Individual psychotherapy',
    ],
  },
  {
    title: 'Support & Safety',
    icon: 'shield-checkmark-outline' as const,
    items: ['24/7 medical team', '24/7 security', 'Individual & group counseling'],
  },
  {
    title: 'Therapeutic & Holistic Care',
    icon: 'leaf-outline' as const,
    items: [
      'Resident & family healing dialogues',
      'Spiritual activities',
      'Aftercare program',
    ],
  },
  {
    title: 'Additional Services',
    icon: 'add-circle-outline' as const,
    items: [
      'Laundry & haircut (included)',
      'Medications & personal toiletries – to be provided by family',
    ],
  },
];

export default function ServicesScreen() {
  const insets = useSafeAreaInsets();
  const { scrollRef, scrollToTop } = useFamilyPageScroll();
  const router = useRouter();

  const [showAdmissionDetails, setShowAdmissionDetails] = useState(false);
  const [showMonthlySections, setShowMonthlySections] = useState(false);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <FamilyMobilePageHeader title="Services" onBrandPress={scrollToTop} />

      <View style={styles.heroBand}>
        <LinearGradient
          colors={['#0B1528', '#152238', '#2A1A28']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroBandWash} />
        <View style={styles.heroBandInner}>
          <LinearGradient colors={[C.orangeLight, C.orange, C.orangeDark]} style={styles.heroIcon}>
            <Ionicons name="pricetag-outline" size={24} color="#fff" />
          </LinearGradient>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>CARE PACKAGES</Text>
            <Text style={styles.heroTitle}>Fees & inclusions</Text>
            <Text style={styles.heroSub}>Transparent pricing for your peace of mind</Text>
          </View>
          <TouchableOpacity
            style={styles.heroCloseBtn}
            onPress={() => router.navigate(TAB_ROUTES.home)}
            accessibilityRole="button"
            accessibilityLabel="Close and go to home"
            hitSlop={8}
          >
            <Ionicons name="close" size={20} color={C.white} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.bodyScroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          activeOpacity={0.92}
          style={styles.admissionWrapper}
          onPress={() => setShowAdmissionDetails((prev) => !prev)}
        >
          <LinearGradient
            colors={[C.orangeLight, C.orange, C.orangeDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.admissionCard}
          >
            <View style={styles.admissionTopRow}>
              <View style={styles.admissionTag}>
                <Ionicons name="sparkles-outline" size={12} color="#fff" />
                <Text style={styles.admissionTagText}>One-time fee</Text>
              </View>
              <View style={styles.tapHintRow}>
                <Text style={styles.tapHintText}>Tap for inclusions</Text>
                <Ionicons
                  name={showAdmissionDetails ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#fff"
                />
              </View>
            </View>

            <Text style={styles.admissionLabel}>Admission fee</Text>
            <Text style={styles.admissionAmount}>₱30,000</Text>

            <View style={styles.admissionDetails}>
              {[
                'One-time payment upon admission',
                'PWD-discounted rate',
                'The Initial Fee is paid at admission, and the Monthly Fee applies starting the NEXT MONTH.',
              ].map((line) => (
                <View key={line} style={styles.bulletRow}>
                  <Ionicons name="checkmark-circle" size={14} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.bulletText}>{line}</Text>
                </View>
              ))}
            </View>

            {showAdmissionDetails ? (
              <View style={styles.inclusionsBlock}>
                <View style={styles.inclusionsDivider} />
                <Text style={styles.inclusionsTitle}>Includes</Text>
                {[
                  'Physical & Laboratory Tests',
                  'Psychiatric Evaluation',
                  '2 Psychological Evaluations (Admission & Reintegration)',
                  'Drug Test',
                  'Alcohol Test',
                  'Pregnancy Test (for female patients)',
                ].map((line) => (
                  <View key={line} style={styles.bulletRow}>
                    <Ionicons name="checkmark" size={12} color="#FFF7ED" />
                    <Text style={styles.bulletText}>{line}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Monthly fees</Text>
            <View style={styles.pill}>
              <Text style={styles.pillText}>Payable within 30 days</Text>
            </View>
          </View>

          <View style={styles.branchCard}>
            <View style={styles.branchRow}>
              <View style={styles.branchInfo}>
                <LinearGradient colors={['#FFF7ED', '#FFEDD5']} style={styles.branchIcon}>
                  <MaterialCommunityIcons
                    name="office-building-marker-outline"
                    size={22}
                    color="#EA580C"
                  />
                </LinearGradient>
                <View>
                  <Text style={styles.branchName}>Imus Branch</Text>
                  <Text style={styles.branchSub}>City rate</Text>
                </View>
              </View>
              <View style={styles.branchPriceWrap}>
                <Text style={styles.branchAmount}>₱35,000</Text>
                <Text style={styles.branchPer}>/ month</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.dropdownToggle}
              onPress={() => setShowMonthlySections((prev) => !prev)}
              accessibilityRole="button"
              accessibilityLabel={showMonthlySections ? 'Hide inclusions' : 'Show inclusions'}
            >
              <Text style={styles.dropdownLabel}>
                {showMonthlySections ? 'Hide inclusions' : 'View monthly inclusions'}
              </Text>
              <Ionicons
                name={showMonthlySections ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={C.orange}
              />
            </TouchableOpacity>

            {showMonthlySections ? (
              <View style={styles.sectionsContainer}>
                {MONTHLY_SECTIONS.map((section) => (
                  <FeeSection key={section.title} title={section.title} icon={section.icon} items={section.items} />
                ))}
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.infoPillRow}>
          <View style={styles.infoPillIcon}>
            <Ionicons name="accessibility-outline" size={18} color="#1D4ED8" />
          </View>
          <Text style={styles.infoPillText}>
            PWD-discounted rates available for eligible patients
          </Text>
        </View>

        <ScalePressable
          onPress={() => router.navigate(TAB_ROUTES.admission)}
          style={styles.ctaWrap}
        >
          <LinearGradient
            colors={[C.orangeLight, C.orange, C.orangeDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cta}
          >
            <View style={styles.ctaInner}>
              <Ionicons name="person-add-outline" size={18} color="#fff" />
              <Text style={styles.ctaText}>Admit a patient</Text>
            </View>
          </LinearGradient>
        </ScalePressable>
      </ScrollView>

      <FamilyWebMobileNav active="none" />
    </View>
  );
}

function FeeSection({
  title,
  icon,
  items,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: string[];
}) {
  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionBlockHead}>
        <Ionicons name={icon} size={16} color={C.orange} />
        <Text style={styles.sectionBlockTitle}>{title}</Text>
      </View>
      {items.map((item) => (
        <View style={styles.sectionBulletRow} key={item}>
          <Ionicons name="checkmark-circle" size={13} color="#16A34A" />
          <Text style={styles.sectionItemText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  heroBand: {
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 18,
    position: 'relative',
  },
  heroBandWash: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '50%',
    backgroundColor: 'rgba(74, 40, 50, 0.4)',
    borderTopLeftRadius: 80,
  },
  heroBandInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    zIndex: 1,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: { flex: 1, minWidth: 0 },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#FF8A65',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: C.white,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 17,
    fontWeight: '500',
  },
  heroCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyScroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  admissionWrapper: {
    marginBottom: 14,
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 8px 24px rgba(245, 78, 37, 0.35)' },
      default: {
        shadowColor: C.orange,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
        elevation: 8,
      },
    }),
  },
  admissionCard: {
    padding: 18,
  },
  admissionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  admissionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  admissionTagText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  tapHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tapHintText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '600',
  },
  admissionLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  admissionAmount: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  admissionDetails: { marginTop: 8 },
  inclusionsBlock: { marginTop: 10 },
  inclusionsDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: 10,
  },
  inclusionsTitle: {
    color: '#FFF7ED',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  bulletText: {
    flex: 1,
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  sectionCard: {
    backgroundColor: C.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    padding: 16,
    marginBottom: 14,
    ...Platform.select({
      web: { boxShadow: '0 4px 16px rgba(15, 23, 42, 0.05)' },
      default: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: C.navy,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  pillText: {
    fontSize: 10,
    color: '#1D4ED8',
    fontWeight: '700',
  },
  branchCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    backgroundColor: '#FAFBFC',
    padding: 14,
  },
  branchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  branchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  branchIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  branchName: {
    fontSize: 14,
    fontWeight: '800',
    color: C.navy,
  },
  branchSub: {
    fontSize: 11,
    color: C.muted,
    marginTop: 2,
    fontWeight: '500',
  },
  branchPriceWrap: { alignItems: 'flex-end' },
  branchAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#16A34A',
  },
  branchPer: {
    fontSize: 10,
    color: C.muted,
    fontWeight: '600',
  },
  dropdownToggle: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8EDF3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dropdownLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: C.orange,
  },
  sectionsContainer: {
    marginTop: 12,
    gap: 4,
  },
  sectionBlock: {
    backgroundColor: C.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    padding: 12,
    marginBottom: 8,
  },
  sectionBlockHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionBlockTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: C.navy,
  },
  sectionBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  sectionItemText: {
    flex: 1,
    fontSize: 12,
    color: C.muted,
    lineHeight: 17,
    fontWeight: '500',
  },
  infoPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    gap: 10,
  },
  infoPillIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoPillText: {
    flex: 1,
    fontSize: 12,
    color: '#1E3A8A',
    fontWeight: '600',
    lineHeight: 17,
  },
  ctaWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 8,
    ...Platform.select({
      web: {},
      default: {
        shadowColor: C.orangeDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 4,
      },
    }),
  },
  cta: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
