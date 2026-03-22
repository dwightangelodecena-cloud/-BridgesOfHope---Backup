import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function ServicesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [showAdmissionDetails, setShowAdmissionDetails] = useState(false);
  const [showMonthlySections, setShowMonthlySections] = useState(false);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Image
          source={require('../assets/images/BOHLogo.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <Text style={styles.headerTitle}>Services</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Fees & Inclusions Card */}
        <View style={styles.mainCard}>
          {/* Close / Back */}
          <View style={styles.closeRow}>
            <TouchableOpacity onPress={() => router.push('/tabs/home')}>
              <Ionicons name="close" size={22} color="#111827" />
            </TouchableOpacity>
          </View>

          {/* Title */}
          <View style={styles.titleRow}>
            <LinearGradient
              colors={['#FF9A73', '#F54E25']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconBadge}
            >
              <MaterialCommunityIcons name="currency-usd" size={30} color="#FFFFFF" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Fees &amp; Inclusions</Text>
              <Text style={styles.cardSubtitle}>
                Transparent pricing for your peace of mind
              </Text>
            </View>
          </View>

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

            <View style={styles.divider} />

            <View style={styles.branchRow}>
              <View style={styles.branchInfo}>
                <MaterialCommunityIcons
                  name="home-city-outline"
                  size={22}
                  color="#111827"
                />
                <View style={{ marginLeft: 10 }}>
                  <Text style={styles.branchName}>Amadeo Branch</Text>
                  <Text style={styles.branchSub}>Provincial Rate</Text>
                </View>
              </View>
              <Text style={styles.branchAmount}>₱33,000</Text>
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
            onPress={() => router.push('/AdmissionForm')}
          >
            <Text style={styles.ctaButtonText}>Admit a patient</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 60,
    backgroundColor: '#F9FAFB',
  },
  headerLogo: {
    width: 60,
    height: 30,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
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
  closeRow: {
    alignItems: 'flex-end',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
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
});

