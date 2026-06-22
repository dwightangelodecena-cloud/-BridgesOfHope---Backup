import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const VISITATION_SETTINGS_KEY = 'bh_visitation_settings_v1';
const VISITATION_REQUESTS_KEY = 'bh_visitation_requests_v1';
const VISITATION_SETTINGS_ROW_ID = 'global';

const DEFAULT_SETTINGS = {
  days: ['Wednesday', 'Saturday'],
  startTime: '13:00',
  endTime: '17:00',
};

const CANONICAL_VISITATION_STATUSES = new Set([
  'Requested',
  'Approved',
  'Declined',
  'Rescheduled',
  'Cancelled',
  'Completed',
]);

/**
 * Some databases return numeric status codes; the UI expects these text labels.
 * (e.g. family requests showing as "2" instead of "Requested".)
 */
export function normalizeVisitationStatus(raw) {
  if (raw === null || raw === undefined || raw === '') return 'Requested';
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw === 2) return 'Requested';
    if (raw === 3) return 'Approved';
    if (raw === 4) return 'Declined';
    if (raw === 5) return 'Rescheduled';
    if (raw === 1) return 'Requested';
    return 'Requested';
  }
  const s = String(raw).trim();
  if (!s) return 'Requested';
  if (CANONICAL_VISITATION_STATUSES.has(s)) return s;
  const lo = s.toLowerCase();
  if (lo === 'pending' || lo === 'request' || lo === 'requested') return 'Requested';
  if (lo === 'approve' || lo === 'approved') return 'Approved';
  if (lo === 'decline' || lo === 'declined' || lo === 'rejected') return 'Declined';
  if (lo === 'reschedule' || lo === 'rescheduled') return 'Rescheduled';
  if (/^\d+$/.test(s)) return normalizeVisitationStatus(Number(s));
  return 'Requested';
}

/** Pending request preferred dates (status Requested). */
export function getPendingVisitationDateSet(rows) {
  const set = new Set();
  for (const row of rows || []) {
    if (!row) continue;
    if (normalizeVisitationStatus(row.status) !== 'Requested') continue;
    const iso = String(row.preferredDate || '').trim();
    if (iso) set.add(iso);
  }
  return set;
}

/** Confirmed family visits keyed by YYYY-MM-DD (Approved / Rescheduled with confirmed_date). */
export function getConfirmedVisitationMap(rows) {
  const map = new Map();
  for (const row of rows || []) {
    if (!row) continue;
    const st = normalizeVisitationStatus(row.status);
    if (st !== 'Approved' && st !== 'Rescheduled') continue;
    const iso = String(row.confirmedDate || '').trim();
    if (!iso) continue;
    const list = map.get(iso) || [];
    list.push(row);
    map.set(iso, list);
  }
  return map;
}

