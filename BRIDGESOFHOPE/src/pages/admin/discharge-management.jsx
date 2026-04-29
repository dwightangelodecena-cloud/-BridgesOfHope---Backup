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
  CheckCircle2,
  Archive,
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
import { uiDischargeRequestFromRow } from '@/lib/dbMappers';
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

const toDateInput = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

function loadLocalFamilyDischargeRequestMap() {
  try {
    const raw = localStorage.getItem('bh_pending_discharges');
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return {};
    const sorted = [...arr].sort((a, b) => ts(b.created_at || b.id) - ts(a.created_at || a.id));
    const map = {};
    sorted.forEach((row) => {
      const pid = row.patient_id != null ? String(row.patient_id) : null;
      if (!pid || map[pid] != null) return;
      let requestTime = '';
      if (row.created_at) {
        try {
          requestTime = new Date(row.created_at).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
        } catch {
          requestTime = String(row.created_at);
        }
      }
      map[pid] = {
        dischargeReasonCategory: row.reason_category || '',
        dischargeReasonDetails: row.reason_details || '',
        preferredDischargeDate: row.preferred_discharge_date || null,
        pickupAuthorized: row.pickup_authorized || '',
        followUpPhone: row.follow_up_phone || '',
        dischargeOtherInfo: row.other_info || '',
        requestTime,
      };
    });
    return map;
  } catch {
    return {};
  }
}

