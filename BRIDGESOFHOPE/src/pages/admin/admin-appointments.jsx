import React, { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, HeartPulse, ClipboardList, CheckCircle2, ArrowRightSquare, Users, Stethoscope, LayoutTemplate, User, LogOut, Calendar, FileText } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  isVisitationLocalDraftSuperseded,
} from '@/lib/visitationAppointments';
import { APP_DATA_REFRESH } from '@/lib/appDataRefresh';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { resolveAccountRole } from '@/components/RoleGuard';

export default function AdminAppointmentsPage() {
  const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const RESCHEDULE_REASON_OPTIONS = [
    'Staff and facility schedule conflict',
    'Facility event or emergency adjustment',
    'Patient not available at requested time',
    'Family requested a different schedule',
    'Holiday/closure schedule change',
    'Other reason',
  ];
  const navigate = useNavigate();
  const location = useLocation();
  const forceClm = new URLSearchParams(location.search).get('mode') === 'clm';
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
  const [isClm, setIsClm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!isSupabaseConfigured()) return;
      const { data: authData } = await supabase.auth.getUser();
      const role = await resolveAccountRole(authData?.user ?? null);
      if (!cancelled) setIsClm(forceClm || role === 'case_manager');
    })();
    return () => {
      cancelled = true;
    };
  }, [forceClm]);

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
        if (!error && data) {
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
          const seen = new Set(fromDb.map((r) => String(r.id)));
          const merged = [
            ...fromDb,
            ...localRows.filter(
              (r) => !seen.has(String(r.id)) && !isVisitationLocalDraftSuperseded(r, fromDb),
            ),
          ].map((r) => ({
            ...r,
            status: normalizeVisitationStatus(r.status),
          }));
          merged.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
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

  const decide = (row, action) => {
    if (!row?.id) return;
    const current = queue.find((q) => String(q.id) === String(row.id)) || row;
    if (normalizeVisitationStatus(current.status) !== 'Requested') return;
    if (action === 'Approved') {
      applyDecision(row, 'Approved', row.preferredDate || '', row.preferredTime || '');
    } else if (action === 'Declined') {
      applyDecision(row, 'Declined', '', '');
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
  const monthStartDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();
  const monthDays = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const calendarCells = Array.from({ length: 42 }, (_, idx) => {
    const dayNum = idx - monthStartDay + 1;
    if (dayNum < 1 || dayNum > monthDays) return null;
    const dateObj = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), dayNum);
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dayNum).padStart(2, '0');
    const iso = `${y}-${m}-${d}`;
    const dayOfWeek = dateObj.getDay();
    return { dayNum, iso, dayOfWeek };
  });
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
  const visibleQueue = queue.filter((row) => row.status !== 'Declined');
  const filteredQueue = selectedCalendarDate
    ? visibleQueue.filter((row) => visitationCalendarDateKeys(row).includes(selectedCalendarDate))
    : visibleQueue;
  const requestCountByDate = useMemo(() => {
    const map = new Map();
    visibleQueue.forEach((row) => {
      visitationCalendarDateKeys(row).forEach((d) => {
        map.set(d, (map.get(d) || 0) + 1);
      });
    });
    return map;
  }, [visibleQueue]);

  const visitationsOnIso = (iso) =>
    visibleQueue.filter((row) => visitationCalendarDateKeys(row).includes(iso));

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
    <div className="ap-outer" style={{ display: 'flex', minHeight: '100vh', background: '#F8F9FD', fontFamily: "'Inter', sans-serif", color: '#1B2559' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        .ap-outer { width: 100%; max-width: 100%; overflow-x: hidden; }
        .ap-outer .desktop-sidebar,
        .ap-outer .desktop-sidebar * { box-sizing: border-box; }
        .desktop-sidebar {
          width: ${isExpanded ? '280px' : '110px'};
          background: white;
          border-right: 1px solid #F1F1F1;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          padding: 25px 0 0;
          z-index: 100;
          transition: width 0.3s cubic-bezier(0.4,0,0.2,1);
          cursor: pointer;
          position: fixed;
          top: 0;
          left: 0;
          height: 100vh;
          overflow: hidden;
          flex-shrink: 0;
          box-shadow: 4px 0 24px rgba(27, 37, 89, 0.06);
        }
        .sidebar-logo-container {
          display: flex;
          justify-content: center;
          width: 100%;
          margin-bottom: 28px;
          align-self: center;
          flex-shrink: 0;
        }
        .sidebar-logo { width: ${isExpanded ? '120px' : '70px'}; transition: width 0.3s ease; }
        .sidebar-nav-scroll {
          flex: 1 1 0;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          width: 100%;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          align-items: stretch;
          margin: 0;
          padding: 0;
        }
        .sidebar-nav-item {
          display: flex;
          align-items: center;
          width: 100%;
          padding: 0 ${isExpanded ? '28px' : '0'};
          justify-content: ${isExpanded ? 'flex-start' : 'center'};
          gap: 14px;
          margin: 0 0 6px 0;
          min-height: 48px;
          box-sizing: border-box;
        }
        .sidebar-label {
          display: ${isExpanded ? 'block' : 'none'};
          font-weight: 600;
          font-size: 15px;
          color: #707EAE;
          line-height: 1.25;
          white-space: normal;
          max-width: 210px;
        }
        .sidebar-footer {
          flex-shrink: 0;
          width: 100%;
          padding: 16px 0 20px;
          margin-top: auto;
          border-top: 1px solid #f1f5f9;
        }
        .icon-box {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s;
          background: #E9EDF7;
          color: #1B2559;
        }
        .icon-box.active { background: #F54E25; color: white; }
        .icon-box.inactive { background: transparent; color: #A3AED0; }
        .ap-main { flex: 1; min-height: 100vh; margin-left: ${isExpanded ? '280px' : '110px'}; transition: margin-left 0.3s cubic-bezier(0.4,0,0.2,1); padding: 34px 30px 42px; }
        .mini-calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; }
        .calendar-shell {
          margin-top: 12px;
          border: 1px solid #dbe4f0;
          border-radius: 14px;
          padding: 14px;
          background: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
          box-shadow: inset 0 1px 0 #ffffff, 0 6px 18px rgba(15, 23, 42, 0.04);
        }
        .calendar-month-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          padding: 8px 10px;
          border-radius: 10px;
          background: linear-gradient(135deg, #f8fafc, #eef2f7);
          border: 1px solid #dbe4f0;
        }
        .calendar-nav-btn {
          border: 1px solid #d6e0ee;
          background: white;
          border-radius: 10px;
          padding: 5px 10px;
          cursor: pointer;
          color: #475569;
          font-weight: 800;
          transition: all 0.15s ease;
        }
        .calendar-nav-btn:hover { border-color: #fb923c; color: #ea580c; background: #fff7ed; }
        .calendar-weekday {
          text-align: center;
          font-size: 11px;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          padding: 3px 0;
        }
        .calendar-day-btn {
          border: 1px solid #dbe4f0;
          background: white;
          color: #334155;
          border-radius: 10px;
          min-height: 56px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 800;
          transition: all 0.15s ease;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 0 rgba(255, 255, 255, 0.95) inset;
        }
        .calendar-day-btn:hover { border-color: #fb923c; color: #ea580c; background: #fff7ed; transform: translateY(-2px); box-shadow: 0 6px 14px rgba(251, 146, 60, 0.14); }
        .calendar-day-btn.selected {
          background: linear-gradient(145deg, #fb923c, #f97316);
          border-color: #f97316;
          color: white;
          box-shadow: 0 8px 16px rgba(249, 115, 22, 0.22);
        }
        .calendar-day-btn.today {
          border-color: #f59e0b;
          box-shadow: inset 0 0 0 1px #fcd34d;
        }
        .calendar-day-btn.weekend {
          background: linear-gradient(180deg, #fffaf2, #fff4e6);
          border-color: #fde1b8;
          color: #9a3412;
        }
        .calendar-day-btn.holiday {
          background: linear-gradient(180deg, #fff1f2, #ffe4e6);
          border-color: #fecdd3;
          color: #be123c;
        }
        .calendar-day-btn.has-request {
          border-color: #93c5fd;
          box-shadow: inset 0 0 0 1px #bfdbfe;
        }
        .request-dot {
          position: absolute;
          top: 6px;
          right: 6px;
          min-width: 17px;
          height: 17px;
          border-radius: 999px;
          background: #f97316;
          color: #fff;
          font-size: 10px;
          font-weight: 900;
          line-height: 17px;
          text-align: center;
          padding: 0 4px;
          box-shadow: 0 2px 8px rgba(249, 115, 22, 0.35);
        }
        .calendar-day-btn.selected.weekend,
        .calendar-day-btn.selected.holiday,
        .calendar-day-btn.selected.today {
          background: linear-gradient(145deg, #fb923c, #f97316);
          border-color: #f97316;
          color: white;
          box-shadow: 0 8px 16px rgba(249, 115, 22, 0.22);
        }
        .holiday-dot {
          position: absolute;
          bottom: 6px;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #e11d48;
          opacity: 0.85;
        }
        .day-number {
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 0.01em;
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
      <aside className="desktop-sidebar" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="sidebar-logo-container"><img src={logoBH} alt="Kalinga" className="sidebar-logo" /></div>
        <nav className="sidebar-nav-scroll" aria-label="Admin navigation">
          {!isClm ? (
            <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-dashboard'); }}><div className="icon-box inactive"><LayoutGrid size={22} /></div><span className="sidebar-label">Dashboard</span></div>
          ) : null}
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-patient-database'); }}><div className="icon-box inactive"><HeartPulse size={22} /></div><span className="sidebar-label">{isClm ? 'Patient records' : 'Patient Management'}</span></div>
          {!isClm ? (
            <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-admission-management'); }}><div className="icon-box inactive"><ClipboardList size={22} /></div><span className="sidebar-label">Admission Management</span></div>
          ) : null}
          {!isClm ? (
            <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-discharge-management'); }}><div className="icon-box inactive"><ArrowRightSquare size={22} /></div><span className="sidebar-label">Discharge Management</span></div>
          ) : null}
          {!isClm ? (
            <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-user-management'); }}><div className="icon-box inactive"><Users size={22} /></div><span className="sidebar-label">User Management</span></div>
          ) : null}
          {!isClm ? (
            <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-staff-management'); }}><div className="icon-box inactive"><Stethoscope size={22} /></div><span className="sidebar-label">Staff Management</span></div>
          ) : null}
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-recovery-roadmap'); }}><div className="icon-box inactive"><CheckCircle2 size={22} /></div><span className="sidebar-label">Recovery Roadmap</span></div>
          {!isClm ? (
            <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-content-management'); }}><div className="icon-box inactive"><LayoutTemplate size={22} /></div><span className="sidebar-label">Content management</span></div>
          ) : null}
          <div className="sidebar-nav-item" onClick={(e) => e.stopPropagation()}><div className="icon-box active"><Calendar size={22} /></div><span className="sidebar-label" style={{ color: '#F54E25' }}>Appointments</span></div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-reports'); }}><div className="icon-box inactive"><FileText size={22} /></div><span className="sidebar-label">Printable reports</span></div>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate(isClm ? '/case-dashboard/profile' : '/admin-profile'); }}>
            <div className="icon-box inactive"><User size={22} /></div>
            <span className="sidebar-label">{isClm ? 'Profile' : 'Profile & Security'}</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/login'); }}>
            <LogOut size={22} color="#F54E25" style={{ marginLeft: isExpanded ? '0' : '10px', flexShrink: 0 }} />
            <span className="sidebar-label" style={{ color: '#F54E25' }}>Logout</span>
          </div>
        </div>
      </aside>
      <main className="ap-main">
        <div className="admin-appt-hero">
          <div>
            <div className="admin-appt-title">Admin Appointment Management</div>
            <div className="admin-appt-sub">Set clinic visitation windows and manage family appointment decisions professionally.</div>
          </div>
          <div className="admin-pill">{queue.length} total requests</div>
        </div>
        <div style={{ background: 'white', border: '1px solid #E9EDF7', borderRadius: 18, padding: 18, marginBottom: 16 }}>
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
          <div className="calendar-shell">
            <div className="calendar-month-bar">
              <button type="button" className="calendar-nav-btn" onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>{'<'}</button>
              <div style={{ fontWeight: 900, fontSize: 13, color: '#1e293b', letterSpacing: '0.02em' }}>{monthLabel}</div>
              <button type="button" className="calendar-nav-btn" onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>{'>'}</button>
            </div>
            <div className="mini-calendar-grid" style={{ marginBottom: 6 }}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => <div key={d} className="calendar-weekday">{d}</div>)}
            </div>
            <div className="mini-calendar-grid">
              {calendarCells.map((cell, idx) => (
                (() => {
                  const mmdd = cell?.iso ? cell.iso.slice(5) : '';
                  const isHoliday = Boolean(cell && HOLIDAY_LABELS[mmdd]);
                  const isWeekend = Boolean(cell && (cell.dayOfWeek === 0 || cell.dayOfWeek === 6));
                  const requestCount = cell?.iso ? (requestCountByDate.get(cell.iso) || 0) : 0;
                  const hasRequest = requestCount > 0;
                  return (
                <button
                  key={`admin-cal-cell-${idx}`}
                  type="button"
                  disabled={!cell}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!cell?.iso) return;
                    const items = visitationsOnIso(cell.iso);
                    if (items.length > 0) {
                      if (selectedCalendarDate === cell.iso && dayAppointmentsModal?.iso === cell.iso) {
                        setSelectedCalendarDate('');
                        setDayAppointmentsModal(null);
                      } else {
                        setSelectedCalendarDate(cell.iso);
                        setDayAppointmentsModal({ iso: cell.iso, items });
                      }
                    } else {
                      setDayAppointmentsModal(null);
                      setSelectedCalendarDate((prev) => (prev === cell.iso ? '' : cell.iso));
                    }
                  }}
                  className={[
                    'calendar-day-btn',
                    cell?.iso === selectedCalendarDate ? 'selected' : '',
                    cell?.iso === todayIso ? 'today' : '',
                    isWeekend ? 'weekend' : '',
                    isHoliday ? 'holiday' : '',
                    hasRequest ? 'has-request' : '',
                  ].join(' ')}
                  style={{ opacity: cell ? 1 : 0.35 }}
                  title={isHoliday ? HOLIDAY_LABELS[mmdd] : isWeekend ? 'Weekend' : ''}
                >
                  {cell ? <span className="day-number">{cell.dayNum}</span> : ''}
                  {hasRequest ? <span className="request-dot">{requestCount}</span> : null}
                  {isHoliday ? <span className="holiday-dot" /> : null}
                </button>
                  );
                })()
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#64748B' }}>
              {selectedCalendarDate
                ? `Filtering requests for ${selectedCalendarDate}. Dates with a blue dot have visit requests — click to view patient, date, and time.`
                : 'Click a date to filter the queue. Dates with visit requests open a summary with patient, date, and time.'}
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 14, fontSize: 11, color: '#64748B', fontWeight: 700 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: '#bfdbfe', border: '1px solid #93c5fd' }} />Weekend</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: '#fecaca', border: '1px solid #f87171' }} />Holiday</span>
            </div>
          </div>
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
                  <div style={{ fontWeight: 700 }}>{row.familyName || 'Family'} · {row.patientName || 'Patient'}</div>
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
                      background: st === 'Approved' ? '#DCFCE7' : st === 'Declined' ? '#FEE2E2' : st === 'Rescheduled' ? '#E0E7FF' : '#FEF3C7',
                      color: st === 'Approved' ? '#166534' : st === 'Declined' ? '#991B1B' : st === 'Rescheduled' ? '#3730A3' : '#92400E',
                      border: `1px solid ${st === 'Approved' ? '#BBF7D0' : st === 'Declined' ? '#FECACA' : st === 'Rescheduled' ? '#C7D2FE' : '#FDE68A'}`,
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
                  {rescheduleModal.row.patientName || 'Patient'} · {rescheduleModal.row.familyName || 'Family'}
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
              <div style={{ fontSize: 11, color: '#64748b' }}>
                Family notification preview:{' '}
                {rescheduleModal.reasonType === 'Other reason'
                  ? (String(rescheduleModal.otherReason || '').trim() || '—')
                  : (String(rescheduleModal.reasonType || '').trim() || '—')}
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
                  setRescheduleModal({ open: false, row: null, date: '', time: '13:00', reasonType: '', otherReason: '' });
                }}
              >
                Save reschedule
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
                    <div className="ap-day-modal-patient">{row.patientName || 'Patient'}</div>
                    <div className="ap-day-modal-meta">
                      {row.familyName ? (
                        <>
                          Family / contact:
                          {' '}
                          {row.familyName}
                          <br />
                        </>
                      ) : null}
                      Status:
                      {' '}
                      {st}
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
