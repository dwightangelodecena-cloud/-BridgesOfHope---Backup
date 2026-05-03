import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  LayoutGrid,
  HeartPulse,
  BookUser,
  Users,
  LogOut,
  Search,
  Filter,
  Eye,
  Edit2,
  RefreshCw,
  X,
  ClipboardList,
  ArrowRightSquare,
  ArrowRightCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Stethoscope,
  LayoutTemplate,
  Calendar,
  User,
  FileText,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logoBH from '@/assets/kalingalogo.png';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { APP_DATA_REFRESH, refreshAppData } from '@/lib/appDataRefresh';
import { BRANCH_KEYS, BRANCH_LABEL, formatPhp } from '@/lib/servicePricing';
import {
  ADMISSION_WORKFLOW_STATUSES,
  buildAdmissionRow,
  findPatientForAdmission,
  loadWorkflowOverrides,
  patchWorkflowOverride,
  pushActivity,
  loadDischargeRecords,
  summarizeDischargeCost,
  appendDischargeRecord,
} from '@/lib/admissionDischargeStore';
import { approveAdmissionInDatabase } from '@/lib/approveAdmissionSupabase';
import { appendActivityFeed } from '@/lib/activityFeed';
import { TwoFactorApproveModal } from '@/components/TwoFactorApproveModal';
import { verifyAdminApprovalPin } from '@/lib/adminApprovalPin';

const FILTER_OPTIONS = ['All Admissions', ...ADMISSION_WORKFLOW_STATUSES];

const SORT_OPTIONS = [
  { id: 'name_asc', label: 'Name A–Z', field: 'name', dir: 'asc' },
  { id: 'name_desc', label: 'Name Z–A', field: 'name', dir: 'desc' },
  { id: 'date_desc', label: 'Newest to Oldest', field: 'date', dir: 'desc' },
  { id: 'date_asc', label: 'Oldest to Newest', field: 'date', dir: 'asc' },
  { id: 'status', label: 'Status', field: 'status', dir: 'asc' },
  { id: 'cost_asc', label: 'Cost Low to High', field: 'cost', dir: 'asc' },
  { id: 'cost_desc', label: 'Cost High to Low', field: 'cost', dir: 'desc' },
];

const PAGE_SIZE = 10;

const formatDate = (iso) => {
  if (!iso) return 'N/A';
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return 'N/A';
  }
};

const ts = (iso) => {
  const t = new Date(iso || 0).getTime();
  return Number.isNaN(t) ? 0 : t;
};

function sortRows(rows, sortId) {
  const opt = SORT_OPTIONS.find((o) => o.id === sortId) || SORT_OPTIONS[3];
  const cp = [...rows];
  const { field, dir } = opt;
  const mul = dir === 'asc' ? 1 : -1;
  cp.sort((a, b) => {
    if (field === 'name') return a.patientName.localeCompare(b.patientName, undefined, { sensitivity: 'base' }) * mul;
    if (field === 'date') return (ts(a.admissionDate) - ts(b.admissionDate)) * mul;
    if (field === 'cost') return (a.estimatedCost - b.estimatedCost) * mul;
    if (field === 'status') return a.status.localeCompare(b.status, undefined, { sensitivity: 'base' }) * mul;
    return 0;
  });
  return cp;
}

