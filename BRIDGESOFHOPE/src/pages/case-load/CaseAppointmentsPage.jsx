import React from 'react';
import { useCaseLoad } from './CaseLoadContext';
import ClmPageShell from './ClmPageShell';

export default function CaseAppointmentsPage() {
  const { loading, appointments } = useCaseLoad();

  return (
    <ClmPageShell
      title="Visitation appointments"
      lede="Requests and schedules for your assigned residents. Program/Admin approves final slots; visits are viewing-style until the in-person process is complete."
    >
      <div className="cl-card">
        {loading ? (
          <div style={{ color: '#64748b', fontSize: 13 }}>Loading appointments...</div>
        ) : appointments.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: 13 }}>No appointments found for your assigned residents.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#323D4E', color: 'white' }}>
                  {['Resident', 'Family', 'Status', 'Requested', 'Scheduled', 'Admin note'].map((h, i) => (
                    <th key={h} style={{ padding: '10px 12px', borderRight: i < 5 ? '1px solid #4B5563' : 'none', textAlign: 'left', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {appointments.map((a) => {
                  const requested = `${a.preferred_date || a.preferredDate || '—'} ${a.preferred_time || a.preferredTime || ''}`.trim();
                  const scheduled = `${a.confirmed_date || a.confirmedDate || '—'} ${a.confirmed_time || a.confirmedTime || ''}`.trim();
                  return (
                    <tr key={String(a.id)} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700 }}>{a.patient_name || a.patientName || 'Patient'}</td>
                      <td style={{ padding: '10px 12px' }}>{a.family_name || a.familyName || 'Family'}</td>
                      <td style={{ padding: '10px 12px' }}>{a.status || 'Requested'}</td>
                      <td style={{ padding: '10px 12px' }}>{requested}</td>
                      <td style={{ padding: '10px 12px' }}>{scheduled}</td>
                      <td style={{ padding: '10px 12px', color: '#475569' }}>{a.admin_note || a.adminNote || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ClmPageShell>
  );
}
