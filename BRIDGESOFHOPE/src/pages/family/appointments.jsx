import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Home, LogOut, Calendar, BookUser, ClipboardList, FileText,
  Bell, CheckCircle2, Clock, AlertCircle, ArrowLeft, ArrowRight,
  Info, Shield
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import FamilySidebar from '@/components/family/FamilySidebar';
import FamilyMobileBottomNav from '@/components/family/FamilyMobileBottomNav';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { APP_DATA_REFRESH } from '@/lib/appDataRefresh';
import FloatingChatHead from '@/components/family/FloatingChatHead';
import FamilyPageHeader from '@/components/family/FamilyPageHeader';
import { FAMILY_PAGE_HEADERS } from '@/lib/familyPageHeaders';
import { useFamilyPageScroll } from '@/hooks/useFamilyPageScroll';
import {
  loadVisitationSettings, loadVisitationSettingsShared,
  listVisitationRequestsByFamily,
  createVisitationRequest, replaceVisitationRequests,
  upsertVisitationRequest, normalizeVisitationStatus,
  getConfirmedVisitationMap,
  getPendingVisitationDateSet,
  formatVisitationWeekdayLong,
  formatVisitationWeekdayShort,
  replaceFamilyVisitationFromRemote,
} from '@/lib/visitationAppointments';
import { isPastIsoDate } from '@/lib/bookingDates';

/* ── unchanged pure helpers ── */
function dedupeVisitationRequests(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!r) continue;
    const key = [String(r.familyId||''), String(r.patientId||''), String(r.patientName||'').trim(), String(r.preferredDate||''), String(r.preferredTime||'')].join('|');
    const prev = map.get(key);
    if (!prev) { map.set(key, r); continue; }
    if (new Date(r.updatedAt||r.createdAt||0).getTime() >= new Date(prev.updatedAt||prev.createdAt||0).getTime()) map.set(key, r);
  }
  return Array.from(map.values());
}
function visitationStatusSubtext(row) {
  if (!row) return '';
  const st = normalizeVisitationStatus(row.status);
  const adminReason = String(row.adminNote||'').trim();
  if (st === 'Declined') return 'Declined by the facility';
  if (st === 'Approved' && row.confirmedDate) {
    const day = formatVisitationWeekdayLong(row.confirmedDate);
    return `Confirmed: ${day ? `${day}, ` : ''}${row.confirmedDate} ${row.confirmedTime || ''}`.trim();
  }
  if (st === 'Rescheduled' && row.confirmedDate) {
    const day = formatVisitationWeekdayLong(row.confirmedDate);
    const base = `Rescheduled: ${day ? `${day}, ` : ''}${row.confirmedDate} ${row.confirmedTime || ''}`.trim();
    return adminReason ? `${base} · Reason: ${adminReason}` : base;
  }
  return 'Waiting for admin decision';
}

const STATUS_CFG = {
  Approved:    { bg: '#DCFCE7', color: '#166534', border: '#BBF7D0' },
  Declined:    { bg: '#FEE2E2', color: '#991B1B', border: '#FECACA' },
  Rescheduled: { bg: '#E0E7FF', color: '#3730A3', border: '#C7D2FE' },
  Requested:   { bg: '#FEF3C7', color: '#92400E', border: '#FDE68A' },
};

