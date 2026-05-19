import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export function mapPatientRowForPredictive(row) {
  if (!row) return null;
  return {
    id: row.id,
    full_name: row.full_name,
    name: row.full_name,
    primary_concern: row.primary_concern,
    concern: row.primary_concern,
    clinical_status: row.clinical_status,
    status: row.discharged_at ? 'Discharged' : (row.clinical_status || 'Admitted'),
    gender: row.gender,
    date_of_birth: row.date_of_birth,
    admitted_at: row.admitted_at,
    discharged_at: row.discharged_at,
    room: row.room || row.room_number || null,
    case_load_manager: row.case_load_manager,
    program_staff: row.program_staff,
  };
}

/**
 * Loads live predictive inputs from Supabase (patients, requests, nurse weekly reports).
 */
export async function fetchPredictiveFromSupabase() {
  if (!isSupabaseConfigured()) {
    return { source: 'local', patients: [], admissionRequests: [], pendingAdmissions: [], pendingDischarges: [], weeklyReports: [] };
  }

  const patientSelect =
    'id, full_name, primary_concern, clinical_status, gender, date_of_birth, admitted_at, discharged_at, room, case_load_manager, program_staff, created_at';

  const [
    { data: patientRows, error: pErr },
    { data: pendingAdm, error: pendErr },
    { data: allAdm, error: allAdmErr },
    { data: pendingDis, error: disErr },
  ] = await Promise.all([
    supabase.from('patients').select(patientSelect).order('admitted_at', { ascending: false }).limit(8000),
    supabase.from('admission_requests').select('*').eq('status', 'pending'),
    supabase.from('admission_requests').select('*').order('created_at', { ascending: false }).limit(10000),
    supabase.from('discharge_requests').select('*').eq('status', 'pending'),
  ]);

  if (pErr) throw pErr;
  if (pendErr) throw pendErr;
  if (allAdmErr) throw allAdmErr;
  if (disErr) throw disErr;

  const patients = (patientRows || []).map(mapPatientRowForPredictive).filter(Boolean);
  const inCareIds = patients.filter((p) => !p.discharged_at).map((p) => p.id);

  let weeklyReports = [];
  if (inCareIds.length > 0) {
    const { data: wrRows, error: wrErr } = await supabase
      .from('weekly_reports')
      .select('id, patient_id, week_number, submitted_at, created_at, nurse_name')
      .in('patient_id', inCareIds)
      .order('submitted_at', { ascending: false })
      .limit(5000);
    if (wrErr) {
      console.warn('[predictive] weekly_reports', wrErr.message);
    } else {
      weeklyReports = wrRows || [];
    }
  }

  return {
    source: 'supabase',
    fetchedAt: new Date().toISOString(),
    patients,
    admissionRequests: allAdm || [],
    pendingAdmissions: pendingAdm || [],
    pendingDischarges: pendingDis || [],
    weeklyReports,
    inCareCount: inCareIds.length,
  };
}
