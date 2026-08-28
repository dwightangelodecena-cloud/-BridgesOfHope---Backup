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

/**
 * Upserts today's (or a given date's) daily report for the current author.
 * One row per (patient_id, report_date, author_id) — a nurse and program staffer can both
 * log the same day without clobbering each other.
 * @returns {Promise<{ok:true}|{ok:false,errorMessage:string}>}
 */
export async function upsertDailyReport({ patientId, reportDate, authorId, authorRole, observations, assessment, followUp, notes }) {
  if (!patientId || !reportDate || !authorId) {
    return { ok: false, errorMessage: 'Missing patient, date, or author for daily report.' };
  }
  const { error } = await supabase.from('daily_reports').upsert(
    {
      patient_id: patientId,
      report_date: reportDate,
      author_id: authorId,
      author_role: authorRole || null,
      observations: observations || null,
      assessment: assessment || null,
      follow_up: followUp || null,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'patient_id,report_date,author_id' }
  );
  if (error) return { ok: false, errorMessage: error.message || 'Could not save daily report.' };
  return { ok: true };
}
