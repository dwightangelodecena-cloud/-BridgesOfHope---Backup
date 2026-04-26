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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TAB_ROUTES } from '../../lib/navigationConfig';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { uiPatientFromRow, type PatientRow } from '../../lib/patientMappers';
import { FamilyWebMobileNav } from '../../components/family/FamilyWebMobileNav';
import { FamilyFloatingChat } from '../../components/family/FamilyFloatingChat';
import { KalingaLogoMark } from '../../components/family/KalingaLogoMark';

type PatientCard = {
  id: string;
  name: string;
  date: string;
  progress: number;
  age: string | number;
};

type ReportRow = Record<string, unknown>;

const NOTIFICATION_ITEMS = [
  'Submit missing laboratory result before Friday.',
  'Family support session is scheduled on April 5, 10:00 AM.',
  'Weekly report reviewed by your assigned counselor.',
];

function deriveInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => (p[0] ? p[0].toUpperCase() : '')).join('') || 'FU';
}

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

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
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
            setPatients([]);
            setWeeklyReportsByPatient({});
            setLoadError('Supabase is not configured.');
          }
          return;
        }
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData?.user) {
          if (!cancelled) {
            setPatients([]);
            setWeeklyReportsByPatient({});
            setLoadError('Please sign in to view reports.');
          }
          return;
        }
        const user = authData.user;
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

        const mappedPatients: PatientCard[] = rows.map((row: Record<string, unknown>) => {
          const mapped = uiPatientFromRow(row as unknown as PatientRow);
          return {
            id: String(mapped?.id || row.id),
            name: mapped?.name || String(row.full_name || 'Patient'),
            date: mapped?.date || formatDate(row.admitted_at as string),
            progress: mapped?.progress ?? 0,
            age: calculateAge(row.date_of_birth as string),
          };
        });

        const ids = rows.map((r) => r.id).filter(Boolean);
        const byPatient: Record<string, ReportRow[]> = {};
        if (ids.length) {
          const { data: reportRows, error: reportErr } = await supabase
            .from('weekly_reports')
            .select('*')
            .in('patient_id', ids as string[])
            .order('week_number', { ascending: true });

          if (!reportErr && reportRows) {
            for (const row of reportRows) {
              const rec = row as ReportRow;
              const key = String(rec.patient_id);
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

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!isSupabaseConfigured()) return;
      try {
        const { data } = await supabase.auth.getUser();
        const u = data?.user;
        let resolved =
          (u?.user_metadata?.full_name as string | undefined)?.trim() ||
          [u?.user_metadata?.first_name, u?.user_metadata?.last_name].filter(Boolean).join(' ').trim() ||
          'Family User';
        if (u?.id) {
          const { data: profileRow } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', u.id)
            .maybeSingle();
          if (profileRow?.full_name?.trim()) resolved = profileRow.full_name.trim();
        }
        if (mounted) setUserInitials(deriveInitials(resolved));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      mounted = false;
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

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: '#F8F9FD' }]}>
      <Modal visible={showNotifications} transparent animationType="fade" onRequestClose={() => setShowNotifications(false)}>
        <View style={styles.notifRoot}>
          <Pressable style={styles.notifBackdrop} onPress={() => setShowNotifications(false)} />
          <View style={[styles.notifPanel, { top: insets.top + 52, right: 16 }]}>
            <View style={styles.notifTitleRow}>
              <Ionicons name="notifications" size={16} color="#F54E25" />
              <Text style={styles.notifTitle}>Notifications</Text>
            </View>
            {NOTIFICATION_ITEMS.map((t) => (
              <View key={t} style={styles.notifRow}>
                <Ionicons name="checkmark-circle" size={15} color="#2B31ED" />
                <Text style={styles.notifText}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
      </Modal>

      <View style={styles.topBar}>
        <KalingaLogoMark size={44} />
        <Text style={styles.topTitle}>Reports</Text>
        <View style={styles.topRight}>
          <TouchableOpacity style={styles.circleBtn} onPress={() => setShowNotifications((v) => !v)}>
            <Ionicons name="notifications" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.circleBtn} onPress={() => router.navigate(TAB_ROUTES.profile)}>
            <Text style={styles.avatarTxt}>{userInitials}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}>
        <Text style={styles.welcome}>Welcome Back, {firstName}</Text>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Patient Weekly Reports</Text>
          <Text style={styles.panelSub}>View latest and past weekly reports from your patient records.</Text>
          <View style={styles.toolbar}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{allReports.length} total reports</Text>
            </View>
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

          {loading ? <Text style={styles.muted}>Loading live reports…</Text> : null}
          {loadError ? <Text style={styles.err}>{loadError}</Text> : null}

          {!loading && !patients.length ? (
            <Text style={styles.empty}>No assigned patients found yet for this account.</Text>
          ) : (
            patients.map((patient) => {
              const reportCount = (weeklyReportsByPatient[String(patient.id)] || []).length;
              const active = selectedPatient && String(selectedPatient.id) === String(patient.id);
              return (
                <TouchableOpacity
                  key={patient.id}
                  style={[styles.patientBtn, active && styles.patientBtnOn]}
                  onPress={() => setSelectedPatient(patient)}
                >
                  <Text style={styles.patientName}>{patient.name}</Text>
                  <Text style={styles.patientMeta}>Age: {patient.age}</Text>
                  <Text style={styles.patientMeta}>Admitted: {patient.date || 'N/A'}</Text>
                  <View style={styles.kpi}>
                    <Text style={styles.kpiTxt}>
                      {reportCount} report{reportCount === 1 ? '' : 's'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal visible={!!selectedPatient} transparent animationType="fade" onRequestClose={() => setSelectedPatient(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedPatient(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.kicker}>Care updates</Text>
                <Text style={styles.modalTitle}>
                  <Text style={styles.modalTitleAccent}>{selectedWeek === 'all' ? 'Latest' : `Week ${selectedWeek}`}</Text>{' '}
                  report
                </Text>
                <Text style={styles.modalDesc}>{selectedPatient?.name} — weekly patient report details.</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedPatient(null)} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} nestedScrollEnabled>
              <Text style={styles.historyTitle}>Past reports</Text>
              {!visibleReports.length ? (
                <Text style={styles.muted}>No reports available for this filter.</Text>
              ) : (
                visibleReports.map((row) => (
                  <TouchableOpacity
                    key={String(row.id)}
                    style={[styles.historyBtn, String(selectedReportId) === String(row.id) && styles.historyBtnOn]}
                    onPress={() => setSelectedReportId(String(row.id))}
                  >
                    <Text style={styles.historyWeek}>Week {String(row.week_number ?? '—')}</Text>
                    <Text style={styles.historyMeta}>{formatDate(String(row.submitted_at || row.created_at))}</Text>
                  </TouchableOpacity>
                ))
              )}
              <View style={styles.detailBlock}>
                <Text style={styles.lbl}>Summary</Text>
                <Text style={styles.val}>
                  {String(weeklyReport?.summary || weeklyReport?.report_summary || 'No report available for this week.')}
                </Text>
                <Text style={styles.lbl}>Progress</Text>
                <Text style={styles.val}>
                  {weeklyReport?.progress_percent !== undefined && weeklyReport?.progress_percent !== null
                    ? `${weeklyReport.progress_percent}%`
                    : 'N/A'}
                </Text>
                <Text style={styles.lbl}>Nurse notes</Text>
                <Text style={styles.val}>
                  {String(weeklyReport?.nurse_note || weeklyReport?.notes || 'No notes available.')}
                </Text>
                <Text style={styles.lbl}>Behavior / mood</Text>
                <Text style={styles.val}>
                  {String(
                    weeklyReport?.behavior_observation ||
                      weeklyReport?.mood_assessment ||
                      'No behavior notes recorded.'
                  )}
                </Text>
                <Text style={styles.lbl}>Recommendations</Text>
                <Text style={styles.val}>
                  {String(
                    weeklyReport?.recommendations || weeklyReport?.plan_next_week || 'No recommendations recorded.'
                  )}
                </Text>
                <Text style={styles.lbl}>Submitted</Text>
                <Text style={styles.val}>{formatDate(String(weeklyReport?.submitted_at || weeklyReport?.created_at))}</Text>
              </View>
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
  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  welcome: { fontSize: 14, fontWeight: '600', color: '#1B2559', marginBottom: 12 },
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
  chip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DCE7FF',
    backgroundColor: '#EEF4FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  chipText: { fontSize: 11, fontWeight: '800', color: '#3758D5' },
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
    maxHeight: '88%',
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
  modalBody: { padding: 14, backgroundColor: '#f9f9fb', maxHeight: 420 },
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
