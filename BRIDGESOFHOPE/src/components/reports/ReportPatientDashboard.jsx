import React, { useMemo, useState } from 'react';
import { Search, FolderOpen } from 'lucide-react';

/** First-1-or-2 initials from a name. */
function initials(name) {
  if (!name || !String(name).trim()) return '?';
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

function progressFill(pct) {
  if (pct >= 70) return '#10B981';
  if (pct >= 40) return '#F59E0B';
  return '#F43F5E';
}

/**
 * Patient-first entry point for the nurse / program reports pages: a search bar over the
 * staffer's assigned residents rendered as cards, each showing primary concern, clinical
 * progress, and a reporting summary (weekly / daily counts, weeks concluded vs elapsed).
 */
export default function ReportPatientDashboard({
  title = 'Reports',
  subtitle = '',
  patients = [],
  statsByPatient = {},
  loading = false,
  onOpenPatient,
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) =>
      `${p.name || ''} ${p.primaryConcern || ''}`.toLowerCase().includes(q)
    );
  }, [patients, query]);

  return (
    <div className="rpd-wrap">
      <style>{`
        .rpd-wrap { width: 100%; }
        .rpd-head { margin-bottom: 18px; }
        .rpd-head h2 { font-size: 20px; font-weight: 900; color: #1B2559; letter-spacing: -0.01em; }
        .rpd-head p { font-size: 13px; color: #64748B; font-weight: 600; margin-top: 4px; }
        .rpd-search { position: relative; max-width: 420px; margin: 14px 0 22px; }
        .rpd-search input {
          width: 100%; box-sizing: border-box;
          padding: 11px 12px 11px 38px;
          border: 1px solid #E5ECFF; border-radius: 12px;
          font-size: 13px; font-weight: 600; font-family: 'Inter', sans-serif;
          color: #1B2559; background: #FCFDFF; outline: none;
          transition: border-color .15s, box-shadow .15s;
        }
        .rpd-search input::placeholder { color: #A3AED0; font-weight: 400; }
        .rpd-search input:focus { border-color: #8EA2FF; box-shadow: 0 0 0 3px rgba(99,102,241,.12); background: #fff; }
        .rpd-search svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #A3AED0; }
        .rpd-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }
        .rpd-card {
          text-align: left;
          background: linear-gradient(180deg, #FFFFFF 0%, #FCFDFF 100%);
          border: 1px solid #E9EDF7; border-radius: 18px;
          padding: 18px; cursor: pointer; font-family: 'Inter', sans-serif;
          box-shadow: 0 6px 18px rgba(15,23,42,.04);
          transition: transform .15s, box-shadow .15s, border-color .15s;
        }
        .rpd-card:hover { transform: translateY(-2px); box-shadow: 0 14px 32px rgba(15,23,42,.10); border-color: #C7D2FE; }
        .rpd-card-top { display: flex; align-items: center; gap: 12px; }
        .rpd-avatar {
          width: 44px; height: 44px; border-radius: 13px; flex-shrink: 0;
          background: linear-gradient(135deg,#E0E7FF,#C7D2FE); color: #3730A3;
          font-weight: 800; font-size: 14px;
          display: flex; align-items: center; justify-content: center;
        }
        .rpd-name { font-size: 15px; font-weight: 800; color: #1B2559; line-height: 1.2; }
        .rpd-concern { font-size: 12px; color: #64748B; margin-top: 3px; font-weight: 600; }
        .rpd-prog-row { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
        .rpd-prog-track { flex: 1; height: 6px; background: #F1F5F9; border-radius: 999px; overflow: hidden; }
        .rpd-prog-fill { height: 100%; border-radius: 999px; }
        .rpd-prog-pct { font-size: 11px; font-weight: 800; color: #475569; min-width: 30px; text-align: right; }
        .rpd-reports { font-size: 11px; font-weight: 700; color: #94A3B8; margin-top: 10px; letter-spacing: .01em; }
        .rpd-empty { padding: 40px 16px; text-align: center; color: #94A3B8; font-size: 13px; font-weight: 600; }
        @media (max-width: 640px) { .rpd-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div className="rpd-head">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>

      <div className="rpd-search">
        <Search size={16} />
        <input
          type="text"
          placeholder="Search residents by name or concern…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="rpd-empty">Loading assigned residents…</div>
      ) : patients.length === 0 ? (
        <div className="rpd-empty">
          No assigned residents yet. Once an admission is approved and you are assigned, the resident appears here.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rpd-empty">No residents match &ldquo;{query}&rdquo;.</div>
      ) : (
        <div className="rpd-grid">
          {filtered.map((p) => {
            const s = statsByPatient[p.id] || {};
            const pct = Math.max(0, Math.min(100, Number(p.progressPercent) || 0));
            const weeksLine = [
              `${s.weeklyCount ?? 0} weekly`,
              `${s.dailyCount ?? 0} daily`,
              s.weeksElapsed ? `wk ${s.concludedCount ?? 0}/${s.weeksElapsed}` : null,
            ]
              .filter(Boolean)
              .join('  ·  ');
            return (
              <button key={p.id} type="button" className="rpd-card" onClick={() => onOpenPatient?.(p.id)}>
                <div className="rpd-card-top">
                  <div className="rpd-avatar">{initials(p.name)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="rpd-name">{p.name || 'Resident'}</div>
                    <div className="rpd-concern">{p.primaryConcern || 'No primary concern recorded'}</div>
                  </div>
                </div>
                <div className="rpd-prog-row">
                  <div className="rpd-prog-track">
                    <div className="rpd-prog-fill" style={{ width: `${pct}%`, background: progressFill(pct) }} />
                  </div>
                  <span className="rpd-prog-pct">{pct}%</span>
                </div>
                <div className="rpd-reports">
                  <FolderOpen size={11} style={{ verticalAlign: '-1px', marginRight: 5 }} />
                  {weeksLine}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
