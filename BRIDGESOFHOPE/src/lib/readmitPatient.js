import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { appendActivityFeed } from '@/lib/activityFeed';
import { refreshAppData } from '@/lib/appDataRefresh';
import {
  patchWorkflowOverride,
  pushActivity,
  updateDischargeRecord,
} from '@/lib/admissionDischargeStore';

/** Discharge row can re-admit when a resident is linked and has completed discharge (or history from DB). */
export function isDischargeRowReadmitEligible(row) {
  if (!row?.patientId) return false;
  if (row.source === 'history') return true;
  return ['Completed', 'Discharged', 'Archived'].includes(String(row.finalStatus || ''));
}

function patchLocalPatients(patientId, nowIso) {
  try {
    const raw = localStorage.getItem('bh_patients');
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return;
    let changed = false;
    const next = list.map((p) => {
      if (String(p.id) !== String(patientId)) return p;
      changed = true;
      return {
        ...p,
        status: 'Stable',
        clinicalStatus: 'Stable',
        dischargedAt: null,
        discharged_at: null,
        admissionDate: nowIso,
        admitted_at: nowIso,
      };
    });
    if (changed) {
      localStorage.setItem('bh_patients', JSON.stringify(next));
    }
  } catch {
    /* ignore */
  }
}

/**
 * Re-admit a discharged resident: clear discharged_at, set new admitted_at, archive discharge workflow row.
 */
export async function readmitPatientFromDischarge(row) {
  const patientId = row?.patientId;
  if (!patientId) {
    return { ok: false, error: 'No resident is linked to this discharge record.' };
  }
  if (!isDischargeRowReadmitEligible(row)) {
    return { ok: false, error: 'Only completed or discharged residents can be re-admitted.' };
  }

  const now = new Date().toISOString();
  const displayName = row.patientName || 'Resident';
  const displayId = row.admissionDisplayId || patientId;

  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('patients')
      .update({
        discharged_at: null,
        admitted_at: now,
        clinical_status: 'Stable',
        temporary_discharge_at: null,
        temporary_discharge_expected_return: null,
        temporary_discharge_until: null,
        temporary_leave_type: null,
      })
      .eq('id', patientId)
      .select('id');

    if (error) {
      return { ok: false, error: error.message || 'Could not update resident record.' };
    }
    if (!data?.length) {
      return {
        ok: false,
        error:
          'Resident record was not updated. Confirm the id exists and your account has staff update permission.',
      };
    }
  }

  patchLocalPatients(patientId, now);

  if (row.id && row.source !== 'history') {
    updateDischargeRecord(row.id, {
      archived: true,
      finalStatus: 'Archived',
      readmittedAt: now,
    });
  }

  if (row.admissionRequestId) {
    patchWorkflowOverride(row.admissionRequestId, {
      workflowStatus: 'Ongoing',
      archived: false,
    });
  }

  pushActivity(`Resident ${displayName} (${displayId}): re-admitted to active care`);
  try {
    await appendActivityFeed(`Re-admission: ${displayName} is active in care again.`, {});
  } catch {
    /* optional */
  }

  refreshAppData();
  return { ok: true };
}
