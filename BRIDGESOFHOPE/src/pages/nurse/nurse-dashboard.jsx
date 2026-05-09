import React, { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, Users, FileText, User, LogOut, TrendingUp, TrendingDown, Minus, AlertTriangle, Clock, Heart, ChevronUp, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logo from '@/assets/kalingalogo.png';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

function toName(value) {
  return String(value || '').trim().toLowerCase();
}

function getCandidateNames(user, profileName) {
  const emailLocal = String(user?.email || '').split('@')[0].replace(/[._-]+/g, ' ').trim();
  return Array.from(
    new Set(
      [profileName, user?.user_metadata?.full_name, user?.user_metadata?.name, emailLocal]
        .map((x) => String(x || '').trim())
        .filter(Boolean)
    )
  );
}

/* ─── Sparkline trend ─── */
function SparkLine({ values, color = '#6366F1' }) {
  const w = 100, h = 32;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);
  const pts = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * w;
    const y = h - ((v - min) / range) * (h - 6) - 3;
    return `${x},${y}`;
  });
  const area = `M${pts[0]} ` + pts.slice(1).map(p => `L${p}`).join(' ') + ` L${w},${h} L0,${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h, display: 'block' }}>
      <defs>
        <linearGradient id={`sg_${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg_${color.replace('#','')})`} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ─── Donut ─── */
function DonutChart({ segments, size = 130, stroke = 16 }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F1F5F9" strokeWidth={stroke} />
      {segments.map((seg) => {
        const len = (seg.value / total) * circ;
        const node = (
          <circle key={seg.label} cx={size/2} cy={size/2} r={r} fill="none" stroke={seg.color}
            strokeWidth={stroke} strokeDasharray={`${len} ${circ - len}`}
            strokeDashoffset={-offset} strokeLinecap="butt"
            transform={`rotate(-90 ${size/2} ${size/2})`} />
        );
        offset += len;
        return node;
      })}
      <text x={size/2} y={size/2 - 4} textAnchor="middle" fontSize="18" fontWeight="800" fill="#0F172A">{total}</text>
      <text x={size/2} y={size/2 + 14} textAnchor="middle" fontSize="9" fill="#94A3B8" fontWeight="600" letterSpacing="0.08em">TOTAL</text>
    </svg>
  );
}

/* ─── Bar Row ─── */
function BarRow({ label, value, max, color }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569', marginBottom: 5, fontWeight: 500 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700, color: '#0F172A' }}>{value}</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: '#F1F5F9', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: 6, borderRadius: 999, background: color || 'linear-gradient(90deg,#6366F1,#8B5CF6)', transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

/* ─── Vertical Bar Chart ─── */
function VerticalBarChart({ data }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: 140, gap: 12, paddingTop: 16 }}>
      {data.map((d) => {
        const h = Math.max(12, Math.round((d.value / max) * 110));
        return (
          <div key={d.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{d.value}</span>
            <div style={{ width: '100%', maxWidth: 48, height: h, borderRadius: '8px 8px 4px 4px', background: d.color, opacity: 0.92 }} />
            <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Trend Line (7-day) ─── */
function TrendLine({ values, labels = [] }) {
  const pointGap = 120;
  const w = Math.max(980, Math.max(values.length - 1, 1) * pointGap + 80);
  const h = 92;
  const padX = 20;
  const padTop = 8;
  const padBottom = 12;
  const max = Math.max(...values, 1);
  const min = 0;
  const range = Math.max(1, max - min);
  const n = values.length;
  const innerW = Math.max(1, w - padX * 2);
  const innerH = Math.max(1, h - padTop - padBottom);
  const xs = values.map((_, i) => padX + (i / Math.max(n - 1, 1)) * innerW);
  const ys = values.map(v => padTop + (1 - (v - min) / range) * innerH);
  const pts = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
  const area = `M${padX},${h - padBottom} ` + xs.map((x, i) => `L${x},${ys[i]}`).join(' ') + ` L${padX + innerW},${h - padBottom} Z`;
  const days = labels.length ? labels : Array.from({ length: n || 7 }, (_, i) => `Day ${i + 1}`);
  return (
    <div className="nurse-trend-scroll" style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', paddingBottom: 2 }}>
      <style>{`
        .nurse-trend-scroll {
          scrollbar-width: thin;
          scrollbar-color: #6366F1 #E9EDF7;
        }
        .nurse-trend-scroll::-webkit-scrollbar {
          height: 12px;
        }
        .nurse-trend-scroll::-webkit-scrollbar-track {
          background: linear-gradient(90deg, #F3F6FF, #E9EDF7);
          border-radius: 999px;
          border: 1px solid #E2E8F0;
        }
        .nurse-trend-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(90deg, #6366F1, #8B5CF6);
          border-radius: 999px;
          border: 2px solid #EEF2FF;
          box-shadow: inset 0 0 0 1px rgba(99, 102, 241, 0.25);
        }
        .nurse-trend-scroll::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(90deg, #4F46E5, #7C3AED);
        }
        .nurse-trend-scroll::-webkit-scrollbar-button:single-button {
          width: 16px;
          background: #F8FAFF;
          border-radius: 6px;
        }
      `}</style>
      <div style={{ width: w }}>
      <svg width={w} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', width: w, height: h }}>
        <defs>
          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366F1" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <line key={t} x1={padX} y1={padTop + (1 - t) * innerH} x2={padX + innerW} y2={padTop + (1 - t) * innerH}
            stroke="#F1F5F9" strokeWidth="1" />
        ))}
        <path d={area} fill="url(#trendGrad)" />
        <polyline points={pts} fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {xs.map((x, i) => (
          <circle key={i} cx={x} cy={ys[i]} r={values[i] > 0 ? 4 : 2} fill={values[i] > 0 ? '#6366F1' : '#CBD5E1'} stroke="#fff" strokeWidth="1.5" />
        ))}
      </svg>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(days.length, 1)}, minmax(70px, 1fr))`, marginTop: 6 }}>
        {days.map((d, i) => (
          <span key={i} style={{ fontSize: 10, color: '#94A3B8', fontWeight: 500, textAlign: 'center' }}>{d}</span>
        ))}
      </div>
      </div>
    </div>
  );
}

