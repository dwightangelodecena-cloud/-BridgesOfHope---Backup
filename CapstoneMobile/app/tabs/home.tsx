import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
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
import {
  activityDayLabel,
  fetchActivityFeedForCurrentUser,
  type ActivityFeedItem,
} from '../../lib/activityFeed';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Bump when banner copy changes so a new announcement can show again. */
const COMMUNITY_BANNER_ID = 'wellness_talk_2026_04';
const COMMUNITY_BANNER_DISMISSED_KEY = 'home_community_banner_dismissed_id';

function deriveInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  const initials = parts.map((p) => (p[0] ? p[0].toUpperCase() : '')).join('');
  return initials || 'FU';
}

const { width } = Dimensions.get('window');

const statusItems = [
  { title: 'Admission Request', status: 'In Review', color: '#F59E0B' },
  { title: 'Medical Requirements', status: 'Needs Action', color: '#EF4444' },
  { title: 'Weekly Report', status: 'Approved', color: '#10B981' },
];

const notifications = [
  { icon: 'notifications-outline', text: 'Submit missing lab result before Friday.' },
  { icon: 'calendar-outline', text: 'Family session scheduled on April 5, 10:00 AM.' },
  { icon: 'checkmark-circle-outline', text: 'Weekly report was reviewed by your counselor.' },
];

const reminders = [
  'Complete profile details',
  'Upload latest medical test result',
  'Review appointment schedule',
];

