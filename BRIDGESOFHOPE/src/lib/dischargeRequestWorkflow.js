import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { appendActivityFeed } from '@/lib/activityFeed';
import { refreshAppData } from '@/lib/appDataRefresh';
import {
  computeTemporaryLeaveUntil,
  isPatientOnTemporaryLeave,
  isTemporaryDischargeRequest,
  temporaryLeaveLabel,
} from '@/lib/dischargeRequestTypes';

async function resolveDecidedByUserId() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let decidedBy = user?.id ?? null;
  if (decidedBy) {
    const { data: profileRow } = await supabase.from('profiles').select('id').eq('id', decidedBy).maybeSingle();
    if (!profileRow) decidedBy = null;
  }
  return decidedBy;
}

export async function approveFamilyDischargeRequest(req, note, options = {}) {
  const trimmedNote = String(note || '').trim();
  if (!trimmedNote) return { ok: false, error: 'Decision note is required.' };
  if (!req?.dischargeRequestId || !req?.patientId) {
    return { ok: false, error: 'Missing discharge or patient id.' };
  }
  const temporary = isTemporaryDischargeRequest(req);
  const leaveTypeId = String(options.leaveTypeId || (temporary ? 'day_off_24h' : '')).trim();
  if (temporary && !leaveTypeId) {
    return { ok: false, error: 'Select a temporary leave type (day pass or day off).' };
  }

  if (!isSupabaseConfigured()) {
    try {
      const raw = localStorage.getItem('bh_pending_discharges');
      const arr = raw ? JSON.parse(raw) : [];
      const next = Array.isArray(arr)
        ? arr.filter((r) => String(r.patient_id) !== String(req.patientId))
        : [];
      localStorage.setItem('bh_pending_discharges', JSON.stringify(next));
    } catch {
      /* ignore */
    }
    refreshAppData();
    return { ok: true };
  }

  const decidedAt = new Date().toISOString();
  const decidedBy = await resolveDecidedByUserId();

  const leaveUntilIso = temporary ? computeTemporaryLeaveUntil(leaveTypeId, decidedAt) : null;
  const expectedReturnDate = leaveUntilIso
    ? leaveUntilIso.slice(0, 10)
    : req.preferredDischargeDate && String(req.preferredDischargeDate).trim()
      ? String(req.preferredDischargeDate).trim().slice(0, 10)
      : null;
  const leaveLabel = temporaryLeaveLabel(leaveTypeId);
  const noteWithLeave = temporary && leaveLabel
    ? `${trimmedNote}\n[Temporary leave: ${leaveLabel}]`
    : trimmedNote;

  const { data: dischargeUpdated, error: upReqErr } = await supabase
    .from('discharge_requests')
    .update({
      status: 'approved',
      decided_at: decidedAt,
      decided_by: decidedBy,
      decision_note: noteWithLeave,
      temporary_leave_type: temporary ? leaveTypeId : null,
    })
    .eq('id', req.dischargeRequestId)
    .eq('status', 'pending')
    .select('id');
  if (upReqErr) {
    const fallback = await supabase
      .from('discharge_requests')
      .update({ status: 'approved', decided_at: decidedAt, decided_by: decidedBy })
      .eq('id', req.dischargeRequestId)
      .eq('status', 'pending')
      .select('id');
    if (fallback.error) {
      return { ok: false, error: fallback.error.message || 'Could not approve discharge request.' };
    }
    if (!fallback.data?.length) {
      return { ok: false, error: 'No pending discharge request was updated. It may have already been processed.' };
    }
  } else if (!dischargeUpdated?.length) {
    return { ok: false, error: 'No pending discharge request was updated. It may have already been processed.' };
  }

  if (temporary) {
    const patientPatch = {
      temporary_discharge_at: decidedAt,
      temporary_discharge_expected_return: expectedReturnDate,
      temporary_discharge_until: leaveUntilIso,
      temporary_leave_type: leaveTypeId,
    };
    let { data: patUpdated, error: upPatErr } = await supabase
      .from('patients')
      .update(patientPatch)
      .eq('id', req.patientId)
      .select('id');
    if (upPatErr && /column|schema cache|does not exist|PGRST204/i.test(upPatErr.message)) {
      ({ data: patUpdated, error: upPatErr } = await supabase
        .from('patients')
        .update({ temporary_discharge_at: decidedAt })
        .eq('id', req.patientId)
        .select('id'));
    }
    if (upPatErr) return { ok: false, error: upPatErr.message || 'Could not mark resident temporarily discharged.' };
    if (!patUpdated?.length) {
      return { ok: false, error: 'Resident record was not updated.' };
    }
  } else {
    const { data: patUpdated, error: upPatErr } = await supabase
      .from('patients')
      .update({
        discharged_at: decidedAt,
        clinical_status: 'Stable',
        temporary_discharge_at: null,
        temporary_discharge_expected_return: null,
      })
      .eq('id', req.patientId)
      .select('id');
    if (upPatErr) return { ok: false, error: upPatErr.message || 'Could not update resident discharge.' };
    if (!patUpdated?.length) {
      return { ok: false, error: 'Resident record was not updated.' };
    }
  }

  await appendActivityFeed(
    temporary
      ? `Temporary discharge approved for ${req.name || 'Resident'} (${leaveLabel}). Expected return by ${expectedReturnDate || '—'}. Comments: ${trimmedNote}`
      : `Discharge approved: ${req.name || 'Resident'} has been discharged. Note: ${trimmedNote}`,
    { familyId: req.family_id }
  );
  refreshAppData();
  return { ok: true };
}

