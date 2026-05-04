import { computeAdmissionDisplayId } from '@/lib/admissionDischargeStore';

export function uiPatientFromRow(p) {
  if (!p) return null;
  return {
    id: p.id,
    admissionDisplayId: computeAdmissionDisplayId(
      { id: p.id, decided_at: p.admitted_at, created_at: p.created_at },
      { id: p.id, admitted_at: p.admitted_at }
    ),
    name: p.full_name,
    date: p.admitted_at
      ? new Date(p.admitted_at).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : '',
    progress: p.progress_percent ?? 0,
    status: p.clinical_status || '',
    reason: p.primary_concern || '',
    family_id: p.family_id,
    admitted_at: p.admitted_at,
    discharged_at: p.discharged_at,
  };
}

export function uiAdmissionRequestFromRow(r) {
  if (!r) return null;
  return {
    requestId: r.id,
    id: r.id,
    name: r.patient_name,
    reason: r.reason_for_admission,
    requestTime: r.created_at
      ? new Date(r.created_at).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '',
    familyNumber: r.guardian_phone,
    familyEmail: r.guardian_email,
    patientNumber: r.guardian_phone,
    family_id: r.family_id,
    patient_name: r.patient_name,
    reason_for_admission: r.reason_for_admission,
    guardian_full_name: r.guardian_full_name,
    guardian_email: r.guardian_email,
    guardian_phone: r.guardian_phone,
    patient_birth_date: r.patient_birth_date,
    patient_gender: r.patient_gender,
  };
}

export function uiDischargeRequestFromRow(r) {
  if (!r) return null;
  const patient = r.patients;
  const pname =
    (typeof patient === 'object' && patient && patient.full_name) || 'Patient';
  return {
    dischargeRequestId: r.id,
    patientId: r.patient_id,
    id: r.patient_id,
    name: pname,
    requestTime: r.created_at
      ? new Date(r.created_at).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '',
    family_id: r.family_id,
    familyNumber: r.guardian_phone,
    familyEmail: r.guardian_email,
    patientNumber: r.guardian_phone,
    dischargeReasonCategory: r.reason_category,
    dischargeReasonDetails: r.reason_details,
    preferredDischargeDate: r.preferred_discharge_date,
    pickupAuthorized: r.pickup_authorized,
    followUpPhone: r.follow_up_phone,
    dischargeOtherInfo: r.other_info,
  };
}