/** Matches BRIDGESOFHOPE family home dashboard “NEXT APPOINTMENT” metric card. */
const NEXT_APPOINTMENT = {
  dateTimeLine: 'April 5, 10:00 AM',
  type: 'Family Session',
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [userInitials, setUserInitials] = useState('FU');
  const [displayName, setDisplayName] = useState('Family User');
  const [patients, setPatients] = useState<UIPatient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [showCommunityBanner, setShowCommunityBanner] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const dismissed = await AsyncStorage.getItem(COMMUNITY_BANNER_DISMISSED_KEY);
        if (mounted && dismissed !== COMMUNITY_BANNER_ID) {
          setShowCommunityBanner(true);
        }
      } catch {
        if (mounted) setShowCommunityBanner(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const dismissCommunityBanner = useCallback(async () => {
    setShowCommunityBanner(false);
    try {
      await AsyncStorage.setItem(COMMUNITY_BANNER_DISMISSED_KEY, COMMUNITY_BANNER_ID);
    } catch {
      /* ignore */
    }
  }, []);

  const loadActivityFeed = useCallback(async () => {
    setActivityLoading(true);
    try {
      const items = await fetchActivityFeedForCurrentUser();
      setActivityFeed(items);
    } catch {
      setActivityFeed([]);
    } finally {
      setActivityLoading(false);
    }
  }, []);

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
      const { data: pRows, error } = await supabase
        .from('patients')
        .select(
          'id, full_name, admitted_at, progress_percent, clinical_status, primary_concern, family_id, discharged_at'
        )
        .eq('family_id', user.id)
        .is('discharged_at', null)
        .order('admitted_at', { ascending: false });

      if (error) {
        console.warn('[home patients]', error.message);
        setPatients([]);
        return;
      }
      const list = (pRows || [])
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
      loadActivityFeed();
    }, [loadPatients, loadActivityFeed])
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Modal
        visible={showNotifications}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotifications(false)}
      >
        <View style={styles.notifModalRoot}>
          <Pressable
            style={styles.notifModalBackdrop}
            onPress={() => setShowNotifications(false)}
          />
          <View
            style={[styles.notificationsDropdown, { top: insets.top + 52, right: 16 }]}
          >
            <View style={styles.notificationsDropdownTitleRow}>
              <Ionicons name="notifications" size={16} color="#F54E25" />
              <Text style={styles.notificationsDropdownTitle}>Notifications</Text>
            </View>
            {notifications.map((note) => (
              <View key={note.text} style={styles.notificationsDropdownRow}>
                <Ionicons name="checkmark-circle" size={15} color="#2B31ED" />
                <Text style={styles.notificationsDropdownText}>{note.text}</Text>
              </View>
            ))}
          </View>
        </View>
      </Modal>

      {/* Header — bell + avatar match BRIDGESOFHOPE family home */}
      <View style={styles.header}>
        <View style={styles.headerCenter}>
          <Text style={styles.dashboardBrandTitle}>Dashboard</Text>
          <Text style={styles.dashboardWelcomeLine} numberOfLines={1}>
            Welcome back, {displayName}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerNotifyBtn}
            onPress={() => setShowNotifications((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerAvatar}
            onPress={() => router.navigate(TAB_ROUTES.profile)}
            accessibilityRole="button"
            accessibilityLabel="Profile"
          >
            <Text style={styles.headerAvatarText}>{userInitials}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Actions — same order & emphasis as BRIDGESOFHOPE web dashboard */}
        <View style={styles.quickActionsSection}>
          <View style={styles.quickActionsHeaderRow}>
            <View style={styles.quickActionsTitleBlock}>
              <Text style={styles.quickActionsTitle}>
                <Text style={styles.quickActionsTitleNavy}>Quick </Text>
                <Text style={styles.quickActionsTitleOrange}>Actions</Text>
              </Text>
            </View>
            <Text style={styles.quickActionsCaption} numberOfLines={2}>
              Start with your most-used tools
            </Text>
          </View>
          <View style={styles.quickActionsRow}>
            <QuickActionTile
              icon="reader"
              label="Weekly Report"
              onPress={() => router.navigate(TAB_ROUTES.weeklyReport)}
            />
            <QuickActionTile
              icon="people"
              label="Services"
              onPress={() => router.navigate(TAB_ROUTES.services)}
            />
            <QuickActionTile
              icon="document-text"
              label="Admission"
              onPress={() => router.navigate(TAB_ROUTES.admission)}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Your Dashboard</Text>
        <View style={styles.metricsRow}>
          <DashboardMetric icon="document-text-outline" label="Requests" value="3" />
          <DashboardMetric icon="checkmark-done-circle-outline" label="Completed" value="1" />
          <DashboardMetric icon="warning-outline" label="Pending" value="2" />
        </View>

        <View style={styles.nextAppointmentCard}>
          <Text style={styles.nextAppointmentLabel}>NEXT APPOINTMENT</Text>
          <Text style={styles.nextAppointmentDateTime}>{NEXT_APPOINTMENT.dateTimeLine}</Text>
          <Text style={styles.nextAppointmentType}>{NEXT_APPOINTMENT.type}</Text>
        </View>

        {showCommunityBanner && (
          <View style={styles.communityBanner}>
            <View style={styles.communityBannerTextCol}>
              <Text style={styles.communityBannerTitle}>
                Community Update: Family Wellness Talk
              </Text>
              <Text style={styles.communityBannerBody}>
                Join the monthly support session on April 9 to learn practical family recovery
                support strategies.
              </Text>
            </View>
            <TouchableOpacity
              onPress={dismissCommunityBanner}
              style={styles.communityBannerClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Dismiss community update"
            >
              <Ionicons name="close" size={22} color="#8B3E2F" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.suggestionCard}>
          <Text style={styles.suggestionTitle}>Recommended Next Step</Text>
          <Text style={styles.suggestionText}>
            Update your profile and submit missing requirements to speed up approval.
          </Text>
          <TouchableOpacity style={styles.suggestionButton} onPress={() => router.navigate(TAB_ROUTES.profile)}>
            <Text style={styles.suggestionButtonText}>Update Profile</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.patientSectionTitle}>Patient Details</Text>
        {patientsLoading ? (
          <View style={styles.patientsLoading}>
            <ActivityIndicator color="#F54E25" />
            <Text style={styles.patientsLoadingText}>Loading patients…</Text>
          </View>
        ) : (
          <>
            {patients.map((p) => (
              <View key={p.id} style={styles.patientCard}>
                <View style={styles.patientCardTopRow}>
                  <View style={styles.patientAvatarWrap}>
                    <Ionicons name="person-outline" size={22} color="#A3AED0" />
                  </View>
                  <View style={styles.patientMain}>
                    <View style={styles.patientNameRow}>
                      <Text style={styles.patientName} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <View style={styles.recoveringBadge}>
                        <Text style={styles.recoveringBadgeText}>Recovering</Text>
                      </View>
                    </View>
                    <Text style={styles.patientDateLine}>{p.date || '—'}</Text>
                    <Text style={styles.patientDateLabel}>Date of Admission</Text>
                  </View>
                </View>
                <View style={styles.patientProgressCol}>
                  <View style={styles.patientProgressHeader}>
                    <Text style={styles.patientProgressLabel}>Recovery Progress</Text>
                    <Text style={styles.patientProgressPct}>{p.progress}%</Text>
                  </View>
                  <View style={styles.patientProgressTrack}>
                    <View
                      style={[styles.patientProgressFill, { width: `${p.progress}%` }]}
                    />
                  </View>
                </View>
              </View>
            ))}
            {patients.length === 0 && (
              <View style={styles.patientEmptyCard}>
                <Text style={styles.patientEmptyText}>
                  {isSupabaseConfigured()
                    ? 'No admitted patients linked to your account yet. Submit an admission request to get started.'
                    : 'Add Supabase credentials to load patients from your care team.'}
                </Text>
                <TouchableOpacity
                  style={styles.admitButton}
                  onPress={() => router.navigate(TAB_ROUTES.admission)}
                >
                  <Ionicons name="add-circle-outline" size={24} color="#FFFFFF" />
                  <Text style={styles.admitButtonText}>Admit a Patient</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        <Text style={styles.sectionTitle}>Request Status</Text>
        <View style={styles.cardSection}>
          {statusItems.map(item => (
            <View key={item.title} style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: item.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.statusTitle}>{item.title}</Text>
                <Text style={[styles.statusText, { color: item.color }]}>{item.status}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Notification Center</Text>
        <View style={styles.cardSection}>
          {notifications.map(note => (
            <View key={note.text} style={styles.infoRow}>
              <Ionicons name={note.icon as any} size={18} color="#2B31ED" />
              <Text style={styles.infoRowText}>{note.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.activityPanelCard}>
          <View style={styles.activityPanelHeaderRow}>
            <View style={styles.activityTitleRow}>
              <View style={styles.activityClockIconWrap}>
                <Ionicons name="time" size={15} color="#FFFFFF" />
              </View>
              <Text style={styles.activityPanelTitle}>Recent Activity</Text>
            </View>
            {activityFeed.length > 3 && (
              <TouchableOpacity
                style={styles.activityViewAllBtn}
                onPress={() => setShowAllActivity((v) => !v)}
              >
                <Text style={styles.activityViewAllBtnText}>
                  {showAllActivity ? 'Show Less' : 'View All'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {activityLoading ? (
            <View style={styles.activityLoadingRow}>
              <ActivityIndicator color="#F54E25" size="small" />
              <Text style={styles.activityLoadingText}>Loading activity…</Text>
            </View>
          ) : activityFeed.length === 0 ? (
            <Text style={styles.activityEmptyText}>
              No activity yet. Admission requests, discharge requests, admin decisions, and care team
              reports will appear here as they happen.
            </Text>
          ) : (
            <View style={styles.activityList}>
              {(showAllActivity ? activityFeed : activityFeed.slice(0, 3)).map((item) => (
                <View key={item.id} style={styles.activityRow}>
                  <View style={styles.activityBullet} />
                  <View style={styles.activityTextCol}>
                    <Text style={styles.activityDayLabel}>{activityDayLabel(item.at)}</Text>
                    <Text style={styles.activityMessage}>{item.text}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>Document Vault</Text>
        <View style={styles.cardSection}>
          <View style={styles.infoRow}>
            <Ionicons name="folder-open-outline" size={18} color="#2B31ED" />
            <Text style={styles.infoRowText}>3 documents uploaded</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="alert-circle-outline" size={18} color="#EF4444" />
            <Text style={styles.infoRowText}>1 file needs re-upload due to low quality</Text>
          </View>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.navigate(TAB_ROUTES.admission)}>
            <Text style={styles.secondaryButtonText}>Upload Documents</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Calendar & Reminders</Text>
        <View style={styles.cardSection}>
          {reminders.map(item => (
            <View key={item} style={styles.infoRow}>
              <Ionicons name="time-outline" size={18} color="#2B31ED" />
              <Text style={styles.infoRowText}>{item}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Resources & Support</Text>
        <View style={styles.grid}>
          <ActionButton
            icon="help-circle"
            label="FAQ"
            color="#F54E25"
            onPress={() => router.navigate(TAB_ROUTES.services)}
          />
          <ActionButton
            icon="chatbox-ellipses"
            label="Support"
            color="#F54E25"
            onPress={() => router.navigate(TAB_ROUTES.messages)}
          />
        </View>

        <Text style={styles.sectionTitle}>Feedback</Text>
        <View style={styles.cardSection}>
          <Text style={styles.feedbackTitle}>How was your recent service experience?</Text>
          <View style={styles.feedbackRow}>
            {['😟', '😐', '🙂', '😀', '😍'].map(rate => (
              <TouchableOpacity key={rate} style={styles.feedbackEmoji}>
                <Text style={styles.feedbackEmojiText}>{rate}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Nav */}
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
      style={[styles.tabIcon, { tintColor: active ? "#F54E25" : "#999999" }]}
      resizeMode="contain"
    />
    <Text style={[styles.tabLabel, active && styles.activeTabLabel]}>{label}</Text>
  </TouchableOpacity>
);

const QuickActionTile = ({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) => (
  <TouchableOpacity style={styles.quickActionTile} onPress={onPress} activeOpacity={0.85}>
    <View style={styles.quickActionIconSquare}>
      <Ionicons name={icon} size={22} color="#FFFFFF" />
    </View>
    <Text style={styles.quickActionTileLabel} numberOfLines={2}>
      {label}
    </Text>
  </TouchableOpacity>
);

const ActionButton = ({ icon, label, color, onPress }: any) => (
  <TouchableOpacity style={styles.actionItem} onPress={onPress}>
    <View style={styles.actionIconBox}>
      <Ionicons name={icon} size={30} color={color} />
    </View>
    <Text style={styles.actionLabel}>{label}</Text>
  </TouchableOpacity>
);

const DashboardMetric = ({ icon, label, value }: any) => (
  <View style={styles.metricCard}>
    <Ionicons name={icon} size={20} color="#F54E25" />
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
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
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  dashboardBrandTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F54E25',
  },
  dashboardWelcomeLine: {
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
  headerNotifyBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F54E25',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F54E25',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 4,
  },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F54E25',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F54E25',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
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
  },
  quickActionsSection: {
    marginBottom: 22,
  },
  quickActionsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  quickActionsTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  quickActionsTitle: {
    flexWrap: 'wrap',
  },
  quickActionsTitleNavy: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1B2559',
  },
  quickActionsTitleOrange: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F54E25',
  },
  quickActionsCaption: {
    maxWidth: width * 0.38,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'right',
    lineHeight: 16,
    paddingTop: 4,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  quickActionTile: {
    flex: 1,
    minWidth: 0,
    minHeight: 100,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  quickActionIconSquare: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F54E25',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionTileLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1B2559',
    textAlign: 'center',
    lineHeight: 13,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    marginLeft: 5,
    marginTop: 4
  },
  patientSectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1B2559',
    marginBottom: 16,
    marginLeft: 5,
    marginTop: 8
  },
  patientsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 24,
    marginBottom: 16
  },
  patientsLoadingText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600'
  },
  patientCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 12,
    elevation: 2
  },
  patientCardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  patientAvatarWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F4F7FE',
    borderWidth: 1,
    borderColor: '#A3AED0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    overflow: 'hidden'
  },
  patientMain: {
    flex: 1,
    minWidth: 0
  },
  patientNameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5
  },
  patientName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1B2559',
    flexShrink: 1
  },
  recoveringBadge: {
    backgroundColor: '#FFF9C4',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20
  },
  recoveringBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#856404'
  },
  patientDateLine: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1B2559'
  },
  patientDateLabel: {
    fontSize: 11,
    color: '#A3AED0',
    marginTop: 2,
    fontWeight: '500'
  },
  patientProgressCol: {
    width: '100%',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  patientProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  patientProgressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A3AED0'
  },
  patientProgressPct: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1B2559'
  },
  patientProgressTrack: {
    height: 8,
    backgroundColor: '#F4F7FE',
    borderRadius: 10,
    overflow: 'hidden'
  },
  patientProgressFill: {
    height: '100%',
    backgroundColor: '#4318FF',
    borderRadius: 10
  },
  patientEmptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E9EDF7'
  },
  patientEmptyText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 14
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 14,
    marginHorizontal: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 6,
    color: '#111827'
  },
  metricLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2
  },
  nextAppointmentCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9EDF7',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 12,
    elevation: 2
  },
  nextAppointmentLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700'
  },
  nextAppointmentDateTime: {
    color: '#1B2559',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 10
  },
  nextAppointmentType: {
    color: '#F54E25',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5
  },
  communityBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#FFF5EB',
    borderWidth: 1,
    borderColor: '#FADCC8',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  communityBannerTextCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  communityBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#8B3E2F',
    marginBottom: 6,
    lineHeight: 20,
  },
  communityBannerBody: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8B3E2F',
    lineHeight: 19,
    opacity: 0.95,
  },
  communityBannerClose: {
    padding: 4,
    marginTop: -2,
  },
  suggestionCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FED7AA'
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9A3412'
  },
  suggestionText: {
    fontSize: 12,
    color: '#7C2D12',
    marginTop: 6
  },
  suggestionButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#F54E25',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  suggestionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  actionItem: {
    width: (width - 60) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5
  },
  actionIconBox: {
    marginBottom: 10
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333'
  },
  cardSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10
  },
  statusTitle: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600'
  },
  statusText: {
    fontSize: 12,
    marginTop: 2
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  infoRowText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 12,
    color: '#374151'
  },
  activityPanelCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9EDF7',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    marginHorizontal: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2
  },
  activityPanelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4
  },
  activityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1
  },
  activityClockIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F54E25',
    alignItems: 'center',
    justifyContent: 'center'
  },
  activityPanelTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1B2559'
  },
  activityViewAllBtn: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexShrink: 0
  },
  activityViewAllBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3730A3'
  },
  activityLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12
  },
  activityLoadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600'
  },
  activityEmptyText: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 20,
    paddingTop: 8,
    paddingBottom: 4
  },
  activityList: {
    marginTop: 10
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12
  },
  activityBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F54E25',
    marginTop: 6,
    flexShrink: 0
  },
  activityTextCol: {
    flex: 1,
    minWidth: 0
  },
  activityDayLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2
  },
  activityMessage: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19
  },
  secondaryButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#F54E25',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  secondaryButtonText: {
    color: '#F54E25',
    fontSize: 12,
    fontWeight: '600'
  },
  feedbackTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827'
  },
  feedbackRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10
  },
  feedbackEmoji: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center'
  },
  feedbackEmojiText: {
    fontSize: 20
  },
  admitButton: {
    backgroundColor: '#F54E25',
    flexDirection: 'row',
    height: 55,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F54E25',
    shadowOffset: {
      width: 0,
      height: 4
    },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6
  },
  admitButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 10
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
    right: 0
  },
  tabItem: {
    alignItems: 'center',
    flex: 1
  },
  tabIcon: {
    width: 24,
    height: 24,
    marginBottom: 4
  },
  tabLabel: {
    fontSize: 12,
    color: '#999999'
  },
  activeTabLabel: {
    color: '#F54E25',
    fontWeight: '600'
  },
  bottomNavDark: {
    backgroundColor: '#020617',
    borderColor: '#1F2937'
  }
});