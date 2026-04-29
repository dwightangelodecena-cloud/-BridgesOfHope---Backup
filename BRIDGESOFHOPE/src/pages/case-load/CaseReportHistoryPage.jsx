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
      <div className="cl-card">
        {allReportsFlat.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: 13 }}>No CLM reports saved yet. Submit from Assigned residents.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#323D4E', color: 'white' }}>
                  {['Resident', 'Week', 'Submitted', 'Summary preview'].map((h) => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allReportsFlat.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #F1F5F9', verticalAlign: 'top' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>{r.patientName}</td>
                    <td style={{ padding: '10px 12px' }}>{r.weekNumber}</td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{new Date(r.submittedAt).toLocaleString('en-US')}</td>
                    <td style={{ padding: '10px 12px', color: '#475569', maxWidth: 420 }}>
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
