import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  LayoutGrid,
  HeartPulse,
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
  Printer,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Archive,
  ChevronDown,
  Stethoscope,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logoBH from '@/assets/logo2.png';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { APP_DATA_REFRESH, refreshAppData } from '@/lib/appDataRefresh';
import { BRANCH_KEYS, BRANCH_LABEL, computeTotalServiceCostPhp, formatPhp } from '@/lib/servicePricing';
import {
  DISCHARGE_FINAL_STATUSES,
  computeAdmissionDisplayId,
  findAdmissionForPatient,
  loadDischargeRecords,
  loadWorkflowOverrides,
  patchWorkflowOverride,
  updateDischargeRecord,
} from '@/lib/admissionDischargeStore';

const FILTER_OPTIONS = ['All Discharges', ...DISCHARGE_FINAL_STATUSES];

const SORT_OPTIONS = [
  { id: 'name', label: 'Patient Name', field: 'name', dir: 'asc' },
  { id: 'adm_date', label: 'Admission Date', field: 'adm', dir: 'desc' },
  { id: 'dis_date', label: 'Discharge Date', field: 'dis', dir: 'desc' },
  { id: 'status', label: 'Final Status', field: 'status', dir: 'asc' },
  { id: 'cost', label: 'Total Cost', field: 'cost', dir: 'desc' },
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

function monthsBetween(admittedIso, dischargedIso) {
  const a = ts(admittedIso);
  const d = ts(dischargedIso);
  if (!a || !d || d < a) return 1;
  const days = Math.max(1, Math.ceil((d - a) / (86400 * 1000)));
  return Math.max(1, Math.ceil(days / 30));
}

/** Same Patient ID formula as Admission Management: suffix from admission_requests.id when available. */
function enrichDischargeRowDisplayId(row, admissionList, patientById) {
  if (!row?.admissionRequestId || !Array.isArray(admissionList)) return row;
  const ar = admissionList.find((a) => a.id === row.admissionRequestId);
  const pat = row.patientId ? patientById.get(row.patientId) : null;
  if (ar) {
    return { ...row, admissionDisplayId: computeAdmissionDisplayId(ar, pat || null) };
  }
  /** Request row missing from DB — still derive ID from stored request UUID (same suffix as admission management). */
  return {
    ...row,
    admissionDisplayId: computeAdmissionDisplayId(
      {
        id: row.admissionRequestId,
        decided_at: row.admissionDate,
        created_at: row.createdAt || row.admissionDate,
      },
      pat || null
    ),
  };
}

function enrichDischargeRowsOffline(rows) {
  return (rows || []).map((row) => {
    if (!row.admissionRequestId) return row;
    return {
      ...row,
      admissionDisplayId: computeAdmissionDisplayId(
        {
          id: row.admissionRequestId,
          decided_at: row.admissionDate,
          created_at: row.createdAt || row.admissionDate,
        },
        row.patientId ? { id: row.patientId, admitted_at: row.admissionDate } : null
      ),
    };
  });
}

/** Keep Admission Management in sync: completed/discharged record → admission workflow "Completed" (clears stale "For Discharge"). */
function syncAdmissionWorkflowFromDischargeRow(r) {
  if (!r.admissionRequestId) return;
  if (r.finalStatus !== 'Completed' && r.finalStatus !== 'Discharged') return;
  const ov = loadWorkflowOverrides();
  if (ov[r.admissionRequestId]?.workflowStatus === 'Completed') return;
  patchWorkflowOverride(r.admissionRequestId, { workflowStatus: 'Completed' });
}

function syncAdmissionWorkflowFromRows(rows) {
  (rows || []).forEach(syncAdmissionWorkflowFromDischargeRow);
}

function sortDischargeRows(rows, sortId) {
  const opt = SORT_OPTIONS.find((o) => o.id === sortId) || SORT_OPTIONS[1];
  const cp = [...rows];
  const { field, dir } = opt;
  const mul = dir === 'asc' ? 1 : -1;
  cp.sort((a, b) => {
    if (field === 'name') return a.patientName.localeCompare(b.patientName, undefined, { sensitivity: 'base' }) * mul;
    if (field === 'adm') return (ts(a.admissionDate) - ts(b.admissionDate)) * mul;
    if (field === 'dis') return (ts(a.dischargeDate) - ts(b.dischargeDate)) * mul;
    if (field === 'cost') return (a.totalCost - b.totalCost) * mul;
    if (field === 'status') return a.finalStatus.localeCompare(b.finalStatus, undefined, { sensitivity: 'base' }) * mul;
    return 0;
  });
  return cp;
}

const DischargeManagement = () => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [formError, setFormError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Discharges');
  const [sortId, setSortId] = useState('dis_date');
  const [page, setPage] = useState(1);

  const [viewRow, setViewRow] = useState(null);
  const [editRow, setEditRow] = useState(null);

  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const filterDropdownRef = useRef(null);
  const sortDropdownRef = useRef(null);

  const mergeRows = useCallback((localRows, patientRows, admissionRows) => {
    const out = [...localRows];
    const seen = new Set(out.map((r) => r.patientId).filter(Boolean));
    (patientRows || []).forEach((p) => {
      if (!p.discharged_at || seen.has(p.id)) return;
      const months = monthsBetween(p.admitted_at, p.discharged_at);
      const pricingDetail = { branch: 'imus', monthsOfCare: months, includeAdmissionFee: true, includeMonthly: true };
      const totalCost = computeTotalServiceCostPhp(pricingDetail);
      const ar = findAdmissionForPatient(p, admissionRows || []);
      const admissionDisplayId = ar
        ? computeAdmissionDisplayId(ar, p)
        : computeAdmissionDisplayId({ id: p.id, decided_at: p.admitted_at, created_at: p.created_at }, p);
      out.push({
        id: `HIST-${p.id}`,
        admissionRequestId: ar?.id ?? null,
        admissionDisplayId,
        patientId: p.id,
        patientName: p.full_name || 'Patient',
        assignedStaff: '—',
        admissionDate: p.admitted_at,
        dischargeDate: p.discharged_at,
        finalStatus: 'Discharged',
        totalCost,
        pricingDetail,
        archived: false,
        createdAt: p.discharged_at,
        source: 'history',
      });
    });
    return out;
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setFormError('');
    try {
      const local = loadDischargeRecords();
      if (!isSupabaseConfigured()) {
        const offline = enrichDischargeRowsOffline(local);
        syncAdmissionWorkflowFromRows(offline);
        setRows(offline);
        return;
      }
      const [{ data: patients, error }, { data: admissions, error: admErr }] = await Promise.all([
        supabase.from('patients').select('*').not('discharged_at', 'is', null),
        supabase.from('admission_requests').select('*'),
      ]);
      if (error) throw error;
      if (admErr) console.warn('[discharge-management] admission_requests', admErr);

      const patientList = patients || [];
      const admissionList = admissions || [];
      const patientById = new Map(patientList.map((p) => [p.id, p]));
      const localEnriched = local.map((r) => enrichDischargeRowDisplayId(r, admissionList, patientById));
      const merged = mergeRows(localEnriched, patientList, admissionList);
      syncAdmissionWorkflowFromRows(merged);
      setRows(merged);
    } catch (e) {
      console.error(e);
      setFormError(e.message || 'Failed to load discharge records.');
      const fallback = enrichDischargeRowsOffline(loadDischargeRecords());
      syncAdmissionWorkflowFromRows(fallback);
      setRows(fallback);
    } finally {
      setLoading(false);
    }
  }, [mergeRows]);

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
      if (statusFilter === 'All Discharges') {
        // show full history including archived
      } else if (statusFilter === 'Archived') {
        if (!(r.archived || r.finalStatus === 'Archived')) return false;
      } else {
        if (r.archived) return false;
        if (r.finalStatus !== statusFilter) return false;
      }
      if (!q) return true;
      return (
        String(r.admissionDisplayId).toLowerCase().includes(q) ||
        String(r.patientName).toLowerCase().includes(q) ||
        String(r.assignedStaff).toLowerCase().includes(q) ||
        String(r.finalStatus).toLowerCase().includes(q)
      );
    });
    return sortDischargeRows(base, sortId);
  }, [rows, search, statusFilter, sortId]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sortId]);

  const persistLocal = () => {
    refreshAppData();
    void loadData();
  };

  const handleSaveEdit = () => {
    if (!editRow || editRow.source === 'history') return;
    const recalculated = computeTotalServiceCostPhp({
      branch: editRow._branch,
      monthsOfCare: Number(editRow._months) || 1,
      includeAdmissionFee: editRow._incAdm,
      includeMonthly: editRow._incMo,
    });
    updateDischargeRecord(editRow.id, {
      assignedStaff: editRow._staff,
      totalCost: recalculated,
      pricingDetail: {
        branch: editRow._branch,
        monthsOfCare: Number(editRow._months) || 1,
        includeAdmissionFee: editRow._incAdm,
        includeMonthly: editRow._incMo,
      },
    });
    setEditRow(null);
    persistLocal();
  };

  const handleFinalize = (r) => {
    if (r.source === 'history') return;
    const now = new Date().toISOString();
    updateDischargeRecord(r.id, { dischargeDate: r.dischargeDate || now, finalStatus: 'Completed' });
    syncAdmissionWorkflowFromDischargeRow({
      ...r,
      finalStatus: 'Completed',
      dischargeDate: r.dischargeDate || now,
    });
    persistLocal();
  };

  const handleArchive = (r) => {
    if (r.source === 'history') return;
    updateDischargeRecord(r.id, { archived: true, finalStatus: 'Archived' });
    persistLocal();
  };

  const handlePrint = () => {
    window.print();
  };

  const statusPill = (s) => {
    if (s === 'Ready for Discharge') return 'dm-pill--warn';
    if (s === 'Discharged' || s === 'Completed') return 'dm-pill--ok';
    if (s === 'Archived') return 'dm-pill--muted';
    return 'dm-pill--muted';
  };

  return (
    <div className="dm-outer" style={{ display: 'flex', minHeight: '100vh', background: '#F8F9FD', fontFamily: "'Inter', sans-serif", color: '#1B2559' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .dm-outer { width: 100vw; overflow-x: hidden; }
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
        .dm-main { flex: 1; min-height: 100vh; margin-left: ${isExpanded ? '280px' : '110px'}; transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1); padding: 40px; }
        .dm-card { background: white; border: 1px solid #E9EDF7; border-radius: 20px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.02); }
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
        .dm-row:hover { background: #F8FAFC; }
        .dm-th { position: sticky; top: 0; z-index: 1; }
        .dm-pill { display: inline-flex; padding: 5px 10px; border-radius: 999px; font-weight: 700; font-size: 11px; }
        .dm-pill--ok { color: #166534; background: #ECFDF3; border: 1px solid #BBF7D0; }
        .dm-pill--warn { color: #9a3412; background: #FFF7ED; border: 1px solid #FDBA74; }
        .dm-pill--muted { color: #475569; background: #F1F5F9; border: 1px solid #E2E8F0; }
        .dm-modal-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,0.35); display: flex; align-items: center; justify-content: center; z-index: 1100; }
        .dm-modal { width: min(92vw, 720px); max-height: 90vh; overflow-y: auto; background: white; border: 1px solid #E9EDF7; border-radius: 20px; box-shadow: 0 20px 50px rgba(15,23,42,0.25); }
        .dm-modal-head { padding: 16px 20px; border-bottom: 1px solid #EEF2FF; display: flex; align-items: center; justify-content: space-between; }
        .dm-modal-body { padding: 20px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .dm-modal-field { display: flex; flex-direction: column; gap: 6px; }
        .dm-modal-label { font-size: 12px; font-weight: 700; color: #707EAE; }
        .dm-input { border: 1px solid #E9EDF7; border-radius: 10px; padding: 10px 12px; font-size: 13px; color: #1B2559; outline: none; background: white; }
        .dm-input:focus { border-color: #2563EB; }
        .db-mobile-only { display: none; }
        @media print {
          .desktop-sidebar, .db-mobile-only, .dm-no-print { display: none !important; }
          .dm-main { margin-left: 0 !important; padding: 20px !important; }
        }
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .db-mobile-only { display: flex !important; }
          .dm-main { margin-left: 0 !important; width: 100vw !important; padding: 20px 12px 100px 12px !important; }
          .db-search-input { width: 100% !important; }
          .dm-modal-body { grid-template-columns: 1fr; }
          .db-mobile-top-bar { display: flex !important; width: 100vw; background: white; z-index: 1001; position: sticky; top: 0; padding: 0 20px; height: 64px; align-items: center; justify-content: space-between; border-bottom: 1px solid #F1F1F1; }
          .db-mobile-bottom-nav { position: fixed; bottom: 0; left: 0; width: 100vw; height: 72px; background: white; border-top: 1px solid #F1F1F1; display: flex; justify-content: space-around; align-items: center; z-index: 1000; box-shadow: 0 -4px 20px rgba(0,0,0,0.06); }
          .mob-nav-item { display: flex; flex-direction: column; align-items: center; font-size: 9px; color: #A3AED0; cursor: pointer; max-width: 20%; text-align: center; }
          .mob-nav-item.active { color: #F54E25; }
        }
      `}</style>

      <aside className="desktop-sidebar" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="sidebar-logo-container">
          <img src={logoBH} alt="BH" className="sidebar-logo" />
        </div>
        <nav className="sidebar-nav-scroll" aria-label="Admin navigation">
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-dashboard'); }}>
            <div className="icon-box inactive"><LayoutGrid size={22} /></div>
            <span className="sidebar-label">Dashboard</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-patient-database'); }}>
            <div className="icon-box inactive"><HeartPulse size={22} /></div>
            <span className="sidebar-label">Patient Management</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-admission-management'); }}>
            <div className="icon-box inactive"><ClipboardList size={22} /></div>
            <span className="sidebar-label">Admission Management</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => e.stopPropagation()}>
            <div className="icon-box active"><ArrowRightSquare size={22} /></div>
            <span className="sidebar-label" style={{ color: '#F54E25' }}>Discharge Management</span>
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
            <LogOut size={22} color="#F54E25" style={{ marginLeft: isExpanded ? 0 : 10, flexShrink: 0 }} />
            <span className="sidebar-label" style={{ color: '#F54E25' }}>Logout</span>
          </div>
        </div>
      </aside>

      <div className="db-mobile-only db-mobile-top-bar">
        <img src={logoBH} alt="BH" style={{ height: 32 }} />
        <span style={{ fontSize: 15, fontWeight: 800, color: '#F54E25' }}>Discharge</span>
        <div style={{ width: 36, height: 36, background: '#F54E25', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>AD</div>
      </div>

      <main className="dm-main">
        <div style={{ width: '100%' }} className="dm-print-area">
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#000' }}>Discharge Management</h1>
          <p style={{ fontSize: 13, color: '#707EAE', marginTop: 8, marginBottom: 20, fontWeight: 500 }}>
            Ready-for-discharge and completed discharges. Totals use the same fee structure as Services (admission + monthly branch rates).
          </p>

          <div className="dm-no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
            <button className="db-action-btn" type="button" onClick={() => void loadData()} disabled={loading}>
              <RefreshCw size={13} /> {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button className="db-action-btn" type="button" onClick={handlePrint}>
              <Printer size={13} /> Print summary
            </button>
          </div>

          <div className="dm-card">
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
                    aria-label="Discharge status filter"
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
                    <ul className="db-sort-by-menu" role="listbox" aria-label="Discharge status">
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

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#323D4E', color: 'white' }}>
                    {['Patient ID', 'Patient', 'Staff', 'Admission Date', 'Discharge Date', 'Final Status', 'Total Cost', 'Actions'].map((col, idx) => (
                      <th className="dm-th" key={col} style={{ padding: '11px 12px', borderRight: idx < 7 ? '1px solid #4B5563' : 'none', whiteSpace: 'nowrap', fontWeight: 500 }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={8} style={{ padding: 18, color: '#64748b' }}>Loading...</td></tr>}
                  {!loading && pageRows.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: 18, color: '#64748b' }}>No discharge records match your filters.</td></tr>
                  )}
                  {!loading &&
                    pageRows.map((r) => (
                      <tr key={r.id} className="dm-row" style={{ borderBottom: '1px solid #F4F7FE' }}>
                        <td style={{ padding: '12px', fontWeight: 700, color: '#1B2559', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{r.admissionDisplayId}</td>
                        <td style={{ padding: '12px', fontWeight: 600 }}>{r.patientName}</td>
                        <td style={{ padding: '12px', color: '#707EAE' }}>{r.assignedStaff}</td>
                        <td style={{ padding: '12px' }}>{formatDate(r.admissionDate)}</td>
                        <td style={{ padding: '12px' }}>{formatDate(r.dischargeDate)}</td>
                        <td style={{ padding: '12px' }}>
                          <span className={`dm-pill ${statusPill(r.finalStatus)}`}>{r.finalStatus}</span>
                          {r.source === 'history' && <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 6 }}>(from patient record)</span>}
                        </td>
                        <td style={{ padding: '12px', fontWeight: 700, color: '#05CD99' }}>{formatPhp(r.totalCost)}</td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            <button type="button" className="db-view-btn" onClick={() => setViewRow(r)}><Eye size={12} /> View</button>
                            <button
                              type="button"
                              className="db-edit-btn"
                              disabled={r.source === 'history'}
                              onClick={() =>
                                setEditRow({
                                  ...r,
                                  _staff: r.assignedStaff,
                                  _branch: r.pricingDetail?.branch || 'imus',
                                  _months: r.pricingDetail?.monthsOfCare ?? 1,
                                  _incAdm: r.pricingDetail?.includeAdmissionFee !== false,
                                  _incMo: r.pricingDetail?.includeMonthly !== false,
                                  _cost: r.totalCost,
                                })
                              }
                            >
                              <Edit2 size={12} /> Edit
                            </button>
                            <button
                              type="button"
                              className="db-action-btn"
                              disabled={r.source === 'history' || r.finalStatus === 'Completed' || r.finalStatus === 'Archived'}
                              onClick={() => handleFinalize(r)}
                            >
                              <CheckCircle size={12} /> Finalize
                            </button>
                            <button type="button" className="db-action-btn" disabled={r.source === 'history'} onClick={() => handleArchive(r)}>
                              <Archive size={12} /> Archive
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
        <div className="mob-nav-item" onClick={() => navigate('/admin-patient-database')}><HeartPulse size={18} color="#A3AED0" /><span>Patients</span></div>
        <div className="mob-nav-item" onClick={() => navigate('/admin-admission-management')}><ClipboardList size={18} color="#A3AED0" /><span>Adm</span></div>
        <div className="mob-nav-item active"><ArrowRightSquare size={18} color="white" /><span style={{ color: '#F54E25' }}>Disch</span></div>
        <div className="mob-nav-item" onClick={() => navigate('/admin-user-management')}><Users size={18} color="#A3AED0" /><span>Users</span></div>
        <div className="mob-nav-item" onClick={() => navigate('/admin-staff-management')}><Stethoscope size={18} color="#A3AED0" /><span>Staff</span></div>
      </div>

      {viewRow && (
        <div className="dm-modal-backdrop" onClick={() => setViewRow(null)}>
          <div className="dm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dm-modal-head">
              <div style={{ fontSize: 18, fontWeight: 800 }}>Discharge details</div>
              <button type="button" className="db-action-btn" onClick={() => setViewRow(null)}><X size={16} /></button>
            </div>
            <div className="dm-modal-body">
              <div className="dm-modal-field"><span className="dm-modal-label">Patient ID</span><div className="dm-input">{viewRow.admissionDisplayId}</div></div>
              <div className="dm-modal-field"><span className="dm-modal-label">Patient</span><div className="dm-input">{viewRow.patientName}</div></div>
              <div className="dm-modal-field"><span className="dm-modal-label">Assigned staff</span><div className="dm-input">{viewRow.assignedStaff}</div></div>
              <div className="dm-modal-field"><span className="dm-modal-label">Admission date</span><div className="dm-input">{formatDate(viewRow.admissionDate)}</div></div>
              <div className="dm-modal-field"><span className="dm-modal-label">Discharge date</span><div className="dm-input">{formatDate(viewRow.dischargeDate)}</div></div>
              <div className="dm-modal-field"><span className="dm-modal-label">Final status</span><div className="dm-input">{viewRow.finalStatus}</div></div>
              <div className="dm-modal-field"><span className="dm-modal-label">Total cost</span><div className="dm-input" style={{ fontWeight: 800, color: '#05CD99' }}>{formatPhp(viewRow.totalCost)}</div></div>
              <div className="dm-modal-field"><span className="dm-modal-label">Branch</span><div className="dm-input">{BRANCH_LABEL[viewRow.pricingDetail?.branch] || 'Imus Branch'}</div></div>
              <div className="dm-modal-field"><span className="dm-modal-label">Pricing basis</span><div className="dm-input">Admission fee + monthly rate × months (see Services page)</div></div>
            </div>
          </div>
        </div>
      )}

      {editRow && (
        <div className="dm-modal-backdrop" onClick={() => setEditRow(null)}>
          <div className="dm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dm-modal-head">
              <div style={{ fontSize: 18, fontWeight: 800 }}>Edit discharge</div>
              <button type="button" className="db-action-btn" onClick={() => setEditRow(null)}><X size={16} /></button>
            </div>
            <div className="dm-modal-body">
              <label className="dm-modal-field">
                <span className="dm-modal-label">Assigned staff</span>
                <input className="dm-input" value={editRow._staff} onChange={(e) => setEditRow((p) => ({ ...p, _staff: e.target.value }))} />
              </label>
              <label className="dm-modal-field">
                <span className="dm-modal-label">Branch (monthly)</span>
                <select className="dm-input" value={editRow._branch} onChange={(e) => setEditRow((p) => ({ ...p, _branch: e.target.value }))}>
                  {BRANCH_KEYS.map((k) => (
                    <option key={k} value={k}>{BRANCH_LABEL[k]}</option>
                  ))}
                </select>
              </label>
              <label className="dm-modal-field">
                <span className="dm-modal-label">Months of care</span>
                <input
                  className="dm-input"
                  type="number"
                  min={0}
                  value={editRow._months}
                  onChange={(e) => setEditRow((p) => ({ ...p, _months: e.target.value }))}
                />
              </label>
              <label className="dm-modal-field" style={{ gridColumn: '1 / -1', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <input type="checkbox" checked={editRow._incAdm} onChange={(e) => setEditRow((p) => ({ ...p, _incAdm: e.target.checked }))} />
                <span className="dm-modal-label" style={{ margin: 0 }}>Include admission fee</span>
              </label>
              <label className="dm-modal-field" style={{ gridColumn: '1 / -1', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <input type="checkbox" checked={editRow._incMo} onChange={(e) => setEditRow((p) => ({ ...p, _incMo: e.target.checked }))} />
                <span className="dm-modal-label" style={{ margin: 0 }}>Include monthly fees</span>
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

export default DischargeManagement;
