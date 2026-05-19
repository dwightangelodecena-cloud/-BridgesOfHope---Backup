import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { TAB_ROUTES } from '../../lib/navigationConfig';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { uiPatientFromRow, type PatientRow, type UIPatient } from '../../lib/patientMappers';
import {
  uiAdmissionRequestFromRow,
  uiDischargeRequestFromRow,
} from '../../lib/dbMappers';
import { fetchActivityFeedForCurrentUser } from '../../lib/activityFeed';
import { FamilyWebMobileNav } from '../../components/family/FamilyWebMobileNav';
import { FamilyFloatingChat } from '../../components/family/FamilyFloatingChat';
import { FamilyMessageIcon } from '../../components/family/FamilyMessageIcon';
import { useSupportChatMobile } from '../../lib/useSupportChatMobile';
import { KalingaLogoMark } from '../../components/family/KalingaLogoMark';
import { LinearGradient } from 'expo-linear-gradient';
import { FamilyMobilePageHeader } from '../../components/family/FamilyMobilePageHeader';
import { useFamilyUserMobile } from '../../lib/useFamilyUserMobile';
import {
  listVisitationRequestsByFamily,
  mergeRequestsFromSupabase,
  normalizeVisitationStatus,
  type VisitationRequestRow,
} from '../../lib/visitationAppointmentsMobile';

const { width } = Dimensions.get('window');
const isCompactScreen = width <= 380;
const BG = '#F8FAFF';

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

function computeStayDays(admittedAt?: string | null, dischargedAt?: string | null): number {
  const a = new Date(admittedAt || 0).getTime();
  if (!a || Number.isNaN(a)) return 0;
  const d = dischargedAt ? new Date(dischargedAt).getTime() : Date.now();
  if (!d || Number.isNaN(d)) return 0;
  if (d < a) return 1;
  return Math.max(1, Math.ceil((d - a) / (24 * 60 * 60 * 1000)));
}