const AdmissionManagement = () => {
  const navigate = useNavigate();
  const pendingApproveRowRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [formError, setFormError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Admissions');
  const [sortId, setSortId] = useState('date_desc');
  const [page, setPage] = useState(1);

  const [viewRow, setViewRow] = useState(null);
  const [editRow, setEditRow] = useState(null);

  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const filterDropdownRef = useRef(null);
  const sortDropdownRef = useRef(null);
  const [approvingId, setApprovingId] = useState(null);
  const [twoFAModalOpen, setTwoFAModalOpen] = useState(false);
  const [tfaError, setTfaError] = useState('');
  const [tfaLoading, setTfaLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setFormError('');
    try {
      const overrides = loadWorkflowOverrides();
      if (!isSupabaseConfigured()) {
        setRows([]);
        return;
      }
      const { data: admissions, error: aErr } = await supabase
        .from('admission_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (aErr) throw aErr;
      const { data: patients, error: pErr } = await supabase.from('patients').select('*');
      if (pErr) throw pErr;

      const list = (admissions || []).map((ar) => {
        const patient = findPatientForAdmission(patients || [], ar);
        const o = overrides[ar.id];
        return buildAdmissionRow(ar, patient, o);
      });
      setRows(list);
    } catch (e) {
      console.error(e);
      setFormError(e.message || 'Failed to load admissions.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    const onRefresh = () => {
      void loadData();
    };
    window.addEventListener('storage', onRefresh);
    window.addEventListener(APP_DATA_REFRESH, onRefresh);
    return () => {
      window.removeEventListener('storage', onRefresh);
      window.removeEventListener(APP_DATA_REFRESH, onRefresh);
    };
  }, [loadData]);

  useEffect(() => {
    if (!filterDropdownOpen && !sortDropdownOpen) return;
    const onDoc = (e) => {
      const t = e.target;
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(t)) setFilterDropdownOpen(false);
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(t)) setSortDropdownOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [filterDropdownOpen, sortDropdownOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = rows.filter((r) => {
      if (r.archived) return false;
      if (statusFilter !== 'All Admissions' && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        String(r.admissionDisplayId).toLowerCase().includes(q) ||
        String(r.patientName).toLowerCase().includes(q) ||
        String(r.assignedStaff).toLowerCase().includes(q) ||
        String(r.status).toLowerCase().includes(q) ||
        String(r.reason).toLowerCase().includes(q)
      );
    });
    return sortRows(base, sortId);
  }, [rows, search, statusFilter, sortId]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sortId]);

  const persistOverride = (requestId, partial) => {
    const nextOv = patchWorkflowOverride(requestId, partial);
    setRows((prev) =>
      prev.map((r) => (r.requestId !== requestId ? r : buildAdmissionRow(r.rawAdmission, r.rawPatient, nextOv)))
    );
    refreshAppData();
  };

  const handleSaveEdit = () => {
    if (!editRow) return;
    const e = editRow;
    persistOverride(e.requestId, {
      assignedStaff: e._editAssigned || e.assignedStaff,
      admissionType: e._editType || e.admissionType,
      branch: e._editBranch || e.pricingDetail.branch,
      monthsOfCare: Number(e._editMonths ?? e.pricingDetail.monthsOfCare) || 1,
      includeAdmissionFee: e._editIncAdm !== false,
      includeMonthly: e._editIncMo !== false,
    });
    pushActivity(`Admission ${e.admissionDisplayId}: record updated`);
    setEditRow(null);
  };

  const handleMoveToDischarge = (r) => {
    const existing = loadDischargeRecords().some((d) => d.admissionRequestId === r.requestId && !d.archived);
    if (existing) {
      setFormError('This admission already has an active discharge record.');
      setTimeout(() => setFormError(''), 4000);
      return;
    }
    const totalCost = summarizeDischargeCost(r.pricingDetail);
    const id = `DCH-${Date.now().toString(36).toUpperCase()}`;
    const discharge = {
      id,
      admissionRequestId: r.requestId,
      admissionDisplayId: r.admissionDisplayId,
      patientId: r.patientId,
      patientName: r.patientName,
      assignedStaff: r.assignedStaff,
      admissionDate: r.admissionDate,
      dischargeDate: null,
      finalStatus: 'Ready for Discharge',
      totalCost,
      pricingDetail: { ...r.pricingDetail },
      pricingNotes: '',
      archived: false,
      createdAt: new Date().toISOString(),
    };
    appendDischargeRecord(discharge);
    persistOverride(r.requestId, { workflowStatus: 'For Discharge' });
    pushActivity(`Admission ${r.admissionDisplayId}: moved to Discharge Management`);
    refreshAppData();
  };

  const handleArchive = (r) => {
    persistOverride(r.requestId, { archived: true });
    pushActivity(`Admission ${r.admissionDisplayId}: archived`);
  };

  const handleApproveDbPending = async (r) => {
    if (!isSupabaseConfigured() || String(r.dbStatus || '').toLowerCase() !== 'pending') return false;
    setApprovingId(r.requestId);
    setFormError('');
    try {
      const res = await approveAdmissionInDatabase(r);
      if (!res.ok) {
        setFormError(res.errorMessage);
        setTimeout(() => setFormError(''), 12000);
        return false;
      }
      await appendActivityFeed(
        `Admission approved: ${r.patientName || 'Patient'} is now admitted.`,
        { familyId: r.familyId }
      );
      pushActivity(`Admission ${r.admissionDisplayId}: approved (database)`);
      refreshAppData();
      await loadData();
      return true;
    } finally {
      setApprovingId(null);
    }
  };

  const openApprove2FA = (r) => {
    if (!isSupabaseConfigured() || String(r.dbStatus || '').toLowerCase() !== 'pending') return;
    pendingApproveRowRef.current = r;
    setTfaError('');
    setTwoFAModalOpen(true);
  };

  const handle2FAModalClose = () => {
    pendingApproveRowRef.current = null;
    setTfaError('');
    setTwoFAModalOpen(false);
  };

  const handle2FAPinConfirm = async (pin) => {
    if (!/^\d{4}$/.test(pin)) {
      setTfaError('Enter a valid 4-digit code.');
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const envPin = import.meta.env.VITE_ADMIN_APPROVAL_PIN;
    if (!verifyAdminApprovalPin(pin, user?.id || 'global', envPin)) {
      setTfaError('Incorrect code.');
      return;
    }
    const r = pendingApproveRowRef.current;
    if (!r) return;
    setTfaError('');
    setTfaLoading(true);
    const ok = await handleApproveDbPending(r);
    setTfaLoading(false);
    if (ok) {
      pendingApproveRowRef.current = null;
      setTwoFAModalOpen(false);
    }
  };

  const statusPillClass = (status) => {
    if (status === 'Ongoing' || status === 'Approved') return 'am-pill--ok';
    if (status === 'Pending') return 'am-pill--pending';
    if (status === 'For Discharge') return 'am-pill--warn';
    if (status === 'Cancelled') return 'am-pill--bad';
    if (status === 'Completed') return 'am-pill--muted';
    return 'am-pill--muted';
  };

  return (
    <div className="am-outer" style={{ display: 'flex', minHeight: '100vh', background: '#F8F9FD', fontFamily: "'Inter', sans-serif", color: '#1B2559' }}>
      <TwoFactorApproveModal
        open={twoFAModalOpen}
        onClose={handle2FAModalClose}
        onConfirm={handle2FAPinConfirm}
        error={tfaError}
        loading={tfaLoading}
        title="Enter 2FA code to approve"
      />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .am-outer { width: 100%; overflow-x: clip; }
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
        .am-main { flex: 0 0 auto; width: calc(100vw - ${isExpanded ? '280px' : '110px'}); min-height: 100vh; margin-left: ${isExpanded ? '280px' : '110px'}; transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1); padding: 24px; }
        .am-card { background: white; border: 1px solid #E9EDF7; border-radius: 20px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.02); }
        .db-search-input { padding: 10px 12px 10px 36px; border: 1px solid #E9EDF7; border-radius: 12px; font-size: 13px; width: 280px; outline: none; font-family: 'Inter', sans-serif; color: #1B2559; background: white; }
        .db-search-input:focus { border-color: #2563EB; }
        .db-sort-select { border: 1px solid #E9EDF7; border-radius: 8px; padding: 4px 8px; font-size: 13px; font-weight: 600; outline: none; color: #1B2559; cursor: pointer; background: white; }
        .db-sort-by-wrap { position: relative; }
        .db-sort-by-trigger {
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          min-width: min(100%, 320px);
          max-width: 100%;
          padding: 8px 12px;
          border: 1px solid #0f172a;
          border-radius: 8px;
          background: white;
          font-size: 13px;
          font-weight: 700;
          color: #1B2559;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
        }
        .db-sort-by-trigger-prefix { font-weight: 600; color: #1B2559; flex-shrink: 0; }
        .db-sort-by-trigger-value { flex: 1; text-align: left; font-weight: 700; min-width: 0; }
        .db-sort-by-trigger:hover { border-color: #cbd5e1; }
        .db-sort-by-trigger:focus-visible { outline: 2px solid #2563EB; outline-offset: 1px; }
        .db-sort-by-trigger-icon { flex-shrink: 0; color: #1B2559; transition: transform 0.15s ease; }
        .db-sort-by-trigger-icon--open { transform: rotate(180deg); }
        .db-sort-by-trigger--compact { min-width: min(100%, 220px); }
        .db-sort-by-menu {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          min-width: 100%;
          margin: 0;
          padding: 4px 0;
          list-style: none;
          background: white;
          border: 1px solid #1B2559;
          border-radius: 8px;
          box-shadow: 0 4px 14px rgba(27, 37, 89, 0.12);
          z-index: 50;
        }
        .db-sort-by-option {
          display: block;
          width: 100%;
          padding: 10px 14px;
          border: none;
          background: transparent;
          text-align: left;
          font-size: 13px;
          font-weight: 600;
          color: #1B2559;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
        }
        .db-sort-by-option:hover:not(.db-sort-by-option--active) { background: #f1f5f9; }
        .db-sort-by-option--active { background: #2563EB; color: white; }
        .db-view-btn, .db-edit-btn, .db-action-btn { border: none; border-radius: 8px; padding: 6px 10px; font-size: 11px; font-weight: 700; cursor: pointer; font-family: 'Inter', sans-serif; display: inline-flex; align-items: center; gap: 4px; }
        .db-view-btn { background: #1B2559; color: white; }
        .db-edit-btn { background: #F54E25; color: white; }
        .db-action-btn { background: #E9EDF7; color: #1B2559; }
        .am-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .am-data-table { width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; }
        .am-row:hover { background: #F8FAFC; }
        .am-th { position: sticky; top: 0; z-index: 1; }
        .am-pill { display: inline-flex; padding: 5px 10px; border-radius: 999px; font-weight: 700; font-size: 11px; }
        .am-pill--ok { color: #166534; background: #ECFDF3; border: 1px solid #BBF7D0; }
        .am-pill--pending { color: #92400e; background: #FFFBEB; border: 1px solid #FDE68A; }
        .am-pill--warn { color: #9a3412; background: #FFF7ED; border: 1px solid #FDBA74; }
        .am-pill--bad { color: #991b1b; background: #FEF2F2; border: 1px solid #FECACA; }
        .am-pill--muted { color: #475569; background: #F1F5F9; border: 1px solid #E2E8F0; }
        .am-modal-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,0.35); display: flex; align-items: center; justify-content: center; z-index: 1100; }
        .am-modal { width: min(92vw, 720px); max-height: 90vh; overflow-y: auto; background: white; border: 1px solid #E9EDF7; border-radius: 20px; box-shadow: 0 20px 50px rgba(15,23,42,0.25); }
        .am-modal-head { padding: 16px 20px; border-bottom: 1px solid #EEF2FF; display: flex; align-items: center; justify-content: space-between; }
        .am-modal-body { padding: 20px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .am-modal-field { display: flex; flex-direction: column; gap: 6px; }
        .am-modal-label { font-size: 12px; font-weight: 700; color: #707EAE; }
        .am-input { border: 1px solid #E9EDF7; border-radius: 10px; padding: 10px 12px; font-size: 13px; color: #1B2559; outline: none; background: white; }
        .am-input:focus { border-color: #2563EB; }
        .db-mobile-only { display: none; }
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .db-mobile-only { display: flex !important; }
          .am-main { margin-left: 0 !important; width: 100vw !important; padding: 20px 12px 100px 12px !important; }
          .db-search-input { width: 100% !important; }
          .am-modal-body { grid-template-columns: 1fr; }
          .db-mobile-top-bar { display: flex !important; width: 100vw; background: white; z-index: 1001; position: sticky; top: 0; padding: 0 20px; height: 64px; align-items: center; justify-content: space-between; border-bottom: 1px solid #F1F1F1; }
          .db-mobile-bottom-nav { position: fixed; bottom: 0; left: 0; width: 100vw; height: 72px; background: white; border-top: 1px solid #F1F1F1; display: flex; justify-content: space-around; align-items: center; z-index: 1000; box-shadow: 0 -4px 20px rgba(0,0,0,0.06); }
          .mob-nav-item { display: flex; flex-direction: column; align-items: center; font-size: 9px; color: #A3AED0; cursor: pointer; max-width: 20%; text-align: center; }
          .mob-nav-item.active { color: #F54E25; }
        }
      `}</style>

      <aside className="desktop-sidebar" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="sidebar-logo-container">
          <img src={logoBH} alt="Kalinga" className="sidebar-logo" />
        </div>
        <nav className="sidebar-nav-scroll" aria-label="Admin navigation">
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-dashboard'); }}>
            <div className="icon-box inactive"><LayoutGrid size={22} /></div>
            <span className="sidebar-label">Dashboard</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-patient-database'); }}>
            <div className="icon-box inactive"><BookUser size={22} /></div>
            <span className="sidebar-label">Patient Management</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => e.stopPropagation()}>
            <div className="icon-box active"><ClipboardList size={22} /></div>
            <span className="sidebar-label" style={{ color: '#F54E25' }}>Admission Management</span>
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
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-recovery-roadmap'); }}>
            <div className="icon-box inactive"><HeartPulse size={22} /></div>
            <span className="sidebar-label">Recovery Roadmap</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-content-management'); }}>
            <div className="icon-box inactive"><LayoutTemplate size={22} /></div>
            <span className="sidebar-label">Content management</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-appointments'); }}>
            <div className="icon-box inactive"><Calendar size={22} /></div>
            <span className="sidebar-label">Appointments</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-reports'); }}>
            <div className="icon-box inactive"><FileText size={22} /></div>
            <span className="sidebar-label">Printable reports</span>
          </div>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-profile'); }}>
            <div className="icon-box inactive"><User size={22} /></div>
            <span className="sidebar-label">Profile & Security</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/login'); }}>
            <LogOut size={22} color="#F54E25" style={{ marginLeft: isExpanded ? 0 : 10, flexShrink: 0 }} />
            <span className="sidebar-label" style={{ color: '#F54E25' }}>Logout</span>
          </div>
        </div>
      </aside>

      <div className="db-mobile-only db-mobile-top-bar">
        <img src={logoBH} alt="Kalinga" style={{ height: 32 }} />
        <span style={{ fontSize: 15, fontWeight: 800, color: '#F54E25' }}>Admissions</span>
        <div style={{ width: 36, height: 36, background: '#F54E25', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>AD</div>
      </div>

      <main className="am-main">
        <div style={{ width: '100%' }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#000' }}>Admission Management</h1>
          <p style={{ fontSize: 13, color: '#707EAE', marginTop: 8, marginBottom: 20, fontWeight: 500 }}>
            Active and incoming patient admissions. Costs use fees from Services (admission fee + Imus monthly rate).
          </p>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
            <button className="db-action-btn" type="button" onClick={() => void loadData()} disabled={loading}>
              <RefreshCw size={13} /> {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          <div className="am-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#A3AED0' }} />
                  <input
                    className="db-search-input"
                    type="text"
                    placeholder="Search patient ID (e.g. 2026-1234), patient, staff…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="db-sort-by-wrap" ref={filterDropdownRef}>
                  <button
                    type="button"
                    className="db-sort-by-trigger db-sort-by-trigger--compact"
                    onClick={() => {
                      setSortDropdownOpen(false);
                      setFilterDropdownOpen((o) => !o);
                    }}
                    aria-expanded={filterDropdownOpen}
                    aria-haspopup="listbox"
                    aria-label="Admission status filter"
                  >
                    <Filter size={16} color="#A3AED0" style={{ flexShrink: 0 }} aria-hidden />
                    <span className="db-sort-by-trigger-prefix">Status:</span>
                    <span className="db-sort-by-trigger-value">{statusFilter}</span>
                    <ChevronDown
                      size={16}
                      className={`db-sort-by-trigger-icon${filterDropdownOpen ? ' db-sort-by-trigger-icon--open' : ''}`}
                      aria-hidden
                    />
                  </button>
                  {filterDropdownOpen && (
                    <ul className="db-sort-by-menu" role="listbox" aria-label="Admission status">
                      {FILTER_OPTIONS.map((opt) => (
                        <li key={opt} role="none">
                          <button
                            type="button"
                            role="option"
                            aria-selected={statusFilter === opt}
                            className={`db-sort-by-option${statusFilter === opt ? ' db-sort-by-option--active' : ''}`}
                            onClick={() => {
                              setStatusFilter(opt);
                              setFilterDropdownOpen(false);
                            }}
                          >
                            {opt}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="db-sort-by-wrap" ref={sortDropdownRef}>
                  <button
                    type="button"
                    className="db-sort-by-trigger"
                    onClick={() => {
                      setFilterDropdownOpen(false);
                      setSortDropdownOpen((o) => !o);
                    }}
                    aria-expanded={sortDropdownOpen}
                    aria-haspopup="listbox"
                    aria-label="Sort by"
                  >
                    <span className="db-sort-by-trigger-prefix">Sort by:</span>
                    <span className="db-sort-by-trigger-value">
                      {(SORT_OPTIONS.find((o) => o.id === sortId) ?? SORT_OPTIONS[0]).label}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`db-sort-by-trigger-icon${sortDropdownOpen ? ' db-sort-by-trigger-icon--open' : ''}`}
                      aria-hidden
                    />
                  </button>
                  {sortDropdownOpen && (
                    <ul className="db-sort-by-menu" role="listbox" aria-label="Sort options">
                      {SORT_OPTIONS.map((o) => (
                        <li key={o.id} role="none">
                          <button
                            type="button"
                            role="option"
                            aria-selected={sortId === o.id}
                            className={`db-sort-by-option${sortId === o.id ? ' db-sort-by-option--active' : ''}`}
                            onClick={() => {
                              setSortId(o.id);
                              setSortDropdownOpen(false);
                            }}
                          >
                            {o.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {formError && <div style={{ marginBottom: 10, color: '#b91c1c', fontWeight: 600, fontSize: 13 }}>{formError}</div>}

            <div className="am-table-wrap">
              <table className="am-data-table">
                <thead>
                  <tr style={{ background: '#323D4E', color: 'white' }}>
                    {['Patient ID', 'Patient', 'Reason / Concern', 'Assigned Staff', 'Type', 'Admission Date', 'Est. Cost', 'Status', 'Actions'].map((col, idx) => (
                      <th className="am-th" key={col} style={{ padding: '10px 10px', borderRight: idx < 8 ? '1px solid #4B5563' : 'none', whiteSpace: 'nowrap', fontWeight: 500 }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={9} style={{ padding: 18, color: '#64748b' }}>Loading admissions…</td>
                    </tr>
                  )}
                  {!loading && !isSupabaseConfigured() && (
                    <tr>
                      <td colSpan={9} style={{ padding: 18, color: '#64748b' }}>Connect Supabase to load admission requests.</td>
                    </tr>
                  )}
                  {!loading && isSupabaseConfigured() && pageRows.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ padding: 18, color: '#64748b' }}>No admissions match your search or filter.</td>
                    </tr>
                  )}
                  {!loading &&
                    pageRows.map((r) => (
                      <tr key={r.requestId} className="am-row" style={{ borderBottom: '1px solid #F4F7FE' }}>
                        <td style={{ padding: '9px 10px', fontWeight: 700, color: '#1B2559', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{r.admissionDisplayId}</td>
                        <td style={{ padding: '9px 10px', fontWeight: 600 }}>
                          <div style={{ fontWeight: 700, color: '#1B2559' }}>{r.patientName}</div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }} title="Gender (from admission request or patient record)">
                            {r.patientGender?.trim() ? r.patientGender : 'Not specified'}
                          </div>
                        </td>
                        <td style={{ padding: '9px 10px', maxWidth: 200, color: '#334155' }}>{r.reason}</td>
                        <td style={{ padding: '9px 10px', color: '#707EAE' }}>{r.assignedStaff}</td>
                        <td style={{ padding: '9px 10px' }}>{r.admissionType}</td>
                        <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>{formatDate(r.admissionDate)}</td>
                        <td style={{ padding: '9px 10px', fontWeight: 700, color: '#05CD99', whiteSpace: 'nowrap' }}>{formatPhp(r.estimatedCost)}</td>
                        <td style={{ padding: '9px 10px' }}>
                          <span className={`am-pill ${statusPillClass(r.status)}`}>{r.status}</span>
                        </td>
                        <td style={{ padding: '9px 10px' }}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {isSupabaseConfigured() && String(r.dbStatus || '').toLowerCase() === 'pending' && (
                              <button
                                type="button"
                                className="db-edit-btn"
                                title="Approve in Supabase and create patient record"
                                disabled={approvingId === r.requestId}
                                onClick={() => openApprove2FA(r)}
                              >
                                {approvingId === r.requestId ? '…' : 'Approve'}
                              </button>
                            )}
                            <button type="button" className="db-view-btn" onClick={() => setViewRow(r)}>
                              <Eye size={12} /> View
                            </button>
                            <button
                              type="button"
                              className="db-edit-btn"
                              onClick={() =>
                                setEditRow({
                                  ...r,
                                  _editAssigned: r.assignedStaff,
                                  _editType: r.admissionType,
                                  _editBranch: r.pricingDetail.branch,
                                  _editMonths: r.pricingDetail.monthsOfCare,
                                  _editIncAdm: r.pricingDetail.includeAdmissionFee,
                                  _editIncMo: r.pricingDetail.includeMonthly,
                                })
                              }
                            >
                              <Edit2 size={12} /> Edit
                            </button>
                            <button type="button" className="db-action-btn" onClick={() => handleMoveToDischarge(r)} title="Send to Discharge Management">
                              <ArrowRightCircle size={12} /> Discharge
                            </button>
                            <button type="button" className="db-action-btn" onClick={() => handleArchive(r)}>
                              <Trash2 size={12} /> Archive
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {filtered.length > PAGE_SIZE && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                  Showing {(pageSafe - 1) * PAGE_SIZE + 1}–{Math.min(pageSafe * PAGE_SIZE, filtered.length)} of {filtered.length}
                </span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button type="button" className="db-action-btn" disabled={pageSafe <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    <ChevronLeft size={14} /> Prev
                  </button>
                  <button type="button" className="db-action-btn" disabled={pageSafe >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <div className="db-mobile-only db-mobile-bottom-nav">
        <div className="mob-nav-item" onClick={() => navigate('/admin-dashboard')}><LayoutGrid size={18} color="#A3AED0" /><span>Home</span></div>
        <div className="mob-nav-item" onClick={() => navigate('/admin-patient-database')}><BookUser size={18} color="#A3AED0" /><span>Patients</span></div>
        <div className="mob-nav-item active"><ClipboardList size={18} color="white" /><span style={{ color: '#F54E25' }}>Adm</span></div>
        <div className="mob-nav-item" onClick={() => navigate('/admin-discharge-management')}><ArrowRightSquare size={18} color="#A3AED0" /><span>Disch</span></div>
        <div className="mob-nav-item" onClick={() => navigate('/admin-user-management')}><Users size={18} color="#A3AED0" /><span>Users</span></div>
        <div className="mob-nav-item" onClick={() => navigate('/admin-staff-management')}><Stethoscope size={18} color="#A3AED0" /><span>Staff</span></div>
      </div>

      {viewRow && (
        <div className="am-modal-backdrop" onClick={() => setViewRow(null)}>
          <div className="am-modal" onClick={(e) => e.stopPropagation()}>
            <div className="am-modal-head">
              <div style={{ fontSize: 18, fontWeight: 800 }}>Admission details</div>
              <button type="button" className="db-action-btn" onClick={() => setViewRow(null)}><X size={16} /></button>
            </div>
            <div className="am-modal-body">
              <div className="am-modal-field"><span className="am-modal-label">Patient ID</span><div className="am-input">{viewRow.admissionDisplayId}</div></div>
              <div className="am-modal-field"><span className="am-modal-label">Patient</span><div className="am-input">{viewRow.patientName}</div></div>
              <div className="am-modal-field"><span className="am-modal-label">Gender</span><div className="am-input">{viewRow.patientGender?.trim() ? viewRow.patientGender : 'Not specified'}</div></div>
              <div className="am-modal-field"><span className="am-modal-label">Status</span><div className="am-input">{viewRow.status}</div></div>
              <div className="am-modal-field"><span className="am-modal-label">Admission date</span><div className="am-input">{formatDate(viewRow.admissionDate)}</div></div>
              <div className="am-modal-field"><span className="am-modal-label">Assigned staff</span><div className="am-input">{viewRow.assignedStaff}</div></div>
              <div className="am-modal-field"><span className="am-modal-label">Admission type</span><div className="am-input">{viewRow.admissionType}</div></div>
              <div className="am-modal-field" style={{ gridColumn: '1 / -1' }}><span className="am-modal-label">Reason / concern</span><div className="am-input">{viewRow.reason}</div></div>
              <div className="am-modal-field"><span className="am-modal-label">Location (monthly rate)</span><div className="am-input">{BRANCH_LABEL[viewRow.pricingDetail.branch] || 'Imus Branch'}</div></div>
              <div className="am-modal-field"><span className="am-modal-label">Months of care (estimate)</span><div className="am-input">{viewRow.pricingDetail.monthsOfCare}</div></div>
              <div className="am-modal-field"><span className="am-modal-label">Estimated total</span><div className="am-input" style={{ fontWeight: 800, color: '#05CD99' }}>{formatPhp(viewRow.estimatedCost)}</div></div>
              <div className="am-modal-field"><span className="am-modal-label">Guardian</span><div className="am-input">{viewRow.guardianName || '—'}</div></div>
              <div className="am-modal-field"><span className="am-modal-label">Contact</span><div className="am-input">{viewRow.guardianPhone || '—'}</div></div>
            </div>
          </div>
        </div>
      )}

      {editRow && (
        <div className="am-modal-backdrop" onClick={() => setEditRow(null)}>
          <div className="am-modal" onClick={(e) => e.stopPropagation()}>
            <div className="am-modal-head">
              <div style={{ fontSize: 18, fontWeight: 800 }}>Edit admission</div>
              <button type="button" className="db-action-btn" onClick={() => setEditRow(null)}><X size={16} /></button>
            </div>
            <div className="am-modal-body">
              <label className="am-modal-field">
                <span className="am-modal-label">Assigned staff</span>
                <input className="am-input" value={editRow._editAssigned} onChange={(e) => setEditRow((p) => ({ ...p, _editAssigned: e.target.value }))} />
              </label>
              <label className="am-modal-field">
                <span className="am-modal-label">Admission type</span>
                <input className="am-input" value={editRow._editType} onChange={(e) => setEditRow((p) => ({ ...p, _editType: e.target.value }))} />
              </label>
              <label className="am-modal-field">
                <span className="am-modal-label">Location (monthly fee)</span>
                <select className="am-input" value={editRow._editBranch} onChange={(e) => setEditRow((p) => ({ ...p, _editBranch: e.target.value }))}>
                  {BRANCH_KEYS.map((k) => (
                    <option key={k} value={k}>{BRANCH_LABEL[k]}</option>
                  ))}
                </select>
              </label>
              <label className="am-modal-field">
                <span className="am-modal-label">Months of care (estimate)</span>
                <input
                  className="am-input"
                  type="number"
                  min={0}
                  value={editRow._editMonths}
                  onChange={(e) => setEditRow((p) => ({ ...p, _editMonths: e.target.value }))}
                />
              </label>
              <label className="am-modal-field" style={{ gridColumn: '1 / -1', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <input type="checkbox" checked={editRow._editIncAdm} onChange={(e) => setEditRow((p) => ({ ...p, _editIncAdm: e.target.checked }))} />
                <span className="am-modal-label" style={{ margin: 0 }}>Include one-time admission fee (₱30,000)</span>
              </label>
              <label className="am-modal-field" style={{ gridColumn: '1 / -1', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <input type="checkbox" checked={editRow._editIncMo} onChange={(e) => setEditRow((p) => ({ ...p, _editIncMo: e.target.checked }))} />
                <span className="am-modal-label" style={{ margin: 0 }}>Include monthly fee (Imus rate × months)</span>
              </label>
            </div>
            <div style={{ padding: 16, borderTop: '1px solid #EEF2FF', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="db-action-btn" onClick={() => setEditRow(null)}>Cancel</button>
              <button type="button" className="db-edit-btn" onClick={() => handleSaveEdit()}>Save</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdmissionManagement;
