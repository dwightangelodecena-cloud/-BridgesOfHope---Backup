import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Home, User, LogOut, Calendar, ClipboardList, BarChart3, FileText, Bell,
  CheckCircle2, TrendingUp, Activity, X, ChevronLeft, ChevronRight,
  Users, Heart, Stethoscope, BookOpen
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import logo from '@/assets/kalingalogo.png';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { APP_DATA_REFRESH } from '@/lib/appDataRefresh';
import { uiPatientFromRow } from '@/lib/dbMappers';
import { FAMILY_COLORS } from '@/components/family/shared/ui';
import FloatingChatHead from '@/components/family/FloatingChatHead';
import { loadFamilyNotifications, saveFamilyNotifications } from '@/lib/familyNotifications';

/* ─── design-only helpers ─── */
function ProgressBar({ value = 0, color = '#F54E25', height = 6 }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <div style={{ height, background: '#F1F5F9', borderRadius: 999, overflow: 'hidden', flex: 1 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999, transition: 'width .5s ease' }} />
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
      {children}
    </p>
  );
}

function ReportFieldRow({ label, value, icon: Icon }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E9EDF7', borderRadius: 14, padding: '14px 16px', boxShadow: '0 2px 8px rgba(15,23,42,0.03)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {Icon && <Icon size={13} color="#F54E25" />}
        <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', lineHeight: 1.55 }}>{value || '—'}</div>
    </div>
  );
}

