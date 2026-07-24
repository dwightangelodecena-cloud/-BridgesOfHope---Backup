import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  ActivityIndicator,
  Dimensions,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TAB_ROUTES } from '../../lib/navigationConfig';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { uiPatientFromRow, type PatientRow } from '../../lib/patientMappers';
import { FamilyWebMobileNav } from '../../components/family/FamilyWebMobileNav';
import { KalingaLogoMark } from '../../components/family/KalingaLogoMark';
import { FamilyMobilePageHeader } from '../../components/family/FamilyMobilePageHeader';
import { useFamilyPageScroll } from '../../lib/useFamilyPageScroll';
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

// Native pixel size of assets/images/reports-header.png — sets the hero's
// aspect ratio so the full illustration renders with no crop.
const HERO_IMG_NATURAL_W = 1774;
const HERO_IMG_NATURAL_H = 887;

const PATIENT_AVATAR_PALETTE = [
  { bg: '#E0E7FF', color: '#4338CA' },
  { bg: '#E0E7FF', color: '#4338CA' },
  { bg: '#FFE4D6', color: '#C2410C' },
  { bg: '#F3E8FF', color: '#7E22CE' },
] as const;

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
  caption,
  icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string | number;
  caption: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconBg: string;
  iconColor: string;
}) {
  return (
    <View style={styles.rptStatCard}>
      <View style={[styles.rptStatIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <Text style={styles.rptStatLbl} numberOfLines={2}>
        {label}
      </Text>
      <Text style={styles.rptStatVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      <Text style={styles.rptStatCaption} numberOfLines={2}>
        {caption}
      </Text>
    </View>
  );
}

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const { scrollRef, scrollToTop } = useFamilyPageScroll();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const heroHeight = screenWidth * (HERO_IMG_NATURAL_H / HERO_IMG_NATURAL_W);
  const [showNotifications, setShowNotifications] = useState(false);
  const [familyUserId, setFamilyUserId] = useState('');
    const [userInitials, setUserInitials] = useState('FU');
  const [selectedWeek, setSelectedWeek] = useState<string>('all');
  const [patients, setPatients] = useState<PatientCard[]>([]);
  const [weeklyReportsByPatient, setWeeklyReportsByPatient] = useState<Record<string, ReportRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientCard | null>(null);
  const [selectedReportId, setSelectedReportId] = useState('');
  const [weekMenuOpen, setWeekMenuOpen] = useState(false);
  const [weekMenuPos, setWeekMenuPos] = useState({ top: 0, right: 16 });
  const weekBtnRef = useRef<View>(null);

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

  const openWeekMenu = () => {
    weekBtnRef.current?.measureInWindow((x, y, width, height) => {
      setWeekMenuPos({ top: y + height + 6, right: Math.max(16, screenWidth - (x + width)) });
      setWeekMenuOpen(true);
    });
  };

  const weekLabel = selectedWeek === 'all' ? 'All weeks' : `Week ${selectedWeek}`;

  return (
    <View style={[styles.screen, { backgroundColor: '#F0F4FF' }]}>
      <FamilyMobilePageHeader title="Weekly Reports" onBrandPress={scrollToTop} />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, { paddingTop: 0, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroWrap, { height: heroHeight }]}>
          <Image
            source={require('../../assets/images/reports-header.png')}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>Patient Weekly Reports</Text>
            <Text style={styles.heroSub}>Select a resident to view their full report history and care updates.</Text>
          </View>
        </View>

        <View style={styles.statGrid}>
          <ReportStatCard
            label="Residents"
            value={patients.length}
            caption="Total Residents"
            icon="people"
            iconBg="#EEF2FF"
            iconColor="#6366F1"
          />
          <ReportStatCard
            label="Total Reports"
            value={totalReportsCount}
            caption="This Week"
            icon="document-text"
            iconBg="#ECFDF5"
            iconColor="#10B981"
          />
          <ReportStatCard
            label="With Reports"
            value={patientsWithReportsCount}
            caption="Residents"
            icon="checkmark-circle"
            iconBg="#FFF7ED"
            iconColor="#EA580C"
          />
          <ReportStatCard
            label="Avg Progress"
            value={`${avgProgress}%`}
            caption="Average Progress"
            icon="trending-up"
            iconBg="#EEF2FF"
            iconColor="#4F46E5"
          />
        </View>

        <View style={styles.noteCard}>
          <View style={styles.noteIconWrap}>
            <Ionicons name="information-circle-outline" size={20} color="#F54E25" />
          </View>
          <Text style={styles.noteText}>
            Patient lists and weekly report details live under{' '}
            <Text style={styles.noteTextStrong}>Patient Details</Text> and{' '}
            <Text style={styles.noteTextStrong}>Reports</Text> in the menu bar.
          </Text>
          <Ionicons name="stats-chart" size={22} color="#F54E25" style={styles.noteDecoIcon} />
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
            <Pressable ref={weekBtnRef} style={styles.weekMenuBtn} onPress={openWeekMenu}>
              <Ionicons name="calendar-outline" size={14} color="#1B2559" />
              <Text style={styles.weekMenuBtnTxt}>{weekLabel}</Text>
              <Ionicons name="chevron-down" size={14} color="#64748B" />
            </Pressable>
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
              const progress = Number(patient.progress) || 0;
              const statusCfg =
                progress >= 70
                  ? { label: 'Stable', bg: '#DCFCE7', color: '#166534' }
                  : progress >= 40
                    ? { label: 'Monitoring', bg: '#FEF3C7', color: '#92400E' }
                    : { label: 'Needs Attention', bg: '#FEE2E2', color: '#991B1B' };
              const avatar = PATIENT_AVATAR_PALETTE[pidx % PATIENT_AVATAR_PALETTE.length];
              return (
                <TouchableOpacity
                  key={`rp-${pidx}`}
                  style={styles.patientCardV2}
                  onPress={() => setSelectedPatient(patient)}
                  activeOpacity={0.9}
                >
                  <View style={styles.patientCardV2Top}>
                    <View style={[styles.patientAvatarCircle, { backgroundColor: avatar.bg }]}>
                      <Text style={[styles.patientCardV2Initials, { color: avatar.color }]}>
                        {deriveInitials(patient.name)}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.patientName} numberOfLines={1}>
                        {patient.name}
                      </Text>
                      <Text style={styles.patientMeta}>
                        Age {patient.age} · Admitted {patient.date || 'N/A'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                  </View>
                  <View style={styles.patientCardV2ProgRow}>
                    <View style={styles.patientCardV2Track}>
                      <LinearGradient
                        colors={['#6366F1', '#818CF8']}
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
                    <View style={styles.kpi}>
                      <Text style={styles.kpiTxt}>
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

      <Modal visible={weekMenuOpen} transparent animationType="fade" onRequestClose={() => setWeekMenuOpen(false)}>
        <Pressable style={styles.weekMenuBackdrop} onPress={() => setWeekMenuOpen(false)}>
          <View style={[styles.weekMenuCard, { top: weekMenuPos.top, right: weekMenuPos.right }]}>
            <Pressable
              style={[styles.weekMenuItem, selectedWeek === 'all' && styles.weekMenuItemOn]}
              onPress={() => {
                setSelectedWeek('all');
                setWeekMenuOpen(false);
              }}
            >
              <Text style={[styles.weekMenuItemTxt, selectedWeek === 'all' && styles.weekMenuItemTxtOn]}>All weeks</Text>
              {selectedWeek === 'all' ? <Ionicons name="checkmark" size={15} color="#F54E25" /> : null}
            </Pressable>
            {availableWeeks.map((w) => (
              <Pressable
                key={w}
                style={[styles.weekMenuItem, selectedWeek === String(w) && styles.weekMenuItemOn]}
                onPress={() => {
                  setSelectedWeek(String(w));
                  setWeekMenuOpen(false);
                }}
              >
                <Text style={[styles.weekMenuItemTxt, selectedWeek === String(w) && styles.weekMenuItemTxtOn]}>
                  Week {w}
                </Text>
                {selectedWeek === String(w) ? <Ionicons name="checkmark" size={15} color="#F54E25" /> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

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
              showsVerticalScrollIndicator={false}
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
  heroWrap: {
    marginHorizontal: -16,
    marginBottom: 0,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    justifyContent: 'center',
  },
  heroImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  heroTextWrap: { paddingHorizontal: 22, maxWidth: '68%', marginBottom: 28 },
  heroTitle: { fontSize: 21, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 },
  heroSub: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 6,
    lineHeight: 18,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
    marginTop: -18,
    marginBottom: 16,
    zIndex: 1,
  },
  rptStatCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(233, 237, 247, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 14,
      },
      android: { elevation: 4 },
    }),
  },
  rptStatIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  rptStatLbl: {
    fontSize: 8.5,
    color: '#94A3B8',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  rptStatVal: { fontSize: 19, fontWeight: '900', color: '#0F172A', marginTop: 4, letterSpacing: -0.4 },
  rptStatCaption: { fontSize: 8.5, fontWeight: '600', color: '#94A3B8', marginTop: 3 },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FFF1E8',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  noteIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#F54E25',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  noteText: { flex: 1, fontSize: 13, color: '#7C4A26', fontWeight: '600', lineHeight: 18 },
  noteTextStrong: { color: '#F54E25', fontWeight: '800' },
  noteDecoIcon: { flexShrink: 0 },
  panelHeadRow: { flexDirection: 'row', gap: 10, marginBottom: 16, alignItems: 'center' },
  panelHeadIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFF1EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekMenuBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#FFFFFF',
    flexShrink: 0,
  },
  weekMenuBtnTxt: { fontSize: 12.5, fontWeight: '700', color: '#1B2559' },
  weekMenuBackdrop: { flex: 1 },
  weekMenuCard: {
    position: 'absolute',
    minWidth: 150,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    paddingVertical: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 12,
  },
  weekMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  weekMenuItemOn: { backgroundColor: '#FFF7F4' },
  weekMenuItemTxt: { fontSize: 13, fontWeight: '600', color: '#334155' },
  weekMenuItemTxtOn: { color: '#F54E25', fontWeight: '800' },
  patientCardV2: {
    borderWidth: 1,
    borderColor: 'rgba(233, 237, 247, 0.9)',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    padding: 18,
    marginBottom: 12,
  },
  patientCardV2Top: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  patientAvatarCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
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
  panelSub: { fontSize: 13, color: '#64748B', fontWeight: '600', marginTop: 6 },
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
