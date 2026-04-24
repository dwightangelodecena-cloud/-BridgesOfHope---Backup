import React, { useEffect, useState } from 'react';
import { Home, TrendingUp, User, LogOut, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logo from '@/assets/logo2.png';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { APP_DATA_REFRESH } from '@/lib/appDataRefresh';
import {
  loadVisitationSettings,
  loadVisitationSettingsShared,
  listVisitationRequestsByFamily,
  createVisitationRequest,
  replaceVisitationRequests,
  upsertVisitationRequest,
} from '@/lib/visitationAppointments';

export default function FamilyAppointmentsPage() {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [patients, setPatients] = useState([]);
  const [familyUserId, setFamilyUserId] = useState('');
  const [familyName, setFamilyName] = useState('Family User');
  const [visitationSettings, setVisitationSettings] = useState(() => loadVisitationSettings());
  const [requests, setRequests] = useState([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    patientId: '',
    patientName: '',
    preferredDate: '',
    preferredTime: '',
    note: '',
  });
  const WEEKDAY_TO_INDEX = {
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

  useEffect(() => {
    let cancelled = false;
    const loadUserAndPatients = async () => {
      if (!isSupabaseConfigured()) {
        const localPatients = JSON.parse(localStorage.getItem('bh_patients') || '[]');
        if (!cancelled) {
          setFamilyUserId('local-family');
          setFamilyName('Family User');
          setPatients(localPatients);
        }
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const display = user.user_metadata?.full_name || user.email || 'Family User';
      const { data } = await supabase
        .from('patients')
        .select('id, full_name')
        .eq('family_id', user.id)
        .is('discharged_at', null)
        .order('admitted_at', { ascending: false });
      if (!cancelled) {
        setFamilyUserId(user.id);
        setFamilyName(display);
        setPatients((data || []).map((r) => ({ id: r.id, name: r.full_name })));
      }
    };
    loadUserAndPatients();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!familyUserId) return;
    const load = async () => {
      const latestSettings = await loadVisitationSettingsShared();
      setVisitationSettings(latestSettings || loadVisitationSettings());
      const localRows = listVisitationRequestsByFamily(familyUserId);
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase
          .from('visitation_requests')
          .select('*')
          .eq('family_id', familyUserId)
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
            status: r.status || 'Requested',
            confirmedDate: r.confirmed_date || '',
            confirmedTime: r.confirmed_time || '',
            adminNote: r.admin_note || '',
            createdAt: r.created_at || '',
            updatedAt: r.updated_at || '',
          }));
          const seen = new Set(fromDb.map((r) => String(r.id)));
          const merged = [...fromDb, ...localRows.filter((r) => !seen.has(String(r.id)))];
          merged.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
          replaceVisitationRequests(merged);
          setRequests(merged.filter((r) => String(r.familyId || '') === String(familyUserId || '')));
          return;
        }
      }
      setRequests(localRows);
    };
    void load();
    window.addEventListener('storage', load);
    window.addEventListener(APP_DATA_REFRESH, load);
    return () => {
      window.removeEventListener('storage', load);
      window.removeEventListener(APP_DATA_REFRESH, load);
    };
  }, [familyUserId]);

  const submitRequest = () => {
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
      const created = createVisitationRequest({
        familyId: familyUserId || 'local-family',
        familyName,
        patientId: form.patientId,
        patientName: form.patientName,
        preferredDate: form.preferredDate,
        preferredTime: form.preferredTime,
        note: form.note,
      });
      if (isSupabaseConfigured()) {
        const looksUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
        const requestId = typeof globalThis.crypto?.randomUUID === 'function'
          ? globalThis.crypto.randomUUID()
          : created.id;
        void supabase.from('visitation_requests').insert({
          id: requestId,
          family_id: looksUuid(created.familyId) ? created.familyId : null,
          family_name: created.familyName || null,
          patient_id: looksUuid(created.patientId) ? created.patientId : null,
          patient_name: created.patientName || null,
          preferred_date: created.preferredDate || null,
          preferred_time: created.preferredTime || null,
          note: created.note || null,
          status: created.status || 'Requested',
          confirmed_date: null,
          confirmed_time: null,
          admin_note: null,
        }).select('*').single().then(({ data, error }) => {
          if (error) {
            console.warn('[visitation_requests insert]', error.message);
            setFormError(`Request saved locally only: ${error.message}`);
            return;
          }
          if (!data) return;
          upsertVisitationRequest({
            id: data.id,
            familyId: data.family_id || '',
            familyName: data.family_name || '',
            patientId: data.patient_id || '',
            patientName: data.patient_name || '',
            preferredDate: data.preferred_date || '',
            preferredTime: data.preferred_time || '',
            note: data.note || '',
            status: data.status || 'Requested',
            confirmedDate: data.confirmed_date || '',
            confirmedTime: data.confirmed_time || '',
            adminNote: data.admin_note || '',
            createdAt: data.created_at || '',
            updatedAt: data.updated_at || '',
          });
          window.dispatchEvent(new Event('storage'));
          window.dispatchEvent(new Event(APP_DATA_REFRESH));
        });
      }
      setForm({ patientId: '', patientName: '', preferredDate: '', preferredTime: '', note: '' });
      setRequests(listVisitationRequestsByFamily(familyUserId || 'local-family'));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event(APP_DATA_REFRESH));
    } finally {
      setSaving(false);
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
  const allowedWeekdays = (visitationSettings.days || [])
    .map((d) => WEEKDAY_TO_INDEX[String(d || '').trim().toLowerCase()])
    .filter((v) => Number.isInteger(v));
  const timeSlots = (() => {
    const [sh = '13', sm = '00'] = String(visitationSettings.startTime || '13:00').split(':');
    const [eh = '17', em = '00'] = String(visitationSettings.endTime || '17:00').split(':');
    const startMin = Number(sh) * 60 + Number(sm);
    const endMin = Number(eh) * 60 + Number(em);
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) return [];
    const slots = [];
    for (let m = startMin; m <= endMin; m += 30) {
      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      slots.push(`${hh}:${mm}`);
    }
    return slots;
  })();
  const isBookableDate = (cell) => {
    if (!cell) return false;
    const mmdd = cell.iso.slice(5);
    if (HOLIDAY_LABELS[mmdd]) return false;
    if (!allowedWeekdays.length) return true;
    return allowedWeekdays.includes(cell.dayOfWeek);
  };

  useEffect(() => {
    if (!timeSlots.length) {
      if (form.preferredTime) setForm((prev) => ({ ...prev, preferredTime: '' }));
      return;
    }
    if (!form.preferredTime || !timeSlots.includes(form.preferredTime)) {
      setForm((prev) => ({ ...prev, preferredTime: timeSlots[0] }));
    }
  }, [visitationSettings.startTime, visitationSettings.endTime]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="app-container" style={{ color: '#1B2559' }}>
      <style>{`
        .app-container {
          display: flex;
          width: 100vw;
          height: 100vh;
          background: #F8F9FD;
          font-family: 'Inter', -apple-system, sans-serif;
          overflow: hidden;
          touch-action: manipulation;
        }
        .desktop-sidebar {
          width: ${isExpanded ? '280px' : '110px'};
          background: white;
          border-right: 1px solid #F1F1F1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 25px 0 170px;
          z-index: 100;
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          position: relative;
        }
        .sidebar-logo-container { display: flex; justify-content: center; width: 100%; margin-bottom: 40px; }
        .sidebar-logo { width: ${isExpanded ? '120px' : '70px'}; transition: width 0.3s ease; }
        .sidebar-nav-item {
          display: flex; align-items: center; width: 100%;
          padding: 0 ${isExpanded ? '35px' : '0'};
          justify-content: ${isExpanded ? 'flex-start' : 'center'};
          gap: 20px; margin-bottom: 25px; min-height: 52px; box-sizing: border-box; border: 2px solid transparent; border-radius: 12px;
        }
        .sidebar-nav-item.sidebar-nav-active { border-color: #F54E25; }
        .sidebar-icon-wrap { padding: 12px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .sidebar-label { display: ${isExpanded ? 'block' : 'none'}; font-weight: 700; font-size: 18px; color: #707EAE; white-space: nowrap; }
        .sidebar-primary { width: 100%; }
        .sidebar-footer {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 20px;
          width: 100%;
        }
        .sidebar-footer .sidebar-nav-item { margin-bottom: 0; }
        .sidebar-footer .sidebar-nav-item + .sidebar-nav-item { margin-top: 14px; }
        .main-view {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .top-nav {
          height: 85px;
          background: white;
          display: flex;
          align-items: center;
          padding: 0 30px;
          border-bottom: 1px solid #F1F1F1;
          box-sizing: border-box;
          z-index: 300;
        }
        .view-title { font-size: 20px; font-weight: 800; color: #1B2559; }
        .scroll-content {
          flex: 1;
          overflow-y: auto;
          padding: 22px 30px 30px;
        }
        .appt-hero {
          background: linear-gradient(135deg, #fff 0%, #fff7ed 100%);
          border: 1px solid #fed7aa;
          border-radius: 16px;
          padding: 16px 18px;
          margin-bottom: 14px;
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: center;
          flex-wrap: wrap;
        }
        .appt-hero-title { font-size: 17px; font-weight: 900; color: #7c2d12; margin-bottom: 4px; }
        .appt-hero-sub { font-size: 12px; color: #9a3412; font-weight: 600; }
        .appt-pill {
          border: 1px solid #fdba74;
          background: #fff;
          color: #9a3412;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.02em;
        }
        .appt-main-grid {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 16px;
        }
        .appt-card {
          background: rgba(255, 255, 255, 0.88);
          backdrop-filter: blur(8px);
          border: 1px solid #e6edf8;
          border-radius: 18px;
          padding: 18px;
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
        }
        .appt-card-title {
          font-size: 14px;
          font-weight: 900;
          color: #0f172a;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .appt-note-list { display: grid; gap: 8px; }
        .appt-note-item {
          border: 1px dashed #e2e8f0;
          border-radius: 10px;
          padding: 10px;
          font-size: 12px;
          color: #475569;
          line-height: 1.45;
          font-weight: 600;
          background: #f8fafc;
        }
        @media (max-width: 1050px) {
          .appt-main-grid { grid-template-columns: 1fr; }
        }
        .mini-calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 8px;
        }
        .calendar-shell {
          margin-top: 14px;
          border: 1px solid #dbe4f0;
          border-radius: 14px;
          padding: 14px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
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
          background: #ffffff;
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
          background: #ffffff;
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
          border: 1px solid #dde7f4;
          border-radius: 12px;
          padding: 10px 12px;
          background: #fff;
          font-size: 12px;
          transition: border-color .15s ease, box-shadow .15s ease;
        }
        .modern-input:focus {
          outline: none;
          border-color: #fb923c;
          box-shadow: 0 0 0 3px rgba(251, 146, 60, 0.16);
        }
        .modern-btn {
          border: none;
          background: linear-gradient(145deg, #f97316, #ea580c);
          color: white;
          border-radius: 12px;
          padding: 10px 14px;
          font-weight: 800;
          letter-spacing: .01em;
          box-shadow: 0 8px 18px rgba(234, 88, 12, 0.24);
          transition: transform .15s ease, box-shadow .15s ease;
          cursor: pointer;
        }
        .modern-btn:hover { transform: translateY(-1px); box-shadow: 0 10px 20px rgba(234, 88, 12, 0.28); }
        .calendar-day-btn.available-day {
          border-color: #fdba74;
          background: #fff7ed;
        }
        .calendar-day-btn.unavailable-day {
          background: #f8fafc;
          border-color: #e2e8f0;
          color: #94a3b8;
          cursor: not-allowed;
          box-shadow: none;
        }
      `}</style>
      <aside className="desktop-sidebar" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="sidebar-logo-container"><img src={logo} alt="BH" className="sidebar-logo" /></div>
        <div className="sidebar-primary">
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/home'); }}>
            <div className="sidebar-icon-wrap"><Home size={22} color="#707EAE" /></div>
            <span className="sidebar-label">Dashboard</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/progress'); }}>
            <div className="sidebar-icon-wrap"><TrendingUp size={22} color="#707EAE" /></div>
            <span className="sidebar-label">Progress</span>
          </div>
          <div className="sidebar-nav-item sidebar-nav-active" onClick={(e) => e.stopPropagation()}>
            <div className="sidebar-icon-wrap"><Calendar size={22} color="#707EAE" /></div>
            <span className="sidebar-label">Appointments</span>
          </div>
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/profile'); }}>
            <div className="sidebar-icon-wrap"><User size={22} color="#707EAE" /></div>
            <span className="sidebar-label">Profile</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/login'); }}>
            <div className="sidebar-icon-wrap"><LogOut size={22} color="#F54E25" /></div>
            <span className="sidebar-label" style={{ color: '#F54E25' }}>Logout</span>
          </div>
        </div>
      </aside>
      <main className="main-view">
        <header className="top-nav">
          <span className="view-title">Appointment</span>
        </header>
        <div className="scroll-content">
        <div className="appt-hero">
          <div>
            <div className="appt-hero-title">Family Appointment</div>
            <div className="appt-hero-sub">Book visitation requests and track confirmation status in one place.</div>
          </div>
          <div className="appt-pill">
            Fixed visitation: {visitationSettings.days.join(', ')} · {visitationSettings.startTime} - {visitationSettings.endTime}
          </div>
        </div>
        <div className="appt-main-grid">
        <div className="appt-card">
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800 }}>Request Appointment (Calendar + Time)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <select
              value={form.patientId}
              onChange={(e) => {
                const selected = patients.find((p) => String(p.id) === String(e.target.value));
                setForm((prev) => ({ ...prev, patientId: e.target.value, patientName: selected?.name || '' }));
              }}
              className="modern-input"
            >
              <option value="">Select patient</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="date" className="modern-input" value={form.preferredDate} readOnly />
            <select
              className="modern-input"
              value={form.preferredTime}
              onChange={(e) => setForm((prev) => ({ ...prev, preferredTime: e.target.value }))}
            >
              {!timeSlots.length ? <option value="">No available time slots</option> : null}
              {timeSlots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
            <input className="modern-input" type="text" value={form.note} onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))} placeholder="Optional note for admin" />
            <button type="button" className="modern-btn" onClick={submitRequest} disabled={saving}>{saving ? 'Submitting...' : 'Request Slot'}</button>
          </div>
          {formError ? (
            <div style={{ marginTop: 8, color: '#b91c1c', fontSize: 12, fontWeight: 700 }}>{formError}</div>
          ) : null}
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
                  const isBookable = isBookableDate(cell);
                  return (
                <button
                  key={`cal-cell-${idx}`}
                  type="button"
                  disabled={!cell || !isBookable}
                  onClick={() => {
                    if (!cell || !isBookable) return;
                    setForm((prev) => ({ ...prev, preferredDate: cell.iso, preferredTime: prev.preferredTime || (timeSlots[0] || '') }));
                    setFormError('');
                  }}
                  className={[
                    'calendar-day-btn',
                    cell?.iso === form.preferredDate ? 'selected' : '',
                    cell?.iso === todayIso ? 'today' : '',
                    isWeekend ? 'weekend' : '',
                    isHoliday ? 'holiday' : '',
                    isBookable ? 'available-day' : 'unavailable-day',
                  ].join(' ')}
                  style={{ opacity: cell ? 1 : 0.35 }}
                  title={isHoliday ? HOLIDAY_LABELS[mmdd] : (!isBookable ? 'Not available by admin schedule' : (isWeekend ? 'Weekend' : 'Available'))}
                >
                  {cell ? <span className="day-number">{cell.dayNum}</span> : ''}
                  {isHoliday ? <span className="holiday-dot" /> : null}
                </button>
                  );
                })()
              ))}
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 14, fontSize: 11, color: '#64748B', fontWeight: 700 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: '#fdba74', border: '1px solid #fb923c' }} />Available</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: '#fed7aa', border: '1px solid #fdba74' }} />Weekend</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: '#fecaca', border: '1px solid #f87171' }} />Holiday</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: '#e2e8f0', border: '1px solid #cbd5e1' }} />Unavailable</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 16 }}>
        <div className="appt-card">
          <h3 className="appt-card-title"><Calendar size={16} color="#F54E25" /> Appointment Status</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {requests.map((row) => (
              <div key={row.id} style={{ border: '1px solid #EEF2FF', borderRadius: 10, padding: 10, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{row.patientName} · {row.preferredDate} {row.preferredTime}</div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    {row.confirmedDate ? `Confirmed: ${row.confirmedDate} ${row.confirmedTime || ''}` : 'Waiting for admin decision'}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    borderRadius: 999,
                    padding: '4px 9px',
                    height: 'fit-content',
                    background: row.status === 'Approved' ? '#DCFCE7' : row.status === 'Declined' ? '#FEE2E2' : row.status === 'Rescheduled' ? '#E0E7FF' : '#FEF3C7',
                    color: row.status === 'Approved' ? '#166534' : row.status === 'Declined' ? '#991B1B' : row.status === 'Rescheduled' ? '#3730A3' : '#92400E',
                    border: `1px solid ${row.status === 'Approved' ? '#BBF7D0' : row.status === 'Declined' ? '#FECACA' : row.status === 'Rescheduled' ? '#C7D2FE' : '#FDE68A'}`,
                  }}
                >
                  {row.status}
                </div>
              </div>
            ))}
            {requests.length === 0 ? <div style={{ color: '#94a3b8', fontSize: 13 }}>No requests yet.</div> : null}
          </div>
        </div>
        <div className="appt-card">
          <h3 className="appt-card-title"><Home size={16} color="#F54E25" /> Booking Notes</h3>
          <div className="appt-note-list">
            <div className="appt-note-item">Appointments remain <strong>Requested</strong> until admin confirms availability.</div>
            <div className="appt-note-item"><strong>Rescheduled</strong> means the facility approved with a different date/time.</div>
            <div className="appt-note-item">Please use notes for medical or travel constraints to help scheduling.</div>
          </div>
        </div>
        </div>
        </div>
        </div>
      </main>
    </div>
  );
}
