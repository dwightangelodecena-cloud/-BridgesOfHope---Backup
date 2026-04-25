/**
 * Mirrors BRIDGESOFHOPE `src/lib/dbMappers.js` for family mobile.
 */

export type AdmissionRequestRow = Record<string, unknown>;

export type DischargeRequestRow = Record<string, unknown> & {
  patients?: { full_name?: string } | null;
  patient_name?: string | null;
};

export function uiAdmissionRequestFromRow(r: AdmissionRequestRow | null | undefined) {
  if (!r?.id) return null;
  const createdAt = r.created_at as string | undefined;
  return {
    requestId: r.id,
    id: r.id,
    name: (r.patient_name as string) || '',
    patientName: (r.patient_name as string) || '',
    patient_name: (r.patient_name as string) || '',
    reason: (r.reason_for_admission as string) || '',
    status: (r.status as string) || 'Pending',
    createdAt: createdAt
      ? new Date(createdAt).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '',
    created_at: createdAt,
    family_id: r.family_id as string | undefined,
  };
}

export function uiDischargeRequestFromRow(r: DischargeRequestRow | null | undefined) {
  if (!r?.id) return null;
  const patient = r.patients;
  const pname =
    (typeof patient === 'object' && patient && patient.full_name) ||
    (r.patient_name as string) ||
    'Patient';
  const createdAt = r.created_at as string | undefined;
  return {
    dischargeRequestId: r.id,
    patientId: r.patient_id,
    id: r.patient_id,
    name: pname,
    patientName: pname,
    patient_name: (r.patient_name as string) || pname,
    status: (r.status as string) || 'Pending',
    requestTime: createdAt
      ? new Date(createdAt).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '',
    created_at: createdAt,
    family_id: r.family_id as string | undefined,
  };
}
