import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BedDouble,
  UserPlus,
  LogOut,
  AlertTriangle,
  Sparkles,
  Activity,
  ChevronDown,
  CheckCircle2,
  Circle,
  BarChart3,
  Database,
  RefreshCw,
  ExternalLink,
  CalendarDays,
} from 'lucide-react';
import { computePredictiveInsights } from '@/lib/predictiveAnalytics';
import { fetchPredictiveFromSupabase } from '@/lib/fetchPredictiveFromSupabase';
import { APP_DATA_REFRESH } from '@/lib/appDataRefresh';

const RISK_STYLES = {
  low: { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d', label: 'Low risk' },
  medium: { bg: '#fffbeb', border: '#fde68a', color: '#b45309', label: 'Watch' },
  high: { bg: '#fff7ed', border: '#fed7aa', color: '#c2410c', label: 'High' },
  critical: { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c', label: 'Critical' },
};

const CONFIDENCE_STYLES = {
  high: { bg: '#f0fdf4', border: '#86efac', color: '#15803d' },
  medium: { bg: '#fffbeb', border: '#fcd34d', color: '#b45309' },
  low: { bg: '#f8fafc', border: '#cbd5e1', color: '#475569' },
};

function TrendIcon({ trend }) {
  if (trend === 'Rising') return <TrendingUp size={14} />;
  if (trend === 'Declining') return <TrendingDown size={14} />;
  return <Minus size={14} />;
}

function Sparkline({ values, capacity, large = false }) {
  const w = large ? 640 : 280;
  const h = large ? 64 : 40;
  const max = Math.max(capacity, ...(values || []), 1);
  const pts = (values || []).map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * w;
    const y = h - (v / max) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const capY = h - (capacity / max) * (h - 4) - 2;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <line x1="0" y1={capY} x2={w} y2={capY} stroke="#fecaca" strokeWidth="1" strokeDasharray="4 3" />
      {pts.length > 1 ? (
        <polyline fill="none" stroke="#F54E25" strokeWidth="2" strokeLinejoin="round" points={pts.join(' ')} />
      ) : null}
    </svg>
  );
}

function WeeklyBars({ values, tall = false, matchDischarge = false }) {
  const max = Math.max(...(values || []), 1);
  const minBar = matchDischarge ? 12 : 6;
  return (
    <div
      className={[
        'predict-weekly-bars',
        tall ? 'predict-weekly-bars--tall' : '',
        matchDischarge ? 'predict-weekly-bars--match-discharge' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden
    >
      {(values || []).map((n, i) => (
        <div
          key={i}
          className="predict-weekly-bar"
          style={{ height: `${Math.max(minBar, (n / max) * 100)}%` }}
          title={`Week ${i + 1}: ${n} requests`}
        />
      ))}
    </div>
  );
}

function DischargeDayBars({ days }) {
  const max = Math.max(...(days || []).map((d) => d.estimated), 0.1);
  return (
    <div className="predict-discharge-week" aria-hidden>
      {(days || []).map((d) => (
        <div key={d.dateStr} className={`predict-discharge-day${d.isToday ? ' predict-discharge-day--today' : ''}`}>
          <div
            className="predict-discharge-day-bar"
            style={{ height: `${Math.max(12, (d.estimated / max) * 100)}%` }}
            title={`${d.estimated} possible`}
          />
          <span className="predict-discharge-day-label">{d.dayLabel}</span>
          <span className="predict-discharge-day-val">{d.estimated}</span>
        </div>
      ))}
    </div>
  );
}

function CompactConfidence({ confidence, dataHealth, weeklyHistory, programMix, dailyDischarge, open, onToggle }) {
  const style = CONFIDENCE_STYLES[confidence.level] || CONFIDENCE_STYLES.low;
  const programs = Object.entries(programMix || {}).sort((a, b) => b[1] - a[1]);
  const discharge = dailyDischarge || {};

  return (
    <details className="predict-confidence-compact" open={open} onToggle={(e) => onToggle?.(e.target.open)}>
      <summary
        className="predict-confidence-summary"
        style={{ background: style.bg, borderColor: style.border, color: style.color }}
      >
        <Sparkles size={14} />
        <span>
          {confidence.label} · {confidence.score}%
        </span>
        <span className="predict-confidence-summary-meta">
          {dataHealth.patientsInCare} in care · {dataHealth.weeklyReportCount} reports · ~
          {discharge.todayEstimate ?? 0} possible discharge today
        </span>
        <ChevronDown size={14} className="predict-confidence-chevron" />
      </summary>
      <div className="predict-confidence-body">
        <div className="predict-confidence-col predict-confidence-col--factors">
          <div className="predict-col-title">Confidence factors</div>
          <ul className="predict-confidence-factors">
            {(confidence.factors || []).map((f) => (
              <li key={f.id} className="predict-confidence-factor">
                <span className="predict-confidence-factor-icon">
                  {f.met ? <CheckCircle2 size={18} color="#16a34a" /> : <Circle size={18} color="#94a3b8" />}
                </span>
                <div className="predict-factor-body">
                  <div className="predict-factor-row">
                    <span className="predict-factor-label">{f.label}</span>
                    <span className="predict-factor-pct">{f.progress}%</span>
                  </div>
                  <div className="predict-confidence-meter">
                    <div className="predict-confidence-meter-fill" style={{ width: `${f.progress}%` }} />
                  </div>
                  <div className="predict-factor-detail">{f.detail}</div>
                </div>
              </li>
            ))}
          </ul>
          <div className="predict-data-health">
            <span>{dataHealth.occupancyDays}d occupancy history</span>
            <span>{dataHealth.admissionWeeksActive} active weeks</span>
            <span>{dataHealth.patientsInCare} residents in care</span>
          </div>
        </div>
        <div className="predict-confidence-col predict-confidence-col--charts">
          <div className="predict-chart-block predict-chart-panel predict-chart-panel--admissions">
            <div className="predict-col-title"><BarChart3 size={14} color="#2563eb" /> 12-week admissions</div>
            <WeeklyBars values={weeklyHistory} tall matchDischarge />
          </div>
          {programs.length > 0 ? (
            <div className="predict-chart-block predict-chart-panel predict-chart-panel--mix">
              <div className="predict-col-title">In-care program mix</div>
              <ul className="predict-program-mix">
                {programs.map(([name, count]) => (
                  <li key={name}><span>{name}</span><strong>{count}</strong></li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <div className="predict-confidence-col predict-confidence-col--discharge">
          <div className="predict-col-title"><CalendarDays size={14} color="#0f766e" /> Possible discharges (daily)</div>
          <div className="predict-discharge-hero">
            <div className="predict-discharge-daily-value">{discharge.todayEstimate ?? 0}</div>
            <div>
              <div className="predict-discharge-daily-label">estimated today</div>
              <div className="predict-discharge-daily-sub">
                ~{discharge.perDayAverage ?? 0}/day avg
                {discharge.pendingCount > 0 ? ` · ${discharge.pendingCount} pending` : ''}
              </div>
            </div>
          </div>
          <DischargeDayBars days={discharge.next7Days} />
          <p className="predict-discharge-note">Next 7 days — typical stay, recent discharges, and pending requests.</p>
          {discharge.candidates?.length > 0 ? (
            <ul className="predict-discharge-candidates">
              {discharge.candidates.map((c) => (
                <li key={c.id}>
                  <span className="predict-discharge-candidate-name">{c.name}</span>
                  <span className="predict-discharge-candidate-meta">
                    {c.hasPending ? 'Pending · ' : ''}{c.probability}% likely · {c.stayDays}d stay
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="predict-discharge-empty">No residents flagged as likely discharge today.</p>
          )}
        </div>
      </div>
    </details>
  );
}

export default function AdminPredictiveAnalytics({
  patients: patientsProp = [],
  admissionRequests: admissionRequestsProp = [],
  pendingAdmissions: pendingAdmissionsProp = [],
  pendingDischarges: pendingDischargesProp = [],
  weeklyReports: weeklyReportsProp = [],
  bedCapacity = 50,
}) {
  const [live, setLive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confidenceOpen, setConfidenceOpen] = useState(true);

  const loadFromSupabase = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPredictiveFromSupabase();
      setLive(data);
    } catch (err) {
      console.warn('[predictive] Supabase load failed', err?.message || err);
      setError(err?.message || 'Could not load from Supabase');
      setLive(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFromSupabase();
    const onRefresh = () => void loadFromSupabase();
    window.addEventListener(APP_DATA_REFRESH, onRefresh);
    return () => window.removeEventListener(APP_DATA_REFRESH, onRefresh);
  }, [loadFromSupabase]);

  const patients = live?.patients ?? patientsProp;
  const admissionRequests = live?.admissionRequests ?? admissionRequestsProp;
  const pendingAdmissions = live?.pendingAdmissions ?? pendingAdmissionsProp;
  const pendingDischarges = live?.pendingDischarges ?? pendingDischargesProp;
  const weeklyReports = live?.weeklyReports ?? weeklyReportsProp;
  const dataSource = live?.source === 'supabase' ? 'supabase' : error ? 'fallback' : 'props';

  const insights = useMemo(
    () =>
      computePredictiveInsights({
        patients,
        admissionRequests,
        pendingAdmissions,
        pendingDischarges,
        weeklyReports,
        bedCapacity,
      }),
    [patients, admissionRequests, pendingAdmissions, pendingDischarges, weeklyReports, bedCapacity],
  );

  const riskStyle = RISK_STYLES[insights.capacity.risk] || RISK_STYLES.low;

  const capacityTimelineText = () => {
    const parts = [];
    if (insights.capacity.daysTo90Pct != null) parts.push(`~${insights.capacity.daysTo90Pct}d to 90%`);
    if (insights.capacity.daysToFull != null) parts.push(`~${insights.capacity.daysToFull}d to full`);
    if (!parts.length) return insights.occupancy.trend === 'Stable' ? 'Flat trend' : 'No breach projected';
    return parts.join(' · ');
  };

  const syncedLabel =
    dataSource === 'supabase' && live?.fetchedAt
      ? `Synced ${new Date(live.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : error
        ? 'Using dashboard cache'
        : null;

  return (
    <section className="predict-section predict-section--compact" aria-label="Predictive analytics">
      <style>{`
        .predict-section--compact { margin-bottom: 20px; width: 100%; }
        .predict-head {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }
        .predict-title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .predict-title { font-size: 18px; font-weight: 900; color: #0f172a; margin: 0; }
        .predict-live-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 4px 8px;
          border-radius: 999px;
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }
        .predict-live-badge--fallback { background: #fffbeb; color: #b45309; border-color: #fde68a; }
        .predict-refresh-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px 6px;
          border-radius: 6px;
        }
        .predict-refresh-btn:hover { background: #f1f5f9; color: #0f172a; }
        .predict-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          width: 100%;
        }
        @media (max-width: 800px) { .predict-grid { grid-template-columns: 1fr; } }
        .predict-card {
          background: #fff;
          border: 1px solid #e8ecf4;
          border-radius: 16px;
          padding: 20px 22px;
          box-shadow: 0 6px 20px rgba(27, 37, 89, 0.06);
          min-width: 0;
          min-height: 128px;
        }
        .predict-card--full {
          grid-column: 1 / -1;
          min-height: 168px;
          padding: 22px 26px;
        }
        .predict-card--metric {
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          min-height: 140px;
        }
        .predict-card-label {
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }
        .predict-card-value {
          font-size: 36px;
          font-weight: 900;
          color: #0f172a;
          line-height: 1.05;
        }
        .predict-card--full .predict-card-value { font-size: 44px; }
        .predict-card-value-suffix {
          font-size: 22px;
          font-weight: 700;
          color: #64748b;
        }
        .predict-card-sub {
          font-size: 13px;
          color: #64748b;
          margin-top: 10px;
          line-height: 1.45;
          font-weight: 500;
        }
        .predict-risk-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 800;
          padding: 8px 14px;
          border-radius: 999px;
          margin-top: 16px;
        }
        .predict-occupancy-row {
          display: grid;
          grid-template-columns: minmax(220px, 300px) 1fr;
          gap: 28px;
          align-items: center;
          width: 100%;
        }
        @media (max-width: 700px) {
          .predict-occupancy-row { grid-template-columns: 1fr; }
        }
        .predict-occupancy-chart {
          width: 100%;
          min-height: 64px;
          max-width: none;
        }
        .predict-confidence-compact {
          grid-column: 1 / -1;
          border: 1px solid #e8ecf4;
          border-radius: 12px;
          background: #fff;
          overflow: hidden;
        }
        .predict-confidence-summary {
          list-style: none;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 800;
          border: 1px solid;
          border-radius: 12px;
        }
        .predict-confidence-summary::-webkit-details-marker { display: none; }
        .predict-confidence-summary-meta {
          margin-left: auto;
          font-size: 11px;
          font-weight: 600;
          opacity: 0.85;
        }
        .predict-confidence-chevron { margin-left: 4px; transition: transform 0.2s; }
        details[open] .predict-confidence-chevron { transform: rotate(180deg); }
        .predict-confidence-body {
          padding: 16px 20px 18px;
          border-top: 1px solid #f1f5f9;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 20px;
          width: 100%;
          align-items: stretch;
        }
        @media (max-width: 1000px) { .predict-confidence-body { grid-template-columns: 1fr; } }
        .predict-col-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
        .predict-confidence-col { min-width: 0; display: flex; flex-direction: column; gap: 14px; }
        .predict-confidence-col--charts { min-height: 100%; }
        .predict-confidence-col--discharge {
          background: #f8fafc;
          border: 1px solid #e8ecf4;
          border-radius: 14px;
          padding: 16px 18px;
        }
        .predict-chart-panel {
          background: #f8fafc;
          border: 1px solid #e8ecf4;
          border-radius: 14px;
          padding: 16px 18px;
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .predict-chart-panel--admissions { min-height: 180px; }
        .predict-chart-panel--mix { flex: 1; min-height: 140px; }
        .predict-confidence-factors { list-style: none; margin: 0 0 12px; padding: 0; display: flex; flex-direction: column; gap: 10px; }
        .predict-confidence-factor { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; background: #f8fafc; border-radius: 10px; border: 1px solid #f1f5f9; }
        .predict-factor-body { flex: 1; min-width: 0; }
        .predict-factor-row { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
        .predict-factor-label { font-size: 12px; font-weight: 700; color: #1e293b; }
        .predict-factor-pct { font-size: 12px; font-weight: 800; color: #64748b; }
        .predict-factor-detail { font-size: 10px; color: #94a3b8; margin-top: 4px; }
        .predict-confidence-meter { height: 6px; background: #e2e8f0; border-radius: 99px; overflow: hidden; }
        .predict-confidence-meter-fill { height: 100%; background: linear-gradient(90deg, #7c3aed, #F54E25); border-radius: 99px; }
        .predict-chart-block { margin-bottom: 0; flex: 1; display: flex; flex-direction: column; }
        .predict-weekly-bars {
          display: flex;
          align-items: flex-end;
          gap: 6px;
          width: 100%;
          flex: 1;
          min-height: 88px;
        }
        .predict-weekly-bars--tall,
        .predict-weekly-bars--match-discharge {
          width: 100%;
          height: 88px;
          max-width: 100%;
        }
        .predict-weekly-bar {
          flex: 1;
          min-width: 10px;
          max-width: 48px;
          background: linear-gradient(180deg, #60a5fa, #2563eb);
          border-radius: 4px 4px 2px 2px;
        }
        .predict-program-mix { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .predict-program-mix li { display: flex; justify-content: space-between; font-size: 14px; color: #475569; padding: 10px 0; border-bottom: 1px solid #e8ecf4; }
        .predict-program-mix strong { color: #0f172a; font-size: 18px; font-weight: 900; }
        .predict-data-health { display: flex; flex-wrap: wrap; gap: 8px; font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
        .predict-data-health span { background: #f1f5f9; padding: 4px 8px; border-radius: 6px; }
        .predict-discharge-hero { display: flex; align-items: center; gap: 16px; margin-bottom: 14px; }
        .predict-discharge-daily-value { font-size: 42px; font-weight: 900; color: #0f766e; line-height: 1; }
        .predict-discharge-daily-label { font-size: 13px; font-weight: 800; color: #0f172a; }
        .predict-discharge-daily-sub { font-size: 11px; color: #64748b; margin-top: 4px; }
        .predict-discharge-week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; height: 88px; align-items: end; margin-bottom: 10px; }
        .predict-discharge-day { display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; gap: 4px; }
        .predict-discharge-day--today .predict-discharge-day-bar { background: linear-gradient(180deg, #34d399, #0f766e); }
        .predict-discharge-day-bar { width: 100%; max-width: 36px; min-height: 8px; background: linear-gradient(180deg, #6ee7b7, #14b8a6); border-radius: 4px 4px 2px 2px; }
        .predict-discharge-day-label { font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; }
        .predict-discharge-day-val { font-size: 11px; font-weight: 800; color: #0f766e; }
        .predict-discharge-note { font-size: 10px; color: #94a3b8; margin: 0 0 10px; line-height: 1.4; }
        .predict-discharge-candidates { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .predict-discharge-candidate-name { display: block; font-size: 12px; font-weight: 800; color: #0f172a; }
        .predict-discharge-candidate-meta { font-size: 10px; color: #64748b; }
        .predict-discharge-empty { font-size: 11px; color: #94a3b8; margin: 0; }
        .predict-confidence-factors--compact {
          list-style: none;
          margin: 10px 0 8px;
          padding: 0;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 6px;
        }
        .predict-confidence-factor {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
        }
        .predict-factor-label { flex: 1; color: #334155; font-weight: 600; }
        .predict-factor-pct { font-weight: 800; color: #64748b; }
        .predict-confidence-inline {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          align-items: flex-end;
        }
        .predict-mini-label {
          font-size: 10px;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 4px;
          margin-bottom: 4px;
        }
        .predict-program-mix--compact { list-style: none; margin: 0; padding: 0; font-size: 11px; }
        .predict-program-mix--compact li { display: flex; justify-content: space-between; gap: 12px; color: #475569; }
        .predict-data-health--compact { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
        .predict-residents-card {
          grid-column: 1 / -1;
          padding: 18px 22px 20px;
        }
        .predict-residents-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
        }
        .predict-residents-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 700;
          color: #F54E25;
          text-decoration: none;
        }
        .predict-residents-link:hover { text-decoration: underline; }
        .predict-residents-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 12px;
          font-size: 13px;
        }
        .predict-residents-table th {
          text-align: left;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          color: #94a3b8;
          padding: 10px 12px;
          border-bottom: 1px solid #e8ecf4;
        }
        .predict-residents-table td {
          padding: 12px;
          border-bottom: 1px solid #f1f5f9;
          color: #334155;
          vertical-align: top;
        }
        .predict-residents-table tr:last-child td { border-bottom: none; }
        .predict-resident-name { font-weight: 800; color: #0f172a; }
        .predict-resident-meta { font-size: 10px; color: #94a3b8; margin-top: 2px; }
        .predict-score-pill {
          display: inline-block;
          font-size: 10px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 6px;
          background: #fff7ed;
          color: #c2410c;
        }
        .predict-empty { font-size: 12px; color: #64748b; padding: 10px 0; }
        .predict-disclaimer { font-size: 10px; color: #94a3b8; margin-top: 8px; line-height: 1.4; grid-column: 1 / -1; }
        .predict-loading { font-size: 11px; color: #94a3b8; }
      `}</style>

      <div className="predict-head">
        <div className="predict-title-row">
          <h2 className="predict-title">Predictive analytics</h2>
          {dataSource === 'supabase' ? (
            <span className="predict-live-badge">
              <Database size={12} /> Live · Supabase
            </span>
          ) : (
            <span className="predict-live-badge predict-live-badge--fallback">Cached data</span>
          )}
          {loading ? <span className="predict-loading">Updating…</span> : null}
          {syncedLabel ? (
            <button type="button" className="predict-refresh-btn" onClick={() => void loadFromSupabase()} aria-label="Refresh forecast">
              <RefreshCw size={12} /> {syncedLabel}
            </button>
          ) : null}
        </div>
      </div>

      <div className="predict-grid">
        <article className="predict-card predict-card--full">
          <div className="predict-card-label">
            <BedDouble size={16} color="#F54E25" /> Occupancy
          </div>
          <div className="predict-occupancy-row">
            <div>
              <div className="predict-card-value">
                {insights.currentOccupancy}
                <span className="predict-card-value-suffix"> / {insights.bedCapacity}</span>
              </div>
              <div className="predict-card-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <TrendIcon trend={insights.occupancy.trend} />
                {insights.occupancy.trend} · 14d ~{insights.occupancy.projected14d} · 30d ~{insights.occupancy.projected30d}
              </div>
            </div>
            <div className="predict-occupancy-chart">
              <Sparkline values={insights.occupancy.sparkline} capacity={insights.bedCapacity} large />
            </div>
          </div>
          <div className="predict-risk-pill" style={{ background: riskStyle.bg, border: `1px solid ${riskStyle.border}`, color: riskStyle.color }}>
            <AlertTriangle size={14} />
            {riskStyle.label} — {insights.capacity.message}
          </div>
        </article>

        <article className="predict-card predict-card--metric">
          <div className="predict-card-label"><UserPlus size={16} color="#2563eb" /> Admissions (30d)</div>
          <div className="predict-card-value">{insights.admissions.projected30d}</div>
          <p className="predict-card-sub">~{insights.admissions.avgPerWeek}/wk avg{insights.discharges.pendingAdmissions > 0 ? ` · ${insights.discharges.pendingAdmissions} pending` : ''}</p>
        </article>

        <article className="predict-card predict-card--metric">
          <div className="predict-card-label"><LogOut size={16} color="#0f766e" /> Discharges</div>
          <div className="predict-card-value">{insights.discharges.pending}</div>
          <p className="predict-card-sub">
            {insights.discharges.estDaysToClearPending > 0 ? `~${insights.discharges.estDaysToClearPending}d to clear · ` : ''}
            stay {insights.discharges.avgStayDays}d avg
          </p>
        </article>

        <article className="predict-card predict-card--metric">
          <div className="predict-card-label"><Activity size={16} color="#7c3aed" /> Capacity</div>
          <div className="predict-card-value">{insights.currentOccupancyPct}%</div>
          <p className="predict-card-sub">{capacityTimelineText()}</p>
        </article>

        <CompactConfidence
          confidence={insights.confidence}
          dataHealth={insights.dataHealth}
          weeklyHistory={insights.admissions.weeklyHistory}
          programMix={insights.inCareProgramMix}
          dailyDischarge={insights.dailyDischarge}
          open={confidenceOpen}
          onToggle={setConfidenceOpen}
        />

        <article className="predict-card predict-residents-card">
          <div className="predict-residents-head">
            <div className="predict-card-label" style={{ marginBottom: 0 }}>
              <AlertTriangle size={12} color="#ea580c" /> Forecast residents (follow-up)
            </div>
            <Link to="/admin-patient-database" className="predict-residents-link">
              Open patient database <ExternalLink size={12} />
            </Link>
          </div>
          {insights.atRiskResidents.length > 0 ? (
            <table className="predict-residents-table">
              <thead>
                <tr>
                  <th>Resident</th>
                  <th>Room / status</th>
                  <th>Signals</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {insights.atRiskResidents.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="predict-resident-name">{r.name}</div>
                      <div className="predict-resident-meta">{r.stayDays}d in care{r.daysSinceReport != null ? ` · report ${r.daysSinceReport}d ago` : ' · no report'}</div>
                    </td>
                    <td>
                      {r.room ? `Rm ${r.room}` : '—'}
                      {r.clinicalStatus ? <div className="predict-resident-meta">{r.clinicalStatus}</div> : null}
                    </td>
                    <td style={{ fontSize: 11, color: '#64748b' }}>{r.reasons.join(' · ')}</td>
                    <td><span className="predict-score-pill">{r.score}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="predict-empty">No in-care residents matched follow-up rules (Supabase clinical + weekly report data).</p>
          )}
        </article>

        <p className="predict-disclaimer">
          Forecasts use linear trends from live Supabase patients, admission requests, and weekly reports. Planning aid only — not clinical advice.
        </p>
      </div>
    </section>
  );
}
