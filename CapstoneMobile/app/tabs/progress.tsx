import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  TextInput,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { TAB_ROUTES } from '../../lib/navigationConfig';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { uiPatientFromRow, type PatientRow, type UIPatient } from '../../lib/patientMappers';

const { width } = Dimensions.get('window');

/** UI labels match web Progress filter; values map to `clinical_status` in DB. */
const STATUS_FILTER_OPTIONS = [
  { label: 'All statuses', value: 'all' },
  { label: 'Recovering', value: 'recovering' },
  { label: 'In Treatment', value: 'in_treatment' },
  { label: 'Stable', value: 'stable' },
] as const;

const NOTIFICATION_ITEMS = [
  'Submit missing laboratory result before Friday.',
  'Family support session is scheduled on April 5, 10:00 AM.',
  'Weekly report reviewed by your assigned counselor.',
];

function deriveInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => (p[0] ? p[0].toUpperCase() : '')).join('') || 'FU';
}

function statusMatchesFilter(filter: string, clinicalStatus: string): boolean {
  if (filter === 'all') return true;
  const c = (clinicalStatus || '').toLowerCase();
  if (filter === 'stable') return c === 'stable';
  if (filter === 'recovering') return c === 'improving';
  if (filter === 'in_treatment') return c === 'improving' || c === 'declining';
  return false;
}

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [displayName, setDisplayName] = useState('Family User');
  const [userInitials, setUserInitials] = useState('FU');
  const [patients, setPatients] = useState<UIPatient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  const loadPatients = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setPatients([]);
      setPatientsLoading(false);
      return;
    }
    setPatientsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        setPatients([]);
        return;
      }
      const { data, error } = await supabase
        .from('patients')
        .select(
          'id, full_name, admitted_at, progress_percent, clinical_status, primary_concern, family_id, discharged_at'
        )
        .eq('family_id', user.id)
        .is('discharged_at', null)
        .order('admitted_at', { ascending: false });

      if (error) {
        console.warn('[progress patients]', error.message);
        setPatients([]);
        return;
      }
      const list = (data || [])
        .map((r) => uiPatientFromRow(r as unknown as PatientRow))
        .filter((x): x is UIPatient => x != null);
      setPatients(list);
    } catch {
      setPatients([]);
    } finally {
      setPatientsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPatients();
    }, [loadPatients])
  );

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

  const filteredPatients = patients.filter((p) => {
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch = !q || (p.name || '').toLowerCase().includes(q);
    const matchesStatus = statusMatchesFilter(statusFilter, p.status);
    return matchesSearch && matchesStatus;
  });

  const avgProgress = patients.length
    ? Math.round(
        patients.reduce((sum, p) => sum + (Number(p.progress) || 0), 0) / patients.length
      )
    : 0;

  const dischargeReadyCount = patients.filter((p) => (Number(p.progress) || 0) >= 80).length;

  const statusFilterLabel =
    STATUS_FILTER_OPTIONS.find((o) => o.value === statusFilter)?.label ?? 'All statuses';

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
          <Text style={styles.headerBrandTitle}>Progress</Text>
          <Text style={styles.headerWelcomeLine} numberOfLines={1}>
            Welcome back, {displayName}
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
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => setStatusMenuOpen(false)}
      >
        <Text style={styles.helloTitle}>
          <Text style={styles.helloAccent}>Hello,</Text> {displayName}
        </Text>
        <Text style={styles.helloSubtitle}>{"Here's an overview of your family members"}</Text>

        <View style={styles.toolsRow}>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={18} color="#A3AED0" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search patient by name..."
              placeholderTextColor="#A3AED0"
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
          </View>

          <View style={styles.statusDropdownWrap}>
            <View style={styles.statusShell}>
              <TouchableOpacity
                style={[
                  styles.statusTriggerInner,
                  statusMenuOpen && styles.statusTriggerInnerOpen,
                ]}
                onPress={() => setStatusMenuOpen((o) => !o)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ expanded: statusMenuOpen }}
              >
                <Text style={styles.statusTriggerText} numberOfLines={1}>
                  {statusFilterLabel}
                </Text>
                <Ionicons
                  name={statusMenuOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#1B2559"
                />
              </TouchableOpacity>
            {statusMenuOpen && (
              <View style={styles.statusMenuList}>
                {STATUS_FILTER_OPTIONS.map((opt, idx) => {
                  const selected = statusFilter === opt.value;
                  const isLast = idx === STATUS_FILTER_OPTIONS.length - 1;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.statusMenuItem,
                        selected && styles.statusMenuItemSelected,
                        isLast && styles.statusMenuItemLast,
                      ]}
                      onPress={() => {
                        setStatusFilter(opt.value);
                        setStatusMenuOpen(false);
                      }}
                    >
                      <Text
                        style={[styles.statusMenuItemText, selected && styles.statusMenuItemTextSelected]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            </View>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <ProgressMetricCard
            icon="document-text-outline"
            value={String(patients.length)}
            label="Total Patients"
          />
          <ProgressMetricCard
            icon="checkmark-done-circle-outline"
            value={`${avgProgress}%`}
            label="Average Progress"
          />
          <ProgressMetricCard
            icon="warning-outline"
            value={String(dischargeReadyCount)}
            label="Discharge Ready"
          />
        </View>

        {patientsLoading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color="#F54E25" />
            <Text style={styles.loadingText}>Loading patients…</Text>
          </View>
        ) : (
          <>
            {filteredPatients.map((patient) => (
              <View key={patient.id} style={styles.patientCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.patientAvatarRing}>
                    <Ionicons name="person-outline" size={28} color="#A3AED0" />
                  </View>
                  <View style={styles.cardHeaderText}>
                    <Text style={styles.patientName}>{patient.name}</Text>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusBadgeText}>{patient.status || '—'}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.statsGrid}>
                  <View style={styles.statCell}>
                    <Ionicons name="calendar-outline" size={20} color="#4318FF" />
                    <View style={styles.statTextCol}>
                      <Text style={styles.statLabel}>Date of Admission</Text>
                      <Text style={styles.statValue}>{patient.date || '—'}</Text>
                    </View>
                  </View>
                  <View style={styles.statCell}>
                    <Ionicons name="extension-puzzle-outline" size={20} color="#4318FF" />
                    <View style={styles.statTextCol}>
                      <Text style={styles.statLabel}>Success Rate</Text>
                      <Text style={styles.statValue}>
                        {patient.progress != null ? `${patient.progress}%` : '—'}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.statCell, styles.statCellFull]}>
                    <View style={styles.recoveryBlock}>
                      <View style={styles.recoveryLabelRow}>
                        <Ionicons name="trending-up" size={16} color="#22C55E" />
                        <Text style={styles.statLabel}>Recovery Progress</Text>
                      </View>
                      <View style={styles.progressRow}>
                        <View style={styles.progressTrack}>
                          <View
                            style={[styles.progressFill, { width: `${patient.progress}%` }]}
                          />
                        </View>
                        <Text style={styles.progressPct}>{patient.progress}%</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.statCell}>
                    <Ionicons name="locate-outline" size={20} color="#4318FF" />
                    <View style={styles.statTextCol}>
                      <Text style={styles.statLabel}>Activities</Text>
                      <Text style={styles.activitiesMuted}>No Current Activities</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.viewDetailsBtn}
                  onPress={() =>
                    router.push({
                      pathname: TAB_ROUTES.weeklyReport,
                      params: { patientId: patient.id, patientName: patient.name },
                    })
                  }
                >
                  <Ionicons name="pulse" size={18} color="#FFFFFF" />
                  <Text style={styles.viewDetailsBtnText}>View Details</Text>
                </TouchableOpacity>
              </View>
            ))}

            {!patientsLoading && filteredPatients.length === 0 && patients.length > 0 && (
              <View style={styles.emptyFilterCard}>
                <Text style={styles.emptyFilterText}>
                  No patients found for your current filter.
                </Text>
              </View>
            )}

            {!patientsLoading && patients.length === 0 && (
              <View style={styles.emptyFilterCard}>
                <Text style={styles.emptyFilterText}>
                  {isSupabaseConfigured()
                    ? 'No admitted patients yet. Submit an admission request to add a family member.'
                    : 'Connect Supabase to load patients linked to your account.'}
                </Text>
              </View>
            )}
          </>
        )}

        <TouchableOpacity
          style={styles.admitCard}
          onPress={() => router.navigate(TAB_ROUTES.admission)}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={44} color="#A3AED0" />
          <Text style={styles.admitCardText}>Admit a Patient</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 10 }]}>
        <TabItem
          img={require('../../assets/images/home-icon.png')}
          label="Home"
          onPress={() => router.navigate(TAB_ROUTES.home)}
        />
        <TabItem
          img={require('../../assets/images/progress-icon.png')}
          label="Progress"
          active
          onPress={() => router.navigate(TAB_ROUTES.progress)}
        />
        <TabItem
          img={require('../../assets/images/messages-icon.png')}
          label="Message"
          onPress={() => router.navigate(TAB_ROUTES.messages)}
        />
        <TabItem
          img={require('../../assets/images/profile-icon.png')}
          label="Profile"
          onPress={() => router.navigate(TAB_ROUTES.profile)}
        />
      </View>
    </View>
  );
}

