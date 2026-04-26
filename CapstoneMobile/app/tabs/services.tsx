import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  Dimensions,
  Image,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TAB_ROUTES } from '../../lib/navigationConfig';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { FamilyWebMobileNav } from '../../components/family/FamilyWebMobileNav';
import { FamilyFloatingChat } from '../../components/family/FamilyFloatingChat';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const NOTIFICATION_ITEMS = [
  'Submit missing laboratory result before Friday.',
  'Family support session is scheduled on April 5, 10:00 AM.',
  'Weekly report reviewed by your assigned counselor.',
];

function deriveInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => (p[0] ? p[0].toUpperCase() : '')).join('') || 'FU';
}

export default function ServicesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [showNotifications, setShowNotifications] = useState(false);
  const [displayName, setDisplayName] = useState('Family User');
  const [userInitials, setUserInitials] = useState('FU');
  const [showAdmissionDetails, setShowAdmissionDetails] = useState(false);
  const [showMonthlySections, setShowMonthlySections] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadUser = async () => {
      if (!isSupabaseConfigured()) return;
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user;
        let resolved =
          (user?.user_metadata?.full_name as string | undefined)?.trim() ||
          [user?.user_metadata?.first_name, user?.user_metadata?.last_name]
            .filter(Boolean)
            .join(' ')
            .trim() ||
          'Family User';
        if (user?.id) {
          const { data: profileRow } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .maybeSingle();
          if (profileRow?.full_name?.trim()) resolved = profileRow.full_name.trim();
        }
        if (mounted) {
          setDisplayName(resolved);
          setUserInitials(deriveInitials(resolved));
        }
      } catch {
        /* keep defaults */
      }
    };
    loadUser();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Modal
        visible={showNotifications}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotifications(false)}
      >
        <View style={styles.notifModalRoot}>
          <Pressable style={styles.notifModalBackdrop} onPress={() => setShowNotifications(false)} />
          <View style={[styles.notificationsDropdown, { top: insets.top + 52, right: 16 }]}>
            <View style={styles.notificationsDropdownTitleRow}>
              <Ionicons name="notifications" size={16} color="#F54E25" />
              <Text style={styles.notificationsDropdownTitle}>Notifications</Text>
            </View>
            {NOTIFICATION_ITEMS.map((item) => (
              <View key={item} style={styles.notificationsDropdownRow}>
                <Ionicons name="checkmark-circle" size={15} color="#2B31ED" />
                <Text style={styles.notificationsDropdownText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <View style={styles.headerCenter}>
          <Text style={styles.headerBrandTitle}>Services</Text>
          <Text style={styles.headerWelcomeLine} numberOfLines={1}>
            Welcome Back, {(displayName || 'Family User').trim().split(/\s+/)[0]}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerCircleBtn}
            onPress={() => setShowNotifications((v) => !v)}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerCircleBtn}
            onPress={() => router.navigate(TAB_ROUTES.profile)}
            accessibilityLabel="Profile"
          >
            <Text style={styles.headerAvatarText}>{userInitials}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.feesTitleRow}>
          <View style={styles.feesTitleTextWrap}>
            <Text style={styles.feesPageTitle}>
              Fees &amp; <Text style={styles.feesPageAccent}>Inclusions</Text>
            </Text>
          </View>
          <TouchableOpacity
            style={styles.feesCloseBtn}
            onPress={() => router.navigate(TAB_ROUTES.home)}
            accessibilityRole="button"
            accessibilityLabel="Close and go to home"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={22} color="#1B2559" />
          </TouchableOpacity>
        </View>
        <Text style={styles.feesPageSubtitle}>Transparent pricing for your peace of mind</Text>

        <View style={styles.mainCard}>
          {/* Admission Fee */}
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.admissionWrapper}
            onPress={() => setShowAdmissionDetails(prev => !prev)}
          >
            <LinearGradient
              colors={['#FF9A73', '#F54E25']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.admissionCard}
            >
              <View style={styles.admissionHeaderRow}>
                <View>
                  <Text style={styles.admissionLabel}>Admission Fee</Text>
                  <Text style={styles.admissionAmount}>₱30,000</Text>
                </View>
                <View style={styles.tapHintRow}>
                  <Text style={styles.tapHintText}>Tap to see Inclusions</Text>
                  <Ionicons
                    name={showAdmissionDetails ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#FFFFFF"
                    style={{ marginLeft: 4 }}
                  />
                </View>
              </View>

              {/* Always-visible summary bullets */}
              <View style={styles.admissionDetails}>
                <View style={styles.bulletRow}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.bulletText}>One-time payment upon admission</Text>
                </View>
                <View style={styles.bulletRow}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.bulletText}>PWD-discounted rate</Text>
                </View>
                <View style={styles.bulletRow}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.bulletText}>
                    The Initial Fee is paid at admission, and the Monthly Fee applies
                    starting the NEXT MONTH.
                  </Text>
                </View>
              </View>

              {/* Extra inclusions only when expanded */}
              {showAdmissionDetails && (
                <View style={styles.inclusionsBlock}>
                  <View style={styles.inclusionsDivider} />
                  <Text style={styles.inclusionsTitle}>Includes:</Text>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>Physical &amp; Laboratory Tests</Text>
                  </View>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>Psychiatric Evaluation</Text>
                  </View>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>
                      2 Psychological Evaluations (Admission &amp; Reintegration)
                    </Text>
                  </View>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>Drug Test</Text>
                  </View>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>Alcohol Test</Text>
                  </View>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>
                      Pregnancy Test (for female patients)
                    </Text>
                  </View>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Monthly Fees */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Monthly Fees</Text>
            <View style={styles.pill}>
              <Text style={styles.pillText}>Payable within 30 days</Text>
            </View>
          </View>

          {/* Branch fees */}
          <View style={styles.branchCard}>
            <View style={styles.branchRow}>
              <View style={styles.branchInfo}>
                <MaterialCommunityIcons
                  name="office-building-marker-outline"
                  size={22}
                  color="#111827"
                />
                <View style={{ marginLeft: 10 }}>
                  <Text style={styles.branchName}>Imus Branch</Text>
                  <Text style={styles.branchSub}>City Rate</Text>
                </View>
              </View>
              <Text style={styles.branchAmount}>₱35,000</Text>
            </View>

            {/* Dropdown arrow for inclusions */}
            <TouchableOpacity
              style={styles.dropdownToggle}
              onPress={() => setShowMonthlySections(prev => !prev)}
            >
              <Ionicons
                name={showMonthlySections ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#6B7280"
              />
            </TouchableOpacity>

            {showMonthlySections && (
              <View style={styles.sectionsContainer}>
                <FeeSection
                  title="Accommodation & Meals"
                  items={[
                    'Air-conditioned rooms',
                    'Daily meals: Breakfast, Lunch, PM Snack, Dinner',
                    'Personalized health & diet plan',
                  ]}
                />
                <FeeSection
                  title="Health & Wellness"
                  items={[
                    'Psychoeducation sessions',
                    'Relapse prevention seminar',
                    'Psychiatric & psychological evaluations',
                    'Individual psychotherapy',
                  ]}
                />
                <FeeSection
                  title="Support & Safety"
                  items={[
                    '24/7 medical team',
                    '24/7 security',
                    'Individual & group counseling',
                  ]}
                />
                <FeeSection
                  title="Therapeutic & Holistic Care"
                  items={[
                    'Resident & family healing dialogues',
                    'Spiritual activities',
                    'Aftercare program',
                  ]}
                />
                <FeeSection
                  title="Additional Services"
                  items={[
                    'Laundry & haircut (included)',
                    'Medications & personal toiletries – to be provided by family',
                  ]}
                />
              </View>
            )}
          </View>

          {/* PWD note */}
          <View style={styles.infoPillRow}>
            <View style={styles.infoPillIcon}>
              <Ionicons name="person-circle-outline" size={20} color="#2B31ED" />
            </View>
            <Text style={styles.infoPillText}>
              PWD-discounted rates available for eligible patients
            </Text>
          </View>

          {/* CTA button */}
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => router.navigate(TAB_ROUTES.admission)}
          >
            <Text style={styles.ctaButtonText}>Admit a patient</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <FamilyWebMobileNav active="none" />
      <FamilyFloatingChat />
    </View>
  );
}

