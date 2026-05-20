import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const LOCAL_REPORTS_KEY = 'bh_nurse_weekly_reports';

export function isSupabasePatientId(id) {
  return (
    typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  );
}

/** Best UUID for weekly_reports.patient_id lookups. */
export function canonicalPatientId(patient, detailsById = {}) {
  if (!patient) return '';
  const raw = String(patient.id || '').trim();
  if (isSupabasePatientId(raw)) return raw;
  const fromDetail = detailsById[raw];
  if (fromDetail?.id && isSupabasePatientId(String(fromDetail.id))) return String(fromDetail.id);
  const name = String(patient.name || fromDetail?.full_name || '').trim().toLowerCase();
  if (!name) return raw;
  for (const row of Object.values(detailsById || {})) {
    if (!row || typeof row !== 'object') continue;
    if (String(row.full_name || '').trim().toLowerCase() === name && isSupabasePatientId(String(row.id))) {
      return String(row.id);
    }
  }
  return raw;
}

function sortReports(rows) {
  return [...(rows || [])].sort(
    (a, b) => (Number(a.week_number) || 0) - (Number(b.week_number) || 0)
  );
}

function localReportsByPatientName(targetName) {
  const name = String(targetName || '').trim().toLowerCase();
  if (!name) return [];
  try {
    const raw = localStorage.getItem(LOCAL_REPORTS_KEY);
    const localAll = raw ? JSON.parse(raw) : {};
    const fallbackRows = [];
    Object.entries(localAll || {}).forEach(([pid, weeks]) => {
      if (!weeks || typeof weeks !== 'object') return;
      Object.entries(weeks).forEach(([weekNum, entry]) => {
        const entryName = String(entry?.patientName || '').trim().toLowerCase();
        if (entryName !== name) return;
        fallbackRows.push({
          id: `local-name-${pid}-${weekNum}`,
          patient_id: pid,
          week_number: Number(weekNum),
          submitted_at: entry?.submittedAt ?? null,
          created_at: entry?.submittedAt ?? null,
          nurse_name: entry?.nurseName ?? entry?.nurse_name ?? '',
          report_date: entry?.reportDate ?? entry?.report_date ?? '',
          summary: entry?.summary ?? entry?.report_summary ?? '',
          nurse_note: entry?.nurseNote ?? entry?.nurse_note ?? entry?.notes ?? '',
          notes: entry?.notes ?? '',
          behavior_observation: entry?.behaviorObservation ?? entry?.behavior_observation ?? '',
          recommendations: entry?.recommendations ?? entry?.plan_next_week ?? '',
          vitals_weight: entry?.vitalsWeight ?? entry?.vitals_weight ?? '',
          vitals_height: entry?.vitalsHeight ?? entry?.vitals_height ?? '',
          vitals_bp: entry?.vitalsBp ?? entry?.vitals_bp ?? '',
          vitals_pr: entry?.vitalsPr ?? entry?.vitals_pr ?? '',
          vitals_rr: entry?.vitalsRr ?? entry?.vitals_rr ?? '',
          vitals_temperature: entry?.vitalsTemperature ?? entry?.vitals_temperature ?? '',
          vitals_bmi: entry?.vitalsBmi ?? entry?.vitals_bmi ?? '',
          vitals_spo2: entry?.vitalsSpo2 ?? entry?.vitals_spo2 ?? '',
        });
      });
    });
    return sortReports(fallbackRows);
  } catch {
    return [];
  }
}

/**
 * Resolve weekly reports for a resident (by id, canonical id, name, and local cache).
 * Temporary discharge does not remove historical reports.
 */
export function resolveWeeklyReportsForPatient(patient, byPatient = {}, detailsById = {}) {
  if (!patient) return [];

  const listId = String(patient.id || '');
  const canonicalId = canonicalPatientId(patient, detailsById);
  const direct =
    (byPatient[listId]?.length ? byPatient[listId] : null)
    || (canonicalId && byPatient[canonicalId]?.length ? byPatient[canonicalId] : null);
  if (direct?.length) return sortReports(direct);

  const targetName = String(
    patient.name || detailsById[listId]?.full_name || detailsById[canonicalId]?.full_name || ''
  ).trim().toLowerCase();

  if (targetName) {
    for (const [key, rows] of Object.entries(byPatient || {})) {
      if (!rows?.length) continue;
      const detail = detailsById[key];
      const rowName = String(detail?.full_name || '').trim().toLowerCase();
      if (rowName === targetName) return sortReports(rows);
    }
    const byName = localReportsByPatientName(targetName);
    if (byName.length) return byName;
  }

  return [];
}

/** Fetch weekly reports for one resident from Supabase (direct + family RPC). */
export async function fetchWeeklyReportsForPatientId(patientId) {
  const pid = String(patientId || '').trim();
  if (!isSupabaseConfigured() || !isSupabasePatientId(pid)) return [];

  const { data, error } = await supabase
    .from('weekly_reports')
    .select('*')
    .eq('patient_id', pid)
    .order('week_number', { ascending: true });

  if (!error && (data || []).length) return data;

  const { data: rpcData, error: rpcErr } = await supabase.rpc('bh_family_weekly_reports');
  if (!rpcErr && rpcData) {
    return (rpcData || []).filter((row) => String(row.patient_id) === pid);
  }

  return data || [];
}

export function mergeReportsIntoByPatient(byPatient, patientId, rows, aliasId = null) {
  const key = String(patientId || '');
  const alias = aliasId ? String(aliasId) : '';
  const sorted = sortReports(rows);
  if (!sorted.length) return byPatient;
  const next = { ...byPatient, [key]: sorted };
  if (alias && alias !== key) next[alias] = sorted;
  return next;
}
