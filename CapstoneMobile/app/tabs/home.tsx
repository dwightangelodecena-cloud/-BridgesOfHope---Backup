import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ImageBackground,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Modal,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
import { TAB_ROUTES } from '../../lib/navigationConfig';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { FAMILY_ACTIVE_ADMISSION_STATUSES } from '../../lib/admissionWorkflow';
import { uiPatientFromRow, type PatientRow, type UIPatient } from '../../lib/patientMappers';
import {
  uiAdmissionRequestFromRow,
  uiDischargeRequestFromRow,
} from '../../lib/dbMappers';
import { fetchActivityFeedForCurrentUser, activityDayLabel, type ActivityFeedItem } from '../../lib/activityFeed';
import { FamilyWebMobileNav } from '../../components/family/FamilyWebMobileNav';
import { FamilyFloatingChat } from '../../components/family/FamilyFloatingChat';
import { useSupportChatMobile } from '../../lib/useSupportChatMobile';
import { KalingaLogoMark } from '../../components/family/KalingaLogoMark';
import { LinearGradient } from 'expo-linear-gradient';
import { FamilyMobilePageHeader } from '../../components/family/FamilyMobilePageHeader';
import { useFamilyPageScroll } from '../../lib/useFamilyPageScroll';
import { useFamilyUserMobile } from '../../lib/useFamilyUserMobile';
import { getFamilyFirstName, getFamilyTimeGreeting } from '../../lib/familyGreeting';
import {
  listVisitationRequestsByFamily,
  mergeRequestsFromSupabase,
  normalizeVisitationStatus,
  type VisitationRequestRow,
} from '../../lib/visitationAppointmentsMobile';
import { BH, SHADOW } from '../../theme/tokens';

const { width } = Dimensions.get('window');
const isCompactScreen = width <= 380;
const BG = BH.surface2;

function deriveInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => (p[0] ? p[0].toUpperCase() : '')).join('') || 'FU';
}

type PendingAdmission = NonNullable<ReturnType<typeof uiAdmissionRequestFromRow>>;
type PendingDischarge = NonNullable<ReturnType<typeof uiDischargeRequestFromRow>>;

type NurseWeekRecord = {
  submittedAt?: string | null;
  nurseName: string;
  reportDate: string;
  summary: string;
  progressPercent?: number | null;
  nurseNote: string;
  behaviorObservation: string;
  recommendations: string;
  currentMedications: string;
  medicationIntervention: string;
};

type WeeklyReportDetailState = NurseWeekRecord & {
  patientId: string;
  patientName: string;
  week: string;
};

type RequestTableRow = {
  key: string;
  type: 'Admission' | 'Discharge' | 'Appointment';
  name: string;
  status: string;
  date: string;
};

const HIDDEN_REQUEST_KEYS_PREFIX = 'bh_mobile_hidden_request_keys_v1:';

