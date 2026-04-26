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
import { KalingaLogoMark } from '../../components/family/KalingaLogoMark';

const { width } = Dimensions.get('window');
const isCompactScreen = width <= 380;
const BG = '#F8F9FD';

const NOTIFICATION_ITEMS = [
  'Submit missing laboratory result before Friday.',
  'Family support session is scheduled on April 5, 10:00 AM.',
  'Weekly report reviewed by your assigned counselor.',
  'Community Update: Join the monthly Family Wellness Talk on April 9 to learn practical family recovery support strategies.',
];

function deriveInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => (p[0] ? p[0].toUpperCase() : '')).join('') || 'FU';
}

type PendingAdmission = NonNullable<ReturnType<typeof uiAdmissionRequestFromRow>>;
type PendingDischarge = NonNullable<ReturnType<typeof uiDischargeRequestFromRow>>;

function patientStatus(progress: number) {
  const p = Number(progress) || 0;
  if (p >= 70) return { label: 'Stable', color: '#166534', bg: '#DCFCE7' };
  if (p >= 40) return { label: 'Recovering', color: '#92400E', bg: '#FEF3C7' };
  return { label: 'Needs Attention', color: '#991B1B', bg: '#FEE2E2' };
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [userInitials, setUserInitials] = useState('FU');
  const [displayName, setDisplayName] = useState('Family User');
  const [patients, setPatients] = useState<UIPatient[]>([]);
  const [pendingAdmissions, setPendingAdmissions] = useState<PendingAdmission[]>([]);
  const [pendingDischarges, setPendingDischarges] = useState<PendingDischarge[]>([]);
  const [nurseWeeklyByPatient, setNurseWeeklyByPatient] = useState<Record<string, Record<string, unknown>>>({});
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
        console.warn('[home patients]', pErr.message);
        setPatients([]);
      } else {
        setPatients(
          (pRows || [])
            .map((r) => uiPatientFromRow(r as unknown as PatientRow))
            .filter((x): x is UIPatient => x != null)
        );
      }

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
      let byPatient: Record<string, Record<string, unknown>> = {};
      if (ids.length) {
        const { data: wRows, error: wErr } = await supabase.from('weekly_reports').select('*').in('patient_id', ids);
        if (!wErr && wRows) {
          for (const row of wRows) {
            const rec = row as Record<string, unknown>;
            const pid = String(rec.patient_id);
            if (!byPatient[pid]) byPatient[pid] = {};
            byPatient[pid][String(rec.week_number)] = {
              submittedAt: rec.submitted_at,
              nurseName: rec.nurse_name || '',
              reportDate: rec.report_date || '',
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
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
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

  const reportsReceivedCount = Object.values(nurseWeeklyByPatient || {}).reduce(
    (count, patientWeeks) => count + Object.keys(patientWeeks || {}).length,
    0
  );
  const totalPendingRequests = pendingAdmissions.length + pendingDischarges.length;
  const summaryGraphData = [
    { label: 'Patients', value: patients.length, color: '#F54E25' },
    { label: 'Admissions', value: pendingAdmissions.length, color: '#EA580C' },
    { label: 'Discharges', value: pendingDischarges.length, color: '#2B31ED' },
    {
      label: 'Avg Progress',
      value: patients.length
        ? Math.round(patients.reduce((sum, p) => sum + (Number(p.progress) || 0), 0) / patients.length)
        : 0,
      color: '#16A34A',
    },
    { label: 'Reports', value: reportsReceivedCount, color: '#7C3AED' },
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
      label: 'Avg Recovery Progress',
      value: `${averageProgress}%`,
      note:
        averageProgress >= 70 ? 'Strong recovery trend' : averageProgress >= 40 ? 'Steady recovery' : 'Needs support focus',
      color: '#16A34A',
    },
    {
      label: 'Report Coverage',
      value: `${reportCoverageRate}%`,
      note: 'Submitted nurse reports versus expected weekly slots',
      color: '#7C3AED',
    },
    {
      label: 'Admission Pressure',
      value: String(pendingAdmissions.length),
      note: pendingAdmissions.length ? 'Follow up with admin review' : 'No pending admissions',
      color: '#EA580C',
    },
  ];
  const highestMetric = summaryGraphData.reduce(
    (max, item) => ((Number(item.value) || 0) > (Number(max.value) || 0) ? item : max),
    summaryGraphData[0] || { label: 'Patients', value: 0, color: '#F54E25' }
  );

  const resolveRequestPatientName = (row: PendingAdmission | PendingDischarge) => {
    const directName = row.patientName || row.patient_name || '';
    if (directName && String(directName).trim() && String(directName).trim().toLowerCase() !== 'patient') {
      return directName;
    }
    const pid = (row as PendingDischarge).patientId;
    if (pid) {
      const match = patients.find((p) => String(p.id) === String(pid));
      if (match?.name) return match.name;
    }
    return 'Unknown';
  };

  const requestTableRows = [
    ...pendingAdmissions.map((row) => ({
      type: 'Admission' as const,
      name: resolveRequestPatientName(row),
      status: row?.status || 'Pending',
    })),
    ...pendingDischarges.map((row) => ({
      type: 'Discharge' as const,
      name: resolveRequestPatientName(row),
      status: row?.status || 'Pending',
    })),
  ].slice(0, 8);

  const patientReportCount = (patientId: string) =>
    Object.keys(nurseWeeklyByPatient[String(patientId)] || {}).length;

  const patientTableRows = patients.slice(0, 8);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: BG }]}>
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

      <View style={styles.mobileTopBar}>
        <KalingaLogoMark size={44} />
        <View style={styles.mobileTopBarRight}>
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
        <View style={styles.panelCard}>
          <View style={styles.quickActionsHeaderRow}>
            <Text style={styles.quickActionsTitle}>
              <Text style={styles.quickActionsTitleNavy}>Quick </Text>
              <Text style={styles.quickActionsTitleOrange}>Actions</Text>
            </Text>
            <Text style={styles.quickActionsCaption} numberOfLines={2}>
              Start with your most-used tools
            </Text>
          </View>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.navigate(TAB_ROUTES.reports)}
            activeOpacity={0.9}
          >
            <View style={styles.iconSquare}>
              <Ionicons name="document-text" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.actionMain}>
              <Text style={styles.actionTitle}>Weekly Report</Text>
              <Text style={styles.actionSubtitle}>Review submitted weekly care updates</Text>
              <View style={[styles.actionBadge, { backgroundColor: '#FFF1EB' }]}>
                <Text style={[styles.actionBadgeText, { color: '#C2410C' }]}>{reportsReceivedCount} received</Text>
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
              <Text style={styles.actionSubtitle}>Open billing, inclusions, and support details</Text>
              <View style={[styles.actionBadge, { backgroundColor: '#EEF2FF' }]}>
                <Text style={[styles.actionBadgeText, { color: '#3730A3' }]}>Care resources</Text>
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
              <Text style={styles.actionSubtitle}>Submit new admission request forms</Text>
              <View style={[styles.actionBadge, { backgroundColor: '#FEF3C7' }]}>
                <Text style={[styles.actionBadgeText, { color: '#92400E' }]}>
                  {pendingAdmissions.length} pending
                </Text>
              </View>
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
              <Text style={styles.panelTitleInline}>Patient Snapshot</Text>
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
            requestTableRows.map((r, idx) => (
              <View key={`${r.type}-${r.name}-${idx}`} style={styles.reqRow}>
                <Text style={styles.reqType}>{r.type}</Text>
                <Text style={styles.reqName} numberOfLines={1}>
                  {r.name}
                </Text>
                <View style={styles.reqPill}>
                  <Text style={styles.reqPillText}>{String(r.status || 'pending').toLowerCase()}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={[styles.panelCard, { marginTop: 14 }]}>
          <View style={styles.tableHeadLeft}>
            <Ionicons name="bar-chart" size={16} color="#F54E25" />
            <Text style={styles.panelTitleInline}>Dashboard Highlights</Text>
          </View>
          <View style={styles.highlightsGrid}>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>Active Patients</Text>
              <Text style={styles.overviewValue}>{patients.length}</Text>
              <Text style={styles.overviewSub}>Currently under care</Text>
            </View>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>Pending Requests</Text>
              <Text style={styles.overviewValue}>{totalPendingRequests}</Text>
              <Text style={styles.overviewSub}>Admissions and discharges</Text>
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
              <TouchableOpacity style={styles.openBtnOrange} onPress={() => router.navigate(TAB_ROUTES.reports)}>
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
              <Text style={styles.cleanTitle}>Messages</Text>
              <TouchableOpacity style={styles.openBtnGreen} onPress={() => router.navigate(TAB_ROUTES.messages)}>
                <Text style={styles.openBtnText}>Open</Text>
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

        <Text style={styles.welcomeFoot} accessibilityElementsHidden>
          Welcome back, {firstName}
        </Text>
      </ScrollView>

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
    backgroundColor: '#F54E25',
    alignItems: 'center',
    justifyContent: 'center',
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
  scrollContent: { paddingHorizontal: isCompactScreen ? 14 : 18, paddingTop: 12 },
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
  },
  quickActionsTitle: { flexShrink: 1 },
  quickActionsTitleNavy: { fontSize: isCompactScreen ? 22 : 26, fontWeight: '800', color: '#1B2559' },
  quickActionsTitleOrange: { fontSize: isCompactScreen ? 22 : 26, fontWeight: '800', color: '#F54E25' },
  quickActionsCaption: { maxWidth: width * 0.42, fontSize: 12, fontWeight: '600', color: '#64748B', textAlign: 'right' },
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
  actionTitle: { fontSize: 15, fontWeight: '800', color: '#1B2559' },
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
  tableProgressFill: { height: '100%', backgroundColor: '#4318FF', borderRadius: 8 },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  reqType: { width: 72, fontSize: 12, fontWeight: '800', color: '#3758D5' },
  reqName: { flex: 1, fontSize: 13, fontWeight: '700', color: '#1B2559' },
  reqPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  reqPillText: { fontSize: 10, fontWeight: '800', color: '#475569', textTransform: 'lowercase' },
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
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
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
  welcomeFoot: { textAlign: 'center', color: '#94A3B8', fontSize: 12, marginTop: 20, marginBottom: 8 },
});
