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

const CANONICAL_VISITATION_STATUSES = new Set([
  'Requested',
  'Approved',
  'Declined',
  'Rescheduled',
  'Cancelled',
  'Completed',
]);

/** Align with web `normalizeVisitationStatus` for numeric / mixed DB values. */
export function normalizeVisitationStatus(raw: unknown): string {
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

/** Same logic as web: calendar dots use confirmed slot once visit is approved/rescheduled. */
export function visitationCalendarDateKeys(row: VisitationRequestRow): string[] {
  const st = normalizeVisitationStatus(row.status);
  const conf = String(row.confirmedDate || '').trim();
  const pref = String(row.preferredDate || '').trim();
  if (st === 'Declined' || st === 'Cancelled') return [];
  if ((st === 'Approved' || st === 'Rescheduled' || st === 'Completed') && conf) return [conf];
  if (pref) return [pref];
  return [];
}

function isLocalDraftSuperseded(localRow: VisitationRequestRow, fromDb: VisitationRequestRow[]): boolean {
  if (!String(localRow.id || '').startsWith('visit_')) return false;
  const lf = String(localRow.familyName || '');
  const lp = String(localRow.patientName || '');
  const ld = String(localRow.preferredDate || '');
  const lt = String(localRow.preferredTime || '');
  return fromDb.some(
    (d) =>
      String(d.familyName || '') === lf &&
      String(d.patientName || '') === lp &&
      String(d.preferredDate || '') === ld &&
      String(d.preferredTime || '') === lt
  );
}

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
  confirmedDate?: string;
  confirmedTime?: string;
  adminNote?: string;
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

function mapRemoteVisitationRow(r: Record<string, unknown>): VisitationRequestRow {
  return {
    id: String(r.id),
    familyId: String(r.family_id || ''),
    familyName: String(r.family_name || ''),
    patientId: String(r.patient_id || ''),
    patientName: String(r.patient_name || ''),
    preferredDate: String(r.preferred_date || ''),
    preferredTime: String(r.preferred_time || ''),
    note: String(r.note || ''),
    status: normalizeVisitationStatus(r.status),
    confirmedDate: String(r.confirmed_date || ''),
    confirmedTime: String(r.confirmed_time || ''),
    adminNote: String(r.admin_note || ''),
    createdAt: String(r.created_at || ''),
    updatedAt: String(r.updated_at || ''),
  };
}

/** Replace temporary `visit_*` row with the server id after insert; keeps a single row per request. */
export async function upsertVisitationRequestAfterRemoteInsert(
  dropLocalId: string,
  remote: Record<string, unknown>
): Promise<void> {
  const row = mapRemoteVisitationRow(remote);
  const all = await loadVisitationRequests();
  const withoutDraft = all.filter((r) => String(r.id) !== String(dropLocalId));
  const idx = withoutDraft.findIndex((r) => String(r.id) === row.id);
  if (idx >= 0) {
    withoutDraft[idx] = { ...withoutDraft[idx], ...row };
  } else {
    withoutDraft.unshift(row);
  }
  await saveVisitationRequests(withoutDraft);
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
  const fromDb: VisitationRequestRow[] = (data || []).map((r) => mapRemoteVisitationRow(r));
  const seen = new Set(fromDb.map((r) => String(r.id)));
  const mergedFamily = [
    ...fromDb,
    ...localRows.filter((r) => !seen.has(String(r.id)) && !isLocalDraftSuperseded(r, fromDb)),
  ].map((r) => ({
    ...r,
    status: normalizeVisitationStatus(r.status),
  }));
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