/* ─── Stat Card ─── */
function StatCard({ label, value, sub, icon: Icon, tone, sparkValues }) {
  const tones = {
    blue:    { bg: 'linear-gradient(135deg,#EEF2FF,#E0E7FF)', accent: '#6366F1', chip: '#EEF2FF', chipText: '#4338CA', border: '#C7D2FE' },
    green:   { bg: 'linear-gradient(135deg,#ECFDF5,#D1FAE5)', accent: '#10B981', chip: '#D1FAE5', chipText: '#065F46', border: '#A7F3D0' },
    red:     { bg: 'linear-gradient(135deg,#FFF1F2,#FFE4E6)', accent: '#F43F5E', chip: '#FFE4E6', chipText: '#9F1239', border: '#FECDD3' },
    amber:   { bg: 'linear-gradient(135deg,#FFFBEB,#FEF3C7)', accent: '#F59E0B', chip: '#FEF3C7', chipText: '#92400E', border: '#FDE68A' },
  };
  const t = tones[tone] || tones.blue;
  return (
    <div style={{ background: '#fff', border: `1px solid ${t.border}`, borderRadius: 18, padding: '18px 20px', boxShadow: '0 4px 20px rgba(15,23,42,0.06)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: 90, height: 90, background: t.bg, borderRadius: '0 18px 0 90px', opacity: 0.7 }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative' }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, color: '#64748B', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</p>
          <p style={{ margin: '6px 0 4px', fontSize: 30, fontWeight: 900, color: '#0F172A', lineHeight: 1 }}>{value}</p>
          {sub && <p style={{ margin: 0, fontSize: 11, color: '#94A3B8' }}>{sub}</p>}
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {Icon && <Icon size={20} color={t.accent} />}
        </div>
      </div>
      {sparkValues && (
        <div style={{ marginTop: 10 }}>
          <SparkLine values={sparkValues} color={t.accent} />
        </div>
      )}
    </div>
  );
}

/* ─── Status Badge ─── */
function StatusBadge({ status }) {
  const s = String(status || '').trim();
  const cfg = {
    Improving: { bg: '#D1FAE5', color: '#065F46', icon: TrendingUp },
    Stable:    { bg: '#DBEAFE', color: '#1E40AF', icon: Minus },
    Declining: { bg: '#FFE4E6', color: '#9F1239', icon: TrendingDown },
  };
  const c = cfg[s] || { bg: '#F1F5F9', color: '#475569', icon: Minus };
  const Icon = c.icon;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color }}>
      <Icon size={11} />
      {s || '—'}
    </span>
  );
}

