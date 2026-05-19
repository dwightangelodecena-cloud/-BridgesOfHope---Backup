import { supabase } from '@/lib/supabase';

export const RISK_LEVEL_OPTIONS = ['Low', 'Moderate', 'High', 'Highly Suicidal'];
export const BUNK_LEVEL_OPTIONS = ['Bottom', 'Middle', 'Top'];
export const GENDER_OPTIONS = ['Male', 'Female'];

export function isSupabaseUuid(id) {
  return (
    typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  );
}

export function normalizedRoomSegmentFromGender(genderRaw) {
  const g = String(genderRaw || '').trim().toLowerCase();
  if (g === 'male') return 'Male';
  if (g === 'female') return 'Female';
  return '';
}

export function resolveDisplayGender(admissionRow, patientRow) {
  const candidates = [
    admissionRow?.patient_gender,
    admissionRow?.patientGender,
    patientRow?.gender,
    patientRow?.admissionGender,
  ];
  for (const c of candidates) {
    const s = String(c || '').trim();
    if (s && s.toLowerCase() !== 'n/a') return s;
  }
  return '';
}

/** Prefer normalized Male/Female from patient row, then family admission request. */
export function resolveResidentGender(patientRow, admissionRow) {
  const fromPatient = normalizedRoomSegmentFromGender(patientRow?.gender);
  if (fromPatient) return fromPatient;
  const fromAdmission = normalizedRoomSegmentFromGender(
    admissionRow?.patient_gender ?? admissionRow?.patientGender ?? patientRow?.admissionGender
  );
  return fromAdmission || '';
}

/** Progress % is shown only after program staff is assigned or a nurse has documented an update. */
export function displayProgressPercent(row) {
  const programAssigned = Boolean(
    String(row?.case_load_manager || row?.caseLoadManager || '').trim()
    || String(row?.program_staff || row?.programStaff || '').trim()
  );
  const documented = Boolean(
    row?.progress_updated_at
    || row?.progressUpdatedAt
    || row?.progress_updated_by
    || row?.progressUpdatedBy
  );
  if (!programAssigned && !documented) return 0;
  const raw = Number(row?.progress ?? row?.progress_percent ?? 0);
  if (!Number.isFinite(raw)) return 0;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

export function validateBedPlacementPolicy({ genderSegment, riskLevel, bunkLevel }) {
  if (!genderSegment) return 'Resident gender is required before saving room assignment.';
  const risk = String(riskLevel || '').trim();
  const bunk = String(bunkLevel || '').trim();
  if (risk === 'Highly Suicidal' && /^top$/i.test(bunk)) {
    return 'Policy: highly suicidal residents cannot use the top bunk.';
  }
  return null;
}

export function formatRoomAssignmentSummary(patientRow) {
  const code = String(patientRow?.room_code || patientRow?.roomCode || '').trim();
  if (!code) return '—';
  const bunk = String(patientRow?.bunk_level || patientRow?.bunkLevel || '').trim();
  return bunk ? `${code} · ${bunk} bunk` : code;
}

function stripMissingPatientColumns(payload, errorMessage) {
  if (!errorMessage || !/column|schema cache|does not exist|PGRST204/i.test(errorMessage)) {
    return payload;
  }
  const next = { ...payload };
  const optional = [
    'gender',
    'room_code',
    'room_gender_segment',
    'room_placement_note',
    'risk_level',
    'bunk_level',
  ];
  optional.forEach((key) => {
    if (key in next) delete next[key];
  });
  return next;
}

/**
 * Persist gender and/or room fields on patients + admission_requests (when ids provided).
 * @returns {{ ok: true } | { ok: false, errorMessage: string }}
 */
export async function persistResidentPlacement({
  patientId,
  admissionRequestId,
  gender,
  roomCode,
  roomGenderSegment,
  roomPlacementNote,
  riskLevel,
  bunkLevel,
}) {
  const genderNorm = normalizedRoomSegmentFromGender(gender) || String(gender || '').trim();
  const patientPatch = {};
  if (genderNorm) patientPatch.gender = genderNorm;
  if (roomCode !== undefined) patientPatch.room_code = roomCode || null;
  if (roomGenderSegment !== undefined) patientPatch.room_gender_segment = roomGenderSegment || null;
  if (roomPlacementNote !== undefined) patientPatch.room_placement_note = roomPlacementNote || null;
  if (riskLevel !== undefined) patientPatch.risk_level = riskLevel || null;
  if (bunkLevel !== undefined) patientPatch.bunk_level = bunkLevel || null;

  if (patientId && isSupabaseUuid(String(patientId)) && Object.keys(patientPatch).length > 0) {
    let patch = { ...patientPatch };
    let { error } = await supabase.from('patients').update(patch).eq('id', patientId);
    if (error) {
      patch = stripMissingPatientColumns(patch, error.message);
      if (Object.keys(patch).length === 0) {
        return { ok: false, errorMessage: error.message || 'Could not save to residents table.' };
      }
      ({ error } = await supabase.from('patients').update(patch).eq('id', patientId));
    }
    if (error) {
      return { ok: false, errorMessage: error.message || 'Could not save to residents table.' };
    }
  }

  if (admissionRequestId && genderNorm) {
    const { error: admErr } = await supabase
      .from('admission_requests')
      .update({ patient_gender: genderNorm })
      .eq('id', admissionRequestId);
    if (admErr && !/column|schema cache|does not exist|PGRST204/i.test(admErr.message || '')) {
      return { ok: false, errorMessage: admErr.message || 'Could not save gender on admission request.' };
    }
  }

  return { ok: true };
}
