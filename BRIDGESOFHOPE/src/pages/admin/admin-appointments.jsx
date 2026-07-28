import React, { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, BookUser, ClipboardList, ArrowRightSquare, Users, Stethoscope, LayoutTemplate, User, LogOut, Calendar, FileText, MessageCircle, Search } from 'lucide-react';
import { AdminMessagesNavItem } from '@/components/admin/AdminMessagesNavItem';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { familySidebarStyle } from '@/lib/familySidebarStyle';
import logoBH from '@/assets/kalingalogo.png';

/** Inline SVG so the X is always visible (avoids Lucide + global `button` / `currentColor` quirks). */
function ModalCloseGlyph() {
  return (
    <svg
      className="ap-modal-close-glyph"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="#1B2559"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
import {
  loadVisitationSettingsShared,
  saveVisitationSettingsShared,
  listVisitationRequestsAll,
  updateVisitationRequest,
  replaceVisitationRequests,
  normalizeVisitationStatus,
  visitationCalendarDateKeys,
  mergeVisitationRequestsAfterRemoteFetch,
} from '@/lib/visitationAppointments';
import { APP_DATA_REFRESH } from '@/lib/appDataRefresh';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  insertFamilyNotification,
  fetchNotificationTemplates,
  renderNotificationTemplate,
} from '@/lib/notificationTemplates';

const STATUS_PILL_COLORS = {
  Requested: { bg: '#FEF3C7', color: '#92400E', border: '#FDE68A' },
  Approved: { bg: '#DCFCE7', color: '#166534', border: '#BBF7D0' },
  Declined: { bg: '#FEE2E2', color: '#991B1B', border: '#FECACA' },
  Rescheduled: { bg: '#E0E7FF', color: '#3730A3', border: '#C7D2FE' },
  Cancelled: { bg: '#F1F5F9', color: '#475569', border: '#E2E8F0' },
  Completed: { bg: '#CCFBF1', color: '#0F766E', border: '#99F6E4' },
};

/** Sidebar "Status" filter chips for the calendar board — same statuses as STATUS_PILL_COLORS,
 *  relabeled to match the board's plain-language wording (Requested -> Pending, etc). */
const STATUS_FILTER_OPTIONS = [
  { key: 'Approved', label: 'Confirmed', ...STATUS_PILL_COLORS.Approved },
  { key: 'Requested', label: 'Pending', ...STATUS_PILL_COLORS.Requested },
  { key: 'Rescheduled', label: 'Rescheduled', ...STATUS_PILL_COLORS.Rescheduled },
  { key: 'Cancelled', label: 'Canceled', ...STATUS_PILL_COLORS.Cancelled },
];

const BOARD_WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AdminAppointmentsPage() {
  const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const RESCHEDULE_REASON_OPTIONS = [
    'Staff and facility schedule conflict',
    'Facility event or emergency adjustment',
    'Resident not available at requested time',
    'Family requested a different schedule',
    'Holiday/closure schedule change',
    'Other reason',
  ];
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState('');
  const [settings, setSettings] = useState({ days: ['Wednesday', 'Saturday'], startTime: '13:00', endTime: '17:00' });
  const [selectedDays, setSelectedDays] = useState(['Wednesday', 'Saturday']);
  const [startTime, setStartTime] = useState('13:00');
  const [endTime, setEndTime] = useState('17:00');
  const [queue, setQueue] = useState(() => listVisitationRequestsAll());
  /** Modal listing visitations for a calendar day (preferred or confirmed date). */
  const [dayAppointmentsModal, setDayAppointmentsModal] = useState(null);
  const [rescheduleModal, setRescheduleModal] = useState({
    open: false,
    row: null,
    date: '',
    time: '13:00',
    reasonType: '',
    otherReason: '',
  });
  const [rescheduleMonth, setRescheduleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [notifyTemplates, setNotifyTemplates] = useState([]);
  /** Confirm-before-send modal for Approve/Decline (Reschedule already confirms via its own modal). */
  const [notifyConfirmModal, setNotifyConfirmModal] = useState({ open: false, row: null, action: null });

  /** Calendar board (sidebar + week/month grid) state. */
  const [boardSearch, setBoardSearch] = useState('');
  const [boardStatusFilter, setBoardStatusFilter] = useState(() => new Set());
  const [boardPatientFilter, setBoardPatientFilter] = useState(() => new Set());
  const [boardView, setBoardView] = useState('month');
  const [boardWeekAnchor, setBoardWeekAnchor] = useState(() => new Date());

  useEffect(() => {
    (async () => {
      const res = await fetchNotificationTemplates();
      if (res.ok) setNotifyTemplates(res.templates);
    })();
  }, []);

  const templateBody = (templateKey) => notifyTemplates.find((t) => t.template_key === templateKey)?.body || '';

  useEffect(() => {
    const load = async () => {
      const loadedSettings = await loadVisitationSettingsShared();
      setSettings(loadedSettings);
      setSelectedDays(Array.isArray(loadedSettings.days) && loadedSettings.days.length ? loadedSettings.days : ['Wednesday', 'Saturday']);
      setStartTime(loadedSettings.startTime || '13:00');
      setEndTime(loadedSettings.endTime || '17:00');
      const localRows = listVisitationRequestsAll();
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase
          .from('visitation_requests')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data != null) {
          const fromDb = (data || []).map((r) => ({
            id: r.id,
            familyId: r.family_id || '',
            familyName: r.family_name || '',
            patientId: r.patient_id || '',
            patientName: r.patient_name || '',
            preferredDate: r.preferred_date || '',
            preferredTime: r.preferred_time || '',
            note: r.note || '',
            status: normalizeVisitationStatus(r.status),
            confirmedDate: r.confirmed_date || '',
            confirmedTime: r.confirmed_time || '',
            adminNote: r.admin_note || '',
            createdAt: r.created_at || '',
            updatedAt: r.updated_at || '',
          }));
          const merged = mergeVisitationRequestsAfterRemoteFetch(fromDb, localRows);
          replaceVisitationRequests(merged);
          setQueue(merged);
          return;
        }
      }
      setQueue(localRows.map((r) => ({ ...r, status: normalizeVisitationStatus(r.status) })));
    };
    void load();
    const onFocus = () => load();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') load();
    };
    window.addEventListener('storage', load);
    window.addEventListener(APP_DATA_REFRESH, load);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('storage', load);
      window.removeEventListener(APP_DATA_REFRESH, load);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!dayAppointmentsModal && !rescheduleModal.open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setDayAppointmentsModal(null);
      if (e.key === 'Escape') setRescheduleModal({ open: false, row: null, date: '', time: '13:00', reasonType: '', otherReason: '' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dayAppointmentsModal, rescheduleModal.open]);

  const toggleDay = (day) => {
    setSelectedDays((prev) => {
      if (prev.includes(day)) {
        if (prev.length <= 1) return prev;
        return prev.filter((d) => d !== day);
      }
      return [...prev, day];
    });
  };

  const toMinutes = (value) => {
    const [h = '0', m = '0'] = String(value || '').split(':');
    return (Number(h) * 60) + Number(m);
  };

  const toTimeString = (mins) => {
    const safe = Math.max(0, Math.min(23 * 60 + 59, mins));
    const h = String(Math.floor(safe / 60)).padStart(2, '0');
    const m = String(safe % 60).padStart(2, '0');
    return `${h}:${m}`;
  };

  const buildTimeOptions = () => {
    const values = [];
    for (let mins = 0; mins < 24 * 60; mins += 30) values.push(toTimeString(mins));
    return values;
  };

  const TIME_OPTIONS = buildTimeOptions();

  const updateStartTime = (nextStart) => {
    setStartTime(nextStart);
    const startMins = toMinutes(nextStart);
    const endMins = toMinutes(endTime);
    if (endMins <= startMins) {
      setEndTime(toTimeString(Math.min(startMins + 60, (23 * 60) + 30)));
    }
  };

  const updateEndTime = (nextEnd) => {
    const startMins = toMinutes(startTime);
    const endMins = toMinutes(nextEnd);
    if (endMins <= startMins) {
      setEndTime(toTimeString(Math.min(startMins + 60, (23 * 60) + 30)));
      return;
    }
    setEndTime(nextEnd);
  };

  const saveSchedule = async () => {
    const saved = await saveVisitationSettingsShared({
      days: selectedDays.length ? selectedDays : ['Wednesday', 'Saturday'],
      startTime: startTime || '13:00',
      endTime: endTime || '17:00',
    });
    setSettings(saved);
    setSelectedDays(Array.isArray(saved.days) && saved.days.length ? saved.days : ['Wednesday', 'Saturday']);
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event(APP_DATA_REFRESH));
  };

  const applyDecision = (row, nextStatus, nextConfirmedDate = '', nextConfirmedTime = '', opts = {}) => {
    if (!row?.id) return;
    const current = queue.find((q) => String(q.id) === String(row.id)) || row;
    const currentStatus = normalizeVisitationStatus(current.status);
    const allowNonPending = Boolean(opts.allowNonPending);
    const adminNote = String(opts.adminNote || '').trim();
    if (!allowNonPending && currentStatus !== 'Requested') return;
    if (allowNonPending && currentStatus === 'Declined') return;
    const normalizedStatus = normalizeVisitationStatus(nextStatus);
    // Approve confirms the family's own proposed slot verbatim (no re-confirmation needed).
    // Reschedule proposes admin's own choice, so the guardian must accept it or counter-propose.
    const confirmedByFamily = normalizedStatus === 'Approved';
    updateVisitationRequest(row.id, {
      status: normalizedStatus,
      confirmedDate: nextConfirmedDate,
      confirmedTime: nextConfirmedTime,
      adminNote,
    });
    if (isSupabaseConfigured()) {
      void supabase
        .from('visitation_requests')
        .update({
          status: normalizedStatus,
          confirmed_date: nextConfirmedDate || null,
          confirmed_time: nextConfirmedTime || null,
          admin_note: adminNote || null,
          confirmed_by_family: confirmedByFamily,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
        .then(({ error }) => {
          if (error) console.warn('[visitation_requests update]', error.message);
        });
    }
    setQueue((prev) => prev.map((item) => (
      String(item.id) === String(row.id)
        ? {
            ...item,
            status: normalizedStatus,
            confirmedDate: nextConfirmedDate,
            confirmedTime: nextConfirmedTime,
            adminNote,
          }
        : item
    )));
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event(APP_DATA_REFRESH));
  };

  /** Runs after admin reviews the notification preview and clicks confirm in notifyConfirmModal. */
  const confirmNotifyDecision = () => {
    const { row, action } = notifyConfirmModal;
    if (!row) return;
    if (action === 'Approved') {
      applyDecision(row, 'Approved', row.preferredDate || '', row.preferredTime || '');
      if (row.familyId) {
        void insertFamilyNotification({
          familyId: row.familyId,
          templateKey: 'visitation_approved',
          vars: { patient_name: row.patientName, confirmed_date: row.preferredDate || '', confirmed_time: row.preferredTime || '' },
          relatedType: 'visitation_request',
          relatedId: row.id,
        });
      }
    } else if (action === 'Declined') {
      applyDecision(row, 'Declined', '', '');
      if (row.familyId) {
        void insertFamilyNotification({
          familyId: row.familyId,
          templateKey: 'visitation_declined',
          vars: { patient_name: row.patientName },
          relatedType: 'visitation_request',
          relatedId: row.id,
        });
      }
    }
    setNotifyConfirmModal({ open: false, row: null, action: null });
  };

  const handleCancel = (row) => {
    if (!row?.id) return;
    if (!window.confirm(`Cancel the visitation for ${row.patientName || 'this resident'}?`)) return;
    applyDecision(row, 'Cancelled', row.confirmedDate || row.preferredDate || '', row.confirmedTime || row.preferredTime || '', { allowNonPending: true });
    if (row.familyId) {
      void insertFamilyNotification({
        familyId: row.familyId,
        templateKey: 'visitation_cancelled',
        vars: { patient_name: row.patientName },
        relatedType: 'visitation_request',
        relatedId: row.id,
      });
    }
  };

  const handleMarkCompleted = (row) => {
    if (!row?.id) return;
    const confirmedDate = row.confirmedDate || row.preferredDate || '';
    applyDecision(row, 'Completed', confirmedDate, row.confirmedTime || row.preferredTime || '', { allowNonPending: true });
    if (row.familyId) {
      void insertFamilyNotification({
        familyId: row.familyId,
        templateKey: 'visitation_completed',
        vars: { patient_name: row.patientName, confirmed_date: confirmedDate },
        relatedType: 'visitation_request',
        relatedId: row.id,
      });
    }
  };

  const decide = (row, action) => {
    if (!row?.id) return;
    const current = queue.find((q) => String(q.id) === String(row.id)) || row;
    if (normalizeVisitationStatus(current.status) !== 'Requested') return;
    if (action === 'Approved' || action === 'Declined') {
      setNotifyConfirmModal({ open: true, row, action });
    } else {
      const initialDate = row.preferredDate || row.confirmedDate || todayIso;
      const existingNote = String(row.adminNote || '').trim();
      const noteIsPreset = RESCHEDULE_REASON_OPTIONS.some((opt) => opt !== 'Other reason' && opt === existingNote);
      const initialObj = new Date(`${initialDate}T12:00:00`);
      if (!Number.isNaN(initialObj.getTime())) {
        setRescheduleMonth(new Date(initialObj.getFullYear(), initialObj.getMonth(), 1));
      }
      setRescheduleModal({
        open: true,
        row,
        date: initialDate,
        time: row.preferredTime || row.confirmedTime || '13:00',
        reasonType: existingNote ? (noteIsPreset ? existingNote : 'Other reason') : '',
        otherReason: existingNote && !noteIsPreset ? existingNote : '',
      });
    }
  };

  const monthLabel = calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  /** Monday-first weeks (matches the board grid's MON..SUN columns), grouped into full rows. */
  const boardMonthCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const leadBlanks = (firstDow + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < leadBlanks; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ dayNum: d, iso, dayOfWeek: dateObj.getDay() });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [calendarMonth]);
  const boardWeekCells = useMemo(() => {
    const anchor = boardWeekAnchor;
    const mondayOffset = (anchor.getDay() + 6) % 7;
    const monday = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - mondayOffset);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      return {
        dayNum: d.getDate(),
        iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        dayOfWeek: d.getDay(),
      };
    });
  }, [boardWeekAnchor]);
  const weekRangeLabel = useMemo(() => {
    const first = boardWeekCells[0];
    const last = boardWeekCells[6];
    if (!first || !last) return '';
    const firstD = new Date(`${first.iso}T12:00:00`);
    const lastD = new Date(`${last.iso}T12:00:00`);
    const sameMonth = firstD.getMonth() === lastD.getMonth();
    return sameMonth
      ? `${firstD.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${lastD.toLocaleDateString('en-US', { day: 'numeric' })}, ${lastD.getFullYear()}`
      : `${firstD.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${lastD.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${lastD.getFullYear()}`;
  }, [boardWeekCells]);
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const resMonthStartDay = new Date(rescheduleMonth.getFullYear(), rescheduleMonth.getMonth(), 1).getDay();
  const resMonthDays = new Date(rescheduleMonth.getFullYear(), rescheduleMonth.getMonth() + 1, 0).getDate();
  const rescheduleMonthLabel = rescheduleMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const rescheduleCalendarCells = Array.from({ length: 42 }, (_, idx) => {
    const dayNum = idx - resMonthStartDay + 1;
    if (dayNum < 1 || dayNum > resMonthDays) return null;
    const dateObj = new Date(rescheduleMonth.getFullYear(), rescheduleMonth.getMonth(), dayNum);
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dayNum).padStart(2, '0');
    return { dayNum, iso: `${y}-${m}-${d}` };
  });
  const HOLIDAY_LABELS = {
    '01-01': "New Year's Day",
    '04-09': 'Araw ng Kagitingan',
    '06-12': 'Independence Day',
    '08-21': 'Ninoy Aquino Day',
    '11-01': "All Saints' Day",
    '11-30': 'Bonifacio Day',
    '12-25': 'Christmas Day',
    '12-30': 'Rizal Day',
  };
  const visibleQueue = useMemo(() => queue.filter((row) => row.status !== 'Declined'), [queue]);
  const filteredQueue = selectedCalendarDate
    ? visibleQueue.filter((row) => visitationCalendarDateKeys(row).includes(selectedCalendarDate))
    : visibleQueue;

  /** Calendar board: sidebar search/status/patient filters applied on top of visibleQueue.
   *  Kept separate from filteredQueue/queueToRender below so the existing Request Queue list's
   *  own date-only filtering behavior is untouched. */
  const boardQueue = useMemo(() => {
    const q = boardSearch.trim().toLowerCase();
    return visibleQueue.filter((row) => {
      if (boardStatusFilter.size > 0 && !boardStatusFilter.has(normalizeVisitationStatus(row.status))) return false;
      const pid = row.patientId || row.patientName;
      if (boardPatientFilter.size > 0 && !boardPatientFilter.has(pid)) return false;
      if (q) {
        const hay = `${row.patientName || ''} ${row.familyName || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [visibleQueue, boardStatusFilter, boardPatientFilter, boardSearch]);

  const uniquePatients = useMemo(() => {
    const map = new Map();
    visibleQueue.forEach((row) => {
      const id = row.patientId || row.patientName;
      if (!id || map.has(id)) return;
      map.set(id, { id, name: row.patientName || 'Resident', familyName: row.familyName || '' });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [visibleQueue]);

  const visitsOnIso = (iso) => boardQueue.filter((row) => visitationCalendarDateKeys(row).includes(iso));

  const openDayFromBoard = (iso) => {
    if (!iso) return;
    const items = visitsOnIso(iso);
    setSelectedCalendarDate(iso);
    setDayAppointmentsModal(items.length > 0 ? { iso, items } : null);
  };

  const toggleBoardStatus = (key) => {
    setBoardStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleBoardPatient = (id) => {
    setBoardPatientFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const goBoardToday = () => {
    const now = new Date();
    setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setBoardWeekAnchor(now);
    setSelectedCalendarDate(todayIso);
  };

  const goBoardPrev = () => {
    if (boardView === 'week') {
      setBoardWeekAnchor((prev) => {
        const d = new Date(prev);
        d.setDate(d.getDate() - 7);
        return d;
      });
    } else {
      setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    }
  };

  const goBoardNext = () => {
    if (boardView === 'week') {
      setBoardWeekAnchor((prev) => {
        const d = new Date(prev);
        d.setDate(d.getDate() + 7);
        return d;
      });
    } else {
      setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    }
  };

  const slotLabelAndTimeForDay = (row, iso) => {
    const conf = String(row.confirmedDate || '') === iso;
    const pref = String(row.preferredDate || '') === iso;
    if (conf && String(row.confirmedTime || '').trim()) {
      return { label: row.status === 'Approved' ? 'Confirmed time' : 'Scheduled time', time: row.confirmedTime };
    }
    if (conf) return { label: 'Scheduled date', time: row.confirmedTime ? row.confirmedTime : 'Time to be set' };
    if (pref && String(row.preferredTime || '').trim()) {
      return { label: 'Requested time', time: row.preferredTime };
    }
    if (pref) return { label: 'Requested date', time: row.preferredTime ? row.preferredTime : 'Time to be set' };
    return { label: 'Visit', time: '—' };
  };

  const formatLongCalendarDate = (iso) => {
    if (!iso) return '';
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };
  const shouldFallbackToAll = Boolean(selectedCalendarDate) && filteredQueue.length === 0 && visibleQueue.length > 0;
  const queueToRender = shouldFallbackToAll ? visibleQueue : filteredQueue;

  return (
    <div className="family-portal admin-portal-layout ap-outer" style={{display: 'flex', minHeight: '100vh', background: '#F8F9FD', fontFamily: "'Inter', sans-serif", color: '#1B2559', ...familySidebarStyle(isExpanded) }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        .ap-outer { width: 100%; max-width: 100%; overflow-x: hidden; }
        .ap-main { flex: 1; min-height: 100vh;   padding: 34px 30px 42px; }
        .ap-board-row {
          display: flex;
          align-items: flex-start;
          gap: 18px;
          margin-bottom: 16px;
        }
        .ap-board-sidebar {
          width: 264px;
          flex-shrink: 0;
          background: #ffffff;
          border: 1px solid #E9EDF7;
          border-radius: 18px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .ap-board-search {
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #E2E8F0;
          background: #F8FAFC;
          border-radius: 12px;
          padding: 9px 12px;
        }
        .ap-board-search-input {
          border: none;
          background: transparent;
          outline: none;
          font-size: 13px;
          color: #1B2559;
          width: 100%;
        }
        .ap-side-cal-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .ap-side-cal-nav {
          border: 1px solid #E2E8F0;
          background: #fff;
          color: #475569;
          width: 26px;
          height: 26px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 800;
          font-size: 13px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          padding: 0;
          transition: all 0.15s ease;
        }
        .ap-side-cal-nav:hover { border-color: #93c5fd; background: #eff6ff; color: #1d4ed8; }
        .ap-side-cal-label { font-size: 12.5px; font-weight: 800; color: #1B2559; }
        .ap-side-cal-week {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 4px;
          margin-bottom: 4px;
        }
        .ap-side-cal-weekday {
          text-align: center;
          font-size: 10px;
          font-weight: 800;
          color: #94a3b8;
          text-transform: uppercase;
        }
        .ap-side-cal-day {
          border: none;
          background: transparent;
          color: #334155;
          border-radius: 8px;
          height: 28px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          position: relative;
          transition: all 0.15s ease;
        }
        .ap-side-cal-day:hover:not(.empty) { background: #f1f5f9; }
        .ap-side-cal-day.selected { background: #2563eb; color: #fff; }
        .ap-side-cal-day.today:not(.selected) { color: #ea580c; font-weight: 900; }
        .ap-side-cal-day.empty { cursor: default; }
        .ap-side-cal-day.holiday:not(.selected) { color: #e11d48; }
        .ap-board-section-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          font-weight: 800;
          color: #1B2559;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          margin-bottom: 10px;
        }
        .ap-board-count-badge {
          background: #EEF2FF;
          color: #3730A3;
          border-radius: 999px;
          font-size: 10.5px;
          font-weight: 800;
          padding: 2px 8px;
          text-transform: none;
          letter-spacing: 0;
        }
        .ap-board-clear-btn {
          border: none;
          background: none;
          color: #2563eb;
          font-size: 10.5px;
          font-weight: 700;
          cursor: pointer;
          text-transform: none;
          letter-spacing: 0;
          padding: 0;
        }
        .ap-status-chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
        .ap-status-chip {
          border: 1px solid transparent;
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 11.5px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .ap-board-patients { max-height: 260px; display: flex; flex-direction: column; min-height: 0; }
        .ap-board-patient-list { overflow-y: auto; display: flex; flex-direction: column; gap: 4px; min-height: 0; }
        .ap-board-patient-row {
          display: flex;
          align-items: center;
          gap: 8px;
          border: none;
          background: transparent;
          border-radius: 10px;
          padding: 6px 6px;
          cursor: pointer;
          text-align: left;
          transition: background 0.15s ease;
        }
        .ap-board-patient-row:hover { background: #F8FAFC; }
        .ap-board-patient-row.active { background: #EFF6FF; }
        .ap-board-patient-avatar {
          width: 26px;
          height: 26px;
          border-radius: 999px;
          background: #E0E7FF;
          color: #3730A3;
          font-size: 10.5px;
          font-weight: 800;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .ap-board-patient-name { font-size: 12.5px; font-weight: 700; color: #1B2559; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ap-board-patient-check {
          width: 15px;
          height: 15px;
          border-radius: 5px;
          border: 1.5px solid #CBD5E1;
          flex-shrink: 0;
        }
        .ap-board-patient-check.checked { background: #2563eb; border-color: #2563eb; }
        .ap-board-empty-note { font-size: 12px; color: #94a3b8; padding: 4px 6px; }
        .ap-board-main { flex: 1; min-width: 0; background: #fff; border: 1px solid #E9EDF7; border-radius: 18px; padding: 16px; }
        .ap-board-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
        .ap-board-toolbar-nav { display: flex; align-items: center; gap: 10px; }
        .ap-board-toolbar-title { font-size: 14px; font-weight: 800; color: #1B2559; min-width: 150px; }
        .ap-board-toolbar-actions { display: flex; gap: 8px; }
        .ap-board-toolbar-btn {
          border: 1px solid #E2E8F0;
          background: #fff;
          color: #334155;
          border-radius: 10px;
          padding: 7px 14px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .ap-board-toolbar-btn:hover { border-color: #93c5fd; background: #eff6ff; color: #1d4ed8; }
        .ap-board-grid-head {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 8px;
        }
        .ap-board-grid-head-cell {
          text-align: left;
          font-size: 11px;
          font-weight: 900;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 0 4px;
        }
        .ap-board-grid-row {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 8px;
        }
        .ap-board-cell {
          border: 1px solid #EEF1F8;
          background: #FBFCFE;
          border-radius: 12px;
          min-height: 84px;
          padding: 8px;
          text-align: left;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 6px;
          transition: all 0.15s ease;
        }
        .ap-board-cell:hover { border-color: #bfdbfe; background: #f8fbff; }
        .ap-board-cell-big { min-height: 220px; }
        .ap-board-cell-empty { background: transparent; border: none; cursor: default; }
        .ap-board-cell.is-today { border-color: #f59e0b; box-shadow: inset 0 0 0 1px #fcd34d; }
        .ap-board-cell.is-selected { border-color: #2563eb; box-shadow: inset 0 0 0 1px #93c5fd; background: #f5f9ff; }
        .ap-board-cell-daynum { font-size: 12.5px; font-weight: 800; color: #334155; display: inline-flex; align-items: center; gap: 5px; }
        .ap-board-cell-holiday-dot { width: 5px; height: 5px; border-radius: 50%; background: #e11d48; }
        .ap-board-cell-avatars { display: flex; flex-direction: column; gap: 4px; margin-top: auto; }
        .ap-board-avatar-stack { display: flex; align-items: center; }
        .ap-board-avatar {
          width: 22px;
          height: 22px;
          border-radius: 999px;
          background: #E0E7FF;
          color: #3730A3;
          font-size: 9px;
          font-weight: 800;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #fff;
          margin-left: -7px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);
        }
        .ap-board-avatar:first-child { margin-left: 0; }
        .ap-board-avatar-more { background: #F1F5F9; color: #475569; }
        .ap-board-cell-label { font-size: 10px; font-weight: 700; color: #94a3b8; }
        @media (max-width: 980px) {
          .ap-board-row { flex-direction: column; }
          .ap-board-sidebar { width: 100%; }
        }
        .modern-input {
          border: 1px solid #dbe5f3;
          border-radius: 12px;
          padding: 10px 12px;
          background: #fff;
          font-size: 12px;
          transition: border-color .15s ease, box-shadow .15s ease;
        }
        .modern-input:focus {
          outline: none;
          border-color: #60a5fa;
          box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.18);
        }
        .weekday-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          min-width: 0;
        }
        .schedule-weekday-cell {
          min-width: 0;
        }
        .schedule-config-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 16px 24px;
          align-items: center;
        }
        .schedule-time-label {
          font-size: 11px;
          font-weight: 700;
          color: #64748B;
          margin-bottom: 6px;
          display: block;
        }
        .schedule-time-wrap {
          min-width: 0;
          width: 220px;
          max-width: 220px;
        }
        .schedule-time-wrap .modern-input {
          width: 100%;
        }
        .schedule-time-actions {
          display: flex;
          align-items: flex-end;
          gap: 10px;
          flex-wrap: nowrap;
          justify-content: flex-end;
          flex-shrink: 0;
        }
        @media (max-width: 1200px) {
          .schedule-config-grid {
            grid-template-columns: 1fr;
            gap: 12px;
            align-items: start;
          }
          .schedule-time-actions {
            justify-content: flex-start;
            flex-wrap: wrap;
            width: 100%;
          }
        }
        @media (max-width: 800px) {
          .schedule-time-actions { width: 100%; }
        }
        .weekday-chip {
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #475569;
          border-radius: 999px;
          padding: 10px 14px;
          min-height: 44px;
          min-width: 52px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          position: relative;
          z-index: 1;
        }
        .weekday-chip:hover {
          border-color: #93c5fd;
          background: #eff6ff;
          color: #1e40af;
        }
        .weekday-chip.active {
          border-color: #2563eb;
          background: linear-gradient(145deg, #2563eb, #1d4ed8);
          color: #ffffff;
          box-shadow: 0 8px 16px rgba(37, 99, 235, 0.22);
        }
        .modern-btn {
          border: none;
          background: linear-gradient(145deg, #2563eb, #1d4ed8);
          color: white;
          border-radius: 12px;
          padding: 10px 12px;
          font-weight: 800;
          letter-spacing: .01em;
          box-shadow: 0 8px 18px rgba(37, 99, 235, 0.24);
          transition: transform .15s ease, box-shadow .15s ease;
          cursor: pointer;
          width: fit-content;
          white-space: nowrap;
        }
        .modern-btn:hover { transform: translateY(-1px); box-shadow: 0 10px 20px rgba(37, 99, 235, 0.28); }
        .admin-appt-hero {
          background: linear-gradient(135deg, #eff6ff 0%, #ffffff 100%);
          border: 1px solid #bfdbfe;
          border-radius: 16px;
          padding: 16px 18px;
          margin-bottom: 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .admin-appt-title { font-size: 17px; font-weight: 900; color: #1e3a8a; margin-bottom: 4px; }
        .admin-appt-sub { font-size: 12px; color: #334155; font-weight: 600; }
        .admin-pill {
          border: 1px solid #bfdbfe;
          background: #ffffff;
          color: #1e40af;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 800;
        }
        .admin-queue-card {
          border: 1px solid #E9EDF7;
          border-radius: 12px;
          padding: 11px;
          display: flex;
          justify-content: space-between;
          gap: 10px;
          background: #fff;
        }
        .admin-status-pill {
          font-size: 11px;
          font-weight: 900;
          border-radius: 999px;
          padding: 4px 9px;
          height: fit-content;
        }
        .ap-day-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 2000;
          background: rgba(15, 23, 42, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .ap-day-modal {
          width: min(100%, 440px);
          max-height: min(88vh, 560px);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          background: #fff;
          border-radius: 18px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 24px 48px rgba(15, 23, 42, 0.18);
        }
        .ap-day-modal-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 18px 18px 12px;
          border-bottom: 1px solid #f1f5f9;
        }
        .ap-day-modal-title { font-size: 15px; font-weight: 900; color: #0f172a; }
        .ap-day-modal-sub { font-size: 13px; font-weight: 700; color: #64748b; margin-top: 4px; }
        .ap-modal-close-glyph {
          display: block;
          flex-shrink: 0;
          pointer-events: none;
        }
        .ap-day-modal-close {
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #1B2559;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 0.15s ease, border-color 0.15s ease;
          box-sizing: border-box;
          padding: 0;
          margin: 0;
          line-height: 0;
          font: inherit;
        }
        .ap-day-modal-close:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
          color: #0f172a;
        }
        .ap-day-modal-card-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }
        .ap-day-modal-btn-decline {
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #991b1b;
          font-size: 12px;
          font-weight: 800;
          padding: 8px 14px;
          border-radius: 10px;
          cursor: pointer;
        }
        .ap-day-modal-btn-decline:hover { background: #fee2e2; }
        .ap-day-modal-btn-reschedule {
          border: 1px solid #c7d2fe;
          background: #eef2ff;
          color: #3730a3;
          font-size: 12px;
          font-weight: 800;
          padding: 8px 14px;
          border-radius: 10px;
          cursor: pointer;
        }
        .ap-day-modal-btn-reschedule:hover { background: #e0e7ff; }
        .ap-day-modal-body { padding: 12px 16px 18px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
        .ap-day-modal-card {
          border: 1px solid #e9edf7;
          border-radius: 14px;
          padding: 12px 14px;
          background: #fafbff;
        }
        .ap-day-modal-patient { font-size: 15px; font-weight: 800; color: #1e293b; }
        .ap-day-modal-meta { font-size: 12px; color: #64748b; font-weight: 600; margin-top: 4px; line-height: 1.45; }
        .ap-day-modal-time { font-size: 14px; font-weight: 800; color: #1d4ed8; margin-top: 8px; }
        .ap-day-modal-foot {
          padding: 14px 18px 18px;
          border-top: 1px solid #f1f5f9;
          display: flex;
          justify-content: flex-end;
        }
        .ap-day-modal-btn-primary {
          border: none;
          background: linear-gradient(145deg, #F54E25, #ea5a37);
          color: white;
          font-size: 13px;
          font-weight: 800;
          padding: 10px 22px;
          border-radius: 12px;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(245, 78, 37, 0.28);
          letter-spacing: 0.02em;
        }
        .ap-day-modal-btn-primary:hover {
          filter: brightness(1.05);
          box-shadow: 0 10px 24px rgba(245, 78, 37, 0.34);
        }
        .ap-day-modal-btn-primary:focus-visible {
          outline: 2px solid #F54E25;
          outline-offset: 2px;
        }
        .res-modal-fields {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 4px 16px 16px;
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
        }
        .res-modal-fields > div { min-width: 0; }
        .res-modal-back-btn {
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #1B2559;
          width: 40px;
          height: 40px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          box-sizing: border-box;
          padding: 0;
          margin: 0;
          line-height: 0;
          font: inherit;
          flex-shrink: 0;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .res-modal-back-btn:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
        }
        .res-mini-calendar {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 10px;
          background: #f8fafc;
        }
        .res-mini-cal-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .res-mini-cal-nav {
          border: 1px solid #dbe5f3;
          background: #fff;
          color: #334155;
          width: 28px;
          height: 28px;
          min-width: 28px;
          min-height: 28px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 800;
          font-size: 15px;
          line-height: 1;
          box-sizing: border-box;
          padding: 0;
          margin: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-family: inherit;
        }
        .res-mini-cal-nav:hover {
          border-color: #93c5fd;
          background: #f8fafc;
          color: #1e293b;
        }
        .res-mini-cal-label { font-size: 12px; font-weight: 800; color: #0f172a; }
        .res-mini-cal-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 4px;
        }
        .res-mini-cal-weekday {
          text-align: center;
          font-size: 10px;
          font-weight: 800;
          color: #64748b;
          padding: 2px 0;
        }
        .res-mini-cal-day {
          border: 1px solid #e2e8f0;
          background: #fff;
          color: #334155;
          border-radius: 8px;
          height: 30px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .res-mini-cal-day.selected {
          border-color: #2563eb;
          background: #dbeafe;
          color: #1d4ed8;
        }
        .res-mini-cal-day.today {
          border-color: #f59e0b;
        }
        .res-mini-cal-day.empty {
          border: none;
          background: transparent;
          cursor: default;
        }
        .res-modal-label {
          display: block;
          font-size: 12px;
          font-weight: 700;
          color: #475569;
          margin-bottom: 6px;
        }
        .res-modal-input {
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          border: 1px solid #dbe5f3;
          border-radius: 10px;
          padding: 9px 10px;
          font-size: 13px;
          color: #0f172a;
          background: #fff;
        }
        .res-modal-input:focus {
          outline: none;
          border-color: #60a5fa;
          box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.18);
        }
        @media (max-width: 640px) {
          .res-mini-cal-day { height: 28px; }
        }
      `}</style>
      <AdminSidebar
        isExpanded={isExpanded}
        onToggleExpanded={() => setIsExpanded(!isExpanded)}
      />

      <main className="ap-main admin-sidebar-offset">
        <div className="admin-appt-hero">
          <div>
            <div className="admin-appt-title">Admin Appointment Management</div>
            <div className="admin-appt-sub">Set clinic visitation windows and manage family appointment decisions professionally.</div>
          </div>
          <div className="admin-pill">{queue.length} total requests</div>
        </div>

        <div className="ap-board-row">
          <aside className="ap-board-sidebar">
            <div className="ap-board-search">
              <Search size={15} color="#94a3b8" />
              <input
                type="text"
                className="ap-board-search-input"
                placeholder="Search patient or family..."
                value={boardSearch}
                onChange={(e) => setBoardSearch(e.target.value)}
              />
            </div>

            <div className="ap-side-cal">
              <div className="ap-side-cal-head">
                <button type="button" className="ap-side-cal-nav" onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>{'<'}</button>
                <div className="ap-side-cal-label">{monthLabel}</div>
                <button type="button" className="ap-side-cal-nav" onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>{'>'}</button>
              </div>
              <div className="ap-side-cal-week">
                {BOARD_WEEKDAY_LABELS.map((d) => <div key={d} className="ap-side-cal-weekday">{d[0]}</div>)}
              </div>
              {boardMonthCells.map((week, wi) => (
                <div className="ap-side-cal-week" key={`side-week-${wi}`}>
                  {week.map((cell, ci) => {
                    const mmdd = cell?.iso ? cell.iso.slice(5) : '';
                    const isHoliday = Boolean(cell && HOLIDAY_LABELS[mmdd]);
                    return (
                      <button
                        key={cell?.iso || `side-blank-${wi}-${ci}`}
                        type="button"
                        disabled={!cell}
                        title={isHoliday ? HOLIDAY_LABELS[mmdd] : ''}
                        className={[
                          'ap-side-cal-day',
                          !cell ? 'empty' : '',
                          cell?.iso === selectedCalendarDate ? 'selected' : '',
                          cell?.iso === todayIso ? 'today' : '',
                          isHoliday ? 'holiday' : '',
                        ].join(' ')}
                        onClick={() => cell && openDayFromBoard(cell.iso)}
                      >
                        {cell ? cell.dayNum : ''}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="ap-board-section">
              <div className="ap-board-section-head">
                <span>Status</span>
                {boardStatusFilter.size > 0 ? (
                  <button type="button" className="ap-board-clear-btn" onClick={() => setBoardStatusFilter(new Set())}>Clear</button>
                ) : null}
              </div>
              <div className="ap-status-chip-row">
                {STATUS_FILTER_OPTIONS.map((opt) => {
                  const active = boardStatusFilter.has(opt.key);
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      className="ap-status-chip"
                      style={{
                        background: active ? opt.color : opt.bg,
                        color: active ? '#ffffff' : opt.color,
                        borderColor: opt.border,
                      }}
                      onClick={() => toggleBoardStatus(opt.key)}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="ap-board-section ap-board-patients">
              <div className="ap-board-section-head">
                <span>Patients</span>
                <span className="ap-board-count-badge">{uniquePatients.length}</span>
              </div>
              <div className="ap-board-patient-list">
                {uniquePatients.map((p) => {
                  const active = boardPatientFilter.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`ap-board-patient-row${active ? ' active' : ''}`}
                      onClick={() => toggleBoardPatient(p.id)}
                    >
                      <span className="ap-board-patient-avatar">{initialsOf(p.name)}</span>
                      <span className="ap-board-patient-name">{p.name}</span>
                      <span className={`ap-board-patient-check${active ? ' checked' : ''}`} />
                    </button>
                  );
                })}
                {uniquePatients.length === 0 ? <div className="ap-board-empty-note">No patients with visits yet.</div> : null}
              </div>
            </div>
          </aside>

          <section className="ap-board-main">
            <div className="ap-board-toolbar">
              <div className="ap-board-toolbar-nav">
                <button type="button" className="ap-side-cal-nav" onClick={goBoardPrev}>{'<'}</button>
                <div className="ap-board-toolbar-title">{boardView === 'week' ? weekRangeLabel : monthLabel}</div>
                <button type="button" className="ap-side-cal-nav" onClick={goBoardNext}>{'>'}</button>
              </div>
              <div className="ap-board-toolbar-actions">
                <button type="button" className="ap-board-toolbar-btn" onClick={goBoardToday}>Today</button>
                <button
                  type="button"
                  className="ap-board-toolbar-btn"
                  onClick={() => setBoardView((v) => (v === 'week' ? 'month' : 'week'))}
                >
                  {boardView === 'week' ? 'Month' : 'Week'}
                </button>
              </div>
            </div>
            <div className="ap-board-grid">
              <div className="ap-board-grid-head">
                {BOARD_WEEKDAY_LABELS.map((d) => <div key={d} className="ap-board-grid-head-cell">{d}</div>)}
              </div>
              {(boardView === 'week' ? [boardWeekCells] : boardMonthCells).map((week, wi) => (
                <div className="ap-board-grid-row" key={`board-week-${wi}`}>
                  {week.map((cell, ci) => {
                    if (!cell) return <div key={`board-blank-${wi}-${ci}`} className="ap-board-cell ap-board-cell-empty" />;
                    const items = visitsOnIso(cell.iso);
                    const visible = items.slice(0, 3);
                    const extra = items.length - visible.length;
                    const mmdd = cell.iso.slice(5);
                    const isHoliday = Boolean(HOLIDAY_LABELS[mmdd]);
                    return (
                      <button
                        key={cell.iso}
                        type="button"
                        title={isHoliday ? HOLIDAY_LABELS[mmdd] : ''}
                        className={[
                          'ap-board-cell',
                          cell.iso === todayIso ? 'is-today' : '',
                          cell.iso === selectedCalendarDate ? 'is-selected' : '',
                          boardView === 'week' ? 'ap-board-cell-big' : '',
                        ].join(' ')}
                        onClick={() => openDayFromBoard(cell.iso)}
                      >
                        <span className="ap-board-cell-daynum">
                          {cell.dayNum}
                          {isHoliday ? <span className="ap-board-cell-holiday-dot" /> : null}
                        </span>
                        {items.length > 0 ? (
                          <div className="ap-board-cell-avatars">
                            <div className="ap-board-avatar-stack">
                              {visible.map((row, i) => (
                                <span key={row.id} className="ap-board-avatar" style={{ zIndex: visible.length - i }}>
                                  {initialsOf(row.patientName)}
                                </span>
                              ))}
                              {extra > 0 ? <span className="ap-board-avatar ap-board-avatar-more">+{extra}</span> : null}
                            </div>
                            <span className="ap-board-cell-label">{items.length === 1 ? 'Patient' : 'Patients'}</span>
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        </div>

        <div style={{ background: 'white', border: '1px solid #E9EDF7', borderRadius: 18, padding: 18, marginBottom: 16, marginTop: 16 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800 }}>Fixed Visitation Schedule</h3>
          <div className="schedule-config-grid">
            <div className="schedule-weekday-cell">
              <div className="weekday-row">
              {WEEK_DAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  className={`weekday-chip${selectedDays.includes(day) ? ' active' : ''}`}
                  onClick={() => toggleDay(day)}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
              </div>
            </div>
            <div className="schedule-time-actions">
              <div className="schedule-time-wrap">
                <label className="schedule-time-label">Start time</label>
                <select className="modern-input" value={startTime} onChange={(e) => updateStartTime(e.target.value)}>
                  {TIME_OPTIONS.map((time) => <option key={`start-${time}`} value={time}>{time}</option>)}
                </select>
              </div>
              <div className="schedule-time-wrap">
                <label className="schedule-time-label">End time</label>
                <select className="modern-input" value={endTime} onChange={(e) => updateEndTime(e.target.value)}>
                  {TIME_OPTIONS.map((time) => <option key={`end-${time}`} value={time}>{time}</option>)}
                </select>
              </div>
              <button type="button" className="modern-btn" onClick={saveSchedule}>Save now</button>
            </div>
          </div>
          <p style={{ marginTop: 12, fontSize: 12, color: '#64748B' }}>
            Active schedule: {settings.days.join(', ')} · {settings.startTime} - {settings.endTime}
          </p>
        </div>
        <div style={{ background: 'white', border: '1px solid #E9EDF7', borderRadius: 18, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Request Queue</h3>
            <div style={{ fontSize: 12, color: '#64748B', fontWeight: 700 }}>
              {selectedCalendarDate
                ? `Selected date: ${selectedCalendarDate}`
                : 'Showing all requests'}
            </div>
          </div>
          {shouldFallbackToAll ? (
            <div style={{ marginBottom: 10, fontSize: 12, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 10px' }}>
              No requests on {selectedCalendarDate}. Showing all appointment requests instead.
            </div>
          ) : null}
          <div style={{ display: 'grid', gap: 8 }}>
            {queueToRender.map((row) => {
              const st = normalizeVisitationStatus(row.status);
              const primaryDate = row.confirmedDate || row.preferredDate;
              const primaryTime = row.confirmedTime || row.preferredTime;
              const showOriginalRequest = Boolean(
                row.confirmedDate
                && row.preferredDate
                && (row.preferredDate !== row.confirmedDate || String(row.preferredTime || '') !== String(row.confirmedTime || '')),
              );
              return (
              <div key={row.id} className="admin-queue-card">
                <div>
                  <div style={{ fontWeight: 700 }}>{row.familyName || 'Family'} · {row.patientName || 'Resident'}</div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    Scheduled:
                    {' '}
                    {primaryDate || 'N/A'}
                    {' '}
                    {primaryTime || ''}
                    {showOriginalRequest ? (
                      <>
                        {' '}
                        · Originally requested:
                        {' '}
                        {row.preferredDate}
                        {' '}
                        {row.preferredTime || ''}
                      </>
                    ) : null}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    className="admin-status-pill"
                    style={{
                      background: STATUS_PILL_COLORS[st]?.bg || STATUS_PILL_COLORS.Requested.bg,
                      color: STATUS_PILL_COLORS[st]?.color || STATUS_PILL_COLORS.Requested.color,
                      border: `1px solid ${STATUS_PILL_COLORS[st]?.border || STATUS_PILL_COLORS.Requested.border}`,
                    }}
                  >
                    {st}
                  </span>
                  {st === 'Requested' ? (
                    <>
                      <button type="button" onClick={() => decide(row, 'Approved')} style={{ border: '1px solid #DCFCE7', background: '#ECFDF3', color: '#166534', borderRadius: 7, padding: '5px 8px', fontSize: 11, fontWeight: 700 }}>Approve</button>
                      <button type="button" onClick={() => decide(row, 'Rescheduled')} style={{ border: '1px solid #C7D2FE', background: '#EEF2FF', color: '#3730A3', borderRadius: 7, padding: '5px 8px', fontSize: 11, fontWeight: 700 }}>Reschedule</button>
                      <button type="button" onClick={() => decide(row, 'Declined')} style={{ border: '1px solid #FECACA', background: '#FEF2F2', color: '#991B1B', borderRadius: 7, padding: '5px 8px', fontSize: 11, fontWeight: 700 }}>Decline</button>
                    </>
                  ) : null}
                  {st === 'Approved' || st === 'Rescheduled' ? (
                    <>
                      <button type="button" onClick={() => handleMarkCompleted(row)} style={{ border: '1px solid #99F6E4', background: '#F0FDFA', color: '#0F766E', borderRadius: 7, padding: '5px 8px', fontSize: 11, fontWeight: 700 }}>Mark Completed</button>
                      <button type="button" onClick={() => handleCancel(row)} style={{ border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#475569', borderRadius: 7, padding: '5px 8px', fontSize: 11, fontWeight: 700 }}>Cancel</button>
                    </>
                  ) : null}
                </div>
              </div>
            );
            })}
            {queueToRender.length === 0 ? <div style={{ color: '#94a3b8', fontSize: 13 }}>No appointment requests yet.</div> : null}
          </div>
        </div>
      </main>

      {rescheduleModal.open && rescheduleModal.row ? (
        <div className="ap-day-modal-backdrop" onClick={() => setRescheduleModal({ open: false, row: null, date: '', time: '13:00', reasonType: '', otherReason: '' })}>
          <div className="ap-day-modal" onClick={(ev) => ev.stopPropagation()}>
            <div className="ap-day-modal-head">
              <div>
                <div className="ap-day-modal-title">Reschedule appointment</div>
                <div className="ap-day-modal-sub">
                  {rescheduleModal.row.patientName || 'Resident'} · {rescheduleModal.row.familyName || 'Family'}
                </div>
              </div>
              <button
                type="button"
                className="res-modal-back-btn"
                aria-label="Close"
                onClick={() => setRescheduleModal({ open: false, row: null, date: '', time: '13:00', reasonType: '', otherReason: '' })}
              >
                <ModalCloseGlyph />
              </button>
            </div>
            <div className="res-modal-fields">
              <div>
                <label className="res-modal-label">Rescheduled date</label>
                <div className="res-mini-calendar">
                  <div className="res-mini-cal-head">
                    <button
                      type="button"
                      className="res-mini-cal-nav"
                      onClick={() => setRescheduleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                    >
                      {'<'}
                    </button>
                    <div className="res-mini-cal-label">{rescheduleMonthLabel}</div>
                    <button
                      type="button"
                      className="res-mini-cal-nav"
                      onClick={() => setRescheduleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                    >
                      {'>'}
                    </button>
                  </div>
                  <div className="res-mini-cal-grid" style={{ marginBottom: 4 }}>
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                      <div key={`res-w-${d}`} className="res-mini-cal-weekday">{d}</div>
                    ))}
                  </div>
                  <div className="res-mini-cal-grid">
                    {rescheduleCalendarCells.map((cell, idx) => (
                      <button
                        key={`res-c-${idx}`}
                        type="button"
                        className={[
                          'res-mini-cal-day',
                          !cell ? 'empty' : '',
                          cell?.iso === rescheduleModal.date ? 'selected' : '',
                          cell?.iso === todayIso ? 'today' : '',
                        ].join(' ')}
                        disabled={!cell}
                        onClick={() => {
                          if (!cell?.iso) return;
                          setRescheduleModal((prev) => ({ ...prev, date: cell.iso }));
                        }}
                      >
                        {cell ? cell.dayNum : ''}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="res-modal-label">Rescheduled time</label>
                <input
                  className="res-modal-input"
                  type="time"
                  value={rescheduleModal.time}
                  onChange={(e) => setRescheduleModal((prev) => ({ ...prev, time: e.target.value }))}
                  step={1800}
                />
              </div>
              <div>
                <label className="res-modal-label">Reason for reschedule (shown to family)</label>
                <select
                  className="res-modal-input"
                  value={rescheduleModal.reasonType}
                  onChange={(e) => setRescheduleModal((prev) => ({ ...prev, reasonType: e.target.value }))}
                >
                  <option value="">Select reason</option>
                  {RESCHEDULE_REASON_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              {rescheduleModal.reasonType === 'Other reason' ? (
                <div>
                  <label className="res-modal-label">Other reason details</label>
                  <textarea
                    className="res-modal-input"
                    value={rescheduleModal.otherReason}
                    onChange={(e) => setRescheduleModal((prev) => ({ ...prev, otherReason: e.target.value }))}
                    rows={3}
                    maxLength={280}
                    placeholder="Enter specific reason..."
                    style={{ resize: 'vertical', minHeight: 84, paddingTop: 9 }}
                  />
                </div>
              ) : null}
              <div style={{ fontSize: 11, color: '#64748b', background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: 8, padding: '8px 10px' }}>
                <strong>Guardian will be notified:</strong>{' '}
                {renderNotificationTemplate(templateBody('visitation_rescheduled'), {
                  patient_name: rescheduleModal.row?.patientName || '',
                  confirmed_date: rescheduleModal.date,
                  confirmed_time: rescheduleModal.time,
                  reason: rescheduleModal.reasonType === 'Other reason'
                    ? (String(rescheduleModal.otherReason || '').trim() || '—')
                    : (String(rescheduleModal.reasonType || '').trim() || '—'),
                })}
              </div>
            </div>
            <div className="ap-day-modal-foot">
              <button
                type="button"
                className="ap-day-modal-btn-primary"
                onClick={() => {
                  const current = queue.find((q) => String(q.id) === String(rescheduleModal.row?.id));
                  if (!current || normalizeVisitationStatus(current.status) === 'Declined') {
                    setRescheduleModal({ open: false, row: null, date: '', time: '13:00', reasonType: '', otherReason: '' });
                    return;
                  }
                  const date = String(rescheduleModal.date || '').trim();
                  const time = String(rescheduleModal.time || '').trim();
                  const reason = rescheduleModal.reasonType === 'Other reason'
                    ? String(rescheduleModal.otherReason || '').trim()
                    : String(rescheduleModal.reasonType || '').trim();
                  if (!date || !time || !reason) return;
                  applyDecision(rescheduleModal.row, 'Rescheduled', date, time, { allowNonPending: true, adminNote: reason });
                  if (rescheduleModal.row?.familyId) {
                    void insertFamilyNotification({
                      familyId: rescheduleModal.row.familyId,
                      templateKey: 'visitation_rescheduled',
                      vars: { patient_name: rescheduleModal.row.patientName, confirmed_date: date, confirmed_time: time, reason },
                      relatedType: 'visitation_request',
                      relatedId: rescheduleModal.row.id,
                    });
                  }
                  setRescheduleModal({ open: false, row: null, date: '', time: '13:00', reasonType: '', otherReason: '' });
                }}
              >
                Save reschedule
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {notifyConfirmModal.open ? (
        <div
          className="ap-day-modal-backdrop"
          role="presentation"
          onClick={() => setNotifyConfirmModal({ open: false, row: null, action: null })}
        >
          <div className="ap-day-modal" style={{ maxWidth: 420 }} role="dialog" aria-modal="true" onClick={(ev) => ev.stopPropagation()}>
            <div className="ap-day-modal-head">
              <div>
                <div className="ap-day-modal-title">
                  {notifyConfirmModal.action === 'Approved' ? 'Approve visitation' : 'Decline visitation'}
                </div>
              </div>
              <button type="button" className="ap-day-modal-close" onClick={() => setNotifyConfirmModal({ open: false, row: null, action: null })}>
                <ModalCloseGlyph />
              </button>
            </div>
            <div style={{ padding: '4px 20px 20px' }}>
              <p style={{ fontSize: 13, color: '#334155', margin: '0 0 10px' }}>
                {notifyConfirmModal.action === 'Approved' ? 'Approve' : 'Decline'} the visitation request for{' '}
                <strong>{notifyConfirmModal.row?.patientName}</strong>?
              </p>
              <div style={{ fontSize: 11, color: '#64748b', background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: 8, padding: '8px 10px', marginBottom: 16 }}>
                <strong>Guardian will be notified:</strong>{' '}
                {notifyConfirmModal.row
                  ? renderNotificationTemplate(
                      templateBody(notifyConfirmModal.action === 'Approved' ? 'visitation_approved' : 'visitation_declined'),
                      {
                        patient_name: notifyConfirmModal.row.patientName,
                        confirmed_date: notifyConfirmModal.row.preferredDate || '',
                        confirmed_time: notifyConfirmModal.row.preferredTime || '',
                      }
                    )
                  : ''}
              </div>
            </div>
            <div className="ap-day-modal-foot">
              <button
                type="button"
                onClick={() => setNotifyConfirmModal({ open: false, row: null, action: null })}
                style={{ border: '1px solid #E2E8F0', background: 'white', color: '#334155', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, marginRight: 8 }}
              >
                Cancel
              </button>
              <button type="button" className="ap-day-modal-btn-primary" onClick={confirmNotifyDecision}>
                {notifyConfirmModal.action === 'Approved' ? 'Approve & Notify' : 'Decline & Notify'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {dayAppointmentsModal ? (
        <div
          className="ap-day-modal-backdrop"
          role="presentation"
          onClick={() => setDayAppointmentsModal(null)}
        >
          <div
            className="ap-day-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ap-day-modal-heading"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="ap-day-modal-head">
              <div>
                <div id="ap-day-modal-heading" className="ap-day-modal-title">Visitation appointments</div>
                <div className="ap-day-modal-sub">{formatLongCalendarDate(dayAppointmentsModal.iso)}</div>
              </div>
              <button
                type="button"
                className="ap-day-modal-close"
                aria-label="Close"
                onClick={() => setDayAppointmentsModal(null)}
              >
                <ModalCloseGlyph />
              </button>
            </div>
            <div className="ap-day-modal-body">
              {dayAppointmentsModal.items.map((row) => {
                const { label, time } = slotLabelAndTimeForDay(row, dayAppointmentsModal.iso);
                const st = normalizeVisitationStatus(row.status);
                const canDayModalAct = st !== 'Declined';
                return (
                  <div key={row.id} className="ap-day-modal-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div className="ap-day-modal-patient">{row.patientName || 'Resident'}</div>
                      <span
                        className="admin-status-pill"
                        style={{
                          background: STATUS_PILL_COLORS[st]?.bg || STATUS_PILL_COLORS.Requested.bg,
                          color: STATUS_PILL_COLORS[st]?.color || STATUS_PILL_COLORS.Requested.color,
                          border: `1px solid ${STATUS_PILL_COLORS[st]?.border || STATUS_PILL_COLORS.Requested.border}`,
                        }}
                      >
                        {st}
                      </span>
                    </div>
                    <div className="ap-day-modal-meta">
                      {row.familyName ? (
                        <>
                          Family / contact:
                          {' '}
                          {row.familyName}
                          <br />
                        </>
                      ) : null}
                      {row.preferredDate && row.preferredDate !== dayAppointmentsModal.iso ? (
                        <>
                          <br />
                          Originally requested:
                          {' '}
                          {row.preferredDate}
                          {row.preferredTime ? ` · ${row.preferredTime}` : ''}
                        </>
                      ) : null}
                      {row.note ? (
                        <>
                          <br />
                          Note:
                          {' '}
                          {row.note}
                        </>
                      ) : null}
                    </div>
                    <div className="ap-day-modal-time">
                      {label}
                      :
                      {' '}
                      {time}
                    </div>
                    {canDayModalAct ? (
                      <div className="ap-day-modal-card-actions">
                        <button
                          type="button"
                          className="ap-day-modal-btn-decline"
                          onClick={() => {
                            if (!window.confirm('Decline this visitation request? The family will see it as declined.')) return;
                            const fresh = queue.find((q) => String(q.id) === String(row.id)) || row;
                            applyDecision(fresh, 'Declined', '', '', { allowNonPending: true });
                            setDayAppointmentsModal((prev) => {
                              if (!prev) return null;
                              const nextItems = prev.items.filter((i) => String(i.id) !== String(row.id));
                              return nextItems.length ? { ...prev, items: nextItems } : null;
                            });
                          }}
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          className="ap-day-modal-btn-reschedule"
                          onClick={() => {
                            const fresh = queue.find((q) => String(q.id) === String(row.id)) || row;
                            setDayAppointmentsModal(null);
                            setRescheduleModal({
                              open: true,
                              row: fresh,
                              date: fresh.confirmedDate || fresh.preferredDate || todayIso,
                              time: fresh.confirmedTime || fresh.preferredTime || '13:00',
                              reasonType:
                                RESCHEDULE_REASON_OPTIONS.some((opt) => opt !== 'Other reason' && opt === String(fresh.adminNote || '').trim())
                                  ? String(fresh.adminNote || '').trim()
                                  : String(fresh.adminNote || '').trim()
                                    ? 'Other reason'
                                    : '',
                              otherReason:
                                RESCHEDULE_REASON_OPTIONS.some((opt) => opt !== 'Other reason' && opt === String(fresh.adminNote || '').trim())
                                  ? ''
                                  : String(fresh.adminNote || '').trim(),
                            });
                            const pickerDate = fresh.confirmedDate || fresh.preferredDate || todayIso;
                            const pickerObj = new Date(`${pickerDate}T12:00:00`);
                            if (!Number.isNaN(pickerObj.getTime())) {
                              setRescheduleMonth(new Date(pickerObj.getFullYear(), pickerObj.getMonth(), 1));
                            }
                          }}
                        >
                          Reschedule
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="ap-day-modal-foot">
              <button
                type="button"
                className="ap-day-modal-btn-primary"
                onClick={() => setDayAppointmentsModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
