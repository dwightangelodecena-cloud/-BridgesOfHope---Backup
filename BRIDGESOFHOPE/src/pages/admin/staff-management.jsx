import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
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
  ChevronDown,
  Stethoscope,
  ArrowUpDown,
  UserPlus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logoBH from '@/assets/logo2.png';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { APP_DATA_REFRESH, refreshAppData } from '@/lib/appDataRefresh';
import { formatAuthError } from '@/lib/authErrors';
import { getPasswordPolicyError } from '@/lib/passwordPolicy';

const META_KEY = 'bh_staff_admin_meta';
const LOCAL_STAFF_KEY = 'bh_staff_directory';

const ROLE_FILTER_OPTIONS = ['All Staff', 'Nurses', 'Clinic Staff'];
const STATUS_FILTER_OPTIONS = [
  'All statuses',
  'Active',
  'Inactive',
  'Approved',
  'Unavailable',
  'On Duty',
  'Off Duty',
  'Suspended',
];
const SORT_OPTIONS = ['Staff ID', 'Full Name', 'Role', 'Status', 'Availability', 'Registered Date', 'Last Active'];

const ACTIVE_WINDOW_MS = 15 * 60 * 1000;

const defaultDirectionForField = (field) => {
  if (field === 'Registered Date' || field === 'Last Active') return 'desc';
  return 'asc';
};

const safeDateText = (iso) => {
  if (!iso) return 'N/A';
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return 'N/A';
  }
};

const safeDateTimeText = (iso) => {
  if (!iso) return 'N/A';
  try {
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'N/A';
  }
};

const asTimestamp = (iso) => {
  const t = new Date(iso || 0).getTime();
  return Number.isNaN(t) ? 0 : t;
};

const getPresenceStatus = (lastActiveAt) => {
  const ts = asTimestamp(lastActiveAt);
  if (!ts) return 'Inactive';
  return Date.now() - ts <= ACTIVE_WINDOW_MS ? 'Active' : 'Inactive';
};

const loadMetaMap = () => {
  try {
    const raw = localStorage.getItem(META_KEY);
    const o = raw ? JSON.parse(raw) : {};
    return typeof o === 'object' && o ? o : {};
  } catch {
    return {};
  }
};

const saveMetaMap = (map) => {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
};

