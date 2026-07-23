import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
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
import { isPastIsoDate } from '../../lib/bookingDates';
import { FamilyMobilePageHeader } from '../../components/family/FamilyMobilePageHeader';
import { useFamilyPageScroll } from '../../lib/useFamilyPageScroll';
import { FamilyWebMobileNav } from '../../components/family/FamilyWebMobileNav';
import { FamilyFloatingChat } from '../../components/family/FamilyFloatingChat';

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

const CAL_GAP = 6;
/** Horizontal padding: scroll 32 + panel 40 */
const CAL_HORIZONTAL_PAD = 72;

// Native pixel size of assets/images/appointments-header.png — sets the
// hero's aspect ratio so the full illustration renders with no crop.
const HERO_IMG_NATURAL_W = 1672;
const HERO_IMG_NATURAL_H = 836;

function useCalendarGridLayout() {
  const { width: screenWidth } = useWindowDimensions();
  return useMemo(() => {
    const inner = Math.max(0, screenWidth - CAL_HORIZONTAL_PAD);
    const cell = Math.max(38, Math.floor((inner - CAL_GAP * 6) / 7));
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

type PatientOpt = { id: string; name: string };

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function isoLocalDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export default function AppointmentsScreen() {
  const insets = useSafeAreaInsets();
  const { scrollRef, scrollToTop } = useFamilyPageScroll();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const { cell: CELL, gridWidth: CAL_GRID_WIDTH, gap: CELL_GAP } = useCalendarGridLayout();
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
    appointmentReason: '',
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
    if (isPastIsoDate(iso)) return false;
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
    if (!String(form.appointmentReason || '').trim()) {
      setFormError('Please enter a reason for this appointment.');
      return;
    }
    if (isPastIsoDate(form.preferredDate)) {
      setFormError('Please choose today or a future date.');
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
          appointment_reason: form.appointmentReason.trim() || null,
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

      setForm({ patientId: '', patientName: '', preferredDate: '', preferredTime: '', appointmentReason: '', note: '' });
      await loadAll();
      Alert.alert('Requested', 'Your visitation request has been submitted.');
    } finally {
      setSaving(false);
    }
  };

  const heroHeight = screenWidth * (HERO_IMG_NATURAL_H / HERO_IMG_NATURAL_W);

  return (
    <View style={styles.screen}>
      <FamilyMobilePageHeader title="Appointments" onBrandPress={scrollToTop} />

      <ScrollView
        ref={scrollRef}
        style={styles.heroOverlapScroll}
        contentContainerStyle={[styles.scroll, { paddingTop: 0, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroWrap, { height: heroHeight }]}>
          <Image
            source={require('../../assets/images/appointments-header.png')}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroText}>
              Manage your <Text style={styles.heroTextAccent}>appointments</Text> and stay on track with care.
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          {[
            { label: 'Total', val: requests.length, color: '#4F46E5', bg: '#EEF2FF', iconBg: '#E0E7FF', icon: 'people' as const, caption: 'All time' },
            { label: 'Confirmed', val: approvedCount, color: '#15803D', bg: '#ECFDF5', iconBg: '#D1FAE5', icon: 'checkmark-circle' as const, caption: 'This month' },
            { label: 'Pending', val: pendingCount, color: '#EA580C', bg: '#FFF7ED', iconBg: '#FFEDD5', icon: 'time' as const, caption: 'This month' },
          ].map((s) => (
            <Pressable
              key={s.label}
              style={({ pressed }) => [styles.statCard, { backgroundColor: s.bg }, pressed && styles.statCardPressed]}
            >
              <View style={[styles.statIconWrap, { backgroundColor: s.iconBg }]}>
                <Ionicons name={s.icon} size={15} color={s.color} />
              </View>
              <View style={styles.statTextCol}>
                <Text style={styles.statLabel}>{s.label.toUpperCase()}</Text>
                <Text style={[styles.statVal, { color: s.color }]}>{s.val}</Text>
                <Text style={styles.statCaption}>{s.caption}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Visitation hours</Text>
          <Text style={styles.muted}>
            {(visitationSettings.days || []).join(', ')} · {visitationSettings.startTime}–{visitationSettings.endTime}
          </Text>

          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Request a visit</Text>
          <Text style={styles.label}>Resident</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
            {patients.map((p) => (
              <Pressable
                key={p.id}
                style={({ pressed }) => [
                  styles.chip,
                  form.patientId === p.id && styles.chipOn,
                  pressed && styles.chipPressed,
                ]}
                onPress={() => setForm((f) => ({ ...f, patientId: p.id, patientName: p.name }))}
              >
                <Text style={[styles.chipTxt, form.patientId === p.id && styles.chipTxtOn]} numberOfLines={1}>
                  {p.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {!patients.length ? (
            <Text style={styles.hint}>No active patients on file. Complete an admission first.</Text>
          ) : null}

          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Calendar</Text>
          <Text style={styles.muted}>Tap an open day to request. Green dates show your confirmed visit day.</Text>

          <View style={styles.calHero}>
          <View style={styles.calHeader}>
            <Pressable
              onPress={() =>
                setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
              }
              style={({ pressed }) => [styles.calNavBtn, pressed && styles.calNavBtnPressed]}
              accessibilityLabel="Previous month"
            >
              <Ionicons name="chevron-back" size={22} color="#1B2559" />
            </Pressable>
            <View style={styles.calMonthCenter}>
              <Text style={styles.calMonthLabel}>{monthLabel}</Text>
              {!isViewingCurrentMonth ? (
                <Pressable
                  onPress={goToCurrentMonth}
                  style={({ pressed }) => [styles.calTodayBtn, pressed && styles.calTodayBtnPressed]}
                  accessibilityRole="button"
                >
                  <Text style={styles.calTodayBtnTxt}>Today</Text>
                </Pressable>
              ) : null}
            </View>
            <Pressable
              onPress={() =>
                setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
              }
              style={({ pressed }) => [styles.calNavBtn, pressed && styles.calNavBtnPressed]}
              accessibilityLabel="Next month"
            >
              <Ionicons name="chevron-forward" size={22} color="#1B2559" />
            </Pressable>
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
                <Pressable
                  key={iso}
                  style={({ pressed }) => [
                    styles.calCell,
                    { width: CELL, height: CELL },
                    !bookable && !hasVisit && !hasPending && styles.calCellDisabled,
                    isHoliday && !hasVisit && !hasPending && !selected && styles.calCellHoliday,
                    bookable && !hasVisit && !hasPending && !selected && styles.calCellBookable,
                    hasPending && !selected && styles.calCellPending,
                    hasVisit && !selected && styles.calCellVisit,
                    selected && styles.calCellSelected,
                    isToday && !selected && styles.calCellToday,
                    pressed && styles.calCellPressed,
                  ]}
                  onPress={() => {
                    if (!bookable) {
                      const reason = isPastIsoDate(iso)
                        ? 'Past dates cannot be booked.'
                        : HOLIDAY_LABELS[mmdd]
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
                </Pressable>
              );
            })}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.legendRow}>
            {[
              { label: 'Your visit', bg: '#DCFCE7', border: '#22C55E', dot: '#16A34A' },
              { label: 'Pending', bg: '#FEF3C7', border: '#F59E0B', dot: '#D97706' },
              { label: 'Available', bg: '#FFF7ED', border: '#FDBA74', dot: '#EA580C' },
              { label: 'Holiday', bg: '#FFF1F2', border: '#FDA4AF', dot: '#E11D48' },
              { label: 'Unavailable', bg: '#F8FAFC', border: '#E2E8F0', dot: '#94A3B8' },
            ].map((l) => (
              <View key={l.label} style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: l.bg, borderColor: l.border }]}>
                  <View style={[styles.legendDot, { backgroundColor: l.dot }]} />
                </View>
                <Text style={styles.legendTxt}>{l.label}</Text>
              </View>
            ))}
          </ScrollView>
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
              <Pressable
                key={slot}
                style={({ pressed }) => [
                  styles.slot,
                  form.preferredTime === slot && styles.slotOn,
                  pressed && styles.slotPressed,
                ]}
                onPress={() => setForm((f) => ({ ...f, preferredTime: slot }))}
              >
                <Text style={[styles.slotTxt, form.preferredTime === slot && styles.slotTxtOn]}>{slot}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Reason for appointment</Text>
          <TextInput
            style={styles.input}
            placeholder="Why are you scheduling this visit?"
            placeholderTextColor="#94A3B8"
            value={form.appointmentReason}
            onChangeText={(v) => setForm((f) => ({ ...f, appointmentReason: v }))}
          />

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

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed, saving && styles.primaryBtnDisabled]}
            onPress={() => void submitRequest()}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnTxt}>Submit request</Text>}
          </Pressable>
        </View>

        <View style={[styles.panel, styles.statusPanel]}>
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
  screen: { flex: 1, backgroundColor: '#F8FAFF' },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },
  heroOverlapScroll: { flex: 1 },
  heroWrap: {
    marginHorizontal: -16,
    marginBottom: 16,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
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
  heroTextWrap: { paddingHorizontal: 22, paddingTop: 20, maxWidth: '64%' },
  heroText: { fontSize: 19, fontWeight: '800', lineHeight: 25, color: '#FFFFFF' },
  heroTextAccent: { color: '#FDBA74' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20, zIndex: 1 },
  statCard: {
    flex: 1,
    minHeight: 88,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(233, 237, 247, 0.85)',
    paddingVertical: 12,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
    }),
  },
  statCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  statIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statTextCol: { flex: 1, minWidth: 0 },
  statLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.1,
  },
  statVal: { fontSize: 18, fontWeight: '900', marginTop: 2, letterSpacing: -0.5 },
  statCaption: { fontSize: 8.5, fontWeight: '600', color: '#94A3B8', marginTop: 1 },
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(233, 237, 247, 0.9)',
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 14,
      },
      android: { elevation: 2 },
    }),
  },
  statusPanel: { marginTop: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1B2559', letterSpacing: -0.2 },
  sectionTitleSpaced: { marginTop: 20 },
  muted: { fontSize: 14, color: '#64748B', fontWeight: '500', marginTop: 8, lineHeight: 20 },
  calHero: {
    marginTop: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FAFBFF',
    borderWidth: 1,
    borderColor: 'rgba(233, 237, 247, 0.75)',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 20,
      },
      android: { elevation: 3 },
    }),
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calNavBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E9EDF7',
  },
  calNavBtnPressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  calMonthCenter: { alignItems: 'center', gap: 6, flex: 1, paddingHorizontal: 8 },
  calMonthLabel: { fontSize: 18, fontWeight: '800', color: '#1B2559', letterSpacing: -0.2 },
  calTodayBtn: {
    borderWidth: 1,
    borderColor: '#FED7AA',
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    minHeight: 32,
    justifyContent: 'center',
  },
  calTodayBtnPressed: { opacity: 0.88, transform: [{ scale: 0.97 }] },
  calTodayBtnTxt: { fontSize: 12, fontWeight: '800', color: '#EA580C' },
  weekdayRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignSelf: 'center',
    marginBottom: 8,
  },
  weekdayCell: { alignItems: 'center', justifyContent: 'center' },
  weekdayTxt: { fontSize: 12, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.3 },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'center',
    marginTop: 4,
  },
  calCellEmpty: { backgroundColor: 'transparent' },
  calCell: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  calCellPressed: { opacity: 0.88, transform: [{ scale: 0.94 }] },
  calCellDisabled: { backgroundColor: '#F8FAFC', borderColor: '#F1F5F9' },
  calCellBookable: { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' },
  calCellHoliday: { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' },
  calCellVisit: { backgroundColor: '#DCFCE7', borderColor: '#4ADE80' },
  calCellPending: { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' },
  calCellSelected: {
    borderColor: '#F54E25',
    backgroundColor: '#FFF7F4',
    borderWidth: 2,
    ...Platform.select({
      ios: {
        shadowColor: '#F54E25',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
    }),
  },
  calCellToday: { borderColor: '#6366F1', borderWidth: 2 },
  calCellNum: { fontSize: 15, fontWeight: '800', color: '#1B2559' },
  calCellNumDisabled: { color: '#CBD5E1', fontWeight: '600' },
  calCellNumSelected: { color: '#F54E25' },
  calCellNumVisit: { color: '#166534' },
  calCellNumPending: { color: '#92400E' },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 16,
    paddingVertical: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendSwatch: {
    width: 20,
    height: 20,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendTxt: { fontSize: 12, fontWeight: '700', color: '#475569' },
  selectedDateLine: { marginTop: 16, fontSize: 14, color: '#64748B', fontWeight: '500' },
  selectedDateValue: { fontWeight: '800', color: '#1B2559' },
  visitDayLine: { marginTop: 6, fontSize: 13, fontWeight: '700', color: '#166534' },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E9EDF7',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1B2559',
    backgroundColor: '#FAFBFF',
    minHeight: 48,
  },
  chipsRow: { flexDirection: 'row', marginBottom: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    marginRight: 10,
    maxWidth: 200,
    backgroundColor: '#FFFFFF',
    minHeight: 44,
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: { elevation: 1 },
    }),
  },
  chipOn: {
    borderColor: '#F54E25',
    backgroundColor: '#FFF7F4',
    ...Platform.select({
      ios: {
        shadowColor: '#F54E25',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  chipPressed: { opacity: 0.9, transform: [{ scale: 0.97 }] },
  chipTxt: { fontSize: 14, fontWeight: '700', color: '#334155' },
  chipTxtOn: { color: '#F54E25' },
  hint: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic', marginTop: 8, lineHeight: 18 },
  slotWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slot: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    backgroundColor: '#FFFFFF',
    minHeight: 44,
    justifyContent: 'center',
  },
  slotOn: { borderColor: '#F54E25', backgroundColor: '#FFF7F4' },
  slotPressed: { opacity: 0.9, transform: [{ scale: 0.97 }] },
  slotTxt: { fontSize: 14, fontWeight: '700', color: '#1B2559' },
  slotTxtOn: { color: '#F54E25' },
  err: { marginTop: 12, color: '#B91C1C', fontWeight: '700', fontSize: 13, lineHeight: 18 },
  primaryBtn: {
    marginTop: 20,
    backgroundColor: '#F54E25',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#F54E25',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.28,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
  },
  primaryBtnPressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnTxt: { color: '#FFFFFF', fontWeight: '800', fontSize: 16, letterSpacing: 0.2 },
  reqHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reqTotal: { fontSize: 12, fontWeight: '700', color: '#94A3B8' },
  reqCard: {
    borderWidth: 1,
    borderColor: '#E9EDF7',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#FAFBFF',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: { elevation: 1 },
    }),
  },
  reqCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  reqName: { fontSize: 16, fontWeight: '800', color: '#1B2559' },
  reqMeta: { fontSize: 13, color: '#64748B', fontWeight: '500', marginTop: 4, lineHeight: 18 },
  reqSubtext: { fontSize: 12, color: '#94A3B8', fontWeight: '600', marginTop: 10, lineHeight: 17 },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillTxt: { fontSize: 11, fontWeight: '800' },
  adminNoteBox: {
    marginTop: 10,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  adminNoteTxt: { fontSize: 12, fontWeight: '700', color: '#3730A3', lineHeight: 17 },
  reqNote: { fontSize: 13, color: '#475569', marginTop: 8, lineHeight: 19 },
});
