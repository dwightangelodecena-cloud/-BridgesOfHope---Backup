import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  LabelList,
} from 'recharts';
import { CheckCircle2 } from 'lucide-react';
import { useCaseLoad } from './CaseLoadContext';
import { CHART_COLORS } from './clmUtils';
import ClmPageShell from './ClmPageShell';

export default function CaseOverviewPage() {
  const navigate = useNavigate();
  const {
    patients,
    me,
    reportsThisWeek,
    openVisitationCount,
    incidentsForCaseload,
    reportsByWeekChart,
    appointmentStatusChart,
    incidentsByMonthChart,
    incidentSeverityChart,
    reportsPerResidentChart,
    hasAnyReportsTrend,
    caseloadIncidents,
    appointments,
  } = useCaseLoad();

  const totalVisitRequests = React.useMemo(
    () => appointmentStatusChart.reduce((sum, item) => sum + Number(item?.value || 0), 0),
    [appointmentStatusChart]
  );

  const dominantVisitStatus = React.useMemo(() => {
    if (!appointmentStatusChart.length) return 'No requests yet';
    const top = [...appointmentStatusChart].sort((a, b) => Number(b.value || 0) - Number(a.value || 0))[0];
    return `${top.name} (${top.value})`;
  }, [appointmentStatusChart]);

  const visitStatusBarData = React.useMemo(
    () => appointmentStatusChart.map((item) => ({ status: item.name, requests: Number(item.value || 0) })),
    [appointmentStatusChart]
  );

  const recentVisitRequests = React.useMemo(() => {
    const source = Array.isArray(appointments) ? appointments : [];
    return [...source]
      .sort((a, b) => new Date(b?.createdAt || b?.created_at || b?.submitted_at || 0) - new Date(a?.createdAt || a?.created_at || a?.submitted_at || 0))
      .slice(0, 5)
      .map((row) => ({
        resident: row?.patientName || row?.residentName || row?.patient_name || row?.resident_name || 'Resident',
        status: row?.status || row?.Status || 'Pending',
        when: row?.visitDate || row?.appointmentDate || row?.requestedDate || row?.date || row?.createdAt || '',
      }));
  }, [appointments]);

  return (
    <ClmPageShell
      title="Case Load Manager — Overview"
      lede="Snapshot of your caseload, CLM reporting cadence, visits, and incidents. Use the sidebar for detailed workflows."
    >
        <div className="cl-hero">
          <p className="cl-hero-title">Caseload Command Center</p>
          <p className="cl-hero-sub">A consolidated view of resident assignments, weekly reporting health, and coordination metrics for CLM operations.</p>
          <div className="cl-pill-row">
            <span className="cl-pill">{patients.length} active residents</span>
            <span className="cl-pill">{reportsThisWeek} weekly reports this week</span>
            <span className="cl-pill">{openVisitationCount} open visit requests</span>
          </div>
        </div>
        <div className="cl-grid">
          <div className="cl-metric">
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>Assigned active residents</div>
            <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>{patients.length}</div>
          </div>
          <div className="cl-metric">
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>CLM weekly reports this week</div>
            <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>{reportsThisWeek}</div>
          </div>
          <div className="cl-metric">
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>Open visit requests (caseload)</div>
            <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>{openVisitationCount}</div>
          </div>
          <div className="cl-metric">
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>Tagged incidents (caseload)</div>
            <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>{incidentsForCaseload}</div>
          </div>
          <div className="cl-metric">
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>Signed in as CLM</div>
            <div style={{ fontSize: 15, fontWeight: 800, marginTop: 8 }}>{me.fullName}</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>{me.email || 'Local mode'}</div>
          </div>
        </div>

        <div className="cl-card" style={{ padding: '18px 20px' }}>
          <div className="cl-card-title" style={{ marginBottom: 4 }}>Caseload analytics</div>
          <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 14px', fontWeight: 500, lineHeight: 1.45 }}>
            Visual summary of your assigned residents: weekly CLM reports, visit statuses, incident trends, and report volume per resident.
          </p>
          <div className="cl-chart-grid">
            <div className="cl-chart-card">
              <h3 className="cl-chart-title">CLM weekly reports by week</h3>
              <p className="cl-chart-sub">Count of reports filed per week number (your caseload).</p>
              {!hasAnyReportsTrend ? (
                <div className="cl-chart-empty">No reports yet — open Assigned residents to submit your first weekly report.</div>
              ) : (
                <div className="cl-chart-wrap">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={reportsByWeekChart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E9EDF7" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} width={32} />
                      <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E9EDF7', fontSize: 12 }} />
                      <Bar dataKey="reports" name="Reports" fill="#F54E25" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="cl-chart-card">
              <h3 className="cl-chart-title">Visit request status</h3>
              <p className="cl-chart-sub">Status trend and latest requests for your caseload visitation queue.</p>
              {appointmentStatusChart.length === 0 ? (
                <div className="cl-chart-empty">No visitation requests linked to your caseload yet.</div>
              ) : (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
                    <div className="cl-metric" style={{ margin: 0 }}>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>Total requests</div>
                      <div style={{ fontSize: 22, fontWeight: 900, marginTop: 5 }}>{totalVisitRequests}</div>
                    </div>
                    <div className="cl-metric" style={{ margin: 0 }}>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>Open requests</div>
                      <div style={{ fontSize: 22, fontWeight: 900, marginTop: 5 }}>{openVisitationCount}</div>
                    </div>
                    <div className="cl-metric" style={{ margin: 0 }}>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>Most common status</div>
                      <div style={{ fontSize: 13, fontWeight: 800, marginTop: 8 }}>{dominantVisitStatus}</div>
                    </div>
                  </div>

                  <div className="cl-chart-wrap" style={{ marginBottom: 10 }}>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={visitStatusBarData} margin={{ top: 16, right: 8, left: -8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E9EDF7" />
                        <XAxis dataKey="status" tick={{ fontSize: 11, fill: '#64748b' }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} width={28} />
                        <Bar dataKey="requests" name="Requests" radius={[6, 6, 0, 0]}>
                          <LabelList dataKey="requests" position="top" fill="#334155" fontSize={11} />
                          {visitStatusBarData.map((entry, i) => (
                            <Cell key={`${entry.status}_${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ background: '#F8FAFC', padding: '8px 10px', fontSize: 11, fontWeight: 800, color: '#334155' }}>
                      Recent visit requests
                    </div>
                    {recentVisitRequests.length === 0 ? (
                      <div style={{ padding: '10px 12px', fontSize: 12, color: '#94A3B8' }}>No recent request entries available.</div>
                    ) : (
                      recentVisitRequests.map((item, idx) => (
                        <div
                          key={`${item.resident}_${idx}`}
                          style={{
                            padding: '9px 10px',
                            borderTop: idx === 0 ? 'none' : '1px solid #EEF2F7',
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 8,
                            fontSize: 12,
                          }}
                        >
                          <span style={{ color: '#0F172A', fontWeight: 700 }}>{item.resident}</span>
                          <span style={{ color: '#475569' }}>{item.status}</span>
                          <span style={{ color: '#94A3B8' }}>{item.when ? new Date(item.when).toLocaleDateString() : '—'}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="cl-chart-card">
              <h3 className="cl-chart-title">Tagged incidents by month</h3>
              <p className="cl-chart-sub">Incidents logged under your caseload (recent months).</p>
              {incidentsByMonthChart.length === 0 ? (
                <div className="cl-chart-empty">No incidents tagged yet — use Incident tagging when needed.</div>
              ) : (
                <div className="cl-chart-wrap">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={incidentsByMonthChart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E9EDF7" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-12} textAnchor="end" height={52} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} width={28} />
                      <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E9EDF7', fontSize: 12 }} />
                      <Bar dataKey="incidents" name="Incidents" fill="#1B2559" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="cl-chart-card">
              <h3 className="cl-chart-title">Incident severity &amp; reports per resident</h3>
              <p className="cl-chart-sub">Demotion vs intervention; CLM reports per resident (top 8).</p>
              <div className="cl-chart-split">
                <div style={{ minHeight: 220 }}>
                  {caseloadIncidents.length === 0 ? (
                    <div className="cl-chart-empty" style={{ minHeight: 200 }}>No incidents</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={incidentSeverityChart}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={72}
                          paddingAngle={2}
                        >
                          <Cell fill="#DC2626" />
                          <Cell fill="#0F766E" />
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E9EDF7', fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div style={{ minHeight: 220 }}>
                  {reportsPerResidentChart.every((r) => r.reports === 0) ? (
                    <div className="cl-chart-empty" style={{ minHeight: 200 }}>No per-resident reports</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={reportsPerResidentChart} layout="vertical" margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E9EDF7" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                        <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 10, fill: '#64748b' }} />
                        <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E9EDF7', fontSize: 12 }} />
                        <Bar dataKey="reports" name="CLM reports" fill="#6366F1" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="cl-card">
          <div className="cl-card-title">Internal operations (summary)</div>
          <p className="cl-qa-p" style={{ marginBottom: 10 }}>
            Bridges of Hope runs resident care across CLM, Program, Medical, and Admin. Guardian-facing summaries are built through department deliberation.
            Full policy reference (bed rules, visits, discharge, ladder) lives on the Operations guide page — authorized BoH staff only.
          </p>
          <button type="button" className="cl-save-btn" style={{ background: '#1B2559' }} onClick={() => navigate('/case-dashboard/resources')}>
            Open operations guide
          </button>
        </div>

        <div className="cl-card">
          <h3 className="cl-qa-h2">Quick actions</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button type="button" className="cl-save-btn" style={{ background: '#1B2559' }} onClick={() => navigate('/case-dashboard/residents')}>Submit CLM weekly report</button>
            <button type="button" className="cl-save-btn" style={{ background: '#F54E25' }} onClick={() => navigate('/case-dashboard/incidents')}>Log incident / intervention</button>
            <button type="button" className="cl-save-btn" style={{ background: '#64748b' }} onClick={() => navigate('/case-dashboard/appointments')}>Review visitation appointments</button>
            <button type="button" className="cl-save-btn" style={{ background: '#0F766E', display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={() => navigate('/admin-recovery-roadmap')}>
              <CheckCircle2 size={18} /> Recovery roadmap
            </button>
          </div>
        </div>
    </ClmPageShell>
  );
}
