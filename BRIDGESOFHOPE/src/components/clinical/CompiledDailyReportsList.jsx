import React from 'react';

/**
 * Read-only day-by-day render of daily report entries — either live `daily_reports` rows or
 * a `weekly_reports.compiled_daily_reports` snapshot (same field shape). Used by the nurse /
 * program Weekly Report tab preview and the admin weekly report modal.
 */
export default function CompiledDailyReportsList({ entries, emptyText = 'No daily reports for this week.' }) {
  const rows = Array.isArray(entries) ? entries.filter(Boolean) : [];
  if (rows.length === 0) {
    return <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>{emptyText}</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r, i) => {
        const parts = [
          ['Observations', r.observations],
          ['Assessment', r.assessment],
          ['Follow-up', r.follow_up],
          ['Notes', r.notes],
        ].filter(([, v]) => v && String(v).trim());
        return (
          <div
            key={`${r.report_date || 'day'}-${i}`}
            style={{ border: '1px solid #E9EDF7', borderRadius: 10, padding: '10px 12px', background: '#FAFBFF' }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1B2559', marginBottom: parts.length ? 6 : 0 }}>
              {r.report_date || 'Undated'}
              {r.author_role ? ` · ${r.author_role}` : ''}
            </div>
            {parts.map(([label, v]) => (
              <div key={label} style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#A3AED0' }}>
                  {label}:{' '}
                </span>
                <span style={{ fontSize: 12.5, color: '#2B3674', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{v}</span>
              </div>
            ))}
            {parts.length === 0 ? (
              <p style={{ fontSize: 12, color: '#94A3B8', margin: '4px 0 0' }}>No details recorded.</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