export function formatVisitationWeekdayLong(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

export function formatVisitationWeekdayShort(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

/** Dates on which this request should appear on admin/family calendars (one slot after confirmation). */
export function visitationCalendarDateKeys(row) {
  const st = normalizeVisitationStatus(row?.status);
  const conf = String(row?.confirmedDate || '').trim();
  const pref = String(row?.preferredDate || '').trim();
  if (st === 'Declined' || st === 'Cancelled') return [];
  if ((st === 'Approved' || st === 'Rescheduled' || st === 'Completed') && conf) return [conf];
  if (pref) return [pref];
  return [];
}

/** Local-only draft created before Supabase insert (`visit_*` ids). */
export function isLocalVisitationDraft(row) {
  return String(row?.id || '').startsWith('visit_');
}

/**
 * After a successful Supabase read, remote rows are authoritative.
 * Do not re-merge deleted DB rows from localStorage — only keep unsynced visit_* drafts.
 */
export function mergeVisitationRequestsAfterRemoteFetch(fromDbRows, localRows) {
  const fromDb = (Array.isArray(fromDbRows) ? fromDbRows : []).map((r) => ({
    ...r,
    status: normalizeVisitationStatus(r.status),
  }));
  const local = Array.isArray(localRows) ? localRows : [];
  const seen = new Set(fromDb.map((r) => String(r.id)));
  const drafts = local.filter(
    (r) =>
      r &&
      isLocalVisitationDraft(r) &&
      !seen.has(String(r.id)) &&
      !isVisitationLocalDraftSuperseded(r, fromDb)
  );
  const merged = [...fromDb, ...drafts];
  merged.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return merged;
}

/**
 * Persist Supabase rows for one family and update localStorage (remote wins over stale cache).
 * @returns {object[]} Rows for this family after sync
 */
export function replaceFamilyVisitationFromRemote(familyId, remoteRows) {
  const fid = String(familyId || '');
  const fromDb = (Array.isArray(remoteRows) ? remoteRows : [])
    .map((r) => (r?.family_id != null ? mapVisitationDbRow(r) : sanitizeVisitationRow(r)))
    .filter(Boolean);
  const localRows = listVisitationRequestsByFamily(fid);
  const merged = mergeVisitationRequestsAfterRemoteFetch(fromDb, localRows);
  const others = loadVisitationRequests().filter((r) => String(r.familyId || '') !== fid);
  replaceVisitationRequests([...others, ...merged]);
  return merged;
}

/** True when a local `visit_*` draft row matches a row already stored in Supabase (same request, real id). */
export function isVisitationLocalDraftSuperseded(localRow, fromDbRows) {
  if (!localRow || !Array.isArray(fromDbRows)) return false;
  if (!String(localRow.id || '').startsWith('visit_')) return false;
  const lf = String(localRow.familyName || '');
  const lp = String(localRow.patientName || '');
  const ld = String(localRow.preferredDate || '');
  const lt = String(localRow.preferredTime || '');
  return fromDbRows.some((d) => (
    String(d.familyName || '') === lf
    && String(d.patientName || '') === lp
    && String(d.preferredDate || '') === ld
    && String(d.preferredTime || '') === lt
  ));
}

export function loadVisitationSettings() {
  try {
    const raw = localStorage.getItem(VISITATION_SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SETTINGS };
    const days = Array.isArray(parsed.days)
      ? parsed.days.map((d) => String(d || '').trim()).filter(Boolean)
      : DEFAULT_SETTINGS.days;
    return {
      days: days.length ? days : DEFAULT_SETTINGS.days,
      startTime: String(parsed.startTime || DEFAULT_SETTINGS.startTime),
      endTime: String(parsed.endTime || DEFAULT_SETTINGS.endTime),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveVisitationSettings(settings) {
  const normalized = {
    days: Array.isArray(settings?.days) ? settings.days : DEFAULT_SETTINGS.days,
    startTime: settings?.startTime || DEFAULT_SETTINGS.startTime,
    endTime: settings?.endTime || DEFAULT_SETTINGS.endTime,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(VISITATION_SETTINGS_KEY, JSON.stringify(normalized));
  return normalized;
}

export async function loadVisitationSettingsShared() {
  const local = loadVisitationSettings();
  if (!isSupabaseConfigured()) return local;
  const { data, error } = await supabase
    .from('visitation_settings')
    .select('days,start_time,end_time')
    .eq('id', VISITATION_SETTINGS_ROW_ID)
    .maybeSingle();
  if (error || !data) return local;
  const resolved = {
    days: Array.isArray(data.days) && data.days.length ? data.days : local.days,
    startTime: String(data.start_time || local.startTime || DEFAULT_SETTINGS.startTime),
    endTime: String(data.end_time || local.endTime || DEFAULT_SETTINGS.endTime),
  };
  localStorage.setItem(VISITATION_SETTINGS_KEY, JSON.stringify({ ...resolved, updatedAt: new Date().toISOString() }));
  return resolved;
}

export async function saveVisitationSettingsShared(settings) {
  const normalized = saveVisitationSettings(settings);
  if (!isSupabaseConfigured()) return normalized;
  const payload = {
    id: VISITATION_SETTINGS_ROW_ID,
    days: normalized.days,
    start_time: normalized.startTime,
    end_time: normalized.endTime,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('visitation_settings')
    .upsert(payload, { onConflict: 'id' })
    .select('days,start_time,end_time')
    .single();
  if (error || !data) return normalized;
  const resolved = {
    days: Array.isArray(data.days) && data.days.length ? data.days : normalized.days,
    startTime: String(data.start_time || normalized.startTime),
    endTime: String(data.end_time || normalized.endTime),
  };
  localStorage.setItem(VISITATION_SETTINGS_KEY, JSON.stringify({ ...resolved, updatedAt: new Date().toISOString() }));
  return resolved;
}

function sanitizeVisitationRow(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    id: row.id != null ? String(row.id) : '',
    familyId: row.familyId != null ? String(row.familyId) : '',
    familyName: row.familyName != null ? String(row.familyName) : '',
    patientId: row.patientId != null ? String(row.patientId) : '',
    patientName: row.patientName != null ? String(row.patientName) : '',
    preferredDate: row.preferredDate != null ? String(row.preferredDate) : '',
    preferredTime: row.preferredTime != null ? String(row.preferredTime) : '',
    note: row.note != null ? String(row.note) : '',
    status: normalizeVisitationStatus(row.status),
    confirmedDate: row.confirmedDate != null ? String(row.confirmedDate) : '',
    confirmedTime: row.confirmedTime != null ? String(row.confirmedTime) : '',
    adminNote: row.adminNote != null ? String(row.adminNote) : '',
    createdAt: row.createdAt != null ? String(row.createdAt) : '',
    updatedAt: row.updatedAt != null ? String(row.updatedAt) : '',
  };
}

export function loadVisitationRequests() {
  try {
    const raw = localStorage.getItem(VISITATION_REQUESTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizeVisitationRow).filter(Boolean);
  } catch {
    return [];
  }
}

function saveVisitationRequests(rows) {
  localStorage.setItem(VISITATION_REQUESTS_KEY, JSON.stringify(Array.isArray(rows) ? rows : []));
}

export function listVisitationRequestsByFamily(familyId) {
  return loadVisitationRequests()
    .filter((r) => String(r.familyId || '') === String(familyId || ''))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export function listVisitationRequestsAll() {
  return loadVisitationRequests().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export function createVisitationRequest(payload) {
  const now = new Date().toISOString();
  const id = `visit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const row = {
    id,
    familyId: payload.familyId || '',
    familyName: payload.familyName || '',
    patientId: payload.patientId || '',
    patientName: payload.patientName || '',
    preferredDate: payload.preferredDate || '',
    preferredTime: payload.preferredTime || '',
    appointmentReason: payload.appointmentReason || '',
    note: payload.note || '',
    status: 'Requested',
    confirmedDate: '',
    confirmedTime: '',
    adminNote: '',
    createdAt: now,
    updatedAt: now,
  };
  const rows = loadVisitationRequests();
  rows.unshift(row);
  saveVisitationRequests(rows);
  return row;
}

export function updateVisitationRequest(id, patch) {
  const rows = loadVisitationRequests();
  const next = rows.map((row) => {
    if (String(row.id) !== String(id)) return row;
    return {
      ...row,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
  });
  saveVisitationRequests(next);
  return next.find((r) => String(r.id) === String(id)) || null;
}

export function upsertVisitationRequest(row, options = {}) {
  if (!row || !row.id) return null;
  const drop = new Set((options.dropLocalIds || []).map(String));
  const rows = loadVisitationRequests().filter((r) => !drop.has(String(r.id)));
  const idx = rows.findIndex((r) => String(r.id) === String(row.id));
  if (idx >= 0) {
    rows[idx] = { ...rows[idx], ...row, updatedAt: row.updatedAt || new Date().toISOString() };
  } else {
    rows.unshift({ ...row, updatedAt: row.updatedAt || new Date().toISOString() });
  }
  saveVisitationRequests(rows);
  return row;
}

export function replaceVisitationRequests(rows) {
  saveVisitationRequests(Array.isArray(rows) ? rows : []);
  return loadVisitationRequests();
}

function mapVisitationDbRow(r) {
  return {
    id: r.id,
    familyId: r.family_id || '',
    familyName: r.family_name || '',
    patientId: r.patient_id || '',
    patientName: r.patient_name || '',
    preferredDate: r.preferred_date || '',
    preferredTime: r.preferred_time || '',
    note: r.note || '',
    status: normalizeVisitationStatus(r.status),
    confirmedDate: r.confirmed_date || '',
    confirmedTime: r.confirmed_time || '',
    adminNote: r.admin_note || '',
    createdAt: r.created_at || '',
    updatedAt: r.updated_at || '',
  };
}

/** Family dashboard: merge Supabase rows with local cache for one family. */
export async function loadFamilyVisitationRequests(familyId) {
  const fid = String(familyId || '');
  const localRows = listVisitationRequestsByFamily(fid);
  if (!isSupabaseConfigured() || !fid) {
    return localRows.map((r) => ({ ...r, status: normalizeVisitationStatus(r.status) }));
  }
  const { data, error } = await supabase
    .from('visitation_requests')
    .select('*')
    .eq('family_id', fid)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[visitation] loadFamilyVisitationRequests', error.message);
    return localRows.map((r) => ({ ...r, status: normalizeVisitationStatus(r.status) }));
  }
  return replaceFamilyVisitationFromRemote(fid, data || []);
}

/** Remove from Supabase (when configured) and local cache. */
export async function deleteVisitationRequestPermanent(id) {
  const sid = String(id || '');
  if (!sid) return { ok: false, errorMessage: 'Missing request id.' };
  if (isSupabaseConfigured() && !sid.startsWith('visit_')) {
    const { error } = await supabase.from('visitation_requests').delete().eq('id', sid);
    if (error) return { ok: false, errorMessage: error.message || 'Could not delete appointment.' };
  }
  const next = loadVisitationRequests().filter((r) => String(r.id) !== sid);
  saveVisitationRequests(next);
  try {
    window.dispatchEvent(new Event('storage'));
  } catch {
    /* ignore */
  }
  return { ok: true };
}