const updateLocalStaffRow = (id, updates) => {
  try {
    const raw = localStorage.getItem(LOCAL_STAFF_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return;
    const idx = arr.findIndex((r) => String(r.id || r.user_id) === String(id));
    if (idx >= 0) {
      arr[idx] = { ...arr[idx], ...updates };
      localStorage.setItem(LOCAL_STAFF_KEY, JSON.stringify(arr));
    }
  } catch {
    /* ignore */
  }
};

const persistMetaForId = (id, partial) => {
  const cur = loadMetaMap();
  const merged = { ...cur[id], ...partial };
  if (Object.prototype.hasOwnProperty.call(partial, 'availability') && (partial.availability === null || partial.availability === '')) {
    delete merged.availability;
  }
  const map = { ...cur, [id]: merged };
  saveMetaMap(map);
};

const buildAddressFromRow = (row) => {
  const direct = row.address || row.location || row.city;
  if (direct) return direct;
  const composed = [row.house_block_lot, row.street, row.municipality, row.province]
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .join(', ');
  return composed || 'N/A';
};

const isNurseAccount = (account) => {
  const a = String(account || '').toLowerCase();
  return a.includes('nurse');
};

const isStaffAccount = (account) => {
  const a = String(account || '').toLowerCase();
  return a.includes('staff') || a === 'clinic' || a.includes('clinic');
};

const staffMatchesRoleFilter = (row, roleFilter) => {
  if (roleFilter === 'All Staff') return true;
  const acc = row.account_type || row.role || '';
  if (roleFilter === 'Nurses') return isNurseAccount(acc);
  if (roleFilter === 'Clinic Staff') return isStaffAccount(acc) && !isNurseAccount(acc);
  return true;
};

const mapRowToStaff = (row, idx, meta) => {
  const id = row.id || row.user_id || `stf-${idx}`;
  const m = meta[id] || {};
  const accountRaw = String(row.account_type || row.role || 'staff').trim();
  const roleLabel = isNurseAccount(accountRaw) ? 'Nurse' : isStaffAccount(accountRaw) ? 'Clinic Staff' : accountRaw || 'Staff';
  const presence = getPresenceStatus(row.last_active_at || row.last_login_at);
  const duty = presence === 'Active' ? 'On Duty' : 'Off Duty';
  const suspended = Boolean(m.suspended);
  const availabilityOverride = m.availability || null;
  let availability = availabilityOverride;
  if (!availability) {
    if (suspended) availability = 'Unavailable';
    else if (presence === 'Active') availability = 'Available';
    else availability = 'Unavailable';
  }
  const approvalStatus = suspended ? 'Suspended' : 'Approved';
  const sid = `STF-${String(id).replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  return {
    id,
    staffId: sid,
    fullName: row.full_name || row.name || 'Unknown',
    email: row.email || 'N/A',
    phone: row.phone || row.contact_number || row.mobile || 'N/A',
    address: buildAddressFromRow(row),
    roleLabel,
    roleRaw: accountRaw,
    department: m.department || row.department || 'General',
    branch: m.branch || row.branch || 'Main',
    shift: m.shift || row.shift || '—',
    employmentType: m.employmentType || row.employment_type || 'Full-time',
    status: suspended ? 'Inactive' : presence,
    presence,
    duty,
    availability,
    approvalStatus,
    suspended,
    assignedPatientsCount: typeof m.assignedPatientsCount === 'number' ? m.assignedPatientsCount : 0,
    registeredAt: row.created_at || null,
    lastActiveAt: row.last_active_at || row.last_login_at || null,
    raw: row,
  };
};

const mapLocalStaffList = () => {
  try {
    const raw = localStorage.getItem(LOCAL_STAFF_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    const meta = loadMetaMap();
    return arr.map((r, i) => mapRowToStaff(r, i, meta));
  } catch {
    return [];
  }
};

const sortStaff = (rows, field, direction) => {
  const cp = [...rows];
  const asc = direction === 'asc';
  cp.sort((a, b) => {
    let r = 0;
    if (field === 'Full Name') r = a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' });
    else if (field === 'Role') r = a.roleLabel.localeCompare(b.roleLabel, undefined, { sensitivity: 'base' });
    else if (field === 'Status') r = a.status.localeCompare(b.status, undefined, { sensitivity: 'base' });
    else if (field === 'Availability') r = a.availability.localeCompare(b.availability, undefined, { sensitivity: 'base' });
    else if (field === 'Registered Date') r = asTimestamp(a.registeredAt) - asTimestamp(b.registeredAt);
    else if (field === 'Last Active') r = asTimestamp(a.lastActiveAt) - asTimestamp(b.lastActiveAt);
    else r = String(a.staffId).localeCompare(String(b.staffId), undefined, { sensitivity: 'base' });
    return asc ? r : -r;
  });
  return cp;
};

const AVAILABILITY_OPTIONS = ['Available', 'Busy', 'Assigned', 'Unavailable'];

const StaffManagement = () => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Staff');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [sortField, setSortField] = useState('Full Name');
  const [sortDirection, setSortDirection] = useState(() => defaultDirectionForField('Full Name'));

  const [selected, setSelected] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const [statusAvailDraft, setStatusAvailDraft] = useState('__default__');
  const [savingId, setSavingId] = useState(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);

  const [addNurseOpen, setAddNurseOpen] = useState(false);
  const [addNurseFullName, setAddNurseFullName] = useState('');
  const [addNurseEmail, setAddNurseEmail] = useState('');
  const [addNursePhone, setAddNursePhone] = useState('');
  const [addNursePassword, setAddNursePassword] = useState('');
  const [addNurseConfirmPassword, setAddNurseConfirmPassword] = useState('');
  const [addNurseSubmitting, setAddNurseSubmitting] = useState(false);
  const [addNurseError, setAddNurseError] = useState('');

  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const roleDropdownRef = useRef(null);
  const statusDropdownRef = useRef(null);
  const sortDropdownRef = useRef(null);

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setFormError('');
    const meta = loadMetaMap();
    try {
      if (!isSupabaseConfigured()) {
        setStaff(mapLocalStaffList());
        setLastRefreshedAt(new Date().toISOString());
        return;
      }
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data || []).filter((r) => {
        const t = String(r.account_type || r.role || '').toLowerCase();
        return t.includes('nurse') || t.includes('staff');
      });
      setStaff(rows.map((r, idx) => mapRowToStaff(r, idx, meta)));
      setLastRefreshedAt(new Date().toISOString());
    } catch (err) {
      console.error(err);
      setFormError(`${err.message || 'Failed to load staff.'} Showing local directory if available.`);
      setStaff(mapLocalStaffList());
      setLastRefreshedAt(new Date().toISOString());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStaff();
    const onRefresh = () => void loadStaff();
    window.addEventListener('storage', onRefresh);
    window.addEventListener(APP_DATA_REFRESH, onRefresh);
    return () => {
      window.removeEventListener('storage', onRefresh);
      window.removeEventListener(APP_DATA_REFRESH, onRefresh);
    };
  }, [loadStaff]);

  useEffect(() => {
    if (!roleDropdownOpen && !statusDropdownOpen && !sortDropdownOpen) return;
    const onDoc = (e) => {
      const t = e.target;
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(t)) setRoleDropdownOpen(false);
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(t)) setStatusDropdownOpen(false);
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(t)) setSortDropdownOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [roleDropdownOpen, statusDropdownOpen, sortDropdownOpen]);

  useEffect(() => {
    setSortDirection(defaultDirectionForField(sortField));
  }, [sortField]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const bySearch = staff.filter((s) => {
      if (!q) return true;
      return (
        String(s.fullName || '').toLowerCase().includes(q) ||
        String(s.email || '').toLowerCase().includes(q) ||
        String(s.staffId || '').toLowerCase().includes(q) ||
        String(s.roleLabel || '').toLowerCase().includes(q) ||
        String(s.department || '').toLowerCase().includes(q)
      );
    });
    const byRole = bySearch.filter((s) => staffMatchesRoleFilter(s.raw, roleFilter));
    const byStatus = byRole.filter((s) => {
      if (statusFilter === 'All statuses') return true;
      if (statusFilter === 'Active') return s.presence === 'Active' && !s.suspended;
      if (statusFilter === 'Inactive') return s.presence === 'Inactive' || s.suspended;
      if (statusFilter === 'Approved') return s.approvalStatus === 'Approved';
      if (statusFilter === 'Unavailable') return s.availability === 'Unavailable' || s.suspended;
      if (statusFilter === 'On Duty') return s.duty === 'On Duty';
      if (statusFilter === 'Off Duty') return s.duty === 'Off Duty';
      if (statusFilter === 'Suspended') return s.suspended;
      return true;
    });
    return sortStaff(byStatus, sortField, sortDirection);
  }, [staff, search, roleFilter, statusFilter, sortField, sortDirection]);

  const summary = useMemo(() => {
    const activeNurses = staff.filter(
      (s) => isNurseAccount(s.roleRaw) && s.presence === 'Active' && !s.suspended,
    ).length;
    const activeClinicStaff = staff.filter(
      (s) => isStaffAccount(s.roleRaw) && !isNurseAccount(s.roleRaw) && s.presence === 'Active' && !s.suspended,
    ).length;
    const available = staff.filter((s) => s.availability === 'Available' && !s.suspended).length;
    const onDuty = staff.filter((s) => s.duty === 'On Duty' && !s.suspended).length;
    const inactive = staff.filter((s) => s.presence === 'Inactive' || s.suspended).length;
    return { activeNurses, activeClinicStaff, available, onDuty, inactive, total: staff.length };
  }, [staff]);

  const saveEdit = async () => {
    if (!editRow) return;
    setSavingId(editRow.id);
    setFormError('');
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: editRow.fullName,
            phone: editRow.phone,
            address: editRow.address,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editRow.id);
        if (error) throw error;
      } else {
        updateLocalStaffRow(editRow.id, {
          full_name: editRow.fullName,
          phone: editRow.phone,
          address: editRow.address,
        });
      }
      persistMetaForId(editRow.id, {
        department: editRow.department,
        branch: editRow.branch,
        shift: editRow.shift,
        employmentType: editRow.employmentType,
        assignedPatientsCount: editRow.assignedPatientsCount,
      });
      refreshAppData();
      await loadStaff();
      setEditRow(null);
    } catch (err) {
      console.error(err);
      setFormError(err.message || 'Failed to save.');
    } finally {
      setSavingId(null);
    }
  };

  const closeAddNurseModal = () => {
    setAddNurseOpen(false);
    setAddNurseFullName('');
    setAddNurseEmail('');
    setAddNursePhone('');
    setAddNursePassword('');
    setAddNurseConfirmPassword('');
    setAddNurseError('');
  };

  const createNurseAccount = async () => {
    setAddNurseError('');
    const fullName = addNurseFullName.trim();
    const email = addNurseEmail.trim();
    const phone = addNursePhone.trim();
    if (!fullName) {
      setAddNurseError('Full name is required.');
      return;
    }
    if (!email) {
      setAddNurseError('Email is required.');
      return;
    }
    const pwErr = getPasswordPolicyError(addNursePassword);
    if (pwErr) {
      setAddNurseError(pwErr);
      return;
    }
    if (addNursePassword !== addNurseConfirmPassword) {
      setAddNurseError('Passwords do not match.');
      return;
    }
    if (!isSupabaseConfigured()) {
      setAddNurseError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return;
    }

    const {
      data: { session: adminSession },
    } = await supabase.auth.getSession();
    if (!adminSession?.access_token || !adminSession?.refresh_token) {
      setAddNurseError('Your session expired. Sign in again.');
      return;
    }

    setAddNurseSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: addNursePassword,
        options: {
          data: {
            account_type: 'nurse',
            full_name: fullName,
            contact_number: phone,
          },
        },
      });
      if (error) {
        setAddNurseError(formatAuthError(error));
        return;
      }
      const newId = data?.user?.id;
      if (!newId) {
        setAddNurseError('Could not create the account. Check Auth settings (e.g. email confirmations).');
        return;
      }
      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          id: newId,
          full_name: fullName,
          phone: phone || null,
          account_type: 'nurse',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );
      if (profileError) {
        setAddNurseError(
          `Auth user was created, but saving the profile failed: ${profileError.message}. Update RLS or the profiles table if needed.`,
        );
        return;
      }
      refreshAppData();
      await loadStaff();
      closeAddNurseModal();
    } catch (err) {
      console.error(err);
      setAddNurseError(err?.message || 'Failed to create nurse account.');
    } finally {
      setAddNurseSubmitting(false);
      try {
        await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        });
      } catch (e) {
        console.warn('[staff-management] Could not restore admin session after creating nurse:', e);
      }
    }
  };

  const applySuspend = (s, suspended) => {
    persistMetaForId(s.id, { suspended });
    void loadStaff();
    setStatusModal(null);
  };

  const applyAvailability = (s, value) => {
    if (value === '__default__') persistMetaForId(s.id, { availability: null });
    else persistMetaForId(s.id, { availability: value });
    void loadStaff();
    setStatusModal(null);
  };

  const pillClass = (kind, val) => {
    if (kind === 'status') {
      if (val === 'Active') return 'um-status-pill um-status-pill--active';
      return 'um-status-pill um-status-pill--inactive';
    }
    if (kind === 'avail') {
      if (val === 'Available') return 'um-status-pill um-status-pill--active';
      if (val === 'Busy' || val === 'Assigned') return 'um-status-pill sm-pill--amber';
      return 'um-status-pill um-status-pill--inactive';
    }
    return 'um-status-pill um-status-pill--inactive';
  };

  return (
    <div className="um-outer" style={{ display: 'flex', minHeight: '100vh', background: '#F8F9FD', fontFamily: "'Inter', sans-serif", color: '#1B2559' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
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
        .um-card { background: white; border: 1px solid #E9EDF7; border-radius: 20px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.02); }
        .um-summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-bottom: 18px; }
        .um-summary-grid--six { grid-template-columns: repeat(6, minmax(0, 1fr)); }
        .um-summary-card { background: white; border: 1px solid #E9EDF7; border-radius: 16px; padding: 20px; }
        .um-summary-label { font-size: 12px; color: #707EAE; font-weight: 600; }
        .um-summary-value { margin-top: 10px; font-size: 28px; font-weight: 800; color: #1B2559; }
        .db-search-input { padding: 10px 12px 10px 36px; border: 1px solid #E9EDF7; border-radius: 12px; font-size: 13px; width: 280px; outline: none; font-family: 'Inter', sans-serif; color: #1B2559; background: white; }
        .db-search-input:focus { border-color: #2563EB; }
        .db-sort-by-wrap { position: relative; }
        .db-sort-by-trigger { display: inline-flex; align-items: center; justify-content: space-between; gap: 10px; min-width: min(100%, 320px); max-width: 100%; padding: 8px 12px; border: 1px solid #0f172a; border-radius: 8px; background: white; font-size: 13px; font-weight: 700; color: #1B2559; cursor: pointer; font-family: 'Inter', sans-serif; }
        .db-sort-by-trigger-prefix { font-weight: 600; color: #1B2559; flex-shrink: 0; }
        .db-sort-by-trigger-value { flex: 1; text-align: left; font-weight: 700; min-width: 0; }
        .db-sort-by-trigger:hover { border-color: #cbd5e1; }
        .db-sort-by-trigger:focus-visible { outline: 2px solid #2563EB; outline-offset: 1px; }
        .db-sort-by-trigger-icon { flex-shrink: 0; color: #1B2559; transition: transform 0.15s ease; }
        .db-sort-by-trigger-icon--open { transform: rotate(180deg); }
        .db-sort-by-trigger--compact { min-width: min(100%, 200px); }
        .db-sort-by-menu { position: absolute; top: calc(100% + 4px); left: 0; min-width: 100%; margin: 0; padding: 4px 0; list-style: none; background: white; border: 1px solid #1B2559; border-radius: 8px; box-shadow: 0 4px 14px rgba(27, 37, 89, 0.12); z-index: 50; max-height: 280px; overflow-y: auto; }
        .db-sort-by-option { display: block; width: 100%; padding: 10px 14px; border: none; background: transparent; text-align: left; font-size: 13px; font-weight: 600; color: #1B2559; cursor: pointer; font-family: 'Inter', sans-serif; }
        .db-sort-by-option:hover:not(.db-sort-by-option--active) { background: #f1f5f9; }
        .db-sort-by-option--active { background: #2563EB; color: white; }
        .db-view-btn, .db-edit-btn, .db-action-btn { border: none; border-radius: 8px; padding: 7px 12px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: 'Inter', sans-serif; display: inline-flex; align-items: center; gap: 6px; }
        .db-view-btn { background: #1B2559; color: white; }
        .db-edit-btn { background: #F54E25; color: white; }
        .db-action-btn { background: #E9EDF7; color: #1B2559; }
        .db-action-btn:disabled { opacity: 0.7; cursor: default; }
        .um-row:hover { background: #F8FAFC; }
        .um-th { position: sticky; top: 0; z-index: 1; }
        .um-status-pill { display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 999px; font-weight: 700; font-size: 12px; }
        .um-status-pill--active { color: #166534; background: #ECFDF3; border: 1px solid #BBF7D0; }
        .um-status-pill--inactive { color: #475569; background: #F1F5F9; border: 1px solid #E2E8F0; }
        .sm-pill--amber { color: #92400e; background: #FFFBEB; border: 1px solid #FDE68A; }
        .um-status-dot { width: 8px; height: 8px; border-radius: 50%; }
        .um-status-dot--active { background: #22c55e; }
        .um-status-dot--inactive { background: #94a3b8; }
        .um-modal-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,0.35); display: flex; align-items: center; justify-content: center; z-index: 1100; }
        .um-modal { width: min(92vw, 760px); max-height: 90vh; overflow-y: auto; background: white; border: 1px solid #E9EDF7; border-radius: 20px; box-shadow: 0 20px 50px rgba(15,23,42,0.25); }
        .um-modal-head { padding: 16px 20px; border-bottom: 1px solid #EEF2FF; display: flex; align-items: center; justify-content: space-between; }
        .um-modal-body { padding: 20px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .um-modal-field { display: flex; flex-direction: column; gap: 6px; }
        .um-modal-label { font-size: 12px; font-weight: 700; color: #707EAE; }
        .um-input { border: 1px solid #E9EDF7; border-radius: 10px; padding: 10px 12px; font-size: 13px; color: #1B2559; outline: none; background: white; }
        .um-input:focus { border-color: #2563EB; }
        .db-mobile-only { display: none; }
        @media (max-width: 1400px) {
          .um-summary-grid--six { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .db-mobile-only { display: flex !important; }
          .um-main { margin-left: 0 !important; width: 100% !important; padding: 20px 12px 100px 12px !important; }
          .um-controls { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
          .um-summary-grid, .um-summary-grid--six { grid-template-columns: 1fr !important; }
          .db-search-input { width: 100% !important; }
          .um-table-wrap { overflow-x: auto; }
          .um-modal-body { grid-template-columns: 1fr; }
          .db-mobile-top-bar { display: flex !important; width: 100%; background: white; z-index: 1001; position: sticky; top: 0; padding: 0 20px; height: 64px; align-items: center; justify-content: space-between; border-bottom: 1px solid #F1F1F1; }
          .db-mobile-bottom-nav { position: fixed; bottom: 0; left: 0; width: 100%; height: 72px; background: white; border-top: 1px solid #F1F1F1; display: flex; justify-content: space-around; align-items: center; z-index: 1000; box-shadow: 0 -4px 20px rgba(0,0,0,0.06); }
          .mob-nav-item { display: flex; flex-direction: column; align-items: center; font-size: 10px; color: #A3AED0; cursor: pointer; }
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
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-discharge-management'); }}>
            <div className="icon-box inactive"><ArrowRightSquare size={22} /></div>
            <span className="sidebar-label">Discharge Management</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/admin-user-management'); }}>
            <div className="icon-box inactive"><Users size={22} /></div>
            <span className="sidebar-label">User Management</span>
          </div>
          <div className="sidebar-nav-item" onClick={(e) => e.stopPropagation()}>
            <div className="icon-box active"><Stethoscope size={22} /></div>
            <span className="sidebar-label" style={{ color: '#F54E25' }}>Staff Management</span>
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
        <span style={{ fontSize: 16, fontWeight: 800, color: '#F54E25' }}>Staff</span>
        <div style={{ width: 36, height: 36, background: '#F54E25', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>AD</div>
      </div>

      <main className="um-main">
        <div style={{ width: '100%', minWidth: 0 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#000' }}>Staff / Nurse Management</h1>
          <p style={{ fontSize: 13, color: '#707EAE', marginTop: 8, marginBottom: 22, fontWeight: 500 }}>
            Monitor nurses and clinic staff—availability, duty status, and assignments in one place.
          </p>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: -10, marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
              Active means seen within the last 15 minutes. Department, branch, and shift use local admin notes when columns are missing in the database.
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="db-edit-btn"
                onClick={() => {
                  setAddNurseError('');
                  setAddNurseOpen(true);
                }}
                disabled={!isSupabaseConfigured() || loading}
                title={!isSupabaseConfigured() ? 'Configure Supabase in .env first' : 'Create a nurse login in Auth and profiles'}
              >
                <UserPlus size={14} /> Add nurse account
              </button>
              <button type="button" className="db-action-btn" onClick={() => void loadStaff()} disabled={loading}>
                <RefreshCw size={13} /> {loading ? 'Refreshing...' : `Refresh (${safeDateTimeText(lastRefreshedAt)})`}
              </button>
            </div>
          </div>

          <div className="um-summary-grid um-summary-grid--six">
            <div className="um-summary-card">
              <div className="um-summary-label">Active Nurses</div>
              <div className="um-summary-value">{summary.activeNurses}</div>
            </div>
            <div className="um-summary-card">
              <div className="um-summary-label">Active Clinic Staff</div>
              <div className="um-summary-value">{summary.activeClinicStaff}</div>
            </div>
            <div className="um-summary-card">
              <div className="um-summary-label">Available</div>
              <div className="um-summary-value">{summary.available}</div>
            </div>
            <div className="um-summary-card">
              <div className="um-summary-label">On Duty</div>
              <div className="um-summary-value">{summary.onDuty}</div>
            </div>
            <div className="um-summary-card">
              <div className="um-summary-label">Inactive / Suspended</div>
              <div className="um-summary-value">{summary.inactive}</div>
            </div>
            <div className="um-summary-card">
              <div className="um-summary-label">Total Personnel</div>
              <div className="um-summary-value">{summary.total}</div>
            </div>
          </div>

          <div className="um-card">
            <div className="um-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#A3AED0' }} />
                  <input
                    className="db-search-input"
                    type="text"
                    placeholder="Search name, email, staff ID, role, department..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="db-sort-by-wrap" ref={roleDropdownRef}>
                  <button
                    type="button"
                    className="db-sort-by-trigger db-sort-by-trigger--compact"
                    onClick={() => {
                      setStatusDropdownOpen(false);
                      setSortDropdownOpen(false);
                      setRoleDropdownOpen((o) => !o);
                    }}
                    aria-expanded={roleDropdownOpen}
                  >
                    <Filter size={16} color="#A3AED0" style={{ flexShrink: 0 }} aria-hidden />
                    <span className="db-sort-by-trigger-prefix">Role:</span>
                    <span className="db-sort-by-trigger-value">{roleFilter}</span>
                    <ChevronDown size={16} className={`db-sort-by-trigger-icon${roleDropdownOpen ? ' db-sort-by-trigger-icon--open' : ''}`} />
                  </button>
                  {roleDropdownOpen && (
                    <ul className="db-sort-by-menu" role="listbox">
                      {ROLE_FILTER_OPTIONS.map((opt) => (
                        <li key={opt} role="none">
                          <button
                            type="button"
                            className={`db-sort-by-option${roleFilter === opt ? ' db-sort-by-option--active' : ''}`}
                            onClick={() => {
                              setRoleFilter(opt);
                              setRoleDropdownOpen(false);
                            }}
                          >
                            {opt}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="db-sort-by-wrap" ref={statusDropdownRef}>
                  <button
                    type="button"
                    className="db-sort-by-trigger db-sort-by-trigger--compact"
                    onClick={() => {
                      setRoleDropdownOpen(false);
                      setSortDropdownOpen(false);
                      setStatusDropdownOpen((o) => !o);
                    }}
                    aria-expanded={statusDropdownOpen}
                  >
                    <span className="db-sort-by-trigger-prefix">Status:</span>
                    <span className="db-sort-by-trigger-value">{statusFilter}</span>
                    <ChevronDown size={16} className={`db-sort-by-trigger-icon${statusDropdownOpen ? ' db-sort-by-trigger-icon--open' : ''}`} />
                  </button>
                  {statusDropdownOpen && (
                    <ul className="db-sort-by-menu" role="listbox">
                      {STATUS_FILTER_OPTIONS.map((opt) => (
                        <li key={opt} role="none">
                          <button
                            type="button"
                            className={`db-sort-by-option${statusFilter === opt ? ' db-sort-by-option--active' : ''}`}
                            onClick={() => {
                              setStatusFilter(opt);
                              setStatusDropdownOpen(false);
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
                      setRoleDropdownOpen(false);
                      setStatusDropdownOpen(false);
                      setSortDropdownOpen((o) => !o);
                    }}
                    aria-expanded={sortDropdownOpen}
                  >
                    <span className="db-sort-by-trigger-prefix">Sort by:</span>
                    <span className="db-sort-by-trigger-value">{sortField}</span>
                    <ChevronDown size={16} className={`db-sort-by-trigger-icon${sortDropdownOpen ? ' db-sort-by-trigger-icon--open' : ''}`} />
                  </button>
                  {sortDropdownOpen && (
                    <ul className="db-sort-by-menu" role="listbox">
                      {SORT_OPTIONS.map((opt) => (
                        <li key={opt} role="none">
                          <button
                            type="button"
                            className={`db-sort-by-option${sortField === opt ? ' db-sort-by-option--active' : ''}`}
                            onClick={() => {
                              setSortField(opt);
                              setSortDropdownOpen(false);
                            }}
                          >
                            {opt}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  type="button"
                  className="db-action-btn"
                  title="Toggle sort order"
                  onClick={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
                >
                  <ArrowUpDown size={14} /> {sortDirection === 'asc' ? 'A→Z / Oldest first' : 'Z→A / Newest first'}
                </button>
              </div>
            </div>

            {formError && (
              <div style={{ marginBottom: 10, color: '#b91c1c', fontWeight: 600, fontSize: 13 }}>{formError}</div>
            )}

            <div className="um-table-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#323D4E', color: 'white' }}>
                    {['Staff ID', 'Full Name', 'Role', 'Department', 'Contact', 'Branch', 'Shift', 'Status', 'Availability', 'Actions'].map((col, idx) => (
                      <th className="um-th" key={col} style={{ padding: '12px 14px', borderRight: idx < 9 ? '1px solid #4B5563' : 'none', whiteSpace: 'nowrap', fontWeight: 500 }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={10} style={{ padding: 18, color: '#64748b' }}>Loading staff...</td>
                    </tr>
                  )}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ padding: 18, color: '#64748b' }}>
                        No staff match your search or filters. Profiles need account type nurse or staff in Supabase, or add demo rows to localStorage key {LOCAL_STAFF_KEY}.
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    filtered.map((s) => (
                      <tr key={s.id} className="um-row" style={{ borderBottom: '1px solid #F4F7FE' }}>
                        <td style={{ padding: '14px', color: '#1B2559', fontWeight: 700 }}>{s.staffId}</td>
                        <td style={{ padding: '14px', color: '#1B2559', fontWeight: 600 }}>{s.fullName}</td>
                        <td style={{ padding: '14px', color: '#1B2559' }}>{s.roleLabel}</td>
                        <td style={{ padding: '14px', color: '#707EAE' }}>{s.department}</td>
                        <td style={{ padding: '14px', color: '#707EAE' }}>{s.phone}</td>
                        <td style={{ padding: '14px', color: '#707EAE' }}>{s.branch}</td>
                        <td style={{ padding: '14px', color: '#707EAE' }}>{s.shift}</td>
                        <td style={{ padding: '14px', minWidth: 120 }}>
                          <span className={`um-status-pill ${s.status === 'Active' && !s.suspended ? 'um-status-pill--active' : 'um-status-pill--inactive'}`}>
                            <span className={`um-status-dot ${s.status === 'Active' && !s.suspended ? 'um-status-dot--active' : 'um-status-dot--inactive'}`} />
                            {s.suspended ? 'Suspended' : s.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px', minWidth: 130 }}>
                          <span className={pillClass('avail', s.availability)}>{s.availability}</span>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{s.duty}</div>
                        </td>
                        <td style={{ padding: '14px' }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <button type="button" className="db-view-btn" onClick={() => setSelected(s)}>
                              <Eye size={13} /> View
                            </button>
                            <button type="button" className="db-edit-btn" onClick={() => setEditRow({ ...s })}>
                              <Edit2 size={13} /> Edit
                            </button>
                            <button
                              type="button"
                              className="db-action-btn"
                              onClick={() => {
                                const m = loadMetaMap()[s.id];
                                setStatusAvailDraft(m?.availability != null ? m.availability : '__default__');
                                setStatusModal(s);
                              }}
                            >
                              Status
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
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
            <HeartPulse size={20} color="#A3AED0" />
          </div>
          <span>Patients</span>
        </div>
        <div className="mob-nav-item" onClick={() => navigate('/admin-user-management')}>
          <div style={{ padding: 10, borderRadius: 10, display: 'flex' }}>
            <Users size={20} color="#A3AED0" />
          </div>
          <span>Users</span>
        </div>
        <div className="mob-nav-item active">
          <div style={{ background: '#F54E25', padding: 10, borderRadius: 10, display: 'flex' }}>
            <Stethoscope size={20} color="white" />
          </div>
          <span style={{ color: '#F54E25' }}>Staff</span>
        </div>
      </div>

      {selected && (
        <div className="um-modal-backdrop" onClick={() => setSelected(null)} role="presentation">
          <div className="um-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="staff-detail-title">
            <div className="um-modal-head">
              <div id="staff-detail-title" style={{ fontSize: 18, fontWeight: 800, color: '#1B2559' }}>Staff Details</div>
              <button type="button" className="db-action-btn" onClick={() => setSelected(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="um-modal-body">
              <div className="um-modal-field"><span className="um-modal-label">Staff ID</span><div className="um-input">{selected.staffId}</div></div>
              <div className="um-modal-field"><span className="um-modal-label">Full Name</span><div className="um-input">{selected.fullName}</div></div>
              <div className="um-modal-field"><span className="um-modal-label">Role</span><div className="um-input">{selected.roleLabel}</div></div>
              <div className="um-modal-field"><span className="um-modal-label">Department</span><div className="um-input">{selected.department}</div></div>
              <div className="um-modal-field"><span className="um-modal-label">Email</span><div className="um-input">{selected.email}</div></div>
              <div className="um-modal-field"><span className="um-modal-label">Phone</span><div className="um-input">{selected.phone}</div></div>
              <div className="um-modal-field"><span className="um-modal-label">Address</span><div className="um-input">{selected.address}</div></div>
              <div className="um-modal-field"><span className="um-modal-label">Branch / Unit</span><div className="um-input">{selected.branch}</div></div>
              <div className="um-modal-field"><span className="um-modal-label">Shift / Schedule</span><div className="um-input">{selected.shift}</div></div>
              <div className="um-modal-field"><span className="um-modal-label">Employment</span><div className="um-input">{selected.employmentType}</div></div>
              <div className="um-modal-field"><span className="um-modal-label">Current Status</span><div className="um-input">{selected.suspended ? 'Suspended' : selected.status}</div></div>
              <div className="um-modal-field"><span className="um-modal-label">Availability</span><div className="um-input">{selected.availability}</div></div>
              <div className="um-modal-field"><span className="um-modal-label">Duty</span><div className="um-input">{selected.duty}</div></div>
              <div className="um-modal-field"><span className="um-modal-label">Approval</span><div className="um-input">{selected.approvalStatus}</div></div>
              <div className="um-modal-field"><span className="um-modal-label">Assigned Patients (manual)</span><div className="um-input">{selected.assignedPatientsCount}</div></div>
              <div className="um-modal-field"><span className="um-modal-label">Registered</span><div className="um-input">{safeDateText(selected.registeredAt)}</div></div>
              <div className="um-modal-field"><span className="um-modal-label">Last Active</span><div className="um-input">{safeDateTimeText(selected.lastActiveAt)}</div></div>
            </div>
          </div>
        </div>
      )}

      {addNurseOpen && (
        <div className="um-modal-backdrop" onClick={() => !addNurseSubmitting && closeAddNurseModal()} role="presentation">
          <div className="um-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="add-nurse-title">
            <div className="um-modal-head">
              <div id="add-nurse-title" style={{ fontSize: 18, fontWeight: 800, color: '#1B2559' }}>Add nurse account</div>
              <button type="button" className="db-action-btn" disabled={addNurseSubmitting} onClick={() => closeAddNurseModal()}>
                <X size={16} />
              </button>
            </div>
            <div className="um-modal-body">
              <p style={{ gridColumn: '1 / -1', fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
                Creates a Supabase Auth user and a <code style={{ fontSize: 12 }}>profiles</code> row with{' '}
                <code style={{ fontSize: 12 }}>account_type: nurse</code>. The nurse can sign in with this email and password.
                If your project requires email confirmation, they must verify before logging in.
              </p>
              <label className="um-modal-field">
                <span className="um-modal-label">Full name</span>
                <input
                  className="um-input"
                  autoComplete="name"
                  value={addNurseFullName}
                  onChange={(e) => setAddNurseFullName(e.target.value)}
                  disabled={addNurseSubmitting}
                />
              </label>
              <label className="um-modal-field">
                <span className="um-modal-label">Email</span>
                <input
                  className="um-input"
                  type="email"
                  autoComplete="off"
                  value={addNurseEmail}
                  onChange={(e) => setAddNurseEmail(e.target.value)}
                  disabled={addNurseSubmitting}
                />
              </label>
              <label className="um-modal-field">
                <span className="um-modal-label">Phone (optional)</span>
                <input
                  className="um-input"
                  type="tel"
                  autoComplete="tel"
                  value={addNursePhone}
                  onChange={(e) => setAddNursePhone(e.target.value)}
                  disabled={addNurseSubmitting}
                />
              </label>
              <label className="um-modal-field">
                <span className="um-modal-label">Password</span>
                <input
                  className="um-input"
                  type="password"
                  autoComplete="new-password"
                  value={addNursePassword}
                  onChange={(e) => setAddNursePassword(e.target.value)}
                  disabled={addNurseSubmitting}
                />
              </label>
              <label className="um-modal-field">
                <span className="um-modal-label">Confirm password</span>
                <input
                  className="um-input"
                  type="password"
                  autoComplete="new-password"
                  value={addNurseConfirmPassword}
                  onChange={(e) => setAddNurseConfirmPassword(e.target.value)}
                  disabled={addNurseSubmitting}
                />
              </label>
              {addNurseError && (
                <div style={{ gridColumn: '1 / -1', color: '#b91c1c', fontWeight: 600, fontSize: 13 }}>{addNurseError}</div>
              )}
            </div>
            <div style={{ padding: 20, borderTop: '1px solid #EEF2FF', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="db-action-btn" disabled={addNurseSubmitting} onClick={() => closeAddNurseModal()}>
                Cancel
              </button>
              <button type="button" className="db-edit-btn" disabled={addNurseSubmitting} onClick={() => void createNurseAccount()}>
                {addNurseSubmitting ? 'Creating…' : 'Create account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editRow && (
        <div className="um-modal-backdrop" onClick={() => setEditRow(null)} role="presentation">
          <div className="um-modal" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="um-modal-head">
              <div style={{ fontSize: 18, fontWeight: 800, color: '#1B2559' }}>Edit Staff</div>
              <button type="button" className="db-action-btn" onClick={() => setEditRow(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="um-modal-body">
              <label className="um-modal-field">
                <span className="um-modal-label">Full Name</span>
                <input className="um-input" value={editRow.fullName} onChange={(e) => setEditRow((p) => ({ ...p, fullName: e.target.value }))} />
              </label>
              <label className="um-modal-field">
                <span className="um-modal-label">Phone</span>
                <input className="um-input" value={editRow.phone} onChange={(e) => setEditRow((p) => ({ ...p, phone: e.target.value }))} />
              </label>
              <label className="um-modal-field">
                <span className="um-modal-label">Address</span>
                <input className="um-input" value={editRow.address} onChange={(e) => setEditRow((p) => ({ ...p, address: e.target.value }))} />
              </label>
              <label className="um-modal-field">
                <span className="um-modal-label">Department</span>
                <input className="um-input" value={editRow.department} onChange={(e) => setEditRow((p) => ({ ...p, department: e.target.value }))} />
              </label>
              <label className="um-modal-field">
                <span className="um-modal-label">Branch</span>
                <input className="um-input" value={editRow.branch} onChange={(e) => setEditRow((p) => ({ ...p, branch: e.target.value }))} />
              </label>
              <label className="um-modal-field">
                <span className="um-modal-label">Shift</span>
                <input className="um-input" value={editRow.shift} onChange={(e) => setEditRow((p) => ({ ...p, shift: e.target.value }))} />
              </label>
              <label className="um-modal-field">
                <span className="um-modal-label">Employment Type</span>
                <input className="um-input" value={editRow.employmentType} onChange={(e) => setEditRow((p) => ({ ...p, employmentType: e.target.value }))} />
              </label>
              <label className="um-modal-field">
                <span className="um-modal-label">Assigned patients count (manual)</span>
                <input
                  className="um-input"
                  type="number"
                  min={0}
                  value={editRow.assignedPatientsCount}
                  onChange={(e) => setEditRow((p) => ({ ...p, assignedPatientsCount: Number(e.target.value) || 0 }))}
                />
              </label>
            </div>
            <div style={{ padding: 20, borderTop: '1px solid #EEF2FF', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="db-action-btn" onClick={() => setEditRow(null)}>Cancel</button>
              <button type="button" className="db-edit-btn" disabled={savingId === editRow.id} onClick={() => void saveEdit()}>
                {savingId === editRow.id ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {statusModal && (
        <div className="um-modal-backdrop" onClick={() => setStatusModal(null)} role="presentation">
          <div className="um-modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(92vw, 460px)' }}>
            <div className="um-modal-head">
              <div style={{ fontSize: 18, fontWeight: 800, color: '#1B2559' }}>Update status &amp; availability</div>
              <button type="button" className="db-action-btn" onClick={() => setStatusModal(null)}><X size={16} /></button>
            </div>
            <div className="um-modal-body" style={{ gridTemplateColumns: '1fr' }}>
              <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.5 }}>
                Suspending stores a local admin flag. Availability overrides default rules (active staff → Available unless suspended).
              </p>
              <label className="um-modal-field" style={{ marginBottom: 4 }}>
                <span className="um-modal-label">Availability override</span>
                <select
                  className="um-input"
                  value={statusAvailDraft}
                  onChange={(e) => setStatusAvailDraft(e.target.value)}
                >
                  <option value="__default__">Auto (from presence)</option>
                  {AVAILABILITY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="db-view-btn"
                style={{ justifySelf: 'start' }}
                onClick={() => applyAvailability(statusModal, statusAvailDraft)}
              >
                Save availability
              </button>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {!statusModal.suspended ? (
                  <button type="button" className="db-edit-btn" onClick={() => applySuspend(statusModal, true)}>Suspend access</button>
                ) : (
                  <button type="button" className="db-view-btn" onClick={() => applySuspend(statusModal, false)}>Restore</button>
                )}
                <button type="button" className="db-action-btn" onClick={() => setStatusModal(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;
