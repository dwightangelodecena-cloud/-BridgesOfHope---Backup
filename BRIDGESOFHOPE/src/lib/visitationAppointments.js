import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const VISITATION_SETTINGS_KEY = 'bh_visitation_settings_v1';
const VISITATION_REQUESTS_KEY = 'bh_visitation_requests_v1';
const VISITATION_SETTINGS_ROW_ID = 'global';

const DEFAULT_SETTINGS = {
  days: ['Wednesday', 'Saturday'],
  startTime: '13:00',
  endTime: '17:00',
};

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

export function upsertVisitationRequest(row) {
  if (!row || !row.id) return null;
  const rows = loadVisitationRequests();
  const idx = rows.findIndex((r) => String(r.id) === String(row.id));
  if (idx >= 0) {
    rows[idx] = { ...rows[idx], ...row, updatedAt: row.updatedAt || new Date().toISOString() };
  } else {
    rows.unshift(row);
  }
  saveVisitationRequests(rows);
  return row;
}

export function replaceVisitationRequests(rows) {
  saveVisitationRequests(Array.isArray(rows) ? rows : []);
  return loadVisitationRequests();
}
