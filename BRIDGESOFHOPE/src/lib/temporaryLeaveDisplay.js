import { temporaryLeaveLabel, TEMPORARY_LEAVE_OPTIONS } from '@/lib/dischargeRequestTypes';

/** Strip internal leave-type suffix appended on approval. */
export function parseProgramDecisionNote(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  return s.replace(/\n?\[Temporary leave:[^\]]*\]\s*/gi, '').trim();
}

export function temporaryLeaveTotalDays(leaveTypeId, untilIso, startedIso) {
  const id = String(leaveTypeId || '');
  const opt = TEMPORARY_LEAVE_OPTIONS.find((o) => o.id === id);
  if (opt?.id === 'day_off_3d') return 3;
  if (opt?.id === 'day_off_24h') return 1;
  if (opt?.id === 'day_pass_8h') return 1;
  if (untilIso && startedIso) {
    const ms = new Date(untilIso).getTime() - new Date(startedIso).getTime();
    if (ms > 0) return Math.max(1, Math.ceil(ms / 86400000));
  }
  return 1;
}

/** e.g. "Day 0 of 3 days" while on leave. */
export function temporaryLeaveDayLabel(patient) {
  const at = patient?.temporaryDischargeAt ?? patient?.temporary_discharge_at;
  if (!at) return null;
  const leaveType = patient?.temporaryLeaveType ?? patient?.temporary_leave_type;
  const until = patient?.temporaryDischargeUntil ?? patient?.temporary_discharge_until;
  const total = temporaryLeaveTotalDays(leaveType, until, at);
  const start = new Date(at);
  if (Number.isNaN(start.getTime())) return null;
  const elapsed = Math.floor((Date.now() - start.getTime()) / 86400000);
  const day = Math.min(total - 1, Math.max(0, elapsed));
  return `Day ${day} of ${total} day${total === 1 ? '' : 's'}`;
}

export function temporaryLeaveNoteLines(patient, requestFields = null) {
  const merged = { ...(patient || {}), ...(requestFields || {}) };
  const programNote = parseProgramDecisionNote(
    merged.decisionNote ?? merged.decision_note ?? merged.temporaryDischargeDecisionNote
  );
  const familyReason = String(
    merged.reasonDetails ?? merged.reason_details ?? merged.temporaryDischargeReason ?? ''
  ).trim();
  const otherInfo = String(merged.otherInfo ?? merged.other_info ?? '').trim();
  const expectedReturn =
    merged.temporaryDischargeExpectedReturn ?? merged.temporary_discharge_expected_return ?? null;
  const dayLabel = temporaryLeaveDayLabel(merged);
  const leaveLabel = temporaryLeaveLabel(merged.temporaryLeaveType ?? merged.temporary_leave_type);
  return { programNote, familyReason, otherInfo, expectedReturn, dayLabel, leaveLabel };
}
