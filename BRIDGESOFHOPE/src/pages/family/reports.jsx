import React, { useMemo, useState } from 'react';
import { Home, User, LogOut, Calendar, ClipboardList, BarChart3, X, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logo from '@/assets/logo2.png';
import { FAMILY_COLORS } from '@/components/family/shared/ui';

export default function FamilyReportsPage() {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState('Week 1');
  const [selectedPatient, setSelectedPatient] = useState(null);

  const samplePatients = useMemo(
    () => [
      {
        id: 'p-1',
        name: 'Maria Santos',
        age: 29,
        admissionDate: '2026-03-02',
        reports: {
          'Week 1': { summary: 'Stable week. Better sleep pattern and appetite.', progress: '65%', notes: 'No relapse signs observed.' },
          'Week 2': { summary: 'Participated in all counseling sessions.', progress: '72%', notes: 'Shows improved social interaction.' },
          'Week 3': { summary: 'Continued recovery trend with good compliance.', progress: '78%', notes: 'Responding well to structured routine.' },
          'Week 4': { summary: 'Maintained positive behavior and engagement.', progress: '83%', notes: 'Family call positively impacted motivation.' },
        },
      },
      {
        id: 'p-2',
        name: 'Elena Cruz',
        age: 35,
        admissionDate: '2026-03-09',
        reports: {
          'Week 1': { summary: 'Mild withdrawal symptoms managed successfully.', progress: '58%', notes: 'Needs close monitoring during evenings.' },
          'Week 2': { summary: 'Symptoms reduced; started active participation.', progress: '66%', notes: 'Improved emotional regulation.' },
          'Week 3': { summary: 'Attended all therapeutic activities this week.', progress: '73%', notes: 'Steady progress with treatment plan.' },
          'Week 4': { summary: 'Consistent improvement in daily routines.', progress: '79%', notes: 'More openness during individual sessions.' },
        },
      },
      {
        id: 'p-3',
        name: 'Sofia Reyes',
        age: 24,
        admissionDate: '2026-03-15',
        reports: {
          'Week 1': { summary: 'Initial adjustment week; cooperative behavior.', progress: '61%', notes: 'Requires encouragement in group sessions.' },
          'Week 2': { summary: 'Better adaptation to program schedule.', progress: '69%', notes: 'Shows stronger coping responses.' },
          'Week 3': { summary: 'Improved confidence and activity attendance.', progress: '75%', notes: 'Maintains good compliance with care plan.' },
          'Week 4': { summary: 'Positive behavioral consistency observed.', progress: '82%', notes: 'Family support remains a strong factor.' },
        },
      },
    ],
    []
  );

  const weeklyReport = selectedPatient ? selectedPatient.reports[selectedWeek] : null;

  return (
    <div className="app-container">
      <style>{`
        .app-container { display: flex; width: 100vw; height: 100vh; background: #F8F9FD; font-family: 'Inter', -apple-system, sans-serif; overflow: hidden; touch-action: manipulation; }
        .desktop-sidebar { width: ${isExpanded ? '280px' : '110px'}; background: #fff; border-right: 1px solid #F1F1F1; display: flex; flex-direction: column; align-items: center; padding: 25px 0 170px; position: relative; transition: width .3s; cursor: pointer; }
        .sidebar-logo-container { display: flex; justify-content: center; width: 100%; margin-bottom: 40px; }
        .sidebar-logo { width: ${isExpanded ? '120px' : '70px'}; transition: width .3s; }
        .sidebar-primary { width: 100%; }
        .sidebar-nav-item { display: flex; align-items: center; width: 100%; padding: 0 ${isExpanded ? '35px' : '0'}; justify-content: ${isExpanded ? 'flex-start' : 'center'}; gap: 20px; margin-bottom: 25px; min-height: 52px; border: 2px solid transparent; border-radius: 12px; box-sizing: border-box; }
        .sidebar-nav-item.sidebar-nav-active { border-color: #F54E25; }
        .sidebar-label { display: ${isExpanded ? 'block' : 'none'}; font-weight: 700; font-size: 18px; line-height: 1.2; color: #707EAE; white-space: normal; word-break: break-word; }
        .sidebar-icon-wrap { padding: 12px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .sidebar-footer { position: absolute; left: 0; right: 0; bottom: 20px; width: 100%; }
        .sidebar-footer .sidebar-nav-item { margin-bottom: 0; }
        .sidebar-footer .sidebar-nav-item + .sidebar-nav-item { margin-top: 14px; }
        .main-view { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .top-nav { height: 85px; background: #fff; display: flex; align-items: center; padding: 0 30px; border-bottom: 1px solid #F1F1F1; box-sizing: border-box; z-index: 300; }
        .top-nav-left { display: flex; align-items: center; gap: 40px; flex-wrap: wrap; min-width: 0; }
        .view-title { color: #F54E25; font-weight: 700; font-size: 20px; }
        .welcome-text { color: #1B2559; font-weight: 500; font-size: 16px; }
        .scroll-content { flex: 1; overflow-y: auto; padding: 30px 40px; background: ${FAMILY_COLORS.background}; }
        .content-wrap { width: 100%; max-width: min(1560px, 100%); margin: 0 auto; }
        .panel-card { background: #fff; border: 1px solid #E9EDF7; border-radius: 14px; padding: 16px; }
        .reports-header { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 14px; }
        .reports-title { color: #1B2559; font-size: 18px; font-weight: 800; line-height: 1.2; }
        .reports-subtitle { color: #64748B; font-size: 13px; font-weight: 600; margin-top: 5px; }
        .week-select { border: 1px solid #E2E8F0; border-radius: 10px; padding: 9px 11px; font-size: 12px; font-weight: 600; color: #1B2559; background: #fff; min-width: 116px; }
        .patient-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        .patient-btn { border: 1px solid #E9EDF7; border-radius: 14px; background: #fff; padding: 14px; text-align: left; cursor: pointer; transition: border-color .15s ease, box-shadow .15s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.02); }
        .patient-btn:hover { border-color: #f5d0c4; box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06); }
        .patient-name { font-size: 1rem; font-weight: 800; color: #1B2559; margin-bottom: 8px; }
        .patient-meta { font-size: 12px; color: #64748B; font-weight: 600; margin-bottom: 4px; }
        .report-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.28); backdrop-filter: blur(6px); display: flex; justify-content: center; align-items: center; z-index: 3000; padding: 16px; box-sizing: border-box; }
        .report-modal { width: min(640px, 100%); max-height: min(88vh, 900px); background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(15, 23, 42, 0.06), 0 24px 48px rgba(15, 23, 42, 0.06); display: flex; flex-direction: column; border: 1px solid #e8eaef; border-top: 3px solid #F54E25; }
        .report-header { background: linear-gradient(180deg, #fffdfb 0%, #fafbfc 100%); padding: 18px 22px 16px; color: #1e293b; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 1px solid #f0e8e4; }
        .report-title-kicker { font-size: 11px; font-weight: 600; color: #c2410c; letter-spacing: 0.04em; margin-bottom: 4px; text-transform: uppercase; }
        .report-title-main { font-size: 1.125rem; font-weight: 700; color: #0f172a; line-height: 1.35; letter-spacing: -0.02em; }
        .report-title-accent { color: #F54E25; font-weight: 700; }
        .report-title-desc { font-size: 13px; color: #64748b; margin-top: 8px; line-height: 1.5; font-weight: 400; max-width: 32rem; }
        .report-header-close { border: none; background: transparent; border-radius: 10px; padding: 8px; cursor: pointer; color: #94a3b8; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background .15s, color .15s; }
        .report-header-close:hover { background: #fff5f0; color: #F54E25; }
        .report-modal-body { flex: 1; min-height: 0; overflow-y: auto; padding: 18px 20px 20px; color-scheme: light; background: #f9f9fb; display: grid; gap: 10px; }
        .report-row { background: #ffffff; border: 1px solid #e8eaef; border-radius: 10px; padding: 11px 12px 10px; }
        .report-label { font-size: 12px; color: #475569; font-weight: 700; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
        .report-value { color: #1B2559; font-size: 13px; font-weight: 600; line-height: 1.6; }
        .mobile-bottom-nav, .mobile-top-bar { display: none; }
        @media (max-width: 900px) {
          .patient-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 768px) {
          .desktop-sidebar, .top-nav { display: none !important; }
          .mobile-top-bar { display: flex !important; align-items: center; justify-content: space-between; padding: 0 20px; height: 60px; background: #fff; border-bottom: 1px solid #F1F1F1; }
          .scroll-content { padding: 15px !important; padding-bottom: 90px !important; }
          .reports-header { flex-direction: column; align-items: stretch; }
          .report-modal { width: 94%; max-height: 86vh; }
          .report-header { padding: 16px 16px 14px; }
          .report-modal-body { padding: 14px 14px 16px; }
          .mobile-bottom-nav { position: fixed; left: 0; right: 0; bottom: 0; height: 70px; background: #fff; border-top: 1px solid #EEE; display: flex; justify-content: space-around; align-items: center; z-index: 1000; }
        }
      `}</style>

      <aside className="desktop-sidebar" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="sidebar-logo-container"><img src={logo} alt="BH" className="sidebar-logo" /></div>
        <div className="sidebar-primary">
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/home'); }}><div className="sidebar-icon-wrap"><Home size={22} color="#707EAE" /></div><span className="sidebar-label">Dashboard</span></div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/progress'); }}><div className="sidebar-icon-wrap"><ClipboardList size={22} color="#707EAE" /></div><span className="sidebar-label">Request Management</span></div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/appointments'); }}><div className="sidebar-icon-wrap"><Calendar size={22} color="#707EAE" /></div><span className="sidebar-label">Appointments</span></div>
          <div className="sidebar-nav-item sidebar-nav-active" onClick={(e) => e.stopPropagation()}><div className="sidebar-icon-wrap"><BarChart3 size={22} color="#707EAE" /></div><span className="sidebar-label">Reports</span></div>
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/profile'); }}><div className="sidebar-icon-wrap"><User size={22} color="#707EAE" /></div><span className="sidebar-label">Profile</span></div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/login'); }}><div className="sidebar-icon-wrap"><LogOut size={22} color="#F54E25" /></div><span className="sidebar-label" style={{ color: '#F54E25' }}>Logout</span></div>
        </div>
      </aside>

      <main className="main-view">
        <header className="top-nav">
          <div className="top-nav-left">
            <span className="view-title">Reports</span>
            <span className="welcome-text">Weekly progress updates</span>
          </div>
        </header>

        <div className="mobile-top-bar">
          <img src={logo} alt="BH" style={{ width: 48 }} />
          <span style={{ color: '#1B2559', fontWeight: 800 }}>Reports</span>
        </div>

        <div className="scroll-content">
          <div className="content-wrap">
            <div className="panel-card">
              <div className="reports-header">
                <div>
                  <div className="reports-title">Patient Weekly Reports</div>
                  <div className="reports-subtitle">Select a week first, then choose a patient to open the report popup.</div>
                </div>
                <select className="week-select" value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)}>
                  <option value="Week 1">Week 1</option>
                  <option value="Week 2">Week 2</option>
                  <option value="Week 3">Week 3</option>
                  <option value="Week 4">Week 4</option>
                </select>
              </div>

              <div className="patient-grid">
                {samplePatients.map((patient) => (
                  <button key={patient.id} type="button" className="patient-btn" onClick={() => setSelectedPatient(patient)}>
                    <div className="patient-name">{patient.name}</div>
                    <div className="patient-meta">Age: {patient.age}</div>
                    <div className="patient-meta">Admitted: {patient.admissionDate}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <nav className="mobile-bottom-nav">
          <Home size={24} color="#A3AED0" onClick={() => navigate('/home')} />
          <ClipboardList size={24} color="#A3AED0" onClick={() => navigate('/progress')} />
          <Calendar size={24} color="#A3AED0" onClick={() => navigate('/appointments')} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }} onClick={() => navigate('/reports')}>
            <BarChart3 size={24} color="#F54E25" />
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#F54E25' }}>Reports</span>
          </div>
          <User size={24} color="#A3AED0" onClick={() => navigate('/profile')} />
        </nav>
      </main>

      {selectedPatient && (
        <div className="report-overlay" onClick={() => setSelectedPatient(null)}>
          <div className="report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="report-header">
              <div>
                <div className="report-title-kicker">Care updates</div>
                <div className="report-title-main">
                  <span className="report-title-accent">{selectedWeek}</span> report
                </div>
                <div className="report-title-desc">{selectedPatient.name} weekly patient report details.</div>
              </div>
              <button type="button" className="report-header-close" onClick={() => setSelectedPatient(null)} aria-label="Close report">
                <X size={20} />
              </button>
            </div>
            <div className="report-modal-body">
              <div className="report-row">
                <div className="report-label"><FileText size={14} />Summary</div>
                <div className="report-value">{weeklyReport?.summary || 'No report available for this week.'}</div>
              </div>
              <div className="report-row">
                <div className="report-label">Progress</div>
                <div className="report-value">{weeklyReport?.progress || 'N/A'}</div>
              </div>
              <div className="report-row">
                <div className="report-label">Nurse Notes</div>
                <div className="report-value">{weeklyReport?.notes || 'No notes available.'}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
