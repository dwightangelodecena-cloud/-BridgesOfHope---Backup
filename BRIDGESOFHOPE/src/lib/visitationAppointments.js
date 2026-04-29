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

export function loadVisitationRequests() {
  try {
    const raw = localStorage.getItem(VISITATION_REQUESTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
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
