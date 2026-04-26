import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from './supabase';

const VISITATION_SETTINGS_KEY = 'bh_visitation_settings_v1';
const VISITATION_REQUESTS_KEY = 'bh_visitation_requests_v1';
const VISITATION_SETTINGS_ROW_ID = 'global';

const DEFAULT_SETTINGS = {
  days: ['Wednesday', 'Saturday'],
  startTime: '13:00',
  endTime: '17:00',
};

export type VisitationSettings = {
  days: string[];
  startTime: string;
  endTime: string;
};

export type VisitationRequestRow = {
  id: string;
  familyId: string;
  familyName: string;
  patientId: string;
  patientName: string;
  preferredDate: string;
  preferredTime: string;
  note: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export async function loadVisitationSettings(): Promise<VisitationSettings> {
  try {
    const raw = await AsyncStorage.getItem(VISITATION_SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SETTINGS };
    const days = Array.isArray(parsed.days)
      ? parsed.days.map((d: string) => String(d || '').trim()).filter(Boolean)
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

/** Same source as web admin/family: `visitation_settings` + local cache. */
export async function loadVisitationSettingsShared(): Promise<VisitationSettings> {
  const local = await loadVisitationSettings();
  if (!isSupabaseConfigured()) return local;
  const { data, error } = await supabase
    .from('visitation_settings')
    .select('days,start_time,end_time')
    .eq('id', VISITATION_SETTINGS_ROW_ID)
    .maybeSingle();
  if (error || !data) return local;
  const resolved: VisitationSettings = {
    days: Array.isArray(data.days) && data.days.length ? (data.days as string[]) : local.days,
    startTime: String(data.start_time || local.startTime || DEFAULT_SETTINGS.startTime),
    endTime: String(data.end_time || local.endTime || DEFAULT_SETTINGS.endTime),
  };
  try {
    await AsyncStorage.setItem(
      VISITATION_SETTINGS_KEY,
      JSON.stringify({ ...resolved, updatedAt: new Date().toISOString() })
    );
  } catch {
    /* ignore */
  }
  return resolved;
}

async function loadVisitationRequests(): Promise<VisitationRequestRow[]> {
  try {
    const raw = await AsyncStorage.getItem(VISITATION_REQUESTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveVisitationRequests(rows: VisitationRequestRow[]) {
  await AsyncStorage.setItem(VISITATION_REQUESTS_KEY, JSON.stringify(Array.isArray(rows) ? rows : []));
}

export async function listVisitationRequestsByFamily(familyId: string): Promise<VisitationRequestRow[]> {
  const rows = await loadVisitationRequests();
  return rows
    .filter((r) => String(r.familyId || '') === String(familyId || ''))
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

export async function createVisitationRequestLocal(payload: {
  familyId: string;
  familyName: string;
  patientId: string;
  patientName: string;
  preferredDate: string;
  preferredTime: string;
  note: string;
}): Promise<VisitationRequestRow> {
  const now = new Date().toISOString();
  const id = `visit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const row: VisitationRequestRow = {
    id,
    familyId: payload.familyId || '',
    familyName: payload.familyName || '',
    patientId: payload.patientId || '',
    patientName: payload.patientName || '',
    preferredDate: payload.preferredDate || '',
    preferredTime: payload.preferredTime || '',
    note: payload.note || '',
    status: 'Requested',
    createdAt: now,
    updatedAt: now,
  };
  const rows = await loadVisitationRequests();
  rows.unshift(row);
  await saveVisitationRequests(rows);
  return row;
}

export async function mergeRequestsFromSupabase(
  familyId: string,
  localRows: VisitationRequestRow[]
): Promise<VisitationRequestRow[]> {
  if (!isSupabaseConfigured() || !familyId) return localRows;
  const { data, error } = await supabase
    .from('visitation_requests')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false });
  if (error || !data) return localRows;
  const fromDb: VisitationRequestRow[] = (data || []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    familyId: String(r.family_id || ''),
    familyName: String(r.family_name || ''),
    patientId: String(r.patient_id || ''),
    patientName: String(r.patient_name || ''),
    preferredDate: String(r.preferred_date || ''),
    preferredTime: String(r.preferred_time || ''),
    note: String(r.note || ''),
    status: String(r.status || 'Requested'),
    createdAt: String(r.created_at || ''),
    updatedAt: String(r.updated_at || ''),
  }));
  const seen = new Set(fromDb.map((r) => String(r.id)));
  const mergedFamily = [...fromDb, ...localRows.filter((r) => !seen.has(String(r.id)))];
  mergedFamily.sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
  const allLocal = await loadVisitationRequests();
  const others = allLocal.filter((r) => String(r.familyId || '') !== String(familyId || ''));
  const combined = [...others, ...mergedFamily];
  combined.sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
  await saveVisitationRequests(combined);
  return mergedFamily.filter((r) => String(r.familyId || '') === String(familyId));
}
