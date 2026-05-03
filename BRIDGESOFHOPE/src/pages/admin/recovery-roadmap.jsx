import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutGrid,
  HeartPulse,
  BookUser,
  ClipboardList,
  ArrowRightSquare,
  Users,
  Stethoscope,
  LayoutTemplate,
  Calendar,
  FileText,
  User,
  LogOut,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import logoBH from '@/assets/kalingalogo.png';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { APP_DATA_REFRESH } from '@/lib/appDataRefresh';
import { resolveAccountRole } from '@/components/RoleGuard';

const WEEKLY_REPORTS_STORAGE_KEY = 'bh_nurse_weekly_reports';
const LADDER_OVERRIDE_KEY = 'bh_recovery_ladder_overrides_v1';
const GUARDIAN_CONSOLIDATED_STORAGE_KEY = 'bh_guardian_weekly_consolidated_v1';
const STAGE_COUNT = 7;
const PROGRESS_PER_TILE = 2;
const LADDER_MAX_POSITION = 50;
const LADDER_PROFILE_KEY = 'bh_recovery_ladder_profiles_v1';
const STAGE_NAMES = [
  'Stage 1: Orientation',
  'Stage 2: Stabilization',
  'Stage 3: Participation',
  'Stage 4: Responsibility',
  'Stage 5: Consistency',
  'Stage 6: Leadership',
  'Stage 7: Reintegration readiness',
];

const LADDER_LEGEND = [
  { label: 'Prospect', from: 1, to: 3 },
  { label: 'Younger Brother', from: 4, to: 7 },
  { label: 'Crew', from: 8, to: 14 },
  { label: 'Assistant', from: 15, to: 24 },
  { label: 'Head', from: 25, to: 34 },
  { label: 'Officer Candidate', from: 35, to: 44 },
  { label: 'Officer', from: 45, to: 50 },
];

const DEMOTABLE_BEHAVIORS = [
  { value: 'dishonest', label: 'Dishonest behavior' },
  { value: 'people_pleasing_manipulative', label: 'People pleasing (manipulative pattern)' },
  { value: 'power_tripping', label: 'Power tripping' },
  { value: 'arrogant', label: 'Arrogant behavior' },
  { value: 'other_demotable', label: 'Other major behavior (demotable)' },
];

const INTERVENTION_ONLY_BEHAVIORS = [
  { value: 'lazy', label: 'Lazy behavior (intervention only)' },
  { value: 'non_caring', label: 'Non-caring behavior (intervention only)' },
];

const INTERVENTION_OPTIONS = [
  { value: 'none', label: 'No intervention yet' },
  { value: 'confrontation', label: 'Confrontation' },
  { value: 'reflection', label: 'Reflection' },
  { value: 'new_shape', label: 'New shape intervention' },
  { value: 'counseling', label: 'Counseling' },
];

function ladderLegendLabel(position) {
  const pos = Math.max(1, Math.min(LADDER_MAX_POSITION, Number(position) || 1));
  const match = LADDER_LEGEND.find((x) => pos >= x.from && pos <= x.to);
  return match ? match.label : 'Unassigned';
}

function previousLegendStart(position) {
  const pos = Math.max(1, Math.min(LADDER_MAX_POSITION, Number(position) || 1));
  const idx = LADDER_LEGEND.findIndex((x) => pos >= x.from && pos <= x.to);
  if (idx <= 0) return 1;
  return LADDER_LEGEND[idx - 1].from;
}

const RecoveryRoadmapPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const forceClm = new URLSearchParams(location.search).get('mode') === 'clm';
  const [isExpanded, setIsExpanded] = useState(false);
  // Start as "unknown" to prevent admin sidebar menu flicker while resolving role.
  // `null` means role not resolved yet.
  const [isClm, setIsClm] = useState(() => {
    if (forceClm) return true;
    if (!isSupabaseConfigured()) return false;
    return null;
  });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [draftByPatient, setDraftByPatient] = useState({});
  const [saveMsg, setSaveMsg] = useState('');
  const [incidentDraftByPatient, setIncidentDraftByPatient] = useState({});
  const roleResolved = isClm !== null;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!isSupabaseConfigured()) return;
      const { data: authData } = await supabase.auth.getUser();
      const role = await resolveAccountRole(authData?.user ?? null);
      if (cancelled) return;
      setIsClm(Boolean(forceClm || role === 'case_manager'));
    })();
    return () => {
      cancelled = true;
    };
  }, [forceClm]);

  const loadLadderOverrides = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(LADDER_OVERRIDE_KEY) || '{}');
      return raw && typeof raw === 'object' ? raw : {};
    } catch {
      return {};
    }
  };

  const saveLadderOverride = (patientId, patch) => {
    const current = loadLadderOverrides();
    const pid = String(patientId || '');
    if (!pid) return;
    current[pid] = {
      ...(current[pid] || {}),
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(LADDER_OVERRIDE_KEY, JSON.stringify(current));
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event(APP_DATA_REFRESH));
  };

  const loadLadderProfiles = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(LADDER_PROFILE_KEY) || '{}');
      return raw && typeof raw === 'object' ? raw : {};
    } catch {
      return {};
    }
  };

  const saveLadderProfile = (patientId, patch) => {
    const current = loadLadderProfiles();
    const pid = String(patientId || '');
    if (!pid) return;
    current[pid] = {
      ...(current[pid] || {}),
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(LADDER_PROFILE_KEY, JSON.stringify(current));
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event(APP_DATA_REFRESH));
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (!isSupabaseConfigured()) {
          const patients = JSON.parse(localStorage.getItem('bh_patients') || '[]');
          const reports = JSON.parse(localStorage.getItem(WEEKLY_REPORTS_STORAGE_KEY) || '{}');
          const overrides = loadLadderOverrides();
          const consolidated = JSON.parse(localStorage.getItem(GUARDIAN_CONSOLIDATED_STORAGE_KEY) || '{}');
          const profiles = loadLadderProfiles();
          const mapped = (patients || []).map((p) => {
            const weekMap = reports?.[String(p.id)] || {};
            const tiles = Object.keys(weekMap)
              .map((w) => Number(w))
              .filter((n) => Number.isFinite(n))
              .sort((a, b) => a - b);
            const baseProgress = Math.min(100, tiles.length * PROGRESS_PER_TILE);
            const basePosition = Math.max(
              1,
              Math.min(
                LADDER_MAX_POSITION,
                Math.round((Math.min(STAGE_COUNT, tiles.length) / STAGE_COUNT) * LADDER_MAX_POSITION) || 1
              )
            );
            const ov = overrides[String(p.id)] || {};
            const pf = profiles[String(p.id)] || {};
            const manualOverride = Number.isFinite(Number(ov.manualProgress))
              ? Math.max(0, Math.min(100, Number(ov.manualProgress)))
              : null;
            const source = consolidated?.[String(p.id)] || {};
            const hasProgramInputs = Boolean(
              String(source.interventions || '').trim()
              || String(source.accomplishments || '').trim()
              || String(source.nextPlan || '').trim()
            );
            return {
              patientId: p.id,
              patientName: p.name || p.full_name || 'Patient',
              checkedTiles: tiles,
              baseProgress,
              currentPosition: Number.isFinite(Number(pf.currentPosition))
                ? Math.max(1, Math.min(LADDER_MAX_POSITION, Number(pf.currentPosition)))
                : basePosition,
              manualOverride,
              finalProgress: manualOverride ?? baseProgress,
              overrideReason: ov.reason || '',
              overrideUpdatedAt: ov.updatedAt || '',
              hasProgramInputs,
              lastBehavior: pf.lastBehavior || '',
              lastIntervention: pf.lastIntervention || '',
              lastIncidentNote: pf.lastIncidentNote || '',
              profileUpdatedAt: pf.updatedAt || '',
              lastCheckedAt:
                tiles.length > 0
                  ? Object.values(weekMap)
                      .map((entry) => entry?.submittedAt || entry?.submitted_at || '')
                      .filter(Boolean)
                      .sort()
                      .pop() || ''
                  : '',
            };
          });
          setRows(mapped);
          return;
        }

        const [{ data: pRows }, { data: wRows }] = await Promise.all([
          supabase.from('patients').select('id, full_name').order('full_name', { ascending: true }),
          supabase
            .from('weekly_reports')
            .select('patient_id, week_number, submitted_at')
            .order('week_number', { ascending: true }),
        ]);
        const overrides = loadLadderOverrides();
        const consolidated = JSON.parse(localStorage.getItem(GUARDIAN_CONSOLIDATED_STORAGE_KEY) || '{}');
        const profiles = loadLadderProfiles();
        const byPatient = {};
        (wRows || []).forEach((r) => {
          const k = String(r.patient_id);
          if (!byPatient[k]) byPatient[k] = [];
          byPatient[k].push(r);
        });
        const mapped = (pRows || []).map((p) => {
          const match = byPatient[String(p.id)] || [];
          const checkedTiles = match
            .map((r) => Number(r.week_number))
            .filter((n) => Number.isFinite(n))
            .sort((a, b) => a - b);
          const lastCheckedAt = match
            .map((r) => r.submitted_at || '')
            .filter(Boolean)
            .sort()
            .pop() || '';
          const baseProgress = Math.min(100, checkedTiles.length * PROGRESS_PER_TILE);
          const basePosition = Math.max(
            1,
            Math.min(
              LADDER_MAX_POSITION,
              Math.round((Math.min(STAGE_COUNT, checkedTiles.length) / STAGE_COUNT) * LADDER_MAX_POSITION) || 1
            )
          );
          const ov = overrides[String(p.id)] || {};
          const pf = profiles[String(p.id)] || {};
          const manualOverride = Number.isFinite(Number(ov.manualProgress))
            ? Math.max(0, Math.min(100, Number(ov.manualProgress)))
            : null;
          const source = consolidated?.[String(p.id)] || {};
          const hasProgramInputs = Boolean(
            String(source.interventions || '').trim()
            || String(source.accomplishments || '').trim()
            || String(source.nextPlan || '').trim()
          );
          return {
            patientId: p.id,
            patientName: p.full_name || 'Patient',
            checkedTiles,
            baseProgress,
            currentPosition: Number.isFinite(Number(pf.currentPosition))
              ? Math.max(1, Math.min(LADDER_MAX_POSITION, Number(pf.currentPosition)))
              : basePosition,
            manualOverride,
            finalProgress: manualOverride ?? baseProgress,
            overrideReason: ov.reason || '',
            overrideUpdatedAt: ov.updatedAt || '',
            hasProgramInputs,
            lastBehavior: pf.lastBehavior || '',
            lastIntervention: pf.lastIntervention || '',
            lastIncidentNote: pf.lastIncidentNote || '',
            profileUpdatedAt: pf.updatedAt || '',
            lastCheckedAt,
          };
        });
        setRows(mapped);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
    window.addEventListener('storage', load);
    window.addEventListener(APP_DATA_REFRESH, load);
    return () => {
      window.removeEventListener('storage', load);
      window.removeEventListener(APP_DATA_REFRESH, load);
    };
  }, []);

  const completedTilesCount = useMemo(
    () => rows.reduce((sum, r) => sum + (r.checkedTiles?.length || 0), 0),
    [rows]
  );
  const overallCompletionRate = useMemo(() => {
    const expected = rows.length * STAGE_COUNT;
    if (!expected) return 0;
    return Math.round((completedTilesCount / expected) * 100);
  }, [rows.length, completedTilesCount]);
  const overallFinalProgress = useMemo(() => {
    if (!rows.length) return 0;
    return Math.round(rows.reduce((sum, r) => sum + Number(r.finalProgress || 0), 0) / rows.length);
  }, [rows]);

  useEffect(() => {
    const next = {};
    const nextIncident = {};
    rows.forEach((r) => {
      next[String(r.patientId)] = {
        manualProgress: r.manualOverride == null ? '' : String(r.manualOverride),
        reason: r.overrideReason || '',
      };
      nextIncident[String(r.patientId)] = {
        behavior: '',
        intervention: 'none',
        note: '',
      };
    });
    setDraftByPatient(next);
    setIncidentDraftByPatient(nextIncident);
  }, [rows]);

  const formatDate = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return '—';
    }
  };

  return (
    <div className="rr-outer" style={{ display: 'flex', minHeight: '100vh', background: '#F8F9FD', fontFamily: "'Inter', sans-serif", color: '#1B2559' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .rr-outer { width: 100%; max-width: 100%; overflow-x: hidden; }
        .desktop-sidebar { width: ${isExpanded ? '280px' : '110px'}; background: white; border-right: 1px solid #F1F1F1; display: flex; flex-direction: column; align-items: stretch; padding: 25px 0 0; z-index: 100; transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; position: fixed; top: 0; left: 0; height: 100vh; overflow: hidden; }
        .sidebar-logo-container { display: flex; justify-content: center; width: 100%; margin-bottom: 28px; align-self: center; }
        .sidebar-logo { width: ${isExpanded ? '120px' : '70px'}; transition: width 0.3s ease; }
        .sidebar-nav-scroll { flex: 1; min-height: 0; overflow-y: auto; width: 100%; display: flex; flex-direction: column; }
        .sidebar-nav-item { display: flex; align-items: center; width: 100%; padding: 0 ${isExpanded ? '28px' : '0'}; justify-content: ${isExpanded ? 'flex-start' : 'center'}; gap: 14px; margin-bottom: 6px; min-height: 48px; box-sizing: border-box; }
        .sidebar-label { display: ${isExpanded ? 'block' : 'none'}; font-weight: 600; font-size: 15px; color: #707EAE; line-height: 1.25; white-space: normal; max-width: 210px; }
        .sidebar-footer { flex-shrink: 0; width: 100%; padding: 16px 0 20px; margin-top: auto; border-top: 1px solid #f1f5f9; }
        .icon-box { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: #E9EDF7; color: #1B2559; flex-shrink: 0; }
        .icon-box.active { background: #F54E25; color: white; }
        .icon-box.inactive { background: transparent; color: #A3AED0; }
        .rr-main { flex: 1 1 auto; min-width: 0; min-height: 100vh; margin-left: ${isExpanded ? '280px' : '110px'}; transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1); padding: 24px; overflow-x: hidden; }
        .rr-card { background: white; border: 1px solid #E9EDF7; border-radius: 20px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.02); }
      `}</style>

      <aside className="desktop-sidebar" onClick={() => setIsExpanded((prev) => !prev)}>
        <div className="sidebar-logo-container"><img src={logoBH} alt="Kalinga" className="sidebar-logo" /></div>
        <nav className="sidebar-nav-scroll" aria-label="Admin navigation">
          {roleResolved ? (
            <>
              {isClm ? (
                <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/case-dashboard'); }}><div className="icon-box inactive"><LayoutGrid size={22} /></div><span className="sidebar-label">CLM workspace</span></div>
              ) : (
                <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-dashboard'); }}><div className="icon-box inactive"><LayoutGrid size={22} /></div><span className="sidebar-label">Dashboard</span></div>
              )}
              <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-patient-database'); }}><div className="icon-box inactive"><BookUser size={22} /></div><span className="sidebar-label">{isClm ? 'Patient records' : 'Patient Management'}</span></div>
              {!isClm ? <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-admission-management'); }}><div className="icon-box inactive"><ClipboardList size={22} /></div><span className="sidebar-label">Admission Management</span></div> : null}
              {!isClm ? <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-discharge-management'); }}><div className="icon-box inactive"><ArrowRightSquare size={22} /></div><span className="sidebar-label">Discharge Management</span></div> : null}
              {!isClm ? <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-user-management'); }}><div className="icon-box inactive"><Users size={22} /></div><span className="sidebar-label">User Management</span></div> : null}
              {!isClm ? <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-staff-management'); }}><div className="icon-box inactive"><Stethoscope size={22} /></div><span className="sidebar-label">Staff Management</span></div> : null}
            </>
          ) : null}
          <div className="sidebar-nav-item"><div className="icon-box active"><HeartPulse size={22} /></div><span className="sidebar-label" style={{ color: '#F54E25' }}>Recovery Roadmap</span></div>
          {roleResolved && !isClm ? <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-content-management'); }}><div className="icon-box inactive"><LayoutTemplate size={22} /></div><span className="sidebar-label">Content management</span></div> : null}
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-appointments'); }}><div className="icon-box inactive"><Calendar size={22} /></div><span className="sidebar-label">Appointments</span></div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-reports'); }}><div className="icon-box inactive"><FileText size={22} /></div><span className="sidebar-label">Printable reports</span></div>
        </nav>
        <div className="sidebar-footer">
          {roleResolved ? (
            <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate(isClm ? '/case-dashboard/profile' : '/admin-profile'); }}><div className="icon-box inactive"><User size={22} /></div><span className="sidebar-label">{isClm ? 'Profile' : 'Profile & Security'}</span></div>
          ) : null}
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/login'); }}><LogOut size={22} color="#F54E25" style={{ marginLeft: isExpanded ? 0 : 10, flexShrink: 0 }} /><span className="sidebar-label" style={{ color: '#F54E25' }}>Logout</span></div>
        </div>
      </aside>

      <main className="rr-main">
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#000' }}>Recovery Roadmap</h1>
        <p style={{ fontSize: 13, color: '#707EAE', marginTop: 8, marginBottom: 20, fontWeight: 500 }}>
          Snakes & ladders guide view. This table shows only nurse-checked tiles from weekly reports.
        </p>

        <div className="rr-card" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Patients tracked: {rows.length}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#16A34A' }}>Checked tiles total: {completedTilesCount}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0369A1' }}>Overall completion: {overallCompletionRate}%</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#7C3AED' }}>Avg final progress: {overallFinalProgress}%</div>
          </div>
        </div>

        <div className="rr-card" style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1B2559', marginBottom: 10 }}>How the Recovery Ladder works</h2>
          <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, marginBottom: 10 }}>
            The ladder has <strong>{STAGE_COUNT} stages</strong> with <strong>1 weekly activity tile per stage</strong> (7 tiles total).
            Nurses check completed tiles weekly, then departments deliberate interventions and accomplishments before the next stage handoff.
          </p>
          <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
            Weekly guardian reports are consolidated from these checked tiles plus department updates (interventions, response, and next action plan).
          </p>
          <p style={{ fontSize: 12, color: '#334155', lineHeight: 1.6, marginTop: 8 }}>
            Policy: <strong>{PROGRESS_PER_TILE}% per checked tile</strong>. Manual override is allowed for BOH personnel but requires a reason for audit and program deliberation traceability.
          </p>
          <p style={{ fontSize: 12, color: '#334155', lineHeight: 1.6, marginTop: 6 }}>
            Ladder policy: resident moves continuously from <strong>1 to {LADDER_MAX_POSITION}</strong> when compliant; demotion applies for major behavior issues, while minor issues are intervention-only and do not demote.
          </p>
        </div>

        <div className="rr-card" style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1B2559', marginBottom: 8 }}>Ladder legend (1-{LADDER_MAX_POSITION})</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {LADDER_LEGEND.map((l) => (
              <span key={l.label} style={{ border: '1px solid #E2E8F0', borderRadius: 999, padding: '6px 10px', fontSize: 12, fontWeight: 700, color: '#334155', background: '#F8FAFC' }}>
                {l.from}-{l.to} {l.label}
              </span>
            ))}
          </div>
        </div>

        {saveMsg ? (
          <div className="rr-card" style={{ marginBottom: 14, padding: 12, borderColor: '#BBF7D0', background: '#F0FDF4', color: '#166534', fontSize: 12, fontWeight: 700 }}>
            {saveMsg}
          </div>
        ) : null}

        <div className="rr-card" style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1B2559', marginBottom: 10 }}>Stages and activities</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#323D4E', color: 'white' }}>
                  {['Stage', 'Activities in stage'].map((h, i) => (
                    <th key={h} style={{ padding: '10px 12px', borderRight: i < 1 ? '1px solid #4B5563' : 'none', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STAGE_NAMES.map((name) => (
                  <tr key={name} style={{ borderBottom: '1px solid #F4F7FE' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#1B2559' }}>{name}</td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>1</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rr-card">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#323D4E', color: 'white' }}>
                  {['Patient', 'Checked Tiles', 'Ladder position', `Base (${PROGRESS_PER_TILE}%/tile)`, 'Manual override', 'Final progress', 'Behavior / intervention', 'Governance link', 'Last Checked'].map((h, i) => (
                    <th key={h} style={{ padding: '12px 14px', borderRight: i < 8 ? '1px solid #4B5563' : 'none', whiteSpace: 'nowrap', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={9} style={{ padding: 18, color: '#64748b' }}>Loading roadmap…</td></tr>}
                {!loading && rows.length === 0 && <tr><td colSpan={9} style={{ padding: 18, color: '#64748b' }}>No nurse-checked tiles yet.</td></tr>}
                {!loading && rows.map((r) => (
                  <tr key={String(r.patientId)} style={{ borderBottom: '1px solid #F4F7FE' }}>
                    <td style={{ padding: '14px', color: '#1B2559', fontWeight: 700 }}>{r.patientName}</td>
                    <td style={{ padding: '14px', color: '#334155' }}>{r.checkedTiles?.length ? r.checkedTiles.join(', ') : '—'}</td>
                    <td style={{ padding: '14px', minWidth: 220 }}>
                      <div style={{ display: 'grid', gap: 5 }}>
                        <div style={{ color: '#0F172A', fontWeight: 800 }}>
                          {r.currentPosition} / {LADDER_MAX_POSITION} · {ladderLegendLabel(r.currentPosition)}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            style={{ border: '1px solid #BBF7D0', background: '#ECFDF3', color: '#166534', borderRadius: 8, padding: '5px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                            onClick={() => {
                              const nextPos = Math.min(LADDER_MAX_POSITION, Number(r.currentPosition || 1) + 1);
                              saveLadderProfile(r.patientId, {
                                currentPosition: nextPos,
                                lastBehavior: 'No issue (continuous progress)',
                                lastIntervention: 'none',
                                lastIncidentNote: 'Promoted due to compliant behavior.',
                              });
                              setSaveMsg(`${r.patientName} promoted to position ${nextPos}.`);
                              setTimeout(() => setSaveMsg(''), 2000);
                            }}
                          >
                            Promote +1
                          </button>
                          <button
                            type="button"
                            style={{ border: '1px solid #FECACA', background: '#FEF2F2', color: '#991B1B', borderRadius: 8, padding: '5px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                            onClick={() => {
                              const nextPos = previousLegendStart(r.currentPosition);
                              saveLadderProfile(r.patientId, {
                                currentPosition: nextPos,
                                lastBehavior: 'Manual demotion',
                                lastIntervention: 'new_shape',
                                lastIncidentNote: 'Manual demotion to prior role band.',
                              });
                              setSaveMsg(`${r.patientName} demoted to position ${nextPos}.`);
                              setTimeout(() => setSaveMsg(''), 2000);
                            }}
                          >
                            Demote to prior role
                          </button>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px', color: '#0369A1', fontWeight: 700 }}>{r.baseProgress}%</td>
                    <td style={{ padding: '14px', color: '#334155', minWidth: 250 }}>
                      <div style={{ display: 'grid', gap: 6 }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={draftByPatient[String(r.patientId)]?.manualProgress ?? ''}
                            onChange={(e) => setDraftByPatient((prev) => ({
                              ...prev,
                              [String(r.patientId)]: {
                                ...(prev[String(r.patientId)] || {}),
                                manualProgress: e.target.value,
                              },
                            }))}
                            placeholder="0-100"
                            style={{ width: 80, border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px 8px', fontSize: 12 }}
                          />
                          <button
                            type="button"
                            style={{ border: 'none', background: '#4F46E5', color: 'white', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                            onClick={() => {
                              const d = draftByPatient[String(r.patientId)] || {};
                              const rawManual = String(d.manualProgress ?? '').trim();
                              const manual = rawManual === '' ? null : Number(rawManual);
                              const reason = String(d.reason || '').trim();
                              if (manual != null && (!Number.isFinite(manual) || manual < 0 || manual > 100)) return;
                              if (manual != null && manual !== r.baseProgress && !reason) return;
                              saveLadderOverride(r.patientId, {
                                manualProgress: manual,
                                reason: reason,
                              });
                              setSaveMsg(`Manual override saved for ${r.patientName}.`);
                              setTimeout(() => setSaveMsg(''), 2000);
                            }}
                          >
                            Save override
                          </button>
                        </div>
                        <input
                          type="text"
                          value={draftByPatient[String(r.patientId)]?.reason ?? ''}
                          onChange={(e) => setDraftByPatient((prev) => ({
                            ...prev,
                            [String(r.patientId)]: {
                              ...(prev[String(r.patientId)] || {}),
                              reason: e.target.value,
                            },
                          }))}
                          placeholder="Reason (required if manual progress differs from base)"
                          style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px 8px', fontSize: 12 }}
                        />
                        <div style={{ fontSize: 10, color: '#64748b' }}>
                          Last override: {r.overrideUpdatedAt ? `${formatDate(r.overrideUpdatedAt)} · ${r.overrideReason || 'No reason recorded'}` : 'None'}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px', color: '#7C3AED', fontWeight: 800 }}>{r.finalProgress}%</td>
                    <td style={{ padding: '14px', color: '#334155', minWidth: 280 }}>
                      <div style={{ display: 'grid', gap: 6 }}>
                        <select
                          value={incidentDraftByPatient[String(r.patientId)]?.behavior ?? ''}
                          onChange={(e) => setIncidentDraftByPatient((prev) => ({
                            ...prev,
                            [String(r.patientId)]: { ...(prev[String(r.patientId)] || {}), behavior: e.target.value },
                          }))}
                          style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px 8px', fontSize: 12 }}
                        >
                          <option value="">Select behavior issue (optional)</option>
                          <optgroup label="Demotion-triggering">
                            {DEMOTABLE_BEHAVIORS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                          </optgroup>
                          <optgroup label="Intervention only">
                            {INTERVENTION_ONLY_BEHAVIORS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                          </optgroup>
                        </select>
                        <select
                          value={incidentDraftByPatient[String(r.patientId)]?.intervention ?? 'none'}
                          onChange={(e) => setIncidentDraftByPatient((prev) => ({
                            ...prev,
                            [String(r.patientId)]: { ...(prev[String(r.patientId)] || {}), intervention: e.target.value },
                          }))}
                          style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px 8px', fontSize: 12 }}
                        >
                          {INTERVENTION_OPTIONS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
                        </select>
                        <input
                          type="text"
                          value={incidentDraftByPatient[String(r.patientId)]?.note ?? ''}
                          onChange={(e) => setIncidentDraftByPatient((prev) => ({
                            ...prev,
                            [String(r.patientId)]: { ...(prev[String(r.patientId)] || {}), note: e.target.value },
                          }))}
                          placeholder="Incident/intervention note"
                          style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px 8px', fontSize: 12 }}
                        />
                        <button
                          type="button"
                          style={{ border: 'none', background: '#0F766E', color: 'white', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', width: 'fit-content' }}
                          onClick={() => {
                            const d = incidentDraftByPatient[String(r.patientId)] || {};
                            const behavior = String(d.behavior || '').trim();
                            const intervention = String(d.intervention || 'none').trim() || 'none';
                            const note = String(d.note || '').trim();
                            if (!behavior) return;
                            const isDemotable = DEMOTABLE_BEHAVIORS.some((x) => x.value === behavior);
                            const nextPos = isDemotable ? previousLegendStart(r.currentPosition) : r.currentPosition;
                            saveLadderProfile(r.patientId, {
                              currentPosition: nextPos,
                              lastBehavior: behavior,
                              lastIntervention: intervention,
                              lastIncidentNote: note || (isDemotable ? 'Demoted after behavior incident.' : 'Intervention recorded without demotion.'),
                            });
                            setSaveMsg(
                              isDemotable
                                ? `${r.patientName} demoted to ${nextPos} after behavior incident.`
                                : `${r.patientName} intervention logged (no demotion).`
                            );
                            setTimeout(() => setSaveMsg(''), 2200);
                          }}
                        >
                          Apply incident policy
                        </button>
                        <div style={{ fontSize: 10, color: '#64748b' }}>
                          Last: {r.lastBehavior || '—'} · intervention: {r.lastIntervention || '—'}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px', color: '#334155', fontSize: 12 }}>
                      <div style={{ fontWeight: 700 }}>{r.hasProgramInputs ? 'Program deliberation linked' : 'Awaiting program notes'}</div>
                      <div style={{ marginTop: 4, color: '#64748b' }}>
                        {r.lastCheckedAt ? 'Weekly report submitted' : 'No weekly report submitted'}
                      </div>
                    </td>
                    <td style={{ padding: '14px', color: '#64748b' }}>{formatDate(r.lastCheckedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RecoveryRoadmapPage;