function ProgressMetricCard({
  icon,
  value,
  label,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  value: string;
  label: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Ionicons name={icon} size={22} color="#F54E25" />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const TabItem = ({ img, label, active, onPress }: any) => (
  <TouchableOpacity style={styles.tabItem} onPress={onPress}>
    <Image
      source={img}
      style={[styles.tabIcon, { tintColor: active ? '#F54E25' : '#999999' }]}
      resizeMode="contain"
    />
    <Text style={[styles.tabLabel, active && styles.activeTabLabel]}>{label}</Text>
  </TouchableOpacity>
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    overflow: 'visible',
  },
  helloTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1B2559',
  },
  helloAccent: {
    color: '#F54E25',
  },
  helloSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#A3AED0',
    marginTop: 6,
    marginBottom: 14,
  },
  toolsRow: {
    gap: 12,
    marginBottom: 18,
    zIndex: 20,
  },
  statusDropdownWrap: {
    position: 'relative',
    zIndex: 30,
  },
  statusShell: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    backgroundColor: '#FAFAFA',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  statusTriggerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    minHeight: 48,
    backgroundColor: '#FAFAFA',
  },
  statusTriggerInnerOpen: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  statusTriggerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1B2559',
    marginRight: 8,
  },
  statusMenuList: {
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  statusMenuItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEF2F6',
  },
  statusMenuItemLast: {
    borderBottomWidth: 0,
  },
  statusMenuItemSelected: {
    backgroundColor: '#DBEAFE',
  },
  statusMenuItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1B2559',
  },
  statusMenuItemTextSelected: {
    fontWeight: '700',
    color: '#1E40AF',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
    justifyContent: 'space-between',
  },
  metricCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F0F2F8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginTop: 10,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 6,
    textAlign: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9EDF7',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1B2559',
    paddingVertical: 0,
  },
  loadingBlock: {
    paddingVertical: 28,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  patientCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    padding: 20,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  patientAvatarRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#D0D5E8',
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  patientName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1B2559',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E6A500',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  statCell: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  statCellFull: {
    width: '100%',
  },
  statTextCol: {
    flex: 1,
    minWidth: 0,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A3AED0',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1B2559',
    marginTop: 2,
  },
  activitiesMuted: {
    fontSize: 13,
    fontWeight: '500',
    color: '#A3AED0',
    marginTop: 2,
  },
  recoveryBlock: {
    width: '100%',
  },
  recoveryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#E9EDF7',
    borderRadius: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4318FF',
    borderRadius: 10,
  },
  progressPct: {
    fontSize: 12,
    fontWeight: '700',
    color: '#707EAE',
    minWidth: 36,
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#F54E25',
    borderRadius: 14,
    paddingVertical: 14,
  },
  viewDetailsBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyFilterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    padding: 24,
    marginBottom: 14,
    alignItems: 'center',
  },
  emptyFilterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
  admitCard: {
    minHeight: 120,
    borderWidth: 2,
    borderColor: '#E0E5F2',
    borderStyle: 'dashed',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  admitCardText: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '600',
    color: '#A3AED0',
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
