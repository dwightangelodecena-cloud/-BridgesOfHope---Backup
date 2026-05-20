import { supabase, isSupabaseConfigured } from './supabase';

const LOCAL_REPORTS_KEY = 'bh_nurse_weekly_reports';

export function isSupabasePatientId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  );
}

export function canonicalPatientId(
  patient: { id?: string; name?: string } | null | undefined,
  detailsById: Record<string, Record<string, unknown>> = {}
): string {
  if (!patient) return '';
  const raw = String(patient.id || '').trim();
  if (isSupabasePatientId(raw)) return raw;
  const fromDetail = detailsById[raw];
  const detailId = fromDetail?.id;
  if (typeof detailId === 'string' && isSupabasePatientId(detailId)) return detailId;
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

function sortReports<T extends { week_number?: number | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (Number(a.week_number) || 0) - (Number(b.week_number) || 0));
}

export function resolveWeeklyReportsForPatient<T extends { week_number?: number | null }>(
  patient: { id?: string; name?: string } | null | undefined,
  byPatient: Record<string, T[]>,
  detailsById: Record<string, Record<string, unknown>> = {}
): T[] {
  if (!patient) return [];

  const listId = String(patient.id || '');
  const canonicalId = canonicalPatientId(patient, detailsById);
  const direct =
    (byPatient[listId]?.length ? byPatient[listId] : null) ||
    (canonicalId && byPatient[canonicalId]?.length ? byPatient[canonicalId] : null);
  if (direct?.length) return sortReports(direct);

  const targetName = String(
    patient.name ||
      detailsById[listId]?.full_name ||
      detailsById[canonicalId]?.full_name ||
      ''
  )
    .trim()
    .toLowerCase();

  if (targetName) {
    for (const [key, rows] of Object.entries(byPatient || {})) {
      if (!rows?.length) continue;
      const detail = detailsById[key];
      const rowName = String(detail?.full_name || '').trim().toLowerCase();
      if (rowName === targetName) return sortReports(rows);
    }
  }

  return [];
}

export async function fetchWeeklyReportsForPatientId(patientId: string) {
  const pid = String(patientId || '').trim();
  if (!isSupabaseConfigured() || !isSupabasePatientId(pid)) return [];

  const { data, error } = await supabase
    .from('weekly_reports')
    .select('*')
    .eq('patient_id', pid)
    .order('week_number', { ascending: true });

  if (!error && (data || []).length) return data || [];

  const { data: rpcData, error: rpcErr } = await supabase.rpc('bh_family_weekly_reports');
  if (!rpcErr && rpcData) {
    return (rpcData || []).filter((row: { patient_id?: string }) => String(row.patient_id) === pid);
  }

  return data || [];
}

export function mergeReportsIntoByPatient<T>(
  byPatient: Record<string, T[]>,
  patientId: string,
  rows: T[],
  aliasId?: string | null
): Record<string, T[]> {
  const key = String(patientId || '');
  const alias = aliasId ? String(aliasId) : '';
  const sorted = sortReports(rows as { week_number?: number | null }[]) as T[];
  if (!sorted.length) return byPatient;
  const next = { ...byPatient, [key]: sorted };
  if (alias && alias !== key) next[alias] = sorted;
  return next;
}
