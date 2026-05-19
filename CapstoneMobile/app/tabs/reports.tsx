import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TAB_ROUTES } from '../../lib/navigationConfig';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { uiPatientFromRow, type PatientRow } from '../../lib/patientMappers';
import { FamilyWebMobileNav } from '../../components/family/FamilyWebMobileNav';
import { FamilyFloatingChat } from '../../components/family/FamilyFloatingChat';
import { KalingaLogoMark } from '../../components/family/KalingaLogoMark';
import { FamilyMobilePageHeader } from '../../components/family/FamilyMobilePageHeader';
import { useFamilyUserMobile } from '../../lib/useFamilyUserMobile';
type PatientCard = {
  id: string;
  name: string;
  date: string;
  progress: number;
  age: string | number;
};

type ReportRow = Record<string, unknown>;

const REPORT_MODAL_MAX_H = Dimensions.get('window').height * 0.92;

function formatDate(iso: string | null | undefined) {
  if (!iso) return 'N/A';
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return 'N/A';
  }
}

function calculateAge(dob: string | null | undefined) {
  if (!dob) return 'N/A';
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return 'N/A';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age >= 0 ? age : 'N/A';
}

function deriveInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => (p[0] ? p[0].toUpperCase() : '')).join('') || 'FU';
}

