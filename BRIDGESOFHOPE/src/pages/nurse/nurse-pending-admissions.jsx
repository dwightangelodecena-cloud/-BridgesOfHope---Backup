import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, Users, Calendar, FileText, ClipboardCheck, User, LogOut, X, HeartPulse } from 'lucide-react';
import logo from '@/assets/kalingalogo.png';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { insertFamilyNotification } from '@/lib/notificationTemplates';
import { showErrorToast } from '@/lib/toastBus';

const PENDING_STATUSES = ['pending', 'processing', 'in_review', 'awaiting_schedule_review', 'awaiting_guardian_response'];

const VITALS_FIELDS = [
  { key: 'weight', column: 'vitals_weight', label: 'Current Weight (kg)' },
  { key: 'height', column: 'vitals_height', label: 'Height (cm)' },
  { key: 'bp', column: 'vitals_bp', label: 'BP', placeholder: '120/80' },
  { key: 'pr', column: 'vitals_pr', label: 'PR' },
  { key: 'rr', column: 'vitals_rr', label: 'RR' },
  { key: 'temperature', column: 'vitals_temperature', label: 'Temperature (°F)' },
  { key: 'bmi', column: 'vitals_bmi', label: 'BMI' },
  { key: 'spo2', column: 'vitals_spo2', label: 'SPO2' },
];

function emptyDraft() {
  return { weight: '', height: '', bp: '', pr: '', rr: '', temperature: '', bmi: '', spo2: '', summary: '' };
}

function draftFromRow(row) {
  return {
    weight: row.vitals_weight || '',
    height: row.vitals_height || '',
    bp: row.vitals_bp || '',
    pr: row.vitals_pr || '',
    rr: row.vitals_rr || '',
    temperature: row.vitals_temperature || '',
    bmi: row.vitals_bmi || '',
    spo2: row.vitals_spo2 || '',
    summary: row.pre_admission_summary || '',
  };
}

const formatDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
};

