import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
import { TAB_ROUTES } from '../../lib/navigationConfig';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { uiPatientFromRow, type PatientRow, type UIPatient } from '../../lib/patientMappers';
import { computeAdmissionDisplayId } from '../../lib/admissionDisplayId';
import { FamilyWebMobileNav } from '../../components/family/FamilyWebMobileNav';
import { FamilyMobilePageHeader } from '../../components/family/FamilyMobilePageHeader';
import { useFamilyPageScroll } from '../../lib/useFamilyPageScroll';
import {
  canonicalPatientId,
  fetchWeeklyReportsForPatientId,
  isSupabasePatientId,
  mergeReportsIntoByPatient,
  resolveWeeklyReportsForPatient,
} from '../../lib/familyWeeklyReportsMobile';
import {
  isPatientOnTemporaryLeave,
  mergePatientTemporaryDischargeFields,
  patientTemporaryDischargeStatusLabel,
} from '../../lib/dischargeRequestTypesMobile';
import {
  mergePatientWithRequestTemporaryLeave,
  syncPatientTemporaryLeaveFromRequests,
  type TemporaryLeaveFields,
} from '../../lib/temporaryLeaveSyncMobile';
import { returnResidentFromTemporaryLeave } from '../../lib/returnResidentFromTemporaryLeaveMobile';
import {
  ResidentReturnedConfirmModal,
  ResidentReturnedHeaderButton,
  TemporaryDischargeCardBanner,
  TemporaryDischargeNotePanel,
} from '../../components/family/TemporaryDischargeNoticeMobile';

const WINDOW_H = Dimensions.get('window').height;
const SCREEN_W = Dimensions.get('window').width;
const HEADER_BAR_HEIGHT = 56;
// Native pixel size of assets/images/residents-header.png — used to keep the
// hero crop anchored to its right edge (where the plant illustration is)
// instead of a symmetric center-crop that clips it off.
const HERO_IMG_NATURAL_W = 1298;
const HERO_IMG_NATURAL_H = 563;

type ReportRow = Record<string, unknown>;

type PatientListEntry = UIPatient & {
  dateOfBirth?: string;
  roomCode?: string;
  gender?: string;
};

function deriveInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => (p[0] ? p[0].toUpperCase() : '')).join('') || 'FU';
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'N/A';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'N/A';
  }
}

function calculateAge(dob: string | null | undefined): string | number {
  if (!dob) return 'N/A';
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return 'N/A';
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const m = now.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < date.getDate())) age -= 1;
  return age >= 0 ? age : 'N/A';
}

function patientStatusTone(progress: number) {
  const value = Number(progress) || 0;
  if (value >= 70) return { label: 'Stable', bg: '#DCFCE7', color: '#166534' };
  if (value >= 40) return { label: 'Recovering', bg: '#FEF3C7', color: '#92400E' };
  return { label: 'Needs Attention', bg: '#FEE2E2', color: '#991B1B' };
}

function reviewBarWidthFromLabel(value: string): `${number}%` {
  const n = Number.parseInt(String(value).replace('%', '').trim(), 10);
  const pct = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
  return `${pct}%`;
}

function toPercentOrZero(...values: unknown[]): number {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'number' && Number.isFinite(value)) return Math.min(100, Math.max(0, Math.round(value)));
    const parsed = Number.parseFloat(String(value).replace('%', '').trim());
    if (Number.isFinite(parsed)) return Math.min(100, Math.max(0, Math.round(parsed)));
  }
  return 0;
}

function patientSummaryPayload(
  patient: PatientListEntry | null,
  detail?: Record<string, unknown> | null,
  latestReport?: ReportRow | null
) {
  if (!patient) {
    return {
      status: 'Recovering',
      summary: '',
      goals: [] as string[],
      reviewRows: [] as { label: string; value: string; note: string }[],
    };
  }
  const value = Number(patient.progress) || 0;
  const adherence = toPercentOrZero(
    latestReport?.treatment_adherence,
    latestReport?.adherence_percent,
    detail?.treatment_adherence
  );
  const emotional = toPercentOrZero(
    latestReport?.emotional_stability,
    latestReport?.mood_stability_percent,
    detail?.emotional_stability
  );
  const physical = toPercentOrZero(
    latestReport?.physical_wellness,
    latestReport?.physical_wellness_percent,
    detail?.physical_wellness
  );
  return {
    status: patientStatusTone(value).label,
    summary:
      value >= 70
        ? 'Resident shows consistent recovery and strong response to the care plan.'
        : value >= 40
          ? 'Resident shows moderate progress and benefits from continued monitoring.'
          : 'Resident requires closer follow-up and additional recovery support.',
    goals: [
      'Maintain appointment attendance and family check-ins.',
      'Complete weekly counseling and progress documentation.',
      'Monitor medication and wellness adherence daily.',
    ],
    reviewRows: [
      { label: 'Treatment Adherence', value: `${adherence}%`, note: 'Based on latest care updates' },
      { label: 'Emotional Stability', value: `${emotional}%`, note: 'Counselor observations' },
      { label: 'Physical Wellness', value: `${physical}%`, note: 'Nurse wellness checks' },
    ],
  };
}

function resolveVital(reportVal: unknown, ...fallbacks: unknown[]): string {
  const first = [reportVal, ...fallbacks].find((v) => String(v ?? '').trim() !== '');
  return String(first ?? '').trim() || '—';
}

function uniqueById<T extends { id?: unknown }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const key = String(row?.id ?? '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/** One row per resident id so React keys and lookups stay stable (avoids duplicate-key crashes). */
function normalizeResidentList(list: PatientListEntry[]): PatientListEntry[] {
  const seen = new Set<string>();
  const out: PatientListEntry[] = [];
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const raw = String(p.id ?? '').trim();
    if (raw) {
      if (seen.has(raw)) continue;
      seen.add(raw);
      out.push(p);
      continue;
    }
    const synthetic = `synthetic-resident-${i}`;
    if (seen.has(synthetic)) continue;
    seen.add(synthetic);
    out.push({ ...p, id: synthetic });
  }
  return out;
}

