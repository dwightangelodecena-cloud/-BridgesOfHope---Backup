import React from 'react';
import { useCaseLoad } from './CaseLoadContext';
import ClmPageShell from './ClmPageShell';

export default function CaseResidentsPage() {
  const {
    loading,
    patients,
    selectedPatientId,
    setSelectedPatientId,
    selectedPatient,
    selectedReports,
    reportForm,
    setReportForm,
    saveClmReport,
  } = useCaseLoad();

  return (
    <ClmPageShell
      title="Assigned residents & CLM weekly report"
      lede="Select a resident, then complete the weekly CLM fields for guardian consolidation (social case study, psych observation, interventions, summary)."
    >
      <div className="cl-grid cl-two-col">
        <div className="cl-card">
              <div className="cl-card-title">Assigned residents</div>
          {loading ? (
            <div style={{ color: '#64748b', fontSize: 13 }}>Loading residents...</div>
          ) : patients.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: 13 }}>
              No assigned residents found for this CLM yet. Admin can assign in Patient Management using the Case Load Manager field.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {patients.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPatientId(String(p.id))}
                  style={{
                    textAlign: 'left',
                    border: `1px solid ${String(selectedPatientId) === String(p.id) ? '#F54E25' : '#E2E8F0'}`,
                    background: String(selectedPatientId) === String(p.id) ? '#FFF7ED' : '#fff',
                    borderRadius: 10,
                    padding: '10px 12px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#1B2559' }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{p.concern}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                    Program: {p.programStaff || 'Not assigned'} · Status: {p.clinicalStatus || 'Admitted'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

            <div className="cl-card">
              <div className="cl-card-title">CLM weekly report</div>
          {!selectedPatient ? (
            <div style={{ color: '#64748b', fontSize: 13 }}>Select a resident first.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <label className="cl-label">Resident</label>
                <div className="cl-input" style={{ background: '#F8FAFC', fontWeight: 700 }}>{selectedPatient.name}</div>
              </div>
              <div>
                <label className="cl-label">Week number</label>
                <input className="cl-input" type="number" min={1} value={reportForm.weekNumber} onChange={(e) => setReportForm((prev) => ({ ...prev, weekNumber: e.target.value }))} />
              </div>
              <div>
                <label className="cl-label">Social case study update</label>
                <textarea className="cl-textarea" value={reportForm.socialCaseStudy} onChange={(e) => setReportForm((prev) => ({ ...prev, socialCaseStudy: e.target.value }))} />
              </div>
              <div>
                <label className="cl-label">Psychological exam / observation</label>
                <textarea className="cl-textarea" value={reportForm.psychologicalExam} onChange={(e) => setReportForm((prev) => ({ ...prev, psychologicalExam: e.target.value }))} />
              </div>
              <div>
                <label className="cl-label">Behavior observation</label>
                <textarea className="cl-textarea" value={reportForm.behaviorObservation} onChange={(e) => setReportForm((prev) => ({ ...prev, behaviorObservation: e.target.value }))} />
              </div>
              <div>
                <label className="cl-label">Interventions</label>
                <textarea className="cl-textarea" value={reportForm.interventions} onChange={(e) => setReportForm((prev) => ({ ...prev, interventions: e.target.value }))} />
              </div>
              <div>
                <label className="cl-label">Accomplishments</label>
                <textarea className="cl-textarea" value={reportForm.accomplishments} onChange={(e) => setReportForm((prev) => ({ ...prev, accomplishments: e.target.value }))} />
              </div>
              <div>
                <label className="cl-label">Next plan</label>
                <textarea className="cl-textarea" value={reportForm.nextPlan} onChange={(e) => setReportForm((prev) => ({ ...prev, nextPlan: e.target.value }))} />
              </div>
              <div>
                <label className="cl-label">CLM summary (for guardian consolidation)</label>
                <textarea className="cl-textarea" value={reportForm.summary} onChange={(e) => setReportForm((prev) => ({ ...prev, summary: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="cl-save-btn" onClick={saveClmReport}>Save CLM report</button>
              </div>
            </div>
          )}
        </div>

        <div className="cl-card" style={{ gridColumn: '1 / -1' }}>
              <div className="cl-card-title" style={{ fontSize: 15 }}>Latest CLM report history for selected resident</div>
          {!selectedPatient ? (
            <div style={{ color: '#64748b', fontSize: 13 }}>Select a resident to view history.</div>
          ) : selectedReports.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: 13 }}>No CLM weekly reports yet.</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {selectedReports.slice(0, 8).map((r) => (
                <div key={r.id} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 12px', background: '#fff' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#1B2559' }}>
                    Week {r.weekNumber} · {new Date(r.submittedAt).toLocaleString('en-US')}
                  </div>
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 6 }}>{r.summary || 'No summary text.'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ClmPageShell>
  );
}