export default function NursePendingAdmissions() {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [formError, setFormError] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setRows([]);
      return;
    }
    setLoading(true);
    setFormError('');
    const { data, error } = await supabase
      .from('admission_requests')
      .select('*')
      .in('status', PENDING_STATUSES)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      setFormError(error.message || 'Could not load pending admissions.');
      return;
    }
    setRows(data || []);
  }, []);

  useEffect(() => {
    const run = async () => {
      await loadData();
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openRow = (row) => {
    setSelectedRow(row);
    setDraft(draftFromRow(row));
  };

  const handleSave = async () => {
    if (!selectedRow) return;
    setSaving(true);
    setFormError('');
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const patch = {
      vitals_weight: draft.weight.trim() || null,
      vitals_height: draft.height.trim() || null,
      vitals_bp: draft.bp.trim() || null,
      vitals_pr: draft.pr.trim() || null,
      vitals_rr: draft.rr.trim() || null,
      vitals_temperature: draft.temperature.trim() || null,
      vitals_bmi: draft.bmi.trim() || null,
      vitals_spo2: draft.spo2.trim() || null,
      vitals_recorded_at: new Date().toISOString(),
      vitals_recorded_by: user?.id || null,
      pre_admission_summary: draft.summary.trim() || null,
      pre_admission_summary_updated_at: new Date().toISOString(),
      pre_admission_summary_updated_by: user?.id || null,
    };
    const { error } = await supabase.from('admission_requests').update(patch).eq('id', selectedRow.id);
    setSaving(false);
    if (error) {
      setFormError(error.message || 'Could not save the assessment.');
      return;
    }
    if (selectedRow.family_id) {
      const notifyRes = await insertFamilyNotification({
        familyId: selectedRow.family_id,
        templateKey: 'pre_admission_summary_ready',
        vars: { patient_name: selectedRow.patient_name || 'Resident' },
        relatedType: 'admission_request',
        relatedId: selectedRow.id,
      });
      if (!notifyRes.ok) {
        showErrorToast(
          `Assessment was saved, but the guardian notification failed to send: ${notifyRes.errorMessage || 'unknown error'}`
        );
      }
    }
    setSelectedRow(null);
    await loadData();
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8FAFF', fontFamily: "'DM Sans', 'Segoe UI', sans-serif", overflowX: 'hidden' }}>
      <style>{`
        .npa-main { flex: 1; margin-left: ${isExpanded ? 280 : 110}px; padding: 28px; transition: margin-left .3s; box-sizing: border-box; }
        .npa-card { background: #fff; border-radius: 20px; border: 1px solid #E9EDF7; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.02); }
        .npa-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .npa-table th { text-align: left; padding: 10px 12px; color: #707EAE; font-weight: 700; border-bottom: 1px solid #F1F5F9; font-size: 12px; }
        .npa-table td { padding: 12px; border-bottom: 1px solid #F8FAFC; color: #1B2559; }
        .npa-row:hover { background: #F8FAFC; cursor: pointer; }
        .npa-badge { display: inline-flex; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
        .npa-badge--done { background: #ECFDF3; color: #166534; border: 1px solid #BBF7D0; }
        .npa-badge--pending { background: #F1F5F9; color: #475569; border: 1px solid #E2E8F0; }
        .npa-modal-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,0.4); display: flex; align-items: center; justify-content: center; z-index: 2000; }
        .npa-modal { width: min(92vw, 640px); max-height: 90vh; overflow-y: auto; background: #fff; border-radius: 20px; box-shadow: 0 20px 50px rgba(15,23,42,0.2); }
        .npa-modal-head { padding: 18px 22px; border-bottom: 1px solid #EEF2FF; display: flex; align-items: center; justify-content: space-between; }
        .npa-modal-body { padding: 22px; }
        .npa-vitals-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 16px; margin-bottom: 20px; }
        .npa-field-label { font-size: 11px; font-weight: 700; color: #707EAE; text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 6px; }
        .npa-field-input { width: 100%; border: 1px solid #E9EDF7; border-radius: 10px; padding: 10px 12px; font-size: 15px; font-weight: 800; color: #1B2559; outline: none; box-sizing: border-box; }
        .npa-field-input:focus { border-color: #F54E25; }
        @media (max-width: 768px) {
          .npa-main { margin-left: 0 !important; padding: 16px; }
          .npa-vitals-grid { grid-template-columns: repeat(2, minmax(0,1fr)) !important; }
        }
      `}</style>

      <aside onClick={() => setIsExpanded((v) => !v)} style={{ width: isExpanded ? 280 : 110, background: '#fff', borderRight: '1px solid #F1F1F1', display: 'flex', flexDirection: 'column', alignItems: 'stretch', padding: '25px 0 0', transition: 'width .3s cubic-bezier(0.4, 0, 0.2, 1)', position: 'fixed', top: 0, left: 0, height: '100vh', overflow: 'hidden', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: 28, alignSelf: 'center' }}>
          <img src={logo} alt="Kalinga" style={{ width: isExpanded ? 120 : 70 }} />
        </div>
        <div style={{ width: '100%', flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 48, padding: isExpanded ? '0 28px' : 0, justifyContent: isExpanded ? 'flex-start' : 'center', marginBottom: 6, boxSizing: 'border-box' }} onClick={(e) => { e.stopPropagation(); navigate('/nurse-dashboard'); }}>
            <LayoutGrid size={22} color="#707EAE" />
            {isExpanded ? <span style={{ color: '#707EAE', fontWeight: 700 }}>Dashboard</span> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 48, padding: isExpanded ? '0 28px' : 0, justifyContent: isExpanded ? 'flex-start' : 'center', marginBottom: 6, boxSizing: 'border-box' }} onClick={(e) => { e.stopPropagation(); navigate('/patient-database'); }}>
            <Users size={22} color="#707EAE" />
            {isExpanded ? <span style={{ color: '#707EAE', fontWeight: 700 }}>Residents</span> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 48, padding: isExpanded ? '0 28px' : 0, justifyContent: isExpanded ? 'flex-start' : 'center', marginBottom: 6, boxSizing: 'border-box' }}>
            <div style={{ background: '#F54E25', color: '#fff', borderRadius: 12, padding: 10, display: 'flex' }}><ClipboardCheck size={22} /></div>
            {isExpanded ? <span style={{ color: '#F54E25', fontWeight: 700 }}>Pending Admissions</span> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 48, padding: isExpanded ? '0 28px' : 0, justifyContent: isExpanded ? 'flex-start' : 'center', marginBottom: 6, boxSizing: 'border-box' }} onClick={(e) => { e.stopPropagation(); navigate('/nurse-calendar'); }}>
            <Calendar size={22} color="#707EAE" />
            {isExpanded ? <span style={{ color: '#707EAE', fontWeight: 700 }}>Calendar</span> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 48, padding: isExpanded ? '0 28px' : 0, justifyContent: isExpanded ? 'flex-start' : 'center', marginBottom: 6, boxSizing: 'border-box' }} onClick={(e) => { e.stopPropagation(); navigate('/nurse-medical-report'); }}>
            <FileText size={22} color="#707EAE" />
            {isExpanded ? <span style={{ color: '#707EAE', fontWeight: 700 }}>Medical Report</span> : null}
          </div>
        </div>
        <div style={{ flexShrink: 0, width: '100%', padding: '16px 0 20px', marginTop: 'auto', borderTop: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 48, padding: isExpanded ? '0 28px' : 0, justifyContent: isExpanded ? 'flex-start' : 'center', marginBottom: 6, boxSizing: 'border-box' }} onClick={(e) => { e.stopPropagation(); navigate('/nurseprofile'); }}>
            <User size={22} color="#707EAE" />
            {isExpanded ? <span style={{ color: '#707EAE', fontWeight: 700 }}>Profile</span> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 48, padding: isExpanded ? '0 28px' : 0, justifyContent: isExpanded ? 'flex-start' : 'center', boxSizing: 'border-box' }} onClick={(e) => { e.stopPropagation(); navigate('/login'); }}>
            <LogOut size={22} color="#F54E25" />
            {isExpanded ? <span style={{ color: '#F54E25', fontWeight: 700 }}>Logout</span> : null}
          </div>
        </div>
      </aside>

      <main className="npa-main">
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#0F172A', marginBottom: 4 }}>Pending Admissions</h1>
        <p style={{ fontSize: 13, color: '#64748B', marginBottom: 24 }}>
          Record vital signs and a short eligibility note for each prospective resident before admin decides. This becomes visible to the guardian right away.
        </p>

        {formError && <div style={{ marginBottom: 14, color: '#b91c1c', fontWeight: 600, fontSize: 13 }}>{formError}</div>}

        <div className="npa-card">
          <table className="npa-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Reason</th>
                <th>Submitted</th>
                <th>Assessment</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: '#94A3B8' }}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: '#94A3B8' }}>No pending admissions right now.</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="npa-row" onClick={() => openRow(row)}>
                    <td style={{ fontWeight: 700 }}>{row.patient_name || 'Unknown'}</td>
                    <td>{row.reason_for_admission || '—'}</td>
                    <td>{formatDate(row.created_at)}</td>
                    <td>
                      {row.vitals_recorded_at ? (
                        <span className="npa-badge npa-badge--done">Recorded {formatDate(row.vitals_recorded_at)}</span>
                      ) : (
                        <span className="npa-badge npa-badge--pending">Not yet recorded</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {selectedRow && (
        <div className="npa-modal-backdrop" onClick={() => setSelectedRow(null)}>
          <div className="npa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="npa-modal-head">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 800, color: '#1B2559' }}>
                  <HeartPulse size={18} color="#F54E25" /> Medical Assessment
                </div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{selectedRow.patient_name || 'Resident'}</div>
              </div>
              <button type="button" onClick={() => setSelectedRow(null)} style={{ background: '#F4F7FE', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex' }}>
                <X size={16} color="#1B2559" />
              </button>
            </div>
            <div className="npa-modal-body">
              <div className="npa-vitals-grid">
                {VITALS_FIELDS.map((f) => (
                  <div key={f.key}>
                    <label className="npa-field-label" htmlFor={`npa-${f.key}`}>{f.label}</label>
                    <input
                      id={`npa-${f.key}`}
                      type="text"
                      className="npa-field-input"
                      placeholder={f.placeholder || ''}
                      value={draft[f.key]}
                      onChange={(e) => setDraft((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <label className="npa-field-label" htmlFor="npa-summary">Assessment notes / eligibility conclusion</label>
              <textarea
                id="npa-summary"
                rows={4}
                style={{ width: '100%', border: '1px solid #E9EDF7', borderRadius: 12, padding: '10px 12px', fontSize: 13, color: '#1B2559', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                placeholder="e.g. Vitals within normal range, cleared for admission."
                value={draft.summary}
                onChange={(e) => setDraft((prev) => ({ ...prev, summary: e.target.value }))}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  onClick={() => setSelectedRow(null)}
                  style={{ background: '#F4F7FE', color: '#1B2559', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSave()}
                  style={{ background: '#F54E25', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 700, fontSize: 13, cursor: saving ? 'wait' : 'pointer' }}
                >
                  {saving ? 'Saving…' : 'Save & notify guardian'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
