import React, { useMemo } from 'react';
import { ChevronLeft, Folder, Plus, FileText } from 'lucide-react';

/**
 * A patient's report "folders" — one card per care week (📁 Week N), Google-Drive style,
 * with Draft/Concluded status and the number of daily reports in that week. Plus the two
 * create actions (+ Add Daily Report / + Add Weekly Report). Week numbers are unlimited and
 * assigned automatically by the parent page.
 */
export default function PatientReportFolders({
  patient,
  weeklyRows = [],
  dailyCountsByWeek = {},
  addWeeklyTarget,
  currentWorkingWeek,
  loading = false,
  onBack,
  onOpenWeek,
  onAddDaily,
  onAddWeekly,
}) {
  const weeks = useMemo(() => {
    const set = new Set();
    for (const r of weeklyRows) if (r?.week_number != null) set.add(Number(r.week_number));
    for (const k of Object.keys(dailyCountsByWeek)) set.add(Number(k));
    if (currentWorkingWeek) set.add(Number(currentWorkingWeek));
    return [...set].filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  }, [weeklyRows, dailyCountsByWeek, currentWorkingWeek]);

  const weeklyByNum = useMemo(() => {
    const m = {};
    for (const r of weeklyRows) if (r?.week_number != null) m[Number(r.week_number)] = r;
    return m;
  }, [weeklyRows]);

  const addWeeklyLabel =
    addWeeklyTarget?.mode === 'open-draft'
      ? `Open Week ${addWeeklyTarget.week} draft`
      : `+ Add Weekly Report${addWeeklyTarget?.week ? ` (Week ${addWeeklyTarget.week})` : ''}`;

  return (
    <div className="prf-wrap">
      <style>{`
        .prf-wrap { width: 100%; }
        .prf-back {
          display: inline-flex; align-items: center; gap: 4px;
          background: none; border: none; cursor: pointer;
          font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 700; color: #64748B;
          padding: 4px 0; margin-bottom: 12px;
        }
        .prf-back:hover { color: #1B2559; }
        .prf-title { font-size: 22px; font-weight: 900; color: #1B2559; letter-spacing: -0.01em; }
        .prf-sub { font-size: 13px; color: #64748B; font-weight: 600; margin-top: 4px; }
        .prf-actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 20px 0 24px; }
        .prf-btn {
          display: inline-flex; align-items: center; gap: 7px;
          border-radius: 12px; padding: 11px 18px;
          font-size: 13px; font-weight: 800; cursor: pointer; font-family: 'Inter', sans-serif;
          transition: filter .15s, transform .15s;
        }
        .prf-btn:hover { transform: translateY(-1px); }
        .prf-btn--daily { background: #FFF0EB; color: #F54E25; border: 1px solid #FFD9CC; }
        .prf-btn--weekly { background: linear-gradient(145deg,#F54E25,#EA5A37); color: #fff; border: none; box-shadow: 0 8px 18px rgba(245,78,37,.24); }
        .prf-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
          gap: 14px;
        }
        .prf-folder {
          text-align: left; cursor: pointer; font-family: 'Inter', sans-serif;
          background: #fff; border: 1px solid #E9EDF7; border-radius: 16px;
          padding: 18px 16px;
          transition: transform .15s, box-shadow .15s, border-color .15s;
        }
        .prf-folder:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(15,23,42,.10); border-color: #C7D2FE; }
        .prf-folder-icon { color: #F59E0B; }
        .prf-folder-week { font-size: 16px; font-weight: 900; color: #1B2559; margin-top: 10px; }
        .prf-folder-meta { font-size: 11px; color: #94A3B8; font-weight: 700; margin-top: 4px; }
        .prf-pill {
          display: inline-block; margin-top: 8px;
          font-size: 10px; font-weight: 800; border-radius: 999px; padding: 3px 9px;
        }
        .prf-pill--draft { color: #92400E; background: #FEF3C7; border: 1px solid #FCD34D; }
        .prf-pill--concluded { color: #15803D; background: #DCFCE7; border: 1px solid #86EFAC; }
        .prf-pill--none { color: #64748B; background: #F1F5F9; border: 1px solid #E2E8F0; }
        .prf-empty { padding: 34px 16px; text-align: center; color: #94A3B8; font-size: 13px; font-weight: 600; }
      `}</style>

      <button type="button" className="prf-back" onClick={onBack}>
        <ChevronLeft size={16} /> All patients
      </button>

      <div className="prf-title">{patient?.name || 'Resident'}</div>
      <div className="prf-sub">{patient?.primaryConcern || 'No primary concern recorded'}</div>

      <div className="prf-actions">
        <button type="button" className="prf-btn prf-btn--daily" onClick={() => onAddDaily?.(currentWorkingWeek)}>
          <Plus size={15} /> Add Daily Report{currentWorkingWeek ? ` (Week ${currentWorkingWeek})` : ''}
        </button>
        <button type="button" className="prf-btn prf-btn--weekly" onClick={() => onAddWeekly?.()}>
          <FileText size={15} /> {addWeeklyLabel}
        </button>
      </div>

      {loading ? (
        <div className="prf-empty">Loading reports…</div>
      ) : weeks.length === 0 ? (
        <div className="prf-empty">No reports yet. Use the buttons above to start Week 1.</div>
      ) : (
        <div className="prf-grid">
          {weeks.map((n) => {
            const wr = weeklyByNum[n];
            const dailyCount = dailyCountsByWeek[n] || 0;
            const status = !wr ? 'none' : wr.concluded_at ? 'concluded' : 'draft';
            return (
              <button key={n} type="button" className="prf-folder" onClick={() => onOpenWeek?.(n)}>
                <Folder size={26} className="prf-folder-icon" />
                <div className="prf-folder-week">Week {n} Report</div>
                <div className="prf-folder-meta">
                  {dailyCount} daily {dailyCount === 1 ? 'report' : 'reports'}
                  {wr?.report_date ? ` · ${wr.report_date}` : ''}
                </div>
                <span className={`prf-pill prf-pill--${status}`}>
                  {status === 'concluded' ? 'Concluded' : status === 'draft' ? 'Draft' : 'No weekly report'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