export async function declineFamilyDischargeRequest(req, note) {
  const trimmedNote = String(note || '').trim();
  if (!trimmedNote) return { ok: false, error: 'Decision note is required.' };
  if (!req?.dischargeRequestId) return { ok: false, error: 'Missing discharge request id.' };

  if (!isSupabaseConfigured()) {
    try {
      const raw = localStorage.getItem('bh_pending_discharges');
      const arr = raw ? JSON.parse(raw) : [];
      const next = Array.isArray(arr)
        ? arr.filter((r) => String(r.id) !== String(req.dischargeRequestId) && String(r.patient_id) !== String(req.patientId))
        : [];
      localStorage.setItem('bh_pending_discharges', JSON.stringify(next));
    } catch {
      /* ignore */
    }
    refreshAppData();
    return { ok: true };
  }

  const decidedAt = new Date().toISOString();
  const decidedBy = await resolveDecidedByUserId();
  let { error } = await supabase
    .from('discharge_requests')
    .update({
      status: 'declined',
      decided_at: decidedAt,
      decided_by: decidedBy,
      decision_note: trimmedNote,
    })
    .eq('id', req.dischargeRequestId)
    .eq('status', 'pending');
  if (error && /column|schema cache|does not exist|PGRST204/i.test(error.message)) {
    ({ error } = await supabase
      .from('discharge_requests')
      .update({ status: 'declined', decided_at: decidedAt, decided_by: decidedBy })
      .eq('id', req.dischargeRequestId)
      .eq('status', 'pending'));
  }
  if (error) return { ok: false, error: error.message || 'Could not decline discharge request.' };

  await appendActivityFeed(
    `Discharge request for ${req.name || 'Resident'} was declined. Note: ${trimmedNote}`,
    { familyId: req.family_id }
  );
  refreshAppData();
  return { ok: true };
}

/** Clear temporary leave — resident is back in the facility. */
export async function returnResidentFromTemporaryLeave(patient) {
  const patientId = patient?.id;
  if (!patientId) return { ok: false, error: 'Missing resident id.' };
  if (!isPatientOnTemporaryLeave(patient)) {
    return { ok: false, error: 'This resident is not on temporary discharge.' };
  }

  const displayName = patient.name || patient.full_name || 'Resident';

  if (!isSupabaseConfigured()) {
    refreshAppData();
    return { ok: true };
  }

  const patch = {
    temporary_discharge_at: null,
    temporary_discharge_until: null,
    temporary_discharge_expected_return: null,
    temporary_leave_type: null,
  };
  let { data, error } = await supabase.from('patients').update(patch).eq('id', patientId).select('id');
  if (error && /column|schema cache|does not exist|PGRST204/i.test(error.message)) {
    ({ data, error } = await supabase
      .from('patients')
      .update({ temporary_discharge_at: null })
      .eq('id', patientId)
      .select('id'));
  }
  if (error) return { ok: false, error: error.message || 'Could not update resident record.' };
  if (!data?.length) {
    return { ok: false, error: 'Resident record was not updated.' };
  }

  await appendActivityFeed(`${displayName} has returned to the facility and is no longer on temporary discharge.`, {
    familyId: patient.family_id ?? patient.familyId,
  });
  refreshAppData();
  return { ok: true };
}
