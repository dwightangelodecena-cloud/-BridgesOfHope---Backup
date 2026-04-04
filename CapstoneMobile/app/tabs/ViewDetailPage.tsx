import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { TAB_ROUTES } from '../../lib/navigationConfig';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { uiPatientFromRow, type PatientRow, type UIPatient } from '../../lib/patientMappers';

const { width } = Dimensions.get('window');

const NOTIFICATION_ITEMS = [
  'Submit missing laboratory result before Friday.',
  'Family support session is scheduled on April 5, 10:00 AM.',
  'Weekly report reviewed by your assigned counselor.',
];

const WEEK_NUMBERS = [1, 2, 3, 4, 5, 6, 7] as const;

/** Two columns per row — matches web / reference layout (week 7 + empty cell). */
const WEEK_GRID_ROWS: readonly (readonly number[])[] = [[1, 2], [3, 4], [5, 6], [7]];

export type NurseWeekRecord = {
  submittedAt: string;
  nurseName: string;
  reportDate: string;
};

type ReportsByPatient = Record<string, Record<string, NurseWeekRecord>>;

function deriveUserInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => (p[0] ? p[0].toUpperCase() : '')).join('') || 'FU';
}

function patientInitials(name: string): string {
  const parts = String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  const s = parts.map((p) => (p[0] ? p[0].toUpperCase() : '')).join('');
  return s || 'P';
}