function ProgressRing({ pct, size = 56, color }: { pct: number; size?: number; color: string }) {
  const p = Math.min(100, Math.max(0, Math.round(pct)));
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#EEF2FF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: color,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '900', color }}>{p}%</Text>
    </View>
  );
}

function StatMiniCard({
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
    <View style={styles.statCard}>
      <View style={[styles.statIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={19} color={iconColor} />
      </View>
      <Text style={styles.statCardValue}>{value}</Text>
      <Text style={styles.statCardLabel}>{label}</Text>
      <Text style={styles.statCardCaption}>{caption}</Text>
    </View>
  );
}

function MiniTableRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniRow}>
      <Text style={styles.miniTh}>{label}</Text>
      <Text style={styles.miniTd}>{value}</Text>
    </View>
  );
}

function DetailCardSection({
  children,
  onTemporaryLeave = false,
  temporaryPatient = null,
  temporaryLeaveRequestFields = null,
}: {
  children: React.ReactNode;
  onTemporaryLeave?: boolean;
  temporaryPatient?: Record<string, unknown> | null;
  temporaryLeaveRequestFields?: Record<string, unknown> | null;
}) {
  if (onTemporaryLeave) {
    return (
      <View style={[styles.detailCard, styles.detailCardWithLeaveBanner]}>
        <TemporaryDischargeCardBanner
          patient={temporaryPatient}
          variant="section"
          requestFields={temporaryLeaveRequestFields}
        />
        <View style={styles.detailCardBody}>{children}</View>
      </View>
    );
  }

  return <View style={styles.detailCard}>{children}</View>;
}

