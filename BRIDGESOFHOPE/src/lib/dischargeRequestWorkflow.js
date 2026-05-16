import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { appendActivityFeed } from '@/lib/activityFeed';
import { refreshAppData } from '@/lib/appDataRefresh';

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

export async function approveFamilyDischargeRequest(req, note) {
  const trimmedNote = String(note || '').trim();
  if (!trimmedNote) return { ok: false, error: 'Decision note is required.' };
  if (!req?.dischargeRequestId || !req?.patientId) {
    return { ok: false, error: 'Missing discharge or patient id.' };
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

  const { data: dischargeUpdated, error: upReqErr } = await supabase
    .from('discharge_requests')
    .update({ status: 'approved', decided_at: decidedAt, decided_by: decidedBy })
    .eq('id', req.dischargeRequestId)
    .eq('status', 'pending')
    .select('id');
  if (upReqErr) return { ok: false, error: upReqErr.message || 'Could not approve discharge request.' };
  if (!dischargeUpdated?.length) {
    return { ok: false, error: 'No pending discharge request was updated. It may have already been processed.' };
  }

  const { data: patUpdated, error: upPatErr } = await supabase
    .from('patients')
    .update({ discharged_at: decidedAt, clinical_status: 'Stable' })
    .eq('id', req.patientId)
    .select('id');
  if (upPatErr) return { ok: false, error: upPatErr.message || 'Could not update resident discharge.' };
  if (!patUpdated?.length) {
    return { ok: false, error: 'Resident record was not updated.' };
  }

  await appendActivityFeed(
    `Discharge approved: ${req.name || 'Resident'} has been discharged. Note: ${trimmedNote}`,
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
  const { error } = await supabase
    .from('discharge_requests')
    .update({ status: 'declined', decided_at: decidedAt, decided_by: decidedBy })
    .eq('id', req.dischargeRequestId)
    .eq('status', 'pending');
  if (error) return { ok: false, error: error.message || 'Could not decline discharge request.' };

  await appendActivityFeed(
    `Discharge request for ${req.name || 'Resident'} was declined. Note: ${trimmedNote}`,
    { familyId: req.family_id }
  );
  refreshAppData();
  return { ok: true };
}
