import React, { useCallback, useEffect, useState } from 'react';
import {
  LayoutGrid,
  HeartPulse,
  LogOut,
  Users,
  ClipboardList,
  CheckCircle2,
  ArrowRightSquare,
  Stethoscope,
  LayoutTemplate,
  Calendar,
  User,
  FileText,
  Download,
  RefreshCw,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import logoBH from '@/assets/kalingalogo.png';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { APP_DATA_REFRESH } from '@/lib/appDataRefresh';
import { resolveAccountRole } from '@/components/RoleGuard';
import {
  loadAdminReportsSnapshot,
  downloadPatientCensusPdf,
  downloadAdmissionDischargeDecisionsPdf,
  downloadOccupancyPdf,
  downloadWeeklyCompliancePdf,
  downloadDeclineReasonsPdf,
  downloadGuardianWeeklyConsolidatedPdf,
  saveGuardianWeeklyConsolidatedDraft,
  REPORTS_BED_CAPACITY,
} from '@/lib/adminPrintableReports';

const REPORT_CARDS = [
  {
    id: 'census',
    title: 'Patient Census',
    description: 'Active and discharged patients, room/bed, and assigned staff.',
    action: (snap) => downloadPatientCensusPdf(snap),
  },
  {
    id: 'decisions',
    title: 'Admission / discharge decisions',
    description: 'Statuses with reasons or notes where recorded.',
    action: (snap) => downloadAdmissionDischargeDecisionsPdf(snap),
  },
  {
    id: 'occupancy',
    title: 'Occupancy',
    description: `Capacity (${REPORTS_BED_CAPACITY} beds), occupancy %, and available beds.`,
    action: (snap) => downloadOccupancyPdf(snap),
  },
  {
    id: 'compliance',
    title: 'Weekly compliance',
    description: 'Nurse weekly reports: submitted vs expected for the current calendar week.',
    action: (snap) => downloadWeeklyCompliancePdf(snap),
  },
  {
    id: 'declines',
    title: 'Decline reasons',
    description: 'Top grouped reasons from declined admission and discharge requests.',
    action: (snap) => downloadDeclineReasonsPdf(snap),
  },
  {
    id: 'guardian_consolidated',
    title: 'Guardian weekly consolidated',
    description: 'Latest weekly filing plus CLM, Program, and Medical context per patient.',
    action: (snap) => downloadGuardianWeeklyConsolidatedPdf(snap),
  },
];

export default function AdminReportsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const forceClm = new URLSearchParams(location.search).get('mode') === 'clm';
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClm, setIsClm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(null);
  const [exportingId, setExportingId] = useState(null);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [consolidationForm, setConsolidationForm] = useState({
    clmReport: '',
    programReport: '',
    medicalReport: '',
    interventions: '',
    accomplishments: '',
    nextPlan: '',
    consolidatedSummary: '',
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!isSupabaseConfigured()) return;
      const { data: authData } = await supabase.auth.getUser();
      const role = await resolveAccountRole(authData?.user ?? null);
      if (!cancelled) setIsClm(forceClm || role === 'case_manager');
    })();
    return () => {
      cancelled = true;
    };
  }, [forceClm]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await loadAdminReportsSnapshot();
      setSnapshot(snap);
    } catch (e) {
      console.warn('[admin-reports]', e);
      setError(e?.message || 'Could not load report data.');
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    const onRefresh = () => void reload();
    window.addEventListener('storage', onRefresh);
    window.addEventListener(APP_DATA_REFRESH, onRefresh);
    return () => {
      window.removeEventListener('storage', onRefresh);
      window.removeEventListener(APP_DATA_REFRESH, onRefresh);
    };
  }, [reload]);

  useEffect(() => {
    const patients = snapshot?.patients || [];
    if (!patients.length) {
      setSelectedPatientId('');
      return;
    }
    const hasCurrent = patients.some((p) => String(p.id) === String(selectedPatientId));
    if (!hasCurrent) {
      setSelectedPatientId(String(patients[0].id));
    }
  }, [snapshot, selectedPatientId]);

  useEffect(() => {
    if (!snapshot || !selectedPatientId) return;
    const row = snapshot.guardianConsolidatedDrafts?.[String(selectedPatientId)] || {};
    setConsolidationForm({
      clmReport: row.clmReport || '',
      programReport: row.programReport || '',
      medicalReport: row.medicalReport || '',
      interventions: row.interventions || '',
      accomplishments: row.accomplishments || '',
      nextPlan: row.nextPlan || '',
      consolidatedSummary: row.consolidatedSummary || '',
    });
    setSaveMessage('');
  }, [snapshot, selectedPatientId]);

  const runExport = async (card) => {
    if (!snapshot) {
      await reload();
      return;
    }
    setExportingId(card.id);
    try {
      card.action(snapshot);
    } finally {
      setExportingId(null);
    }
  };

  const dataSourceLabel = snapshot?.source === 'supabase' ? 'Database' : 'Local snapshot';

  const selectedPatient = (snapshot?.patients || []).find((p) => String(p.id) === String(selectedPatientId)) || null;

  const saveConsolidation = async () => {
    if (!selectedPatientId) return;
    saveGuardianWeeklyConsolidatedDraft(selectedPatientId, consolidationForm);
    setSaveMessage('Consolidated guardian summary saved.');
    await reload();
  };

  return (
    <div className="um-outer" style={{ display: 'flex', minHeight: '100vh', background: '#F8F9FD', fontFamily: "'Inter', sans-serif", color: '#1B2559' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes rp-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .um-outer { width: 100%; max-width: 100%; overflow-x: hidden; }
        .desktop-sidebar { width: ${isExpanded ? '280px' : '110px'}; background: white; border-right: 1px solid #F1F1F1; display: flex; flex-direction: column; align-items: stretch; padding: 25px 0 0; z-index: 100; transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; position: fixed; top: 0; left: 0; height: 100vh; overflow: hidden; }
        .sidebar-logo-container { display: flex; justify-content: center; width: 100%; margin-bottom: 28px; align-self: center; }
        .sidebar-logo { width: ${isExpanded ? '120px' : '70px'}; transition: width 0.3s ease; }
        .sidebar-nav-scroll { flex: 1; min-height: 0; overflow-y: auto; width: 100%; display: flex; flex-direction: column; }
        .sidebar-nav-item { display: flex; align-items: center; width: 100%; padding: 0 ${isExpanded ? '28px' : '0'}; justify-content: ${isExpanded ? 'flex-start' : 'center'}; gap: 14px; margin-bottom: 6px; min-height: 48px; box-sizing: border-box; }
        .sidebar-label { display: ${isExpanded ? 'block' : 'none'}; font-weight: 600; font-size: 15px; color: #707EAE; line-height: 1.25; white-space: normal; max-width: 210px; }
        .sidebar-footer { flex-shrink: 0; width: 100%; padding: 16px 0 20px; margin-top: auto; border-top: 1px solid #f1f5f9; }
        .icon-box { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: #E9EDF7; color: #1B2559; }
        .icon-box.active { background: #F54E25; color: white; }
        .icon-box.inactive { background: transparent; color: #A3AED0; }
        .um-main { flex: 1 1 0; min-height: 100vh; min-width: 0; margin-left: ${isExpanded ? '280px' : '110px'}; transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1); padding: 40px; width: 100%; max-width: 100%; box-sizing: border-box; overflow-x: hidden; }
        .rp-card { background: white; border: 1px solid #E9EDF7; border-radius: 16px; padding: 20px 22px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.02); }
        .rp-card h2 { font-size: 17px; font-weight: 800; color: #0f172a; }
        .rp-card p { font-size: 13px; color: #64748b; line-height: 1.45; }
        .rp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-top: 20px; }
        .rp-export { border: none; border-radius: 10px; padding: 10px 14px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: 'Inter', sans-serif; display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: #F54E25; color: white; margin-top: auto; align-self: flex-start; }
        .rp-export:disabled { opacity: 0.65; cursor: default; }
        .rp-refresh { border: 1px solid #E9EDF7; border-radius: 10px; padding: 10px 14px; font-size: 13px; font-weight: 700; cursor: pointer; background: white; color: #1B2559; display: inline-flex; align-items: center; gap: 8px; }
        .rp-editor {
          margin-top: 18px;
          background: #fff;
          border: 1px solid #E9EDF7;
          border-radius: 16px;
          padding: 18px;
          display: grid;
          gap: 10px;
        }
        .rp-editor-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .rp-input, .rp-textarea {
          width: 100%;
          border: 1px solid #dbe5f3;
          border-radius: 10px;
          padding: 9px 10px;
          font-size: 13px;
          font-family: 'Inter', sans-serif;
          background: #fff;
        }
        .rp-textarea { min-height: 92px; resize: vertical; }
        .rp-label { font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 6px; display: block; }
        .rp-save-btn {
          border: none;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          background: #0F766E;
          color: white;
          width: fit-content;
        }
        @media (max-width: 900px) {
          .rp-editor-grid { grid-template-columns: 1fr; }
        }
        .db-mobile-only { display: none; }
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .db-mobile-only { display: flex !important; }
          .um-main { margin-left: 0 !important; padding: 20px 12px 100px 12px !important; }
          .db-mobile-top-bar { width: 100%; background: white; z-index: 1001; position: sticky; top: 0; padding: 0 20px; height: 64px; align-items: center; justify-content: space-between; border-bottom: 1px solid #F1F1F1; }
          .db-mobile-bottom-nav { position: fixed; bottom: 0; left: 0; width: 100%; height: 72px; background: white; border-top: 1px solid #F1F1F1; display: flex; justify-content: space-around; align-items: center; z-index: 1000; box-shadow: 0 -4px 20px rgba(0,0,0,0.06); }
          .mob-nav-item { display: flex; flex-direction: column; align-items: center; font-size: 10px; color: #A3AED0; cursor: pointer; }
          .mob-nav-item.active { color: #F54E25; }
        }
      `}</style>

      <aside className="desktop-sidebar" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="sidebar-logo-container">
          <img src={logoBH} alt="Kalinga" className="sidebar-logo" />
        </div>
        <nav className="sidebar-nav-scroll" aria-label="Admin navigation">
          {!isClm ? (
            <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-dashboard'); }}>
              <div className="icon-box inactive"><LayoutGrid size={22} /></div>
              <span className="sidebar-label">Dashboard</span>
            </div>
          ) : null}
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-patient-database'); }}>
            <div className="icon-box inactive"><HeartPulse size={22} /></div>
            <span className="sidebar-label">{isClm ? 'Patient records' : 'Patient Management'}</span>
          </div>
          {!isClm ? (
            <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-admission-management'); }}>
              <div className="icon-box inactive"><ClipboardList size={22} /></div>
              <span className="sidebar-label">Admission Management</span>
            </div>
          ) : null}
          {!isClm ? (
            <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-discharge-management'); }}>
              <div className="icon-box inactive"><ArrowRightSquare size={22} /></div>
              <span className="sidebar-label">Discharge Management</span>
            </div>
          ) : null}
          {!isClm ? (
            <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-user-management'); }}>
              <div className="icon-box inactive"><Users size={22} /></div>
              <span className="sidebar-label">User Management</span>
            </div>
          ) : null}
          {!isClm ? (
            <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-staff-management'); }}>
              <div className="icon-box inactive"><Stethoscope size={22} /></div>
              <span className="sidebar-label">Staff Management</span>
            </div>
          ) : null}
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-recovery-roadmap'); }}>
            <div className="icon-box inactive"><CheckCircle2 size={22} /></div>
            <span className="sidebar-label">Recovery Roadmap</span>
          </div>
          {!isClm ? (
            <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-content-management'); }}>
              <div className="icon-box inactive"><LayoutTemplate size={22} /></div>
              <span className="sidebar-label">Content management</span>
            </div>
          ) : null}
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-appointments'); }}>
            <div className="icon-box inactive"><Calendar size={22} /></div>
            <span className="sidebar-label">Appointments</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => e.stopPropagation()}>
            <div className="icon-box active"><FileText size={22} /></div>
            <span className="sidebar-label" style={{ color: '#F54E25' }}>Printable reports</span>
          </div>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate(isClm ? '/case-dashboard/profile' : '/admin-profile'); }}>
            <div className="icon-box inactive"><User size={22} /></div>
            <span className="sidebar-label">{isClm ? 'Profile' : 'Profile & Security'}</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/login'); }}>
            <LogOut size={22} color="#F54E25" style={{ marginLeft: isExpanded ? 0 : 10, flexShrink: 0 }} />
            <span className="sidebar-label" style={{ color: '#F54E25' }}>Logout</span>
          </div>
        </div>
      </aside>

      <div className="db-mobile-only db-mobile-top-bar">
        <img src={logoBH} alt="Kalinga" style={{ height: 32 }} />
        <span style={{ fontSize: 16, fontWeight: 800, color: '#F54E25' }}>Reports</span>
        <div style={{ width: 36, height: 36, background: '#F54E25', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>AD</div>
      </div>

      <main className="um-main">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#000' }}>Printable reports</h1>
            <p style={{ fontSize: 13, color: '#707EAE', marginTop: 8, maxWidth: 560, lineHeight: 1.5 }}>
              Export standard PDF templates for census, decisions, occupancy, weekly nurse-report compliance, and decline reasons. Data follows the live patient and request records (database when configured, otherwise local demo storage).
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>
              {loading ? 'Loading…' : `Source: ${dataSourceLabel}${isSupabaseConfigured() ? '' : ' (Supabase not configured)'}`}
            </span>
            <button type="button" className="rp-refresh" onClick={() => void reload()} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'spin' : ''} style={loading ? { animation: 'rp-spin 0.8s linear infinite' } : undefined} />
              Refresh data
            </button>
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div className="rp-grid">
          {REPORT_CARDS.map((card) => (
            <div key={card.id} className="rp-card">
              <h2>{card.title}</h2>
              <p>{card.description}</p>
              <button
                type="button"
                className="rp-export"
                disabled={loading || !snapshot || exportingId !== null}
                onClick={() => void runExport(card)}
              >
                <Download size={16} />
                {exportingId === card.id ? 'Building PDF…' : 'Download PDF'}
              </button>
            </div>
          ))}
        </div>

        <div className="rp-editor">
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Weekly report consolidation for guardian (#7)</h2>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 6, lineHeight: 1.45 }}>
              Capture CLM, Program, and Medical source notes, then finalize guardian-facing deliberation outputs: interventions, accomplishments, and next plan.
            </p>
          </div>

          <div style={{ maxWidth: 380 }}>
            <label className="rp-label">Patient</label>
            <select
              className="rp-input"
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
            >
              {(snapshot?.patients || []).map((p) => (
                <option key={p.id} value={String(p.id)}>{p.name || p.full_name || p.id}</option>
              ))}
            </select>
          </div>

          <div className="rp-editor-grid">
            <div>
              <label className="rp-label">CLM source report</label>
              <textarea className="rp-textarea" value={consolidationForm.clmReport} onChange={(e) => setConsolidationForm((prev) => ({ ...prev, clmReport: e.target.value }))} />
            </div>
            <div>
              <label className="rp-label">Program source report</label>
              <textarea className="rp-textarea" value={consolidationForm.programReport} onChange={(e) => setConsolidationForm((prev) => ({ ...prev, programReport: e.target.value }))} />
            </div>
            <div>
              <label className="rp-label">Medical source report</label>
              <textarea className="rp-textarea" value={consolidationForm.medicalReport} onChange={(e) => setConsolidationForm((prev) => ({ ...prev, medicalReport: e.target.value }))} />
            </div>
            <div>
              <label className="rp-label">Interventions (guardian-facing)</label>
              <textarea className="rp-textarea" value={consolidationForm.interventions} onChange={(e) => setConsolidationForm((prev) => ({ ...prev, interventions: e.target.value }))} />
            </div>
            <div>
              <label className="rp-label">Accomplishments (guardian-facing)</label>
              <textarea className="rp-textarea" value={consolidationForm.accomplishments} onChange={(e) => setConsolidationForm((prev) => ({ ...prev, accomplishments: e.target.value }))} />
            </div>
            <div>
              <label className="rp-label">Next plan (guardian-facing)</label>
              <textarea className="rp-textarea" value={consolidationForm.nextPlan} onChange={(e) => setConsolidationForm((prev) => ({ ...prev, nextPlan: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="rp-label">Final consolidated summary (optional)</label>
            <textarea className="rp-textarea" value={consolidationForm.consolidatedSummary} onChange={(e) => setConsolidationForm((prev) => ({ ...prev, consolidatedSummary: e.target.value }))} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="rp-save-btn" onClick={() => void saveConsolidation()} disabled={!selectedPatient}>
              Save consolidated report
            </button>
            {saveMessage ? (
              <span style={{ fontSize: 12, fontWeight: 700, color: '#0F766E' }}>{saveMessage}</span>
            ) : null}
          </div>
        </div>
      </main>

      <div className="db-mobile-only db-mobile-bottom-nav">
        {!isClm ? (
          <div className="mob-nav-item" onClick={() => navigate('/admin-dashboard')}>
            <div style={{ padding: 10, borderRadius: 10, display: 'flex' }}>
              <LayoutGrid size={20} color="#A3AED0" />
            </div>
            <span>Dashboard</span>
          </div>
        ) : null}
        <div className="mob-nav-item" onClick={() => navigate('/admin-patient-database')}>
          <div style={{ padding: 10, borderRadius: 10, display: 'flex' }}>
            <HeartPulse size={20} color="#A3AED0" />
          </div>
          <span>{isClm ? 'Records' : 'Patients'}</span>
        </div>
        {isClm ? (
          <div className="mob-nav-item" onClick={() => navigate('/admin-appointments')}>
            <div style={{ padding: 10, borderRadius: 10, display: 'flex' }}>
              <Calendar size={20} color="#A3AED0" />
            </div>
            <span>Visits</span>
          </div>
        ) : null}
        <div className="mob-nav-item active">
          <div style={{ background: '#F54E25', padding: 10, borderRadius: 10, display: 'flex' }}>
            <FileText size={20} color="white" />
          </div>
          <span style={{ color: '#F54E25' }}>Reports</span>
        </div>
        {isClm ? (
          <div className="mob-nav-item" onClick={() => navigate('/admin-recovery-roadmap')}>
            <div style={{ padding: 10, borderRadius: 10, display: 'flex' }}>
              <CheckCircle2 size={20} color="#A3AED0" />
            </div>
            <span>Roadmap</span>
          </div>
        ) : (
          <div className="mob-nav-item" onClick={() => navigate('/admin-profile')}>
            <div style={{ padding: 10, borderRadius: 10, display: 'flex' }}>
              <User size={20} color="#A3AED0" />
            </div>
            <span>Profile</span>
          </div>
        )}
      </div>
    </div>
  );
}