/* ─── Progress Bar ─── */
function ProgressBar({ value }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  const color = pct >= 70 ? '#10B981' : pct >= 40 ? '#F59E0B' : '#F43F5E';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: '#F1F5F9', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', minWidth: 28 }}>{pct}%</span>
    </div>
  );
}

/* ─── Section Header ─── */
function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.01em' }}>{title}</h3>
      {sub && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94A3B8' }}>{sub}</p>}
    </div>
  );
}

/* ─── Card ─── */
function Card({ children, style = {} }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E9EDF7', borderRadius: 18, padding: '18px 20px', boxShadow: '0 4px 20px rgba(15,23,42,0.05)', minWidth: 0, maxWidth: '100%', ...style }}>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
export default function NurseDashboardPage() {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [assigned, setAssigned] = useState([]);

  useEffect(() => {
    const load = async () => {
      if (!isSupabaseConfigured()) { setAssigned([]); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAssigned([]); return; }
      const [{ data: profile }, { data: patients }] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
        supabase.from('patients').select('*').is('discharged_at', null).order('admitted_at', { ascending: false }),
      ]);
      const names = getCandidateNames(user, profile?.full_name).map(toName);
      const rows = (patients || []).filter((p) => names.includes(toName(p.program_staff)));
      setAssigned(rows);
    };
    void load();
  }, []);

  const statusCounts = useMemo(() => {
    const out = { Improving: 0, Stable: 0, Declining: 0 };
    assigned.forEach((p) => {
      const s = String(p.clinical_status || p.status || '').trim();
      if (s in out) out[s] += 1;
    });
    return out;
  }, [assigned]);

  const concernCounts = useMemo(() => {
    const map = new Map();
    assigned.forEach((p) => {
      const c = String(p.primary_concern || p.concern || 'Unspecified').trim();
      map.set(c, (map.get(c) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [assigned]);

  const avgProgress = useMemo(() => {
    if (!assigned.length) return 0;
    const vals = assigned.map((p) => Number(p.progress_percent ?? p.progress ?? 0)).filter((n) => Number.isFinite(n));
    if (!vals.length) return 0;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [assigned]);

  const maxConcern = Math.max(...concernCounts.map((x) => x[1]), 1);

  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dayKeys = Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(year, month, i + 1);
      return d.toISOString().slice(0, 10);
    });
    const map = new Map(dayKeys.map((d) => [d, 0]));
    assigned.forEach((r) => {
      const key = String(r.admitted_at || '').slice(0, 10);
      if (map.has(key)) map.set(key, (map.get(key) || 0) + 1);
    });
    return {
      values: dayKeys.map((d) => map.get(d) || 0),
      labels: Array.from({ length: daysInMonth }, (_, i) => {
        const d = new Date(year, month, i + 1);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }),
    };
  }, [assigned]);

  const donutSegments = [
    { label: 'Improving', value: statusCounts.Improving, color: '#10B981' },
    { label: 'Stable',    value: statusCounts.Stable,    color: '#6366F1' },
    { label: 'Declining', value: statusCounts.Declining, color: '#F43F5E' },
  ];

  const highPriorityRows = useMemo(
    () => assigned.filter((r) => String(r.clinical_status || r.status || '').trim() === 'Declining').slice(0, 6),
    [assigned]
  );
  const recentAdmissionsRows = useMemo(
    () => [...assigned].sort((a, b) => new Date(b.admitted_at || 0) - new Date(a.admitted_at || 0)).slice(0, 6),
    [assigned]
  );
  const concernTableRows = useMemo(
    () => concernCounts.map(([concern, count]) => ({ concern, count })),
    [concernCounts]
  );

  const concernColors = ['#6366F1','#8B5CF6','#EC4899','#F43F5E','#F59E0B'];
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8FAFF', fontFamily: "'DM Sans', 'Segoe UI', sans-serif", overflowX: 'hidden' }}>

      {/* ── SIDEBAR (unchanged) ── */}
      <aside onClick={() => setIsExpanded((v) => !v)} style={{ width: isExpanded ? 280 : 110, background: '#fff', borderRight: '1px solid #F1F1F1', display: 'flex', flexDirection: 'column', alignItems: 'stretch', padding: '25px 0 0', transition: 'width .3s cubic-bezier(0.4, 0, 0.2, 1)', position: 'fixed', top: 0, left: 0, height: '100vh', overflow: 'hidden', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: 28, alignSelf: 'center' }}>
          <img src={logo} alt="Kalinga" style={{ width: isExpanded ? 120 : 70 }} />
        </div>
        <div style={{ width: '100%', flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 48, padding: isExpanded ? '0 28px' : 0, justifyContent: isExpanded ? 'flex-start' : 'center', marginBottom: 6, boxSizing: 'border-box' }}>
            <div style={{ background: '#F54E25', color: '#fff', borderRadius: 12, padding: 10, display: 'flex' }}><LayoutGrid size={22} /></div>
            {isExpanded ? <span style={{ color: '#F54E25', fontWeight: 700 }}>Dashboard</span> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 48, padding: isExpanded ? '0 28px' : 0, justifyContent: isExpanded ? 'flex-start' : 'center', marginBottom: 6, boxSizing: 'border-box' }} onClick={(e) => { e.stopPropagation(); navigate('/patient-database'); }}>
            <Users size={22} color="#707EAE" />
            {isExpanded ? <span style={{ color: '#707EAE', fontWeight: 700 }}>Residents</span> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 48, padding: isExpanded ? '0 28px' : 0, justifyContent: isExpanded ? 'flex-start' : 'center', marginBottom: 6, boxSizing: 'border-box' }} onClick={(e) => { e.stopPropagation(); navigate('/nurse-calendar'); }}>
            <Calendar size={22} color="#707EAE" />
            {isExpanded ? <span style={{ color: '#707EAE', fontWeight: 700 }}>Calendar</span> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 48, padding: isExpanded ? '0 28px' : 0, justifyContent: isExpanded ? 'flex-start' : 'center', marginBottom: 6, boxSizing: 'border-box' }} onClick={(e) => { e.stopPropagation(); navigate('/nurse-weekly-report'); }}>
            <FileText size={22} color="#707EAE" />
            {isExpanded ? <span style={{ color: '#707EAE', fontWeight: 700 }}>Weekly Report</span> : null}
          </div>
        </div>
        <div style={{ flexShrink: 0, width: '100%', padding: '16px 0 20px', marginTop: 'auto', borderTop: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 48, padding: isExpanded ? '0 28px' : 0, justifyContent: isExpanded ? 'flex-start' : 'center', marginBottom: 6, boxSizing: 'border-box' }} onClick={(e) => { e.stopPropagation(); navigate('/nurseprofile'); }}>
            <User size={22} color="#707EAE" />
            {isExpanded ? <span style={{ color: '#707EAE', fontWeight: 700 }}>Profile</span> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 48, padding: isExpanded ? '0 28px' : 0, justifyContent: isExpanded ? 'flex-start' : 'center', boxSizing: 'border-box' }} onClick={(e) => { e.stopPropagation(); navigate('/login'); }}>
            <LogOut size={22} color="#F54E25" />
            {isExpanded ? <span style={{ color: '#F54E25', fontWeight: 700 }}>Logout</span> : null}
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main style={{ flex: 1, marginLeft: isExpanded ? 280 : 110, padding: '24px 28px 40px', transition: 'margin-left .3s', background: '#F8FAFF', minHeight: '100vh', overflowX: 'hidden' }}>

        {/* ── Page Header ── */}
        <div style={{ background: 'linear-gradient(135deg,#1E293B 0%,#1D2D50 60%,#312e81 100%)', borderRadius: 22, padding: '24px 28px', marginBottom: 20, boxShadow: '0 10px 40px rgba(15,23,42,0.18)', position: 'relative', overflow: 'hidden' }}>
          {/* decorative circles */}
          <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ position: 'absolute', bottom: -20, right: 80, width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Heart size={18} color="#fff" />
                </div>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Clinical Overview</span>
              </div>
              <h1 style={{ margin: 0, color: '#fff', fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em' }}>Nurse Dashboard</h1>
              <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: 4, fontSize: 12, margin: '4px 0 0' }}>Assigned residents — real-time clinical metrics</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>{timeStr}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{dateStr}</div>
            </div>
          </div>

          {/* Inline stat strip */}
          <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { label: 'Assigned Residents', value: assigned.length, color: '#A5B4FC' },
              { label: 'Average Progress',   value: `${avgProgress}%`, color: '#6EE7B7' },
              { label: 'Declining',          value: statusCounts.Declining, color: '#FCA5A5' },
            ].map((s) => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 16px', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.10)' }}>
                <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{s.label}</p>
                <p style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Row 1: Status Mix | Clinical Bar | Top Concerns ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.3fr', gap: 16, marginBottom: 16 }}>

          {/* Donut */}
          <Card>
            <SectionHeader title="Patient Status Mix" sub="Current clinical distribution" />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <DonutChart segments={donutSegments} size={140} stroke={18} />
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {donutSegments.map((s) => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>{s.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{s.value}</span>
                      <span style={{ fontSize: 10, color: '#94A3B8' }}>
                        {donutSegments.reduce((a, x) => a + x.value, 0) > 0
                          ? `${Math.round((s.value / donutSegments.reduce((a, x) => a + x.value, 0)) * 100)}%`
                          : '0%'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Vertical Bar */}
          <Card>
            <SectionHeader title="Clinical Status" sub="Count by category" />
            <VerticalBarChart
              data={[
                { label: 'Improving', value: statusCounts.Improving, color: '#10B981' },
                { label: 'Stable',    value: statusCounts.Stable,    color: '#6366F1' },
                { label: 'Declining', value: statusCounts.Declining, color: '#F43F5E' },
              ]}
            />
          </Card>

          {/* Top Concerns bar */}
          <Card>
            <SectionHeader title="Top Primary Concerns" sub="Most frequent among assigned" />
            {concernCounts.length === 0
              ? <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>No assigned residents yet.</p>
              : concernCounts.map(([label, value], i) => (
                  <BarRow key={label} label={label} value={value} max={maxConcern} color={concernColors[i % concernColors.length]} />
                ))
            }
          </Card>
        </div>

        {/* ── Row 2: 7-Day Trend (full-width) ── */}
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <SectionHeader title="Monthly Admission Trend" sub="Assigned resident admissions per day" />
            <div style={{ display: 'flex', align: 'center', gap: 6 }}>
              <ChevronUp size={14} color="#10B981" />
              <span style={{ fontSize: 11, color: '#10B981', fontWeight: 700 }}>
                {monthlyTrend.values.reduce((a, b) => a + b, 0)} total this month
              </span>
            </div>
          </div>
          <TrendLine values={monthlyTrend.values} labels={monthlyTrend.labels} />
        </Card>

        {/* ── Row 3: Three tables ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>

          {/* High Priority */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#FFE4E6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={14} color="#F43F5E" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#0F172A' }}>High Priority</h3>
                <p style={{ margin: 0, fontSize: 10, color: '#94A3B8' }}>Declining residents</p>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#FFF5F5' }}>
                  {['Resident', 'Concern'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: '#64748B', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {highPriorityRows.length === 0
                  ? <tr><td colSpan={2} style={{ padding: '12px 10px', fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>No declining residents. ✓</td></tr>
                  : highPriorityRows.map((r) => (
                      <tr key={`hp_${r.id}`} style={{ borderBottom: '1px solid #FFF1F2' }}>
                        <td style={{ padding: '9px 10px', fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{r.full_name || 'Resident'}</td>
                        <td style={{ padding: '9px 10px', fontSize: 11, color: '#64748B' }}>{r.primary_concern || '—'}</td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </Card>

          {/* Recent Admissions */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={14} color="#6366F1" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#0F172A' }}>Recent Admissions</h3>
                <p style={{ margin: 0, fontSize: 10, color: '#94A3B8' }}>Latest admitted residents</p>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFF' }}>
                  {['Resident', 'Admitted'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: '#64748B', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentAdmissionsRows.map((r) => (
                  <tr key={`ra_${r.id}`} style={{ borderBottom: '1px solid #F8FAFC' }}>
                    <td style={{ padding: '9px 10px', fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{r.full_name || 'Resident'}</td>
                    <td style={{ padding: '9px 10px', fontSize: 11, color: '#64748B' }}>{String(r.admitted_at || '').slice(0, 10) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Concern Breakdown */}
          <Card>
            <SectionHeader title="Concern Breakdown" sub="Frequency by type" />
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFF' }}>
                  {['Concern', 'Count', 'Share'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: '#64748B', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {concernTableRows.length === 0
                  ? <tr><td colSpan={3} style={{ padding: '12px 10px', fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>No data yet.</td></tr>
                  : concernTableRows.map((r, i) => {
                      const total = concernTableRows.reduce((a, x) => a + x.count, 0) || 1;
                      return (
                        <tr key={`cb_${r.concern}`} style={{ borderBottom: '1px solid #F8FAFC' }}>
                          <td style={{ padding: '9px 10px', fontSize: 12, color: '#334155' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 8, height: 8, borderRadius: 2, background: concernColors[i % concernColors.length], display: 'inline-block' }} />
                              {r.concern}
                            </div>
                          </td>
                          <td style={{ padding: '9px 10px', fontSize: 12, fontWeight: 800, color: '#0F172A' }}>{r.count}</td>
                          <td style={{ padding: '9px 10px', fontSize: 11, color: '#64748B' }}>{Math.round((r.count / total) * 100)}%</td>
                        </tr>
                      );
                    })
                }
              </tbody>
            </table>
          </Card>
        </div>

        {/* ── Row 4: Full Resident Table ── */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <SectionHeader title="Assigned Residents" sub={`${assigned.length} active resident${assigned.length !== 1 ? 's' : ''} under your care`} />
            <div style={{ display: 'flex', gap: 6 }}>
              {['Improving','Stable','Declining'].map((s, i) => (
                <span key={s} style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                  background: [  '#D1FAE5','#DBEAFE','#FFE4E6'][i],
                  color: ['#065F46','#1E40AF','#9F1239'][i] }}>
                  {s} {[statusCounts.Improving, statusCounts.Stable, statusCounts.Declining][i]}
                </span>
              ))}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr style={{ background: '#F8FAFF' }}>
                  {['#', 'Resident Name', 'Primary Concern', 'Clinical Status', 'Progress'].map((h, i) => (
                    <th key={h} style={{ textAlign: 'left', padding: '11px 14px', color: '#64748B', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', borderBottom: '2px solid #EEF2FF', ...(i === 0 ? { width: 40 } : {}) }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assigned.length === 0
                  ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '32px 14px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                        No assigned residents found.
                      </td>
                    </tr>
                  )
                  : assigned.map((r, idx) => (
                    <tr key={r.id} style={{ background: idx % 2 === 0 ? '#fff' : '#FAFBFF' }}>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F1F5F9', fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>{idx + 1}</td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F1F5F9' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#E0E7FF,#C7D2FE)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: '#4338CA' }}>
                              {String(r.full_name || 'R').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>{r.full_name || 'Resident'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F1F5F9', fontSize: 12, color: '#475569' }}>
                        {r.primary_concern || '—'}
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F1F5F9' }}>
                        <StatusBadge status={r.clinical_status || r.status} />
                      </td>
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid #F1F5F9', minWidth: 130 }}>
                        <ProgressBar value={r.progress_percent ?? r.progress ?? 0} />
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </Card>

      </main>
    </div>
  );
}