function initDischargeDetailForm(r, familyDischargeUi) {
  const staff = r.assignedStaff && r.assignedStaff !== '—' ? r.assignedStaff : '';
  return {
    ...r,
    _staff: staff,
    _branch: r.pricingDetail?.branch || 'imus',
    _months: String(r.pricingDetail?.monthsOfCare ?? 1),
    _incAdm: r.pricingDetail?.includeAdmissionFee !== false,
    _incMo: r.pricingDetail?.includeMonthly !== false,
    _admissionDate: toDateInput(r.admissionDate),
    _dischargeDate: toDateInput(r.dischargeDate),
    _finalStatus: r.finalStatus,
    _patientName: r.patientName || '',
    _pricingNotes: r.pricingNotes || '',
    _familyDischarge: familyDischargeUi || null,
    _familyMeetingHeld: Boolean(r.familyMeetingHeld),
    _familyMeetingDate: toDateInput(r.familyMeetingDate),
    _waiverAgainstAdviceSigned: Boolean(r.waiverAgainstAdviceSigned),
    _riskExplanationNotes: r.riskExplanationNotes || '',
    _financialHold: Boolean(r.financialHold),
    _financialHoldReason: r.financialHoldReason || '',
    _pickupRequired: r.pickupRequired !== false,
    _pickupStatus: r.pickupStatus || 'Awaiting pickup',
    _facilityHold: Boolean(r.facilityHold),
    _facilityHoldReason: r.facilityHoldReason || '',
    _finalDispositionDecision: r.finalDispositionDecision || '',
  };
}

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

  const [detailModal, setDetailModal] = useState(null);
  /** Latest family discharge request per patient id (string), from DB or local pending queue — same fields as Request Management. */
  const [familyDischargeByPatientId, setFamilyDischargeByPatientId] = useState({});

  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const filterDropdownRef = useRef(null);
  const sortDropdownRef = useRef(null);

  const mergeRows = useCallback((localRows, patientRows, admissionRows) => {
    const overrides = loadWorkflowOverrides();
    const out = [...localRows];
    const seen = new Set(out.map((r) => r.patientId).filter(Boolean));
    (patientRows || []).forEach((p) => {
      if (!p.discharged_at || seen.has(p.id)) return;
      const months = monthsBetween(p.admitted_at, p.discharged_at);
      const pricingDetail = { branch: 'imus', monthsOfCare: months, includeAdmissionFee: true, includeMonthly: true };
      const totalCost = computeTotalServiceCostPhp(pricingDetail);
      const ar = findAdmissionForPatient(p, admissionRows || []);
      const staffFromWorkflow = ar?.id && overrides[ar.id]?.assignedStaff ? overrides[ar.id].assignedStaff : null;
      const admissionDisplayId = ar
        ? computeAdmissionDisplayId(ar, p)
        : computeAdmissionDisplayId({ id: p.id, decided_at: p.admitted_at, created_at: p.created_at }, p);
      out.push({
        id: `HIST-${p.id}`,
        admissionRequestId: ar?.id ?? null,
        admissionDisplayId,
        patientId: p.id,
        patientName: p.full_name || 'Patient',
        assignedStaff: staffFromWorkflow || '—',
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
        setFamilyDischargeByPatientId(loadLocalFamilyDischargeRequestMap());
        const offline = enrichDischargeRowsOffline(local);
        syncAdmissionWorkflowFromRows(offline);
        setRows(offline);
        return;
      }
      const [{ data: patients, error }, { data: admissions, error: admErr }, { data: drqRows, error: drqErr }] =
        await Promise.all([
          supabase.from('patients').select('*').not('discharged_at', 'is', null),
          supabase.from('admission_requests').select('*'),
          supabase
            .from('discharge_requests')
            .select('*, patients(full_name)')
            .order('created_at', { ascending: false }),
        ]);
      if (error) throw error;
      if (admErr) console.warn('[discharge-management] admission_requests', admErr);
      if (drqErr) console.warn('[discharge-management] discharge_requests', drqErr.message);

      const famMap = {};
      (drqRows || []).forEach((row) => {
        const pid = row.patient_id != null ? String(row.patient_id) : null;
        if (!pid || famMap[pid] != null) return;
        const ui = uiDischargeRequestFromRow(row);
        if (ui) famMap[pid] = ui;
      });
      setFamilyDischargeByPatientId({ ...loadLocalFamilyDischargeRequestMap(), ...famMap });

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
      setFamilyDischargeByPatientId(loadLocalFamilyDischargeRequestMap());
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

  const handleSaveDetail = () => {
    if (!detailModal || detailModal.source === 'history') return;
    const months = Number(detailModal._months) || 1;
    const recalculated = computeTotalServiceCostPhp({
      branch: detailModal._branch,
      monthsOfCare: months,
      includeAdmissionFee: detailModal._incAdm,
      includeMonthly: detailModal._incMo,
    });
    const admissionIso = detailModal._admissionDate
      ? new Date(`${detailModal._admissionDate}T12:00:00`).toISOString()
      : detailModal.admissionDate;
    const dischargeIso = detailModal._dischargeDate
      ? new Date(`${detailModal._dischargeDate}T12:00:00`).toISOString()
      : null;
    const familyMeetingDateIso = detailModal._familyMeetingDate
      ? new Date(`${detailModal._familyMeetingDate}T12:00:00`).toISOString()
      : null;

    if (detailModal._waiverAgainstAdviceSigned && !detailModal._familyMeetingHeld) {
      setFormError('Family meeting should be recorded before signing waiver against advice.');
      return;
    }
    if (detailModal._financialHold && !String(detailModal._financialHoldReason || '').trim()) {
      setFormError('Financial hold reason is required when hold is enabled.');
      return;
    }
    if (detailModal._facilityHold && !String(detailModal._facilityHoldReason || '').trim()) {
      setFormError('Facility hold reason is required when unresolved conditions hold is enabled.');
      return;
    }
    if (detailModal._pickupRequired !== false && !String(detailModal._pickupStatus || '').trim()) {
      setFormError('Pickup status is required when family pickup is required.');
      return;
    }
    setFormError('');

    updateDischargeRecord(detailModal.id, {
      patientName: String(detailModal._patientName || '').trim() || detailModal.patientName,
      assignedStaff: String(detailModal._staff || '').trim() || '—',
      admissionDate: admissionIso,
      dischargeDate: dischargeIso,
      finalStatus: detailModal._finalStatus,
      totalCost: recalculated,
      pricingDetail: {
        branch: detailModal._branch,
        monthsOfCare: months,
        includeAdmissionFee: detailModal._incAdm,
        includeMonthly: detailModal._incMo,
      },
      pricingNotes: String(detailModal._pricingNotes || '').trim(),
      familyMeetingHeld: Boolean(detailModal._familyMeetingHeld),
      familyMeetingDate: familyMeetingDateIso,
      waiverAgainstAdviceSigned: Boolean(detailModal._waiverAgainstAdviceSigned),
      riskExplanationNotes: String(detailModal._riskExplanationNotes || '').trim(),
      financialHold: Boolean(detailModal._financialHold),
      financialHoldReason: String(detailModal._financialHoldReason || '').trim(),
      pickupRequired: detailModal._pickupRequired !== false,
      pickupStatus: String(detailModal._pickupStatus || '').trim() || 'Awaiting pickup',
      facilityHold: Boolean(detailModal._facilityHold),
      facilityHoldReason: String(detailModal._facilityHoldReason || '').trim(),
      finalDispositionDecision: String(detailModal._finalDispositionDecision || '').trim(),
    });
    setDetailModal(null);
    persistLocal();
  };

  const handleFinalize = (r) => {
    if (r.source === 'history') return;
    if (r.financialHold) {
      setFormError('Cannot finalize discharge while financial hold is active.');
      return;
    }
    if (r.facilityHold) {
      setFormError('Cannot finalize discharge while facility hold due to unresolved conditions is active.');
      return;
    }
    if (r.pickupRequired !== false && !/complete|picked up|released/i.test(String(r.pickupStatus || ''))) {
      setFormError('Family pickup is required. Set pickup status to completed/picked up before finalizing.');
      return;
    }
    if (!String(r.finalDispositionDecision || '').trim()) {
      setFormError('Final disposition decision is required before finalizing discharge.');
      return;
    }
    const now = new Date().toISOString();
    updateDischargeRecord(r.id, {
      dischargeDate: r.dischargeDate || now,
      finalStatus: 'Completed',
      finalDispositionAt: now,
    });
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
        .dm-outer { width: 100%; overflow-x: clip; }
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
        .dm-main { flex: 0 0 auto; width: calc(100vw - ${isExpanded ? '280px' : '110px'}); min-height: 100vh; margin-left: ${isExpanded ? '280px' : '110px'}; transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1); padding: 24px; }
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
        .dm-modal { width: min(92vw, 880px); max-height: 90vh; overflow-y: auto; background: white; border: 1px solid #E9EDF7; border-radius: 20px; box-shadow: 0 20px 50px rgba(15,23,42,0.25); }
        .dm-modal-head { padding: 16px 20px; border-bottom: 1px solid #EEF2FF; display: flex; align-items: center; justify-content: space-between; }
        .dm-modal-body { padding: 20px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .dm-family-request-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .dm-modal-field { display: flex; flex-direction: column; gap: 6px; }
        .dm-modal-label { font-size: 12px; font-weight: 700; color: #707EAE; }
        .dm-input { border: 1px solid #E9EDF7; border-radius: 10px; padding: 10px 12px; font-size: 13px; color: #1B2559; outline: none; background: white; }
        .dm-input:focus { border-color: #2563EB; }
        .dm-modal-body select.dm-input {
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          background-image: none;
        }
        .dm-modal-body select.dm-input::-ms-expand {
          display: none;
        }
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
          .dm-family-request-grid { grid-template-columns: 1fr; }
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
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-recovery-roadmap'); }}>
            <div className="icon-box inactive"><CheckCircle2 size={22} /></div>
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
        <span style={{ fontSize: 15, fontWeight: 800, color: '#F54E25' }}>Discharge</span>
        <div style={{ width: 36, height: 36, background: '#F54E25', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>AD</div>
      </div>

      <main className="dm-main">
        <div style={{ width: '100%' }} className="dm-print-area">
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#000' }}>Discharge Management</h1>
          <p style={{ fontSize: 13, color: '#707EAE', marginTop: 8, marginBottom: 20, fontWeight: 500 }}>
            Ready-for-discharge and completed discharges. Totals use the same fee structure as Services (admission + Imus monthly rate).
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
                      <th className="dm-th" key={col} style={{ padding: '10px 10px', borderRight: idx < 7 ? '1px solid #4B5563' : 'none', whiteSpace: 'nowrap', fontWeight: 500 }}>{col}</th>
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
                        <td style={{ padding: '9px 10px', fontWeight: 700, color: '#1B2559', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{r.admissionDisplayId}</td>
                        <td style={{ padding: '9px 10px', fontWeight: 600 }}>{r.patientName}</td>
                        <td style={{ padding: '9px 10px', color: '#707EAE' }}>{r.assignedStaff}</td>
                        <td style={{ padding: '9px 10px' }}>{formatDate(r.admissionDate)}</td>
                        <td style={{ padding: '9px 10px' }}>{formatDate(r.dischargeDate)}</td>
                        <td style={{ padding: '9px 10px' }}>
                          <span className={`dm-pill ${statusPill(r.finalStatus)}`}>{r.finalStatus}</span>
                          {r.source === 'history' && <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 6 }}>(from patient record)</span>}
                          {!r.source && r.financialHold ? (
                            <span style={{ fontSize: 10, color: '#991B1B', marginLeft: 6, fontWeight: 700 }}>(financial hold)</span>
                          ) : null}
                          {!r.source && r.facilityHold ? (
                            <span style={{ fontSize: 10, color: '#7C2D12', marginLeft: 6, fontWeight: 700 }}>(facility hold)</span>
                          ) : null}
                          {!r.source && r.pickupRequired !== false ? (
                            <span style={{ fontSize: 10, color: '#1D4ED8', marginLeft: 6, fontWeight: 700 }}>(pickup required)</span>
                          ) : null}
                        </td>
                        <td style={{ padding: '9px 10px', fontWeight: 700, color: '#05CD99' }}>{formatPhp(r.totalCost)}</td>
                        <td style={{ padding: '9px 10px' }}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="db-view-btn"
                              onClick={() =>
                                setDetailModal(
                                  initDischargeDetailForm(
                                    r,
                                    r.patientId != null ? familyDischargeByPatientId[String(r.patientId)] : null
                                  )
                                )
                              }
                            >
                              <Eye size={12} /> View
                            </button>
                            <button
                              type="button"
                              className="db-edit-btn"
                              onClick={() =>
                                setDetailModal(
                                  initDischargeDetailForm(
                                    r,
                                    r.patientId != null ? familyDischargeByPatientId[String(r.patientId)] : null
                                  )
                                )
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

      {detailModal && (() => {
        const historyReadOnly = detailModal.source === 'history';
        const previewCost = computeTotalServiceCostPhp({
          branch: detailModal._branch,
          monthsOfCare: Number(detailModal._months) || 1,
          includeAdmissionFee: detailModal._incAdm,
          includeMonthly: detailModal._incMo,
        });
        const patch = (partial) => setDetailModal((p) => (p ? { ...p, ...partial } : p));
        return (
          <div className="dm-modal-backdrop" onClick={() => setDetailModal(null)}>
            <div className="dm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="dm-modal-head">
                <div style={{ fontSize: 18, fontWeight: 800 }}>Discharge details</div>
                <button type="button" className="db-action-btn" onClick={() => setDetailModal(null)}><X size={16} /></button>
              </div>
              {historyReadOnly && (
                <div
                  style={{
                    padding: '12px 20px',
                    background: '#fff7ed',
                    color: '#9a3412',
                    fontSize: 13,
                    fontWeight: 600,
                    borderBottom: '1px solid #fed7aa',
                  }}
                >
                  This row is built from the discharged patient record. Fields are read-only; add or edit a discharge record from Admission Management to change stored discharge data.
                </div>
              )}
              <div className="dm-modal-body">
                <label className="dm-modal-field">
                  <span className="dm-modal-label">Patient ID</span>
                  <input className="dm-input" readOnly value={detailModal.admissionDisplayId || ''} style={{ background: '#f8fafc' }} />
                </label>
                <label className="dm-modal-field">
                  <span className="dm-modal-label">Patient name</span>
                  <input
                    className="dm-input"
                    disabled={historyReadOnly}
                    value={detailModal._patientName}
                    onChange={(e) => patch({ _patientName: e.target.value })}
                  />
                </label>

                <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #EEF2FF', paddingTop: 16, marginTop: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#1B2559', marginBottom: 6 }}>Family discharge request</div>
                  <p style={{ fontSize: 12, color: '#64748b', marginBottom: 14, lineHeight: 1.45 }}>
                    Same data families submit under Request Management → Discharge. Structured columns come from the database;
                    escort, destination, follow-up clinic, medication plan, and belongings are often bundled in{' '}
                    <strong>Other information</strong> as saved by the portal.
                  </p>
                  {detailModal._familyDischarge ? (
                    <div className="dm-family-request-grid">
                      <label className="dm-modal-field">
                        <span className="dm-modal-label">Reason category</span>
                        <input
                          className="dm-input"
                          readOnly
                          style={{ background: '#f8fafc' }}
                          value={detailModal._familyDischarge.dischargeReasonCategory || '—'}
                        />
                      </label>
                      <label className="dm-modal-field">
                        <span className="dm-modal-label">Preferred discharge date</span>
                        <input
                          className="dm-input"
                          readOnly
                          style={{ background: '#f8fafc' }}
                          value={formatDate(detailModal._familyDischarge.preferredDischargeDate)}
                        />
                      </label>
                      <label className="dm-modal-field">
                        <span className="dm-modal-label">Authorized pickup</span>
                        <input
                          className="dm-input"
                          readOnly
                          style={{ background: '#f8fafc' }}
                          value={detailModal._familyDischarge.pickupAuthorized || '—'}
                        />
                      </label>
                      <label className="dm-modal-field">
                        <span className="dm-modal-label">Follow-up phone</span>
                        <input
                          className="dm-input"
                          readOnly
                          style={{ background: '#f8fafc' }}
                          value={detailModal._familyDischarge.followUpPhone || '—'}
                        />
                      </label>
                      <label className="dm-modal-field" style={{ gridColumn: '1 / -1' }}>
                        <span className="dm-modal-label">Reason details</span>
                        <textarea
                          className="dm-input"
                          readOnly
                          rows={3}
                          style={{ background: '#f8fafc', resize: 'vertical' }}
                          value={detailModal._familyDischarge.dischargeReasonDetails || ''}
                        />
                      </label>
                      <label className="dm-modal-field" style={{ gridColumn: '1 / -1' }}>
                        <span className="dm-modal-label">Other information (escort, destination, clinic, meds, belongings, notes)</span>
                        <textarea
                          className="dm-input"
                          readOnly
                          rows={5}
                          style={{ background: '#f8fafc', resize: 'vertical', whiteSpace: 'pre-wrap' }}
                          value={detailModal._familyDischarge.dischargeOtherInfo || ''}
                        />
                      </label>
                      {detailModal._familyDischarge.requestTime ? (
                        <div className="dm-modal-field" style={{ gridColumn: '1 / -1' }}>
                          <span className="dm-modal-label">Submitted</span>
                          <div className="dm-input" style={{ background: '#f8fafc' }}>{detailModal._familyDischarge.requestTime}</div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div
                      className="dm-input"
                      style={{
                        background: '#f8fafc',
                        color: '#64748b',
                        fontSize: 13,
                        gridColumn: '1 / -1',
                      }}
                    >
                      No discharge request on file for this patient (no match on patient ID). If the family just submitted, try Refresh.
                    </div>
                  )}
                </div>

                <label className="dm-modal-field">
                  <span className="dm-modal-label">Assigned staff</span>
                  <input
                    className="dm-input"
                    disabled={historyReadOnly}
                    placeholder="Name or role"
                    value={detailModal._staff}
                    onChange={(e) => patch({ _staff: e.target.value })}
                  />
                </label>
                <label className="dm-modal-field">
                  <span className="dm-modal-label">Admission date</span>
                  <input
                    className="dm-input"
                    type="date"
                    disabled={historyReadOnly}
                    value={detailModal._admissionDate}
                    onChange={(e) => patch({ _admissionDate: e.target.value })}
                  />
                </label>
                <label className="dm-modal-field">
                  <span className="dm-modal-label">Discharge date</span>
                  <input
                    className="dm-input"
                    type="date"
                    disabled={historyReadOnly}
                    value={detailModal._dischargeDate}
                    onChange={(e) => patch({ _dischargeDate: e.target.value })}
                  />
                </label>
                <label className="dm-modal-field">
                  <span className="dm-modal-label">Family meeting date</span>
                  <input
                    className="dm-input"
                    type="date"
                    disabled={historyReadOnly}
                    value={detailModal._familyMeetingDate}
                    onChange={(e) => patch({ _familyMeetingDate: e.target.value })}
                  />
                </label>
                <label className="dm-modal-field">
                  <span className="dm-modal-label">Final status</span>
                  <select
                    className="dm-input"
                    disabled={historyReadOnly}
                    value={detailModal._finalStatus}
                    onChange={(e) => patch({ _finalStatus: e.target.value })}
                  >
                    {DISCHARGE_FINAL_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="dm-modal-field" style={{ gridColumn: '1 / -1', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <input
                    type="checkbox"
                    disabled={historyReadOnly}
                    checked={detailModal._familyMeetingHeld}
                    onChange={(e) => patch({ _familyMeetingHeld: e.target.checked })}
                  />
                  <span className="dm-modal-label" style={{ margin: 0 }}>Family meeting completed</span>
                </label>
                <label className="dm-modal-field" style={{ gridColumn: '1 / -1', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <input
                    type="checkbox"
                    disabled={historyReadOnly}
                    checked={detailModal._waiverAgainstAdviceSigned}
                    onChange={(e) => patch({ _waiverAgainstAdviceSigned: e.target.checked })}
                  />
                  <span className="dm-modal-label" style={{ margin: 0 }}>Waiver against program advice signed</span>
                </label>
                <label className="dm-modal-field" style={{ gridColumn: '1 / -1' }}>
                  <span className="dm-modal-label">Risk explanation notes</span>
                  <textarea
                    className="dm-input"
                    disabled={historyReadOnly}
                    rows={3}
                    style={{ resize: 'vertical', minHeight: 72 }}
                    placeholder="Document risks explained to family/patient when they refuse discharge recommendation."
                    value={detailModal._riskExplanationNotes}
                    onChange={(e) => patch({ _riskExplanationNotes: e.target.value })}
                  />
                </label>
                <label className="dm-modal-field">
                  <span className="dm-modal-label">Total cost (from pricing below)</span>
                  <div className="dm-input" style={{ fontWeight: 800, color: '#05CD99', background: '#f8fafc' }}>{formatPhp(previewCost)}</div>
                </label>
                <label className="dm-modal-field" style={{ gridColumn: '1 / -1', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <input
                    type="checkbox"
                    disabled={historyReadOnly}
                    checked={detailModal._financialHold}
                    onChange={(e) => patch({ _financialHold: e.target.checked })}
                  />
                  <span className="dm-modal-label" style={{ margin: 0 }}>Financial hold active (cannot finalize while enabled)</span>
                </label>
                <label className="dm-modal-field" style={{ gridColumn: '1 / -1' }}>
                  <span className="dm-modal-label">Financial hold reason</span>
                  <textarea
                    className="dm-input"
                    disabled={historyReadOnly}
                    rows={2}
                    style={{ resize: 'vertical', minHeight: 56 }}
                    placeholder="e.g. Remaining balance pending family/admin agreement."
                    value={detailModal._financialHoldReason}
                    onChange={(e) => patch({ _financialHoldReason: e.target.value })}
                  />
                </label>
                <label className="dm-modal-field">
                  <span className="dm-modal-label">Pickup policy</span>
                  <select
                    className="dm-input"
                    disabled={historyReadOnly}
                    value={detailModal._pickupRequired ? 'required' : 'optional'}
                    onChange={(e) => patch({ _pickupRequired: e.target.value === 'required' })}
                  >
                    <option value="required">Family pickup required</option>
                    <option value="optional">Pickup optional / service arrangement</option>
                  </select>
                </label>
                <label className="dm-modal-field">
                  <span className="dm-modal-label">Pickup status</span>
                  <input
                    className="dm-input"
                    disabled={historyReadOnly}
                    placeholder="Awaiting pickup / Scheduled / Completed"
                    value={detailModal._pickupStatus}
                    onChange={(e) => patch({ _pickupStatus: e.target.value })}
                  />
                </label>
                <label className="dm-modal-field" style={{ gridColumn: '1 / -1', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <input
                    type="checkbox"
                    disabled={historyReadOnly}
                    checked={detailModal._facilityHold}
                    onChange={(e) => patch({ _facilityHold: e.target.checked })}
                  />
                  <span className="dm-modal-label" style={{ margin: 0 }}>Hold in facility due to unresolved conditions</span>
                </label>
                <label className="dm-modal-field" style={{ gridColumn: '1 / -1' }}>
                  <span className="dm-modal-label">Unresolved conditions / facility hold reason</span>
                  <textarea
                    className="dm-input"
                    disabled={historyReadOnly}
                    rows={2}
                    style={{ resize: 'vertical', minHeight: 56 }}
                    placeholder="Document unresolved conditions requiring temporary facility hold before family pickup/release."
                    value={detailModal._facilityHoldReason}
                    onChange={(e) => patch({ _facilityHoldReason: e.target.value })}
                  />
                </label>
                <label className="dm-modal-field" style={{ gridColumn: '1 / -1' }}>
                  <span className="dm-modal-label">Final disposition decision (required before finalize)</span>
                  <textarea
                    className="dm-input"
                    disabled={historyReadOnly}
                    rows={2}
                    style={{ resize: 'vertical', minHeight: 56 }}
                    placeholder="e.g. Family pickup completed at gate 2; patient released with belongings and handoff acknowledgment."
                    value={detailModal._finalDispositionDecision}
                    onChange={(e) => patch({ _finalDispositionDecision: e.target.value })}
                  />
                </label>
                <label className="dm-modal-field">
                  <span className="dm-modal-label">Location (monthly rate)</span>
                  <select
                    className="dm-input"
                    disabled={historyReadOnly}
                    value={detailModal._branch}
                    onChange={(e) => patch({ _branch: e.target.value })}
                  >
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
                    min={1}
                    disabled={historyReadOnly}
                    value={detailModal._months}
                    onChange={(e) => patch({ _months: e.target.value })}
                  />
                </label>
                <label className="dm-modal-field" style={{ gridColumn: '1 / -1', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <input
                    type="checkbox"
                    disabled={historyReadOnly}
                    checked={detailModal._incAdm}
                    onChange={(e) => patch({ _incAdm: e.target.checked })}
                  />
                  <span className="dm-modal-label" style={{ margin: 0 }}>Include admission fee</span>
                </label>
                <label className="dm-modal-field" style={{ gridColumn: '1 / -1', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <input
                    type="checkbox"
                    disabled={historyReadOnly}
                    checked={detailModal._incMo}
                    onChange={(e) => patch({ _incMo: e.target.checked })}
                  />
                  <span className="dm-modal-label" style={{ margin: 0 }}>Include monthly fees</span>
                </label>
                <label className="dm-modal-field" style={{ gridColumn: '1 / -1' }}>
                  <span className="dm-modal-label">Pricing basis &amp; notes</span>
                  <textarea
                    className="dm-input"
                    disabled={historyReadOnly}
                    rows={3}
                    style={{ resize: 'vertical', minHeight: 72 }}
                    placeholder="e.g. Admission fee + Imus monthly rate × months; adjustments, discounts, or internal notes."
                    value={detailModal._pricingNotes}
                    onChange={(e) => patch({ _pricingNotes: e.target.value })}
                  />
                </label>
              </div>
              <div style={{ padding: 16, borderTop: '1px solid #EEF2FF', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="db-action-btn" onClick={() => setDetailModal(null)}>Close</button>
                {!historyReadOnly && (
                  <button type="button" className="db-edit-btn" onClick={() => handleSaveDetail()}>Save changes</button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default DischargeManagement;