function formatNurseReportDate(iso: string | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function statusChipLabel(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'improving') return 'Recovering';
  if (s === 'stable') return 'Stable';
  if (s === 'declining') return 'In Treatment';
  if (!s) return 'Recovering';
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ViewDetailsPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [displayName, setDisplayName] = useState('Family User');
  const [userInitials, setUserInitials] = useState('FU');
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<UIPatient[]>([]);
  const [reportsByPatient, setReportsByPatient] = useState<ReportsByPatient>({});
  const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setPatients([]);
      setReportsByPatient({});
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        setPatients([]);
        setReportsByPatient({});
        return;
      }

      const { data: pRows, error: pErr } = await supabase
        .from('patients')
        .select(
          'id, full_name, admitted_at, progress_percent, clinical_status, primary_concern, family_id, discharged_at'
        )
        .eq('family_id', user.id)
        .is('discharged_at', null)
        .order('admitted_at', { ascending: false });

      if (pErr) {
        console.warn('[weekly reports patients]', pErr.message);
        setPatients([]);
        setReportsByPatient({});
        return;
      }

      const list = (pRows || [])
        .map((r) => uiPatientFromRow(r as unknown as PatientRow))
        .filter((x): x is UIPatient => x != null);
      setPatients(list);

      const ids = (pRows || []).map((r) => r.id).filter(Boolean);
      let byPatient: ReportsByPatient = {};
      if (ids.length) {
        const { data: wRows, error: wErr } = await supabase
          .from('weekly_reports')
          .select('*')
          .in('patient_id', ids);
        if (!wErr && wRows) {
          for (const row of wRows) {
            const pid = String(row.patient_id);
            if (!byPatient[pid]) byPatient[pid] = {};
            byPatient[pid][String(row.week_number)] = {
              submittedAt: row.submitted_at,
              nurseName: row.nurse_name || '',
              reportDate: row.report_date || '',
            };
          }
        }
      }
      setReportsByPatient(byPatient);
    } catch {
      setPatients([]);
      setReportsByPatient({});
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
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
          setUserInitials(deriveUserInitials(resolved));
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

  const closeAndGoHome = () => {
    setExpandedPatientId(null);
    router.navigate(TAB_ROUTES.home);
  };

  const togglePatient = (id: string) => {
    setExpandedPatientId((prev) => (prev === id ? null : id));
  };

  const onWeekOpenPress = (hasRecord: boolean, rec: NurseWeekRecord | undefined, weekNum: number) => {
    if (!hasRecord || !rec) {
      Alert.alert('Week ' + weekNum, 'No reports submitted yet.');
      return;
    }
    const lines = [
      `Received ${formatNurseReportDate(rec.submittedAt)}`,
      rec.nurseName ? `Nurse: ${rec.nurseName}` : '',
      rec.reportDate ? `Report date: ${rec.reportDate}` : '',
    ].filter(Boolean);
    Alert.alert(`Week ${weekNum} report`, lines.join('\n'));
  };

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
          <Text style={styles.headerBrandTitle}>Weekly Reports</Text>
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
        style={styles.bodyScroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.careSection}>
          <Text style={styles.careUpdatesTitle}>
            Care <Text style={styles.careUpdatesOrange}>Updates</Text>
          </Text>
          <Text style={styles.careUpdatesSubtitle}>
            {"Here's an overview of weekly care reports for your patients"}
          </Text>
          {patients.length > 0 ? (
            <View style={styles.patientCountPill}>
              <Ionicons name="document-text-outline" size={15} color="#F54E25" />
              <Text style={styles.patientCountPillText}>
                {patients.length} patient{patients.length !== 1 ? 's' : ''}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.sectionDivider} />

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#F54E25" />
          </View>
        ) : patients.length === 0 ? (
          <Text style={styles.emptyBody}>
            No admitted patients yet. When an admission is approved, patients will show here.
          </Text>
        ) : (
          patients.map((p) => {
            const reportsForPatient = reportsByPatient[String(p.id)] || {};
            const submittedWeekCount = WEEK_NUMBERS.filter((n) => reportsForPatient[String(n)]).length;
            const expanded = expandedPatientId === p.id;

            return (
              <View key={p.id} style={styles.patientBlock}>
                <TouchableOpacity
                  style={styles.patientRow}
                  onPress={() => togglePatient(p.id)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                >
                  <View style={styles.patientAvatar}>
                    <Text style={styles.patientAvatarText}>{patientInitials(p.name)}</Text>
                  </View>
                  <View style={styles.patientMain}>
                    <View style={styles.nameRow}>
                      <Text style={styles.patientName} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <View style={styles.statusChip}>
                        <Text style={styles.statusChipText}>{statusChipLabel(p.status)}</Text>
                      </View>
                    </View>
                    <Text style={styles.patientMeta} numberOfLines={2}>
                      Admitted {p.date || '—'}
                      {p.progress != null ? ` · ${p.progress}% progress` : ''}
                      <Text style={styles.patientMetaMuted}> · {submittedWeekCount}/7 reports</Text>
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-down"
                    size={20}
                    color={expanded ? '#F54E25' : '#FDBA9A'}
                    style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
                  />
                </TouchableOpacity>

                {expanded ? (
                  <View style={styles.weeksPanel}>
                    <View style={styles.weeksHint}>
                      <View style={styles.weeksHintLabelWrap}>
                        <View style={styles.weeksHintBar} />
                        <Text style={styles.weeksHintLabel}>Weekly timeline</Text>
                      </View>
                      <View style={styles.summaryPill}>
                        <Text style={styles.summaryPillText}>{submittedWeekCount} of 7 received</Text>
                      </View>
                    </View>

                    <View style={styles.weekGrid}>
                      {WEEK_GRID_ROWS.map((row, rowIdx) => (
                        <View key={rowIdx} style={styles.weekGridRow}>
                          {row.map((w) => {
                            const rec = reportsForPatient[String(w)];
                            const has = Boolean(rec);
                            return (
                              <View key={w} style={styles.weekGridCell}>
                                <View
                                  style={[
                                    styles.weekCard,
                                    has ? styles.weekCardDone : styles.weekCardEmpty,
                                  ]}
                                >
                                  <View style={styles.weekCardRow}>
                                    <View style={styles.weekCardLeft}>
                                      <Text style={styles.weekNum}>Week {w}</Text>
                                      {has && rec ? (
                                        <View style={styles.weekBodyLeft}>
                                          <View style={styles.weekReceivedRow}>
                                            <Ionicons name="checkmark-circle" size={14} color="#EA580C" />
                                            <Text style={styles.weekDetailText}>
                                              Received {formatNurseReportDate(rec.submittedAt)}
                                            </Text>
                                          </View>
                                          {rec.nurseName ? (
                                            <Text style={styles.weekDetailSub}>Nurse: {rec.nurseName}</Text>
                                          ) : null}
                                          {rec.reportDate ? (
                                            <Text style={styles.weekDetailSub}>Report date: {rec.reportDate}</Text>
                                          ) : null}
                                        </View>
                                      ) : (
                                        <Text style={styles.weekEmptyMsg}>No reports submitted yet.</Text>
                                      )}
                                    </View>
                                    <TouchableOpacity
                                      style={styles.weekOpenPill}
                                      onPress={() => onWeekOpenPress(has, rec, w)}
                                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                                      activeOpacity={0.85}
                                    >
                                      <Text style={styles.weekOpenPillText}>Open</Text>
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              </View>
                            );
                          })}
                          {row.length === 1 ? <View style={styles.weekGridCell} /> : null}
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })
        )}

        {!loading && patients.length > 0 ? (
          <TouchableOpacity style={styles.closeReportBtn} onPress={closeAndGoHome} activeOpacity={0.9}>
            <Text style={styles.closeReportBtnText}>Close Report</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 10 }]}>
        <TabItem
          img={require('../../assets/images/home-icon.png')}
          label="Home"
          active
          onPress={() => router.navigate(TAB_ROUTES.home)}
        />
        <TabItem
          img={require('../../assets/images/progress-icon.png')}
          label="Progress"
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
  bodyScroll: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    overflow: 'visible',
  },
  careSection: {
    width: '100%',
    paddingBottom: 4,
  },
  careUpdatesTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1B2559',
  },
  careUpdatesOrange: {
    color: '#F54E25',
  },
  careUpdatesSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#A3AED0',
    marginTop: 6,
    marginBottom: 14,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginTop: 12,
    marginBottom: 16,
  },
  patientCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFCFA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFD4C4',
    shadowColor: '#F54E25',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  patientCountPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyBody: {
    textAlign: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
  },
  patientBlock: {
    borderWidth: 1,
    borderColor: '#EAECEF',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  patientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FFF5F0',
    borderWidth: 1,
    borderColor: '#FFEEE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#C2410C',
  },
  patientMain: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  patientName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  statusChip: {
    backgroundColor: '#FFF7F3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFDFD3',
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9A3412',
  },
  patientMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
    fontWeight: '500',
  },
  patientMetaMuted: {
    color: '#94A3B8',
    fontWeight: '500',
  },
  weeksPanel: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: '#FAFBFC',
    borderTopWidth: 1,
    borderTopColor: '#F0E8E4',
  },
  weeksHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
    marginHorizontal: 2,
  },
  weeksHintLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  weeksHintBar: {
    width: 3,
    height: 14,
    backgroundColor: '#F54E25',
    borderRadius: 2,
  },
  weeksHintLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  summaryPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FFD4C4',
  },
  summaryPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9A3412',
  },
  weekGrid: {
    flexDirection: 'column',
    gap: 10,
  },
  weekGridRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  weekGridCell: {
    flex: 1,
    minWidth: 0,
  },
  weekCard: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    width: '100%',
  },
  weekCardEmpty: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  weekCardDone: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  weekCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  weekCardLeft: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  weekNum: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  weekBodyLeft: {
    gap: 2,
  },
  weekReceivedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weekOpenPill: {
    backgroundColor: '#EEF2F6',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 100,
    flexShrink: 0,
  },
  weekOpenPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  weekEmptyMsg: {
    fontSize: 12,
    fontWeight: '400',
    color: '#64748B',
    lineHeight: 17,
  },
  weekDetailText: {
    flex: 1,
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
    fontWeight: '500',
  },
  weekDetailSub: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
    marginTop: 4,
  },
  closeReportBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F54E25',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 16,
  },
  closeReportBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#C2410C',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderColor: '#F0F0F0',
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
