import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users, FileText, LogOut,
  Calendar as CalendarIcon, ArrowLeft, ArrowRight,
  Plus, X, ClipboardList, AlertCircle, Stethoscope, Clock,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logo from '@/assets/kalingalogo.png';
import { ProgramSidebar, ProgramMobileBottomNav } from '@/components/program/ProgramSidebar';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  getAgendasForDay,
  upsertAgenda,
  removeAgenda,
  getDeadlinesForNurse,
  hydrateNurseAgendasFromSupabase,
  saveAgendaToCloud,
} from '@/lib/nurseCalendarStorage';

/*  unchanged pure helpers  */
function toName(v) { return String(v||'').trim().toLowerCase(); }
function getCandidateNames(user, profileName) {
  const emailLocal = String(user?.email||'').split('@')[0].replace(/[._-]+/g,' ').trim();
  return Array.from(new Set([profileName, user?.user_metadata?.full_name, user?.user_metadata?.name, emailLocal].map(x => String(x||'').trim()).filter(Boolean)));
}
function pad2(n) { return String(n).padStart(2,'0'); }
function toIsoDate(y, m0, d) { return `${y}-${pad2(m0+1)}-${pad2(d)}`; }
function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}


/*  design-only components  */
function AgendaChip({ type }) {
  const cfg = type === 'resident'
    ? { label:'R', bg:'#ECFDF5', color:'#047857', border:'#A7F3D0' }
    : { label:'P', bg:'#EEF2FF', color:'#4338CA', border:'#C7D2FE' };
  return (
    <span style={{ fontSize:8, fontWeight:900, padding:'2px 6px', borderRadius:6, background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}`, lineHeight:1 }}>{cfg.label}</span>
  );
}

function DeadlineChip() {
  return <span style={{ fontSize:8, fontWeight:900, padding:'2px 6px', borderRadius:6, background:'#FFF1F2', color:'#BE123C', border:'1px solid #FECDD3', lineHeight:1 }}>Due</span>;
}

function SectionTitle({ icon: Icon, children, color = '#F54E25' }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
      <div style={{ width:28, height:28, borderRadius:8, background:'#FFF1EB', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <Icon size={13} color={color} />
      </div>
      <span style={{ fontSize:13, fontWeight:900, color:'#0F172A', letterSpacing:'-0.01em' }}>{children}</span>
    </div>
  );
}

/* 
   MAIN PAGE
 */
/** Calendar for program staff - same features as nurse calendar; residents scoped by case load manager. */
export default function ProgramCalendarPage() {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [userId, setUserId] = useState('');
  const [assigned, setAssigned] = useState([]);
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayPopover, setDayPopover] = useState(null);
  const [expandedAgendaId, setExpandedAgendaId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addDate, setAddDate] = useState(null);
  const [addKind, setAddKind] = useState(null);
  const [addPatientId, setAddPatientId] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [tick, setTick] = useState(0);
  const [saveError, setSaveError] = useState('');

  const refresh = useCallback(() => setTick(t => t+1), []);

  /*  all data effects UNCHANGED  */
  useEffect(() => {
    const onUpd = () => refresh();
    window.addEventListener('bh-nurse-calendar-update', onUpd);
    return () => window.removeEventListener('bh-nurse-calendar-update', onUpd);
  }, [refresh]);

  useEffect(() => {
    const load = async () => {
      if (!isSupabaseConfigured()) { setAssigned([]); setUserId('local-user'); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setUserId(''); setAssigned([]); return; }
      setUserId(user.id);
      const [{ data: profile }, { data: patients }] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
        supabase.from('patients').select('*').is('discharged_at', null).order('admitted_at', { ascending: false }),
      ]);
      const names = getCandidateNames(user, profile?.full_name).map(toName);
      setAssigned((patients||[]).filter(p => names.includes(toName(p.case_load_manager))));
    };
    void load();
  }, []);

  useEffect(() => {
    if (!userId || userId === 'local-user') return;
    let cancelled = false;
    (async () => {
      const r = await hydrateNurseAgendasFromSupabase(userId);
      if (!cancelled && r.ok && !r.skipped) refresh();
    })();
    return () => { cancelled = true; };
  }, [userId, refresh]);

  const year = cursor.getFullYear(), month0 = cursor.getMonth();
  const monthLabel = cursor.toLocaleDateString('en-US', { month:'long', year:'numeric' });

  const calendarCells = useMemo(() => {
    const firstDow = new Date(year, month0, 1).getDay();
    const daysInMonth = new Date(year, month0+1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push({ type:'empty', key:`e-${i}` });
    for (let d = 1; d <= daysInMonth; d++) { const iso = toIsoDate(year, month0, d); cells.push({ type:'day', d, iso, key:iso }); }
    while (cells.length%7 !== 0) cells.push({ type:'empty', key:`t-${cells.length}` });
    return cells;
  }, [year, month0]);

  const deadlines = useMemo(() => { if (!userId) return []; return getDeadlinesForNurse(userId); }, [userId, tick]);
  const deadlinesByDate = useMemo(() => { const m = new Map(); deadlines.forEach(e => { const k = String(e.date).slice(0,10); if (!m.has(k)) m.set(k,[]); m.get(k).push(e); }); return m; }, [deadlines]);
  const agendasForSelectedPopover = useMemo(() => { if (!dayPopover || !userId) return []; return getAgendasForDay(userId, dayPopover); }, [dayPopover, userId, tick]);
  const monthPrefix = `${year}-${pad2(month0+1)}`;
  const monthStats = useMemo(() => {
    const daysInMonth = new Date(year, month0+1, 0).getDate();
    let agendaCount = 0;
    for (let d = 1; d <= daysInMonth; d++) agendaCount += userId ? getAgendasForDay(userId, toIsoDate(year, month0, d)).length : 0;
    const dlCount = deadlines.filter(e => String(e.date).slice(0,7) === monthPrefix).length;
    return { agendaCount, dlCount };
  }, [year, month0, userId, deadlines, monthPrefix, tick]);

  const upcomingDeadlines = useMemo(() => {
    const t = new Date(); t.setHours(0,0,0,0);
    return [...deadlines].filter(e => { const d = new Date(String(e.date).slice(0,10)+'T12:00:00'); return !Number.isNaN(d.getTime()) && d >= t; }).sort((a,b) => String(a.date).localeCompare(String(b.date))).slice(0,10);
  }, [deadlines]);

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });

  const openDay = (iso) => { setDayPopover(iso); setSelectedDay(iso); setExpandedAgendaId(null); };
  const openAddAgenda = (dateIso = null) => {
    setAddDate(dateIso || selectedDay || toIsoDate(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
    setAddOpen(true); setAddKind(null); setAddPatientId(''); setAddDescription('');
  };
  const submitAdd = async () => {
    setSaveError('');
    if (!userId || !addDate || !addKind) {
      setSaveError(!userId ? 'Still loading your account - wait a moment and try again.' : 'Choose a type and date.');
      return;
    }
    const desc = addDescription.trim();
    if (!desc) {
      setSaveError('Please enter a description.');
      return;
    }
    const base = { id: newId(), type: addKind, description: desc, createdAt: new Date().toISOString() };
    if (addKind === 'resident') {
      const p = assigned.find((x) => String(x.id) === String(addPatientId));
      if (!p) {
        setSaveError('Select a resident.');
        return;
      }
      base.patientId = String(p.id);
      base.patientName = String(p.full_name || 'Resident');
    }
    upsertAgenda(userId, addDate, base);
    const cloud = await saveAgendaToCloud(userId, addDate, base);
    if (!cloud.ok && !cloud.skipped) {
      setSaveError('Saved on this device only. Check your connection or try again - cloud sync failed.');
      refresh();
      return;
    }
    setAddOpen(false);
    setAddKind(null);
    setAddPatientId('');
    setAddDescription('');
    setDayPopover(addDate);
    refresh();
  };

  const legendPills = (
    <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
      {[
        { label:'Personal', color:'#6366F1', bg:'#EEF2FF' },
        { label:'Resident', color:'#10B981', bg:'#ECFDF5' },
        { label:'Deadline', color:'#F43F5E', bg:'#FFF1F2' },
      ].map(x => (
        <span key={x.label} style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.7)', padding:'5px 10px', borderRadius:999, background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)' }}>
          <span style={{ width:6, height:6, borderRadius:999, background:x.color }} /> {x.label}
        </span>
      ))}
    </div>
  );

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#F0F4FF', fontFamily:"'DM Sans','Segoe UI',sans-serif", overflowX:'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        button { font-family: inherit; }

        .nurse-cal-split { display: grid; grid-template-columns: minmax(0,1fr) minmax(200px,256px); gap: 20px; align-items: start; }
        .nurse-cal-split-main { min-width: 0; }
        .nurse-cal-split-aside { min-width: 0; width: 100%; }
        @media (max-width: 1100px) { .nurse-cal-split { grid-template-columns: 1fr; } .nurse-cal-split-aside { max-width: none; position: static; } }

        .nurse-cal-day-cell { min-height: 90px; }
        @media (max-width: 768px) { .nurse-cal-day-cell { min-height: 64px; } }
        button.nurse-cal-day-cell { -webkit-tap-highlight-color: transparent; }
        button.nurse-cal-day-cell:hover { box-shadow: 0 8px 24px rgba(15,23,42,0.10) !important; transform: translateY(-2px); }
        button.nurse-cal-day-cell:active { transform: translateY(0); }

        .cal-day-hint { font-size: 9px; font-weight: 600; color: #94a3b8; margin-top: auto; opacity: 0; transition: opacity .18s; }
        button.nurse-cal-day-cell:hover .cal-day-hint { opacity: 1; }
        @media (hover: none) { .cal-day-hint { opacity: .5; } }

        .agenda-item { transition: border-color .12s, background .12s; }
        .agenda-item:hover { border-color: #FECDD3 !important; }

        .scroll-area::-webkit-scrollbar { width: 4px; }
        .scroll-area::-webkit-scrollbar-track { background: transparent; }
        .scroll-area::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 999px; }

        .form-input { border: 1.5px solid #E9EDF7; border-radius: 12px; padding: 10px 14px; font-size: 13px; font-family: inherit; color: #0F172A; font-weight: 600; outline: none; width: 100%; transition: border-color .15s, box-shadow .15s; }
        .form-input:focus { border-color: #F54E25; box-shadow: 0 0 0 3px rgba(245,78,37,0.12); }

        .kind-btn { padding: 16px 18px; border-radius: 16px; border: 2px solid transparent; cursor: pointer; text-align: left; transition: border-color .15s, transform .1s; }
        .kind-btn:hover { transform: translateY(-1px); }
      `}</style>

      {/*  SIDEBAR (100% unchanged)  */}
      <ProgramSidebar isExpanded={isExpanded} setIsExpanded={setIsExpanded} navigate={navigate} active="calendar" />

      <main style={{ flex:1, marginLeft:isExpanded?280:110, padding:'24px 28px 48px', transition:'margin-left .3s', background:'#F0F4FF', minHeight:'100vh', display:'flex', flexDirection:'column', boxSizing:'border-box' }}>

        {/*  HERO BANNER (matches nurse dashboard style, all content unchanged)  */}
        <div style={{ background:'linear-gradient(135deg,#1E293B 0%,#1D2D50 60%,#312e81 100%)', borderRadius:22, padding:'24px 28px', marginBottom:20, boxShadow:'0 10px 40px rgba(15,23,42,0.18)', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:-30, right:-30, width:140, height:140, borderRadius:'50%', background:'rgba(255,255,255,0.04)' }} />
          <div style={{ position:'absolute', bottom:-20, right:80, width:90, height:90, borderRadius:'50%', background:'rgba(255,255,255,0.05)' }} />
          <div style={{ position:'relative', display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
            <div style={{ flex:'1 1 280px', minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:'rgba(255,255,255,0.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <CalendarIcon size={18} color="#fff" />
                </div>
                <span style={{ fontSize:11, color:'rgba(255,255,255,0.5)', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase' }}>Schedule</span>
              </div>
              <h1 style={{ margin:0, color:'#fff', fontSize:26, fontWeight:900, letterSpacing:'-0.02em' }}>Calendar</h1>
              <p style={{ color:'rgba(255,255,255,0.55)', margin:'8px 0 0', fontSize:13, lineHeight:1.45, maxWidth:520 }}>
                Your month at a glance - personal and resident agendas for your assigned case load, plus report deadlines from admin.
              </p>
              <div style={{ marginTop:14 }}>{legendPills}</div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:12 }}>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:26, fontWeight:900, color:'#fff', letterSpacing:'-0.02em', display:'flex', alignItems:'center', justifyContent:'flex-end', gap:8 }}>
                  <Clock size={22} color="rgba(255,255,255,0.85)" /> {timeStr}
                </div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.45)', marginTop:4 }}>{dateStr}</div>
              </div>
              <button type="button" onClick={() => openAddAgenda()}
                style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'12px 20px', borderRadius:14, border:'none', background:'linear-gradient(135deg,#F54E25,#EA580C)', color:'#fff', fontWeight:800, fontSize:13, cursor:'pointer', boxShadow:'0 4px 20px rgba(245,78,37,0.45)' }}>
                <Plus size={18} /> Add agenda
              </button>
            </div>
          </div>
          <div style={{ marginTop:20, display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
            {[
              { label:'Agendas this month',   value:monthStats.agendaCount, color:'#A5B4FC' },
              { label:'Deadlines this month', value:monthStats.dlCount,     color:'#FCA5A5' },
              { label:'Assigned residents',   value:assigned.length,         color:'#6EE7B7' },
            ].map(s => (
              <div key={s.label} style={{ background:'rgba(255,255,255,0.08)', borderRadius:14, padding:'12px 16px', backdropFilter:'blur(6px)', border:'1px solid rgba(255,255,255,0.10)' }}>
                <p style={{ margin:0, fontSize:10, color:'rgba(255,255,255,0.45)', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase' }}>{s.label}</p>
                <p style={{ margin:'4px 0 0', fontSize:26, fontWeight:900, color:s.color, lineHeight:1 }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/*  CALENDAR CARD  */}
        <div style={{ background:'#fff', border:'1px solid #E9EDF7', borderRadius:22, padding:'22px 24px', boxShadow:'0 4px 20px rgba(15,23,42,0.06)', flex:'0 0 auto' }}>
          {/* Month nav */}
          <div style={{ display:'grid', gridTemplateColumns:'auto 1fr auto', alignItems:'center', gap:12, marginBottom:22 }}>
            <button type="button" aria-label="Previous month" onClick={() => setCursor(new Date(year, month0-1, 1))}
              style={{ border:'1px solid #E2E8F0', background:'#fff', borderRadius:12, width:44, height:44, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 1px 3px rgba(15,23,42,0.06)', flexShrink:0, overflow:'visible' }}>
              <span style={{ display:'flex', lineHeight:0 }} aria-hidden>
                <ArrowLeft size={24} strokeWidth={2.5} color="#1e293b" />
              </span>
            </button>
            <span style={{ fontSize:22, fontWeight:900, color:'#0F172A', letterSpacing:'-0.03em', textAlign:'center' }}>{monthLabel}</span>
            <button type="button" aria-label="Next month" onClick={() => setCursor(new Date(year, month0+1, 1))}
              style={{ border:'1px solid #E2E8F0', background:'#fff', borderRadius:12, width:44, height:44, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 1px 3px rgba(15,23,42,0.06)', flexShrink:0, overflow:'visible' }}>
              <span style={{ display:'flex', lineHeight:0 }} aria-hidden>
                <ArrowRight size={24} strokeWidth={2.5} color="#1e293b" />
              </span>
            </button>
          </div>

          <div className="nurse-cal-split">
            {/*  MAIN GRID  */}
            <div className="nurse-cal-split-main">
              {/* Weekday header */}
              <div style={{ background:'linear-gradient(135deg,#EEF2FF,#E0E7FF)', borderRadius:14, border:'1px solid #C7D2FE', padding:'10px 8px', marginBottom:10 }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7,minmax(0,1fr))', gap:6, fontSize:10, fontWeight:800, color:'#4338CA', textTransform:'uppercase', letterSpacing:'0.08em' }}>
                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                    <div key={d} style={{ textAlign:'center', padding:'6px 2px' }}>{d}</div>
                  ))}
                </div>
              </div>

              {/* Day cells */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,minmax(0,1fr))', gap:8 }}>
                {calendarCells.map(cell => {
                  if (cell.type === 'empty') return <div key={cell.key} className="nurse-cal-day-cell" />;
                  const iso = cell.iso;
                  const agendas = userId ? getAgendasForDay(userId, iso) : [];
                  const dl = deadlinesByDate.get(iso) || [];
                  const hasP = agendas.some(a => a.type === 'personal');
                  const hasR = agendas.some(a => a.type === 'resident');
                  const isSel = selectedDay === iso;
                  const todayRef = new Date();
                  const isToday = todayRef.getFullYear() === year && todayRef.getMonth() === month0 && todayRef.getDate() === cell.d;
                  const previews = agendas.slice(0, 2);
                  const emptyDay = !agendas.length && !dl.length;
                  return (
                    <button key={cell.key} type="button" onClick={() => openDay(iso)} title={`${iso} - open day`}
                      className="nurse-cal-day-cell"
                      style={{
                        borderRadius:14,
                        border: isSel ? '2px solid #F54E25' : isToday ? '2px solid #6366F1' : '1px solid #E9EDF7',
                        background: isSel ? 'linear-gradient(135deg,#FFF7ED,#FFEDD5)' : isToday ? 'linear-gradient(135deg,#EEF2FF,#FAFBFF)' : '#FFFFFF',
                        cursor:'pointer', padding:'8px 8px 6px',
                        display:'flex', flexDirection:'column', alignItems:'stretch', gap:6,
                        position:'relative', textAlign:'left',
                        boxShadow: isSel ? '0 4px 16px rgba(245,78,37,0.15)' : isToday ? '0 4px 16px rgba(99,102,241,0.12)' : '0 1px 4px rgba(15,23,42,0.04)',
                        transition:'border-color .15s, box-shadow .15s, transform .15s',
                      }}>
                      {/* Day number + today badge */}
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:4 }}>
                        <span style={{ fontSize:15, fontWeight:900, color:isToday?'#4338CA':'#0F172A', lineHeight:1 }}>{cell.d}</span>
                        {isToday && (
                          <span style={{ fontSize:8, fontWeight:800, color:'#4338CA', background:'#E0E7FF', padding:'2px 6px', borderRadius:6, textTransform:'uppercase', letterSpacing:'0.06em', border:'1px solid #C7D2FE' }}>Today</span>
                        )}
                      </div>
                      {/* Type chips */}
                      {(hasP || hasR || dl.length > 0) && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                          {hasP && <AgendaChip type="personal" />}
                          {hasR && <AgendaChip type="resident" />}
                          {dl.length > 0 && <DeadlineChip />}
                        </div>
                      )}
                      {/* Preview items */}
                      {previews.length > 0 && (
                        <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', gap:4 }}>
                          {previews.map(a => (
                            <div key={a.id} style={{ fontSize:9, fontWeight:600, color:'#475569', lineHeight:1.3, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', padding:'4px 7px', borderRadius:8, background:a.type==='resident'?'#ECFDF5':'#EEF2FF', border:`1px solid ${a.type==='resident'?'#A7F3D0':'#C7D2FE'}` }}>
                              <span style={{ color:a.type==='resident'?'#059669':'#4F46E5', fontWeight:800 }}>{a.type==='resident'?'R · ':'P · '}</span>
                              {a.description}
                            </div>
                          ))}
                        </div>
                      )}
                      {emptyDay && <span className="cal-day-hint">Tap to add</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/*  DEADLINES SIDEBAR  */}
            <aside className="nurse-cal-split-aside" style={{ background:'#fff', border:'1px solid #E9EDF7', borderRadius:18, overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 4px 20px rgba(15,23,42,0.06)', position:'sticky', top:24, alignSelf:'start', maxHeight:'min(420px,55vh)' }}>
              <div style={{ height:4, flexShrink:0, background:'linear-gradient(90deg,#F54E25,#EA580C)', borderRadius:'18px 18px 0 0' }} />
              <div style={{ padding:'16px 18px 12px', flexShrink:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:36, height:36, borderRadius:12, background:'linear-gradient(135deg,#EEF2FF,#E0E7FF)', border:'1px solid #C7D2FE', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <AlertCircle size={17} color="#F54E25" />
                  </div>
                  <div style={{ minWidth:0 }}>
                    <h2 style={{ margin:0, fontSize:13, fontWeight:900, color:'#0F172A', letterSpacing:'-0.01em' }}>Upcoming Deadlines</h2>
                    <p style={{ margin:'2px 0 0', fontSize:10, color:'#94A3B8' }}>Report due dates from admin</p>
                  </div>
                </div>
              </div>
              <div style={{ padding:'0 18px 16px', overflowY:'auto', flex:1, minHeight:0 }}>
                {upcomingDeadlines.length === 0 ? (
                  <div style={{ padding:'18px 14px', borderRadius:16, background:'#F8FAFF', border:'1px dashed #C7D2FE', textAlign:'center' }}>
                    <FileText size={20} color="#94A3B8" style={{ marginBottom:6, opacity:0.8 }} />
                    <p style={{ margin:0, fontSize:12, fontWeight:700, color:'#64748B' }}>No deadlines ahead</p>
                    <p style={{ margin:'4px 0 0', fontSize:10, color:'#94A3B8', lineHeight:1.4 }}>Admin can add due dates from the dashboard.</p>
                  </div>
                ) : (
                  <ul style={{ margin:0, padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:8 }}>
                    {upcomingDeadlines.map(e => (
                      <li key={e.id} style={{ borderRadius:14, padding:'10px 12px', background:'#fff', border:'1px solid #E9EDF7', boxShadow:'0 1px 4px rgba(15,23,42,0.04)' }}>
                        <div style={{ fontSize:10, fontWeight:800, color:'#F54E25', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:4 }}>{String(e.date).slice(0,10)}</div>
                        <div style={{ fontSize:12, fontWeight:800, color:'#0F172A', lineHeight:1.3 }}>{e.title || 'Report submission due'}</div>
                        {e.note && <div style={{ fontSize:11, color:'#64748B', marginTop:5, lineHeight:1.4 }}>{e.note}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </aside>
          </div>
        </div>

        {/* 
            DAY POPOVER MODAL (improved design, unchanged logic)
         */}
        {dayPopover && (
          <div role="dialog" aria-label="Day agendas" style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', backdropFilter:'blur(10px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={() => setDayPopover(null)}>
            <div onClick={e => e.stopPropagation()} style={{ width:'min(480px,100%)', maxHeight:'min(82vh,600px)', overflow:'auto', background:'#fff', borderRadius:24, boxShadow:'0 28px 70px rgba(15,23,42,0.22)', border:'1px solid #E9EDF7', display:'flex', flexDirection:'column' }}>
              {/* Header */}
              <div style={{ background:'linear-gradient(135deg,#1E293B,#1D2D50)', padding:'18px 22px', borderRadius:'24px 24px 0 0', position:'relative', overflow:'hidden', flexShrink:0 }}>
                <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80, borderRadius:'50%', background:'radial-gradient(circle,rgba(99,102,241,0.2),transparent 70%)' }} />
                <div style={{ position:'relative', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                  <div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>Agenda for</div>
                    <div style={{ fontSize:17, fontWeight:900, color:'#fff', letterSpacing:'-0.01em' }}>
                      {new Date(dayPopover+'T12:00:00').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                    <button type="button" onClick={() => openAddAgenda(dayPopover)}
                      style={{ border:'none', background:'rgba(255,255,255,0.12)', color:'#fff', borderRadius:12, padding:'8px 14px', fontWeight:800, fontSize:12, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6 }}>
                      <Plus size={15} /> Add
                    </button>
                    <button type="button" onClick={() => setDayPopover(null)}
                      style={{ border:'none', background:'rgba(255,255,255,0.1)', padding:8, borderRadius:10, cursor:'pointer', color:'rgba(255,255,255,0.6)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <X size={17} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div style={{ padding:'18px 20px', flex:1, overflowY:'auto', background:'#F8FAFF' }}>
                {/* Deadlines */}
                {(deadlinesByDate.get(dayPopover)||[]).length > 0 && (
                  <div style={{ marginBottom:16 }}>
                    <div style={{ fontSize:12, fontWeight:800, color:'#B91C1C', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                      <AlertCircle size={13} /> Report Deadlines
                    </div>
                    {(deadlinesByDate.get(dayPopover)||[]).map(e => (
                      <div key={e.id} style={{ background:'#FFF1F2', border:'1px solid #FECDD3', borderRadius:14, padding:'12px 14px', marginBottom:8, fontSize:13, color:'#9F1239', fontWeight:700 }}>
                        {e.title || 'Report submission due'}
                        {e.note && <div style={{ fontSize:12, color:'#881337', marginTop:5, fontWeight:500 }}>{e.note}</div>}
                      </div>
                    ))}
                  </div>
                )}
                {agendasForSelectedPopover.length === 0 && !(deadlinesByDate.get(dayPopover)||[]).length && (
                  <div style={{ textAlign:'center', padding:'28px 0', color:'#94A3B8' }}>
                    <CalendarIcon size={28} color="#CBD5E1" style={{ marginBottom:8, opacity:0.8 }} />
                    <p style={{ margin:0, fontSize:13, fontWeight:700 }}>No agendas for this day</p>
                    <p style={{ margin:'5px 0 0', fontSize:12 }}>Tap "Add" to create one</p>
                  </div>
                )}
                {agendasForSelectedPopover.map(a => {
                  const exp = expandedAgendaId === a.id;
                  const isResident = a.type === 'resident';
                  return (
                    <div key={a.id} className="agenda-item" style={{ border:'1px solid #E9EDF7', borderRadius:16, marginBottom:10, background:'#fff', overflow:'hidden', boxShadow:'0 2px 8px rgba(15,23,42,0.04)' }}>
                      <button type="button" onClick={() => setExpandedAgendaId(exp ? null : a.id)}
                        style={{ width:'100%', border:'none', background:'transparent', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, cursor:'pointer', textAlign:'left', padding:'13px 16px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                          <div style={{ width:32, height:32, borderRadius:10, background:isResident?'#ECFDF5':'#EEF2FF', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:`1px solid ${isResident?'#A7F3D0':'#C7D2FE'}` }}>
                            {isResident ? <Stethoscope size={15} color="#10B981" /> : <ClipboardList size={15} color="#6366F1" />}
                          </div>
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:'#94A3B8', marginBottom:2 }}>
                              {isResident ? `Resident · ${a.patientName || 'Patient'}` : 'Personal'}
                            </div>
                            <div style={{ fontSize:13, color:'#0F172A', fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:exp?'normal':'nowrap' }}>{a.description}</div>
                          </div>
                        </div>
                        <span style={{ fontSize:11, color:'#6366F1', fontWeight:700, flexShrink:0 }}>{exp?'Less':'Details'}</span>
                      </button>
                      {exp && (
                        <div style={{ padding:'0 16px 14px', borderTop:'1px solid #F1F5F9' }}>
                          <p style={{ margin:'12px 0 8px', fontSize:12, color:'#64748B', lineHeight:1.55 }}>{a.description}</p>
                          {a.createdAt && <div style={{ fontSize:11, color:'#94A3B8', marginBottom:10 }}>Added {new Date(a.createdAt).toLocaleString()}</div>}
                          <button type="button" onClick={() => { if (userId) removeAgenda(userId, dayPopover, a.id); refresh(); }}
                            style={{ display:'inline-flex', alignItems:'center', gap:6, border:'1px solid #FECACA', background:'#FEF2F2', color:'#B91C1C', borderRadius:10, padding:'6px 12px', fontWeight:700, fontSize:12, cursor:'pointer' }}>
                            <Trash2 size={13} /> Remove
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 
            ADD AGENDA MODAL (improved design, unchanged logic)
         */}
        {addOpen && (
          <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.55)', backdropFilter:'blur(10px)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={() => { setAddOpen(false); setSaveError(''); }}>
            <div onClick={e => e.stopPropagation()} style={{ width:'min(500px,100%)', background:'#fff', borderRadius:24, boxShadow:'0 28px 70px rgba(15,23,42,0.25)', overflow:'hidden' }}>
              {/* Modal Header */}
              <div style={{ background:'linear-gradient(135deg,#1E293B,#1D2D50)', padding:'20px 24px', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:-20, right:-20, width:90, height:90, borderRadius:'50%', background:'radial-gradient(circle,rgba(245,78,37,0.2),transparent 70%)' }} />
                <div style={{ position:'relative', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                  <div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:5 }}>New Entry</div>
                    <div style={{ fontSize:18, fontWeight:900, color:'#fff', letterSpacing:'-0.02em' }}>Add Agenda</div>
                    <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginTop:4 }}>
                      {addDate ? new Date(addDate+'T12:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '-'}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => { setAddOpen(false); setSaveError(''); }}
                    style={{
                      width:40,
                      height:40,
                      flexShrink:0,
                      padding:0,
                      border:'1px solid rgba(255,255,255,0.12)',
                      borderRadius:12,
                      background:'linear-gradient(180deg,#334155 0%,#1e293b 100%)',
                      boxShadow:'inset 0 1px 0 rgba(255,255,255,0.08), 0 1px 2px rgba(0,0,0,0.2)',
                      color:'#fff',
                      display:'flex',
                      alignItems:'center',
                      justifyContent:'center',
                      cursor:'pointer',
                    }}>
                    <X size={18} strokeWidth={2.25} aria-hidden />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div style={{ padding:'22px 24px 24px' }}>
                {!addKind ? (
                  <div style={{ display:'grid', gap:12 }}>
                    <p style={{ margin:'0 0 4px', fontSize:13, fontWeight:700, color:'#64748B' }}>What type of agenda?</p>
                    <button type="button" className="kind-btn" onClick={() => setAddKind('personal')}
                      style={{ background:'#EEF2FF', borderColor:'#C7D2FE' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:36, height:36, borderRadius:11, background:'#E0E7FF', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><ClipboardList size={18} color="#6366F1" /></div>
                        <div>
                          <div style={{ fontSize:14, fontWeight:900, color:'#3730A3' }}>Personal</div>
                          <div style={{ fontSize:12, color:'#6366F1', marginTop:2 }}>Your own tasks and reminders within the facility.</div>
                        </div>
                      </div>
                    </button>
                    <button type="button" className="kind-btn" onClick={() => setAddKind('resident')}
                      style={{ background:'#ECFDF5', borderColor:'#A7F3D0' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:36, height:36, borderRadius:11, background:'#D1FAE5', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><Stethoscope size={18} color="#10B981" /></div>
                        <div>
                          <div style={{ fontSize:14, fontWeight:900, color:'#065F46' }}>Resident</div>
                          <div style={{ fontSize:12, color:'#10B981', marginTop:2 }}>Plan or follow-up for a patient assigned to you.</div>
                        </div>
                      </div>
                    </button>
                  </div>
                ) : (
                  <>
                    <button type="button" onClick={() => { setAddKind(null); setAddPatientId(''); }}
                      style={{ border:'none', background:'transparent', color:'#6366F1', fontWeight:800, fontSize:12, cursor:'pointer', marginBottom:16, display:'flex', alignItems:'center', gap:4, padding:0 }}>
                      {'← Change type'}
                    </button>

                    {addKind === 'resident' && (
                      <div style={{ marginBottom:14 }}>
                        <label style={{ fontSize:10, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:6 }}>Patient</label>
                        <select className="form-input" value={addPatientId} onChange={e => setAddPatientId(e.target.value)}>
                          <option value="">Select assigned resident...</option>
                          {assigned.map(p => <option key={p.id} value={p.id}>{p.full_name || 'Resident'}</option>)}
                        </select>
                      </div>
                    )}

                    <div style={{ marginBottom:16 }}>
                      <label style={{ fontSize:10, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:6 }}>Description</label>
                      <textarea className="form-input" value={addDescription} onChange={e => setAddDescription(e.target.value)} rows={4}
                        placeholder={addKind==='resident' ? 'Plan or goal for this resident...' : 'What do you need to do?'}
                        style={{ resize:'vertical' }} />
                    </div>

                    {saveError ? (
                      <div style={{ marginBottom:14, padding:'10px 12px', borderRadius:12, background:'#FEF2F2', border:'1px solid #FECACA', fontSize:12, fontWeight:600, color:'#B91C1C', lineHeight:1.45 }}>
                        {saveError}
                      </div>
                    ) : null}

                    <button type="button" onClick={submitAdd} disabled={addKind==='resident' && !addPatientId}
                      style={{ width:'100%', padding:14, borderRadius:16, border:'none',
                        background: addKind==='resident' && !addPatientId ? '#F1F5F9' : 'linear-gradient(135deg,#F54E25,#EA580C)',
                        color: addKind==='resident' && !addPatientId ? '#94A3B8' : '#fff',
                        fontWeight:900, cursor: addKind==='resident' && !addPatientId ? 'not-allowed' : 'pointer',
                        fontSize:14, boxShadow: addKind==='resident' && !addPatientId ? 'none' : '0 6px 18px rgba(245,78,37,0.3)' }}>
                      Save Agenda
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <ProgramMobileBottomNav navigate={navigate} active="calendar" />
    </div>
  );
}
