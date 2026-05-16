export const DISCHARGE_TYPE_TEMPORARY = 'temporary';
export const DISCHARGE_TYPE_PERMANENT = 'permanent';

export const FAMILY_DISCHARGE_TYPE = DISCHARGE_TYPE_TEMPORARY;

export const FAMILY_TEMPORARY_REASON_CATEGORIES = [
  'Family visit or event',
  'Medical appointment (outside facility)',
  'Family emergency',
  'Other',
];

export function isTemporaryDischargeRequest(req) {
  const t = String(req?.dischargeType ?? req?.discharge_type ?? '').toLowerCase();
  return !t || t === DISCHARGE_TYPE_TEMPORARY;
}

export function dischargeTypeLabel(type) {
  const t = String(type || '').toLowerCase();
  if (!t || t === DISCHARGE_TYPE_TEMPORARY) return 'Temporary';
  return 'Permanent';
}

/** Program staff selects leave duration when approving temporary discharge. */
export const TEMPORARY_LEAVE_OPTIONS = [
  { id: 'day_pass_8h', label: 'Day pass (8 hours)', hours: 8 },
  { id: 'day_off_24h', label: 'Day off 24 Hours', hours: 24 },
  { id: 'day_off_3d', label: 'Day off 3 Days', hours: 72 },
];

export function temporaryLeaveLabel(leaveTypeId) {
  return TEMPORARY_LEAVE_OPTIONS.find((o) => o.id === leaveTypeId)?.label || leaveTypeId || '';
}

/** Merge snake_case DB row fields onto a UI patient object for temporary-leave checks. */
export function mergePatientTemporaryDischargeFields(patient, dbRow = null) {
  if (!patient) return patient;
  const src = dbRow && typeof dbRow === 'object' ? dbRow : {};
  return {
    ...patient,
    familyId: patient.familyId ?? patient.family_id ?? src.family_id ?? null,
    dischargedAt: patient.dischargedAt ?? patient.discharged_at ?? src.discharged_at ?? null,
    temporaryDischargeAt:
      patient.temporaryDischargeAt ?? patient.temporary_discharge_at ?? src.temporary_discharge_at ?? null,
    temporaryDischargeUntil:
      patient.temporaryDischargeUntil ?? patient.temporary_discharge_until ?? src.temporary_discharge_until ?? null,
    temporaryDischargeExpectedReturn:
      patient.temporaryDischargeExpectedReturn
      ?? patient.temporary_discharge_expected_return
      ?? src.temporary_discharge_expected_return
      ?? null,
    temporaryLeaveType:
      patient.temporaryLeaveType ?? patient.temporary_leave_type ?? src.temporary_leave_type ?? null,
  };
}

export function isPatientOnTemporaryLeave(patient) {
  if (!patient) return false;
  if (patient.status === 'Discharged' || patient.dischargedAt || patient.discharged_at) return false;
  const at = patient.temporaryDischargeAt ?? patient.temporary_discharge_at;
  return at != null && String(at).trim() !== '';
}

export function patientTemporaryDischargeStatusLabel(patient) {
  if (!isPatientOnTemporaryLeave(patient)) return null;
  const leave = temporaryLeaveLabel(patient.temporaryLeaveType ?? patient.temporary_leave_type);
  return leave ? `Temporarily discharged · ${leave}` : 'Temporarily discharged';
}

export function computeTemporaryLeaveUntil(leaveTypeId, startIso = new Date().toISOString()) {
  const opt = TEMPORARY_LEAVE_OPTIONS.find((o) => o.id === leaveTypeId);
  if (!opt) return null;
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + opt.hours * 60 * 60 * 1000).toISOString();
}
