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
  Modal,
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
  isAwaitingFamilyRescheduleResponse,
  acceptVisitationReschedule,
  counterProposeVisitationReschedule,
  type VisitationRequestRow,
} from '../../lib/visitationAppointmentsMobile';
import { PlatformDateTimeField } from '../../components/family/PlatformDateTimeField';
import { isPastIsoDate } from '../../lib/bookingDates';
import { FamilyMobilePageHeader } from '../../components/family/FamilyMobilePageHeader';
import { useFamilyPageScroll } from '../../lib/useFamilyPageScroll';
import { FamilyWebMobileNav } from '../../components/family/FamilyWebMobileNav';

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

const STATUS_CFG: Record<string, { bg: string; color: string; border: string; icon: keyof typeof Ionicons.glyphMap }> = {
  Approved: { bg: '#DCFCE7', color: '#166534', border: '#BBF7D0', icon: 'checkmark-circle-outline' },
  Declined: { bg: '#FEE2E2', color: '#991B1B', border: '#FECACA', icon: 'close-circle-outline' },
  Rescheduled: { bg: '#E0E7FF', color: '#3730A3', border: '#C7D2FE', icon: 'swap-horizontal-outline' },
  Requested: { bg: '#FEF3C7', color: '#92400E', border: '#FDE68A', icon: 'time-outline' },
};

const AVATAR_PALETTE = [
  { bg: '#E0E7FF', color: '#4338CA' },
  { bg: '#F3E8FF', color: '#7E22CE' },
  { bg: '#DBEAFE', color: '#1D4ED8' },
  { bg: '#FCE7F3', color: '#BE185D' },
] as const;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

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