function computeAverageStayDays(
  list: { admitted_at?: string | null; discharged_at?: string | null }[] | null | undefined
): number {
  const stays = (list || [])
    .map((p) => computeStayDays(p.admitted_at, p.discharged_at))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!stays.length) return 0;
  return Math.round(stays.reduce((sum, n) => sum + n, 0) / stays.length);
}

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

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { displayName } = useFamilyUserMobile();
  const { unreadCount: supportUnreadCount } = useSupportChatMobile();
  const [patients, setPatients] = useState<UIPatient[]>([]);
  const [pendingAdmissions, setPendingAdmissions] = useState<PendingAdmission[]>([]);
  const [pendingDischarges, setPendingDischarges] = useState<PendingDischarge[]>([]);
  const [nurseWeeklyByPatient, setNurseWeeklyByPatient] = useState<Record<string, Record<string, NurseWeekRecord>>>({});
  const [familyVisitationRequests, setFamilyVisitationRequests] = useState<VisitationRequestRow[]>([]);
  const [averageStayDays, setAverageStayDays] = useState(0);
  const [hiddenRequestKeys, setHiddenRequestKeys] = useState<string[]>([]);
  const [familyUserId, setFamilyUserId] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [weeklyReportExpandedPatientId, setWeeklyReportExpandedPatientId] = useState<string | null>(null);
  const [weeklyReportDetail, setWeeklyReportDetail] = useState<WeeklyReportDetailState | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [supabaseReadError, setSupabaseReadError] = useState<string | null>(null);

  const firstName =
    String(displayName || 'Family User')
      .trim()
      .split(/\s+/)
      .filter(Boolean)[0] || 'Family';

  const loadDashboard = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setPatients([]);
      setPendingAdmissions([]);
      setPendingDischarges([]);
      setNurseWeeklyByPatient({});
      setFamilyVisitationRequests([]);
      setAverageStayDays(0);
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
        setAverageStayDays(0);
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

      const { data: allFamilyRows } = await supabase
        .from('patients')
        .select('admitted_at, discharged_at')
        .eq('family_id', user.id);

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
      setAverageStayDays(computeAverageStayDays(allFamilyRows || []));

      const localVisit = await listVisitationRequestsByFamily(user.id);
      const mergedVisit = await mergeRequestsFromSupabase(user.id, localVisit);
      setFamilyVisitationRequests(mergedVisit);

      const [{ data: aRows, error: aErr }, { data: dRows, error: dErr }] = await Promise.all([
        supabase.from('admission_requests').select('*').eq('family_id', user.id).eq('status', 'pending'),
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
      void fetchActivityFeedForCurrentUser();
    } catch {
      setPatients([]);
      setPendingAdmissions([]);
      setPendingDischarges([]);
      setNurseWeeklyByPatient({});
      setFamilyVisitationRequests([]);
      setAverageStayDays(0);
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
  const summaryGraphData = [
    { label: 'Residents', value: patients.length, color: '#F54E25' },
    { label: 'Admissions', value: pendingAdmissions.length, color: '#EA580C' },
    { label: 'Discharges', value: pendingDischarges.length, color: '#6366F1' },
    {
      label: 'Avg Progress',
      value: patients.length
        ? Math.round(patients.reduce((sum, p) => sum + (Number(p.progress) || 0), 0) / patients.length)
        : 0,
      color: '#16A34A',
    },
    { label: 'Reports', value: reportsReceivedCount, color: '#7C3AED' },
    { label: 'Avg Stay', value: averageStayDays, color: '#0369A1' },
  ];
  const summaryGraphMax = Math.max(5, ...summaryGraphData.map((d) => Number(d.value) || 0));
  const averageProgress = patients.length
    ? Math.round(patients.reduce((sum, p) => sum + (Number(p.progress) || 0), 0) / patients.length)
    : 0;
  const reportCoverageRate = patients.length
    ? Math.min(100, Math.round((reportsReceivedCount / Math.max(1, patients.length * 7)) * 100))
    : 0;
  const metricInsights = [
    {
      label: 'Care Load',
      value: String(totalPendingRequests),
      note:
        totalPendingRequests > 5 ? 'High queue' : totalPendingRequests > 0 ? 'Manageable queue' : 'No pending requests',
      color: '#F59E0B',
    },
    {
      label: 'Avg Recovery',
      value: `${averageProgress}%`,
      note:
        averageProgress >= 70 ? 'Strong recovery trend' : averageProgress >= 40 ? 'Steady recovery' : 'Needs support focus',
      color: '#16A34A',
    },
    {
      label: 'Report Coverage',
      value: `${reportCoverageRate}%`,
      note: 'Nurse reports vs expected weekly slots',
      color: '#7C3AED',
    },
    {
      label: 'Admission Pressure',
      value: String(pendingAdmissions.length),
      note: pendingAdmissions.length ? 'Follow up with admin' : 'No pending admissions',
      color: '#EA580C',
    },
    {
      label: 'Avg Stay Days',
      value: String(averageStayDays),
      note: 'Includes active and discharged',
      color: '#0369A1',
    },
  ];
  const highestMetric = summaryGraphData.reduce(
    (max, item) => ((Number(item.value) || 0) > (Number(max.value) || 0) ? item : max),
    summaryGraphData[0] || { label: 'Residents', value: 0, color: '#F54E25' }
  );

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

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>
      <FamilyMobilePageHeader />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#1E293B', '#1D2D50', '#312e81']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          <View style={styles.heroInner}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.heroEyebrowRow}>
                <View style={styles.heroHeartWrap}>
                  <Ionicons name="heart" size={16} color="#FFFFFF" />
                </View>
                <Text style={styles.heroEyebrow} numberOfLines={1}>
                  Bridges of Hope — Family Portal
                </Text>
              </View>
              <Text style={styles.heroTitle}>
                {greeting}, {firstName} 👋
              </Text>
              <Text style={styles.heroSub}>{dateStr} · Your care overview at a glance</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.statGrid}>
          {[
            {
              label: 'Active Residents',
              value: String(patients.length),
              sub: 'Currently under care',
              icon: 'pulse' as const,
              accent: '#6366F1',
              bg: '#EEF2FF',
              border: '#C7D2FE',
            },
            {
              label: 'Avg Progress',
              value: `${averageProgress}%`,
              sub: averageProgress >= 70 ? 'Strong trend' : 'Steady recovery',
              icon: 'trending-up' as const,
              accent: '#10B981',
              bg: '#ECFDF5',
              border: '#A7F3D0',
            },
            {
              label: 'Pending Requests',
              value: String(totalPendingRequests),
              sub: 'Admissions, discharges, appointments',
              icon: 'alert-circle' as const,
              accent: '#F59E0B',
              bg: '#FFFBEB',
              border: '#FDE68A',
            },
            {
              label: 'Reports Received',
              value: String(reportsReceivedCount),
              sub: 'From nursing staff',
              icon: 'document-text' as const,
              accent: '#8B5CF6',
              bg: '#F5F3FF',
              border: '#DDD6FE',
            },
          ].map((card) => (
            <View key={card.label} style={[styles.statCard, { borderColor: card.border }]}>
              <View style={[styles.statCardDeco, { backgroundColor: card.bg }]} />
              <View style={styles.statCardInner}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.statCardLabel}>{card.label}</Text>
                  <Text style={styles.statCardValue}>{card.value}</Text>
                  <Text style={styles.statCardSub}>{card.sub}</Text>
                </View>
                <View style={[styles.statCardIconWrap, { backgroundColor: card.bg, borderColor: card.border }]}>
                  <Ionicons name={card.icon} size={20} color={card.accent} />
                </View>
              </View>
            </View>
          ))}
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
          <TouchableOpacity
            style={styles.actionCard}
            onPress={openWeeklyReportsModal}
            activeOpacity={0.9}
          >
            <View style={styles.iconSquare}>
              <Ionicons name="document-text" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.actionMain}>
              <Text style={styles.actionTitle}>Weekly Report</Text>
              <Text style={styles.actionSubtitle}>Review submitted weekly care updates from nursing staff</Text>
              <View style={[styles.actionBadge, { backgroundColor: '#FFF1EB' }]}>
                <Text style={[styles.actionBadgeText, { color: '#C2410C' }]}>{reportsReceivedCount} received</Text>
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.navigate(TAB_ROUTES.admission)}
            activeOpacity={0.9}
          >
            <View style={styles.iconSquare}>
              <Ionicons name="clipboard" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.actionMain}>
              <Text style={styles.actionTitle}>Admission</Text>
              <Text style={styles.actionSubtitle}>Submit and track new admission request forms</Text>
              <View style={[styles.actionBadge, { backgroundColor: '#FEF3C7' }]}>
                <Text style={[styles.actionBadgeText, { color: '#92400E' }]}>
                  {pendingAdmissions.length} pending
                </Text>
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.navigate(TAB_ROUTES.services)}
            activeOpacity={0.9}
          >
            <View style={styles.iconSquare}>
              <Ionicons name="briefcase" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.actionMain}>
              <Text style={styles.actionTitle}>Services</Text>
              <Text style={styles.actionSubtitle}>Open billing, inclusions, and care support details</Text>
              <View style={[styles.actionBadge, { backgroundColor: '#EEF2FF' }]}>
                <Text style={[styles.actionBadgeText, { color: '#3730A3' }]}>Care resources</Text>
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.navigate(TAB_ROUTES.messages)}
            activeOpacity={0.9}
          >
            <FamilyMessageIcon size="md" badge={supportUnreadCount} />
            <View style={styles.actionMain}>
              <Text style={styles.actionTitle}>Messages</Text>
              <Text style={styles.actionSubtitle}>Chat with the Bridges of Hope care team</Text>
              {supportUnreadCount > 0 ? (
                <View style={[styles.actionBadge, { backgroundColor: '#FEE2E2' }]}>
                  <Text style={[styles.actionBadgeText, { color: '#DC2626' }]}>
                    {supportUnreadCount} new {supportUnreadCount === 1 ? 'reply' : 'replies'}
                  </Text>
                </View>
              ) : (
                <View style={[styles.actionBadge, { backgroundColor: '#FFF1EB' }]}>
                  <Text style={[styles.actionBadgeText, { color: '#C2410C' }]}>Support chat</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>

        <View style={[styles.panelCard, { marginTop: 14 }]}>
          <View style={styles.chartTop}>
            <View>
              <Text style={styles.chartTitle}>Dashboard Summary</Text>
              <Text style={styles.chartSub}>Clear overview of patient, request, and report data</Text>
            </View>
            <Text style={styles.chartMeta}>Live data</Text>
          </View>
          {dashboardLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#F54E25" />
              <Text style={styles.loadingText}>Loading dashboard…</Text>
            </View>
          ) : null}
          <Text style={styles.insightPanelTitle}>Graph View</Text>
          <View style={styles.summaryBars}>
            {summaryGraphData.map((item) => (
              <View key={item.label} style={styles.summaryBarItem}>
                <Text style={styles.summaryBarValue}>{item.value}</Text>
                <View style={styles.summaryBarStage}>
                  <View
                    style={[
                      styles.summaryBarFill,
                      {
                        height: `${Math.max(10, Math.round(((Number(item.value) || 0) / summaryGraphMax) * 100))}%`,
                        backgroundColor: item.color,
                      },
                    ]}
                  />
                </View>
                <View style={styles.summaryBarLabelWrap}>
                  <Text style={styles.summaryBarLabel} numberOfLines={2}>
                    {item.label}
                  </Text>
                </View>
              </View>
            ))}
          </View>
          <Text style={styles.callout}>
            Highest metric right now: <Text style={styles.calloutStrong}>{highestMetric.label}</Text>
          </Text>
          <Text style={[styles.insightPanelTitle, { marginTop: 16 }]}>Operational Insights</Text>
          <View style={styles.kpiGrid}>
            {metricInsights.map((item) => (
              <View key={item.label} style={styles.kpiItem}>
                <Text style={styles.kpiLabel}>{item.label}</Text>
                <Text style={styles.kpiValue}>{item.value}</Text>
                <View style={[styles.kpiBar, { backgroundColor: item.color }]} />
                <Text style={styles.kpiNote}>{item.note}</Text>
              </View>
            ))}
          </View>
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

        <View style={[styles.panelCard, { marginTop: 14 }]}>
          <View style={styles.tableHeadLeft}>
            <Ionicons name="bar-chart" size={16} color="#F54E25" />
            <Text style={styles.panelTitleInline}>Dashboard Highlights</Text>
          </View>
          <View style={styles.highlightsGrid}>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>Active Residents</Text>
              <Text style={styles.overviewValue}>{patients.length}</Text>
              <Text style={styles.overviewSub}>Currently under care</Text>
            </View>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>Pending Requests</Text>
              <Text style={styles.overviewValue}>{totalPendingRequests}</Text>
              <Text style={styles.overviewSub}>Admissions, discharges, and appointments</Text>
            </View>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>Average Progress</Text>
              <Text style={styles.overviewValue}>{averageProgress}%</Text>
              <Text style={styles.overviewSub}>Across all assigned patients</Text>
            </View>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>Reports Received</Text>
              <Text style={styles.overviewValue}>{reportsReceivedCount}</Text>
              <Text style={styles.overviewSub}>Weekly reports submitted by nurse</Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomTwoCol}>
          <View style={[styles.panelCard, styles.bottomCard]}>
            <View style={styles.tableHeadLeft}>
              <Ionicons name="calendar" size={16} color="#F54E25" />
              <Text style={styles.panelTitleInline}>Next Steps</Text>
            </View>
            <Text style={styles.nextSub}>Suggested actions to keep care coordination on track.</Text>
            <View style={styles.cleanListItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cleanTitle}>Review request management queue</Text>
                <Text style={styles.cleanDesc}>Check admission/discharge updates from staff</Text>
              </View>
              <View style={styles.miniPill}>
                <Text style={styles.miniPillText}>{totalPendingRequests || 0} pending</Text>
              </View>
            </View>
            <View style={styles.cleanListItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cleanTitle}>Open patient details</Text>
                <Text style={styles.cleanDesc}>View status and progress of all patients</Text>
              </View>
              <TouchableOpacity style={styles.openBtnIndigo} onPress={() => router.navigate(TAB_ROUTES.patientDetails)}>
                <Text style={styles.openBtnText}>Open</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.cleanListItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cleanTitle}>Check appointment slots</Text>
                <Text style={styles.cleanDesc}>Plan follow-ups and visit schedules</Text>
              </View>
              <TouchableOpacity style={styles.openBtnGreen} onPress={() => router.navigate(TAB_ROUTES.appointments)}>
                <Text style={styles.openBtnText}>View</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.panelCard, styles.bottomCard]}>
            <View style={styles.tableHeadLeft}>
              <Ionicons name="document-text" size={16} color="#F54E25" />
              <Text style={styles.panelTitleInline}>Care Resources</Text>
            </View>
            <View style={styles.cleanListItem}>
              <Text style={styles.cleanTitle}>View Weekly Reports</Text>
              <TouchableOpacity style={styles.openBtnOrange} onPress={openWeeklyReportsModal}>
                <Text style={styles.openBtnText}>Open</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.cleanListItem}>
              <Text style={styles.cleanTitle}>Go to Services</Text>
              <TouchableOpacity style={styles.openBtnIndigo} onPress={() => router.navigate(TAB_ROUTES.services)}>
                <Text style={styles.openBtnText}>Open</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.cleanListItem}>
              <View style={styles.cleanListItemLeft}>
                <FamilyMessageIcon size="sm" badge={supportUnreadCount} />
                <Text style={styles.cleanTitle}>Messages</Text>
              </View>
              <TouchableOpacity style={styles.openBtnOrange} onPress={() => router.navigate(TAB_ROUTES.messages)}>
                <Text style={[styles.openBtnText, { color: '#C2410C' }]}>Open</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.cleanListItem}>
              <Text style={styles.cleanTitle}>Manage Your Profile</Text>
              <TouchableOpacity style={styles.openBtnGreen} onPress={() => router.navigate(TAB_ROUTES.profile)}>
                <Text style={styles.openBtnText}>Open</Text>
              </TouchableOpacity>
            </View>
          </View>
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
        <View style={[styles.reportModalRoot, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.reportModalHeader}>
            {weeklyReportDetail ? (
              <TouchableOpacity
                onPress={() => setWeeklyReportDetail(null)}
                style={styles.reportModalBack}
                accessibilityRole="button"
                accessibilityLabel="Back to patient list"
              >
                <Ionicons name="chevron-back" size={22} color="#F54E25" />
              </TouchableOpacity>
            ) : (
              <View style={styles.reportModalBackSpacer} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.reportModalKicker}>Care updates</Text>
              <Text style={styles.reportModalTitle}>
                {weeklyReportDetail
                  ? `Week ${weeklyReportDetail.week}`
                  : 'Weekly nurse reports'}
              </Text>
              {weeklyReportDetail ? (
                <Text style={styles.reportModalSub}>{weeklyReportDetail.patientName}</Text>
              ) : (
                <Text style={styles.reportModalSub}>Choose a resident, then a week (1–7)</Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => {
                setShowReportModal(false);
                setWeeklyReportDetail(null);
                setWeeklyReportExpandedPatientId(null);
              }}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          {!weeklyReportDetail ? (
            <ScrollView
              style={styles.reportModalScroll}
              contentContainerStyle={{ paddingBottom: 24 }}
              keyboardShouldPersistTaps="handled"
            >
              {patients.length === 0 ? (
                <Text style={styles.emptyMuted}>No patient records yet.</Text>
              ) : (
                patients.map((p) => {
                  const expanded = weeklyReportExpandedPatientId === p.id;
                  const count = patientReportCount(p.id);
                  return (
                    <View key={p.id} style={styles.reportPatientBlock}>
                      <TouchableOpacity
                        style={styles.reportPatientRow}
                        onPress={() =>
                          setWeeklyReportExpandedPatientId(expanded ? null : String(p.id))
                        }
                        activeOpacity={0.85}
                      >
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.reportPatientName} numberOfLines={1}>
                            {p.name}
                          </Text>
                          <Text style={styles.reportPatientMeta}>
                            Reports submitted: {count}/7
                          </Text>
                        </View>
                        <Ionicons
                          name={expanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color="#64748B"
                        />
                      </TouchableOpacity>
                      {expanded ? (
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
                                <Text
                                  style={[
                                    styles.reportWeekChipText,
                                    has ? styles.reportWeekChipTextOn : styles.reportWeekChipTextOff,
                                  ]}
                                >
                                  W{w}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
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
              contentContainerStyle={{ paddingBottom: 32 }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.reportDetailMeta}>
                <Text style={styles.reportDetailMetaText}>
                  Nurse: {weeklyReportDetail.nurseName || '—'}
                </Text>
                <Text style={styles.reportDetailMetaText}>
                  Report date:{' '}
                  {weeklyReportDetail.reportDate
                    ? formatNurseReportDate(weeklyReportDetail.reportDate)
                    : formatNurseReportDate(weeklyReportDetail.submittedAt ?? undefined) || '—'}
                </Text>
                <Text style={styles.reportDetailMetaText}>
                  Submitted:{' '}
                  {formatNurseReportDate(weeklyReportDetail.submittedAt ?? undefined) || '—'}
                </Text>
              </View>
              <Text style={styles.reportDetailLabel}>Summary</Text>
              <Text style={styles.reportDetailVal}>
                {weeklyReportDetail.summary || 'No summary for this week.'}
              </Text>
              <Text style={styles.reportDetailLabel}>Progress</Text>
              <Text style={styles.reportDetailVal}>
                {weeklyReportDetail.progressPercent != null &&
                !Number.isNaN(Number(weeklyReportDetail.progressPercent))
                  ? `${weeklyReportDetail.progressPercent}%`
                  : 'N/A'}
              </Text>
              <Text style={styles.reportDetailLabel}>Nurse notes</Text>
              <Text style={styles.reportDetailVal}>
                {weeklyReportDetail.nurseNote || 'No notes available.'}
              </Text>
              <Text style={styles.reportDetailLabel}>Behavior / observation</Text>
              <Text style={styles.reportDetailVal}>
                {weeklyReportDetail.behaviorObservation || 'No behavior notes recorded.'}
              </Text>
              <Text style={styles.reportDetailLabel}>Recommendations</Text>
              <Text style={styles.reportDetailVal}>
                {weeklyReportDetail.recommendations || 'No recommendations recorded.'}
              </Text>
              <Text style={styles.reportDetailLabel}>Current medications</Text>
              <Text style={styles.reportDetailVal}>
                {weeklyReportDetail.currentMedications || 'None listed.'}
              </Text>
              <Text style={styles.reportDetailLabel}>Medication intervention</Text>
              <Text style={styles.reportDetailVal}>
                {weeklyReportDetail.medicationIntervention || 'None listed.'}
              </Text>
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
    padding: isCompactScreen ? 16 : 22,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  heroInner: { gap: 14 },
  heroEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  heroHeartWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEyebrow: {
    flex: 1,
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: isCompactScreen ? 22 : 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  heroSub: { marginTop: 4, fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.45)' },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    width: (width - (isCompactScreen ? 28 : 36) - 10) / 2,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    padding: 14,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  statCardDeco: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 72,
    height: 72,
    borderBottomLeftRadius: 72,
    opacity: 0.45,
  },
  statCardInner: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  statCardLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  statCardValue: { marginTop: 6, fontSize: 28, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
  statCardSub: { marginTop: 2, fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  statCardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitleText: { fontSize: 14, fontWeight: '800', color: '#0F172A', letterSpacing: -0.2 },
  sectionSub: { fontSize: 11, color: '#94A3B8', marginTop: 4, fontWeight: '500' },
  panelCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 2,
  },
  quickActionsHeaderRow: {
    marginBottom: 14,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    marginBottom: 10,
    backgroundColor: '#FBFDFF',
  },
  iconSquare: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F54E25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionMain: { flex: 1, minWidth: 0 },
  actionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  actionSubtitle: { fontSize: 12, color: '#64748B', fontWeight: '600', marginTop: 4 },
  actionBadge: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  actionBadgeText: { fontSize: 10, fontWeight: '800' },
  chartTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  chartTitle: { color: '#1B2559', fontWeight: '800', fontSize: 16 },
  chartSub: { color: '#64748B', fontSize: 12, marginTop: 4 },
  chartMeta: { color: '#64748B', fontSize: 11, fontWeight: '700' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  loadingText: { color: '#64748B', fontWeight: '700', fontSize: 13 },
  insightPanelTitle: { color: '#1B2559', fontWeight: '800', fontSize: 14, marginBottom: 8 },
  summaryBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    minHeight: 138,
    paddingHorizontal: 2,
    marginBottom: 8,
  },
  summaryBarItem: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 2,
    minWidth: 0,
    justifyContent: 'flex-end',
    minHeight: 136,
  },
  summaryBarValue: { fontSize: 12, fontWeight: '800', color: '#1B2559', marginBottom: 4 },
  summaryBarStage: {
    width: '70%',
    height: 100,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  summaryBarFill: { width: '100%', borderRadius: 8 },
  summaryBarLabelWrap: {
    marginTop: 6,
    minHeight: 32,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryBarLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 12,
    width: '100%',
  },
  callout: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  calloutStrong: { color: '#1B2559', fontWeight: '800' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiItem: {
    width: (width - 36 - 32) / 2 - 5,
    minWidth: 140,
    flexGrow: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    padding: 12,
    backgroundColor: '#FBFDFF',
  },
  kpiLabel: { color: '#64748B', fontSize: 11, fontWeight: '700' },
  kpiValue: { color: '#1B2559', fontWeight: '800', fontSize: 20, marginTop: 6 },
  kpiBar: { marginTop: 8, width: 26, height: 6, borderRadius: 99 },
  kpiNote: { marginTop: 8, fontSize: 11, color: '#64748B', fontWeight: '600', lineHeight: 15 },
  errorInline: { marginTop: 10, color: '#EF4444', fontSize: 11, fontWeight: '700' },
  tableHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  tableHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  panelTitleInline: { fontSize: 15, fontWeight: '800', color: '#1B2559' },
  tableMeta: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  emptyMuted: { color: '#94A3B8', fontSize: 13, fontWeight: '700', textAlign: 'center', paddingVertical: 12 },
  tableRow: {
    borderWidth: 1,
    borderColor: '#E9EDF7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#FBFDFF',
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
  reportModalRoot: { flex: 1, backgroundColor: '#FFFFFF' },
  reportModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFBF9',
  },
  reportModalBack: { padding: 4, marginRight: 4 },
  reportModalBackSpacer: { width: 30 },
  reportModalKicker: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C2410C',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  reportModalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  reportModalSub: { fontSize: 13, color: '#64748B', fontWeight: '600', marginTop: 4 },
  reportModalScroll: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  reportPatientBlock: {
    borderWidth: 1,
    borderColor: '#E9EDF7',
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    backgroundColor: '#FBFDFF',
  },
  reportPatientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  reportPatientName: { fontSize: 16, fontWeight: '800', color: '#1B2559' },
  reportPatientMeta: { fontSize: 12, color: '#64748B', fontWeight: '600', marginTop: 4 },
  reportWeekGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  reportWeekChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  reportWeekChipOn: { borderColor: '#F54E25', backgroundColor: '#FFF7F4' },
  reportWeekChipOff: { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', opacity: 0.7 },
  reportWeekChipText: { fontSize: 13, fontWeight: '800' },
  reportWeekChipTextOn: { color: '#F54E25' },
  reportWeekChipTextOff: { color: '#94A3B8' },
  reportDetailMeta: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E9EDF7',
  },
  reportDetailMetaText: { fontSize: 12, color: '#475569', fontWeight: '600', marginBottom: 4 },
  reportDetailLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 6,
  },
  reportDetailVal: { fontSize: 14, color: '#0F172A', fontWeight: '600', lineHeight: 22 },
  highlightsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  overviewItem: {
    width: (width - 36 - 32) / 2 - 5,
    minWidth: 140,
    flexGrow: 1,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E9EDF7',
  },
  overviewLabel: { fontSize: 12, color: '#64748B', fontWeight: '700' },
  overviewValue: { fontSize: 22, fontWeight: '900', color: '#1B2559', marginTop: 6 },
  overviewSub: { fontSize: 11, color: '#94A3B8', marginTop: 4, fontWeight: '600' },
  bottomTwoCol: { marginTop: 14, gap: 12 },
  bottomCard: { marginBottom: 0 },
  nextSub: { color: '#64748B', fontSize: 13, marginBottom: 10, fontWeight: '600' },
  cleanListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cleanListItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  cleanTitle: { color: '#1B2559', fontWeight: '700', fontSize: 13 },
  cleanDesc: { color: '#64748B', fontSize: 12, marginTop: 2 },
  miniPill: { backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  miniPillText: { color: '#92400E', fontSize: 11, fontWeight: '800' },
  openBtnIndigo: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  openBtnGreen: { backgroundColor: '#ECFDF3', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  openBtnOrange: { backgroundColor: '#FFF1EB', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  openBtnText: { fontSize: 11, fontWeight: '800', color: '#3730A3' },
});