export default function FamilyReportsPage() {
  const navigate = useNavigate();
  const { patientId } = useParams();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState('all');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedReportId, setSelectedReportId] = useState('');
  const [patients, setPatients] = useState([]);
  const [weeklyReportsByPatient, setWeeklyReportsByPatient] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [firstName, setFirstName] = useState('Family');
  const [userInitials, setUserInitials] = useState('FU');
  const notificationsDesktopRef = useRef(null);
  const notificationsMobileRef = useRef(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationItems, setNotificationItems] = useState(() => loadFamilyNotifications());

  /* ── all data logic 100% unchanged ── */
  const formatDate = (iso) => { if (!iso) return 'N/A'; try { return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return 'N/A'; } };
  const calculateAge = (dob) => { if (!dob) return 'N/A'; const birth = new Date(dob); if (Number.isNaN(birth.getTime())) return 'N/A'; const today = new Date(); let age = today.getFullYear() - birth.getFullYear(); const m = today.getMonth() - birth.getMonth(); if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1; return age >= 0 ? age : 'N/A'; };

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setLoading(true); setLoadError('');
      try {
        if (!isSupabaseConfigured()) { if (!cancelled) { setPatients([]); setWeeklyReportsByPatient({}); setLoadError('Supabase is not configured.'); } return; }
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData?.user) { if (!cancelled) { setPatients([]); setWeeklyReportsByPatient({}); setLoadError('Please sign in to view reports.'); } return; }
        const user = authData.user;
        const displayName = user.user_metadata?.full_name || user.email || 'Family User';
        const nextFirstName = String(displayName).trim().split(/\s+/)[0] || 'Family';
        if (!cancelled) setFirstName(nextFirstName);
        const { data: patientRows, error: patientErr } = await supabase.from('patients').select('id, full_name, admitted_at, progress_percent, clinical_status, family_id, discharged_at, date_of_birth').eq('family_id', user.id).order('admitted_at', { ascending: false });
        if (patientErr) throw patientErr;
        let rows = patientRows || [];
        if (!rows.length) {
          const { data: admissionRows } = await supabase.from('admission_requests').select('id, patient_name, patient_birth_date, reason_for_admission, status, created_at, decided_at').eq('family_id', user.id).eq('status', 'approved').order('decided_at', { ascending: false });
          const names = [...new Set((admissionRows || []).map((a) => (a.patient_name || '').trim()).filter(Boolean))];
          let matched = [];
          if (names.length) {
            const { data: matchedRows } = await supabase.from('patients').select('id, full_name, admitted_at, progress_percent, clinical_status, family_id, discharged_at, date_of_birth').in('full_name', names).order('admitted_at', { ascending: false });
            matched = matchedRows || [];
          }
          if (matched.length) {
            rows = matched;
          } else {
            rows = (admissionRows || []).map((r) => ({ id: r.id, full_name: r.patient_name, admitted_at: r.decided_at || r.created_at, progress_percent: 0, clinical_status: 'Recovering', family_id: user.id, discharged_at: null, date_of_birth: r.patient_birth_date, primary_concern: r.reason_for_admission }));
          }
        }
        const mappedPatients = rows.map((row) => {
          const mapped = uiPatientFromRow(row);
          return {
            id: mapped?.id || row.id,
            name: mapped?.name || row.full_name || 'Resident',
            date: mapped?.date || formatDate(row.admitted_at),
            progress: mapped?.progress ?? 0,
            age: calculateAge(row.date_of_birth),
            discharged_at: row.discharged_at ?? mapped?.discharged_at ?? null,
          };
        });
        const ids = rows.map((r) => r.id).filter(Boolean);
        const byPatient = {};
        if (ids.length) {
          const { data: reportRows, error: reportErr } = await supabase.from('weekly_reports').select('*').in('patient_id', ids).order('week_number', { ascending: true });
          if (!reportErr && reportRows) { for (const row of reportRows) { const key = String(row.patient_id); if (!byPatient[key]) byPatient[key] = []; byPatient[key].push(row); } }
        }
        if (!cancelled) {
          setPatients(mappedPatients); setWeeklyReportsByPatient(byPatient);
          setSelectedPatient((prev) => { if (!prev) return null; const next = mappedPatients.find((p) => String(p.id) === String(prev.id)); return next || null; });
        }
      } catch (e) { if (!cancelled) { setPatients([]); setWeeklyReportsByPatient({}); setLoadError(e?.message || 'Unable to load reports right now.'); } }
      finally { if (!cancelled) setLoading(false); }
    };
    loadData();
    window.addEventListener('storage', loadData); window.addEventListener(APP_DATA_REFRESH, loadData);
    return () => { cancelled = true; window.removeEventListener('storage', loadData); window.removeEventListener(APP_DATA_REFRESH, loadData); };
  }, []);

  const allReports = useMemo(() => Object.values(weeklyReportsByPatient || {}).flat().filter(Boolean), [weeklyReportsByPatient]);
  const availableWeeks = useMemo(() => { const set = new Set(); for (const row of allReports) { if (row.week_number !== null && row.week_number !== undefined && row.week_number !== '') set.add(Number(row.week_number)); } return Array.from(set).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b); }, [allReports]);
  const selectedPatientReports = useMemo(() => { if (!selectedPatient) return []; const rows = weeklyReportsByPatient[String(selectedPatient.id)] || []; return [...rows].sort((a, b) => { const aw = Number(a.week_number) || 0, bw = Number(b.week_number) || 0; if (aw !== bw) return bw - aw; return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(); }); }, [selectedPatient, weeklyReportsByPatient]);
  const visibleReports = useMemo(() => selectedWeek === 'all' ? selectedPatientReports : selectedPatientReports.filter((r) => String(r.week_number) === String(selectedWeek)), [selectedPatientReports, selectedWeek]);
  const weeklyReport = visibleReports.find((r) => String(r.id) === String(selectedReportId)) || visibleReports[0] || null;

  useEffect(() => { if (!selectedPatient) { setSelectedReportId(''); return; } const next = visibleReports[0]; setSelectedReportId(next?.id ? String(next.id) : ''); }, [selectedPatient, selectedWeek, visibleReports]);
  useEffect(() => { if (!patientId || !patients.length) return; const match = patients.find((p) => String(p.id) === String(patientId)); if (match) setSelectedPatient(match); }, [patientId, patients]);
  useEffect(() => {
    let isMounted = true;
    const deriveInitials = (name) => name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'FU';
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      const fallbackProfile = localStorage.getItem('bh_family_profile');
      const fallbackName = fallbackProfile ? JSON.parse(fallbackProfile).fullName : null;
      let resolvedName = user?.user_metadata?.full_name || [user?.user_metadata?.first_name, user?.user_metadata?.last_name].filter(Boolean).join(' ') || fallbackName || 'Family User';
      if (user?.id) { const { data: profileRow } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(); if (profileRow?.full_name) resolvedName = profileRow.full_name; }
      if (isMounted) setUserInitials(deriveInitials(resolvedName));
    };
    loadUser();
    return () => { isMounted = false; };
  }, []);
  useEffect(() => { if (!showNotifications) return; const onDoc = (e) => { if (!notificationsDesktopRef.current?.contains(e.target) && !notificationsMobileRef.current?.contains(e.target)) setShowNotifications(false); }; document.addEventListener('mousedown', onDoc); return () => document.removeEventListener('mousedown', onDoc); }, [showNotifications]);
  const handleNotificationToggle = () => setShowNotifications((v) => !v);
  useEffect(() => { saveFamilyNotifications(notificationItems); }, [notificationItems]);

  /* derived */
  const patientInitials = (name) => name ? String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') : '?';

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: '#F0F4FF', fontFamily: "'DM Sans',-apple-system,sans-serif", overflow: 'hidden', touchAction: 'manipulation' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        button { font-family: inherit; }

        /* SIDEBAR (structure 100% unchanged) */
        .desktop-sidebar { width: ${isExpanded ? '280px' : '110px'}; background: #fff; border-right: 1px solid #F1F1F1; display: flex; flex-direction: column; align-items: center; padding: 25px 0 170px; position: relative; z-index: 100; transition: width 0.3s cubic-bezier(0.4,0,0.2,1); cursor: pointer; }
        .sidebar-logo-container { display: flex; justify-content: center; width: 100%; margin-bottom: 40px; }
        .sidebar-logo { width: ${isExpanded ? '120px' : '70px'}; transition: width .3s; }
        .sidebar-primary { width: 100%; }
        .sidebar-nav-item { display: flex; align-items: center; width: 100%; padding: 0 ${isExpanded ? '35px' : '0'}; justify-content: ${isExpanded ? 'flex-start' : 'center'}; gap: 20px; margin-bottom: 25px; min-height: 52px; border: 2px solid transparent; border-radius: 12px; box-sizing: border-box; }
        .sidebar-nav-item.sidebar-nav-active { border-color: #F54E25; }
        .sidebar-label { display: ${isExpanded ? 'block' : 'none'}; font-weight: 700; font-size: 18px; line-height: 1.2; color: #707EAE; max-width: 140px; white-space: normal; overflow-wrap: anywhere; }
        .sidebar-icon-wrap { padding: 12px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .sidebar-footer { position: absolute; left: 0; right: 0; bottom: 20px; width: 100%; }
        .sidebar-footer .sidebar-nav-item { margin-bottom: 0; }
        .sidebar-footer .sidebar-nav-item + .sidebar-nav-item { margin-top: 14px; }

        /* NOTIFICATIONS */
        .notifications-trigger { width: 40px; height: 40px; min-width: 40px; padding: 0; border-radius: 50%; border: none; background: #F54E25; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 14px rgba(245,78,37,0.35); }
        .notifications-trigger:hover { background: #e0421a; }
        .notifications-trigger svg { display: block; width: 20px; height: 20px; stroke: #fff; }
        .notifications-dropdown { position: absolute; top: calc(100% + 10px); right: 0; width: min(360px,calc(100vw - 48px)); background: #fff; border: 1px solid #E9EDF7; border-radius: 20px; box-shadow: 0 20px 60px rgba(15,23,42,0.14); padding: 20px; z-index: 400; }
        .user-avatar-top { width: 40px; height: 40px; background: linear-gradient(135deg,#F54E25,#EA580C); color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 13px; border: none; cursor: pointer; box-shadow: 0 4px 14px rgba(245,78,37,0.3); }

        /* PATIENT CARDS */
        .patient-card-btn { transition: transform .15s, box-shadow .15s, border-color .15s; }
        .patient-card-btn:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(15,23,42,0.1) !important; border-color: #FECDD3 !important; }

        /* HISTORY BUTTONS */
        .history-btn-item { transition: border-color .12s, background .12s; }
        .history-btn-item:hover { border-color: #FECDD3 !important; background: #FFFBFA !important; }

        /* SCROLL */
        .scroll-area::-webkit-scrollbar { width: 4px; }
        .scroll-area::-webkit-scrollbar-track { background: transparent; }
        .scroll-area::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 999px; }

        @media (max-width: 768px) {
          .desktop-sidebar, .top-nav-desktop { display: none !important; }
          .mobile-top-bar { display: flex !important; }
          .scroll-area { padding: 14px !important; padding-bottom: 90px !important; }
          .patient-grid { grid-template-columns: 1fr !important; }
          .mobile-bottom-nav { display: flex !important; }
        }
        .mobile-top-bar { display: none; }
        .mobile-bottom-nav { display: none; }
      `}</style>

      {/* ── SIDEBAR (100% unchanged) ── */}
      <aside className="desktop-sidebar" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="sidebar-logo-container"><img src={logo} alt="BH" className="sidebar-logo" /></div>
        <div className="sidebar-primary">
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/home'); }}><div className="sidebar-icon-wrap"><Home size={22} color="#707EAE" /></div><span className="sidebar-label">Dashboard</span></div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/patient-details'); }}><div className="sidebar-icon-wrap"><ClipboardList size={22} color="#707EAE" /></div><span className="sidebar-label">Patient Details</span></div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/progress'); }}><div className="sidebar-icon-wrap"><TrendingUp size={22} color="#707EAE" /></div><span className="sidebar-label">Request Management</span></div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/appointments'); }}><div className="sidebar-icon-wrap"><Calendar size={22} color="#707EAE" /></div><span className="sidebar-label">Appointments</span></div>
          <div className="sidebar-nav-item sidebar-nav-active" onClick={(e) => e.stopPropagation()}><div className="sidebar-icon-wrap"><BarChart3 size={22} color="#707EAE" /></div><span className="sidebar-label">Reports</span></div>
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/profile'); }}><div className="sidebar-icon-wrap"><User size={22} color="#707EAE" /></div><span className="sidebar-label">Profile</span></div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/login'); }}><div className="sidebar-icon-wrap"><LogOut size={22} color="#F54E25" /></div><span className="sidebar-label" style={{ color: '#F54E25' }}>Logout</span></div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top Nav */}
        <header className="top-nav-desktop" style={{ height: 68, background: '#fff', display: 'flex', alignItems: 'center', padding: '0 28px', borderBottom: '1px solid #EAEFFB', boxShadow: '0 1px 12px rgba(15,23,42,0.06)', zIndex: 300, boxSizing: 'border-box', flexShrink: 0 }}>
          <span style={{ color: '#F54E25', fontWeight: 900, fontSize: 18, letterSpacing: '-0.02em' }}>Weekly Reports</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div ref={notificationsDesktopRef} style={{ position: 'relative' }}>
              <button type="button" className="notifications-trigger" aria-expanded={showNotifications} aria-label="Notifications" onClick={handleNotificationToggle}>
                <Bell size={19} stroke="#fff" strokeWidth={2.2} />
              </button>
              {showNotifications && (
                <div className="notifications-dropdown">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 900, color: '#0F172A', fontSize: 14, marginBottom: 14 }}><Bell size={16} color="#F54E25" /> Notifications</div>
                  {notificationItems.length === 0 ? <div style={{ color: '#94A3B8', fontSize: 12 }}>No notifications.</div>
                    : notificationItems.map((item, idx) => (
                      <div key={`${item}-${idx}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10, fontSize: 12, color: '#334155' }}>
                        <CheckCircle2 size={14} color="#6366F1" style={{ flexShrink: 0, marginTop: 2 }} />
                        <span style={{ flex: 1 }}>{item}</span>
                        <button type="button" style={{ border: 'none', background: 'transparent', color: '#CBD5E1', cursor: 'pointer', fontSize: 16, padding: 0 }} onClick={() => setNotificationItems((prev) => prev.filter((_, i) => i !== idx))}>×</button>
                      </div>
                    ))}
                </div>
              )}
            </div>
            <button type="button" className="user-avatar-top" onClick={() => navigate('/profile')} aria-label="Open profile">{userInitials}</button>
          </div>
        </header>

        {/* Mobile Top Bar */}
        <div className="mobile-top-bar" style={{ alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 60, background: '#fff', borderBottom: '1px solid #F1F1F1' }}>
          <img src={logo} alt="BH" style={{ width: 48 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div ref={notificationsMobileRef} style={{ position: 'relative' }}>
              <button type="button" className="notifications-trigger" onClick={handleNotificationToggle} style={{ width: 34, height: 34 }}>
                <Bell size={17} stroke="#fff" strokeWidth={2.2} />
              </button>
              {showNotifications && (
                <div className="notifications-dropdown" style={{ right: 0, left: 'auto', width: 'min(340px,calc(100vw - 40px))' }}>
                  <div style={{ fontWeight: 900, color: '#0F172A', fontSize: 14, marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}><Bell size={16} color="#F54E25" /> Notifications</div>
                  {notificationItems.map((item, idx) => (
                    <div key={`m-${item}-${idx}`} style={{ display: 'flex', gap: 10, marginBottom: 10, fontSize: 12, color: '#334155' }}>
                      <CheckCircle2 size={14} color="#6366F1" />
                      <span style={{ flex: 1 }}>{item}</span>
                      <button type="button" style={{ border: 'none', background: 'transparent', color: '#CBD5E1', cursor: 'pointer', fontSize: 16, padding: 0 }} onClick={() => setNotificationItems((prev) => prev.filter((_, i) => i !== idx))}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button type="button" onClick={() => navigate('/profile')} style={{ width: 34, height: 34, background: '#F54E25', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 12, border: 'none', cursor: 'pointer' }}>{userInitials}</button>
          </div>
        </div>

        {/* ── SCROLL CONTENT ── */}
        <div className="scroll-area" style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 48px', background: FAMILY_COLORS.background }}>
          <div style={{ width: '100%', maxWidth: 1560, margin: '0 auto', display: 'grid', gap: 20 }}>

            {/* ① HERO BANNER */}
            <div style={{ background: 'linear-gradient(135deg,#0F172A 0%,#1E2D4F 50%,#2D1B69 100%)', borderRadius: 24, padding: '26px 30px', boxShadow: '0 16px 48px rgba(15,23,42,0.22)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.2),transparent 70%)' }} />
              <div style={{ position: 'absolute', bottom: -20, left: '40%', width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle,rgba(245,78,37,0.15),transparent 70%)' }} />
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BarChart3 size={16} color="#fff" />
                  </div>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Family Portal · Weekly Reports</span>
                </div>
                <h1 style={{ margin: 0, color: '#fff', fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em' }}>Patient Weekly Reports</h1>
                <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Select a resident to view their full report history and care updates</p>
              </div>
            </div>

            {/* ② PATIENT SELECTOR + STATUS */}
            <div style={{ background: '#fff', border: '1px solid #E9EDF7', borderRadius: 22, padding: '20px 24px', boxShadow: '0 4px 20px rgba(15,23,42,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: '#FFF1EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={14} color="#F54E25" /></div>
                    Select a Resident
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: 11, color: '#94A3B8' }}>Tap a card to view that resident's full report history</p>
                </div>
                {selectedPatient && (
                  <select value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)}
                    style={{ border: '1.5px solid #E9EDF7', borderRadius: 12, padding: '9px 14px', fontSize: 12, fontWeight: 700, color: '#0F172A', background: '#F8FAFF', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}>
                    <option value="all">All Weeks</option>
                    {availableWeeks.map((w) => <option key={w} value={String(w)}>Week {w}</option>)}
                  </select>
                )}
              </div>

              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 0', color: '#64748B', fontSize: 13, fontWeight: 600 }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #F54E25', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                  Loading live reports…
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}
              {loadError && <div style={{ color: '#EF4444', fontSize: 12, fontWeight: 700, padding: '10px 0' }}>{loadError}</div>}
              {!loading && !patients.length && !loadError && (
                <div style={{ textAlign: 'center', padding: '40px 20px', border: '1px dashed #E9EDF7', borderRadius: 18 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 16, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}><FileText size={22} color="#CBD5E1" /></div>
                  <p style={{ margin: 0, fontWeight: 800, color: '#334155', fontSize: 14 }}>No Assigned Patients</p>
                  <p style={{ margin: '6px 0 0', color: '#94A3B8', fontSize: 12 }}>Once patients are admitted, their reports will appear here.</p>
                </div>
              )}

              <div className="patient-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                {patients.map((p) => {
                  const reportCount = (weeklyReportsByPatient[String(p.id)] || []).length;
                  const progress = Number(p.progress) || 0;
                  const isActive = selectedPatient && String(selectedPatient.id) === String(p.id);
                  const isDischarged = Boolean(p.discharged_at);
                  const statusCfg = isDischarged
                    ? { label: 'Discharged', bg: '#E2E8F0', color: '#475569' }
                    : progress >= 70 ? { label: 'Stable', bg: '#DCFCE7', color: '#166534' } : progress >= 40 ? { label: 'Recovering', bg: '#FEF3C7', color: '#92400E' } : { label: 'Needs Attention', bg: '#FEE2E2', color: '#991B1B' };
                  return (
                    <button key={p.id} type="button" className="patient-card-btn" onClick={() => setSelectedPatient(p)}
                      style={{ border: `2px solid ${isActive ? '#F54E25' : '#E9EDF7'}`, borderRadius: 20, background: isActive ? '#FFFBFA' : '#fff', padding: '18px 20px', textAlign: 'left', cursor: 'pointer', boxShadow: isActive ? '0 8px 24px rgba(245,78,37,0.14)' : '0 4px 14px rgba(15,23,42,0.04)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 14, background: isActive ? 'linear-gradient(135deg,#F54E25,#EA580C)' : 'linear-gradient(135deg,#EEF2FF,#C7D2FE)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 16, fontWeight: 900, color: isActive ? '#fff' : '#4338CA' }}>{patientInitials(p.name)}</span>
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.01em' }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Age {p.age} · Admitted {p.date || 'N/A'}{isDischarged ? ` · Discharged ${formatDate(p.discharged_at)}` : ''}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <ProgressBar value={progress} color={isActive ? '#F54E25' : '#6366F1'} />
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#0F172A', flexShrink: 0 }}>{progress}%</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, background: statusCfg.bg, color: statusCfg.color, padding: '3px 9px', borderRadius: 999 }}>{statusCfg.label}</span>
                        <span style={{ fontSize: 10, fontWeight: 800, background: reportCount > 0 ? '#EEF2FF' : '#F1F5F9', color: reportCount > 0 ? '#3730A3' : '#94A3B8', padding: '3px 9px', borderRadius: 999 }}>
                          {reportCount} report{reportCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        </div>

        {/* Mobile Bottom Nav (unchanged) */}
        <nav className="mobile-bottom-nav" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, height: 70, background: '#fff', borderTop: '1px solid #EAEFFB', justifyContent: 'space-around', alignItems: 'center', zIndex: 1000 }}>
          <Home size={22} color="#CBD5E1" onClick={() => navigate('/home')} style={{ cursor: 'pointer' }} />
          <TrendingUp size={22} color="#CBD5E1" onClick={() => navigate('/progress')} style={{ cursor: 'pointer' }} />
          <Calendar size={22} color="#CBD5E1" onClick={() => navigate('/appointments')} style={{ cursor: 'pointer' }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' }} onClick={() => navigate('/reports')}>
            <BarChart3 size={22} color="#F54E25" /><span style={{ fontSize: 9, fontWeight: 800, color: '#F54E25' }}>Reports</span>
          </div>
          <User size={22} color="#CBD5E1" onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }} />
        </nav>
      </main>

      {/* ══════════════════════════════════
          REPORT MODAL (functionality 100% unchanged, design improved)
      ══════════════════════════════════ */}
      {selectedPatient && (
        <div onClick={() => setSelectedPatient(null)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(12px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, padding: 16, boxSizing: 'border-box' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(960px,100%)', maxHeight: 'min(90vh,920px)', background: '#fff', borderRadius: 28, overflow: 'hidden', boxShadow: '0 32px 80px rgba(15,23,42,0.28)', display: 'flex', flexDirection: 'column' }}>

            {/* Modal Header */}
            <div style={{ background: 'linear-gradient(135deg,#0F172A,#1E2D4F)', padding: '22px 26px', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: -30, right: -30, width: 130, height: 130, borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.25),transparent 70%)' }} />
              <div style={{ position: 'absolute', bottom: -20, left: '40%', width: 90, height: 90, borderRadius: '50%', background: 'radial-gradient(circle,rgba(245,78,37,0.18),transparent 70%)' }} />
              <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Care Updates · Bridges of Hope</div>
                  <div style={{ fontSize: 20, color: '#fff', fontWeight: 900, letterSpacing: '-0.02em' }}>
                    <span style={{ color: '#FDA4AF' }}>{selectedWeek === 'all' ? 'Full Report History' : `Week ${selectedWeek}`}</span> — {selectedPatient.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                    {visibleReports.length} report{visibleReports.length !== 1 ? 's' : ''} · Progress: {Number(selectedPatient.progress)||0}%
                    {selectedPatient.discharged_at ? (
                      <span style={{ display: 'block', marginTop: 6, color: 'rgba(253,164,175,0.95)', fontWeight: 700 }}>
                        Discharged {formatDate(selectedPatient.discharged_at)}
                      </span>
                    ) : null}
                  </div>
                  {/* Progress in header */}
                  <div style={{ marginTop: 14, height: 5, background: 'rgba(255,255,255,0.12)', borderRadius: 999, overflow: 'hidden', maxWidth: 400 }}>
                    <div style={{ width: `${Number(selectedPatient.progress)||0}%`, height: '100%', background: 'linear-gradient(90deg,#6EE7B7,#34D399)', borderRadius: 999 }} />
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedPatient(null)} style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'grid', gridTemplateColumns: '260px minmax(0,1fr)', background: '#F8FAFF' }}>

              {/* Left: Report History */}
              <div style={{ borderRight: '1px solid #E9EDF7', padding: '16px 14px', overflowY: 'auto', background: '#fff' }}>
                <SectionLabel>Report History</SectionLabel>
                {!visibleReports.length ? (
                  <div style={{ color: '#94A3B8', fontSize: 12, fontWeight: 600, padding: '12px 0' }}>No reports for this filter.</div>
                ) : visibleReports.map((row) => {
                  const isActive = weeklyReport && String(weeklyReport.id) === String(row.id);
                  return (
                    <button key={row.id || `${row.patient_id}-${row.week_number}-${row.created_at}`} type="button" className="history-btn-item"
                      onClick={() => setSelectedReportId(String(row.id))}
                      style={{ width: '100%', border: `1.5px solid ${isActive ? '#F54E25' : '#E9EDF7'}`, borderRadius: 14, background: isActive ? '#FFFBFA' : '#fff', padding: '12px 14px', textAlign: 'left', marginBottom: 8, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 900, color: isActive ? '#F54E25' : '#0F172A' }}>Week {row.week_number || '-'}</span>
                        {isActive && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F54E25' }} />}
                      </div>
                      <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>{formatDate(row.submitted_at || row.created_at)}</div>
                      {row.progress_percent != null && (
                        <div style={{ marginTop: 8 }}>
                          <ProgressBar value={row.progress_percent} color={isActive ? '#F54E25' : '#6366F1'} height={4} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Right: Report Detail */}
              <div style={{ overflowY: 'auto', padding: '20px 22px' }}>
                {!weeklyReport ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94A3B8', gap: 12 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 18, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={24} color="#CBD5E1" /></div>
                    <p style={{ margin: 0, fontWeight: 700, color: '#64748B', fontSize: 14 }}>No report selected</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#94A3B8' }}>Choose a week from the left panel</p>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Week {weeklyReport.week_number || '-'} · {formatDate(weeklyReport.submitted_at || weeklyReport.created_at)}</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em' }}>{selectedPatient.name}</div>
                      {weeklyReport.progress_percent != null && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                          <ProgressBar value={weeklyReport.progress_percent} color="#F54E25" />
                          <span style={{ fontSize: 12, fontWeight: 900, color: '#F54E25', flexShrink: 0 }}>{weeklyReport.progress_percent}%</span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <ReportFieldRow icon={BookOpen} label="Summary" value={weeklyReport?.summary || weeklyReport?.report_summary || 'No report available.'} />
                      <ReportFieldRow icon={Activity} label="Progress" value={weeklyReport?.progress_percent != null ? `${weeklyReport.progress_percent}%` : 'N/A'} />
                      <ReportFieldRow icon={FileText} label="Nurse Notes" value={weeklyReport?.nurse_note || weeklyReport?.notes || 'No notes available.'} />
                      <ReportFieldRow icon={Heart} label="Behavior / Mood" value={weeklyReport?.behavior_observation || weeklyReport?.mood_assessment || 'No behavior notes.'} />
                      <ReportFieldRow icon={CheckCircle2} label="Recommendations" value={weeklyReport?.recommendations || weeklyReport?.plan_next_week || 'No recommendations.'} />
                      <ReportFieldRow icon={Calendar} label="Submitted" value={formatDate(weeklyReport?.submitted_at || weeklyReport?.created_at)} />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <FloatingChatHead />
    </div>
  );
}