type FeeSectionProps = {
  title: string;
  items: string[];
};

const FeeSection = ({ title, items }: FeeSectionProps) => (
  <View style={styles.sectionBlock}>
    <Text style={styles.sectionBlockTitle}>{title}</Text>
    {items.map(item => (
      <View style={styles.bulletRow} key={item}>
        <View style={styles.smallBulletDot} />
        <Text style={styles.sectionItemText}>{item}</Text>
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    minHeight: 56,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F1',
    zIndex: 10,
  },
  headerCenter: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerBrandTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F54E25',
  },
  headerWelcomeLine: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F54E25',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F54E25',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  headerAvatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  notifModalRoot: {
    flex: 1,
  },
  notifModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  notificationsDropdown: {
    position: 'absolute',
    width: Math.min(340, width - 32),
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9EDF7',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#1B2559',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
  notificationsDropdownTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  notificationsDropdownTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1B2559',
  },
  notificationsDropdownRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  notificationsDropdownText: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  bodyScroll: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    overflow: 'visible',
  },
  feesTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  feesTitleTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  feesCloseBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feesPageTitle: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 30,
    color: '#1B2559',
  },
  feesPageAccent: {
    color: '#F54E25',
  },
  feesPageSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#A3AED0',
    marginTop: 6,
    marginBottom: 14,
  },
  mainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  admissionWrapper: {
    marginTop: 4,
    marginBottom: 20,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#F54E25',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  admissionCard: {
    borderRadius: 24,
    padding: 18,
  },
  admissionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  admissionLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  admissionAmount: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  tapHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tapHintText: {
    color: '#FEE2E2',
    fontSize: 11,
    fontWeight: '500',
  },
  admissionDetails: {
    marginTop: 14,
  },
  inclusionsBlock: {
    marginTop: 8,
  },
  inclusionsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#FED7AA',
    marginBottom: 8,
  },
  inclusionsTitle: {
    color: '#FFF7ED',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FED7AA',
    marginTop: 6,
    marginRight: 8,
  },
  bulletText: {
    flex: 1,
    color: '#FFF7ED',
    fontSize: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
  },
  pillText: {
    fontSize: 11,
    color: '#4F46E5',
    fontWeight: '500',
  },
  branchCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
  },
  branchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  branchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  branchName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  branchSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  branchAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#16A34A',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 10,
  },
  dropdownToggle: {
    marginTop: 4,
    alignItems: 'center',
  },
  sectionsContainer: {
    marginTop: 10,
  },
  sectionBlock: {
    marginTop: 10,
  },
  sectionBlockTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  smallBulletDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#9CA3AF',
    marginTop: 6,
    marginRight: 8,
  },
  sectionItemText: {
    flex: 1,
    fontSize: 12,
    color: '#4B5563',
  },
  infoPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 18,
  },
  infoPillIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  infoPillText: {
    flex: 1,
    fontSize: 12,
    color: '#1F2937',
  },
  ctaButton: {
    marginTop: 18,
    backgroundColor: '#F54E25',
    borderRadius: 18,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderColor: '#F1F1F1',
    backgroundColor: '#FFFFFF',
    paddingTop: 10,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabItem: {
    alignItems: 'center',
    flex: 1,
  },
  tabIcon: {
    width: 24,
    height: 24,
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 12,
    color: '#999999',
  },
  activeTabLabel: {
    color: '#F54E25',
    fontWeight: '600',
  },
});

