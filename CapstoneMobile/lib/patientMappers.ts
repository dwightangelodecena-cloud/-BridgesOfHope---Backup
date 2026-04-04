/**
 * Maps `public.patients` rows to UI shape — mirrors BRIDGESOFHOPE `src/lib/dbMappers.js` (`uiPatientFromRow`).
 */
export type PatientRow = {
  id: string;
  full_name: string;
  admitted_at: string | null;
  progress_percent: number | null;
  clinical_status: string | null;
  primary_concern: string | null;
  family_id: string | null;
  discharged_at: string | null;
};

export type UIPatient = {
  id: string;
  name: string;
  date: string;
  progress: number;
  status: string;
  reason: string;
  family_id: string | null;
  admitted_at: string | null;
  discharged_at: string | null;
};

export function uiPatientFromRow(p: PatientRow | null | undefined): UIPatient | null {
  if (!p?.id) return null;
  return {
    id: p.id,
    name: p.full_name,
    date: p.admitted_at
      ? new Date(p.admitted_at).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : '',
    progress: Math.min(100, Math.max(0, p.progress_percent ?? 0)),
    status: p.clinical_status || '',
    reason: p.primary_concern || '',
    family_id: p.family_id,
    admitted_at: p.admitted_at,
    discharged_at: p.discharged_at,
  };
}
