import React, { useState, useEffect, useRef } from 'react';
import { LayoutGrid, BarChart2, HeartPulse, LogOut, CheckCircle2, Users, Clock, Bed, ArrowRightSquare, X, HelpCircle, ClipboardList, Stethoscope } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logoBH from '@/assets/logo2.png';
import { appendActivityFeed } from '@/lib/activityFeed';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { refreshAppData, APP_DATA_REFRESH } from '@/lib/appDataRefresh';
import {
  uiPatientFromRow,
  uiAdmissionRequestFromRow,
  uiDischargeRequestFromRow,
} from '@/lib/dbMappers';
import { loadWorkflowOverrides, loadDischargeRecords } from '@/lib/admissionDischargeStore';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);

  // --- STATE ---
  const [patients, setPatients] = useState([]);
  const [pendingAdmissions, setPendingAdmissions] = useState([]);
  const [pendingDischarges, setPendingDischarges] = useState([]);

  const [recentActivities, setRecentActivities] = useState([]);
  const [pipelineMetrics, setPipelineMetrics] = useState({
    totalAdmissions: 0,
    forDischarge: 0,
    readyDischarge: 0,
    dischargedDone: 0,
  });

  const formatActTime = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const syncDataLegacy = () => {
    const p = JSON.parse(localStorage.getItem('bh_patients') || '[]');
    const a = JSON.parse(localStorage.getItem('bh_pending_admissions') || '[]');
    const d = JSON.parse(localStorage.getItem('bh_pending_discharges') || '[]');
    const act = JSON.parse(localStorage.getItem('bh_recent_activities') || 'null');
    setPatients(p);
    setPendingAdmissions(a);
    setPendingDischarges(d);
    if (act) setRecentActivities(act);
    const ov = loadWorkflowOverrides();
    const forDischargeCount = Object.values(ov).filter((x) => x.workflowStatus === 'For Discharge' && !x.archived).length;
    const dr = loadDischargeRecords();
    const ready = dr.filter((r) => !r.archived && r.finalStatus === 'Ready for Discharge').length;
    const done = dr.filter(
      (r) => !r.archived && (r.finalStatus === 'Completed' || r.finalStatus === 'Discharged')
    ).length;
    setPipelineMetrics({
      totalAdmissions: 0,
      forDischarge: forDischargeCount,
      readyDischarge: ready,
      dischargedDone: done,
    });
  };

  const loadFromSupabase = async () => {
    const { data: p } = await supabase
      .from('patients')
      .select('*')
      .is('discharged_at', null)
      .order('admitted_at', { ascending: false });
    const { data: a } = await supabase
      .from('admission_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    const { data: d } = await supabase
      .from('discharge_requests')
      .select('*, patients(full_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    const { data: acts } = await supabase
      .from('activity_log')
      .select('id, title, description, icon_name, created_at')
      .order('created_at', { ascending: false })
      .limit(12);

    setPatients((p || []).map((r) => uiPatientFromRow(r)).filter(Boolean));
    setPendingAdmissions((a || []).map((r) => uiAdmissionRequestFromRow(r)).filter(Boolean));
    setPendingDischarges((d || []).map((r) => uiDischargeRequestFromRow(r)).filter(Boolean));
    setRecentActivities(
      (acts || []).map((row) => ({
        id: row.id,
        title: row.title,
        desc: row.description || '',
        time: formatActTime(row.created_at),
        icon: row.icon_name || 'users',
      }))
    );

    const { count: admTotal } = await supabase.from('admission_requests').select('*', { count: 'exact', head: true });
    const ov = loadWorkflowOverrides();
    const forDischargeCount = Object.values(ov).filter((x) => x.workflowStatus === 'For Discharge' && !x.archived).length;
    const dr = loadDischargeRecords();
    const ready = dr.filter((r) => !r.archived && r.finalStatus === 'Ready for Discharge').length;
    const done = dr.filter(
      (r) => !r.archived && (r.finalStatus === 'Completed' || r.finalStatus === 'Discharged')
    ).length;
    setPipelineMetrics({
      totalAdmissions: admTotal ?? 0,
      forDischarge: forDischargeCount,
      readyDischarge: ready,
      dischargedDone: done,
    });
  };

  const syncData = async () => {
    if (!isSupabaseConfigured()) {
      syncDataLegacy();
      return;
    }
    try {
      await loadFromSupabase();
    } catch (e) {
      console.warn(e);
      syncDataLegacy();
    }
  };

  useEffect(() => {
    syncData();
    window.addEventListener('storage', syncData);
    window.addEventListener(APP_DATA_REFRESH, syncData);
    return () => {
      window.removeEventListener('storage', syncData);
      window.removeEventListener(APP_DATA_REFRESH, syncData);
    };
  }, []);

  const addActivity = async (title, desc, iconName) => {
    if (!isSupabaseConfigured()) {
      const newAct = { id: Date.now(), title, desc, time: 'Just now', icon: iconName };
      setRecentActivities((prev) => [newAct, ...prev].slice(0, 12));
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from('activity_log').insert({
      title,
      description: desc,
      icon_name: iconName,
      actor_id: user?.id ?? null,
    });
    await loadFromSupabase();
  };

  const handleClearActivities = () => {
    setRecentActivities([]);
  };

  // --- MODALS STATE ---
  const [modalView, setModalView] = useState(null); // 'admissions', 'discharges', 'confirm', '2fa'
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requestType, setRequestType] = useState(null); // 'admission' or 'discharge'
  const [twoFactorCode, setTwoFactorCode] = useState(['', '', '', '', '', '']);
  const [twoFAError, setTwoFAError] = useState('');
  const [twoFAConfirming, setTwoFAConfirming] = useState(false);

  const tfaRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  // Computed metrics
  const totalPatients = patients.length;
  const availableBeds = 50 - totalPatients;
  const occupancyPerc = Math.round((totalPatients / 50) * 100);

  // --- HANDLERS ---
  const handleApproveClick = (req, type) => {
    setSelectedRequest(req);
    setRequestType(type);
    setModalView('confirm');
  };

  const handleDeclineClick = async (req, type) => {
    if (!isSupabaseConfigured()) {
      const declinedList = JSON.parse(localStorage.getItem('bh_declined_requests') || '[]');
      declinedList.push({ ...req, declinedAt: new Date().toISOString(), type });
      localStorage.setItem('bh_declined_requests', JSON.stringify(declinedList));
      if (type === 'admission') {
        const updated = pendingAdmissions.filter((p) => p.id !== req.id);
        setPendingAdmissions(updated);
        localStorage.setItem('bh_pending_admissions', JSON.stringify(updated));
        window.dispatchEvent(new Event('storage'));
        setModalView(updated.length > 0 ? 'admissions' : null);
      } else {
        const updated = pendingDischarges.filter((p) => p.id !== req.id);
        setPendingDischarges(updated);
        localStorage.setItem('bh_pending_discharges', JSON.stringify(updated));
        window.dispatchEvent(new Event('storage'));
        setModalView(updated.length > 0 ? 'discharges' : null);
      }
      await appendActivityFeed(
        type === 'admission'
          ? `Admission request for ${req.name || 'patient'} was declined by the admin.`
          : `Discharge request for ${req.name || 'patient'} was declined by the admin.`,
        { familyId: req.family_id }
      );
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    let decidedBy = user?.id ?? null;
    if (decidedBy) {
      const { data: profileRow } = await supabase.from('profiles').select('id').eq('id', decidedBy).maybeSingle();
      if (!profileRow) decidedBy = null;
    }
    const decidedAt = new Date().toISOString();
    if (type === 'admission') {
      await supabase
        .from('admission_requests')
        .update({ status: 'declined', decided_at: decidedAt, decided_by: decidedBy })
        .eq('id', req.requestId ?? req.id);
      await appendActivityFeed(
        `Admission request for ${req.name || 'patient'} was declined by the admin.`,
        { familyId: req.family_id }
      );
    } else {
      await supabase
        .from('discharge_requests')
        .update({ status: 'declined', decided_at: decidedAt, decided_by: decidedBy })
        .eq('id', req.dischargeRequestId);
      await appendActivityFeed(
        `Discharge request for ${req.name || 'patient'} was declined by the admin.`,
        { familyId: req.family_id }
      );
    }
    refreshAppData();
    await syncData();
    if (type === 'admission') {
      const { count } = await supabase
        .from('admission_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      setModalView((count || 0) > 0 ? 'admissions' : null);
    } else {
      const { count } = await supabase
        .from('discharge_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      setModalView((count || 0) > 0 ? 'discharges' : null);
    }
  };

  const handleProceedClick = () => {
    setTwoFAError('');
    setTwoFactorCode(['', '', '', '', '', '']);
    setModalView('2fa');
    // Focus first input automatically after slight delay to ensure it's rendered
    setTimeout(() => { if (tfaRefs[0].current) tfaRefs[0].current.focus(); }, 100);
  };

  const handle2FAChange = (index, value) => {
    // Only allow numbers for the password
    if (isNaN(value)) return;
    const nw = [...twoFactorCode];
    nw[index] = value.substring(value.length - 1);
    setTwoFactorCode(nw);

    // Auto-focus to next input
    if (value && index < twoFactorCode.length - 1) {
      tfaRefs[index + 1].current.focus();
    }
  };

  const handle2FAKeyDown = (index, e) => {
    // Move to previous input on backspace if current is empty
    if (e.key === 'Backspace' && !twoFactorCode[index] && index > 0) {
      tfaRefs[index - 1].current.focus();
    } else if (e.key === 'Enter') {
      if (twoFactorCode.join('').length === 6) {
        handle2FAConfirm();
      }
    }
  };

  const handle2FAConfirm = async () => {
    if (!selectedRequest || !requestType) return;
    setTwoFAError('');

    // We accept any logic since user said: "make the password clear dont put any password on it when it already done you can proceed to it"

    if (!isSupabaseConfigured()) {
      if (requestType === 'admission') {
        const newPatients = [...patients, { ...selectedRequest, progress: 0 }];
        setPatients(newPatients);
        localStorage.setItem('bh_patients', JSON.stringify(newPatients));
        const updatedPending = pendingAdmissions.filter((p) => p.id !== selectedRequest.id);
        setPendingAdmissions(updatedPending);
        localStorage.setItem('bh_pending_admissions', JSON.stringify(updatedPending));
        await addActivity('New Patient is added', `${selectedRequest.name} - ${selectedRequest.reason}`, 'users');
        await appendActivityFeed(
          `Admission approved: ${selectedRequest.name || 'Patient'} is now admitted.`,
          { familyId: selectedRequest.family_id }
        );
        window.dispatchEvent(new Event('storage'));
        setModalView(updatedPending.length > 0 ? 'admissions' : null);
      } else if (requestType === 'discharge') {
        const newPatients = patients.filter((p) => p.id !== selectedRequest.id);
        setPatients(newPatients);
        localStorage.setItem('bh_patients', JSON.stringify(newPatients));
        const updatedPending = pendingDischarges.filter((p) => p.id !== selectedRequest.id);
        setPendingDischarges(updatedPending);
        localStorage.setItem('bh_pending_discharges', JSON.stringify(updatedPending));
        await addActivity('Patient discharged successfully', `${selectedRequest.name} - Treatment completed`, 'check');
        await appendActivityFeed(
          `Discharge approved: ${selectedRequest.name || 'Patient'} has been discharged.`,
          { familyId: selectedRequest.family_id }
        );
        window.dispatchEvent(new Event('storage'));
        setModalView(updatedPending.length > 0 ? 'discharges' : null);
      }
      setSelectedRequest(null);
      setRequestType(null);
      return;
    }

    setTwoFAConfirming(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setTwoFAError('You are not signed in. Log in again as admin.');
      setTwoFAConfirming(false);
      return;
    }
    const adminId = user?.id ?? null;
    let decidedBy = adminId;
    if (adminId) {
      const { data: profileRow } = await supabase.from('profiles').select('id').eq('id', adminId).maybeSingle();
      if (!profileRow) decidedBy = null;
    }
    const decidedAt = new Date().toISOString();
    const req = selectedRequest;

    if (requestType === 'admission') {
      const admissionId = req.requestId ?? req.id;
      if (!admissionId) {
        setTwoFAError('Missing request id. Reload the dashboard and try again.');
        setTwoFAConfirming(false);
        return;
      }
      const { data: admissionUpdated, error: upErr } = await supabase
        .from('admission_requests')
        .update({ status: 'approved', decided_at: decidedAt, decided_by: decidedBy })
        .eq('id', admissionId)
        .eq('status', 'pending')
        .select('id');
      if (upErr) {
        console.error(upErr);
        setTwoFAError(upErr.message || 'Could not approve admission request.');
        setTwoFAConfirming(false);
        return;
      }
      if (!admissionUpdated?.length) {
        refreshAppData();
        await syncData();
        setModalView(null);
        setSelectedRequest(null);
        setRequestType(null);
        setTwoFAConfirming(false);
        return;
      }
      const { error: insErr } = await supabase.from('patients').insert({
        full_name: req.patient_name || req.name,
        date_of_birth: req.patient_birth_date || null,
        primary_concern: req.reason_for_admission || req.reason || null,
        clinical_status: 'Stable',
        progress_percent: 0,
        family_id: req.family_id,
      });
      if (insErr) {
        console.error(insErr);
        setTwoFAError(insErr.message || 'Could not create patient record.');
        setTwoFAConfirming(false);
        return;
      }
      await addActivity(
        'New Patient is added',
        `${req.name || req.patient_name} - ${req.reason || req.reason_for_admission}`,
        'users'
      );
      await appendActivityFeed(
        `Admission approved: ${req.name || req.patient_name || 'Patient'} is now admitted.`,
        { familyId: req.family_id }
      );
    } else if (requestType === 'discharge') {
      if (!req.dischargeRequestId || !req.patientId) {
        setTwoFAError('Missing discharge or patient id. Reload the dashboard and try again.');
        setTwoFAConfirming(false);
        return;
      }
      const { data: dischargeUpdated, error: upReqErr } = await supabase
        .from('discharge_requests')
        .update({ status: 'approved', decided_at: decidedAt, decided_by: decidedBy })
        .eq('id', req.dischargeRequestId)
        .eq('status', 'pending')
        .select('id');
      if (upReqErr) {
        console.error(upReqErr);
        setTwoFAError(upReqErr.message || 'Could not approve discharge request.');
        setTwoFAConfirming(false);
        return;
      }
      if (!dischargeUpdated?.length) {
        refreshAppData();
        await syncData();
        setModalView(null);
        setSelectedRequest(null);
        setRequestType(null);
        setTwoFAConfirming(false);
        return;
      }
      const { error: upPatErr } = await supabase
        .from('patients')
        .update({ discharged_at: decidedAt })
        .eq('id', req.patientId);
      if (upPatErr) {
        console.error(upPatErr);
        setTwoFAError(upPatErr.message || 'Could not update patient discharge.');
        setTwoFAConfirming(false);
        return;
      }
      await addActivity('Patient discharged successfully', `${req.name} - Treatment completed`, 'check');
      await appendActivityFeed(
        `Discharge approved: ${req.name || 'Patient'} has been discharged.`,
        { familyId: req.family_id }
      );
    }

    refreshAppData();
    await syncData();
    if (requestType === 'admission') {
      const { count } = await supabase
        .from('admission_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      setModalView((count || 0) > 0 ? 'admissions' : null);
    } else {
      const { count } = await supabase
        .from('discharge_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      setModalView((count || 0) > 0 ? 'discharges' : null);
    }

    setSelectedRequest(null);
    setRequestType(null);
    setTwoFAConfirming(false);
  };

  return (
    <div className="dashboard-outer" style={{ display: 'flex', minHeight: '100vh', background: '#F8F9FD', fontFamily: "'Inter', -apple-system, sans-serif", color: '#1B2559' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .dashboard-outer { width: 100%; max-width: 100%; overflow-x: hidden; }

        .desktop-sidebar {
          width: ${isExpanded ? '280px' : '110px'};
          background: white;
          border-right: 1px solid #F1F1F1;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          padding: 25px 0 0;
          z-index: 100;
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          position: fixed;
          top: 0;
          left: 0;
          height: 100vh;
          overflow: hidden;
          flex-shrink: 0;
          box-shadow: 4px 0 24px rgba(27, 37, 89, 0.06);
        }

        .sidebar-logo-container { display: flex; justify-content: center; width: 100%; margin-bottom: 28px; align-self: center; }
        .sidebar-logo { width: ${isExpanded ? '120px' : '70px'}; transition: width 0.3s ease; }

        .sidebar-nav-scroll {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          width: 100%;
          display: flex;
          flex-direction: column;
        }

        .sidebar-nav-item {
          display: flex; align-items: center; width: 100%;
          padding: 0 ${isExpanded ? '28px' : '0'};
          justify-content: ${isExpanded ? 'flex-start' : 'center'};
          gap: 14px; margin-bottom: 6px; min-height: 48px; box-sizing: border-box;
        }

        .sidebar-label {
          display: ${isExpanded ? 'block' : 'none'};
          font-weight: 600; font-size: 15px; color: #707EAE;
          line-height: 1.25; white-space: normal; max-width: 210px;
        }

        .sidebar-footer {
          flex-shrink: 0;
          width: 100%;
          padding: 16px 0 20px;
          margin-top: auto;
          border-top: 1px solid #f1f5f9;
        }

        .icon-box {
          width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s; background: #E9EDF7; color: #1B2559;
        }
        .icon-box.active { background: #F54E25; color: white; }
        .icon-box.inactive { background: transparent; color: #A3AED0; }

        .dashboard-main {
          flex: 1 1 0;
          min-height: 100vh;
          min-width: 0;
          margin-left: ${isExpanded ? '280px' : '110px'};
          transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          padding: 32px 28px 48px;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          overflow-x: hidden;
        }

        .dashboard-inner {
          min-width: 0;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }

        .metric-cards-container {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }

        .metric-card {
          background: white; border-radius: 16px; padding: 24px; border: 1px solid #E9EDF7;
          box-shadow: 0 4px 12px rgba(0,0,0,0.02); display: flex; flex-direction: column; gap: 16px;
          flex: 1 1 200px; min-width: 0; max-width: 100%;
          cursor: pointer; transition: transform 0.2s;
        }
        .metric-card:hover { transform: translateY(-2px); }

        .metric-icon-box {
          width: 48px; height: 48px; background: #FFF0ED; color: #F54E25; border-radius: 12px; display: flex; align-items: center; justify-content: center;
        }

        .metric-badge {
          background: #F4F7FE; color: #707EAE; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; height: fit-content;
        }

        .metric-value { font-size: 32px; font-weight: 800; color: #1B2559; line-height: 1; margin-bottom: 6px; }
        .metric-title { font-size: 14px; font-weight: 600; color: #707EAE; margin-bottom: 2px; }
        .metric-subtitle { font-size: 12px; font-weight: 500; color: #A3AED0; }

        .recent-activity-card {
          background: white; border-radius: 16px; padding: 32px; border: 1px solid #E9EDF7;
          box-shadow: 0 4px 12px rgba(0,0,0,0.02); margin-top: 32px;
          min-width: 0;
          max-width: 100%;
          box-sizing: border-box;
          overflow-x: hidden;
        }

        .recent-activity-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          gap: 12px;
          flex-wrap: wrap;
          min-width: 0;
        }

        .activity-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 20px 0;
          border-bottom: 1px solid #F4F7FE;
          min-width: 0;
        }
        .activity-row:last-child { border-bottom: none; padding-bottom: 0; }

        .activity-row-left {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          flex: 1;
          min-width: 0;
        }

        .activity-row-text {
          flex: 1;
          min-width: 0;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .activity-row-time {
          flex-shrink: 0;
          font-size: 12px;
          font-weight: 500;
          color: #A3AED0;
          white-space: nowrap;
          padding-top: 2px;
        }

        /* MODAL STYLES */
        .modal-overlay {
          position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
          background: rgba(0,0,0,0.4); z-index: 2000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(2px);
        }
        .modal-box {
          background: white; width: 100%; max-width: 650px; border-radius: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.1); overflow: hidden;
          padding: 30px; position: relative;
        }
        .modal-header {
          display: flex; align-items: center; gap: 15px; margin-bottom: 30px;
        }
        .modal-icon-bg {
          width: 50px; height: 50px; background: #FFF0ED; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #F54E25;
        }
        .modal-title { font-size: 24px; font-weight: 700; color: #1B2559; }
        .close-btn { position: absolute; right: 25px; top: 35px; cursor: pointer; color: #1B2559; }
        
        .request-item {
          background: #F8F9FD; padding: 20px; border-radius: 12px; margin-bottom: 15px; border: 1px solid #E9EDF7;
        }
        .req-top-row { display: flex; justify-content: space-between; align-items:flex-start; margin-bottom: 10px; }
        .req-user-block { display: flex; gap: 12px; align-items: center; }
        .req-user-icon { width: 36px; height: 36px; background: #FFF0ED; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #F54E25; }
        .req-name { font-size: 14px; font-weight: 700; color: #1B2559; }
        .req-time { font-size: 12px; color: #A3AED0; }
        .req-details { padding-left: 48px; font-size: 12px; color: #4A628A; line-height: 1.6; margin-bottom: 20px; }
        .req-buttons { display: flex; gap: 12px; justify-content: center; }
        
        .btn-approve { background: #F54E25; color: white; border: none; padding: 8px 25px; border-radius: 6px; font-weight: 700; font-size: 13px; cursor: pointer; }
        .btn-decline { background: #FF7E5F; color: white; border: none; padding: 8px 25px; border-radius: 6px; font-weight: 700; font-size: 13px; cursor: pointer; }

        .tfa-box { display: flex; justify-content: center; gap: 15px; margin: 30px 0; }
        .tfa-circle {
          width: 55px; height: 55px; border-radius: 50%; border: 1px solid #1B2559; text-align: center;
          font-size: 24px; font-weight: 700; color: #1B2559; outline: none; background: white;
        }
        .tfa-circle:focus { border-color: #F54E25; box-shadow: 0 0 0 2px rgba(245, 78, 37, 0.2); }

        .db-mobile-only { display: none; }

        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .dashboard-outer { flex-direction: column !important; }
          .dashboard-main { margin-left: 0 !important; width: 100vw !important; padding: 20px 15px 100px 15px !important; }
          .db-mobile-only { display: flex !important; }
          .db-mobile-top-bar { display: flex !important; width: 100vw; background: white; z-index: 1001; position: sticky; top: 0; padding: 0 20px; height: 64px; align-items: center; justify-content: space-between; border-bottom: 1px solid #F1F1F1; }
          .db-mobile-bottom-nav { position: fixed; bottom: 0; left: 0; width: 100vw; height: 72px; background: white; border-top: 1px solid #F1F1F1; display: flex; justify-content: space-around; align-items: center; z-index: 1000; box-shadow: 0 -4px 20px rgba(0,0,0,0.06); }
          .mob-nav-item { display: flex; flex-direction: column; align-items: center; font-size: 10px; color: #A3AED0; cursor: pointer; }
          .mob-nav-item.active { color: #F54E25; }
          .metric-cards-container { flex-direction: column !important; gap: 15px !important; }
          .metric-card { width: 100% !important; min-width: unset !important; }
          .recent-activity-card { padding: 20px !important; }
          .activity-row { flex-direction: column; align-items: flex-start; gap: 10px; padding: 15px 0; }
          .activity-row-time { align-self: flex-end; white-space: normal; text-align: right; width: 100%; }
          .modal-box { width: 95% !important; padding: 20px !important; margin: 10px; max-height: 90vh; overflow-y: auto; }
          .req-top-row { flex-direction: column; gap: 10px; }
          .req-buttons { flex-direction: column; gap: 10px; }
          .req-buttons button { width: 100%; }
          .tfa-box { gap: 10px; }
          .tfa-circle { width: 45px; height: 45px; font-size: 20px; }
          .dashboard-title-desktop { display: none !important; }
        }
      `}</style>

      {/* SIDEBAR */}
      <aside className="desktop-sidebar" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="sidebar-logo-container">
          <img src={logoBH} alt="BH" className="sidebar-logo" />
        </div>
        <nav className="sidebar-nav-scroll" aria-label="Admin navigation">
          <div className="sidebar-nav-item">
            <div className="icon-box active"><LayoutGrid size={22} /></div>
            <span className="sidebar-label" style={{ color: '#F54E25' }}>Dashboard</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/analytics'); }}>
            <div className="icon-box inactive"><BarChart2 size={24} /></div>
            <span className="sidebar-label">Analytics</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-patient-database'); }}>
            <div className="icon-box inactive"><HeartPulse size={22} /></div>
            <span className="sidebar-label">Patient Management</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-admission-management'); }}>
            <div className="icon-box inactive"><ClipboardList size={22} /></div>
            <span className="sidebar-label">Admission Management</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-discharge-management'); }}>
            <div className="icon-box inactive"><ArrowRightSquare size={22} /></div>
            <span className="sidebar-label">Discharge Management</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-user-management'); }}>
            <div className="icon-box inactive"><Users size={22} /></div>
            <span className="sidebar-label">User Management</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-staff-management'); }}>
            <div className="icon-box inactive"><Stethoscope size={22} /></div>
            <span className="sidebar-label">Staff Management</span>
          </div>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/login'); }}>
            <LogOut size={22} color="#F54E25" style={{ marginLeft: isExpanded ? '0' : '10px', flexShrink: 0 }} />
            <span className="sidebar-label" style={{ color: '#F54E25' }}>Logout</span>
          </div>
        </div>
      </aside>

      {/* MOBILE TOP BAR */}
      <div className="db-mobile-only db-mobile-top-bar">
        <img src={logoBH} alt="BH" style={{ height: 32 }} />
        <span style={{ fontSize: 16, fontWeight: 800, color: '#F54E25' }}>Dashboard</span>
        <div style={{ width: 36, height: 36, background: '#F54E25', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>JD</div>
      </div>

      {/* MAIN CONTENT */}
      <main className="dashboard-main">
        <div className="dashboard-inner">
          <h1 className="dashboard-title-desktop" style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', marginBottom: 32 }}>Dashboard</h1>

          <div className="metric-cards-container" style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {/* Card 1: Available Beds */}
            <div className="metric-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="metric-icon-box"><CheckCircle2 size={24} /></div>
                <span className="metric-badge">Available</span>
              </div>
              <div>
                <div className="metric-value">{availableBeds}</div>
                <div className="metric-title">Available Beds</div>
                <div className="metric-subtitle">Ready for admission</div>
              </div>
            </div>

            {/* Card 2: Total Patients */}
            <div className="metric-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="metric-icon-box"><Users size={24} /></div>
                <span className="metric-badge" style={{ background: '#F4F7FE', color: '#4A628A' }}>Live</span>
              </div>
              <div>
                <div className="metric-value">{totalPatients}</div>
                <div className="metric-title">Total Patients</div>
                <div className="metric-subtitle">Currently admitted</div>
              </div>
            </div>

            {/* Card 3: Pending Requests (Admission) */}
            <div className="metric-card" onClick={() => setModalView(pendingAdmissions.length > 0 ? 'admissions' : null)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="metric-icon-box"><Clock size={24} /></div>
                <span className="metric-badge" style={{ background: '#F54E25', color: 'white' }}>Pending</span>
              </div>
              <div>
                <div className="metric-value">{pendingAdmissions.length}</div>
                <div className="metric-title">Pending Requests</div>
                <div className="metric-subtitle">Awaiting approval</div>
              </div>
            </div>

            {/* Card 4: Hospital Occupancy */}
            <div className="metric-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="metric-icon-box"><Bed size={24} /></div>
                <span className="metric-badge">{occupancyPerc}%</span>
              </div>
              <div>
                <div className="metric-value">{totalPatients}/50</div>
                <div className="metric-title">Hospital Occupancy</div>
                <div style={{ width: '100%', height: 6, background: '#E9EDF7', borderRadius: 99, marginTop: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${occupancyPerc}%`, height: '100%', background: '#F54E25', borderRadius: 99 }} />
                </div>
              </div>
            </div>

            {/* Card 5: Discharge Requests */}
            <div className="metric-card" onClick={() => setModalView(pendingDischarges.length > 0 ? 'discharges' : null)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="metric-icon-box"><ArrowRightSquare size={24} /></div>
                <span className="metric-badge">Available</span>
              </div>
              <div>
                <div className="metric-value">{pendingDischarges.length}</div>
                <div className="metric-title">Discharge</div>
                <div className="metric-subtitle">Discharge Request(s)</div>
              </div>
            </div>
          </div>

          <div className="metric-cards-container" style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 16 }}>
            <div className="metric-card" onClick={() => navigate('/admin-admission-management')} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="metric-icon-box"><ClipboardList size={24} /></div>
                <span className="metric-badge" style={{ background: '#EEF2FF', color: '#4338CA' }}>Admissions</span>
              </div>
              <div>
                <div className="metric-value">{pipelineMetrics.totalAdmissions}</div>
                <div className="metric-title">Total admission records</div>
                <div className="metric-subtitle">Open admission management</div>
              </div>
            </div>
            <div className="metric-card" onClick={() => navigate('/admin-admission-management')} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="metric-icon-box"><ArrowRightSquare size={24} /></div>
                <span className="metric-badge" style={{ background: '#FFF7ED', color: '#C2410C' }}>Pipeline</span>
              </div>
              <div>
                <div className="metric-value">{pipelineMetrics.forDischarge}</div>
                <div className="metric-title">For discharge</div>
                <div className="metric-subtitle">Marked in admission workflow</div>
              </div>
            </div>
            <div className="metric-card" onClick={() => navigate('/admin-discharge-management')} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="metric-icon-box"><Clock size={24} /></div>
                <span className="metric-badge" style={{ background: '#ECFDF3', color: '#166534' }}>Queue</span>
              </div>
              <div>
                <div className="metric-value">{pipelineMetrics.readyDischarge}</div>
                <div className="metric-title">Ready in discharge</div>
                <div className="metric-subtitle">Awaiting finalization</div>
              </div>
            </div>
            <div className="metric-card" onClick={() => navigate('/admin-discharge-management')} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="metric-icon-box"><CheckCircle2 size={24} /></div>
                <span className="metric-badge" style={{ background: '#F4F7FE', color: '#4A628A' }}>Done</span>
              </div>
              <div>
                <div className="metric-value">{pipelineMetrics.dischargedDone}</div>
                <div className="metric-title">Discharged / completed</div>
                <div className="metric-subtitle">In discharge module</div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="recent-activity-card">
            <div className="recent-activity-header">
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1B2559' }}>Recent Activity</h2>
              {recentActivities.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearActivities}
                  style={{ background: '#F4F7FE', color: '#1B2559', border: 'none', padding: '6px 14px', borderRadius: '8px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}
                >
                  Clear All
                </button>
              )}
            </div>
            {recentActivities.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: '#A3AED0', fontSize: 14 }}>No recent activities.</div>
            ) : recentActivities.map((act) => (
              <div key={act.id} className="activity-row">
                <div className="activity-row-left">
                  <div style={{ width: 40, height: 40, flexShrink: 0, background: '#FFF0ED', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F54E25' }}>
                    {act.icon === 'check' ? <CheckCircle2 size={20} /> : act.icon === 'bed' ? <Bed size={20} /> : <Users size={20} />}
                  </div>
                  <div className="activity-row-text">
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#1B2559', marginBottom: 2 }}>{act.title}</p>
                    <p style={{ fontSize: 12, fontWeight: 500, color: '#A3AED0' }}>{act.desc}</p>
                  </div>
                </div>
                <div className="activity-row-time">{act.time}</div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* MODALS */}
      {modalView === 'admissions' && (
        <div className="modal-overlay" onClick={() => setModalView(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <X className="close-btn" size={24} onClick={() => setModalView(null)} />
            <div className="modal-header">
              <div className="modal-icon-bg"><Clock size={28} /></div>
              <div className="modal-title">Pending Requests</div>
            </div>
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {pendingAdmissions.map((req) => (
                <div key={req.id} className="request-item">
                  <div className="req-top-row">
                    <div className="req-user-block">
                      <div className="req-user-icon"><Users size={18} /></div>
                      <div className="req-name">{req.name} - {req.reason || 'Admission'}</div>
                    </div>
                    <div className="req-time">{req.requestTime || '2 hours ago'}</div>
                  </div>
                  <div className="req-details">
                    <div>Family Member's Number: {req.familyNumber || '09123456789'}</div>
                    <div>Family Member's E-Mail Address: {req.familyEmail || 'Sample@email.com'}</div>
                    <div>Patient Number: {req.patientNumber || '09123456789'}</div>
                  </div>
                  <div className="req-buttons">
                    <button className="btn-approve" onClick={() => handleApproveClick(req, 'admission')}>Approve</button>
                    <button className="btn-decline" onClick={() => handleDeclineClick(req, 'admission')}>Decline</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {modalView === 'discharges' && (
        <div className="modal-overlay" onClick={() => setModalView(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <X className="close-btn" size={24} onClick={() => setModalView(null)} />
            <div className="modal-header">
              <div className="modal-icon-bg"><ArrowRightSquare size={28} /></div>
              <div className="modal-title">Pending Discharge Requests</div>
            </div>
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {pendingDischarges.map((req) => (
                <div key={req.id} className="request-item">
                  <div className="req-top-row">
                    <div className="req-user-block">
                      <div className="req-user-icon"><Users size={18} /></div>
                      <div className="req-name">
                        {req.name}
                        {req.dischargeReasonCategory
                          ? ` · ${req.dischargeReasonCategory}`
                          : ` - ${req.reason || 'Discharge request'}`}
                      </div>
                    </div>
                    <div className="req-time">{req.requestTime || '2 hours ago'}</div>
                  </div>
                  <div className="req-details">
                    <div>Family Member's Number: {req.familyNumber || '09123456789'}</div>
                    <div>Family Member's E-Mail Address: {req.familyEmail || 'Sample@email.com'}</div>
                    <div>Patient Number: {req.patientNumber || '09123456789'}</div>
                    {req.dischargeReasonDetails && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #E2E8F0' }}>
                        <div style={{ fontWeight: 700, color: '#1B2559', marginBottom: 4 }}>Discharge details</div>
                        <div><strong>Category:</strong> {req.dischargeReasonCategory || '—'}</div>
                        <div><strong>Explanation:</strong> {req.dischargeReasonDetails}</div>
                        {req.preferredDischargeDate && (
                          <div><strong>Preferred date:</strong> {req.preferredDischargeDate}</div>
                        )}
                        {req.pickupAuthorized && (
                          <div><strong>Authorized pickup:</strong> {req.pickupAuthorized}</div>
                        )}
                        {req.followUpPhone && (
                          <div><strong>Follow-up contact:</strong> {req.followUpPhone}</div>
                        )}
                        {req.dischargeOtherInfo && (
                          <div><strong>Other info:</strong> {req.dischargeOtherInfo}</div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="req-buttons">
                    <button className="btn-approve" onClick={() => handleApproveClick(req, 'discharge')}>Approve</button>
                    <button className="btn-decline" onClick={() => handleDeclineClick(req, 'discharge')}>Decline</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {modalView === 'confirm' && selectedRequest && (
        <div className="modal-overlay" onClick={() => setModalView(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <X className="close-btn" size={24} onClick={() => setModalView(null)} />
            <div className="modal-header">
              <div className="modal-icon-bg" style={{ background: '#FFEBEF', color: '#FF7E5F' }}><HelpCircle size={28} /></div>
              <div className="modal-title">Are you sure about that?</div>
            </div>
            <div className="request-item" style={{ background: 'transparent', border: 'none', padding: 0 }}>
              <div className="req-top-row">
                <div className="req-user-block">
                  <div className="req-user-icon"><Users size={18} /></div>
                  <div className="req-name">
                    {selectedRequest.name}
                    {requestType === 'discharge' && selectedRequest.dischargeReasonCategory
                      ? ` · ${selectedRequest.dischargeReasonCategory}`
                      : ` - ${selectedRequest.reason || (requestType === 'admission' ? 'Admission' : 'Discharge request')}`}
                  </div>
                </div>
                <div className="req-time">{selectedRequest.requestTime || '2 hours ago'}</div>
              </div>
              <div className="req-details">
                <div>Family Member's Number: {selectedRequest.familyNumber || '09123456789'}</div>
                <div>Family Member's E-Mail Address: {selectedRequest.familyEmail || 'Sample@email.com'}</div>
                <div>Patient Number: {selectedRequest.patientNumber || '09123456789'}</div>
                {requestType === 'discharge' && selectedRequest.dischargeReasonDetails && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #E2E8F0' }}>
                    <div style={{ fontWeight: 700, color: '#1B2559', marginBottom: 4 }}>Discharge details</div>
                    <div><strong>Explanation:</strong> {selectedRequest.dischargeReasonDetails}</div>
                    {selectedRequest.preferredDischargeDate && (
                      <div><strong>Preferred date:</strong> {selectedRequest.preferredDischargeDate}</div>
                    )}
                    {selectedRequest.pickupAuthorized && (
                      <div><strong>Authorized pickup:</strong> {selectedRequest.pickupAuthorized}</div>
                    )}
                    {selectedRequest.followUpPhone && (
                      <div><strong>Follow-up contact:</strong> {selectedRequest.followUpPhone}</div>
                    )}
                    {selectedRequest.dischargeOtherInfo && (
                      <div><strong>Other info:</strong> {selectedRequest.dischargeOtherInfo}</div>
                    )}
                  </div>
                )}
              </div>
              <div className="req-buttons">
                <button className="btn-approve" onClick={handleProceedClick}>Proceed</button>
                <button className="btn-decline" onClick={() => setModalView(requestType === 'admission' ? 'admissions' : 'discharges')}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalView === '2fa' && (
        <div className="modal-overlay" onClick={() => { setModalView(null); setTwoFAError(''); }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ padding: '40px 30px', textAlign: 'center' }}>
            <X className="close-btn" size={24} onClick={() => { setModalView(null); setTwoFAError(''); }} />
            <div className="modal-title" style={{ fontSize: '20px', marginBottom: '10px' }}>Enter 2FA Password to Approve</div>
            <div className="tfa-box">
              <input type="text" className="tfa-circle" maxLength={1} value={twoFactorCode[0]} ref={tfaRefs[0]} onChange={e => handle2FAChange(0, e.target.value)} onKeyDown={e => handle2FAKeyDown(0, e)} />
              <input type="text" className="tfa-circle" maxLength={1} value={twoFactorCode[1]} ref={tfaRefs[1]} onChange={e => handle2FAChange(1, e.target.value)} onKeyDown={e => handle2FAKeyDown(1, e)} />
              <input type="text" className="tfa-circle" maxLength={1} value={twoFactorCode[2]} ref={tfaRefs[2]} onChange={e => handle2FAChange(2, e.target.value)} onKeyDown={e => handle2FAKeyDown(2, e)} />
              <input type="text" className="tfa-circle" maxLength={1} value={twoFactorCode[3]} ref={tfaRefs[3]} onChange={e => handle2FAChange(3, e.target.value)} onKeyDown={e => handle2FAKeyDown(3, e)} />
              <input type="text" className="tfa-circle" maxLength={1} value={twoFactorCode[4]} ref={tfaRefs[4]} onChange={e => handle2FAChange(4, e.target.value)} onKeyDown={e => handle2FAKeyDown(4, e)} />
              <input type="text" className="tfa-circle" maxLength={1} value={twoFactorCode[5]} ref={tfaRefs[5]} onChange={e => handle2FAChange(5, e.target.value)} onKeyDown={e => handle2FAKeyDown(5, e)} />
            </div>
            {twoFAError && (
              <div style={{ color: '#dc2626', fontSize: 13, fontWeight: 600, marginTop: 12, marginBottom: 8, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.45 }}>
                {twoFAError}
              </div>
            )}
            <button
              type="button"
              className="btn-approve"
              style={{ padding: '12px 40px', fontSize: '15px' }}
              disabled={twoFAConfirming}
              onClick={() => void handle2FAConfirm()}
            >
              {twoFAConfirming ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAV */}
      <div className="db-mobile-only db-mobile-bottom-nav">
        <div className="mob-nav-item active">
          <div style={{ background: '#F54E25', padding: 10, borderRadius: 10, display: 'flex' }}>
            <LayoutGrid size={20} color="white" />
          </div>
          <span style={{ color: '#F54E25' }}>Dashboard</span>
        </div>
        <div className="mob-nav-item" onClick={() => navigate('/analytics')}>
          <div style={{ padding: 10, borderRadius: 10, display: 'flex' }}>
            <BarChart2 size={20} color="#A3AED0" />
          </div>
          <span>Analytics</span>
        </div>
        <div className="mob-nav-item" onClick={() => navigate('/admin-patient-database')}>
          <div style={{ padding: 10, borderRadius: 10, display: 'flex' }}>
            <HeartPulse size={20} color="#A3AED0" />
          </div>
          <span>Patient Management</span>
        </div>
        <div className="mob-nav-item" onClick={() => navigate('/admin-user-management')}>
          <div style={{ padding: 10, borderRadius: 10, display: 'flex' }}>
            <Users size={20} color="#A3AED0" />
          </div>
          <span>Users</span>
        </div>
        <div className="mob-nav-item" onClick={() => navigate('/admin-staff-management')}>
          <div style={{ padding: 10, borderRadius: 10, display: 'flex' }}>
            <Stethoscope size={20} color="#A3AED0" />
          </div>
          <span>Staff</span>
        </div>
        <div className="mob-nav-item" onClick={() => navigate('/login')}>
          <LogOut size={22} color="#F54E25" />
          <span style={{ color: '#F54E25' }}>Logout</span>
        </div>
      </div>

    </div>
  );
};

export default AdminDashboard;