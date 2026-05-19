import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { TAB_ROUTES } from '../../lib/navigationConfig';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  loadVisitationSettingsShared,
  listVisitationRequestsByFamily,
  createVisitationRequestLocal,
  mergeRequestsFromSupabase,
  normalizeVisitationStatus,
  getConfirmedVisitationMap,
  getPendingVisitationDateSet,
  formatVisitationWeekdayLong,
  visitationStatusSubtext,
  upsertVisitationRequestAfterRemoteInsert,
  type VisitationRequestRow,
} from '../../lib/visitationAppointmentsMobile';
import { FamilyMobilePageHeader } from '../../components/family/FamilyMobilePageHeader';
import { useFamilyUserMobile } from '../../lib/useFamilyUserMobile';
import { FamilyWebMobileNav } from '../../components/family/FamilyWebMobileNav';
import { FamilyFloatingChat } from '../../components/family/FamilyFloatingChat';
import { KalingaLogoMark } from '../../components/family/KalingaLogoMark';

const WEEKDAY_TO_INDEX: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const CAL_GAP = 4;
/** Horizontal padding: scroll 32 + panel 32 */
const CAL_HORIZONTAL_PAD = 64;

function useCalendarGridLayout() {
  const { width: screenWidth } = useWindowDimensions();
  return useMemo(() => {
    const inner = Math.max(0, screenWidth - CAL_HORIZONTAL_PAD);
    const cell = Math.max(30, Math.floor((inner - CAL_GAP * 6) / 7));
    const gridWidth = cell * 7 + CAL_GAP * 6;
    return { cell, gridWidth, gap: CAL_GAP };
  }, [screenWidth]);
}

const STATUS_CFG: Record<string, { bg: string; color: string; border: string }> = {
  Approved: { bg: '#DCFCE7', color: '#166534', border: '#BBF7D0' },
  Declined: { bg: '#FEE2E2', color: '#991B1B', border: '#FECACA' },
  Rescheduled: { bg: '#E0E7FF', color: '#3730A3', border: '#C7D2FE' },
  Requested: { bg: '#FEF3C7', color: '#92400E', border: '#FDE68A' },
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const HOLIDAY_LABELS: Record<string, string> = {
  '01-01': "New Year's Day",
  '04-09': 'Araw ng Kagitingan',
  '06-12': 'Independence Day',
  '08-21': 'Ninoy Aquino Day',
  '11-01': "All Saints' Day",
  '11-30': 'Bonifacio Day',
  '12-25': 'Christmas Day',
  '12-30': 'Rizal Day',
};

function deriveInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => (p[0] ? p[0].toUpperCase() : '')).join('') || 'FU';
}