export default function PatientDetailsScreen() {
  const insets = useSafeAreaInsets();
  const { scrollRef, scrollToTop } = useFamilyPageScroll();
  const router = useRouter();
  const [familyUserId, setFamilyUserId] = useState('');
  const [patients, setPatients] = useState<PatientListEntry[]>([]);
  const [patientDetailsById, setPatientDetailsById] = useState<Record<string, Record<string, unknown>>>({});
  const [weeklyReportsByPatient, setWeeklyReportsByPatient] = useState<Record<string, ReportRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PatientListEntry | null>(null);
  const [temporaryLeaveFromRequest, setTemporaryLeaveFromRequest] = useState<TemporaryLeaveFields | null>(
    null
  );
  const [residentReturnBusy, setResidentReturnBusy] = useState(false);
  const [showResidentReturnConfirm, setShowResidentReturnConfirm] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setFamilyUserId('');
      setPatients([]);
      setPatientDetailsById({});
      setWeeklyReportsByPatient({});
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        setFamilyUserId('');
        setPatients([]);
        setPatientDetailsById({});
        setWeeklyReportsByPatient({});
        return;
      }

      setFamilyUserId(user.id);

      const safeSelect =
        'id, full_name, admitted_at, created_at, progress_percent, clinical_status, primary_concern, family_id, discharged_at, temporary_discharge_at, temporary_discharge_until, temporary_discharge_expected_return, temporary_leave_type, date_of_birth, gender, room_code, case_load_manager, program_staff, medical_staff_note';

      const mapApprovedAdmissionsToPatients = async (): Promise<{
        list: PatientListEntry[];
        details: Record<string, Record<string, unknown>>;
      }> => {
        const { data: admissions, error: admissionsError } = await supabase
          .from('admission_requests')
          .select('id, patient_name, patient_birth_date, reason_for_admission, status, created_at, decided_at')
          .eq('family_id', user.id)
          .eq('status', 'approved')
          .order('decided_at', { ascending: false });
        if (admissionsError || !(admissions || []).length) return { list: [], details: {} };
        const names = [...new Set((admissions || []).map((a) => (a.patient_name || '').trim()).filter(Boolean))];
        const detailsByName: Record<string, Record<string, unknown>> = {};
        if (names.length) {
          const { data: matchedRows } = await supabase
            .from('patients')
            .select('*')
            .in('full_name', names)
            .order('admitted_at', { ascending: false });
          (matchedRows || []).forEach((row) => {
            const key = String(row.full_name || '').trim().toLowerCase();
            if (key && !detailsByName[key]) detailsByName[key] = row as Record<string, unknown>;
          });
        }
        const list: PatientListEntry[] = (admissions || []).map((a) => {
          const name = a.patient_name || 'Approved Resident';
          const matched = detailsByName[String(name).trim().toLowerCase()] || null;
          const fromUi = matched ? uiPatientFromRow(matched as unknown as PatientRow) : null;
          const pid = fromUi?.id || `admission-${a.id}`;
          const base: UIPatient =
            fromUi ||
            ({
              id: pid,
              name,
              date: formatDate(a.decided_at || a.created_at),
              progress: 0,
              status: 'Recovering',
              reason: String(a.reason_for_admission || ''),
              family_id: user.id,
              admitted_at: (a.decided_at as string) || (a.created_at as string) || null,
              discharged_at: null,
            } as UIPatient);
          return {
            ...base,
            id: pid,
            name,
            date: fromUi?.date || formatDate(a.decided_at || a.created_at),
            progress: fromUi ? fromUi.progress : Number(matched?.progress_percent) || 0,
            status: fromUi?.status || String(matched?.clinical_status || 'Recovering'),
            reason: fromUi?.reason || String(a.reason_for_admission || ''),
            dateOfBirth: String(matched?.date_of_birth || a.patient_birth_date || ''),
            roomCode: String(matched?.room_code || ''),
            gender: String(matched?.gender || ''),
          };
        });
        const details: Record<string, Record<string, unknown>> = {};
        list.forEach((p) => {
          if (!String(p.id).startsWith('admission-')) {
            const m = detailsByName[String(p.name).trim().toLowerCase()];
            if (m) details[p.id] = m;
          }
        });
        return { list, details };
      };

      const fetchPatientsFromApprovedAdmissions = async (): Promise<Record<string, unknown>[]> => {
        const { data: admissions, error: admissionsError } = await supabase
          .from('admission_requests')
          .select('patient_name')
        .eq('family_id', user.id)
          .eq('status', 'approved');
        if (admissionsError || !(admissions || []).length) return [];
        const names = [...new Set((admissions || []).map((a) => (a.patient_name || '').trim()).filter(Boolean))];
        if (!names.length) return [];
        const { data: matchedRows, error: queryError } = await supabase
          .from('patients')
          .select(safeSelect)
          .in('full_name', names)
          .order('admitted_at', { ascending: false });
        if (queryError) return [];
        return (matchedRows || []) as Record<string, unknown>[];
      };

      const { data: rows, error } = await supabase
        .from('patients')
        .select(safeSelect)
        .eq('family_id', user.id)
        .order('admitted_at', { ascending: false });

      let list: PatientListEntry[] = [];
      let details: Record<string, Record<string, unknown>> = {};
      let activeRows: Record<string, unknown>[] = (rows || []) as Record<string, unknown>[];

      if (error) {
        const fallback = await mapApprovedAdmissionsToPatients();
        list = fallback.list;
        details = fallback.details;
        activeRows = [];
      } else {
        const mapped = (rows || [])
          .map((r) => {
            const ui = uiPatientFromRow(r as unknown as PatientRow);
            if (!ui) return null;
            const row = r as Record<string, unknown>;
            return {
              ...ui,
              dateOfBirth: String(row.date_of_birth || ''),
              roomCode: String(row.room_code || ''),
              gender: String(row.gender || ''),
            } as PatientListEntry;
          })
          .filter((x): x is PatientListEntry => x != null);
        if (mapped.length > 0) {
          list = mapped;
          for (const r of rows || []) details[String((r as { id: string }).id)] = r as Record<string, unknown>;
        } else {
          const resolvedFromApproved = await fetchPatientsFromApprovedAdmissions();
          if (resolvedFromApproved.length) {
            activeRows = resolvedFromApproved;
            list = resolvedFromApproved
              .map((r) => {
                const ui = uiPatientFromRow(r as unknown as PatientRow);
                if (!ui) return null;
                return {
                  ...ui,
                  dateOfBirth: String(r.date_of_birth || ''),
                  roomCode: String(r.room_code || ''),
                  gender: String(r.gender || ''),
                } as PatientListEntry;
              })
              .filter((x): x is PatientListEntry => x != null);
            for (const row of resolvedFromApproved) details[String(row.id)] = row;
          } else {
            const fallback = await mapApprovedAdmissionsToPatients();
            list = fallback.list;
            details = { ...details, ...fallback.details };
            activeRows = [];
          }
        }
      }

      const ids = (activeRows.length ? activeRows : rows || [])
        .map((r) => (r as { id: string }).id)
        .filter(Boolean)
        .filter((id) => !String(id).startsWith('admission-'));

      const mergedIds = [...new Set([...ids, ...list.map((p) => p.id).filter((id) => !String(id).startsWith('admission-'))])];

      if (mergedIds.length) {
        const { data: detailRows } = await supabase.from('patients').select('*').in('id', mergedIds);
        if (detailRows?.length) {
          const fullDetails: Record<string, Record<string, unknown>> = { ...details };
          for (const row of detailRows) fullDetails[String((row as { id: string }).id)] = row as Record<string, unknown>;
          setPatientDetailsById(fullDetails);
          details = fullDetails;
        } else {
          setPatientDetailsById(details);
        }
      } else {
        setPatientDetailsById(details);
      }

      let reportIds = [
        ...new Set(
          list
            .map((p) => canonicalPatientId(p, details))
            .filter((id) => isSupabasePatientId(id))
        ),
      ];
      try {
        const { data: familyIdRows } = await supabase
          .from('patients')
          .select('id')
          .eq('family_id', user.id);
        reportIds = [
          ...new Set([
            ...reportIds,
            ...(familyIdRows || [])
              .map((r) => r.id)
              .filter((id): id is string => isSupabasePatientId(id)),
          ]),
        ];
      } catch {
        /* ignore */
      }
      let byPatient: Record<string, ReportRow[]> = {};

      if (reportIds.length) {
        const direct = await supabase
          .from('weekly_reports')
          .select('*')
          .in('patient_id', reportIds)
          .order('week_number', { ascending: true });
        let reportRows = direct.data || null;
        const reportError = direct.error || null;
        if (reportError || !(reportRows || []).length) {
          const rpcReports = await supabase.rpc('bh_family_weekly_reports');
          if (!rpcReports.error && rpcReports.data) {
            const idSet = new Set(reportIds.map((x) => String(x)));
            reportRows = (rpcReports.data as ReportRow[]).filter((row) =>
              idSet.has(String(row.patient_id))
            );
          }
        }
        if (reportRows) {
          for (const row of reportRows) {
            const key = String(row.patient_id);
            if (!byPatient[key]) byPatient[key] = [];
            byPatient[key].push(row);
          }
          list.forEach((p) => {
            const listId = String(p.id);
            const pid = canonicalPatientId(p, details);
            if (pid && byPatient[pid] && listId !== pid && !byPatient[listId]) {
              byPatient[listId] = byPatient[pid];
            }
          });
        }
      }

      // Keep unique residents/reports to avoid React duplicate-key crashes.
      const dedupedPatients = normalizeResidentList(uniqueById(list) as PatientListEntry[]);
      const dedupedByPatient: Record<string, ReportRow[]> = {};
      Object.entries(byPatient).forEach(([pid, rowsForPatient]) => {
        dedupedByPatient[pid] = uniqueById(rowsForPatient as { id?: unknown }[]).map((r) => ({ ...r }));
      });

      setWeeklyReportsByPatient(dedupedByPatient);
      setPatients(dedupedPatients);

      for (const pid of mergedIds) {
        if (!isSupabasePatientId(pid)) continue;
        void syncPatientTemporaryLeaveFromRequests(pid, {
          familyId: familyUserId,
          patientName: patients.find((p) => canonicalPatientId(p, details) === pid)?.name,
        }).then((result) => {
          if (!result.ok || !result.fields) return;
          setPatientDetailsById((prev) => ({
            ...prev,
            [pid]: { ...(prev[pid] || {}), ...result.fields },
          }));
        });
      }
    } catch (e) {
      console.warn('[patient-details]', e);
      setFamilyUserId('');
      setPatients([]);
      setPatientDetailsById({});
      setWeeklyReportsByPatient({});
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => void load(), [load]));

  const reportsForPatient = useCallback(
    (patient: PatientListEntry | null | undefined) =>
      resolveWeeklyReportsForPatient(patient, weeklyReportsByPatient, patientDetailsById),
    [weeklyReportsByPatient, patientDetailsById]
  );

  const totalReportsSubmitted = useMemo(
    () => Object.values(weeklyReportsByPatient).reduce((acc, rows) => acc + (rows?.length || 0), 0),
    [weeklyReportsByPatient]
  );
  const averageProgress = useMemo(() => {
    if (!patients.length) return 0;
    return Math.round(patients.reduce((s, p) => s + (Number(p.progress) || 0), 0) / patients.length);
  }, [patients]);
  const patientsWithReportsCount = useMemo(
    () => patients.filter((p) => reportsForPatient(p).length > 0).length,
    [patients, reportsForPatient]
  );
  const pendingReviewCount = useMemo(
    () => Math.max(0, patients.length - patientsWithReportsCount),
    [patients.length, patientsWithReportsCount]
  );
  const latestWeeklyReportStrip = useMemo(() => {
    return Object.entries(weeklyReportsByPatient || {})
      .flatMap(([patientId, rows]) =>
        (rows || []).map((row) => ({
          patientId,
          week: row.week_number ?? '-',
          submittedAt: row.submitted_at || row.created_at || null,
          nurseName: String(row.nurse_name || 'Assigned Nurse'),
        }))
      )
      .sort(
        (a, b) =>
          new Date(String(b.submittedAt || 0)).getTime() - new Date(String(a.submittedAt || 0)).getTime()
      )
      .slice(0, 4);
  }, [weeklyReportsByPatient]);

  const formatResidentDisplayIdFor = useCallback(
    (patientId: string) => {
      const detail = patientDetailsById[patientId];
      const patient = patients.find((x) => String(x.id) === patientId);
      const admittedAt =
        (detail?.admitted_at as string | undefined) ||
        (patient as { admitted_at?: string | null })?.admitted_at ||
        null;
      return computeAdmissionDisplayId(
        { id: patientId, decided_at: admittedAt, created_at: (detail?.created_at as string) || null },
        { id: patientId, admitted_at: admittedAt }
      );
    },
    [patientDetailsById, patients]
  );

  useEffect(() => {
    if (!selected || !isSupabaseConfigured()) return undefined;
    const listId = String(selected.id);
    const pid = canonicalPatientId(selected, patientDetailsById);
    if (!isSupabasePatientId(pid)) return undefined;
    const existing = resolveWeeklyReportsForPatient(selected, weeklyReportsByPatient, patientDetailsById);
    if (existing.length) return undefined;

    let cancelled = false;
    void (async () => {
      const rows = await fetchWeeklyReportsForPatientId(pid);
      if (cancelled || !rows?.length) return;
      setWeeklyReportsByPatient((prev) =>
        mergeReportsIntoByPatient(prev, pid, rows as ReportRow[], listId !== pid ? listId : null)
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [selected?.id, selected?.name, patientDetailsById]);

  useEffect(() => {
    if (!selected?.id || !isSupabaseConfigured()) {
      setTemporaryLeaveFromRequest(null);
      return undefined;
    }
    const patientId = canonicalPatientId(selected, patientDetailsById);
    if (!isSupabasePatientId(patientId)) {
      setTemporaryLeaveFromRequest(null);
      return undefined;
    }
    let cancelled = false;
    void (async () => {
      const result = await syncPatientTemporaryLeaveFromRequests(patientId, {
        familyId: familyUserId,
        patientName: selected?.name,
      });
      if (cancelled) return;
      if (result.fields) {
        setTemporaryLeaveFromRequest(result.fields);
        setPatientDetailsById((prev) => ({
          ...prev,
          [patientId]: { ...(prev[patientId] || {}), ...result.fields },
          ...(String(selected.id) !== patientId
            ? { [String(selected.id)]: { ...(prev[String(selected.id)] || {}), ...result.fields } }
            : {}),
        }));
      } else {
        setTemporaryLeaveFromRequest(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected?.id, selected?.name, familyUserId, patientDetailsById]);

  const selectedPatientDetails = selected ? patientDetailsById[String(selected.id)] : null;
  const selectedPatientCare = useMemo(() => {
    if (!selected) return null;
    const base = mergePatientTemporaryDischargeFields(
      selected as Record<string, unknown>,
      selectedPatientDetails
    );
    return mergePatientWithRequestTemporaryLeave(base, temporaryLeaveFromRequest) as PatientListEntry;
  }, [selected, selectedPatientDetails, temporaryLeaveFromRequest]);
  const onTemporaryLeave = isPatientOnTemporaryLeave(
    (selectedPatientCare || selected) as Record<string, unknown>
  );
  const tempLeaveStatusLabel = patientTemporaryDischargeStatusLabel(
    (selectedPatientCare || selected) as Record<string, unknown>
  );

  const isResidentOnTemporaryLeave = useCallback(
    (p: PatientListEntry) =>
      isPatientOnTemporaryLeave(
        mergePatientTemporaryDischargeFields(
          p as Record<string, unknown>,
          patientDetailsById[String(p.id)]
        )
      ),
    [patientDetailsById]
  );

  const handleResidentReturned = async () => {
    if (!selectedPatientCare?.id || !onTemporaryLeave) return;
    setResidentReturnBusy(true);
    const result = await returnResidentFromTemporaryLeave(
      selectedPatientCare as Record<string, unknown>
    );
    setResidentReturnBusy(false);
    if (!result.ok) {
      Alert.alert('Could not update', result.error || 'Could not mark resident as returned.');
      return;
    }
    const cleared = {
      temporaryDischargeAt: null,
      temporaryDischargeUntil: null,
      temporaryDischargeExpectedReturn: null,
      temporaryLeaveType: null,
      temporary_discharge_at: null,
      temporary_discharge_until: null,
      temporary_discharge_expected_return: null,
      temporary_leave_type: null,
    };
    setTemporaryLeaveFromRequest(null);
    setShowResidentReturnConfirm(false);
    const careId = String(selectedPatientCare.id);
    setSelected((prev) => (prev ? { ...prev, ...cleared } : prev));
    setPatientDetailsById((prev) => ({
      ...prev,
      [careId]: { ...(prev[careId] || {}), ...cleared },
    }));
    setPatients((prev) =>
      prev.map((p) => (String(p.id) === careId ? { ...p, ...cleared } : p))
    );
    void load();
  };

  const selectedReports = reportsForPatient(selectedPatientCare || selected);
  const latestSelectedReport = [...selectedReports].sort(
    (a, b) =>
      new Date(String(b.submitted_at || b.created_at || 0)).getTime() -
      new Date(String(a.submitted_at || a.created_at || 0)).getTime()
  )[0] || null;

  const assignedNurseDisplay =
    String(latestSelectedReport?.nurse_name || '') ||
    String(selectedPatientDetails?.program_staff || '') ||
    'N/A';
  const assignedProgramStaffDisplay =
    String(selectedPatientDetails?.case_load_manager || '') || 'N/A';

  const detailSummaryForModal =
    selected != null
      ? patientSummaryPayload(
          (selectedPatientCare || selected) as PatientListEntry,
          selectedPatientDetails,
          latestSelectedReport
        )
      : null;
  const modalStatusLabel = onTemporaryLeave
    ? tempLeaveStatusLabel || 'Temporarily discharged'
    : detailSummaryForModal?.status || patientStatusTone(Number(selected?.progress) || 0).label;

  const heroWrapHeight = insets.top + HEADER_BAR_HEIGHT + SCREEN_W * 0.32;
  const heroImageScale = heroWrapHeight / HERO_IMG_NATURAL_H;
  const heroImageWidth = HERO_IMG_NATURAL_W * heroImageScale;

  return (
    <View style={[styles.screen, { backgroundColor: '#F0F4FF' }]}>
      <View style={[styles.heroHeaderWrap, { height: heroWrapHeight }]}>
        <Image
          source={require('../../assets/images/residents-header.png')}
          style={[styles.heroHeaderImage, { width: heroImageWidth, height: heroWrapHeight, right: 0 }]}
          resizeMode="cover"
        />
        <FamilyMobilePageHeader title="Resident Details" onBrandPress={scrollToTop} transparent />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.heroOverlapScroll}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color="#F54E25" />
            <Text style={styles.loadingTxt}>Loading patients…</Text>
          </View>
        ) : patients.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTxt}>
              {isSupabaseConfigured()
                ? 'No active residents yet. Once admissions are approved, resident details appear here.'
                : 'Configure Supabase to load patient records.'}
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.navigate(TAB_ROUTES.admission)}>
              <Text style={styles.primaryBtnTxt}>Admission request</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.overviewCard}>
              <Text style={styles.overviewCardLabel}>Care Overview</Text>
              <View style={styles.statGrid}>
                <StatMiniCard
                  label="Active Residents"
                  value={patients.length}
                  caption="Currently under care"
                  icon="people"
                  iconBg="#EEF2FF"
                  iconColor="#6366F1"
                />
                <StatMiniCard
                  label="Avg Progress"
                  value={`${averageProgress}%`}
                  caption="Steady recovery"
                  icon="trending-up"
                  iconBg="#ECFDF5"
                  iconColor="#10B981"
                />
                <StatMiniCard
                  label="Total Reports"
                  value={totalReportsSubmitted}
                  caption="This week"
                  icon="document-text"
                  iconBg="#F54E25"
                  iconColor="#FFFFFF"
                />
                <StatMiniCard
                  label="Pending Review"
                  value={pendingReviewCount}
                  caption="Needs attention"
                  icon="warning"
                  iconBg="#FEF3C7"
                  iconColor="#F59E0B"
                />
              </View>
            </View>

            <View style={styles.dirHead}>
              <Text style={styles.dirTitle}>Resident Directory</Text>
              <Text style={styles.dirMeta}>View all</Text>
            </View>
            {patients.map((p, idx) => {
              const onTempLeave = isResidentOnTemporaryLeave(p);
              const tone = onTempLeave
                ? { label: 'On leave', bg: '#FEF3C7', color: '#92400E' }
                : patientStatusTone(p.progress);
              const room = patientDetailsById[String(p.id)]?.room_code || p.roomCode || 'Unassigned';
              const concern = String(patientDetailsById[String(p.id)]?.primary_concern || p.reason || 'N/A');
              const reportCount = reportsForPatient(p).length;
              const prog = Number(p.progress) || 0;
              return (
                <TouchableOpacity
                  key={`pd-card-${idx}`}
                  style={styles.cardV2}
                  onPress={() => setSelected(p)}
                  activeOpacity={0.9}
                >
                  <View style={styles.cardV2Top}>
                    <View style={styles.cardV2Avatar}>
                      <Text style={styles.cardV2Initials}>{deriveInitials(p.name)}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.nameRow}>
                        <Text style={styles.name} numberOfLines={1}>
                          {p.name}
                        </Text>
                        <View style={[styles.statusChip, { backgroundColor: tone.bg }]}>
                          <Text style={[styles.statusChipTxt, { color: tone.color }]}>{tone.label}</Text>
                        </View>
                      </View>
                      <Text style={styles.meta}>
                        Admitted: <Text style={styles.metaStrong}>{p.date || '—'}</Text>
                      </Text>
                      <Text style={styles.miniLine} numberOfLines={1}>
                        Concern: <Text style={styles.metaStrong}>{concern}</Text>
                      </Text>
                      <Text style={styles.miniLine}>
                        Reports: <Text style={styles.metaStrong}>{reportCount}</Text> • Room:{' '}
                        <Text style={styles.metaStrong}>{String(room)}</Text>
                      </Text>
                    </View>
                    <View style={styles.cardV2Trail}>
                      <ProgressRing pct={prog} size={52} color={tone.color} />
                      <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            {latestWeeklyReportStrip.length > 0 ? (
              <View style={styles.recentSection}>
                <View style={styles.recentHead}>
                  <Ionicons name="document-text" size={16} color="#F54E25" />
                  <Text style={styles.recentTitle}>Recent Weekly Reports</Text>
                </View>
                {latestWeeklyReportStrip.map((item, ridx) => {
                  const match = patients.find((x) => String(x.id) === item.patientId);
                  return (
                    <View key={`${item.patientId}-${String(item.week)}-${ridx}`} style={styles.recentRow}>
                      <View style={styles.recentIconChip}>
                        <Ionicons name="document-text-outline" size={18} color="#F54E25" />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.recentWeek}>
                          WEEK {String(item.week)} <Text style={styles.recentId}>· ID: {formatResidentDisplayIdFor(item.patientId)}</Text>
                        </Text>
                        <Text style={styles.recentDate}>
                          {formatDate(String(item.submittedAt))} · Nurse: {item.nurseName}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.recentCtaBtn}
                        onPress={() => match && setSelected(match)}
                        activeOpacity={0.85}
                        disabled={!match}
                      >
                        <Text style={styles.recentCtaBtnTxt}>View resident →</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={[styles.detailFullScreen, { paddingTop: insets.top, backgroundColor: '#F8FAFF' }]}>
          {selected && detailSummaryForModal ? (
            <>
              <LinearGradient
                colors={['#0F172A', '#1E2D4F']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.modalHero}
              >
                <View style={styles.modalHeroTop}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.modalHeroKicker}>Resident Detail View</Text>
                    <Text style={styles.modalHeroName} numberOfLines={2}>
                      {selected.name}
                    </Text>
                    <Text style={styles.modalHeroMeta}>
                      Admitted {selected.date || 'N/A'} · Progress: {Number(selected.progress) || 0}% ·{' '}
                      {selectedReports.length} reports
                      {onTemporaryLeave ? (
                        <Text style={styles.modalHeroTempLeave}>
                          {' '}
                          · {tempLeaveStatusLabel || 'Temporarily discharged'}
                        </Text>
                      ) : null}
                    </Text>
                    {onTemporaryLeave ? (
                      <TemporaryDischargeCardBanner
                        patient={selectedPatientCare as Record<string, unknown>}
                        variant="hero"
                        requestFields={temporaryLeaveFromRequest}
                      />
                    ) : null}
                  </View>
                  <View style={styles.modalHeroActions}>
                    {onTemporaryLeave ? (
                      <ResidentReturnedHeaderButton
                        busy={residentReturnBusy}
                        onPress={() => setShowResidentReturnConfirm(true)}
                      />
                    ) : null}
                    <TouchableOpacity
                      onPress={() => {
                        setSelected(null);
                        setTemporaryLeaveFromRequest(null);
                      }}
                      hitSlop={12}
                      accessibilityLabel="Close"
                    >
                      <Ionicons name="close" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.modalHeroProgressWrap}>
                  <View style={styles.modalHeroProgressLabels}>
                    <Text style={styles.modalHeroProgressLbl}>Recovery Progress</Text>
                    <Text style={styles.modalHeroProgressPct}>{Number(selected.progress) || 0}%</Text>
                  </View>
                  <View style={styles.modalHeroTrack}>
                    <LinearGradient
                      colors={['#6EE7B7', '#34D399']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.modalHeroFill,
                        { width: `${Math.min(100, Math.max(0, Number(selected.progress) || 0))}%` },
                      ]}
                    />
                  </View>
                </View>
              </LinearGradient>
              <ScrollView
                contentContainerStyle={[styles.detailScroll, { paddingBottom: insets.bottom + 24 }]}
                keyboardShouldPersistTaps="handled"
              >
                {onTemporaryLeave ? (
                  <TemporaryDischargeNotePanel
                    patient={selectedPatientCare as Record<string, unknown>}
                    requestFields={temporaryLeaveFromRequest}
                  />
                ) : null}
                <DetailCardSection
                  onTemporaryLeave={onTemporaryLeave}
                  temporaryPatient={selectedPatientCare as Record<string, unknown>}
                  temporaryLeaveRequestFields={temporaryLeaveFromRequest}
                >
                  <View style={styles.detailCardTitleRow}>
                    <Ionicons name="heart" size={16} color="#F54E25" />
                    <Text style={styles.detailCardTitle}>Patient summary</Text>
                  </View>
                  <Text style={styles.summaryPara}>{detailSummaryForModal.summary}</Text>
                  {(() => {
                    const st = onTemporaryLeave
                      ? { bg: '#FEF3C7', color: '#92400E' }
                      : patientStatusTone(Number(selected.progress) || 0);
                    return (
                      <View style={[styles.statusChip, { alignSelf: 'flex-start', backgroundColor: st.bg }]}>
                        <Text style={[styles.statusChipTxt, { color: st.color }]}>{modalStatusLabel}</Text>
                      </View>
                    );
                  })()}
                  <View style={{ marginTop: 14, gap: 10 }}>
                    {detailSummaryForModal.reviewRows.map((row) => (
                      <View key={row.label}>
                        <View style={styles.reviewRowHead}>
                          <Text style={styles.reviewRowLabel}>{row.label}</Text>
                          <Text style={styles.reviewRowValue}>{row.value}</Text>
                        </View>
                        <View style={styles.reviewBarTrack}>
                          <LinearGradient
                            colors={['#F54E25', '#EA580C']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[styles.reviewBarFill, { width: reviewBarWidthFromLabel(row.value) }]}
                          />
                        </View>
                        <Text style={styles.reviewRowNote}>{row.note}</Text>
                      </View>
                    ))}
                  </View>
                </DetailCardSection>

                <DetailCardSection
                  onTemporaryLeave={onTemporaryLeave}
                  temporaryPatient={selectedPatientCare as Record<string, unknown>}
                  temporaryLeaveRequestFields={temporaryLeaveFromRequest}
                >
                  <View style={styles.detailCardTitleRow}>
                    <Ionicons name="list" size={16} color="#F54E25" />
                    <Text style={styles.detailCardTitle}>Patient data</Text>
                  </View>
                  <MiniTableRow label="Patient name" value={selected.name} />
                  <MiniTableRow label="Admission date" value={selected.date || 'N/A'} />
                  <MiniTableRow label="Progress" value={`${selected.progress}%`} />
                  <MiniTableRow label="Status" value={modalStatusLabel} />
                  <MiniTableRow
                    label="Primary concern"
                    value={String(selectedPatientDetails?.primary_concern || selected.reason || 'N/A')}
                  />
                  <MiniTableRow
                    label="Age"
                    value={String(
                      calculateAge(
                        typeof selectedPatientDetails?.date_of_birth === 'string'
                          ? selectedPatientDetails.date_of_birth
                          : selected.dateOfBirth
                      )
                    )}
                  />
                  <MiniTableRow
                    label="Gender"
                    value={String(selectedPatientDetails?.gender || selected.gender || 'N/A')}
                  />
                  <MiniTableRow label="Reports submitted" value={String(selectedReports.length)} />
                </DetailCardSection>

                <DetailCardSection
                  onTemporaryLeave={onTemporaryLeave}
                  temporaryPatient={selectedPatientCare as Record<string, unknown>}
                  temporaryLeaveRequestFields={temporaryLeaveFromRequest}
                >
                  <View style={styles.detailCardTitleRow}>
                    <Ionicons name="calendar" size={16} color="#F54E25" />
                    <Text style={styles.detailCardTitle}>Report timeline</Text>
                  </View>
                  {selectedReports.length ? (
                    selectedReports.map((row, idx) => (
                      <View key={`${String(row.id || 'row')}-${idx}`} style={styles.timelineRow}>
                        <Text style={styles.timelineWeek}>Week {String(row.week_number ?? '—')}</Text>
                        <Text style={styles.timelineDate}>
                          {formatDate(String(row.submitted_at || row.created_at))}
              </Text>
                        <View style={styles.receivedPill}>
                          <Text style={styles.receivedPillTxt}>Received</Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.mutedCenter}>No reports yet.</Text>
                  )}
                </DetailCardSection>

                <DetailCardSection
                  onTemporaryLeave={onTemporaryLeave}
                  temporaryPatient={selectedPatientCare as Record<string, unknown>}
                  temporaryLeaveRequestFields={temporaryLeaveFromRequest}
                >
                  <View style={styles.detailCardTitleRow}>
                    <Ionicons name="clipboard" size={16} color="#F54E25" />
                    <Text style={styles.detailCardTitle}>Care team & placement</Text>
                  </View>
                  <MiniTableRow label="Room assignment" value={String(selectedPatientDetails?.room_code || selected.roomCode || 'Unassigned')} />
                  <MiniTableRow label="Nurse" value={assignedNurseDisplay} />
                  <MiniTableRow label="Program staff" value={assignedProgramStaffDisplay} />
                  <MiniTableRow label="Reports submitted" value={String(selectedReports.length)} />
                </DetailCardSection>

                <DetailCardSection
                  onTemporaryLeave={onTemporaryLeave}
                  temporaryPatient={selectedPatientCare as Record<string, unknown>}
                  temporaryLeaveRequestFields={temporaryLeaveFromRequest}
                >
                  <View style={styles.detailCardTitleRow}>
                    <Ionicons name="pulse" size={16} color="#F54E25" />
                    <Text style={styles.detailCardTitle}>Vital signs (latest weekly report)</Text>
                  </View>
                  <MiniTableRow
                    label="Current weight"
                    value={resolveVital(
                      latestSelectedReport?.vitals_weight,
                      selectedPatientDetails?.current_weight,
                      selectedPatientDetails?.weight_kg
                    )}
                  />
                  <MiniTableRow
                    label="Height"
                    value={resolveVital(latestSelectedReport?.vitals_height, selectedPatientDetails?.height_cm)}
                  />
                  <MiniTableRow
                    label="Blood pressure"
                    value={resolveVital(
                      latestSelectedReport?.vitals_bp,
                      selectedPatientDetails?.bp,
                      selectedPatientDetails?.blood_pressure
                    )}
                  />
                  <MiniTableRow
                    label="PR"
                    value={resolveVital(
                      latestSelectedReport?.vitals_pr,
                      selectedPatientDetails?.pr,
                      selectedPatientDetails?.pulse_rate
                    )}
                  />
                  <MiniTableRow
                    label="RR"
                    value={resolveVital(
                      latestSelectedReport?.vitals_rr,
                      selectedPatientDetails?.rr,
                      selectedPatientDetails?.respiratory_rate
                    )}
                  />
                  <MiniTableRow
                    label="Temperature (°F)"
                    value={resolveVital(
                      latestSelectedReport?.vitals_temperature,
                      selectedPatientDetails?.temperature_f,
                      selectedPatientDetails?.temperature
                    )}
                  />
                  <MiniTableRow
                    label="BMI"
                    value={resolveVital(latestSelectedReport?.vitals_bmi, selectedPatientDetails?.bmi)}
                  />
                  <MiniTableRow
                    label="SpO2"
                    value={resolveVital(
                      latestSelectedReport?.vitals_spo2,
                      selectedPatientDetails?.spo2,
                      selectedPatientDetails?.oxygen_saturation
                    )}
                  />
                </DetailCardSection>

                <DetailCardSection
                  onTemporaryLeave={onTemporaryLeave}
                  temporaryPatient={selectedPatientCare as Record<string, unknown>}
                  temporaryLeaveRequestFields={temporaryLeaveFromRequest}
                >
                  <View style={styles.detailCardTitleRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#F54E25" />
                    <Text style={styles.detailCardTitle}>Recommended next steps</Text>
                  </View>
                  {detailSummaryForModal.goals.map((goal, gi) => (
                    <View key={`goal-${gi}`} style={styles.goalCard}>
                      <View style={styles.goalIcon}>
                        <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                      </View>
                      <Text style={styles.goalCardTxt}>{goal}</Text>
                    </View>
                  ))}
                </DetailCardSection>

                <View style={styles.actionRow}>
              <TouchableOpacity
                    style={styles.secondaryBtn}
                onPress={() => {
                      setSelected(null);
                      router.navigate(TAB_ROUTES.reports as never);
                    }}
                  >
                    <Text style={styles.secondaryBtnTxt}>All weekly reports</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.primaryBtnInline}
                    onPress={() => {
                      const id = selected.id;
                      const name = selected.name;
                  setSelected(null);
                  if (id) {
                    router.push({
                      pathname: TAB_ROUTES.weeklyReport,
                      params: { patientId: id, patientName: name || '' },
                    } as never);
                  }
                }}
              >
                    <Text style={styles.primaryBtnTxt}>Weekly report activity</Text>
              </TouchableOpacity>
                </View>
            </ScrollView>
            </>
          ) : null}
        </View>
      </Modal>

      <ResidentReturnedConfirmModal
        open={showResidentReturnConfirm}
        residentName={selectedPatientCare?.name || selected?.name || 'this resident'}
        busy={residentReturnBusy}
        onClose={() => setShowResidentReturnConfirm(false)}
        onConfirm={() => void handleResidentReturned()}
      />

      <FamilyWebMobileNav active="patientDetails" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    minHeight: 52,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F1',
    gap: 8,
  },
  topTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: '#F54E25', textAlign: 'center' },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  scroll: { paddingHorizontal: 18, paddingTop: 14 },
  heroHeaderWrap: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  heroHeaderImage: {
    position: 'absolute',
    top: 0,
  },
  heroOverlapScroll: { marginTop: -60 },
  overviewCard: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    padding: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  overviewCardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  statGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statCardLabel: {
    fontSize: 8.5,
    lineHeight: 11,
    minHeight: 22,
    color: '#334155',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 6,
    textAlign: 'center',
  },
  statCardValue: { fontSize: 20, fontWeight: '900', color: '#1B2559', textAlign: 'center' },
  statCardCaption: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  recentSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    padding: 16,
    marginBottom: 14,
  },
  recentHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  recentTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  recentIconChip: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFF1EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentWeek: { fontSize: 12, fontWeight: '800', color: '#F54E25', letterSpacing: 0.3 },
  recentId: { fontSize: 12, fontWeight: '800', color: '#0F172A' },
  recentDate: { fontSize: 11, color: '#64748B', marginTop: 3, fontWeight: '600' },
  recentCtaBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#F54E25',
  },
  recentCtaBtnTxt: { fontSize: 11, fontWeight: '800', color: '#F54E25' },
  cardV2: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    padding: 16,
    marginBottom: 12,
  },
  cardV2Top: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  cardV2Avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardV2Initials: { fontSize: 17, fontWeight: '900', color: '#4338CA' },
  cardV2Trail: { alignItems: 'center', gap: 8 },
  metaStrong: { color: '#334155', fontWeight: '800' },
  modalHero: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18 },
  modalHeroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  modalHeroActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  modalHeroTempLeave: { color: '#FDE68A', fontWeight: '700' },
  modalHeroKicker: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  modalHeroName: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.3 },
  modalHeroMeta: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6, lineHeight: 18 },
  modalHeroProgressWrap: {
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalHeroProgressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modalHeroProgressLbl: { fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: '700' },
  modalHeroProgressPct: { fontSize: 10, fontWeight: '900', color: '#6EE7B7' },
  modalHeroTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  modalHeroFill: { height: '100%', borderRadius: 999 },
  reviewRowHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  reviewRowLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  reviewRowValue: { fontSize: 12, fontWeight: '800', color: '#0F172A' },
  reviewBarTrack: {
    height: 5,
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    overflow: 'hidden',
  },
  reviewBarFill: { height: '100%', borderRadius: 999 },
  reviewRowNote: { fontSize: 10, color: '#94A3B8', marginTop: 4, fontWeight: '600' },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FAFBFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  goalIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalCardTxt: { flex: 1, fontSize: 12, color: '#334155', lineHeight: 18, fontWeight: '600' },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24 },
  loadingTxt: { color: '#64748B', fontWeight: '700' },
  emptyCard: {
    marginTop: 16,
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9EDF7',
  },
  emptyTxt: { fontSize: 14, color: '#64748B', lineHeight: 20 },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: '#F54E25',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnTxt: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  dirHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  dirTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1B2559',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dirMeta: { fontSize: 12, fontWeight: '800', color: '#F54E25' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    padding: 14,
    marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F4F7FE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontSize: 17, fontWeight: '800', color: '#1B2559', flex: 1, minWidth: 120 },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusChipTxt: { fontSize: 10, fontWeight: '800' },
  meta: { fontSize: 12, color: '#64748B', fontWeight: '600', marginTop: 4 },
  miniLine: { fontSize: 11, color: '#475569', fontWeight: '600', marginTop: 3 },
  viewSummaryBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  viewSummaryBtnTxt: { color: '#3730A3', fontWeight: '800', fontSize: 12 },
  detailFullScreen: { flex: 1, maxHeight: WINDOW_H },
  detailScroll: { padding: 16 },
  detailHeroName: { fontSize: 22, fontWeight: '900', color: '#1B2559' },
  detailHeroSub: { fontSize: 13, color: '#64748B', fontWeight: '600', marginTop: 6, marginBottom: 14 },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6EDF9',
    padding: 14,
    marginBottom: 12,
  },
  detailCardWithLeaveBanner: {
    paddingTop: 0,
    paddingHorizontal: 0,
    paddingBottom: 0,
    overflow: 'hidden',
  },
  detailCardBody: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
  detailCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  detailCardTitle: { fontSize: 14, fontWeight: '800', color: '#1B2559' },
  summaryPara: { fontSize: 13, color: '#334155', lineHeight: 20, fontWeight: '600' },
  statusBadge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeTxt: { fontSize: 11, fontWeight: '800', color: '#3730A3' },
  miniRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF3FB',
  },
  miniTh: { flex: 1, fontSize: 12, color: '#64748B', fontWeight: '800' },
  miniTd: { flex: 1, fontSize: 12, color: '#334155', fontWeight: '700', textAlign: 'right' },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF3FB',
  },
  timelineWeek: { fontSize: 13, fontWeight: '800', color: '#1B2559', width: 72 },
  timelineDate: { flex: 1, fontSize: 12, color: '#64748B', fontWeight: '600' },
  receivedPill: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  receivedPillTxt: { fontSize: 10, fontWeight: '800', color: '#166534' },
  mutedCenter: { color: '#94A3B8', fontSize: 13, fontWeight: '700', textAlign: 'center', paddingVertical: 8 },
  goalLine: { fontSize: 13, color: '#334155', fontWeight: '600', lineHeight: 20, marginBottom: 6 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 24 },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  secondaryBtnTxt: { color: '#334155', fontWeight: '800', fontSize: 13 },
  primaryBtnInline: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F54E25',
    alignItems: 'center',
  },
});
