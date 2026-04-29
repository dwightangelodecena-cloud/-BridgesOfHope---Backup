import React from 'react';
import { useCaseLoad } from './CaseLoadContext';
import ClmPageShell from './ClmPageShell';

export default function CaseIncidentsPage() {
  const {
    patients,
    selectedPatientId,
    setSelectedPatientId,
    selectedPatient,
    incidentDraft,
    setIncidentDraft,
    saveIncident,
    caseloadIncidents,
  } = useCaseLoad();

  return (
    <ClmPageShell
      title="Incident tagging"
      lede="Log behavior incidents and interventions. Demotion-trigger entries adjust the resident recovery ladder position. Below shows your caseload only."
    >
      {patients.length > 0 ? (
        <div className="cl-card">
          <label className="cl-label">Active resident for this incident</label>
          <select
            className="cl-select"
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
          >
            {patients.map((p) => (
              <option key={p.id} value={String(p.id)}>{p.name}</option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="cl-grid cl-incidents-grid">
        <div className="cl-card">
          <div className="cl-card-title">New incident tag</div>
          {!selectedPatient ? (
            <div style={{ color: '#64748b', fontSize: 13 }}>No residents assigned — ask Admin to set Case Load Manager on patient records.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <label className="cl-label">Resident</label>
                <div className="cl-input" style={{ background: '#F8FAFC', fontWeight: 700 }}>{selectedPatient.name}</div>
              </div>
              <div>
                <label className="cl-label">Behavior type</label>
                <select className="cl-select" value={incidentDraft.behaviorType} onChange={(e) => setIncidentDraft((p) => ({ ...p, behaviorType: e.target.value }))}>
                  <option value="">Select behavior</option>
                  <option value="dishonest">Dishonest</option>
                  <option value="power_tripping">Power tripping</option>
                  <option value="arrogant">Arrogant</option>
                  <option value="people_pleasing">People pleasing</option>
                  <option value="lazy">Lazy</option>
                  <option value="non_caring">Non-caring</option>
                </select>
              </div>
              <div>
                <label className="cl-label">Policy impact</label>
                <select className="cl-select" value={incidentDraft.severity} onChange={(e) => setIncidentDraft((p) => ({ ...p, severity: e.target.value }))}>
                  <option value="intervention_only">Intervention only (no demotion)</option>
                  <option value="demotion_trigger">Demotion-triggering issue</option>
                </select>
              </div>
              <div>
                <label className="cl-label">Intervention used</label>
                <input className="cl-input" value={incidentDraft.intervention} onChange={(e) => setIncidentDraft((p) => ({ ...p, intervention: e.target.value }))} placeholder="e.g. Confrontation / Reflection / New shape" />
              </div>
              <div>
                <label className="cl-label">Incident note</label>
                <textarea className="cl-textarea" value={incidentDraft.note} onChange={(e) => setIncidentDraft((p) => ({ ...p, note: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="cl-save-btn" onClick={saveIncident}>Save incident tag</button>
              </div>
            </div>
          )}
        </div>
        <div className="cl-card">
          <div className="cl-card-title">Recent incident log (caseload)</div>
          {caseloadIncidents.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: 13 }}>No incidents tagged for your caseload yet.</div>
          ) : (
            <div style={{ display: 'grid', gap: 8, maxHeight: 520, overflowY: 'auto' }}>
              {caseloadIncidents.slice(0, 40).map((i) => (
                <div key={i.id} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 12, fontWeight: 800 }}>{i.patientName} · {new Date(i.createdAt).toLocaleString('en-US')}</div>
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                    {i.behaviorType} · {i.severity === 'demotion_trigger' ? 'Demotion trigger' : 'Intervention only'}
                  </div>
                  <div style={{ fontSize: 12, color: '#334155', marginTop: 4 }}>Intervention: {i.intervention}</div>
                  {i.note ? <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{i.note}</div> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ClmPageShell>
  );
}
