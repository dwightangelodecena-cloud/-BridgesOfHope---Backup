import React, { useCallback, useEffect, useState } from 'react';
import {
  LayoutGrid,
  BookUser,
  Users,
  ClipboardList,
  ArrowRightSquare,
  Calendar,
  User,
  FileText,
  Download,
  RefreshCw,
  BarChart3,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { familySidebarStyle } from '@/lib/familySidebarStyle';
import logoBH from '@/assets/kalingalogo.png';
import { isSupabaseConfigured } from '@/lib/supabase';
import { APP_DATA_REFRESH } from '@/lib/appDataRefresh';
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
import '@/styles/admin-reports.css';

const REPORT_CARDS = [
  {
    id: 'census',
    title: 'Resident Census',
    description: 'Active and discharged patients, room/bed, and assigned staff.',
    category: 'Census',
    accent: 'navy',
    Icon: Users,
    action: (snap) => downloadPatientCensusPdf(snap),
  },
  {
    id: 'decisions',
    title: 'Admission / discharge decisions',
    description: 'Statuses with reasons or notes where recorded.',
    category: 'Workflow',
    accent: 'orange',
    Icon: ClipboardList,
    action: (snap) => downloadAdmissionDischargeDecisionsPdf(snap),
  },
  {
    id: 'occupancy',
    title: 'Occupancy',
    description: `Capacity (${REPORTS_BED_CAPACITY} beds), occupancy %, and available beds.`,
    category: 'Operations',
    accent: 'indigo',
    Icon: BarChart3,
    action: (snap) => downloadOccupancyPdf(snap),
  },
  {
    id: 'compliance',
    title: 'Weekly compliance',
    description: 'Nurse weekly reports: submitted vs expected for the current calendar week.',
    category: 'Clinical',
    accent: 'teal',
    Icon: Calendar,
    action: (snap) => downloadWeeklyCompliancePdf(snap),
  },
  {
    id: 'declines',
    title: 'Decline reasons',
    description: 'Top grouped reasons from declined admission and discharge requests.',
    category: 'Analytics',
    accent: 'amber',
    Icon: ArrowRightSquare,
    action: (snap) => downloadDeclineReasonsPdf(snap),
  },
  {
    id: 'guardian_consolidated',
    title: 'Guardian weekly consolidated',
    description: 'Latest weekly filing plus CLM, Program, and Medical context per patient.',
    category: 'Guardian',
    accent: 'rose',
    Icon: FileText,
    action: (snap) => downloadGuardianWeeklyConsolidatedPdf(snap),
  },
];

export default function AdminReportsPage() {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
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
    <div
      className="family-portal admin-portal-layout admin-reports-shell um-outer"
      style={{ display: 'flex', minHeight: '100vh', background: '#F8F9FD', fontFamily: "'Inter', sans-serif", color: '#1B2559', ...familySidebarStyle(isExpanded) }}
    >
      <AdminSidebar
        isExpanded={isExpanded}
        onToggleExpanded={() => setIsExpanded(!isExpanded)}
      />

      <div className="db-mobile-only db-mobile-top-bar">
        <img src={logoBH} alt="Kalinga" style={{ height: 32 }} />
        <span style={{ fontSize: 16, fontWeight: 800, color: '#F54E25' }}>Reports</span>
        <div style={{ width: 36, height: 36, background: '#F54E25', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>AD</div>
      </div>

      <main className="um-main admin-sidebar-offset">
        <section className="rp-hero" aria-label="Printable reports overview">
          <div className="rp-hero-glow rp-hero-glow--1" aria-hidden="true" />
          <div className="rp-hero-glow rp-hero-glow--2" aria-hidden="true" />
          <div className="rp-hero-inner">
            <div className="rp-hero-text">
              <div className="rp-hero-kicker">
                <span className="rp-hero-kicker-icon" aria-hidden="true">
                  <FileText size={15} strokeWidth={2.25} />
                </span>
                Reporting center
              </div>
              <h1>Printable reports</h1>
              <p className="rp-hero-desc">
                Export standard PDF templates for census, decisions, occupancy, weekly nurse-report compliance, and decline reasons. Data follows the live patient and request records (database when configured, otherwise local demo storage).
              </p>
            </div>
            <div className="rp-hero-actions">
              <span className="rp-source-badge">
                {loading ? 'Loading…' : `Source: ${dataSourceLabel}${isSupabaseConfigured() ? '' : ' (Supabase not configured)'}`}
              </span>
              <button type="button" className="rp-refresh" onClick={() => void reload()} disabled={loading}>
                <RefreshCw size={16} className={loading ? 'rp-refresh-icon--spin' : undefined} />
                Refresh data
              </button>
            </div>
          </div>
        </section>

        {error ? <div className="rp-error-banner">{error}</div> : null}

        <div className="rp-grid">
          {REPORT_CARDS.map((card) => {
            const { Icon } = card;
            return (
              <article key={card.id} className={`rp-card rp-card--accent-${card.accent}`}>
                <div className="rp-card-top">
                  <div className={`rp-card-icon rp-card-icon--${card.accent}`} aria-hidden="true">
                    <Icon size={22} strokeWidth={2} />
                  </div>
                  <span className="rp-card-badge">{card.category}</span>
                </div>
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
              </article>
            );
          })}
        </div>

        <div className="rp-editor">
          <header className="rp-editor-header">
            <h2>Weekly report consolidation for guardian (#7)</h2>
            <p>
              Capture CLM, Program, and Medical source notes, then finalize guardian-facing deliberation outputs: interventions, accomplishments, and next plan.
            </p>
          </header>

          <div className="rp-editor-body">
            <div className="rp-editor-section">
              <div className="rp-editor-section-title">Resident selection</div>
              <div className="rp-resident-field">
                <label className="rp-label" htmlFor="rp-resident-select">Resident</label>
                <select
                  id="rp-resident-select"
                  className="rp-input"
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                >
                  {(snapshot?.patients || []).map((p) => (
                    <option key={p.id} value={String(p.id)}>{p.name || p.full_name || p.id}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rp-editor-section">
              <div className="rp-editor-section-title">Source reports</div>
              <div className="rp-editor-grid">
                <div className="rp-field">
                  <label className="rp-label" htmlFor="rp-clm-report">CLM source report</label>
                  <textarea
                    id="rp-clm-report"
                    className="rp-textarea"
                    value={consolidationForm.clmReport}
                    onChange={(e) => setConsolidationForm((prev) => ({ ...prev, clmReport: e.target.value }))}
                  />
                </div>
                <div className="rp-field">
                  <label className="rp-label" htmlFor="rp-program-report">Program source report</label>
                  <textarea
                    id="rp-program-report"
                    className="rp-textarea"
                    value={consolidationForm.programReport}
                    onChange={(e) => setConsolidationForm((prev) => ({ ...prev, programReport: e.target.value }))}
                  />
                </div>
                <div className="rp-field">
                  <label className="rp-label" htmlFor="rp-medical-report">Medical source report</label>
                  <textarea
                    id="rp-medical-report"
                    className="rp-textarea"
                    value={consolidationForm.medicalReport}
                    onChange={(e) => setConsolidationForm((prev) => ({ ...prev, medicalReport: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="rp-editor-section">
              <div className="rp-editor-section-title">Guardian-facing outputs</div>
              <div className="rp-editor-grid">
                <div className="rp-field">
                  <label className="rp-label" htmlFor="rp-interventions">Interventions (guardian-facing)</label>
                  <textarea
                    id="rp-interventions"
                    className="rp-textarea"
                    value={consolidationForm.interventions}
                    onChange={(e) => setConsolidationForm((prev) => ({ ...prev, interventions: e.target.value }))}
                  />
                </div>
                <div className="rp-field">
                  <label className="rp-label" htmlFor="rp-accomplishments">Accomplishments (guardian-facing)</label>
                  <textarea
                    id="rp-accomplishments"
                    className="rp-textarea"
                    value={consolidationForm.accomplishments}
                    onChange={(e) => setConsolidationForm((prev) => ({ ...prev, accomplishments: e.target.value }))}
                  />
                </div>
                <div className="rp-field">
                  <label className="rp-label" htmlFor="rp-next-plan">Next plan (guardian-facing)</label>
                  <textarea
                    id="rp-next-plan"
                    className="rp-textarea"
                    value={consolidationForm.nextPlan}
                    onChange={(e) => setConsolidationForm((prev) => ({ ...prev, nextPlan: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="rp-editor-section">
              <div className="rp-editor-section-title">Final summary</div>
              <div className="rp-field">
                <label className="rp-label" htmlFor="rp-consolidated-summary">Final consolidated summary (optional)</label>
                <textarea
                  id="rp-consolidated-summary"
                  className="rp-textarea"
                  value={consolidationForm.consolidatedSummary}
                  onChange={(e) => setConsolidationForm((prev) => ({ ...prev, consolidatedSummary: e.target.value }))}
                />
              </div>
            </div>

            <div className="rp-editor-footer">
              <button type="button" className="rp-save-btn" onClick={() => void saveConsolidation()} disabled={!selectedPatient}>
                Save consolidated report
              </button>
              {saveMessage ? <span className="rp-save-message">{saveMessage}</span> : null}
            </div>
          </div>
        </div>
      </main>

      <div className="db-mobile-only db-mobile-bottom-nav">
        <div className="mob-nav-item" onClick={() => navigate('/admin-dashboard')}>
          <div style={{ padding: 10, borderRadius: 10, display: 'flex' }}>
            <LayoutGrid size={20} color="#A3AED0" />
          </div>
          <span>Dashboard</span>
        </div>
        <div className="mob-nav-item" onClick={() => navigate('/admin-patient-database')}>
          <div style={{ padding: 10, borderRadius: 10, display: 'flex' }}>
            <BookUser size={20} color="#A3AED0" />
          </div>
          <span>Residents</span>
        </div>
        <div className="mob-nav-item active">
          <div style={{ background: '#F54E25', padding: 10, borderRadius: 10, display: 'flex' }}>
            <FileText size={20} color="white" />
          </div>
          <span style={{ color: '#F54E25' }}>Reports</span>
        </div>
        <div className="mob-nav-item" onClick={() => navigate('/admin-profile')}>
          <div style={{ padding: 10, borderRadius: 10, display: 'flex' }}>
            <User size={20} color="#A3AED0" />
          </div>
          <span>Profile</span>
        </div>
      </div>
    </div>
  );
}