type PatientOpt = { id: string; name: string };

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function isoLocalDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export default function AppointmentsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { cell: CELL, gridWidth: CAL_GRID_WIDTH, gap: CELL_GAP } = useCalendarGridLayout();
  const { displayName } = useFamilyUserMobile();
  const firstName = String(displayName || 'Family User').trim().split(/\s+/)[0] || 'Family';
  const [familyUserId, setFamilyUserId] = useState('');
    const [familyName, setFamilyName] = useState('Family User');
  const [patients, setPatients] = useState<PatientOpt[]>([]);
  const [visitationSettings, setVisitationSettings] = useState(() => ({ days: ['Wednesday', 'Saturday'], startTime: '13:00', endTime: '17:00' }));
  const [requests, setRequests] = useState<VisitationRequestRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    patientId: '',
    patientName: '',
    preferredDate: '',
    preferredTime: '',
    note: '',
  });
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  const allowedWeekdays = useMemo(
    () =>
      (visitationSettings.days || [])
        .map((d) => WEEKDAY_TO_INDEX[String(d || '').trim().toLowerCase()])
        .filter((v) => Number.isInteger(v)),
    [visitationSettings.days]
  );

  const timeSlots = useMemo(() => {
    const [sh = '13', sm = '00'] = String(visitationSettings.startTime || '13:00').split(':');
    const [eh = '17', em = '00'] = String(visitationSettings.endTime || '17:00').split(':');
    const startMin = Number(sh) * 60 + Number(sm);
    const endMin = Number(eh) * 60 + Number(em);
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) return [];
    const slots: string[] = [];
    for (let m = startMin; m <= endMin; m += 30) {
      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      slots.push(`${hh}:${mm}`);
    }
    return slots;
  }, [visitationSettings.startTime, visitationSettings.endTime]);

  const today = new Date();
  const todayIso = isoLocalDate(today);

  const confirmedByDate = useMemo(() => getConfirmedVisitationMap(requests), [requests]);
  const pendingDates = useMemo(() => getPendingVisitationDateSet(requests), [requests]);
  const goToCurrentMonth = useCallback(() => {
    const n = new Date();
    setCalendarMonth(new Date(n.getFullYear(), n.getMonth(), 1));
  }, []);
  const isViewingCurrentMonth =
    calendarMonth.getFullYear() === today.getFullYear()
    && calendarMonth.getMonth() === today.getMonth();
  const approvedCount = requests.filter((r) => normalizeVisitationStatus(r.status) === 'Approved').length;
  const pendingCount = requests.filter((r) => normalizeVisitationStatus(r.status) === 'Requested').length;
  const selectedDayLabel = form.preferredDate ? formatVisitationWeekdayLong(form.preferredDate) : '';

  const monthLabel = calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const monthStartDow = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();

  const isBookableDate = (iso: string, dayOfWeek: number) => {
    const mmdd = iso.slice(5);
    if (HOLIDAY_LABELS[mmdd]) return false;
    if (!allowedWeekdays.length) return true;
    return allowedWeekdays.includes(dayOfWeek);
  };

  const calendarCells = useMemo(() => {
    const cells: ({ iso: string; dayNum: number; dayOfWeek: number } | null)[] = [];
    for (let i = 0; i < 42; i += 1) {
      const dayNum = i - monthStartDow + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        cells.push(null);
        continue;
      }
      const dateObj = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), dayNum);
      const iso = isoLocalDate(dateObj);
      cells.push({ iso, dayNum, dayOfWeek: dateObj.getDay() });
    }
    return cells;
  }, [calendarMonth]);

  const loadAll = useCallback(async () => {
    const settings = await loadVisitationSettingsShared();
    setVisitationSettings(settings);

    if (!isSupabaseConfigured()) {
      setFamilyUserId('local-family');
      setPatients([]);
      setRequests(await listVisitationRequestsByFamily('local-family'));
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      setFamilyUserId('');
      setPatients([]);
      setRequests([]);
      return;
    }
    const display = (user.user_metadata?.full_name as string) || user.email || 'Family User';
    setFamilyUserId(user.id);
    setFamilyName(display);
    const { data } = await supabase
      .from('patients')
      .select('id, full_name')
      .eq('family_id', user.id)
      .is('discharged_at', null)
      .order('admitted_at', { ascending: false });
    setPatients((data || []).map((r) => ({ id: String(r.id), name: String(r.full_name || '') })));

    const localRows = await listVisitationRequestsByFamily(user.id);
    const merged = await mergeRequestsFromSupabase(user.id, localRows);
    setRequests(merged);
  }, []);

  useFocusEffect(
    useCallback(() => {
      goToCurrentMonth();
      void loadAll();
    }, [loadAll, goToCurrentMonth])
  );

    useEffect(() => {
    if (!timeSlots.length) {
      setForm((prev) => (prev.preferredTime ? { ...prev, preferredTime: '' } : prev));
      return;
    }
    setForm((prev) => {
      if (prev.preferredTime && timeSlots.includes(prev.preferredTime)) return prev;
      return { ...prev, preferredTime: timeSlots[0] };
    });
  }, [timeSlots]);

  const submitRequest = async () => {
    if (!form.patientName || !form.preferredDate || !form.preferredTime) {
      setFormError('Please select patient, date, and time before requesting.');
      return;
    }
    const selectedDate = new Date(`${form.preferredDate}T00:00:00`);
    const selectedDow = selectedDate.getDay();
    const dateKey = form.preferredDate.slice(5);
    const followsDayRule = !allowedWeekdays.length || allowedWeekdays.includes(selectedDow);
    const followsHolidayRule = !HOLIDAY_LABELS[dateKey];
    if (!followsDayRule || !followsHolidayRule) {
      setFormError('Please choose an available date based on the admin schedule.');
      return;
    }
    if (!timeSlots.includes(form.preferredTime)) {
      setFormError('Please choose an available time based on the admin schedule.');
      return;
    }
    setFormError('');
    setSaving(true);
    try {
      const created = await createVisitationRequestLocal({
        familyId: familyUserId || 'local-family',
        familyName,
        patientId: form.patientId,
        patientName: form.patientName,
        preferredDate: form.preferredDate,
        preferredTime: form.preferredTime,
        note: form.note,
      });

      if (isSupabaseConfigured() && familyUserId) {
        const looksUuid = (v: string) =>
          typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
        const requestId =
          typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
            ? globalThis.crypto.randomUUID()
            : created.id;
        const { error } = await supabase.from('visitation_requests').insert({
          id: requestId,
          family_id: looksUuid(familyUserId) ? familyUserId : null,
          family_name: familyName || null,
          patient_id: looksUuid(form.patientId) ? form.patientId : null,
          patient_name: form.patientName || null,
          preferred_date: form.preferredDate || null,
          preferred_time: form.preferredTime || null,
          note: form.note || null,
          status: 'Requested',
          confirmed_date: null,
          confirmed_time: null,
          admin_note: null,
        });
        if (error) {
          console.warn('[visitation_requests insert]', error.message);
          Alert.alert('Saved locally', `Request saved on this device. Cloud sync: ${error.message}`);
        } else {
          const { data: remoteRow } = await supabase
            .from('visitation_requests')
            .select('*')
            .eq('id', requestId)
            .maybeSingle();
          if (remoteRow) {
            await upsertVisitationRequestAfterRemoteInsert(created.id, remoteRow as Record<string, unknown>);
          }
        }
      }

      setForm({ patientId: '', patientName: '', preferredDate: '', preferredTime: '', note: '' });
      await loadAll();
      Alert.alert('Requested', 'Your visitation request has been submitted.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: '#F8F9FD' }]}>
      <FamilyMobilePageHeader title="Appointments" showLogo={false} />

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}>
        <Text style={styles.welcome}>Welcome Back, {firstName}</Text>

        <View style={styles.statsRow}>
          {[
            { label: 'Total', val: requests.length, color: '#6366F1' },
            { label: 'Approved', val: approvedCount, color: '#16A34A' },
            { label: 'Pending', val: pendingCount, color: '#F97316' },
          ].map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={[styles.statVal, { color: s.color }]}>{s.val}</Text>
            </View>
          ))}
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Visitation hours</Text>
          <Text style={styles.muted}>
            {(visitationSettings.days || []).join(', ')} · {visitationSettings.startTime}–{visitationSettings.endTime}
          </Text>

          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Request a visit</Text>
          <Text style={styles.label}>Resident</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
            {patients.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.chip, form.patientId === p.id && styles.chipOn]}
                onPress={() => setForm((f) => ({ ...f, patientId: p.id, patientName: p.name }))}
              >
                <Text style={[styles.chipTxt, form.patientId === p.id && styles.chipTxtOn]} numberOfLines={1}>
                  {p.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {!patients.length ? (
            <Text style={styles.hint}>No active patients on file. Complete an admission first.</Text>
          ) : null}

          <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Calendar</Text>
          <Text style={styles.muted}>Tap an open day to request. Green dates show your confirmed visit day.</Text>
          <View style={styles.calHeader}>
            <TouchableOpacity
              onPress={() =>
                setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
              }
              style={styles.calNavBtn}
              accessibilityLabel="Previous month"
            >
              <Ionicons name="chevron-back" size={22} color="#1B2559" />
            </TouchableOpacity>
            <View style={styles.calMonthCenter}>
              <Text style={styles.calMonthLabel}>{monthLabel}</Text>
              {!isViewingCurrentMonth ? (
                <TouchableOpacity onPress={goToCurrentMonth} style={styles.calTodayBtn} accessibilityRole="button">
                  <Text style={styles.calTodayBtnTxt}>Today</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={() =>
                setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
              }
              style={styles.calNavBtn}
              accessibilityLabel="Next month"
            >
              <Ionicons name="chevron-forward" size={22} color="#1B2559" />
            </TouchableOpacity>
          </View>
          <View style={[styles.weekdayRow, { width: CAL_GRID_WIDTH, gap: CELL_GAP }]}>
            {WEEKDAY_LABELS.map((d) => (
              <View key={d} style={[styles.weekdayCell, { width: CELL }]}>
                <Text style={styles.weekdayTxt}>{d}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.calGrid, { width: CAL_GRID_WIDTH, gap: CELL_GAP }]}>
            {calendarCells.map((cell, idx) => {
              if (!cell) {
                return <View key={`e-${idx}`} style={[styles.calCellEmpty, { width: CELL, height: CELL }]} />;
              }
              const { iso, dayNum, dayOfWeek } = cell;
              const mmdd = iso.slice(5);
              const isHoliday = Boolean(HOLIDAY_LABELS[mmdd]);
              const bookable = isBookableDate(iso, dayOfWeek);
              const selected = form.preferredDate === iso;
              const isToday = iso === todayIso;
              const dayVisits = confirmedByDate.get(iso) || [];
              const hasVisit = dayVisits.length > 0;
              const hasPending = pendingDates.has(iso) && !hasVisit;
              const visitTime = dayVisits[0]?.confirmedTime || '';
              return (
                <TouchableOpacity
                  key={iso}
                  style={[
                    styles.calCell,
                    { width: CELL, height: CELL },
                    !bookable && !hasVisit && !hasPending && styles.calCellDisabled,
                    isHoliday && !hasVisit && !hasPending && !selected && styles.calCellHoliday,
                    bookable && !hasVisit && !hasPending && !selected && styles.calCellBookable,
                    hasPending && !selected && styles.calCellPending,
                    hasVisit && !selected && styles.calCellVisit,
                    selected && styles.calCellSelected,
                    isToday && !selected && styles.calCellToday,
                  ]}
                  onPress={() => {
                    if (!bookable) {
                      const reason = HOLIDAY_LABELS[mmdd]
                        ? HOLIDAY_LABELS[mmdd]
                        : 'Not an available visitation day.';
                      Alert.alert('Date not available', reason);
                      return;
                    }
                    setForm((f) => ({
                      ...f,
                      preferredDate: iso,
                      preferredTime: f.preferredTime || timeSlots[0] || '',
                    }));
                    setFormError('');
                  }}
                  activeOpacity={0.85}
                  accessibilityLabel={
                    hasVisit
                      ? `Your visit on ${formatVisitationWeekdayLong(iso)}${visitTime ? ` at ${visitTime}` : ''}`
                      : hasPending
                        ? `Pending request on ${formatVisitationWeekdayLong(iso)}`
                        : isToday
                          ? `Today, ${iso}`
                          : iso
                  }
                >
                  <Text
                    style={[
                      styles.calCellNum,
                      !bookable && !hasVisit && !hasPending && styles.calCellNumDisabled,
                      selected && styles.calCellNumSelected,
                      hasVisit && !selected && styles.calCellNumVisit,
                      hasPending && !selected && styles.calCellNumPending,
                    ]}
                  >
                    {dayNum}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.legendRow}>
            {[
              { label: 'Your visit', bg: '#DCFCE7', border: '#22C55E' },
              { label: 'Pending request', bg: '#FEF3C7', border: '#F59E0B' },
              { label: 'Available', bg: '#FFF7ED', border: '#F97316' },
              { label: 'Holiday', bg: '#FFF1F2', border: '#F43F5E' },
              { label: 'Unavailable', bg: '#F8FAFC', border: '#E2E8F0' },
            ].map((l) => (
              <View key={l.label} style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: l.bg, borderColor: l.border }]} />
                <Text style={styles.legendTxt}>{l.label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.selectedDateLine}>
            Selected date:{' '}
            <Text style={styles.selectedDateValue}>{form.preferredDate || '—'}</Text>
          </Text>
          {selectedDayLabel ? (
            <Text style={styles.visitDayLine}>Visit day: {selectedDayLabel}</Text>
          ) : null}

          <Text style={styles.label}>Preferred time</Text>
          <View style={styles.slotWrap}>
            {timeSlots.map((slot) => (
              <TouchableOpacity
                key={slot}
                style={[styles.slot, form.preferredTime === slot && styles.slotOn]}
                onPress={() => setForm((f) => ({ ...f, preferredTime: slot }))}
              >
                <Text style={[styles.slotTxt, form.preferredTime === slot && styles.slotTxtOn]}>{slot}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Note (optional)</Text>
          <TextInput
            style={[styles.input, { minHeight: 72 }]}
            multiline
            placeholder="Anything the care team should know"
            placeholderTextColor="#94A3B8"
            value={form.note}
            onChangeText={(v) => setForm((f) => ({ ...f, note: v }))}
          />

          {formError ? <Text style={styles.err}>{formError}</Text> : null}

          <TouchableOpacity style={styles.primaryBtn} onPress={() => void submitRequest()} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnTxt}>Submit request</Text>}
          </TouchableOpacity>
        </View>

        <View style={[styles.panel, { marginTop: 14 }]}>
          <View style={styles.reqHeaderRow}>
            <Text style={styles.sectionTitle}>Appointment status</Text>
            <Text style={styles.reqTotal}>{requests.length} total</Text>
          </View>
          {requests.length === 0 ? (
            <Text style={styles.muted}>No visitation requests yet. Use the calendar to book your first slot.</Text>
          ) : (
            requests.map((r) => {
              const st = normalizeVisitationStatus(r.status);
              const stCfg = STATUS_CFG[st] || STATUS_CFG.Requested;
              return (
                <View key={r.id} style={styles.reqCard}>
                  <View style={styles.reqCardTop}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.reqName}>{r.patientName}</Text>
                      <Text style={styles.reqMeta}>
                        {r.confirmedDate
                          ? `${formatVisitationWeekdayLong(r.confirmedDate)}, ${r.confirmedDate}`
                          : r.preferredDate}{' '}
                        · {r.confirmedTime || r.preferredTime}
                      </Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: stCfg.bg, borderColor: stCfg.border }]}>
                      <Text style={[styles.statusPillTxt, { color: stCfg.color }]}>{st}</Text>
                    </View>
                  </View>
                  <Text style={styles.reqSubtext}>{visitationStatusSubtext(r)}</Text>
                  {st === 'Rescheduled' && String(r.adminNote || '').trim() ? (
                    <View style={styles.adminNoteBox}>
                      <Text style={styles.adminNoteTxt}>Admin: {r.adminNote}</Text>
                    </View>
                  ) : null}
                  {r.note ? <Text style={styles.reqNote}>{r.note}</Text> : null}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <FamilyWebMobileNav active="appointments" />
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
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  statLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' },
  statVal: { fontSize: 22, fontWeight: '900', marginTop: 4 },
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    padding: 16,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#1B2559' },
  muted: { fontSize: 13, color: '#64748B', fontWeight: '600', marginTop: 6 },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 8,
  },
  calNavBtn: { padding: 8, borderRadius: 10, backgroundColor: '#F1F5F9' },
  calMonthCenter: { alignItems: 'center', gap: 4 },
  calMonthLabel: { fontSize: 16, fontWeight: '800', color: '#1B2559' },
  calTodayBtn: {
    borderWidth: 1,
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  calTodayBtnTxt: { fontSize: 11, fontWeight: '800', color: '#4338CA' },
  weekdayRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignSelf: 'center',
    marginBottom: 4,
  },
  weekdayCell: { alignItems: 'center', justifyContent: 'center' },
  weekdayTxt: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'center',
    marginTop: 4,
  },
  calCellEmpty: { backgroundColor: 'transparent' },
  calCell: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  calCellDisabled: { backgroundColor: '#F8FAFC', borderColor: '#F1F5F9' },
  calCellBookable: { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' },
  calCellHoliday: { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' },
  calCellVisit: { backgroundColor: '#DCFCE7', borderColor: '#22C55E' },
  calCellPending: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
  calCellSelected: { borderColor: '#F54E25', backgroundColor: '#FFF7F4', borderWidth: 2 },
  calCellToday: { borderColor: '#6366F1', borderWidth: 2 },
  calCellNum: { fontSize: 14, fontWeight: '800', color: '#1B2559' },
  calCellNumDisabled: { color: '#CBD5E1', fontWeight: '600' },
  calCellNumSelected: { color: '#F54E25' },
  calCellNumVisit: { color: '#166534' },
  calCellNumPending: { color: '#92400E' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSwatch: { width: 10, height: 10, borderRadius: 3, borderWidth: 1 },
  legendTxt: { fontSize: 10, fontWeight: '700', color: '#64748B' },
  selectedDateLine: { marginTop: 12, fontSize: 13, color: '#64748B', fontWeight: '600' },
  selectedDateValue: { fontWeight: '800', color: '#1B2559' },
  visitDayLine: { marginTop: 4, fontSize: 12, fontWeight: '800', color: '#166534' },
  label: { fontSize: 12, fontWeight: '700', color: '#475569', marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1B2559',
    backgroundColor: '#FFFFFF',
  },
  chipsRow: { flexDirection: 'row', marginBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
    maxWidth: 200,
  },
  chipOn: { borderColor: '#F54E25', backgroundColor: '#FFF7F4' },
  chipTxt: { fontSize: 13, fontWeight: '700', color: '#334155' },
  chipTxtOn: { color: '#F54E25' },
  hint: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic', marginTop: 4 },
  slotWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  slotOn: { borderColor: '#F54E25', backgroundColor: '#FFF7F4' },
  slotTxt: { fontSize: 13, fontWeight: '700', color: '#1B2559' },
  slotTxtOn: { color: '#F54E25' },
  err: { marginTop: 10, color: '#b91c1c', fontWeight: '700', fontSize: 13 },
  primaryBtn: {
    marginTop: 16,
    backgroundColor: '#F54E25',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryBtnTxt: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  reqHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  reqTotal: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
  reqCard: {
    borderWidth: 1,
    borderColor: '#E9EDF7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#FBFDFF',
  },
  reqCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  reqName: { fontSize: 15, fontWeight: '800', color: '#1B2559' },
  reqMeta: { fontSize: 12, color: '#64748B', fontWeight: '600', marginTop: 4 },
  reqSubtext: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 8 },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPillTxt: { fontSize: 10, fontWeight: '800' },
  adminNoteBox: {
    marginTop: 8,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  adminNoteTxt: { fontSize: 11, fontWeight: '700', color: '#3730A3' },
  reqNote: { fontSize: 12, color: '#475569', marginTop: 6 },
});