function dedupeReportPatients(cards: PatientCard[]): PatientCard[] {
  const seen = new Set<string>();
  const out: PatientCard[] = [];
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const id = String(c.id ?? '').trim();
    const key = id || `rp-fallback-${i}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(id ? c : { ...c, id: key });
  }
  return out;
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
    <View style={styles.fieldCard}>
      <View style={styles.fieldCardHead}>
        <Ionicons name={icon} size={13} color="#F54E25" />
        <Text style={styles.fieldCardLbl}>{label}</Text>
      </View>
      <Text style={styles.fieldCardVal}>{value || '—'}</Text>
    </View>
  );
}

function ReportStatCard({
  label,
  value,
  icon,
  borderColor,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  borderColor: string;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <View style={[styles.rptStatCard, { borderColor }]}>
      <View style={[styles.rptStatIcon, { backgroundColor: iconBg, borderColor }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={styles.rptStatLbl}>{label}</Text>
      <Text style={styles.rptStatVal}>{value}</Text>
    </View>
  );
}

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [familyUserId, setFamilyUserId] = useState('');
    const [userInitials, setUserInitials] = useState('FU');
  const [firstName, setFirstName] = useState('Family');
  const [selectedWeek, setSelectedWeek] = useState<string>('all');
  const [patients, setPatients] = useState<PatientCard[]>([]);
  const [weeklyReportsByPatient, setWeeklyReportsByPatient] = useState<Record<string, ReportRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientCard | null>(null);
  const [selectedReportId, setSelectedReportId] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setLoading(true);
      setLoadError('');
      try {
        if (!isSupabaseConfigured()) {
          if (!cancelled) {
            setFamilyUserId('');
            setPatients([]);
            setWeeklyReportsByPatient({});
            setLoadError('Supabase is not configured.');
          }
          return;
        }
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData?.user) {
          if (!cancelled) {
            setFamilyUserId('');
            setPatients([]);
            setWeeklyReportsByPatient({});
            setLoadError('Please sign in to view reports.');
          }
          return;
        }
        const user = authData.user;
        if (!cancelled) setFamilyUserId(user.id);
        const displayName = (user.user_metadata?.full_name as string) || user.email || 'Family User';
        if (!cancelled) setFirstName(String(displayName).trim().split(/\s+/)[0] || 'Family');

        const { data: patientRows, error: patientErr } = await supabase
          .from('patients')
          .select('id, full_name, admitted_at, progress_percent, clinical_status, family_id, discharged_at, date_of_birth')
          .eq('family_id', user.id)
          .is('discharged_at', null)
          .order('admitted_at', { ascending: false });

        if (patientErr) throw patientErr;
        let rows = patientRows || [];

        if (!rows.length) {
          const { data: admissionRows } = await supabase
            .from('admission_requests')
            .select('id, patient_name, patient_birth_date, reason_for_admission, status, created_at, decided_at')
            .eq('family_id', user.id)
            .eq('status', 'approved')
            .order('decided_at', { ascending: false });

          rows = (admissionRows || []).map((r: Record<string, unknown>) => ({
            id: r.id,
            full_name: r.patient_name,
            admitted_at: r.decided_at || r.created_at,
            progress_percent: 0,
            clinical_status: 'Recovering',
            family_id: user.id,
            discharged_at: null,
            date_of_birth: r.patient_birth_date,
          })) as typeof rows;
        }

        const mappedPatients: PatientCard[] = dedupeReportPatients(
          rows.map((row: Record<string, unknown>) => {
            const mapped = uiPatientFromRow(row as unknown as PatientRow);
            return {
              id: String(mapped?.id || row.id),
              name: mapped?.name || String(row.full_name || 'Resident'),
              date: mapped?.date || formatDate(row.admitted_at as string),
              progress: mapped?.progress ?? 0,
              age: calculateAge(row.date_of_birth as string),
            };
          })
        );

        const ids = mappedPatients.map((p) => p.id).filter(Boolean);
        const byPatient: Record<string, ReportRow[]> = {};
        if (ids.length) {
          const direct = await supabase
            .from('weekly_reports')
            .select('*')
            .in('patient_id', ids)
            .order('week_number', { ascending: true });
          let reportRows = direct.data || null;
          const reportErr = direct.error || null;
          if (reportErr || !(reportRows || []).length) {
            const rpcReports = await supabase.rpc('bh_family_weekly_reports');
            if (!rpcReports.error && rpcReports.data) {
              const idSet = new Set(ids.map((x) => String(x)));
              reportRows = (rpcReports.data as ReportRow[]).filter((row) => idSet.has(String(row.patient_id)));
            }
          }
          if (reportRows) {
            const seenReport = new Set<string>();
            for (const row of reportRows) {
              const rec = row as ReportRow;
              const key = String(rec.patient_id);
              const rid = String(rec.id ?? '');
              if (rid && seenReport.has(`${key}:${rid}`)) continue;
              if (rid) seenReport.add(`${key}:${rid}`);
              if (!byPatient[key]) byPatient[key] = [];
              byPatient[key].push(rec);
            }
          }
        }

        if (!cancelled) {
          setPatients(mappedPatients);
          setWeeklyReportsByPatient(byPatient);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setFamilyUserId('');
          setPatients([]);
          setWeeklyReportsByPatient({});
          setLoadError(e instanceof Error ? e.message : 'Unable to load reports right now.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

    const allReports = useMemo(
    () => Object.values(weeklyReportsByPatient || {}).flat().filter(Boolean),
    [weeklyReportsByPatient]
  );

  const availableWeeks = useMemo(() => {
    const set = new Set<number>();
    for (const row of allReports) {
      const w = row.week_number;
      if (w !== null && w !== undefined && w !== '') {
        const n = Number(w);
        if (!Number.isNaN(n)) set.add(n);
      }
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [allReports]);

  const selectedPatientReports = useMemo(() => {
    if (!selectedPatient) return [];
    const rows = weeklyReportsByPatient[String(selectedPatient.id)] || [];
    return [...rows].sort((a, b) => {
      const aw = Number(a.week_number) || 0;
      const bw = Number(b.week_number) || 0;
      if (aw !== bw) return bw - aw;
      return new Date(String(b.created_at || 0)).getTime() - new Date(String(a.created_at || 0)).getTime();
    });
  }, [selectedPatient, weeklyReportsByPatient]);

  const visibleReports = useMemo(() => {
    if (selectedWeek === 'all') return selectedPatientReports;
    return selectedPatientReports.filter((r) => String(r.week_number) === String(selectedWeek));
  }, [selectedPatientReports, selectedWeek]);

  const weeklyReport =
    visibleReports.find((r) => String(r.id) === String(selectedReportId)) || visibleReports[0] || null;

  useEffect(() => {
    if (!selectedPatient) {
      setSelectedReportId('');
      return;
    }
    const next = visibleReports[0];
    setSelectedReportId(next?.id ? String(next.id) : '');
  }, [selectedPatient, selectedWeek, visibleReports]);

  const totalReportsCount = allReports.length;
  const avgProgress = useMemo(
    () =>
      patients.length
        ? Math.round(patients.reduce((s, p) => s + (Number(p.progress) || 0), 0) / patients.length)
        : 0,
    [patients]
  );
  const patientsWithReportsCount = useMemo(
    () => patients.filter((p) => (weeklyReportsByPatient[String(p.id)] || []).length > 0).length,
    [patients, weeklyReportsByPatient]
  );

  return (
    <View style={[styles.screen, { backgroundColor: '#F0F4FF' }]}>
      <FamilyMobilePageHeader title="Weekly Reports" showLogo={false} />

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}>
        <Text style={styles.welcome}>Welcome Back, {firstName}</Text>

        <LinearGradient
          colors={['#0F172A', '#1E2D4F', '#2D1B69']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          <View style={styles.heroKickerRow}>
            <View style={styles.heroIconBox}>
              <Ionicons name="bar-chart" size={16} color="#FFFFFF" />
            </View>
            <Text style={styles.heroKicker}>Family Portal · Weekly Reports</Text>
          </View>
          <Text style={styles.heroTitle}>Patient Weekly Reports</Text>
          <Text style={styles.heroSub}>Select a resident to view their full report history and care updates</Text>
        </LinearGradient>

        <View style={styles.statGrid}>
          <ReportStatCard
            label="Residents"
            value={patients.length}
            icon="people"
            borderColor="#C7D2FE"
            iconBg="#EEF2FF"
            iconColor="#6366F1"
          />
          <ReportStatCard
            label="Total Reports"
            value={totalReportsCount}
            icon="document-text"
            borderColor="#A7F3D0"
            iconBg="#ECFDF5"
            iconColor="#10B981"
          />
          <ReportStatCard
            label="With Reports"
            value={patientsWithReportsCount}
            icon="checkmark-circle"
            borderColor="#DDD6FE"
            iconBg="#F5F3FF"
            iconColor="#8B5CF6"
          />
          <ReportStatCard
            label="Avg Progress"
            value={`${avgProgress}%`}
            icon="trending-up"
            borderColor="#FDE68A"
            iconBg="#FFFBEB"
            iconColor="#F59E0B"
          />
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeadRow}>
            <View style={styles.panelHeadIcon}>
              <Ionicons name="people" size={14} color="#F54E25" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.panelTitle}>Select a Resident</Text>
              <Text style={styles.panelSub}>
                Tap a card to open that resident&apos;s full report history.
              </Text>
            </View>
          </View>

          <View style={styles.toolbar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weekScroll}>
              <TouchableOpacity
                style={[styles.weekChip, selectedWeek === 'all' && styles.weekChipOn]}
                onPress={() => setSelectedWeek('all')}
              >
                <Text style={[styles.weekChipTxt, selectedWeek === 'all' && styles.weekChipTxtOn]}>All weeks</Text>
              </TouchableOpacity>
              {availableWeeks.map((w) => (
                <TouchableOpacity
                  key={w}
                  style={[styles.weekChip, selectedWeek === String(w) && styles.weekChipOn]}
                  onPress={() => setSelectedWeek(String(w))}
                >
                  <Text style={[styles.weekChipTxt, selectedWeek === String(w) && styles.weekChipTxtOn]}>Week {w}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#F54E25" />
              <Text style={styles.muted}>Loading live reports…</Text>
            </View>
          ) : null}
          {loadError ? <Text style={styles.err}>{loadError}</Text> : null}

          {!loading && !patients.length ? (
            <Text style={styles.empty}>No assigned patients found yet for this account.</Text>
          ) : (
            patients.map((patient, pidx) => {
              const reportCount = (weeklyReportsByPatient[String(patient.id)] || []).length;
              const active = selectedPatient && String(selectedPatient.id) === String(patient.id);
              const progress = Number(patient.progress) || 0;
              const statusCfg =
                progress >= 70
                  ? { label: 'Stable', bg: '#DCFCE7', color: '#166534' }
                  : progress >= 40
                    ? { label: 'Recovering', bg: '#FEF3C7', color: '#92400E' }
                    : { label: 'Needs Attention', bg: '#FEE2E2', color: '#991B1B' };
              return (
                <TouchableOpacity
                  key={`rp-${pidx}`}
                  style={[styles.patientCardV2, active && styles.patientCardV2On]}
                  onPress={() => setSelectedPatient(patient)}
                  activeOpacity={0.9}
                >
                  <View style={styles.patientCardV2Top}>
                    <LinearGradient
                      colors={active ? ['#F54E25', '#EA580C'] : ['#EEF2FF', '#C7D2FE']}
                      style={styles.patientCardV2Avatar}
                    >
                      <Text style={[styles.patientCardV2Initials, active && { color: '#FFFFFF' }]}>
                        {deriveInitials(patient.name)}
                      </Text>
                    </LinearGradient>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.patientName} numberOfLines={1}>
                        {patient.name}
                      </Text>
                      <Text style={styles.patientMeta}>
                        Age {patient.age} · Admitted {patient.date || 'N/A'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.patientCardV2ProgRow}>
                    <View style={styles.patientCardV2Track}>
                      <LinearGradient
                        colors={active ? ['#F54E25', '#EA580C'] : ['#6366F1', '#818CF8']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.patientCardV2Fill, { width: `${progress}%` }]}
                      />
                    </View>
                    <Text style={styles.patientCardV2Pct}>{progress}%</Text>
                  </View>
                  <View style={styles.patientCardV2Foot}>
                    <View style={[styles.patientStatusPill, { backgroundColor: statusCfg.bg }]}>
                      <Text style={[styles.patientStatusPillTxt, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                    </View>
                    <View style={[styles.kpi, active && { backgroundColor: '#FFF7ED' }]}>
                      <Text style={[styles.kpiTxt, active && { color: '#C2410C' }]}>
                        {reportCount} report{reportCount === 1 ? '' : 's'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal visible={!!selectedPatient} transparent animationType="fade" onRequestClose={() => setSelectedPatient(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedPatient(null)}>
          <Pressable
            style={[styles.modalCard, { maxHeight: REPORT_MODAL_MAX_H }]}
            onPress={(e) => e.stopPropagation()}
          >
            <LinearGradient
              colors={['#0F172A', '#1E2D4F']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalHeaderGradient}
            >
              <View style={styles.modalHeaderTop}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.modalKickerLight}>Care Updates · Bridges of Hope</Text>
                  <Text style={styles.modalTitleLight} numberOfLines={2}>
                    <Text style={styles.modalTitleAccentLight}>
                      {selectedWeek === 'all' ? 'Full Report History' : `Week ${selectedWeek}`}
                    </Text>
                    {selectedPatient ? ` — ${selectedPatient.name}` : ''}
                  </Text>
                  <Text style={styles.modalSubLight}>
                    {visibleReports.length} report{visibleReports.length === 1 ? '' : 's'} · Progress:{' '}
                    {selectedPatient ? Number(selectedPatient.progress) || 0 : 0}%
                  </Text>
                  {selectedPatient ? (
                    <View style={styles.modalHeaderTrack}>
                      <LinearGradient
                        colors={['#6EE7B7', '#34D399']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[
                          styles.modalHeaderFill,
                          { width: `${Math.min(100, Math.max(0, Number(selectedPatient.progress) || 0))}%` },
                        ]}
                      />
                    </View>
                  ) : null}
                </View>
                <TouchableOpacity onPress={() => setSelectedPatient(null)} accessibilityLabel="Close" hitSlop={12}>
                  <Ionicons name="close" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </LinearGradient>
            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={styles.modalBodyContent}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.historyTitle}>Report history</Text>
              {!visibleReports.length ? (
                <Text style={styles.muted}>No reports available for this filter.</Text>
              ) : (
                visibleReports.map((row, hidx) => (
                  <TouchableOpacity
                    key={`h-${hidx}-${String(row.id ?? row.week_number ?? '')}`}
                    style={[styles.historyBtn, String(selectedReportId) === String(row.id) && styles.historyBtnOn]}
                    onPress={() => setSelectedReportId(String(row.id))}
                  >
                    <View style={styles.historyBtnHead}>
                      <Text style={styles.historyWeek}>Week {String(row.week_number ?? '—')}</Text>
                      {String(selectedReportId) === String(row.id) ? (
                        <View style={styles.historyDot} />
                      ) : null}
                    </View>
                    <Text style={styles.historyMeta}>{formatDate(String(row.submitted_at || row.created_at))}</Text>
                    {row.progress_percent != null ? (
                      <View style={styles.historyMiniTrack}>
                        <LinearGradient
                          colors={['#F54E25', '#EA580C']}
                          style={[
                            styles.historyMiniFill,
                            { width: `${Math.min(100, Math.max(0, Number(row.progress_percent) || 0))}%` },
                          ]}
                        />
                      </View>
                    ) : null}
                  </TouchableOpacity>
                ))
              )}
              {weeklyReport ? (
                <>
                  <Text style={styles.detailIntro}>
                    Week {String(weeklyReport.week_number ?? '—')} ·{' '}
                    {formatDate(String(weeklyReport.submitted_at || weeklyReport.created_at))}
                  </Text>
                  {selectedPatient ? (
                    <Text style={styles.detailPatientName}>{selectedPatient.name}</Text>
                  ) : null}
                  {weeklyReport.progress_percent != null ? (
                    <View style={styles.detailProgRow}>
                      <View style={styles.detailProgTrack}>
                        <LinearGradient
                          colors={['#F54E25', '#EA580C']}
                          style={[
                            styles.detailProgFill,
                            {
                              width: `${Math.min(100, Math.max(0, Number(weeklyReport.progress_percent) || 0))}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.detailProgPct}>{String(weeklyReport.progress_percent)}%</Text>
                    </View>
                  ) : null}
                  <View style={styles.fieldGrid}>
                    <ReportFieldCard
                      label="Summary"
                      value={String(weeklyReport?.summary || weeklyReport?.report_summary || 'No report available.')}
                      icon="reader"
                    />
                    <ReportFieldCard
                      label="Progress"
                      value={
                        weeklyReport?.progress_percent !== undefined && weeklyReport?.progress_percent !== null
                          ? `${weeklyReport.progress_percent}%`
                          : 'N/A'
                      }
                      icon="stats-chart"
                    />
                    <ReportFieldCard
                      label="Nurse notes"
                      value={String(weeklyReport?.nurse_note || weeklyReport?.notes || 'No notes available.')}
                      icon="document-text"
                    />
                    <ReportFieldCard
                      label="Behavior / mood"
                      value={String(
                        weeklyReport?.behavior_observation ||
                          weeklyReport?.mood_assessment ||
                          'No behavior notes recorded.'
                      )}
                      icon="heart"
                    />
                    <ReportFieldCard
                      label="Recommendations"
                      value={String(
                        weeklyReport?.recommendations ||
                          weeklyReport?.plan_next_week ||
                          'No recommendations recorded.'
                      )}
                      icon="checkmark-circle"
                    />
                    <ReportFieldCard
                      label="Current medications"
                      value={String(weeklyReport?.current_medications || 'None listed.')}
                      icon="flask"
                    />
                    <ReportFieldCard
                      label="Medication intervention"
                      value={String(weeklyReport?.medication_intervention || 'None listed.')}
                      icon="shield-checkmark"
                    />
                    <ReportFieldCard
                      label="Submitted"
                      value={formatDate(String(weeklyReport?.submitted_at || weeklyReport?.created_at))}
                      icon="calendar"
                    />
                  </View>
                </>
              ) : (
                <Text style={styles.muted}>Select a report above to view details.</Text>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <FamilyWebMobileNav active="reports" />
      <FamilyFloatingChat />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    minHeight: 56,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F1',
  },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: '#1B2559' },
  topRight: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  circleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F54E25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  notifRoot: { flex: 1 },
  notifBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  notifPanel: {
    position: 'absolute',
    width: 300,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    padding: 16,
    elevation: 10,
  },
  notifTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  notifTitle: { fontSize: 15, fontWeight: '800', color: '#1B2559' },
  notifRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  notifText: { flex: 1, fontSize: 13, color: '#334155' },
  notifDismiss: { fontSize: 18, lineHeight: 18, color: '#94A3B8', fontWeight: '700', paddingHorizontal: 2 },
  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  welcome: { fontSize: 14, fontWeight: '600', color: '#1B2559', marginBottom: 12 },
  heroBanner: { borderRadius: 24, padding: 22, marginBottom: 12, overflow: 'hidden' },
  heroKickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  heroIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroKicker: {
    flex: 1,
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroTitle: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6, lineHeight: 18 },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  rptStatCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 4,
  },
  rptStatIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 12,
  },
  rptStatLbl: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  rptStatVal: { fontSize: 26, fontWeight: '900', color: '#0F172A', marginTop: 5 },
  panelHeadRow: { flexDirection: 'row', gap: 10, marginBottom: 14, alignItems: 'flex-start' },
  panelHeadIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFF1EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientCardV2: {
    borderWidth: 2,
    borderColor: '#E9EDF7',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    padding: 18,
    marginBottom: 12,
  },
  patientCardV2On: { borderColor: '#F54E25', backgroundColor: '#FFFBFA' },
  patientCardV2Top: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  patientCardV2Avatar: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  patientCardV2Initials: { fontSize: 16, fontWeight: '900', color: '#4338CA' },
  patientCardV2ProgRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  patientCardV2Track: {
    flex: 1,
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    overflow: 'hidden',
  },
  patientCardV2Fill: { height: '100%', borderRadius: 999 },
  patientCardV2Pct: { fontSize: 11, fontWeight: '800', color: '#0F172A' },
  patientCardV2Foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  patientStatusPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  patientStatusPillTxt: { fontSize: 10, fontWeight: '800' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  modalHeaderGradient: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 16 },
  modalHeaderTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  modalKickerLight: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  modalTitleLight: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.3 },
  modalTitleAccentLight: { color: '#FDA4AF', fontWeight: '900' },
  modalSubLight: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6 },
  modalHeaderTrack: {
    marginTop: 12,
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    overflow: 'hidden',
    maxWidth: 400,
    alignSelf: 'stretch',
  },
  modalHeaderFill: { height: '100%', borderRadius: 999 },
  historyBtnHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F54E25' },
  historyMiniTrack: {
    marginTop: 8,
    height: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    overflow: 'hidden',
  },
  historyMiniFill: { height: '100%', borderRadius: 999 },
  detailIntro: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 8,
  },
  detailPatientName: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginTop: 4 },
  detailProgRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  detailProgTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    overflow: 'hidden',
  },
  detailProgFill: { height: '100%', borderRadius: 999 },
  detailProgPct: { fontSize: 12, fontWeight: '900', color: '#F54E25' },
  fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 14 },
  fieldCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9EDF7',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
  },
  fieldCardHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  fieldCardLbl: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    flex: 1,
  },
  fieldCardVal: { fontSize: 13, fontWeight: '700', color: '#0F172A', lineHeight: 20 },
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    padding: 16,
  },
  panelTitle: { fontSize: 18, fontWeight: '800', color: '#1B2559' },
  panelSub: { fontSize: 13, color: '#64748B', fontWeight: '600', marginTop: 6, marginBottom: 12 },
  toolbar: { marginBottom: 8 },
  weekScroll: { maxHeight: 40 },
  weekChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
    backgroundColor: '#FFFFFF',
  },
  weekChipOn: { borderColor: '#F54E25', backgroundColor: '#FFF7F4' },
  weekChipTxt: { fontSize: 12, fontWeight: '700', color: '#1B2559' },
  weekChipTxtOn: { color: '#F54E25' },
  muted: { color: '#64748B', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  err: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '700',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  empty: { textAlign: 'center', color: '#64748B', fontWeight: '700', paddingVertical: 20 },
  patientBtn: {
    borderWidth: 1,
    borderColor: '#E9EDF7',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    padding: 14,
    marginBottom: 10,
  },
  patientBtnOn: { borderColor: '#F54E25', backgroundColor: '#FFF7F4' },
  patientName: { fontSize: 16, fontWeight: '800', color: '#1B2559', marginBottom: 6 },
  patientMeta: { fontSize: 12, color: '#64748B', fontWeight: '600', marginBottom: 2 },
  kpi: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: '#EEF4FF' },
  kpiTxt: { fontSize: 10, fontWeight: '800', color: '#3758D5' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    flexGrow: 1,
    flexShrink: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8eaef',
    overflow: 'hidden',
    borderTopWidth: 3,
    borderTopColor: '#F54E25',
  },
  modalHeader: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0e8e4',
    backgroundColor: '#fffdfb',
  },
  kicker: { fontSize: 11, fontWeight: '600', color: '#c2410c', textTransform: 'uppercase', letterSpacing: 0.5 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a', marginTop: 4 },
  modalTitleAccent: { color: '#F54E25', fontWeight: '700' },
  modalDesc: { fontSize: 13, color: '#64748b', marginTop: 8, lineHeight: 20 },
  modalBody: { flexGrow: 1, flexShrink: 1, backgroundColor: '#f9f9fb' },
  modalBodyContent: { padding: 14, paddingBottom: 28 },
  historyTitle: { fontSize: 11, fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: 8 },
  historyBtn: {
    borderWidth: 1,
    borderColor: '#E6EDF9',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  historyBtnOn: { borderColor: '#F54E25', backgroundColor: '#FFF7F4' },
  historyWeek: { fontSize: 13, fontWeight: '800', color: '#1B2559' },
  historyMeta: { fontSize: 11, color: '#64748B', fontWeight: '600', marginTop: 3 },
  detailBlock: { marginTop: 12 },
  lbl: { fontSize: 12, color: '#475569', fontWeight: '700', marginTop: 10, marginBottom: 4 },
  val: { fontSize: 13, color: '#1B2559', fontWeight: '600', lineHeight: 20 },
});
