import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  LayoutGrid,
  BarChart2,
  HeartPulse,
  Users,
  LogOut,
  Search,
  Filter,
  Eye,
  Edit2,
  RotateCcw,
  RefreshCw,
  X,
  ClipboardList,
  ArrowRightSquare,
  ChevronDown,
  Stethoscope,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logoBH from '@/assets/logo2.png';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { APP_DATA_REFRESH, refreshAppData } from '@/lib/appDataRefresh';

const USER_STATUS_OPTIONS = ['Active', 'Inactive'];
const FILTER_STATUS_OPTIONS = ['All Users', ...USER_STATUS_OPTIONS];
const SORT_FIELD_OPTIONS = ['User ID', 'Name', 'Registered Date', 'Status', 'Last Active'];
const ACTIVE_WINDOW_MS = 15 * 60 * 1000;
const RESET_PASSWORD_REDIRECT_PATH = '/newpass';
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

const buildAddressFromRow = (row) => {
  const direct = row.address || row.location || row.city;
  if (direct) return direct;
  const composed = [row.house_block_lot, row.street, row.municipality, row.province]
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .join(', ');
  return composed || 'N/A';
};

const toUiUser = (row, idx = 0) => {
  const uid = row.id || row.user_id || row.uid || `USR-${String(idx + 1).padStart(4, '0')}`;
  const fullName = row.full_name || row.name || row.display_name || 'Unknown User';
  const email = row.email || row.guardian_email || 'N/A';
  const phone = row.phone || row.contact_number || row.mobile || row.guardian_phone || 'N/A';
  const address = buildAddressFromRow(row);
  const registeredAt = row.created_at || row.registered_at || row.registered_date || null;
  const lastActiveAt =
    row.last_active_at ||
    row.last_login_at ||
    row.last_sign_in_at ||
    row.updated_at ||
    row.created_at ||
    null;
  const status = getPresenceStatus(lastActiveAt);
  const role = row.role || row.account_type || 'Customer';
  const source = row.source || 'web';
  return {
    id: uid,
    fullName,
    email,
    phone,
    address,
    status,
    registeredAt,
    lastActiveAt,
    role,
    source,
  };
};