function formatNurseReportDate(iso: string | null | undefined): string {
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

function patientStatus(progress: number) {
  const p = Number(progress) || 0;
  if (p >= 70) return { label: 'Stable', color: '#166534', bg: '#DCFCE7' };
  if (p >= 40) return { label: 'Recovering', color: '#92400E', bg: '#FEF3C7' };
  return { label: 'Needs Attention', color: '#991B1B', bg: '#FEE2E2' };
}

/** Picks an icon/color for an activity feed row from keywords in its text — the
 * feed itself only stores free-text descriptions, not a structured type. */
function activityVisual(text: string): { icon: React.ComponentProps<typeof Ionicons>['name']; color: string; bg: string } {
  const t = text.toLowerCase();
  if (t.includes('report')) return { icon: 'document-text', color: BH.brand700, bg: BH.brandSurface };
  if (t.includes('vital')) return { icon: 'pulse', color: '#16A34A', bg: '#DCFCE7' };
  if (t.includes('medicat')) return { icon: 'medical', color: '#D97706', bg: '#FEF3C7' };
  if (t.includes('meal') || t.includes('breakfast') || t.includes('lunch') || t.includes('dinner'))
    return { icon: 'restaurant', color: '#7C3AED', bg: '#EDE9FE' };
  if (t.includes('admission')) return { icon: 'clipboard', color: '#2563EB', bg: '#DBEAFE' };
  if (t.includes('discharge')) return { icon: 'exit', color: '#DC2626', bg: '#FEE2E2' };
  if (t.includes('appointment') || t.includes('visit')) return { icon: 'calendar', color: '#0369A1', bg: '#E0F2FE' };
  if (t.includes('login') || t.includes('logged in')) return { icon: 'log-in', color: '#475569', bg: '#F1F5F9' };
  if (t.includes('message') || t.includes('chat')) return { icon: 'chatbubble-ellipses', color: '#7C3AED', bg: '#EDE9FE' };
  return { icon: 'notifications', color: BH.brand700, bg: BH.brandSurface };
}

function ReportFieldCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return (
    <View style={styles.reportFieldCard}>
      <View style={styles.reportFieldCardHead}>
        <Ionicons name={icon} size={13} color="#F54E25" />
        <Text style={styles.reportFieldCardLbl}>{label}</Text>
      </View>
      <Text style={styles.reportFieldCardVal}>{value || '—'}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { scrollRef, scrollToTop } = useFamilyPageScroll();
  const router = useRouter();
  const { displayName } = useFamilyUserMobile();
  const { unreadCount: supportUnreadCount } = useSupportChatMobile();
  const [patients, setPatients] = useState<UIPatient[]>([]);
  const [pendingAdmissions, setPendingAdmissions] = useState<PendingAdmission[]>([]);
  const [pendingDischarges, setPendingDischarges] = useState<PendingDischarge[]>([]);
  const [nurseWeeklyByPatient, setNurseWeeklyByPatient] = useState<Record<string, Record<string, NurseWeekRecord>>>({});
  const [familyVisitationRequests, setFamilyVisitationRequests] = useState<VisitationRequestRow[]>([]);
  const [hiddenRequestKeys, setHiddenRequestKeys] = useState<string[]>([]);
  const [familyUserId, setFamilyUserId] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [weeklyReportExpandedPatientId, setWeeklyReportExpandedPatientId] = useState<string | null>(null);
  const [weeklyReportDetail, setWeeklyReportDetail] = useState<WeeklyReportDetailState | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [supabaseReadError, setSupabaseReadError] = useState<string | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityFeedItem[]>([]);

  const firstName = getFamilyFirstName(displayName);

  const loadDashboard = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setPatients([]);
      setPendingAdmissions([]);
      setPendingDischarges([]);
      setNurseWeeklyByPatient({});
      setFamilyVisitationRequests([]);
      setRecentActivity([]);
      setDashboardLoading(false);
      return;
    }
    setDashboardLoading(true);
    setSupabaseReadError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        setPatients([]);
        setPendingAdmissions([]);
        setPendingDischarges([]);
        setNurseWeeklyByPatient({});
        setFamilyVisitationRequests([]);
        setRecentActivity([]);
        setFamilyUserId('');
        return;
      }
      setFamilyUserId(user.id);

      try {
        const raw = await AsyncStorage.getItem(`${HIDDEN_REQUEST_KEYS_PREFIX}${user.id}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setHiddenRequestKeys(parsed.map(String));
        }
      } catch {
        /* keep existing */
      }

      const { data: pRows, error: pErr } = await supabase
        .from('patients')
        .select(
          'id, full_name, admitted_at, progress_percent, clinical_status, primary_concern, family_id, discharged_at'
        )
        .eq('family_id', user.id)
        .order('admitted_at', { ascending: false });

      if (pErr) {
        console.warn('[home patients]', pErr.message);
        setPatients([]);
      } else {
        setPatients(
          (pRows || [])
            .map((r) => uiPatientFromRow(r as unknown as PatientRow))
            .filter((x): x is UIPatient => x != null)
        );
      }

      const localVisit = await listVisitationRequestsByFamily(user.id);
      const mergedVisit = await mergeRequestsFromSupabase(user.id, localVisit);
      setFamilyVisitationRequests(mergedVisit);

      const [{ data: aRows, error: aErr }, { data: dRows, error: dErr }] = await Promise.all([
        supabase.from('admission_requests').select('*').eq('family_id', user.id).in('status', [...FAMILY_ACTIVE_ADMISSION_STATUSES]),
        supabase
          .from('discharge_requests')
          .select('*, patients(full_name)')
          .eq('family_id', user.id)
          .eq('status', 'pending'),
      ]);

      if (aErr) {
        console.warn('[home admission_requests]', aErr.message);
        setSupabaseReadError(aErr.message);
      }
      if (dErr) {
        console.warn('[home discharge_requests]', dErr.message);
        setSupabaseReadError((prev) => prev || dErr.message);
      }
      setPendingAdmissions(
        (aRows || []).map((r) => uiAdmissionRequestFromRow(r as Record<string, unknown>)).filter(Boolean) as PendingAdmission[]
      );
      setPendingDischarges(
        (dRows || []).map((r) => uiDischargeRequestFromRow(r as Record<string, unknown>)).filter(Boolean) as PendingDischarge[]
      );

      const ids = (pRows || []).map((r) => r.id).filter(Boolean);
      let byPatient: Record<string, Record<string, NurseWeekRecord>> = {};
      if (ids.length) {
        const { data: wRows, error: wErr } = await supabase.from('weekly_reports').select('*').in('patient_id', ids);
        if (!wErr && wRows) {
          for (const row of wRows) {
            const rec = row as Record<string, unknown>;
            const pid = String(rec.patient_id);
            if (!byPatient[pid]) byPatient[pid] = {};
            byPatient[pid][String(rec.week_number)] = {
              submittedAt: (rec.submitted_at as string) ?? null,
              nurseName: String(rec.nurse_name || ''),
              reportDate: String(rec.report_date || ''),
              summary: String(rec.summary || rec.report_summary || ''),
              progressPercent:
                rec.progress_percent !== undefined && rec.progress_percent !== null
                  ? Number(rec.progress_percent)
                  : null,
              nurseNote: String(rec.nurse_note || rec.notes || ''),
              behaviorObservation: String(rec.behavior_observation || ''),
              recommendations: String(rec.recommendations || rec.plan_next_week || ''),
              currentMedications: String(rec.current_medications || ''),
              medicationIntervention: String(rec.medication_intervention || ''),
            };
          }
        }
      }
      setNurseWeeklyByPatient(byPatient);
      const activity = await fetchActivityFeedForCurrentUser();
      setRecentActivity(activity);
    } catch {
      setPatients([]);
      setPendingAdmissions([]);
      setPendingDischarges([]);
      setNurseWeeklyByPatient({});
      setFamilyVisitationRequests([]);
      setRecentActivity([]);
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  const reportsReceivedCount = Object.values(nurseWeeklyByPatient || {}).reduce(
    (count, patientWeeks) => count + Object.keys(patientWeeks || {}).length,
    0
  );
  const pendingAppointmentRequests = familyVisitationRequests.filter(
    (row) => normalizeVisitationStatus(row?.status) === 'Requested'
  );
  const totalPendingRequests =
    pendingAdmissions.length + pendingDischarges.length + pendingAppointmentRequests.length;
  const averageProgress = patients.length
    ? Math.round(patients.reduce((sum, p) => sum + (Number(p.progress) || 0), 0) / patients.length)
    : 0;

  const resolveRequestPatientName = (row: PendingAdmission | PendingDischarge | VisitationRequestRow) => {
    const asRecord = row as Record<string, unknown>;
    const directName =
      (row as VisitationRequestRow).patientName ||
      row.patientName ||
      String(asRecord.patient_name || '') ||
      (row as { patient?: string }).patient ||
      '';
    if (directName && String(directName).trim() && String(directName).trim().toLowerCase() !== 'patient') {
      return String(directName).trim();
    }
    const pid = (row as PendingDischarge).patientId ?? (row as VisitationRequestRow).patientId;
    if (pid) {
      const match = patients.find((p) => String(p.id) === String(pid));
      if (match?.name) return match.name;
    }
    return 'Unknown';
  };

  const dismissRequestRow = (key: string) => {
    setHiddenRequestKeys((prev) => {
      const next = [...prev, String(key)];
      if (familyUserId) {
        void AsyncStorage.setItem(`${HIDDEN_REQUEST_KEYS_PREFIX}${familyUserId}`, JSON.stringify(next));
      }
      return next;
    });
  };

  const openWeeklyReportsModal = () => {
    setWeeklyReportExpandedPatientId(null);
    setWeeklyReportDetail(null);
    setShowReportModal(true);
  };

  const requestTableRows: RequestTableRow[] = [
    ...pendingAdmissions.map((row, idx) => ({
      key: `admission-${row?.requestId || row?.id || idx}`,
      type: 'Admission' as const,
      name: resolveRequestPatientName(row),
      status: row?.status || 'Pending',
      date: String(row?.createdAt || row?.created_at || ''),
    })),
    ...pendingDischarges.map((row, idx) => ({
      key: `discharge-${row?.dischargeRequestId || (row as { requestId?: string }).requestId || row?.id || idx}`,
      type: 'Discharge' as const,
      name: resolveRequestPatientName(row),
      status: row?.status || 'Pending',
      date: String(row?.requestTime || row?.created_at || ''),
    })),
    ...familyVisitationRequests.map((row, idx) => ({
      key: `appointment-${row?.id || idx}`,
      type: 'Appointment' as const,
      name: resolveRequestPatientName(row),
      status: normalizeVisitationStatus(row?.status),
      date: String(row?.createdAt || row?.preferredDate || ''),
    })),
  ].filter((row) => !hiddenRequestKeys.includes(String(row.key)));

  const patientReportCount = (patientId: string) =>
    Object.keys(nurseWeeklyByPatient[String(patientId)] || {}).length;

  const patientTableRows = patients;

  const greeting = getFamilyTimeGreeting();

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <FamilyMobilePageHeader onBrandPress={scrollToTop} />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <ImageBackground
          source={require('../../assets/images/home-header.jpg')}
          style={styles.heroBanner}
          imageStyle={styles.heroBannerImage}
        >
          <View style={styles.heroInner}>
            <Text style={styles.heroTitle}>
              {greeting}, {firstName}! <Text style={styles.heroWave}>👋</Text>
            </Text>
            <Text style={styles.heroSub}>Here&apos;s an overview of your loved one&apos;s care today.</Text>
          </View>
        </ImageBackground>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeadRow}>
            <Text style={styles.summaryTitle}>Today&apos;s Summary</Text>
            <TouchableOpacity onPress={() => router.navigate(TAB_ROUTES.patientDetails)} hitSlop={8}>
              <Text style={styles.summaryViewAll}>View all</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.summaryStatsRow}>
            <View style={styles.summaryStatCol}>
              <Text style={styles.summaryStatLabel}>Active Residents</Text>
              <View style={styles.summaryStatValueRow}>
                <Text style={styles.summaryStatValue}>{patients.length}</Text>
                <View style={styles.summaryStatIconWrap}>
                  <Ionicons name="people" size={14} color={BH.indigo} />
                </View>
              </View>
              <Text style={styles.summaryStatSub}>Currently under care</Text>
            </View>
            <View style={styles.summaryDividerV} />
            <View style={styles.summaryStatCol}>
              <Text style={styles.summaryStatLabel}>Average Progress</Text>
              <View style={styles.summaryStatValueRow}>
                <Text style={styles.summaryStatValue}>{averageProgress}%</Text>
                <Ionicons name="trending-up" size={16} color="#16A34A" />
              </View>
              <Text style={styles.summaryStatSub}>{averageProgress >= 70 ? 'Strong trend' : 'Steady recovery'}</Text>
            </View>
          </View>

          <View style={styles.summaryDividerH} />

          <View style={styles.summaryProgressRow}>
            <Text style={styles.summaryProgressLabel}>Overall Progress</Text>
            <Text style={styles.summaryProgressPct}>{averageProgress}%</Text>
          </View>
          <View style={styles.summaryProgressTrack}>
            <View style={[styles.summaryProgressFill, { width: `${averageProgress}%` }]} />
          </View>
        </View>

        <View style={styles.panelCard}>
          <View style={styles.quickActionsHeaderRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="sparkles" size={16} color="#F54E25" />
                <Text style={styles.sectionTitleText}>Quick Actions</Text>
              </View>
              <Text style={styles.sectionSub}>Your most-used tools — one tap away</Text>
            </View>
          </View>
          <View style={styles.quickActionsRow}>
            {[
              {
                key: 'reports',
                icon: 'document-text' as const,
                label: 'Weekly Report',
                color: BH.brand,
                onPress: openWeeklyReportsModal,
                badge: reportsReceivedCount,
              },
              {
                key: 'admission',
                icon: 'clipboard' as const,
                label: 'Admission',
                color: '#2563EB',
                onPress: () => router.navigate(TAB_ROUTES.admission),
                badge: pendingAdmissions.length,
              },
              {
                key: 'services',
                icon: 'briefcase' as const,
                label: 'Services',
                color: '#16A34A',
                onPress: () => router.navigate(TAB_ROUTES.services),
                badge: 0,
              },
              {
                key: 'messages',
                icon: 'chatbubble-ellipses' as const,
                label: 'Messages',
                color: '#7C3AED',
                onPress: () => router.navigate(TAB_ROUTES.messages),
                badge: supportUnreadCount,
              },
            ].map((item) => (
              <TouchableOpacity
                key={item.key}
                style={styles.quickActionItem}
                onPress={item.onPress}
                activeOpacity={0.85}
              >
                <View style={[styles.quickActionCircle, { backgroundColor: item.color }]}>
                  <Ionicons name={item.icon} size={24} color="#FFFFFF" />
                  {item.badge > 0 ? (
                    <View style={styles.quickActionBadge}>
                      <Text style={styles.quickActionBadgeText}>{item.badge > 9 ? '9+' : item.badge}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.quickActionLabel} numberOfLines={1}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.supportCard}>
          <View style={styles.supportHeartWatermark}>
            <Ionicons name="heart" size={96} color="rgba(245, 78, 37, 0.12)" />
          </View>
          <View style={styles.supportTitleRow}>
            <Text style={styles.supportTitle}>You&apos;re not alone.</Text>
            <Ionicons name="heart" size={16} color={BH.brand} />
          </View>
          <Text style={styles.supportSub}>We&apos;re here to support you every step of the way.</Text>
          <TouchableOpacity
            style={styles.supportBtn}
            onPress={() => router.navigate(TAB_ROUTES.messages)}
            activeOpacity={0.9}
          >
            <Text style={styles.supportBtnText}>Contact Us</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.panelCard, { marginTop: 14 }]}>
          <View style={styles.chartTop}>
            <Text style={styles.chartTitle}>Recent Updates</Text>
          </View>
          {dashboardLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#F54E25" />
              <Text style={styles.loadingText}>Loading dashboard…</Text>
            </View>
          ) : recentActivity.length === 0 ? (
            <Text style={styles.emptyMuted}>No recent activity yet.</Text>
          ) : (
            recentActivity.slice(0, 6).map((item, idx) => {
              const visual = activityVisual(item.text);
              const dayLabel = activityDayLabel(item.at);
              const timeLabel = (() => {
                const d = new Date(item.at);
                return Number.isNaN(d.getTime())
                  ? ''
                  : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
              })();
              return (
                <View key={item.id} style={styles.updateRow}>
                  <View style={[styles.updateIconWrap, { backgroundColor: visual.bg }]}>
                    <Ionicons name={visual.icon} size={18} color={visual.color} />
                  </View>
                  <View style={styles.updateMain}>
                    <Text style={styles.updateText} numberOfLines={2}>
                      {item.text}
                    </Text>
                    <Text style={styles.updateMeta}>
                      {dayLabel}
                      {timeLabel ? `, ${timeLabel}` : ''}
                    </Text>
                  </View>
                  {idx === 0 && dayLabel === 'Today' ? (
                    <View style={styles.updateNewBadge}>
                      <Text style={styles.updateNewBadgeText}>New</Text>
                    </View>
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={BH.textFaint} />
                  )}
                </View>
              );
            })
          )}
          {supabaseReadError ? (
            <Text style={styles.errorInline} numberOfLines={3}>
              {supabaseReadError}
            </Text>
          ) : null}
        </View>

        <View style={[styles.panelCard, { marginTop: 14 }]}>
          <View style={styles.tableHead}>
            <View style={styles.tableHeadLeft}>
              <Ionicons name="person" size={16} color="#F54E25" />
              <Text style={styles.panelTitleInline}>Resident Snapshot</Text>
            </View>
            <Text style={styles.tableMeta}>{patients.length} total</Text>
          </View>
          {patientTableRows.length === 0 ? (
            <Text style={styles.emptyMuted}>No patient records yet.</Text>
          ) : (
            patientTableRows.map((p) => {
              const st = patientStatus(p.progress);
              return (
                <TouchableOpacity
                  key={p.id}
                  style={styles.tableRow}
                  onPress={() => router.navigate(TAB_ROUTES.patientDetails)}
                  activeOpacity={0.85}
                >
                  <View style={styles.tableRowTop}>
                    <Text style={styles.tablePatientName} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
                      <Text style={[styles.statusPillText, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.tableMini}>Admitted: {p.date || 'N/A'}</Text>
                  <View style={styles.tableProgressRow}>
                    <Text style={styles.tableProgressPct}>{p.progress}%</Text>
                    <View style={styles.tableProgressTrack}>
                      <View style={[styles.tableProgressFill, { width: `${p.progress}%` }]} />
                    </View>
                  </View>
                  <Text style={styles.tableMini}>Reports: {patientReportCount(p.id)}/7</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={[styles.panelCard, { marginTop: 14 }]}>
          <View style={styles.tableHead}>
            <View style={styles.tableHeadLeft}>
              <Ionicons name="clipboard" size={16} color="#F54E25" />
              <Text style={styles.panelTitleInline}>Request Tracker</Text>
            </View>
            <Text style={styles.tableMeta}>{totalPendingRequests} pending</Text>
          </View>
          {requestTableRows.length === 0 ? (
            <Text style={styles.emptyMuted}>No pending requests.</Text>
          ) : (
            requestTableRows.map((r) => {
              const typeBg =
                r.type === 'Admission' ? '#EEF2FF' : r.type === 'Discharge' ? '#FFF1F2' : '#ECFDF5';
              const typeColor =
                r.type === 'Admission' ? '#3730A3' : r.type === 'Discharge' ? '#9F1239' : '#065F46';
              return (
                <View key={r.key} style={styles.reqRow}>
                  <View style={[styles.reqTypePill, { backgroundColor: typeBg }]}>
                    <Text style={[styles.reqTypePillText, { color: typeColor }]}>{r.type}</Text>
                  </View>
                  <View style={styles.reqMid}>
                    <Text style={styles.reqName} numberOfLines={1}>
                      {r.name}
                    </Text>
                    {r.date ? (
                      <Text style={styles.reqDate} numberOfLines={1}>
                        {r.date}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.reqStatusCell}>
                    <View style={styles.reqPill}>
                      <Text style={styles.reqPillText}>{String(r.status || 'pending').toLowerCase()}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => dismissRequestRow(r.key)}
                      accessibilityRole="button"
                      accessibilityLabel="Dismiss from list"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.reqDismiss}>×</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>

      </ScrollView>

      <Modal
        visible={showReportModal}
        animationType="slide"
        onRequestClose={() => {
          setShowReportModal(false);
          setWeeklyReportDetail(null);
          setWeeklyReportExpandedPatientId(null);
        }}
      >
        <View style={[styles.reportModalRoot, { paddingBottom: insets.bottom }]}>
          <LinearGradient
            colors={['#0B1528', '#152238', '#2A1A28']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.reportModalHero, { paddingTop: insets.top + 12 }]}
          >
            <View style={styles.reportModalHeroWash} />
            <View style={styles.reportModalHeroRow}>
              {weeklyReportDetail ? (
                <TouchableOpacity
                  onPress={() => setWeeklyReportDetail(null)}
                  style={styles.reportModalIconBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Back to patient list"
                >
                  <Ionicons name="chevron-back" size={20} color="#fff" />
                </TouchableOpacity>
              ) : (
                <LinearGradient colors={['#FF6A3D', '#F54E25', '#E8441A']} style={styles.reportModalHeroIcon}>
                  <Ionicons name="medkit-outline" size={22} color="#fff" />
                </LinearGradient>
              )}
              <View style={styles.reportModalHeroCopy}>
                <Text style={styles.reportModalKicker}>Care updates</Text>
                <Text style={styles.reportModalTitle}>
                  {weeklyReportDetail
                    ? `Week ${weeklyReportDetail.week}`
                    : 'Weekly nurse reports'}
                </Text>
                <Text style={styles.reportModalSub}>
                  {weeklyReportDetail
                    ? weeklyReportDetail.patientName
                    : 'Choose a resident, then a week (1–7)'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowReportModal(false);
                  setWeeklyReportDetail(null);
                  setWeeklyReportExpandedPatientId(null);
                }}
                style={styles.reportModalIconBtn}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
              >
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {!weeklyReportDetail ? (
            <ScrollView
              style={styles.reportModalScroll}
              contentContainerStyle={styles.reportModalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {patients.length === 0 ? (
                <View style={styles.reportEmptyCard}>
                  <Ionicons name="document-text-outline" size={28} color="#94A3B8" />
                  <Text style={styles.reportEmptyTitle}>No patient records yet</Text>
                  <Text style={styles.reportEmptySub}>
                    Weekly care updates will appear here once a resident is admitted.
                  </Text>
                </View>
              ) : (
                patients.map((p) => {
                  const expanded = weeklyReportExpandedPatientId === p.id;
                  const count = patientReportCount(p.id);
                  const reportPct = Math.round((count / 7) * 100);
                  return (
                    <View
                      key={p.id}
                      style={[styles.reportPatientBlock, expanded && styles.reportPatientBlockOn]}
                    >
                      <TouchableOpacity
                        style={styles.reportPatientRow}
                        onPress={() =>
                          setWeeklyReportExpandedPatientId(expanded ? null : String(p.id))
                        }
                        activeOpacity={0.9}
                      >
                        <LinearGradient
                          colors={expanded ? ['#F54E25', '#EA580C'] : ['#EEF2FF', '#C7D2FE']}
                          style={styles.reportPatientAvatar}
                        >
                          <Text
                            style={[
                              styles.reportPatientInitials,
                              expanded && styles.reportPatientInitialsOn,
                            ]}
                          >
                            {deriveInitials(p.name)}
                          </Text>
                        </LinearGradient>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.reportPatientName} numberOfLines={1}>
                            {p.name}
                          </Text>
                          <Text style={styles.reportPatientMeta}>
                            Reports submitted: {count}/7
                          </Text>
                          <View style={styles.reportPatientTrack}>
                            <LinearGradient
                              colors={expanded ? ['#F54E25', '#EA580C'] : ['#6366F1', '#818CF8']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={[styles.reportPatientFill, { width: `${reportPct}%` }]}
                            />
                          </View>
                        </View>
                        <View style={[styles.reportChevronWrap, expanded && styles.reportChevronWrapOn]}>
                          <Ionicons
                            name={expanded ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color={expanded ? '#F54E25' : '#64748B'}
                          />
                        </View>
                      </TouchableOpacity>
                      {expanded ? (
                        <View style={styles.reportWeekSection}>
                          <Text style={styles.reportWeekLabel}>Select a week</Text>
                          <View style={styles.reportWeekGrid}>
                            {[1, 2, 3, 4, 5, 6, 7].map((w) => {
                              const weekKey = String(w);
                              const rec = nurseWeeklyByPatient[String(p.id)]?.[weekKey];
                              const has = !!rec;
                              return (
                                <TouchableOpacity
                                  key={weekKey}
                                  style={[
                                    styles.reportWeekChip,
                                    has ? styles.reportWeekChipOn : styles.reportWeekChipOff,
                                  ]}
                                  disabled={!has}
                                  onPress={() => {
                                    if (!rec) return;
                                    setWeeklyReportDetail({
                                      patientId: String(p.id),
                                      patientName: p.name,
                                      week: weekKey,
                                      ...rec,
                                    });
                                  }}
                                >
                                  {has ? (
                                    <LinearGradient
                                      colors={['#FFF7ED', '#FFEDD5']}
                                      style={StyleSheet.absoluteFill}
                                    />
                                  ) : null}
                                  <Text
                                    style={[
                                      styles.reportWeekChipText,
                                      has ? styles.reportWeekChipTextOn : styles.reportWeekChipTextOff,
                                    ]}
                                  >
                                    W{w}
                                  </Text>
                                  {has ? <View style={styles.reportWeekDot} /> : null}
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      ) : null}
                    </View>
                  );
                })
              )}
            </ScrollView>
          ) : (
            <ScrollView
              style={styles.reportModalScroll}
              contentContainerStyle={styles.reportModalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.reportDetailMeta}>
                <View style={styles.reportDetailMetaRow}>
                  <Ionicons name="person-outline" size={14} color="#F54E25" />
                  <Text style={styles.reportDetailMetaText}>
                    Nurse: {weeklyReportDetail.nurseName || '—'}
                  </Text>
                </View>
                <View style={styles.reportDetailMetaRow}>
                  <Ionicons name="calendar-outline" size={14} color="#F54E25" />
                  <Text style={styles.reportDetailMetaText}>
                    Report date:{' '}
                    {weeklyReportDetail.reportDate
                      ? formatNurseReportDate(weeklyReportDetail.reportDate)
                      : formatNurseReportDate(weeklyReportDetail.submittedAt ?? undefined) || '—'}
                  </Text>
                </View>
                <View style={styles.reportDetailMetaRow}>
                  <Ionicons name="time-outline" size={14} color="#F54E25" />
                  <Text style={styles.reportDetailMetaText}>
                    Submitted:{' '}
                    {formatNurseReportDate(weeklyReportDetail.submittedAt ?? undefined) || '—'}
                  </Text>
                </View>
              </View>

              {weeklyReportDetail.progressPercent != null &&
              !Number.isNaN(Number(weeklyReportDetail.progressPercent)) ? (
                <View style={styles.reportDetailProgCard}>
                  <View style={styles.reportDetailProgHead}>
                    <Text style={styles.reportDetailProgLbl}>Progress this week</Text>
                    <Text style={styles.reportDetailProgPct}>
                      {weeklyReportDetail.progressPercent}%
                    </Text>
                  </View>
                  <View style={styles.reportDetailProgTrack}>
                    <LinearGradient
                      colors={['#F54E25', '#EA580C']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.reportDetailProgFill,
                        {
                          width: `${Math.min(100, Math.max(0, Number(weeklyReportDetail.progressPercent) || 0))}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              ) : null}

              <View style={styles.reportFieldGrid}>
                <ReportFieldCard
                  label="Summary"
                  value={weeklyReportDetail.summary || 'No summary for this week.'}
                  icon="reader"
                />
                <ReportFieldCard
                  label="Progress"
                  value={
                    weeklyReportDetail.progressPercent != null &&
                    !Number.isNaN(Number(weeklyReportDetail.progressPercent))
                      ? `${weeklyReportDetail.progressPercent}%`
                      : 'N/A'
                  }
                  icon="stats-chart"
                />
                <ReportFieldCard
                  label="Nurse notes"
                  value={weeklyReportDetail.nurseNote || 'No notes available.'}
                  icon="document-text"
                />
                <ReportFieldCard
                  label="Behavior / observation"
                  value={weeklyReportDetail.behaviorObservation || 'No behavior notes recorded.'}
                  icon="heart"
                />
                <ReportFieldCard
                  label="Recommendations"
                  value={weeklyReportDetail.recommendations || 'No recommendations recorded.'}
                  icon="checkmark-circle"
                />
                <ReportFieldCard
                  label="Current medications"
                  value={weeklyReportDetail.currentMedications || 'None listed.'}
                  icon="flask"
                />
                <ReportFieldCard
                  label="Medication intervention"
                  value={weeklyReportDetail.medicationIntervention || 'None listed.'}
                  icon="shield-checkmark"
                />
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      <FamilyWebMobileNav active="home" />
      <FamilyFloatingChat />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mobileTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 56,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F1',
  },
  mobileTopBarRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerNotifyBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F54E25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EA580C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    shadowColor: '#F54E25',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  headerAvatarText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  notifModalRoot: { flex: 1 },
  notifModalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
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
  notificationsDropdownTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  notificationsDropdownTitle: { fontSize: 15, fontWeight: '800', color: '#1B2559' },
  notificationsDropdownRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  notificationsDropdownText: { flex: 1, fontSize: 13, color: '#334155', lineHeight: 18 },
  notificationDismiss: { fontSize: 18, lineHeight: 18, color: '#94A3B8', fontWeight: '700', paddingHorizontal: 2 },
  scrollContent: { paddingHorizontal: isCompactScreen ? 14 : 18, paddingTop: 12 },
  heroBanner: {
    borderRadius: 22,
    padding: isCompactScreen ? 18 : 24,
    marginBottom: 14,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    justifyContent: 'flex-end',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 8,
    minHeight: isCompactScreen ? 168 : 188,
  },
  heroBannerImage: {
    borderRadius: 22,
  },
  heroInner: { gap: 6 },
  heroTitle: {
    fontSize: isCompactScreen ? 21 : 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  heroWave: {
    fontSize: isCompactScreen ? 18 : 20,
  },
  heroSub: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.82)',
    maxWidth: '78%',
  },
  summaryCard: {
    borderRadius: 22,
    backgroundColor: BH.surface,
    padding: isCompactScreen ? 16 : 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: BH.border,
    shadowColor: BH.slate900,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 3,
  },
  summaryHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', letterSpacing: -0.2 },
  summaryViewAll: { fontSize: 13, fontWeight: '700', color: '#2563EB' },
  summaryStatsRow: { flexDirection: 'row', alignItems: 'flex-start' },
  summaryStatCol: { flex: 1, minWidth: 0 },
  summaryStatLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  summaryStatValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  summaryStatValue: { fontSize: 26, fontWeight: '900', color: BH.slate900, letterSpacing: -0.5 },
  summaryStatIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryStatSub: { fontSize: 11, color: '#94A3B8', fontWeight: '500', marginTop: 3 },
  summaryDividerV: { width: 1, alignSelf: 'stretch', backgroundColor: BH.border, marginHorizontal: 16 },
  summaryDividerH: { height: 1, backgroundColor: BH.border, marginVertical: 16 },
  summaryProgressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  summaryProgressLabel: { fontSize: 13, fontWeight: '700', color: '#334155' },
  summaryProgressPct: { fontSize: 13, fontWeight: '800', color: BH.brand },
  summaryProgressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: BH.slate100,
    overflow: 'hidden',
  },
  summaryProgressFill: { height: '100%', borderRadius: 4, backgroundColor: BH.brand },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitleText: { fontSize: 14, fontWeight: '800', color: '#0F172A', letterSpacing: -0.2 },
  sectionSub: { fontSize: 11, color: '#94A3B8', marginTop: 4, fontWeight: '500' },
  panelCard: {
    backgroundColor: BH.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BH.border,
    padding: 18,
    shadowColor: BH.slate900,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 28,
    elevation: 4,
  },
  quickActionsHeaderRow: {
    marginBottom: 14,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickActionItem: {
    alignItems: 'center',
    gap: 8,
    width: (width - (isCompactScreen ? 28 : 36) - 2 * 18) / 4,
  },
  quickActionCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.brand,
  },
  quickActionBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: BH.danger,
    borderWidth: 2,
    borderColor: BH.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },
  quickActionLabel: { fontSize: 11.5, fontWeight: '700', color: '#334155', textAlign: 'center' },
  chartTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  chartTitle: { color: '#1B2559', fontWeight: '800', fontSize: 16 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  loadingText: { color: '#64748B', fontWeight: '700', fontSize: 13 },
  errorInline: { marginTop: 10, color: '#EF4444', fontSize: 11, fontWeight: '700' },
  supportCard: {
    borderRadius: 20,
    backgroundColor: BH.brandSurface,
    borderWidth: 1,
    borderColor: 'rgba(254, 215, 170, 0.6)',
    padding: 18,
    marginTop: 14,
    overflow: 'hidden',
  },
  supportHeartWatermark: {
    position: 'absolute',
    right: -16,
    bottom: -16,
  },
  supportTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  supportTitle: { fontSize: 16, fontWeight: '800', color: BH.navy },
  supportSub: { fontSize: 13, color: '#64748B', fontWeight: '500', marginTop: 4, maxWidth: '80%', lineHeight: 18 },
  supportBtn: {
    alignSelf: 'flex-start',
    backgroundColor: BH.brand,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 14,
    ...SHADOW.brand,
  },
  supportBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  updateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  updateIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  updateMain: { flex: 1, minWidth: 0 },
  updateText: { fontSize: 13, fontWeight: '600', color: '#1E293B', lineHeight: 18 },
  updateMeta: { fontSize: 11, color: '#94A3B8', fontWeight: '500', marginTop: 2 },
  updateNewBadge: {
    backgroundColor: BH.brandSurface,
    borderWidth: 1,
    borderColor: 'rgba(254, 215, 170, 0.6)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  updateNewBadgeText: { fontSize: 10, fontWeight: '800', color: BH.brand700 },
  tableHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  tableHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  panelTitleInline: { fontSize: 15, fontWeight: '800', color: '#1B2559' },
  tableMeta: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  emptyMuted: { color: '#94A3B8', fontSize: 13, fontWeight: '700', textAlign: 'center', paddingVertical: 12 },
  tableRow: {
    borderWidth: 1,
    borderColor: BH.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    backgroundColor: BH.surface2,
  },
  tableRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tablePatientName: { flex: 1, fontSize: 15, fontWeight: '800', color: '#1B2559' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusPillText: { fontSize: 11, fontWeight: '800' },
  tableMini: { fontSize: 12, color: '#64748B', fontWeight: '600', marginTop: 6 },
  tableProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  tableProgressPct: { fontSize: 11, fontWeight: '800', color: '#1B2559', width: 36 },
  tableProgressTrack: { flex: 1, height: 6, backgroundColor: '#F1F5F9', borderRadius: 8, overflow: 'hidden' },
  tableProgressFill: { height: '100%', backgroundColor: '#F54E25', borderRadius: 8 },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  reqTypePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  reqTypePillText: { fontSize: 10, fontWeight: '800' },
  reqMid: { flex: 1, minWidth: 0 },
  reqName: { fontSize: 13, fontWeight: '700', color: '#1B2559' },
  reqDate: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
  reqStatusCell: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reqPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  reqPillText: { fontSize: 10, fontWeight: '800', color: '#475569', textTransform: 'lowercase' },
  reqDismiss: { fontSize: 20, lineHeight: 22, color: '#94A3B8', fontWeight: '700', paddingHorizontal: 4 },
  reportModalRoot: { flex: 1, backgroundColor: '#F8FAFC' },
  reportModalHero: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  reportModalHeroWash: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '50%',
    backgroundColor: 'rgba(74, 40, 50, 0.35)',
    borderTopLeftRadius: 80,
  },
  reportModalHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 1,
  },
  reportModalHeroIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportModalHeroCopy: { flex: 1, minWidth: 0 },
  reportModalIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportModalKicker: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FF8A65',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  reportModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  reportModalSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
    lineHeight: 17,
  },
  reportModalScroll: { flex: 1 },
  reportModalScrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },
  reportEmptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  reportEmptyTitle: { fontSize: 15, fontWeight: '800', color: '#1A2B4A', marginTop: 4 },
  reportEmptySub: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 19,
  },
  reportPatientBlock: {
    borderWidth: 1,
    borderColor: '#E8EDF3',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
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
  reportPatientBlockOn: {
    borderColor: '#FED7AA',
    backgroundColor: '#FFFBF7',
  },
  reportPatientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  reportPatientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportPatientInitials: { fontSize: 14, fontWeight: '800', color: '#4338CA' },
  reportPatientInitialsOn: { color: '#FFFFFF' },
  reportPatientName: { fontSize: 15, fontWeight: '800', color: '#1A2B4A' },
  reportPatientMeta: { fontSize: 11, color: '#64748B', fontWeight: '600', marginTop: 3 },
  reportPatientTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E8EDF3',
    marginTop: 8,
    overflow: 'hidden',
  },
  reportPatientFill: { height: '100%', borderRadius: 3 },
  reportChevronWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8EDF3',
  },
  reportChevronWrapOn: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  reportWeekSection: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  reportWeekLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  reportWeekGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reportWeekChip: {
    minWidth: 52,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  reportWeekChipOn: { borderColor: '#F54E25' },
  reportWeekChipOff: { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', opacity: 0.65 },
  reportWeekChipText: { fontSize: 13, fontWeight: '800' },
  reportWeekChipTextOn: { color: '#C2410C' },
  reportWeekChipTextOff: { color: '#94A3B8' },
  reportWeekDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F54E25',
  },
  reportDetailMeta: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    gap: 8,
  },
  reportDetailMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reportDetailMetaText: { flex: 1, fontSize: 12, color: '#475569', fontWeight: '600' },
  reportDetailProgCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8EDF3',
  },
  reportDetailProgHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reportDetailProgLbl: { fontSize: 12, fontWeight: '800', color: '#1A2B4A' },
  reportDetailProgPct: { fontSize: 14, fontWeight: '800', color: '#F54E25' },
  reportDetailProgTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  reportDetailProgFill: { height: '100%', borderRadius: 4 },
  reportFieldGrid: { gap: 10 },
  reportFieldCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8EDF3',
    padding: 14,
  },
  reportFieldCardHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  reportFieldCardLbl: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reportFieldCardVal: { fontSize: 14, color: '#1A2B4A', fontWeight: '600', lineHeight: 21 },
});
