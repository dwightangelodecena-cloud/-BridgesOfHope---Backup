import { supabase } from '@/lib/supabase';

/** Nurse/program-only per-day patient notes. See supabase/migrations/20260828131000_daily_reports.sql. */

/** ISO Monday..Sunday date range (inclusive) for `weekNumber` counted from `startDate` (patient admission date). */
export function weekDateRange(startDate, weekNumber) {
  const start = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const weekStart = new Date(start);
  weekStart.setDate(weekStart.getDate() + (Math.max(1, Number(weekNumber) || 1) - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const toIso = (d) => d.toISOString().slice(0, 10);
  return { from: toIso(weekStart), to: toIso(weekEnd) };
}

/** The 7 ISO dates covered by `weekNumber` (counted from `startDate`), or [] when unknown. */
export function weekDateList(startDate, weekNumber) {
  const range = weekDateRange(startDate, weekNumber);
  if (!range) return [];
  const out = [];
  const d = new Date(`${range.from}T00:00:00`);
  for (let i = 0; i < 7; i += 1) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/**
 * Verbatim, date-sorted snapshot of daily_reports rows for compiling into a concluded
 * weekly report (stored in weekly_reports.compiled_daily_reports).
 */
export function snapshotDailyReports(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => r && r.report_date)
    .sort((a, b) => String(a.report_date).localeCompare(String(b.report_date)))
    .map((r) => ({
      report_date: r.report_date,
      author_role: r.author_role || null,
      observations: r.observations || null,
      assessment: r.assessment || null,
      follow_up: r.follow_up || null,
      notes: r.notes || null,
    }));
}

/** @returns {Promise<{ok:true,rows:object[]}|{ok:false,errorMessage:string}>} */
export async function fetchDailyReportsForRange(patientId, fromDate, toDate) {
  if (!patientId) return { ok: true, rows: [] };
  let query = supabase
    .from('daily_reports')
    .select('*')
    .eq('patient_id', patientId)
    .order('report_date', { ascending: true });
  if (fromDate) query = query.gte('report_date', fromDate);
  if (toDate) query = query.lte('report_date', toDate);
  const { data, error } = await query;
  if (error) return { ok: false, errorMessage: error.message || 'Could not load daily reports.' };
  return { ok: true, rows: data || [] };
}

/** @returns {Promise<{ok:true,rows:object[]}|{ok:false,errorMessage:string}>} */
export async function fetchAllDailyReportsForPatient(patientId) {
  return fetchDailyReportsForRange(patientId, null, null);
}

/** All daily reports for one week, date-ordered. @returns {Promise<{ok,rows}|{ok:false,errorMessage}>} */
export async function fetchDailyReportsForWeek(patientId, weekNumber) {
  if (!patientId || !weekNumber) return { ok: true, rows: [] };
  const { data, error } = await supabase
    .from('daily_reports')
    .select('*')
    .eq('patient_id', patientId)
    .eq('week_number', weekNumber)
    .order('report_date', { ascending: true });
  if (error) return { ok: false, errorMessage: error.message || 'Could not load daily reports.' };
  return { ok: true, rows: data || [] };
}

/**
 * Lightweight per-patient daily-report rows for dashboard counts.
 * @returns {Promise<Record<string, Array<{week_number:number|null, report_date:string}>>>}
 */
export async function fetchDailyReportsForPatients(patientIds) {
  const ids = (patientIds || []).filter(Boolean);
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from('daily_reports')
    .select('patient_id, week_number, report_date')
    .in('patient_id', ids);
  if (error) return {};
  const byPatient = {};
  for (const row of data || []) {
    (byPatient[row.patient_id] ||= []).push(row);
  }
  return byPatient;
}

/**
 * Upserts today's (or a given date's) daily report for the current author.
 * One row per (patient_id, report_date, author_id) — a nurse and program staffer can both
 * log the same day without clobbering each other.
 * @returns {Promise<{ok:true}|{ok:false,errorMessage:string}>}
 */
export async function upsertDailyReport({ patientId, reportDate, authorId, authorRole, weekNumber, observations, assessment, followUp, notes }) {
  if (!patientId || !reportDate || !authorId) {
    return { ok: false, errorMessage: 'Missing patient, date, or author for daily report.' };
  }
  const payload = {
    patient_id: patientId,
    report_date: reportDate,
    author_id: authorId,
    author_role: authorRole || null,
    observations: observations || null,
    assessment: assessment || null,
    follow_up: followUp || null,
    notes: notes || null,
    updated_at: new Date().toISOString(),
  };
  if (weekNumber != null && Number.isFinite(Number(weekNumber))) {
    payload.week_number = Number(weekNumber);
  }
  let { error } = await supabase
    .from('daily_reports')
    .upsert(payload, { onConflict: 'patient_id,report_date,author_id' });
  if (error && /column .* does not exist/i.test(String(error.message || '')) && 'week_number' in payload) {
    // week_number not migrated yet — retry without it
    delete payload.week_number;
    ({ error } = await supabase
      .from('daily_reports')
      .upsert(payload, { onConflict: 'patient_id,report_date,author_id' }));
  }
  if (error) return { ok: false, errorMessage: error.message || 'Could not save daily report.' };
  return { ok: true };
}