export default function FamilyAppointmentsPage() {
  const navigate = useNavigate();
  const { scrollToTop } = useFamilyPageScroll();
  const [isExpanded, setIsExpanded] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [patients, setPatients] = useState([]);
  const [familyUserId, setFamilyUserId] = useState('');
  const [familyName, setFamilyName] = useState('Family User');
  const [visitationSettings, setVisitationSettings] = useState(() => loadVisitationSettings());
  const [requests, setRequests] = useState([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ patientId:'', patientName:'', preferredDate:'', preferredTime:'', appointmentReason:'', note:'' });

  const WEEKDAY_TO_INDEX = { sunday:0,sun:0,monday:1,mon:1,tuesday:2,tue:2,tues:2,wednesday:3,wed:3,thursday:4,thu:4,thurs:4,friday:5,fri:5,saturday:6,sat:6 };

  /* ── all data effects UNCHANGED ── */
  useEffect(() => {
    let cancelled = false;
    const loadUserAndPatients = async () => {
      if (!isSupabaseConfigured()) { const lp = JSON.parse(localStorage.getItem('bh_patients')||'[]'); if (!cancelled) { setFamilyUserId('local-family'); setFamilyName('Family User'); setPatients(lp); } return; }
      const { data:{user} } = await supabase.auth.getUser();
      if (!user) return;
      let resolvedName = user.user_metadata?.full_name||[user.user_metadata?.first_name,user.user_metadata?.last_name].filter(Boolean).join(' ')||user.email||'Family User';
      const { data:profileRow } = await supabase.from('profiles').select('full_name').eq('id',user.id).maybeSingle();
      if (profileRow?.full_name) resolvedName = profileRow.full_name;
      const { data } = await supabase.from('patients').select('id,full_name').eq('family_id',user.id).is('discharged_at',null).order('admitted_at',{ascending:false});
      if (!cancelled) { setFamilyUserId(user.id); setFamilyName(resolvedName); setPatients((data||[]).map(r=>({id:r.id,name:r.full_name}))); }
    };
    loadUserAndPatients();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!familyUserId) return;
    const load = async () => {
      const latestSettings = await loadVisitationSettingsShared();
      const base = loadVisitationSettings();
      const latest = latestSettings || {};
      setVisitationSettings({
        days: Array.isArray(latest.days) && latest.days.length ? latest.days : base.days,
        startTime: latest.startTime || base.startTime,
        endTime: latest.endTime || base.endTime,
      });
      const localRows = listVisitationRequestsByFamily(familyUserId);
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.from('visitation_requests').select('*').eq('family_id',familyUserId).order('created_at',{ascending:false});
        if (!error && data != null) {
          const synced = replaceFamilyVisitationFromRemote(familyUserId, data || []);
          const deduped = dedupeVisitationRequests(synced);
          setRequests(deduped);
          return;
        }
      }
      setRequests(dedupeVisitationRequests(localRows.map(r=>({...r,status:normalizeVisitationStatus(r.status)}))));
    };
    void load();
    window.addEventListener('storage',load); window.addEventListener(APP_DATA_REFRESH,load);
    return () => { window.removeEventListener('storage',load); window.removeEventListener(APP_DATA_REFRESH,load); };
  }, [familyUserId]);

  const submitRequest = () => {
    if (!form.patientName||!form.preferredDate||!form.preferredTime) { setFormError('Please select patient, date, and time before requesting.'); return; }
    if (!String(form.appointmentReason || '').trim()) { setFormError('Please enter a reason for this appointment.'); return; }
    if (isPastIsoDate(form.preferredDate)) { setFormError('You cannot book appointments on past dates.'); return; }
    const selectedDate = new Date(`${form.preferredDate}T00:00:00`);
    const dateKey = form.preferredDate.slice(5);
    if ((!allowedWeekdays.length||!allowedWeekdays.includes(selectedDate.getDay()))||HOLIDAY_LABELS[dateKey]) { setFormError('Please choose an available date based on the admin schedule.'); return; }
    if (!timeSlots.includes(form.preferredTime)) { setFormError('Please choose an available time based on the admin schedule.'); return; }
    setFormError(''); setSaving(true);
    try {
      const created = createVisitationRequest({ familyId:familyUserId||'local-family', familyName, patientId:form.patientId, patientName:form.patientName, preferredDate:form.preferredDate, preferredTime:form.preferredTime, appointmentReason:form.appointmentReason.trim(), note:form.note });
      if (isSupabaseConfigured()) {
        const looksUuid = v => typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
        const requestId = typeof globalThis.crypto?.randomUUID==='function' ? globalThis.crypto.randomUUID() : created.id;
        void supabase.from('visitation_requests').insert({ id:requestId, family_id:looksUuid(created.familyId)?created.familyId:null, family_name:created.familyName||null, patient_id:looksUuid(created.patientId)?created.patientId:null, patient_name:created.patientName||null, preferred_date:created.preferredDate||null, preferred_time:created.preferredTime||null, appointment_reason:created.appointmentReason||null, note:created.note||null, status:created.status||'Requested', confirmed_date:null, confirmed_time:null, admin_note:null }).select('*').single().then(({data,error})=>{ if(error){console.warn('[insert]',error.message);setFormError(`Saved locally only: ${error.message}`);return;} if(!data)return; upsertVisitationRequest({id:data.id,familyId:data.family_id||'',familyName:data.family_name||'',patientId:data.patient_id||'',patientName:data.patient_name||'',preferredDate:data.preferred_date||'',preferredTime:data.preferred_time||'',appointmentReason:data.appointment_reason||'',note:data.note||'',status:normalizeVisitationStatus(data.status),confirmedDate:data.confirmed_date||'',confirmedTime:data.confirmed_time||'',adminNote:data.admin_note||'',createdAt:data.created_at||'',updatedAt:data.updated_at||''},{dropLocalIds:[created.id]}); window.dispatchEvent(new Event('storage')); window.dispatchEvent(new Event(APP_DATA_REFRESH)); });
      }
      setForm({patientId:'',patientName:'',preferredDate:'',preferredTime:'',appointmentReason:'',note:''});
      setRequests(listVisitationRequestsByFamily(familyUserId||'local-family'));
      window.dispatchEvent(new Event('storage')); window.dispatchEvent(new Event(APP_DATA_REFRESH));
    } finally { setSaving(false); }
  };

  /* ── calendar computation UNCHANGED ── */
  const monthLabel = calendarMonth.toLocaleDateString('en-US',{month:'long',year:'numeric'});
  const monthStartDay = new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),1).getDay();
  const monthDays = new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,0).getDate();
  const calendarCells = Array.from({length:42},(_,idx)=>{ const d=idx-monthStartDay+1; if(d<1||d>monthDays)return null; const dt=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),d); return {dayNum:d,iso:`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,dayOfWeek:dt.getDay()}; });
  const today=new Date();
  const todayIso=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const HOLIDAY_LABELS={'01-01':"New Year's Day",'04-09':'Araw ng Kagitingan','06-12':'Independence Day','08-21':'Ninoy Aquino Day','11-01':"All Saints' Day",'11-30':'Bonifacio Day','12-25':'Christmas Day','12-30':'Rizal Day'};
  const allowedWeekdays=(visitationSettings.days||[]).map(d=>WEEKDAY_TO_INDEX[String(d||'').trim().toLowerCase()]).filter(v=>Number.isInteger(v));
  const timeSlots=(()=>{ const [sh='13',sm='00']=String(visitationSettings.startTime||'13:00').split(':'); const [eh='17',em='00']=String(visitationSettings.endTime||'17:00').split(':'); const sMin=Number(sh)*60+Number(sm),eMin=Number(eh)*60+Number(em); if(!Number.isFinite(sMin)||!Number.isFinite(eMin)||eMin<=sMin)return[]; const sl=[]; for(let m=sMin;m<=eMin;m+=30){sl.push(`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`);} return sl; })();
  const isBookableDate = cell => { if(!cell)return false; if(isPastIsoDate(cell.iso))return false; const mmdd=cell.iso.slice(5); if(HOLIDAY_LABELS[mmdd])return false; if(!allowedWeekdays.length)return true; return allowedWeekdays.includes(cell.dayOfWeek); };

  useEffect(()=>{ if(!timeSlots.length){if(form.preferredTime)setForm(p=>({...p,preferredTime:''}));return;} if(!form.preferredTime||!timeSlots.includes(form.preferredTime))setForm(p=>({...p,preferredTime:timeSlots[0]})); },[visitationSettings.startTime,visitationSettings.endTime]); // eslint-disable-line

  const confirmedByDate = useMemo(() => getConfirmedVisitationMap(requests), [requests]);
  const pendingDates = useMemo(() => getPendingVisitationDateSet(requests), [requests]);
  const goToCurrentMonth = useCallback(() => {
    const n = new Date();
    setCalendarMonth(new Date(n.getFullYear(), n.getMonth(), 1));
  }, []);
  const isViewingCurrentMonth =
    calendarMonth.getFullYear() === today.getFullYear()
    && calendarMonth.getMonth() === today.getMonth();
  useEffect(() => {
    goToCurrentMonth();
  }, [goToCurrentMonth]);
  const approvedCount = requests.filter((r) => normalizeVisitationStatus(r.status) === 'Approved').length;
  const pendingCount = requests.filter((r) => normalizeVisitationStatus(r.status) === 'Requested').length;
  const selectedDayLabel = form.preferredDate ? formatVisitationWeekdayLong(form.preferredDate) : '';

  return (
    <div className="family-portal app-container" style={{ fontFamily: "'DM Sans',-apple-system,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        *,*::before,*::after{box-sizing:border-box;}
        button{font-family:inherit;}
        .ntf-trigger{width:40px;height:40px;min-width:40px;padding:0;border-radius:50%;border:none;background:#F54E25;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 14px rgba(245,78,37,.35);}
        .ntf-trigger:hover{background:#e0421a;}
        .ntf-trigger svg{display:block;width:20px;height:20px;stroke:#fff;}
        .ntf-dropdown{position:absolute;top:calc(100% + 10px);right:0;width:min(360px,calc(100vw - 48px));background:#fff;border:1px solid #E9EDF7;border-radius:20px;box-shadow:0 20px 60px rgba(15,23,42,.14);padding:20px;z-index:400;}
        .user-avatar{width:40px;height:40px;background:linear-gradient(135deg,#F54E25,#EA580C);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;border:none;cursor:pointer;box-shadow:0 4px 14px rgba(245,78,37,.3);}
        .fi{border:1.5px solid #E9EDF7;border-radius:12px;padding:10px 14px;background:#fff;font-size:13px;font-family:inherit;font-weight:600;color:#0F172A;outline:none;width:100%;transition:border-color .15s,box-shadow .15s;}
        .fi:focus{border-color:#F54E25;box-shadow:0 0 0 3px rgba(245,78,37,.12);}
        .cal-btn{border-radius:12px;cursor:pointer;padding:8px 6px 6px;display:flex;flex-direction:column;align-items:stretch;gap:5px;position:relative;text-align:left;transition:border-color .15s,box-shadow .15s,transform .15s;min-height:62px;}
        .cal-btn:not(:disabled):hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(15,23,42,.09)!important;}
        .cal-btn:not(:disabled).bookable:hover{border-color:#F54E25!important;}
        .cal-btn:disabled{cursor:not-allowed;}
        .scroll-area::-webkit-scrollbar{width:4px;}
        .scroll-area::-webkit-scrollbar-thumb{background:#E2E8F0;border-radius:999px;}
        .req-card{border-radius:18px;padding:14px 16px;border:1px solid #F1F5F9;background:#fff;box-shadow:0 2px 10px rgba(15,23,42,.04);transition:border-color .15s;}
        .req-card:hover{border-color:#E0E7FF;}
        .ntf-dropdown-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;}
        .ntf-clear-all{border:none;background:transparent;color:#94A3B8;font-size:12px;font-weight:700;cursor:pointer;padding:4px 6px;border-radius:8px;}
        .ntf-clear-all:hover{color:#64748b;background:#f1f5f9;}
        @media(max-width:768px){.scroll-area{padding:14px!important;}.appt-grid{grid-template-columns:1fr!important;}}
      `}</style>

      <FamilySidebar
        isExpanded={isExpanded}
        onToggleExpanded={() => setIsExpanded(!isExpanded)}
      />

      {/* ── MAIN ── */}
      <main className="main-view">

        <FamilyPageHeader {...FAMILY_PAGE_HEADERS.appointments} onBrandPress={scrollToTop} showMobileLogo={false} />

        <div className="scroll-area" style={{flex:1,overflowY:'auto',padding:'24px 28px 48px',background:'#F0F4FF'}}>
          <div style={{width:'100%',maxWidth:1560,margin:'0 auto',display:'grid',gap:20}}>

            {/* ① HERO BANNER */}
            <div style={{background:'linear-gradient(135deg,#0F172A 0%,#1E2D4F 50%,#2D1B69 100%)',borderRadius:24,padding:'26px 30px',boxShadow:'0 16px 48px rgba(15,23,42,.22)',position:'relative',overflow:'hidden'}}>
              <div style={{position:'absolute',top:-40,right:-40,width:180,height:180,borderRadius:'50%',background:'radial-gradient(circle,rgba(99,102,241,.2),transparent 70%)'}}/>
              <div style={{position:'absolute',bottom:-20,left:'40%',width:120,height:120,borderRadius:'50%',background:'radial-gradient(circle,rgba(245,78,37,.15),transparent 70%)'}}/>
              <div style={{position:'relative',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:20}}>
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                    <div style={{width:32,height:32,borderRadius:10,background:'rgba(255,255,255,.12)',display:'flex',alignItems:'center',justifyContent:'center'}}><Calendar size={16} color="#fff"/></div>
                    <span style={{fontSize:10,color:'rgba(255,255,255,.4)',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase'}}>Family Portal · Visitation</span>
                  </div>
                  <h1 style={{margin:0,color:'#fff',fontSize:26,fontWeight:900,letterSpacing:'-0.03em'}}>Family Appointments</h1>
                  <p style={{margin:'4px 0 0',color:'rgba(255,255,255,.4)',fontSize:12}}>Book visitation requests and track confirmation status in one place</p>
                </div>
                <div style={{display:'flex',gap:10}}>
                  {[{label:'Total',val:requests.length,color:'#A5B4FC'},{label:'Approved',val:approvedCount,color:'#6EE7B7'},{label:'Pending',val:pendingCount,color:'#FCA5A5'}].map(s=>(
                    <div key={s.label} style={{background:'rgba(255,255,255,.07)',borderRadius:16,padding:'12px 18px',border:'1px solid rgba(255,255,255,.1)',textAlign:'center',minWidth:76}}>
                      <p style={{margin:0,fontSize:9,color:'rgba(255,255,255,.35)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em'}}>{s.label}</p>
                      <p style={{margin:'4px 0 0',fontSize:24,fontWeight:900,color:s.color,lineHeight:1}}>{s.val}</p>
                    </div>
                  ))}
                </div>
              </div>
              {/* Schedule strip */}
              <div style={{marginTop:16,display:'flex',alignItems:'center',gap:8,background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.1)',borderRadius:12,padding:'10px 16px',flexWrap:'wrap'}}>
                <Clock size={13} color="rgba(255,255,255,.45)"/>
                <span style={{fontSize:11,color:'rgba(255,255,255,.45)',fontWeight:600}}>Fixed visitation schedule:</span>
                <span style={{fontSize:11,color:'rgba(255,255,255,.8)',fontWeight:800}}>{(visitationSettings.days||[]).join(', ')} · {visitationSettings.startTime}–{visitationSettings.endTime}</span>
              </div>
            </div>

            {/* ② MAIN GRID */}
            <div className="appt-grid" style={{display:'grid',gridTemplateColumns:'1.35fr 0.65fr',gap:20}}>

              {/* LEFT: BOOKING FORM + CALENDAR */}
              <div style={{background:'#fff',border:'1px solid #E9EDF7',borderRadius:22,padding:'22px 24px',boxShadow:'0 4px 20px rgba(15,23,42,.05)'}}>
                {/* Form header */}
                <div style={{marginBottom:18}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                    <div style={{width:28,height:28,borderRadius:8,background:'#FFF1EB',display:'flex',alignItems:'center',justifyContent:'center'}}><Calendar size={14} color="#F54E25"/></div>
                    <h3 style={{margin:0,fontSize:14,fontWeight:900,color:'#0F172A',letterSpacing:'-0.01em'}}>Request Appointment</h3>
                  </div>
                  <p style={{margin:'0 0 0 36px',fontSize:11,color:'#94A3B8'}}>Pick a date from the calendar below, select a time, then submit</p>
                </div>

                {/* Form fields */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:14}}>
                  <div style={{gridColumn:'1 / -1'}}>
                    <label style={{fontSize:10,fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'.07em',display:'block',marginBottom:6}}>Reason for Appointment *</label>
                    <input className="fi" type="text" value={form.appointmentReason} onChange={e=>setForm(p=>({...p,appointmentReason:e.target.value}))} placeholder="e.g. Family visit, follow-up discussion…"/>
                  </div>
                  <div>
                    <label style={{fontSize:10,fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'.07em',display:'block',marginBottom:6}}>Resident</label>
                    <select className="fi" value={form.patientId} onChange={e=>{const s=patients.find(p=>String(p.id)===String(e.target.value));setForm(p=>({...p,patientId:e.target.value,patientName:s?.name||''}));}}>
                      <option value="">Select resident</option>
                      {patients.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{fontSize:10,fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'.07em',display:'block',marginBottom:6}}>Date</label>
                    <input type="date" className="fi" value={form.preferredDate} readOnly style={{background:'#F8FAFF',cursor:'default'}}/>
                    {selectedDayLabel ? (
                      <p style={{ margin: '6px 0 0', fontSize: 11, fontWeight: 800, color: '#166534' }}>
                        Visit day: {selectedDayLabel}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label style={{fontSize:10,fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'.07em',display:'block',marginBottom:6}}>Time Slot</label>
                    <select className="fi" value={form.preferredTime} onChange={e=>setForm(p=>({...p,preferredTime:e.target.value}))}>
                      {!timeSlots.length?<option value="">No slots available</option>:null}
                      {timeSlots.map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:12,marginBottom:formError?10:0}}>
                  <div>
                    <label style={{fontSize:10,fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'.07em',display:'block',marginBottom:6}}>Note <span style={{fontWeight:500,textTransform:'none'}}>(optional)</span></label>
                    <input className="fi" type="text" value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))} placeholder="Optional note for admin…"/>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
                    <button type="button" onClick={submitRequest} disabled={saving}
                      style={{padding:'11px 22px',borderRadius:14,border:'none',background:'linear-gradient(135deg,#F54E25,#EA580C)',color:'#fff',fontSize:13,fontWeight:800,cursor:'pointer',boxShadow:'0 6px 18px rgba(245,78,37,.3)',whiteSpace:'nowrap',opacity:saving?.7:1}}>
                      {saving?'Submitting…':'Request Slot'}
                    </button>
                  </div>
                </div>
                {formError&&(
                  <div style={{display:'flex',alignItems:'center',gap:8,background:'#FFF1F2',border:'1px solid #FECDD3',borderRadius:12,padding:'10px 14px',marginBottom:14}}>
                    <AlertCircle size={14} color="#F43F5E"/><span style={{fontSize:12,fontWeight:700,color:'#BE123C'}}>{formError}</span>
                  </div>
                )}

                {/* Calendar */}
                <div style={{background:'#F8FAFF',border:'1px solid #E9EDF7',borderRadius:18,padding:'18px 16px',marginTop:14}}>
                  <div style={{display:'grid',gridTemplateColumns:'auto 1fr auto',alignItems:'center',gap:12,marginBottom:16}}>
                    <button type="button" aria-label="Previous month" onClick={()=>setCalendarMonth(p=>new Date(p.getFullYear(),p.getMonth()-1,1))}
                      style={{border:'1px solid #E2E8F0',background:'#fff',borderRadius:12,width:44,height:44,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 1px 3px rgba(15,23,42,0.06)',flexShrink:0,overflow:'visible'}}>
                      <span style={{display:'flex',lineHeight:0}} aria-hidden>
                        <ArrowLeft size={24} strokeWidth={2.5} color="#1e293b"/>
                      </span>
                    </button>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
                      <span style={{fontSize:16,fontWeight:900,color:'#0F172A',letterSpacing:'-0.02em',textAlign:'center'}}>{monthLabel}</span>
                      {!isViewingCurrentMonth ? (
                        <button type="button" className="cal-today-btn" onClick={goToCurrentMonth}>Today</button>
                      ) : null}
                    </div>
                    <button type="button" aria-label="Next month" onClick={()=>setCalendarMonth(p=>new Date(p.getFullYear(),p.getMonth()+1,1))}
                      style={{border:'1px solid #E2E8F0',background:'#fff',borderRadius:12,width:44,height:44,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 1px 3px rgba(15,23,42,0.06)',flexShrink:0,overflow:'visible'}}>
                      <span style={{display:'flex',lineHeight:0}} aria-hidden>
                        <ArrowRight size={24} strokeWidth={2.5} color="#1e293b"/>
                      </span>
                    </button>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(7,minmax(0,1fr))',gap:4,marginBottom:8}}>
                    {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d=><div key={d} style={{textAlign:'center',fontSize:10,fontWeight:800,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'.06em',padding:'4px 0'}}>{d}</div>)}
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(7,minmax(0,1fr))',gap:4}}>
                    {calendarCells.map((cell,idx)=>{
                      if(!cell)return<div key={`e-${idx}`} style={{minHeight:58}}/>;
                      const mmdd=cell.iso.slice(5);
                      const isHoliday=Boolean(HOLIDAY_LABELS[mmdd]);
                      const isBookable=isBookableDate(cell);
                      const isSel=cell.iso===form.preferredDate;
                      const isToday=cell.iso===todayIso;
                      const dayVisits=confirmedByDate.get(cell.iso)||[];
                      const hasVisit=dayVisits.length>0;
                      const hasPending=pendingDates.has(cell.iso)&&!hasVisit;
                      const visitTime=dayVisits[0]?.confirmedTime||'';
                      let bg='#fff',borderColor='#E9EDF7',textColor='#334155';
                      if(isSel){bg='linear-gradient(135deg,#F54E25,#EA580C)';borderColor='#EA580C';textColor='#fff';}
                      else if(hasVisit){bg='#DCFCE7';borderColor='#22C55E';textColor='#166534';}
                      else if(hasPending){bg='#FEF3C7';borderColor='#F59E0B';textColor='#92400E';}
                      else if(isHoliday){bg='#FFF1F2';borderColor='#FECDD3';textColor='#BE123C';}
                      else if(!isBookable){bg='#F8FAFC';borderColor='#F1F5F9';textColor='#CBD5E1';}
                      else{bg='#FFF7ED';borderColor='#FED7AA';textColor='#9A3412';}
                      return(
                        <button key={`c-${idx}`} type="button" disabled={!isBookable} className={`cal-btn${isBookable?' bookable':''}`}
                          onClick={()=>{if(!isBookable)return;setForm(p=>({...p,preferredDate:cell.iso,preferredTime:p.preferredTime||(timeSlots[0]||'')}));setFormError('');}}
                          style={{background:bg,border:`${isSel||isToday?'2':'1'}px solid ${isSel?'#EA580C':isToday?'#6366F1':borderColor}`,color:textColor,boxShadow:isSel?'0 6px 16px rgba(245,78,37,.25)':isToday?'0 0 0 2px rgba(99,102,241,.15)':'0 1px 3px rgba(15,23,42,.04)'}}
                          title={hasVisit?`Your visit: ${formatVisitationWeekdayLong(cell.iso)}${visitTime?` at ${visitTime}`:''}`:hasPending?`Pending request: ${formatVisitationWeekdayLong(cell.iso)}`:isHoliday?HOLIDAY_LABELS[mmdd]:!isBookable?'Not available':'Click to select'}>
                          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:2}}>
                            <span style={{fontSize:13,fontWeight:900,lineHeight:1}}>{cell.dayNum}</span>
                            {isToday&&!isSel&&<span style={{fontSize:7,fontWeight:800,color:'#4338CA',background:'#E0E7FF',padding:'2px 5px',borderRadius:4,textTransform:'uppercase'}}>Today</span>}
                            {hasVisit&&!isSel&&<span style={{fontSize:7,fontWeight:800,color:'#166534',background:'#BBF7D0',padding:'2px 5px',borderRadius:4,textTransform:'uppercase'}}>Visit</span>}
                            {hasPending&&!isSel&&<span style={{fontSize:7,fontWeight:800,color:'#92400E',background:'#FDE68A',padding:'2px 5px',borderRadius:4,textTransform:'uppercase'}}>Pending</span>}
                          </div>
                          {hasVisit&&!isSel&&(
                            <span style={{fontSize:9,fontWeight:800,lineHeight:1.2,marginTop:2}}>
                              {formatVisitationWeekdayShort(cell.iso)}{visitTime?` · ${visitTime}`:''}
                            </span>
                          )}
                          {isHoliday&&<span style={{width:5,height:5,borderRadius:'50%',background:'#F43F5E',display:'block',alignSelf:'flex-end',marginTop:'auto'}}/>}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{marginTop:14,display:'flex',flexWrap:'wrap',gap:12}}>
                    {[{label:'Your visit',bg:'#DCFCE7',border:'#22C55E'},{label:'Pending request',bg:'#FEF3C7',border:'#F59E0B'},{label:'Available',bg:'#FFF7ED',border:'#F97316'},{label:'Holiday',bg:'#FFF1F2',border:'#F43F5E'},{label:'Unavailable',bg:'#F8FAFC',border:'#E2E8F0'}].map(l=>(
                      <span key={l.label} style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:10,fontWeight:700,color:'#64748B'}}>
                        <span style={{width:8,height:8,borderRadius:3,background:l.bg,border:`1px solid ${l.border}`,display:'inline-block'}}/>
                        {l.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* RIGHT: STATUS + NOTES */}
              <div style={{display:'grid',gap:16,alignContent:'start'}}>

                {/* Appointment Status */}
                <div style={{background:'#fff',border:'1px solid #E9EDF7',borderRadius:22,padding:'18px 20px',boxShadow:'0 4px 20px rgba(15,23,42,.05)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
                    <div style={{width:28,height:28,borderRadius:8,background:'#FFF1EB',display:'flex',alignItems:'center',justifyContent:'center'}}><CheckCircle2 size={14} color="#F54E25"/></div>
                    <div>
                      <h3 style={{margin:0,fontSize:13,fontWeight:900,color:'#0F172A'}}>Appointment Status</h3>
                      <p style={{margin:0,fontSize:10,color:'#94A3B8'}}>{requests.length} total</p>
                    </div>
                  </div>
                  {requests.length===0?(
                    <div style={{textAlign:'center',padding:'24px 12px',border:'1px dashed #E9EDF7',borderRadius:16}}>
                      <Calendar size={22} color="#CBD5E1" style={{marginBottom:8}}/>
                      <p style={{margin:0,fontSize:12,fontWeight:700,color:'#94A3B8'}}>No requests yet</p>
                      <p style={{margin:'4px 0 0',fontSize:11,color:'#CBD5E1'}}>Use the calendar to book your first slot</p>
                    </div>
                  ):(
                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                      {requests.filter(Boolean).map(row=>{
                        const st=normalizeVisitationStatus(row.status);
                        const stCfg=STATUS_CFG[st]||STATUS_CFG.Requested;
                        return(
                          <div key={row.id} className="req-card">
                            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10,marginBottom:6}}>
                              <div style={{minWidth:0}}>
                                <div style={{fontSize:13,fontWeight:800,color:'#0F172A',marginBottom:2}}>{row.patientName}</div>
                                <div style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:'#64748B'}}>
                                  <Clock size={11} color="#94A3B8"/>
                                  {row.confirmedDate
                                    ? `${formatVisitationWeekdayLong(row.confirmedDate)}, ${row.confirmedDate}`
                                    : row.preferredDate}{' '}
                                  {(row.confirmedTime||row.preferredTime)}
                                </div>
                              </div>
                              <span style={{fontSize:10,fontWeight:800,borderRadius:999,padding:'3px 9px',flexShrink:0,background:stCfg.bg,color:stCfg.color,border:`1px solid ${stCfg.border}`}}>{st}</span>
                            </div>
                            <p style={{margin:0,fontSize:11,color:'#94A3B8',fontWeight:600}}>{visitationStatusSubtext({...row,status:st})}</p>
                            {st==='Rescheduled'&&String(row.adminNote||'').trim()&&(
                              <div style={{marginTop:8,fontSize:11,color:'#3730A3',fontWeight:700,background:'#EEF2FF',borderRadius:8,padding:'6px 10px'}}>Admin: {row.adminNote}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Booking Notes */}
                <div style={{background:'#fff',border:'1px solid #E9EDF7',borderRadius:22,padding:'18px 20px',boxShadow:'0 4px 20px rgba(15,23,42,.05)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
                    <div style={{width:28,height:28,borderRadius:8,background:'#EEF2FF',display:'flex',alignItems:'center',justifyContent:'center'}}><Info size={14} color="#6366F1"/></div>
                    <h3 style={{margin:0,fontSize:13,fontWeight:900,color:'#0F172A'}}>Booking Notes</h3>
                  </div>
                  {[
                    {text:'Appointments remain Requested until admin confirms availability.',accent:'#FEF3C7',dot:'#F59E0B'},
                    {text:'Rescheduled means the facility approved with a different date/time.',accent:'#E0E7FF',dot:'#6366F1'},
                    {text:'Use the note field for medical or travel constraints.',accent:'#ECFDF5',dot:'#10B981'},
                  ].map((n,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'flex-start',gap:10,background:n.accent,borderRadius:12,padding:'10px 12px',marginBottom:i<2?8:0}}>
                      <span style={{width:6,height:6,borderRadius:'50%',background:n.dot,flexShrink:0,marginTop:5}}/>
                      <span style={{fontSize:12,color:'#334155',fontWeight:600,lineHeight:1.5}}>{n.text}</span>
                    </div>
                  ))}
                </div>

                {/* Schedule Info */}
                <div style={{background:'linear-gradient(135deg,#EEF2FF,#F5F3FF)',border:'1px solid #C7D2FE',borderRadius:22,padding:'18px 20px',boxShadow:'0 4px 20px rgba(15,23,42,.05)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                    <div style={{width:28,height:28,borderRadius:8,background:'rgba(255,255,255,.7)',display:'flex',alignItems:'center',justifyContent:'center'}}><Shield size={14} color="#6366F1"/></div>
                    <h3 style={{margin:0,fontSize:13,fontWeight:900,color:'#3730A3'}}>Schedule Info</h3>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}>
                      <span style={{color:'#6366F1',fontWeight:600}}>Visit Days</span>
                      <span style={{fontWeight:800,color:'#0F172A'}}>{(visitationSettings.days||[]).join(', ')||'Not set'}</span>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}>
                      <span style={{color:'#6366F1',fontWeight:600}}>Start Time</span>
                      <span style={{fontWeight:800,color:'#0F172A'}}>{visitationSettings.startTime}</span>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}>
                      <span style={{color:'#6366F1',fontWeight:600}}>End Time</span>
                      <span style={{fontWeight:800,color:'#0F172A'}}>{visitationSettings.endTime}</span>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}>
                      <span style={{color:'#6366F1',fontWeight:600}}>Available Slots</span>
                      <span style={{fontWeight:800,color:'#0F172A'}}>{timeSlots.length} per day</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <FamilyMobileBottomNav />
      <FloatingChatHead/>
    </div>
  );
}