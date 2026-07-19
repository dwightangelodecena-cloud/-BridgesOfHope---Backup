export const DISCHARGE_TYPE_TEMPORARY = 'temporary';

/** Family portal submits temporary leave requests only. */
export const FAMILY_DISCHARGE_TYPE = DISCHARGE_TYPE_TEMPORARY;

export const FAMILY_TEMPORARY_REASON_CATEGORIES = [
  'Family visit or event',
  'Medical appointment (outside facility)',
  'Family emergency',
  'Other',
] as const;

export const TEMPORARY_LEAVE_OPTIONS = [
  { id: 'day_pass_8h', label: 'Day pass (8 hours)', hours: 8 },
  { id: 'day_off_24h', label: 'Day off 24 Hours', hours: 24 },
  { id: 'day_off_3d', label: 'Day off 3 Days', hours: 72 },
];

export function temporaryLeaveLabel(leaveTypeId: unknown): string {
  const id = String(leaveTypeId || '');
  return TEMPORARY_LEAVE_OPTIONS.find((o) => o.id === id)?.label || id || '';
}

export function isTemporaryDischargeRequest(req: { dischargeType?: string; discharge_type?: string } | null) {
  const t = String(req?.dischargeType ?? req?.discharge_type ?? '').toLowerCase();
  return !t || t === DISCHARGE_TYPE_TEMPORARY;
}

export function mergePatientTemporaryDischargeFields<T extends Record<string, unknown>>(
  patient: T | null | undefined,
  dbRow: Record<string, unknown> | null = null
): T | null | undefined {
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
      patient.temporaryDischargeExpectedReturn ??
      patient.temporary_discharge_expected_return ??
      src.temporary_discharge_expected_return ??
      null,
    temporaryLeaveType:
      patient.temporaryLeaveType ?? patient.temporary_leave_type ?? src.temporary_leave_type ?? null,
  } as T;
}

export function isPatientOnTemporaryLeave(patient: Record<string, unknown> | null | undefined): boolean {
  if (!patient) return false;
  if (patient.status === 'Discharged' || patient.dischargedAt || patient.discharged_at) return false;
  const at = patient.temporaryDischargeAt ?? patient.temporary_discharge_at;
  return at != null && String(at).trim() !== '';
}

export function patientTemporaryDischargeStatusLabel(patient: Record<string, unknown> | null | undefined): string | null {
  if (!isPatientOnTemporaryLeave(patient)) return null;
  const leave = temporaryLeaveLabel(patient.temporaryLeaveType ?? patient.temporary_leave_type);
  return leave ? `Temporarily discharged · ${leave}` : 'Temporarily discharged';
}

export function computeTemporaryLeaveUntil(
  leaveTypeId: string,
  startIso: string = new Date().toISOString()
): string | null {
  const opt = TEMPORARY_LEAVE_OPTIONS.find((o) => o.id === leaveTypeId);
  if (!opt) return null;
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + opt.hours * 60 * 60 * 1000).toISOString();
}
