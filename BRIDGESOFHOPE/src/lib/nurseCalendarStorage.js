/**
 * Nurse calendar agendas: localStorage cache + Supabase when configured.
 * Deadlines: localStorage only (admin UI).
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export const NURSE_AGENDAS_KEY = 'bh_nurse_calendar_agendas';
export const STAFF_REPORT_DEADLINES_KEY = 'bh_staff_report_deadlines';

function safeParse(json, fallback) {
  try {
    return json ? JSON.parse(json) : fallback;
  } catch {
    return fallback;
  }
}

/** @returns {Record<string, Record<string, unknown[]>>} */
export function loadAllAgendas() {
  return safeParse(localStorage.getItem(NURSE_AGENDAS_KEY), {});
}

export function saveAllAgendas(store) {
  localStorage.setItem(NURSE_AGENDAS_KEY, JSON.stringify(store));
}

/** @param {string} userId */
export function getAgendasForDay(userId, dateIso) {
  const all = loadAllAgendas();
  const byUser = all[userId] || {};
  return Array.isArray(byUser[dateIso]) ? byUser[dateIso] : [];
}

/**
 * @param {string} userId
 * @param {string} dateIso YYYY-MM-DD
 * @param {{ id: string, type: string, description: string, patientId?: string, patientName?: string, createdAt?: string }} item
 */
export function upsertAgenda(userId, dateIso, item) {
  const all = loadAllAgendas();
  if (!all[userId]) all[userId] = {};
  const list = Array.isArray(all[userId][dateIso]) ? [...all[userId][dateIso]] : [];
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx >= 0) list[idx] = item;
  else list.push(item);
  all[userId][dateIso] = list;
  saveAllAgendas(all);
  window.dispatchEvent(new CustomEvent('bh-nurse-calendar-update'));
}

function shouldSkipCloudSync(userId) {
  return !isSupabaseConfigured() || userId === 'local-user' || !userId;
}

async function persistAgendaDeleteRemote(userId, agendaId) {
  if (shouldSkipCloudSync(userId)) return { ok: true, skipped: true };
  const { error } = await supabase
    .from('nurse_calendar_agendas')
    .delete()
    .eq('id', agendaId)
    .eq('nurse_user_id', userId);
  if (error) return { ok: false, error };
  return { ok: true, skipped: false };
}

/**
 * @param {string} userId
 * @param {string} dateIso
 * @param {string} agendaId
 */
export function removeAgenda(userId, dateIso, agendaId) {
  const all = loadAllAgendas();
  if (!all[userId]?.[dateIso]) return;
  all[userId][dateIso] = all[userId][dateIso].filter((x) => x.id !== agendaId);
  if (all[userId][dateIso].length === 0) delete all[userId][dateIso];
  saveAllAgendas(all);
  window.dispatchEvent(new CustomEvent('bh-nurse-calendar-update'));
  void persistAgendaDeleteRemote(userId, agendaId);
}

export async function removeAgendaFromCloud(userId, agendaId) {
  return persistAgendaDeleteRemote(userId, agendaId);
}

/**
 * Deadlines set by admin: { entries: DeadlineEntry[] }
 * audience: 'all_nurses' | 'nurse' | 'program' | 'all_staff'
 * staffUserId: optional — when set with audience 'nurse', only that nurse sees it
 */
export function loadDeadlineEntries() {
  const data = safeParse(localStorage.getItem(STAFF_REPORT_DEADLINES_KEY), { entries: [] });
  return Array.isArray(data.entries) ? data.entries : [];
}

export function saveDeadlineEntries(entries) {
  localStorage.setItem(STAFF_REPORT_DEADLINES_KEY, JSON.stringify({ entries }));
  window.dispatchEvent(new CustomEvent('bh-nurse-calendar-update'));
}

/** Deadlines visible on nurse calendar */
export function getDeadlinesForNurse(userId) {
  return loadDeadlineEntries().filter((e) => {
    if (!e?.date) return false;
    const aud = String(e.audience || 'all_nurses');
    if (aud === 'all_nurses' || aud === 'all_staff' || aud === 'program') return true;
    if (aud === 'nurse') {
      if (!e.staffUserId) return true;
      return String(e.staffUserId) === String(userId);
    }
    return false;
  });
}

/**
 * Replace this user's cached agendas from Supabase (source of truth when online).
 * @param {string} userId
 * @returns {Promise<{ ok: boolean, skipped?: boolean, error?: unknown }>}
 */
export async function hydrateNurseAgendasFromSupabase(userId) {
  if (shouldSkipCloudSync(userId)) return { ok: true, skipped: true };
  const { data, error } = await supabase
    .from('nurse_calendar_agendas')
    .select('id, agenda_date, agenda_type, description, patient_id, patient_name, created_at')
    .eq('nurse_user_id', userId)
    .order('agenda_date', { ascending: true });

  if (error) return { ok: false, error, skipped: false };

  const byDate = {};
  for (const row of data || []) {
    const dateIso = String(row.agenda_date).slice(0, 10);
    const item = {
      id: row.id,
      type: row.agenda_type,
      description: row.description,
      createdAt: row.created_at,
    };
    if (row.patient_id) {
      item.patientId = String(row.patient_id);
      if (row.patient_name) item.patientName = row.patient_name;
    }
    if (!byDate[dateIso]) byDate[dateIso] = [];
    byDate[dateIso].push(item);
  }

  const all = loadAllAgendas();
  all[userId] = byDate;
  saveAllAgendas(all);
  window.dispatchEvent(new CustomEvent('bh-nurse-calendar-update'));
  return { ok: true, skipped: false };
}

/**
 * @param {string} userId
 * @param {string} dateIso YYYY-MM-DD
 * @param {{ id: string, type: string, description: string, patientId?: string, patientName?: string, createdAt?: string }} item
 * @returns {Promise<{ ok: boolean, skipped?: boolean, error?: unknown }>}
 */
export async function saveAgendaToCloud(userId, dateIso, item) {
  if (shouldSkipCloudSync(userId)) return { ok: true, skipped: true };
  const row = {
    id: item.id,
    nurse_user_id: userId,
    agenda_date: dateIso,
    agenda_type: item.type,
    description: item.description,
    patient_id: item.patientId || null,
    patient_name: item.patientName || null,
    created_at: item.createdAt || new Date().toISOString(),
  };
  const { error } = await supabase.from('nurse_calendar_agendas').upsert(row, { onConflict: 'id' });
  if (error) return { ok: false, error, skipped: false };
  return { ok: true, skipped: false };
}