const parseJsonArray = (raw) => {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const mapLocalUsers = () => {
  const merged = [
    ...parseJsonArray(localStorage.getItem('bh_users')),
    ...parseJsonArray(localStorage.getItem('bh_web_users')),
    ...parseJsonArray(localStorage.getItem('bh_mobile_users')),
  ];
  return merged.map((r, idx) => toUiUser(r, idx));
};

const sortUsers = (rows, field, direction) => {
  const cp = [...rows];
  const asc = direction === 'asc';
  cp.sort((a, b) => {
    let r = 0;
    if (field === 'Name') {
      r = a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' });
    } else if (field === 'Registered Date') {
      r = asTimestamp(a.registeredAt) - asTimestamp(b.registeredAt);
    } else if (field === 'Status') {
      r = a.status.localeCompare(b.status, undefined, { sensitivity: 'base' });
    } else if (field === 'Last Active') {
      r = asTimestamp(a.lastActiveAt) - asTimestamp(b.lastActiveAt);
    } else {
      r = String(a.id).localeCompare(String(b.id), undefined, { sensitivity: 'base' });
    }
    return asc ? r : -r;
  });
  return cp;
};

const UserManagement = () => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Users');
  const [sortField, setSortField] = useState('Registered Date');

  const [selectedUser, setSelectedUser] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [presenceTick, setPresenceTick] = useState(Date.now());

  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const filterDropdownRef = useRef(null);
  const sortDropdownRef = useRef(null);

  const loadUsers = async () => {
    setLoading(true);
    setFormError('');
    try {
      if (!isSupabaseConfigured()) {
        setUsers(mapLocalUsers());
        setLastRefreshedAt(new Date().toISOString());
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Fallback source for email/phone historically saved via admissions.
      const { data: admissionRows } = await supabase
        .from('admission_requests')
        .select('family_id, guardian_email, guardian_phone, created_at')
        .order('created_at', { ascending: false });

      // Presence fallback source from event timeline.
      const { data: activityRows } = await supabase
        .from('activity_log')
        .select('actor_id, family_id, created_at')
        .order('created_at', { ascending: false });

      const admissionByFamilyId = new Map();
      (admissionRows || []).forEach((r) => {
        const key = r.family_id;
        if (!key || admissionByFamilyId.has(key)) return;
        admissionByFamilyId.set(key, r);
      });

      const latestActivityByUserId = new Map();
      (activityRows || []).forEach((r) => {
        const keys = [r.family_id, r.actor_id].filter(Boolean);
        keys.forEach((key) => {
          if (!latestActivityByUserId.has(key)) {
            latestActivityByUserId.set(key, r.created_at);
          }
        });
      });

      const rows = (data || [])
        .filter((r) => {
          const accountType = String(r.account_type || r.role || '').toLowerCase();
          return accountType !== 'admin' && accountType !== 'nurse' && accountType !== 'staff';
        })
        .map((r) => {
          const fallback = admissionByFamilyId.get(r.id);
          const activityAt = latestActivityByUserId.get(r.id);
          return fallback
            ? {
                ...r,
                guardian_email: fallback.guardian_email,
                guardian_phone: fallback.guardian_phone,
                last_active_at: r.last_active_at || r.last_login_at || activityAt || null,
              }
            : {
                ...r,
                last_active_at: r.last_active_at || r.last_login_at || activityAt || null,
              };
        });

      setUsers(rows.map((r, idx) => toUiUser(r, idx)));
      setLastRefreshedAt(new Date().toISOString());
    } catch (err) {
      console.error(err);
      setFormError(`${err.message || 'Failed to load users.'} Showing local records if available.`);
      setUsers(mapLocalUsers());
      setLastRefreshedAt(new Date().toISOString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
    const onRefresh = () => void loadUsers();
    window.addEventListener('storage', onRefresh);
    window.addEventListener(APP_DATA_REFRESH, onRefresh);
    return () => {
      window.removeEventListener('storage', onRefresh);
      window.removeEventListener(APP_DATA_REFRESH, onRefresh);
    };
  }, []);

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

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setPresenceTick(Date.now());
    }, 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const usersWithLiveStatus = useMemo(() => {
    return users.map((u) => ({
      ...u,
      status: getPresenceStatus(u.lastActiveAt),
    }));
  }, [users, presenceTick]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const bySearch = usersWithLiveStatus.filter((u) => {
      if (!q) return true;
      return (
        String(u.fullName || '').toLowerCase().includes(q) ||
        String(u.email || '').toLowerCase().includes(q) ||
        String(u.id || '').toLowerCase().includes(q) ||
        String(u.phone || '').toLowerCase().includes(q)
      );
    });
    const byFilter = bySearch.filter((u) => statusFilter === 'All Users' || u.status === statusFilter);
    return sortUsers(byFilter, sortField, defaultDirectionForField(sortField));
  }, [usersWithLiveStatus, search, statusFilter, sortField]);

  const summary = useMemo(() => {
    const total = usersWithLiveStatus.length;
    const active = usersWithLiveStatus.filter((u) => u.status === 'Active').length;
    const inactive = usersWithLiveStatus.filter((u) => u.status === 'Inactive').length;
    return { total, active, inactive };
  }, [usersWithLiveStatus]);

  const resetPassword = async () => {
    if (!selectedUser?.email || selectedUser.email === 'N/A') {
      setFormError('Select a user with a valid email before sending a reset link.');
      return;
    }
    if (!isSupabaseConfigured()) {
      setFormError('Supabase is not configured. Cannot send reset links.');
      return;
    }
    setFormError('');
    try {
      const email = String(selectedUser.email).trim().toLowerCase();
      const redirectTo = `${window.location.origin}${RESET_PASSWORD_REDIRECT_PATH}`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      setFormError(`Password reset link sent to ${email}.`);
    } catch (err) {
      console.error(err);
      setFormError(err.message || 'Could not send password reset link.');
    }
  };

  const saveEdit = async () => {
    if (!editUser) return;
    const original = users.find((u) => u.id === editUser.id);
    setSavingId(editUser.id);
    setUsers((prev) => prev.map((u) => (u.id === editUser.id ? { ...editUser } : u)));
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: editUser.fullName,
            phone: editUser.phone,
            // Keep schema-safe updates only; profile does not store raw "address"/"role" columns.
            street: editUser.address,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editUser.id);
        if (error) throw error;
        refreshAppData();
      }
      setEditUser(null);
    } catch (err) {
      console.error(err);
      setFormError(err.message || 'Failed to save user info.');
      if (original) {
        setUsers((prev) => prev.map((u) => (u.id === original.id ? original : u)));
      }
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="um-outer" style={{ display: 'flex', minHeight: '100vh', background: '#F8F9FD', fontFamily: "'Inter', sans-serif", color: '#1B2559' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .um-outer { width: 100vw; overflow-x: hidden; }
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
        .um-main { flex: 1; min-height: 100vh; margin-left: ${isExpanded ? '280px' : '110px'}; transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1); padding: 40px; }
        .um-card { background: white; border: 1px solid #E9EDF7; border-radius: 20px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.02); }
        .um-summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-bottom: 18px; }
        .um-summary-card { background: white; border: 1px solid #E9EDF7; border-radius: 16px; padding: 20px; }
        .um-summary-label { font-size: 12px; color: #707EAE; font-weight: 600; }
        .um-summary-value { margin-top: 10px; font-size: 28px; font-weight: 800; color: #1B2559; }
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
        .db-sort-by-trigger--compact { min-width: min(100%, 200px); }
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
        .db-view-btn, .db-edit-btn, .db-action-btn { border: none; border-radius: 8px; padding: 7px 12px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: 'Inter', sans-serif; display: inline-flex; align-items: center; gap: 6px; }
        .db-view-btn { background: #1B2559; color: white; }
        .db-edit-btn { background: #F54E25; color: white; }
        .db-action-btn { background: #E9EDF7; color: #1B2559; }
        .db-action-btn:disabled { opacity: 0.7; cursor: default; }
        .um-row:hover { background: #F8FAFC; }
        .um-th { position: sticky; top: 0; z-index: 1; }
        .um-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 999px;
          font-weight: 700;
          font-size: 12px;
        }
        .um-status-pill--active { color: #166534; background: #ECFDF3; border: 1px solid #BBF7D0; }
        .um-status-pill--inactive { color: #475569; background: #F1F5F9; border: 1px solid #E2E8F0; }
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
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .db-mobile-only { display: flex !important; }
          .um-main { margin-left: 0 !important; width: 100vw !important; padding: 20px 12px 100px 12px !important; }
          .um-controls { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
          .um-summary-grid { grid-template-columns: 1fr !important; }
          .db-search-input { width: 100% !important; }
          .um-table-wrap { overflow-x: auto; }
          .um-modal-body { grid-template-columns: 1fr; }
          .db-mobile-top-bar { display: flex !important; width: 100vw; background: white; z-index: 1001; position: sticky; top: 0; padding: 0 20px; height: 64px; align-items: center; justify-content: space-between; border-bottom: 1px solid #F1F1F1; }
          .db-mobile-bottom-nav { position: fixed; bottom: 0; left: 0; width: 100vw; height: 72px; background: white; border-top: 1px solid #F1F1F1; display: flex; justify-content: space-around; align-items: center; z-index: 1000; box-shadow: 0 -4px 20px rgba(0,0,0,0.06); }
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
          <div className="sidebar-nav-item" onClick={(e) => { e.stopPropagation(); navigate('/analytics'); }}>
            <div className="icon-box inactive"><BarChart2 size={22} /></div>
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
          <div className="sidebar-nav-item" onClick={(e) => e.stopPropagation()}>
            <div className="icon-box active"><Users size={22} /></div>
            <span className="sidebar-label" style={{ color: '#F54E25' }}>User Management</span>
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
        <span style={{ fontSize: 16, fontWeight: 800, color: '#F54E25' }}>Users</span>
        <div style={{ width: 36, height: 36, background: '#F54E25', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>AD</div>
      </div>

      <main className="um-main">
        <div style={{ width: '100%' }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#000' }}>Customer / User Management</h1>
          <p style={{ fontSize: 13, color: '#707EAE', marginTop: 8, marginBottom: 22, fontWeight: 500 }}>
            View and manage user accounts from web and mobile in one admin panel.
          </p>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: -10, marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
              Active means user was seen within the last 15 minutes; otherwise Inactive.
            </span>
            <button className="db-action-btn" onClick={() => void loadUsers()} disabled={loading}>
              <RefreshCw size={13} /> {loading ? 'Refreshing...' : `Refresh (${safeDateTimeText(lastRefreshedAt)})`}
            </button>
          </div>

          <div className="um-summary-grid">
            <div className="um-summary-card">
              <div className="um-summary-label">Total Users</div>
              <div className="um-summary-value">{summary.total}</div>
            </div>
            <div className="um-summary-card">
              <div className="um-summary-label">Active Users</div>
              <div className="um-summary-value">{summary.active}</div>
            </div>
            <div className="um-summary-card">
              <div className="um-summary-label">Inactive</div>
              <div className="um-summary-value">{summary.inactive}</div>
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
                    placeholder="Search name, email, user ID, phone..."
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
                    aria-label="Status filter"
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
                    <ul className="db-sort-by-menu" role="listbox" aria-label="Status">
                      {FILTER_STATUS_OPTIONS.map((opt) => (
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
                    <span className="db-sort-by-trigger-value">{sortField}</span>
                    <ChevronDown
                      size={16}
                      className={`db-sort-by-trigger-icon${sortDropdownOpen ? ' db-sort-by-trigger-icon--open' : ''}`}
                      aria-hidden
                    />
                  </button>
                  {sortDropdownOpen && (
                    <ul className="db-sort-by-menu" role="listbox" aria-label="Sort options">
                      {SORT_FIELD_OPTIONS.map((opt) => (
                        <li key={opt} role="none">
                          <button
                            type="button"
                            role="option"
                            aria-selected={sortField === opt}
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
              </div>
            </div>

            {formError && (
              <div style={{ marginBottom: 10, color: '#b91c1c', fontWeight: 600, fontSize: 13 }}>{formError}</div>
            )}

            <div className="um-table-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#323D4E', color: 'white' }}>
                    {['User ID', 'Full Name', 'Email Address', 'Phone Number', 'Location / Address', 'Status', 'Registered Date', 'Last Active', 'Actions'].map((col, idx) => (
                      <th className="um-th" key={col} style={{ padding: '12px 14px', borderRight: idx < 8 ? '1px solid #4B5563' : 'none', whiteSpace: 'nowrap', fontWeight: 500 }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={9} style={{ padding: 18, color: '#64748b' }}>Loading users...</td></tr>}
                  {!loading && filtered.length === 0 && <tr><td colSpan={9} style={{ padding: 18, color: '#64748b' }}>No users match your search/filter.</td></tr>}
                  {!loading && filtered.map((u) => (
                    <tr key={u.id} className="um-row" style={{ borderBottom: '1px solid #F4F7FE' }}>
                      <td style={{ padding: '14px', color: '#1B2559', fontWeight: 700 }}>{u.id}</td>
                      <td style={{ padding: '14px', color: '#1B2559', fontWeight: 600 }}>{u.fullName}</td>
                      <td style={{ padding: '14px', color: '#1B2559' }}>{u.email}</td>
                      <td style={{ padding: '14px', color: '#707EAE' }}>{u.phone}</td>
                      <td style={{ padding: '14px', color: '#707EAE' }}>{u.address}</td>
                      <td style={{ padding: '14px', minWidth: 170 }}>
                        <span className={`um-status-pill ${u.status === 'Active' ? 'um-status-pill--active' : 'um-status-pill--inactive'}`}>
                          <span className={`um-status-dot ${u.status === 'Active' ? 'um-status-dot--active' : 'um-status-dot--inactive'}`} />
                          {u.status}
                        </span>
                      </td>
                      <td style={{ padding: '14px', color: '#1B2559' }}>{safeDateText(u.registeredAt)}</td>
                      <td style={{ padding: '14px', color: '#1B2559' }}>{safeDateTimeText(u.lastActiveAt)}</td>
                      <td style={{ padding: '14px' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <button className="db-view-btn" onClick={() => setSelectedUser(u)}><Eye size={13} /> View</button>
                          <button className="db-edit-btn" onClick={() => setEditUser({ ...u })}><Edit2 size={13} /> Edit</button>
                          <button className="db-action-btn" onClick={() => void resetPassword()}><RotateCcw size={13} /> Reset</button>
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
        <div className="mob-nav-item active">
          <div style={{ background: '#F54E25', padding: 10, borderRadius: 10, display: 'flex' }}>
            <Users size={20} color="white" />
          </div>
          <span style={{ color: '#F54E25' }}>Users</span>
        </div>
        <div className="mob-nav-item" onClick={() => navigate('/admin-staff-management')}>
          <div style={{ padding: 10, borderRadius: 10, display: 'flex' }}>
            <Stethoscope size={20} color="#A3AED0" />
          </div>
          <span>Staff</span>
        </div>
      </div>

      {selectedUser && (
        <div className="um-modal-backdrop" onClick={() => setSelectedUser(null)}>
          <div className="um-modal" onClick={(e) => e.stopPropagation()}>
            <div className="um-modal-head">
              <div style={{ fontSize: 18, fontWeight: 800, color: '#1B2559' }}>User Details</div>
              <button className="db-action-btn" onClick={() => setSelectedUser(null)}><X size={16} /></button>
            </div>
            <div className="um-modal-body">
              <div className="um-modal-field"><span className="um-modal-label">Full Name</span><div className="um-input">{selectedUser.fullName}</div></div>
              <div className="um-modal-field"><span className="um-modal-label">Email</span><div className="um-input">{selectedUser.email}</div></div>
              <div className="um-modal-field"><span className="um-modal-label">Phone</span><div className="um-input">{selectedUser.phone}</div></div>
              <div className="um-modal-field"><span className="um-modal-label">Address</span><div className="um-input">{selectedUser.address}</div></div>
              <div className="um-modal-field"><span className="um-modal-label">Registered Date</span><div className="um-input">{safeDateText(selectedUser.registeredAt)}</div></div>
              <div className="um-modal-field"><span className="um-modal-label">Last Active</span><div className="um-input">{safeDateText(selectedUser.lastActiveAt)}</div></div>
              <div className="um-modal-field"><span className="um-modal-label">Current Status</span><div className="um-input">{selectedUser.status}</div></div>
              <div className="um-modal-field"><span className="um-modal-label">Role / Account Type</span><div className="um-input">{selectedUser.role}</div></div>
              <div className="um-modal-field"><span className="um-modal-label">Source</span><div className="um-input">{selectedUser.source}</div></div>
              <div className="um-modal-field"><span className="um-modal-label">Usage</span><div className="um-input">Web and mobile usage data can be added here.</div></div>
            </div>
          </div>
        </div>
      )}

      {editUser && (
        <div className="um-modal-backdrop" onClick={() => setEditUser(null)}>
          <div className="um-modal" onClick={(e) => e.stopPropagation()}>
            <div className="um-modal-head">
              <div style={{ fontSize: 18, fontWeight: 800, color: '#1B2559' }}>Edit User Info</div>
              <button className="db-action-btn" onClick={() => setEditUser(null)}><X size={16} /></button>
            </div>
            <div className="um-modal-body">
              <label className="um-modal-field">
                <span className="um-modal-label">Full Name</span>
                <input className="um-input" value={editUser.fullName} onChange={(e) => setEditUser((p) => ({ ...p, fullName: e.target.value }))} />
              </label>
              <label className="um-modal-field">
                <span className="um-modal-label">Email (read only)</span>
                <input className="um-input" value={editUser.email} readOnly />
              </label>
              <label className="um-modal-field">
                <span className="um-modal-label">Phone Number</span>
                <input className="um-input" value={editUser.phone} onChange={(e) => setEditUser((p) => ({ ...p, phone: e.target.value }))} />
              </label>
              <label className="um-modal-field">
                <span className="um-modal-label">Address</span>
                <input className="um-input" value={editUser.address} onChange={(e) => setEditUser((p) => ({ ...p, address: e.target.value }))} />
              </label>
              <label className="um-modal-field">
                <span className="um-modal-label">Role / Account Type</span>
                <input className="um-input" value={editUser.role} onChange={(e) => setEditUser((p) => ({ ...p, role: e.target.value }))} />
              </label>
              <div className="um-modal-field">
                <span className="um-modal-label">Status</span>
                <div className="um-input">{editUser.status}</div>
              </div>
            </div>
            <div style={{ padding: 20, borderTop: '1px solid #EEF2FF', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="db-action-btn" onClick={() => setEditUser(null)}>Cancel</button>
              <button className="db-edit-btn" disabled={savingId === editUser.id} onClick={() => void saveEdit()}>
                {savingId === editUser.id ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;