function formatReqDateTime(dateIso: string, time: string): string {
  if (!dateIso) return '';
  const d = new Date(`${dateIso}T12:00:00`);
  const dateStr = Number.isNaN(d.getTime())
    ? dateIso
    : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const [hh, mm] = (time || '').split(':').map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return dateStr;
  const period = hh >= 12 ? 'PM' : 'AM';
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${dateStr} · ${hour12}:${pad2(mm)} ${period}`;
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
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [counterModal, setCounterModal] = useState<{ row: VisitationRequestRow | null; date: string; time: string }>({
    row: null,
    date: '',
    time: '13:00',
  });
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
  const approvedCount = requests.filter((r) => normalizeVisitationStatus(r.status) === 'Approved').length;
  const pendingCount = requests.filter((r) => normalizeVisitationStatus(r.status) === 'Requested').length;
  const selectedDayLabel = form.preferredDate ? formatVisitationWeekdayLong(form.preferredDate) : '';
  const selectedDateLong = form.preferredDate
    ? new Date(`${form.preferredDate}T12:00:00`).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

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

  const acceptReschedule = async (row: VisitationRequestRow) => {
    setRespondingId(row.id);
    const res = await acceptVisitationReschedule(row.id);
    setRespondingId(null);
    if (!res.ok) {
      Alert.alert('Could not accept', res.errorMessage);
      return;
    }
    await loadAll();
    Alert.alert('Schedule accepted', `You've confirmed the visit for ${row.patientName}.`);
  };

  const openCounterModal = (row: VisitationRequestRow) => {
    setCounterModal({ row, date: row.preferredDate || row.confirmedDate || '', time: row.preferredTime || row.confirmedTime || '13:00' });
  };

  const submitCounterProposal = async () => {
    if (!counterModal.row || !counterModal.date || !counterModal.time) return;
    setRespondingId(counterModal.row.id);
    const res = await counterProposeVisitationReschedule(counterModal.row.id, {
      preferredDate: counterModal.date,
      preferredTime: counterModal.time,
      note: counterModal.row.note,
    });
    setRespondingId(null);
    if (!res.ok) {
      Alert.alert('Could not send', res.errorMessage);
      return;
    }
    setCounterModal({ row: null, date: '', time: '13:00' });
    await loadAll();
    Alert.alert('Sent', 'Your preferred time has been sent to the facility.');
  };

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

        <View style={styles.statsWrap}>
          <View style={styles.statsSquareRow}>
            {[
              { label: 'Confirmed', val: approvedCount, color: '#15803D', bg: '#ECFDF5', iconBg: '#D1FAE5', icon: 'checkmark-circle-outline' as const, caption: 'This month' },
              { label: 'Total', val: requests.length, color: '#4F46E5', bg: '#EEF2FF', iconBg: '#E0E7FF', icon: 'people' as const, caption: 'All time' },
              { label: 'Pending', val: pendingCount, color: '#EA580C', bg: '#FFF7ED', iconBg: '#FFEDD5', icon: 'time-outline' as const, caption: 'This month' },
            ].map((s) => (
              <Pressable
                key={s.label}
                style={({ pressed }) => [styles.statCardSquare, { backgroundColor: s.bg }, pressed && styles.statCardPressed]}
              >
                <View style={[styles.statIconWrapLg, { backgroundColor: s.iconBg }]}>
                  <Ionicons name={s.icon} size={26} color={s.color} />
                </View>
                <View style={styles.statTextCol}>
                  <Text style={[styles.statLabel, { color: s.color }]}>{s.label.toUpperCase()}</Text>
                  <Text style={[styles.statVal, { color: s.color }]}>{s.val}</Text>
                  <Text style={styles.statCaption}>{s.caption}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionCardHeader}>
            <View style={[styles.sectionIconWrap, { backgroundColor: '#E0E7FF' }]}>
              <Ionicons name="time-outline" size={20} color="#4F46E5" />
            </View>
            <Text style={styles.sectionCardTitle}>Visitation Hours</Text>
          </View>
          <View style={styles.visitInfoRow}>
            <View style={[styles.visitInfoItem, styles.visitInfoItemShrink]}>
              <Ionicons name="calendar-outline" size={16} color="#4F46E5" />
              <Text style={styles.visitInfoTxt} numberOfLines={1} ellipsizeMode="tail">
                {(visitationSettings.days || []).join(', ')}
              </Text>
            </View>
            <View style={styles.visitInfoDivider} />
            <View style={[styles.visitInfoItem, styles.visitInfoItemFixed]}>
              <Ionicons name="time-outline" size={16} color="#4F46E5" />
              <Text style={styles.visitInfoTxt} numberOfLines={1}>
                {visitationSettings.startTime}–{visitationSettings.endTime}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionCardHeader}>
            <View style={[styles.sectionIconWrap, { backgroundColor: '#FFE4D6' }]}>
              <Ionicons name="people" size={19} color="#F0851F" />
            </View>
            <View>
              <Text style={styles.sectionCardTitle}>Request a Visit</Text>
              <Text style={styles.sectionCardSubtitleTight}>Select resident</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
            {patients.map((p, idx) => {
              const on = form.patientId === p.id;
              const avatar = AVATAR_PALETTE[idx % AVATAR_PALETTE.length];
              return (
                <Pressable
                  key={p.id}
                  style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.chipPressed]}
                  onPress={() => setForm((f) => ({ ...f, patientId: p.id, patientName: p.name }))}
                >
                  <View style={[styles.chipAvatar, { backgroundColor: avatar.bg }]}>
                    <Text style={[styles.chipAvatarTxt, { color: avatar.color }]}>{getInitials(p.name)}</Text>
                  </View>
                  <Text style={styles.chipTxt} numberOfLines={2}>
                    {p.name}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={on ? '#F54E25' : '#475569'} />
                </Pressable>
              );
            })}
          </ScrollView>
          {!patients.length ? (
            <Text style={styles.hint}>No active patients on file. Complete an admission first.</Text>
          ) : null}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionCardHeader}>
            <View style={[styles.sectionIconWrap, { backgroundColor: '#E0E7FF' }]}>
              <Ionicons name="calendar" size={19} color="#4F46E5" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionCardTitle}>Schedule a Visit</Text>
              <Text style={styles.sectionCardSubtitleTight}>Choose a date and time that works best.</Text>
            </View>
            <Pressable
              onPress={goToCurrentMonth}
              style={({ pressed }) => [styles.calTodayBtn, pressed && styles.calTodayBtnPressed]}
              accessibilityRole="button"
            >
              <Ionicons name="calendar-outline" size={13} color="#4F46E5" />
              <Text style={styles.calTodayBtnTxt}>Today</Text>
            </Pressable>
          </View>

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
          <View style={styles.legendCard}>
            <View style={styles.legendRow}>
              {[
                { label: 'Your visit', ring: '#22C55E', dot: '#16A34A' },
                { label: 'Pending', ring: '#F59E0B', dot: '#D97706' },
                { label: 'Available', ring: '#FDBA74', dot: '#EA580C' },
                { label: 'Holiday', ring: '#FDA4AF', dot: '#E11D48' },
              ].map((l) => (
                <View key={l.label} style={styles.legendItem}>
                  <View style={[styles.legendRing, { borderColor: l.ring }]}>
                    <View style={[styles.legendDot, { backgroundColor: l.dot }]} />
                  </View>
                  <Text style={styles.legendTxt}>{l.label}</Text>
                </View>
              ))}
            </View>
          </View>
          </View>
          <View style={styles.selectedDateCard}>
            <View style={styles.selectedDateLeft}>
              <View style={styles.selectedDateIconWrap}>
                <Ionicons name="calendar" size={16} color="#4F46E5" />
              </View>
              <View>
                <Text style={styles.selectedDateLabel}>Selected Date</Text>
                <Text style={styles.selectedDateValue}>{selectedDateLong || '—'}</Text>
              </View>
            </View>
            {form.preferredDate ? (
              <Pressable
                onPress={() => setForm((f) => ({ ...f, preferredDate: '' }))}
                style={({ pressed }) => [styles.editDateBtn, pressed && styles.calTodayBtnPressed]}
                accessibilityRole="button"
              >
                <Ionicons name="calendar-outline" size={13} color="#4F46E5" />
                <Text style={styles.editDateBtnTxt}>Edit Date</Text>
              </Pressable>
            ) : null}
          </View>
          {selectedDayLabel ? (
            <Text style={styles.visitDayLine}>Visit Day: {selectedDayLabel}</Text>
          ) : null}

          <Text style={styles.label}>Preferred Time</Text>
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
          <View style={styles.inputRow}>
            <Ionicons name="chatbubble-outline" size={16} color="#94A3B8" />
            <TextInput
              style={styles.inputRowField}
              placeholder="Why are you scheduling this visit?"
              placeholderTextColor="#94A3B8"
              value={form.appointmentReason}
              onChangeText={(v) => setForm((f) => ({ ...f, appointmentReason: v }))}
            />
          </View>

          <Text style={styles.label}>Note (optional)</Text>
          <View style={styles.inputRow}>
            <Ionicons name="create-outline" size={16} color="#94A3B8" />
            <TextInput
              style={styles.inputRowField}
              placeholder="Anything the care team should know"
              placeholderTextColor="#94A3B8"
              value={form.note}
              onChangeText={(v) => setForm((f) => ({ ...f, note: v }))}
            />
          </View>

          {formError ? <Text style={styles.err}>{formError}</Text> : null}

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed, saving && styles.primaryBtnDisabled]}
            onPress={() => void submitRequest()}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnTxt}>Submit Request</Text>}
          </Pressable>
        </View>

        <View style={[styles.panel, styles.statusPanel]}>
          <View style={styles.reqHeaderRow}>
            <View style={styles.reqHeaderLeft}>
              <View style={styles.reqHeaderIconWrap}>
                <Ionicons name="clipboard-outline" size={16} color="#4F46E5" />
              </View>
              <Text style={styles.reqHeaderTitle}>Appointment Status</Text>
            </View>
            <Text style={styles.reqTotal}>{requests.length} total</Text>
          </View>
          {requests.length === 0 ? (
            <Text style={styles.muted}>No visitation requests yet. Use the calendar to book your first slot.</Text>
          ) : (
            requests.map((r, idx) => {
              const st = normalizeVisitationStatus(r.status);
              const stCfg = STATUS_CFG[st] || STATUS_CFG.Requested;
              const adminReason = String(r.adminNote || '').trim();
              const compactSubtext =
                st === 'Declined'
                  ? 'Declined by the facility'
                  : st === 'Requested'
                    ? 'Waiting for admin decision'
                    : st === 'Approved'
                      ? 'Confirmed for this visit'
                      : st === 'Rescheduled'
                        ? adminReason || 'Rescheduled by the facility'
                        : visitationStatusSubtext(r);
              const note = String(r.note || '').trim();
              const showNote = note && note.toUpperCase() !== 'N/A';
              return (
                <View
                  key={r.id}
                  style={[styles.reqRow, idx < requests.length - 1 && styles.reqRowDivider]}
                >
                  <View style={styles.reqAvatar}>
                    <Text style={styles.reqAvatarTxt}>{getInitials(r.patientName)}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.reqName}>{r.patientName}</Text>
                    <Text style={styles.reqMeta} numberOfLines={1}>
                      {formatReqDateTime(r.confirmedDate || r.preferredDate, r.confirmedTime || r.preferredTime)}
                    </Text>
                    <View style={styles.reqSubtextRow}>
                      <Ionicons name={stCfg.icon} size={12} color="#94A3B8" />
                      <Text style={styles.reqSubtext} numberOfLines={1}>
                        {compactSubtext}
                      </Text>
                    </View>
                    {showNote ? (
                      <Text style={styles.reqNote} numberOfLines={1}>
                        {note}
                      </Text>
                    ) : null}
                    {st === 'Rescheduled' && r.confirmedByFamily ? (
                      <View style={styles.confirmedBadge}>
                        <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                        <Text style={styles.confirmedBadgeTxt}>You confirmed this time</Text>
                      </View>
                    ) : null}
                    {isAwaitingFamilyRescheduleResponse(r) ? (
                      <View style={styles.rescheduleActions}>
                        <Pressable
                          style={({ pressed }) => [styles.rescheduleBtnAccept, pressed && styles.primaryBtnPressed]}
                          onPress={() => void acceptReschedule(r)}
                          disabled={respondingId === r.id}
                        >
                          {respondingId === r.id ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                          ) : (
                            <Text style={styles.rescheduleBtnAcceptTxt}>Accept this time</Text>
                          )}
                        </Pressable>
                        <Pressable
                          style={({ pressed }) => [styles.rescheduleBtnCounter, pressed && styles.primaryBtnPressed]}
                          onPress={() => openCounterModal(r)}
                          disabled={respondingId === r.id}
                        >
                          <Text style={styles.rescheduleBtnCounterTxt}>Propose a different time</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.reqRight}>
                    <View style={[styles.statusPill, { backgroundColor: stCfg.bg, borderColor: stCfg.border }]}>
                      <Text style={[styles.statusPillTxt, { color: stCfg.color }]}>{st}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal
        visible={Boolean(counterModal.row)}
        transparent
        animationType="slide"
        onRequestClose={() => setCounterModal({ row: null, date: '', time: '13:00' })}
      >
        <View style={styles.counterModalRoot}>
          <Pressable style={styles.counterBackdrop} onPress={() => setCounterModal({ row: null, date: '', time: '13:00' })} />
          <View style={[styles.counterCard, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.counterHandle} />
            <Text style={styles.counterTitle}>Propose a different time</Text>
            <Text style={styles.counterSub}>
              For {counterModal.row?.patientName}. This will be sent to the facility for review.
            </Text>
            <PlatformDateTimeField
              label="Preferred date"
              mode="date"
              value={counterModal.date}
              minimumDate={new Date()}
              onChange={(v) => setCounterModal((prev) => ({ ...prev, date: v }))}
            />
            <PlatformDateTimeField
              label="Preferred time"
              mode="time"
              value={counterModal.time}
              onChange={(v) => setCounterModal((prev) => ({ ...prev, time: v }))}
            />
            <View style={styles.counterFoot}>
              <Pressable onPress={() => setCounterModal({ row: null, date: '', time: '13:00' })} style={styles.counterCancelBtn}>
                <Text style={styles.counterCancelTxt}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void submitCounterProposal()}
                style={[styles.primaryBtn, { flex: 1, marginTop: 0 }, respondingId === counterModal.row?.id && styles.primaryBtnDisabled]}
                disabled={respondingId === counterModal.row?.id}
              >
                {respondingId === counterModal.row?.id ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnTxt}>Send</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <FamilyWebMobileNav active="appointments" />
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
  heroTextWrap: { paddingHorizontal: 22, maxWidth: '60%' },
  heroText: { fontSize: 19, fontWeight: '800', lineHeight: 25, color: '#FFFFFF' },
  heroTextAccent: { color: '#F0851F' },
  statsWrap: { marginBottom: 20, zIndex: 1 },
  statsSquareRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  statCardSquare: {
    flex: 1,
    minHeight: 88,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(233, 237, 247, 0.85)',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
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
  statIconWrapLg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statTextCol: { alignItems: 'center', minWidth: 0 },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  statVal: { fontSize: 20, fontWeight: '900', marginTop: 3, letterSpacing: -0.5, textAlign: 'center' },
  statCaption: { fontSize: 9, fontWeight: '600', color: '#94A3B8', marginTop: 2, textAlign: 'center' },
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
  muted: { fontSize: 14, color: '#64748B', fontWeight: '500', marginTop: 8, lineHeight: 20 },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(233, 237, 247, 0.9)',
    padding: 16,
    marginBottom: 14,
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
  sectionCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sectionCardTitle: { fontSize: 16, fontWeight: '800', color: '#1B2559', letterSpacing: -0.2 },
  sectionCardSubtitle: { fontSize: 12.5, fontWeight: '600', color: '#94A3B8', marginTop: 10 },
  sectionCardSubtitleTight: { fontSize: 12.5, fontWeight: '600', color: '#94A3B8', marginTop: 2 },
  visitInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 8,
    marginTop: 14,
    backgroundColor: '#F7F8FF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E9EAFB',
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 1 },
    }),
  },
  visitInfoItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  visitInfoItemShrink: { flexShrink: 1, minWidth: 0 },
  visitInfoItemFixed: { flexShrink: 0 },
  visitInfoTxt: { fontSize: 13, fontWeight: '700', color: '#312E81', flexShrink: 1 },
  visitInfoDivider: { width: 1, height: 18, backgroundColor: '#C7D2FE' },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    minHeight: 32,
    justifyContent: 'center',
  },
  calTodayBtnPressed: { opacity: 0.88, transform: [{ scale: 0.97 }] },
  calTodayBtnTxt: { fontSize: 12, fontWeight: '800', color: '#4F46E5' },
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
  legendCard: {
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(233, 237, 247, 0.9)',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendRing: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendTxt: { fontSize: 12, fontWeight: '700', color: '#475569' },
  selectedDateCard: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  selectedDateLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  selectedDateIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  selectedDateLabel: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  selectedDateValue: { fontSize: 14, fontWeight: '800', color: '#166534', marginTop: 2 },
  editDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  editDateBtnTxt: { fontSize: 12.5, fontWeight: '800', color: '#4F46E5' },
  visitDayLine: { marginTop: 10, fontSize: 13, fontWeight: '700', color: '#166534' },
  label: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1B2559',
    marginTop: 18,
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FAFBFF',
    minHeight: 48,
  },
  inputRowField: {
    flex: 1,
    fontSize: 14,
    color: '#1B2559',
    paddingVertical: 12,
  },
  chipsRow: { flexDirection: 'row', marginTop: 10, paddingVertical: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    marginRight: 10,
    width: 190,
    backgroundColor: '#FFFFFF',
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
  chipAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chipAvatarTxt: { fontSize: 12.5, fontWeight: '800' },
  chipTxt: { flex: 1, fontSize: 13.5, fontWeight: '700', color: '#1B2559' },
  hint: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic', marginTop: 8, lineHeight: 18 },
  slotWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  slot: {
    width: '31%',
    marginBottom: 10,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E9EDF7',
    backgroundColor: '#FFFFFF',
    minHeight: 44,
    alignItems: 'center',
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
    borderRadius: 999,
    alignItems: 'center',
    minHeight: 56,
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
  reqHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reqHeaderIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reqHeaderTitle: { fontSize: 16, fontWeight: '800', color: '#1B2559', letterSpacing: -0.2 },
  reqTotal: { fontSize: 13, fontWeight: '800', color: '#4F46E5' },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
  },
  reqRowDivider: { borderBottomWidth: 1, borderBottomColor: '#F1F3FA' },
  reqAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  reqAvatarTxt: { fontSize: 11.5, fontWeight: '800', color: '#4F46E5' },
  reqName: { fontSize: 14, fontWeight: '800', color: '#1B2559' },
  reqMeta: { fontSize: 12, color: '#64748B', fontWeight: '500', marginTop: 2, lineHeight: 16 },
  reqSubtextRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  reqSubtext: { flex: 1, fontSize: 11.5, color: '#94A3B8', fontWeight: '600', lineHeight: 15 },
  reqRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusPillTxt: { fontSize: 10.5, fontWeight: '800' },
  reqNote: { fontSize: 12, color: '#475569', marginTop: 3, lineHeight: 16, fontStyle: 'italic' },
  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: '#ECFDF5',
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  confirmedBadgeTxt: { fontSize: 12, fontWeight: '700', color: '#16A34A' },
  rescheduleActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  rescheduleBtnAccept: {
    flex: 1,
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rescheduleBtnAcceptTxt: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  rescheduleBtnCounter: {
    flex: 1,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rescheduleBtnCounterTxt: { color: '#3730A3', fontWeight: '800', fontSize: 13 },
  counterModalRoot: { flex: 1, justifyContent: 'flex-end' },
  counterBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.4)' },
  counterCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
  },
  counterHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    marginBottom: 14,
  },
  counterTitle: { fontSize: 16, fontWeight: '800', color: '#1A2B4A', marginBottom: 4 },
  counterSub: { fontSize: 12, color: '#64748B', marginBottom: 16, lineHeight: 17 },
  counterFoot: { flexDirection: 'row', gap: 10, marginTop: 4 },
  counterCancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  counterCancelTxt: { color: '#475569', fontWeight: '700', fontSize: 14 },
});
