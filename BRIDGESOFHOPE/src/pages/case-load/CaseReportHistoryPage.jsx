import React from 'react';
import { useCaseLoad } from './CaseLoadContext';
import ClmPageShell from './ClmPageShell';

export default function CaseReportHistoryPage() {
  const { allReportsFlat, patients } = useCaseLoad();

  return (
    <ClmPageShell
      title="CLM report history"
      lede={`All weekly CLM submissions stored in this browser for your caseload (${patients.length} resident${patients.length === 1 ? '' : 's'}), newest first.`}
    >
      <div className="cl-hero">
        <p className="cl-hero-title">Report Archive</p>
        <p className="cl-hero-sub">Review prior CLM submissions quickly before creating updates. This helps maintain narrative continuity across weeks.</p>
        <div className="cl-pill-row">
          <span className="cl-pill">{allReportsFlat.length} reports indexed</span>
        </div>
      </div>
      <div className="cl-card">
        {allReportsFlat.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: 13 }}>No CLM reports saved yet. Submit from Assigned residents.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="cl-table">
              <thead>
                <tr>
                  {['Resident', 'Week', 'Submitted', 'Summary preview'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allReportsFlat.map((r) => (
                  <tr key={r.id} style={{ verticalAlign: 'top' }}>
                    <td style={{ fontWeight: 700 }}>{r.patientName}</td>
                    <td>{r.weekNumber}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(r.submittedAt).toLocaleString('en-US')}</td>
                    <td style={{ color: '#475569', maxWidth: 420 }}>
                      {(r.summary || '').length > 180 ? `${(r.summary || '').slice(0, 180)}…` : (r.summary || '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ClmPageShell>
  );
}
