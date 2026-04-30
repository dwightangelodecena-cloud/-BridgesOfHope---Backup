import React from 'react';
import { useCaseLoad } from './CaseLoadContext';
import ClmPageShell from './ClmPageShell';

export default function CaseAppointmentsPage() {
  const { loading, appointments } = useCaseLoad();
  const pendingCount = appointments.filter((a) => {
    const st = String(a.status || '').toLowerCase();
    return !st || st === 'requested' || st === 'pending';
  }).length;

  return (
    <ClmPageShell
      title="Visitation appointments"
      lede="Requests and schedules for your assigned residents. Program/Admin approves final slots; visits are viewing-style until the in-person process is complete."
    >
      <div className="cl-hero">
        <p className="cl-hero-title">Appointment Coordination</p>
        <p className="cl-hero-sub">Track family visitation requests tied to your caseload and monitor scheduling outcomes from Program/Admin approvals.</p>
        <div className="cl-pill-row">
          <span className="cl-pill">{appointments.length} total requests</span>
          <span className="cl-pill">{pendingCount} pending</span>
        </div>
      </div>
      <div className="cl-card">
        {loading ? (
          <div style={{ color: '#64748b', fontSize: 13 }}>Loading appointments...</div>
        ) : appointments.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: 13 }}>No appointments found for your assigned residents.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="cl-table">
              <thead>
                <tr>
                  {['Resident', 'Family', 'Status', 'Requested', 'Scheduled', 'Admin note'].map((h, i) => (
                    <th key={h} style={{ borderRight: i < 5 ? '1px solid #4B5563' : 'none' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {appointments.map((a) => {
                  const requested = `${a.preferred_date || a.preferredDate || '—'} ${a.preferred_time || a.preferredTime || ''}`.trim();
                  const scheduled = `${a.confirmed_date || a.confirmedDate || '—'} ${a.confirmed_time || a.confirmedTime || ''}`.trim();
                  return (
                    <tr key={String(a.id)}>
                      <td style={{ fontWeight: 700 }}>{a.patient_name || a.patientName || 'Patient'}</td>
                      <td>{a.family_name || a.familyName || 'Family'}</td>
                      <td>{a.status || 'Requested'}</td>
                      <td>{requested}</td>
                      <td>{scheduled}</td>
                      <td style={{ color: '#475569' }}>{a.admin_note || a.adminNote || '—'}</td>
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
