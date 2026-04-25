import React, { useEffect, useRef, useState } from 'react';
import { Home, TrendingUp, User, LogOut, Calendar, BarChart3, ClipboardList, FileText, X, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logo from '@/assets/kalingalogo.png';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { uiPatientFromRow } from '@/lib/dbMappers';
import { APP_DATA_REFRESH } from '@/lib/appDataRefresh';
import FloatingChatHead from '@/components/family/FloatingChatHead';

const PatientDetailsPage = () => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [displayName, setDisplayName] = useState('Family User');
  const [patients, setPatients] = useState([]);
  const [patientDetailsById, setPatientDetailsById] = useState({});
  const [weeklyReportsByPatient, setWeeklyReportsByPatient] = useState({});
  const [patientImages, setPatientImages] = useState({});
  const [selectedPatient, setSelectedPatient] = useState(null);
  const fileInputRefs = useRef([]);
  const firstName =
    String(displayName || 'Family User')
      .trim()
      .split(/\s+/)
      .filter(Boolean)[0] || 'Family';

  useEffect(() => {
    let mounted = true;
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      const fallbackProfile = localStorage.getItem('bh_family_profile');
      const fallbackName = fallbackProfile ? JSON.parse(fallbackProfile).fullName : null;
      const name =
        user?.user_metadata?.full_name ||
        [user?.user_metadata?.first_name, user?.user_metadata?.last_name].filter(Boolean).join(' ') ||
        fallbackName ||
        'Family User';
      if (mounted) setDisplayName(name);
    };
    loadUser();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadPatients = async () => {
      if (!isSupabaseConfigured()) {
        const saved = localStorage.getItem('bh_patients');
        if (!cancelled) {
          setPatients(saved ? JSON.parse(saved) : []);
          setPatientDetailsById({});
          setWeeklyReportsByPatient({});
        }
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) {
          setPatients([]);
          setPatientDetailsById({});
          setWeeklyReportsByPatient({});
        }
        return;
      }

      const fetchPatientsRows = async () => {
        const runQuery = (selectClause, scopeFamily = true) => {
          let q = supabase
            .from('patients')
            .select(selectClause)
            .is('discharged_at', null)
            .order('admitted_at', { ascending: false });
          if (scopeFamily) q = q.eq('family_id', user.id);
          return q;
        };

        const extendedFamily = await runQuery(
          'id, full_name, admitted_at, progress_percent, clinical_status, family_id, discharged_at, date_of_birth, gender, primary_concern, room_code, room_gender_segment, case_load_manager, program_staff, medical_staff_note, progress_updated_at',
          true
        );
        if (!extendedFamily.error && (extendedFamily.data || []).length > 0) return extendedFamily;

        const minimalFamily = await runQuery(
          'id, full_name, admitted_at, progress_percent, clinical_status, family_id, discharged_at, primary_concern, room_code',
          true
        );
        if (!minimalFamily.error && (minimalFamily.data || []).length > 0) return minimalFamily;
        return minimalFamily;
      };

      const { data: rows, error } = await fetchPatientsRows();
      const mapApprovedAdmissionsToPatients = async () => {
        const { data: admissions, error: admissionsError } = await supabase
          .from('admission_requests')
          .select('id, patient_name, patient_birth_date, reason_for_admission, status, created_at, decided_at')
          .eq('family_id', user.id)
          .eq('status', 'approved')
          .order('decided_at', { ascending: false });
        if (admissionsError || !(admissions || []).length) return [];
        return admissions.map((a) => ({
          id: `admission-${a.id}`,
          name: a.patient_name || 'Approved Patient',
          date: formatDate(a.decided_at || a.created_at),
          progress: 0,
          reason: a.reason_for_admission || '',
          status: 'Recovering',
          dateOfBirth: a.patient_birth_date || '',
        }));
      };

      if (!cancelled) {
        if (error) {
          const approvedFallback = await mapApprovedAdmissionsToPatients();
          if (approvedFallback.length) {
            setPatients(approvedFallback);
          } else {
            const saved = localStorage.getItem('bh_patients');
            setPatients(saved ? JSON.parse(saved) : []);
          }
          setPatientDetailsById({});
          setWeeklyReportsByPatient({});
        } else {
          const mappedPatients = (rows || []).map((r) => uiPatientFromRow(r)).filter(Boolean);
          if (mappedPatients.length > 0) {
            setPatients(mappedPatients);
          } else {
            const approvedFallback = await mapApprovedAdmissionsToPatients();
            if (approvedFallback.length) {
              setPatients(approvedFallback);
            } else {
              const saved = localStorage.getItem('bh_patients');
              setPatients(saved ? JSON.parse(saved) : []);
            }
          }
          const details = {};
          for (const row of rows || []) details[String(row.id)] = row;
          setPatientDetailsById(details);
          const ids = (rows || []).map((r) => r.id).filter(Boolean);
          if (!ids.length) {
            setWeeklyReportsByPatient({});
            return;
          }
          const { data: reportRows, error: reportError } = await supabase
            .from('weekly_reports')
            .select('*')
            .in('patient_id', ids)
            .order('week_number', { ascending: true });
          if (reportError || !reportRows) {
            setWeeklyReportsByPatient({});
          } else {
            const byPatient = {};
            for (const row of reportRows) {
              const key = String(row.patient_id);
              if (!byPatient[key]) byPatient[key] = [];
              byPatient[key].push(row);
            }
            setWeeklyReportsByPatient(byPatient);
          }
        }
      }
    };

    loadPatients();
    window.addEventListener('storage', loadPatients);
    window.addEventListener(APP_DATA_REFRESH, loadPatients);
    return () => {
      cancelled = true;
      window.removeEventListener('storage', loadPatients);
      window.removeEventListener(APP_DATA_REFRESH, loadPatients);
    };
  }, []);

  const handleImageChange = (index, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const imageUrl = URL.createObjectURL(file);
    setPatientImages((prev) => ({ ...prev, [index]: imageUrl }));
  };

  const triggerFileInput = (index) => {
    fileInputRefs.current[index]?.click();
  };

  const patientStatusTone = (progress) => {
    const value = Number(progress) || 0;
    if (value >= 70) return { label: 'Stable', bg: '#DCFCE7', color: '#166534' };
    if (value >= 40) return { label: 'Recovering', bg: '#FEF3C7', color: '#92400E' };
    return { label: 'Needs Attention', bg: '#FEE2E2', color: '#991B1B' };
  };

  const patientSummaryPayload = (patient) => {
    const value = Number(patient?.progress) || 0;
    const adherence = Math.min(100, Math.max(0, value + 8));
    const emotional = Math.min(100, Math.max(0, value + 5));
    const physical = Math.min(100, Math.max(0, value + 10));
    return {
      status: patientStatusTone(value).label,
      summary:
        value >= 70
          ? 'Patient shows consistent recovery and strong response to the care plan.'
          : value >= 40
            ? 'Patient shows moderate progress and benefits from continued monitoring.'
            : 'Patient requires closer follow-up and additional recovery support.',
      goals: [
        'Maintain appointment attendance and family check-ins.',
        'Complete weekly counseling and progress documentation.',
        'Monitor medication and wellness adherence daily.',
      ],
      reviewRows: [
        { label: 'Treatment Adherence', value: `${adherence}%`, note: 'Based on latest care updates' },
        { label: 'Emotional Stability', value: `${emotional}%`, note: 'Counselor observations' },
        { label: 'Physical Wellness', value: `${physical}%`, note: 'Nurse wellness checks' },
      ],
    };
  };

  const selectedReports = selectedPatient ? (weeklyReportsByPatient[String(selectedPatient.id)] || []) : [];
  const totalReportsSubmitted = Object.values(weeklyReportsByPatient || {}).reduce((acc, rows) => acc + (rows?.length || 0), 0);
  const averageProgress = patients.length
    ? Math.round(patients.reduce((sum, p) => sum + (Number(p.progress) || 0), 0) / patients.length)
    : 0;
  const patientsWithReports = Object.values(weeklyReportsByPatient || {}).filter((rows) => (rows?.length || 0) > 0).length;
  const pendingReviewCount = Math.max(0, patients.length - patientsWithReports);
  const latestWeeklyReports = Object.entries(weeklyReportsByPatient || {})
    .flatMap(([patientId, rows]) =>
      (rows || []).map((row) => ({
        patientId,
        week: row.week_number || '-',
        submittedAt: row.submitted_at || row.created_at || null,
        nurseName: row.nurse_name || 'Assigned Nurse',
      }))
    )
    .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime())
    .slice(0, 4);
  const selectedPatientDetails = selectedPatient ? patientDetailsById[String(selectedPatient.id)] : null;
  const formatDate = (iso) => {
    if (!iso) return 'N/A';
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'N/A';
    }
  };
  const calculateAge = (dob) => {
    if (!dob) return 'N/A';
    const date = new Date(dob);
    if (Number.isNaN(date.getTime())) return 'N/A';
    const now = new Date();
    let age = now.getFullYear() - date.getFullYear();
    const m = now.getMonth() - date.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < date.getDate())) age -= 1;
    return age >= 0 ? age : 'N/A';
  };

  return (
    <div className="app-container">
      <style>{`
        .app-container {
          display: flex;
          width: 100vw;
          height: 100vh;
          background: #F8F9FD;
          font-family: 'Inter', -apple-system, sans-serif;
          overflow: hidden;
        }
        .desktop-sidebar {
          width: ${isExpanded ? '280px' : '110px'};
          background: white;
          border-right: 1px solid #F1F1F1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 25px 0 170px;
          z-index: 100;
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          position: relative;
        }
        .sidebar-logo-container { display: flex; justify-content: center; width: 100%; margin-bottom: 40px; }
        .sidebar-logo { width: ${isExpanded ? '120px' : '70px'}; transition: width 0.3s ease; }
        .sidebar-nav-item {
          display: flex;
          align-items: center;
          width: 100%;
          padding: 0 ${isExpanded ? '35px' : '0'};
          justify-content: ${isExpanded ? 'flex-start' : 'center'};
          gap: 20px;
          margin-bottom: 25px;
          min-height: 52px;
          box-sizing: border-box;
          border: 2px solid transparent;
          border-radius: 12px;
        }
        .sidebar-icon-wrap {
          padding: 12px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .sidebar-nav-item.sidebar-nav-active { border-color: #F54E25; }
        .sidebar-label {
          display: ${isExpanded ? 'block' : 'none'};
          font-weight: 700;
          font-size: 18px;
          color: #707EAE;
          max-width: 140px;
          white-space: normal;
          overflow-wrap: anywhere;
          line-height: 1.2;
        }
        .sidebar-primary { width: 100%; }
        .sidebar-footer {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 20px;
          width: 100%;
        }
        .sidebar-footer .sidebar-nav-item { margin-bottom: 0; }
        .sidebar-footer .sidebar-nav-item + .sidebar-nav-item { margin-top: 14px; }
        .main-view { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .top-nav {
          height: 85px;
          background: white;
          display: flex;
          align-items: center;
          padding: 0 30px;
          border-bottom: 1px solid #F1F1F1;
          box-sizing: border-box;
        }
        .top-nav-left { display: flex; align-items: center; gap: 30px; }
        .view-title { color: #F54E25; font-weight: 700; font-size: 20px; }
        .welcome-text { color: #1B2559; font-weight: 500; font-size: 16px; }
        .scroll-content { flex: 1; padding: 24px 26px; overflow-y: auto; }
        .content-wrap { width: 100%; max-width: 1500px; margin: 0 auto; }
        .section-header { margin-bottom: 14px; }
        .section-title { color: #1B2559; font-size: 1.35rem; font-weight: 800; margin: 0; }
        .section-subtitle { color: #64748b; font-size: 13px; margin-top: 4px; }
        .report-cards-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }
        .report-card {
          border: 1px solid #E6EDF9;
          border-radius: 14px;
          background: #fff;
          padding: 12px;
          box-shadow: 0 6px 14px rgba(15, 23, 42, 0.04);
        }
        .report-kicker {
          color: #7C3AED;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          margin-bottom: 6px;
        }
        .patient-table-card {
          border: 1px solid #E6EDF9;
          border-radius: 14px;
          background: #fff;
          overflow: hidden;
          margin-bottom: 16px;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.04);
          width: 100%;
        }
        .patient-table-head {
          padding: 12px 14px;
          border-bottom: 1px solid #EEF3FB;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          background: linear-gradient(180deg, #fffdfb 0%, #ffffff 100%);
        }
        .patient-table-scroll {
          overflow-x: auto;
        }
        .patient-table {
          width: 100%;
          min-width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 12px;
        }
        .patient-table th {
          text-align: left;
          color: #64748B;
          font-weight: 800;
          padding: 11px 12px;
          background: #F8FAFE;
          border-bottom: 1px solid #EEF3FB;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          font-size: 10px;
          white-space: nowrap;
        }
        .patient-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #EEF3FB;
          color: #334155;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .patient-table th.num-col,
        .patient-table td.num-col {
          text-align: center;
        }
        .patient-table th.status-col,
        .patient-table td.status-col {
          text-align: left;
        }
        .patient-table tr:last-child td { border-bottom: none; }
        .patient-table tbody tr:hover td {
          background: #FBFDFF;
        }
        .details-hint {
          margin-top: 8px;
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #EEF4FF;
          border: 1px solid #DCE7FF;
          border-radius: 999px;
          padding: 4px 10px;
        }
        .patient-card {
          width: 100%;
          background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
          border: 1px solid #E6EDF9;
          border-radius: 16px;
          padding: 18px 22px;
          display: grid;
          grid-template-columns: auto minmax(220px, 1fr) minmax(220px, 300px) minmax(200px, 260px);
          gap: 14px 16px;
          align-items: center;
          margin-bottom: 12px;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.04);
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
          overflow: hidden;
        }
        .patient-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 26px rgba(15, 23, 42, 0.08);
          border-color: #D6E0F4;
        }
        .patient-img-placeholder {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: #F4F7FE;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px dashed #A3AED0;
          cursor: pointer;
          overflow: hidden;
        }
        .patient-attached-img { width: 100%; height: 100%; object-fit: cover; }
        .progress-track {
          height: 8px;
          background: #F4F7FE;
          border-radius: 10px;
          overflow: hidden;
        }
        .progress-fill { height: 100%; background: #4318FF; border-radius: 10px; }
        .status-chip {
          background: #FFF9C4;
          color: #856404;
          font-size: 11px;
          padding: 4px 10px;
          border-radius: 999px;
          font-weight: 700;
        }
        .card-right {
          display: grid;
          gap: 10px;
        }
        .patient-summary-cell {
          border: 1px solid #E6EDF9;
          border-radius: 12px;
          background: #FCFDFF;
          padding: 10px 12px;
        }
        .summary-metric-line {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          color: #475569;
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 6px;
        }
        .summary-metric-line:last-child { margin-bottom: 0; }
        .view-details-btn {
          border: none;
          border-radius: 10px;
          background: #EEF2FF;
          color: #3730A3;
          font-size: 12px;
          font-weight: 800;
          padding: 8px 12px;
          cursor: pointer;
          justify-self: end;
        }
        .details-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.34);
          backdrop-filter: blur(3px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 4000;
          padding: 18px;
        }
        .details-modal {
          width: min(860px, 100%);
          max-height: 88vh;
          overflow: auto;
          border-radius: 18px;
          background: #fff;
          border: 1px solid #E6EDF9;
          box-shadow: 0 24px 44px rgba(15, 23, 42, 0.2);
        }
        .details-modal-head {
          padding: 16px 18px;
          border-bottom: 1px solid #EEF3FB;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          background: linear-gradient(180deg, #fffdfb 0%, #ffffff 100%);
          position: sticky;
          top: 0;
          z-index: 2;
        }
        .details-modal-body {
          padding: 16px 18px 18px;
          display: grid;
          gap: 14px;
        }
        .detail-grid {
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          gap: 12px;
        }
        .detail-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .detail-card {
          border: 1px solid #E6EDF9;
          border-radius: 12px;
          background: #FCFDFF;
          padding: 12px;
        }
        .detail-title {
          color: #1B2559;
          font-size: 13px;
          font-weight: 800;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .review-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 0;
          border-bottom: 1px solid #EEF3FB;
        }
        .review-row:last-child { border-bottom: none; }
        .review-value {
          color: #1B2559;
          font-weight: 800;
          font-size: 13px;
        }
        .mini-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .mini-table th {
          text-align: left;
          color: #64748B;
          font-weight: 800;
          padding: 8px 10px;
          background: #F8FAFE;
          border-bottom: 1px solid #EEF3FB;
        }
        .mini-table td {
          padding: 8px 10px;
          color: #334155;
          border-bottom: 1px solid #EEF3FB;
          font-weight: 600;
        }
        .mini-table tr:last-child td { border-bottom: none; }
        .week-status-pill {
          display: inline-flex;
          border-radius: 999px;
          padding: 3px 8px;
          font-size: 10px;
          font-weight: 800;
          background: #DCFCE7;
          color: #166534;
        }
        .close-modal-btn {
          border: none;
          background: transparent;
          color: #1B2559;
          padding: 0;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .close-modal-btn:hover {
          color: #0F172A;
        }
        .close-modal-btn svg {
          display: block;
          width: 24px;
          height: 24px;
          stroke-width: 2.2;
        }
        .empty-state {
          background: white;
          border: 1px dashed #D6E0F5;
          border-radius: 16px;
          padding: 30px;
          text-align: center;
          color: #64748B;
          font-weight: 600;
        }
        @media (max-width: 768px) {
          .desktop-sidebar { display: none; }
          .top-nav { padding: 0 18px; height: 72px; }
          .top-nav-left { gap: 12px; }
          .welcome-text { font-size: 13px; }
          .scroll-content { padding: 14px; }
          .patient-card { grid-template-columns: 1fr; }
          .card-right { justify-self: stretch; }
          .view-details-btn { justify-self: start; }
          .detail-grid { grid-template-columns: 1fr; }
          .detail-grid-2 { grid-template-columns: 1fr; }
          .report-cards-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      <aside className="desktop-sidebar" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="sidebar-logo-container">
          <img src={logo} alt="Kalinga" className="sidebar-logo" />
        </div>
        <div className="sidebar-primary">
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/home'); }}>
            <div className="sidebar-icon-wrap">
              <Home size={22} color="#707EAE" />
            </div>
            <span className="sidebar-label">Dashboard</span>
          </div>
          <div className="sidebar-nav-item sidebar-nav-active" onClick={(e) => { e.stopPropagation(); navigate('/patient-details'); }}>
            <div className="sidebar-icon-wrap">
              <ClipboardList size={22} color="#707EAE" />
            </div>
            <span className="sidebar-label">Patient Details</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/progress'); }}>
            <div className="sidebar-icon-wrap">
              <TrendingUp size={22} color="#707EAE" />
            </div>
            <span className="sidebar-label">Request Management</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/appointments'); }}>
            <div className="sidebar-icon-wrap">
              <Calendar size={22} color="#707EAE" />
            </div>
            <span className="sidebar-label">Appointments</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/reports'); }}>
            <div className="sidebar-icon-wrap">
              <BarChart3 size={22} color="#707EAE" />
            </div>
            <span className="sidebar-label">Reports</span>
          </div>
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/profile'); }}>
            <div className="sidebar-icon-wrap">
              <User size={22} color="#707EAE" />
            </div>
            <span className="sidebar-label">Profile</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/login'); }}>
            <div className="sidebar-icon-wrap">
              <LogOut size={22} color="#F54E25" />
            </div>
            <span className="sidebar-label" style={{ color: '#F54E25' }}>Logout</span>
          </div>
        </div>
      </aside>

      <div className="main-view">
        <header className="top-nav">
          <div className="top-nav-left">
            <span className="view-title">Patient Details</span>
            <span className="welcome-text">Welcome Back, {firstName}</span>
          </div>
        </header>

        <div className="scroll-content">
          <div className="content-wrap">
            <div className="section-header">
              <h2 className="section-title">Assigned Patients</h2>
              <div className="section-subtitle">View current admissions and monitor progress in one place.</div>
              <div className="details-hint">
                <FileText size={14} /> Click any patient to view summary and review
              </div>
            </div>

            <div className="report-cards-grid">
              {latestWeeklyReports.length ? latestWeeklyReports.map((item, idx) => (
                <div className="report-card" key={`${item.patientId}-${item.week}-${idx}`}>
                  <div className="report-kicker">Weekly Report</div>
                  <div style={{ color: '#0F172A', fontWeight: 800, fontSize: 13, marginBottom: 3 }}>Week {item.week}</div>
                  <div style={{ color: '#334155', fontSize: 12, fontWeight: 700 }}>Patient ID: {String(item.patientId).slice(0, 8)}</div>
                  <div style={{ color: '#64748B', fontSize: 11, marginTop: 3 }}>{formatDate(item.submittedAt)}</div>
                  <div style={{ color: '#64748B', fontSize: 11, marginTop: 4 }}>Nurse: {item.nurseName}</div>
                </div>
              )) : (
                <div className="report-card" style={{ gridColumn: '1 / -1' }}>
                  <div style={{ color: '#94A3B8', fontSize: 12, fontWeight: 700 }}>No weekly reports submitted yet.</div>
                </div>
              )}
            </div>

            <div className="patient-table-card">
              <div className="patient-table-head">
                <div className="detail-title" style={{ marginBottom: 0 }}><BarChart3 size={15} color="#F54E25" /> Patient Directory Table</div>
                <span style={{ color: '#64748B', fontSize: 11, fontWeight: 700 }}>{patients.length} entries</span>
              </div>
              <div className="patient-table-scroll">
                <table className="patient-table">
                  <colgroup>
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '11%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Admission Date</th>
                      <th className="num-col">Progress</th>
                      <th className="status-col">Status</th>
                      <th>Primary Concern</th>
                      <th>Room</th>
                      <th className="num-col">Weekly Reports</th>
                      <th>Latest Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patients.length ? patients.map((p) => (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td>{p.date || 'N/A'}</td>
                        <td className="num-col">{Number(p.progress) || 0}%</td>
                        <td className="status-col" style={{ color: patientStatusTone(p.progress).color }}>{patientStatusTone(p.progress).label}</td>
                        <td>{patientDetailsById[String(p.id)]?.primary_concern || p.reason || 'N/A'}</td>
                        <td>{patientDetailsById[String(p.id)]?.room_code || p.roomCode || 'Unassigned'}</td>
                        <td className="num-col">{(weeklyReportsByPatient[String(p.id)] || []).length}</td>
                        <td>{(weeklyReportsByPatient[String(p.id)] || []).length ? 'Available' : 'Waiting'}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={8} style={{ color: '#94A3B8' }}>No patients yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {patients.length === 0 ? (
              <div className="empty-state">
                No active patients yet. Once admissions are approved, patient details will appear here.
              </div>
            ) : (
              patients.map((p, i) => (
                <div key={p.id || i} className="patient-card" onClick={() => setSelectedPatient(p)}>
                  <div className="patient-img-placeholder" onClick={() => triggerFileInput(i)}>
                    <input type="file" hidden accept="image/*" ref={(el) => { fileInputRefs.current[i] = el; }} onChange={(e) => handleImageChange(i, e)} />
                    {patientImages[i] ? (
                      <img src={patientImages[i]} alt="" className="patient-attached-img" />
                    ) : (
                      <User size={22} color="#A3AED0" opacity={0.5} />
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1B2559' }}>{p.name}</span>
                      <span className="status-chip">Recovering</span>
                    </div>
                    <div style={{ color: '#1B2559', fontSize: 13, fontWeight: 600 }}>{p.date}</div>
                    <div style={{ color: '#A3AED0', fontSize: 11 }}>Date of Admission</div>
                  </div>
                  <div className="patient-summary-cell">
                    <div className="summary-metric-line">
                      <span>Status</span>
                      <span style={{ color: patientStatusTone(p.progress).color }}>{patientStatusTone(p.progress).label}</span>
                    </div>
                    <div className="summary-metric-line">
                      <span>Primary Concern</span>
                      <span>{patientDetailsById[String(p.id)]?.primary_concern || 'N/A'}</span>
                    </div>
                    <div className="summary-metric-line">
                      <span>Weekly Reports</span>
                      <span>{(weeklyReportsByPatient[String(p.id)] || []).length} submitted</span>
                    </div>
                    <div className="summary-metric-line">
                      <span>Latest Review</span>
                      <span>{(weeklyReportsByPatient[String(p.id)] || []).length ? 'Available' : 'Waiting'}</span>
                    </div>
                  </div>
                  <div className="card-right">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ color: '#64748B', fontSize: 12, fontWeight: 700 }}>Recovery Progress</span>
                      <span style={{ color: '#1B2559', fontSize: 12, fontWeight: 700 }}>{Number(p.progress) || 0}%</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${Number(p.progress) || 0}%` }} />
                    </div>
                    <button
                      type="button"
                      className="view-details-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPatient(p);
                      }}
                    >
                      View Summary & Review
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {selectedPatient && (
        <div className="details-overlay" onClick={() => setSelectedPatient(null)}>
          <div className="details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="details-modal-head">
              <div>
                <div style={{ color: '#1B2559', fontSize: 18, fontWeight: 800 }}>{selectedPatient.name}</div>
                <div style={{ color: '#64748B', fontSize: 13, marginTop: 3 }}>
                  Admission date: {selectedPatient.date || 'N/A'} · Progress: {Number(selectedPatient.progress) || 0}%
                </div>
              </div>
              <button type="button" className="close-modal-btn" onClick={() => setSelectedPatient(null)} aria-label="Close">
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>
            <div className="details-modal-body">
              <div className="detail-grid">
                <div className="detail-card">
                  <div className="detail-title"><FileText size={15} color="#F54E25" /> Patient Summary</div>
                  <p style={{ color: '#334155', fontSize: 13, lineHeight: 1.55, margin: 0 }}>
                    {patientSummaryPayload(selectedPatient).summary}
                  </p>
                  <div style={{ marginTop: 10, display: 'inline-flex', borderRadius: 999, background: '#EEF2FF', color: '#3730A3', padding: '4px 10px', fontSize: 11, fontWeight: 800 }}>
                    {patientSummaryPayload(selectedPatient).status}
                  </div>
                </div>
                <div className="detail-card">
                  <div className="detail-title"><BarChart3 size={15} color="#F54E25" /> Patient Data</div>
                  <table className="mini-table">
                    <tbody>
                      <tr>
                        <th>Patient Name</th>
                        <td>{selectedPatient.name}</td>
                      </tr>
                      <tr>
                        <th>Admission Date</th>
                        <td>{selectedPatient.date || 'N/A'}</td>
                      </tr>
                      <tr>
                        <th>Progress</th>
                        <td>{Number(selectedPatient.progress) || 0}%</td>
                      </tr>
                      <tr>
                        <th>Status</th>
                        <td>{patientStatusTone(selectedPatient.progress).label}</td>
                      </tr>
                      <tr>
                        <th>Primary Concern</th>
                        <td>{selectedPatientDetails?.primary_concern || selectedPatient.reason || 'N/A'}</td>
                      </tr>
                      <tr>
                        <th>Age</th>
                        <td>{calculateAge(selectedPatientDetails?.date_of_birth || selectedPatient.dateOfBirth)}</td>
                      </tr>
                      <tr>
                        <th>Gender</th>
                        <td>{selectedPatientDetails?.gender || selectedPatient.gender || 'N/A'}</td>
                      </tr>
                      <tr>
                        <th>Reports Submitted</th>
                        <td>{selectedReports.length}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="detail-grid-2">
                <div className="detail-card">
                  <div className="detail-title"><BarChart3 size={15} color="#F54E25" /> Weekly Report Timeline</div>
                  <table className="mini-table">
                    <thead>
                      <tr>
                        <th>Week</th>
                        <th>Submitted</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReports.length ? selectedReports.map((row) => (
                        <tr key={String(row.id)}>
                          <td>Week {row.week_number || '-'}</td>
                          <td>{formatDate(row.submitted_at || row.created_at)}</td>
                          <td><span className="week-status-pill">Received</span></td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={3} style={{ color: '#94A3B8' }}>No weekly reports submitted yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="detail-card">
                  <div className="detail-title"><FileText size={15} color="#F54E25" /> Summary Table</div>
                  <table className="mini-table">
                    <tbody>
                      <tr>
                        <th>Patient Name</th>
                        <td>{selectedPatient.name}</td>
                      </tr>
                      <tr>
                        <th>Admission Date</th>
                        <td>{selectedPatient.date || 'N/A'}</td>
                      </tr>
                      <tr>
                        <th>Progress</th>
                        <td>{Number(selectedPatient.progress) || 0}%</td>
                      </tr>
                      <tr>
                        <th>Room Assignment</th>
                        <td>{selectedPatientDetails?.room_code || selectedPatient.roomCode || 'Unassigned'}</td>
                      </tr>
                      <tr>
                        <th>Case Load Manager</th>
                        <td>{selectedPatientDetails?.case_load_manager || 'N/A'}</td>
                      </tr>
                      <tr>
                        <th>Program Staff</th>
                        <td>{selectedPatientDetails?.program_staff || 'N/A'}</td>
                      </tr>
                      <tr>
                        <th>Reports Submitted</th>
                        <td>{selectedReports.length}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="detail-card">
                <div className="detail-title"><CheckCircle2 size={15} color="#F54E25" /> Recommended Next Steps</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {patientSummaryPayload(selectedPatient).goals.map((goal) => (
                    <div key={goal} style={{ color: '#334155', fontSize: 13, lineHeight: 1.45 }}>
                      - {goal}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <FloatingChatHead />
    </div>
  );
};

export default PatientDetailsPage;
