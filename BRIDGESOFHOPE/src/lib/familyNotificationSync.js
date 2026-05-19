import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { appendFamilyNotificationsIfNew } from '@/lib/familyNotifications';
import { normalizeVisitationStatus } from '@/lib/visitationAppointments';

/** Legacy global key (mixed all users). Removed on first sync so each account uses only per-user state. */
const LEGACY_ENTITY_STATE_KEY = 'bh_family_notif_entity_state_v1';
const ENTITY_STATE_PREFIX = 'bh_family_notif_entity_state_v2:';
const PROGRESS_STEP = 5;

function entityStateKey(userId) {
  const id = userId != null ? String(userId).trim() : '';
  if (!id) return null;
  return `${ENTITY_STATE_PREFIX}${id}`;
}

function readState(userId) {
  const key = entityStateKey(userId);
  if (!key) return { admission: {}, discharge: {}, visit: {}, progress: {}, bootstrapped: false };
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { admission: {}, discharge: {}, visit: {}, progress: {}, bootstrapped: false };
    const o = JSON.parse(raw);
    return {
      admission: o.admission && typeof o.admission === 'object' ? o.admission : {},
      discharge: o.discharge && typeof o.discharge === 'object' ? o.discharge : {},
      visit: o.visit && typeof o.visit === 'object' ? o.visit : {},
      progress: o.progress && typeof o.progress === 'object' ? o.progress : {},
      bootstrapped: Boolean(o.bootstrapped),
    };
  } catch {
    return { admission: {}, discharge: {}, visit: {}, progress: {}, bootstrapped: false };
  }
}

function writeState(userId, s) {
  const key = entityStateKey(userId);
  if (!key) return;
  localStorage.setItem(
    key,
    JSON.stringify({
      admission: s.admission,
      discharge: s.discharge,
      visit: s.visit,
      progress: s.progress,
      bootstrapped: true,
    })
  );
}

function normStatus(s) {
  return String(s || '')
    .trim()
    .toLowerCase();
}

function admissionSignature(row) {
  return [
    normStatus(row.status),
    String(row.decided_at || row.updated_at || row.created_at || ''),
  ].join('|');
}

function dischargeSignature(row) {
  return [normStatus(row.status), String(row.updated_at || row.created_at || '')].join('|');
}

function visitSignature(row) {
  const st = normalizeVisitationStatus(row.status);
  return [
    st,
    String(row.confirmed_date || ''),
    String(row.confirmed_time || ''),
    String(row.updated_at || row.created_at || ''),
  ].join('|');
}

function describeAdmission(name, status) {
  const st = normStatus(status);
  const who = name ? ` for ${name}` : '';
  if (st === 'approved') return `Admission request${who}: approved by the facility.`;
  if (st === 'declined' || st === 'rejected') return `Admission request${who}: declined by the facility.`;
  if (st === 'pending') return `Admission request${who}: received and pending admin review.`;
  return `Admission request${who}: status updated to ${String(status || 'Updated').trim()}.`;
}

function describeDischarge(name, status) {
  const st = normStatus(status);
  const who = name ? ` for ${name}` : '';
  if (st === 'approved') return `Discharge request${who}: approved by the facility.`;
  if (st === 'declined' || st === 'rejected') return `Discharge request${who}: declined by the facility.`;
  if (st === 'pending') return `Discharge request${who}: received and pending admin review.`;
  return `Discharge request${who}: status updated to ${String(status || 'Updated').trim()}.`;
}

function describeVisit(row) {
  const st = normalizeVisitationStatus(row.status);
  const who = row.patient_name ? ` (${row.patient_name})` : '';
  if (st === 'Approved')
    return `Visitation appointment${who}: approved${row.confirmed_date ? ` — ${row.confirmed_date}${row.confirmed_time ? ` at ${row.confirmed_time}` : ''}` : '.'}`;
  if (st === 'Declined') return `Visitation appointment${who}: declined by the facility.`;
  if (st === 'Rescheduled')
    return `Visitation appointment${who}: rescheduled${row.confirmed_date ? ` to ${row.confirmed_date}${row.confirmed_time ? ` at ${row.confirmed_time}` : ''}` : '.'}`;
  if (st === 'Requested') return `Visitation request${who}: submitted and awaiting admin response.`;
  return `Visitation appointment${who}: updated (${st}).`;
}

/**
 * Poll Supabase for this family user and append notifications when admission / discharge /
 * visitation status or resident progress meaningfully changes. First run seeds internal state
 * without flooding historical items.
 */
let syncPromise = null;

export async function runFamilyNotificationSync(userId) {
  if (syncPromise) return syncPromise;
  syncPromise = runFamilyNotificationSyncInner(userId).finally(() => {
    syncPromise = null;
  });
  return syncPromise;
}

async function runFamilyNotificationSyncInner(userId) {
  if (!isSupabaseConfigured()) return;
  let uid = userId;
  if (!uid) {
    const { data: auth } = await supabase.auth.getUser();
    uid = auth?.user?.id;
  }
  if (!uid) return;

  try {
    localStorage.removeItem(LEGACY_ENTITY_STATE_KEY);
  } catch {
    /* ignore */
  }

  const [{ data: admRows, error: admErr }, { data: disRows, error: disErr }, { data: visRows, error: visErr }, { data: patRows, error: patErr }] =
    await Promise.all([
      supabase.from('admission_requests').select('*').eq('family_id', uid).order('created_at', { ascending: false }).limit(200),
      supabase.from('discharge_requests').select('*').eq('family_id', uid).order('created_at', { ascending: false }).limit(200),
      supabase.from('visitation_requests').select('*').eq('family_id', uid).order('created_at', { ascending: false }).limit(200),
      supabase
        .from('patients')
        .select('id, full_name, progress_percent, clinical_status, discharged_at')
        .eq('family_id', uid)
        .limit(200),
    ]);

  if (admErr) console.warn('[familyNotificationSync] admission_requests', admErr.message);
  if (disErr) console.warn('[familyNotificationSync] discharge_requests', disErr.message);
  if (visErr) console.warn('[familyNotificationSync] visitation_requests', visErr.message);
  if (patErr) console.warn('[familyNotificationSync] patients', patErr.message);

  const state = readState(uid);
  const next = {
    admission: { ...state.admission },
    discharge: { ...state.discharge },
    visit: { ...state.visit },
    progress: { ...state.progress },
    bootstrapped: true,
  };
  const toAdd = [];

  const bootstrap = !state.bootstrapped;

  const pushAdmission = (row) => {
    const id = String(row.id || '');
    if (!id) return;
    const sig = admissionSignature(row);
    const prev = next.admission[id];
    if (bootstrap) {
      next.admission[id] = sig;
      return;
    }
    if (prev === undefined) {
      toAdd.push({
        id: `auto-admission-${id}-${sig}`,
        text: describeAdmission(row.patient_name, row.status),
      });
    } else if (prev !== sig) {
      toAdd.push({
        id: `auto-admission-${id}-${sig}`,
        text: describeAdmission(row.patient_name, row.status),
      });
    }
    next.admission[id] = sig;
  };

  const pushDischarge = (row) => {
    const id = String(row.id || '');
    if (!id) return;
    const sig = dischargeSignature(row);
    const pname = String(row.patient_name || '').trim();
    const prev = next.discharge[id];
    if (bootstrap) {
      next.discharge[id] = sig;
      return;
    }
    if (prev === undefined) {
      toAdd.push({
        id: `auto-discharge-${id}-${sig}`,
        text: describeDischarge(pname, row.status),
      });
    } else if (prev !== sig) {
      toAdd.push({
        id: `auto-discharge-${id}-${sig}`,
        text: describeDischarge(pname, row.status),
      });
    }
    next.discharge[id] = sig;
  };

  const pushVisit = (row) => {
    const id = String(row.id || '');
    if (!id) return;
    const sig = visitSignature(row);
    const prev = next.visit[id];
    if (bootstrap) {
      next.visit[id] = sig;
      return;
    }
    const visitIdSuffix = String(sig).replace(/\W+/g, '-').slice(0, 64);
    if (prev === undefined) {
      toAdd.push({
        id: `auto-visit-${id}-${visitIdSuffix}`,
        text: describeVisit(row),
      });
    } else if (prev !== sig) {
      toAdd.push({
        id: `auto-visit-${id}-${visitIdSuffix}`,
        text: describeVisit(row),
      });
    }
    next.visit[id] = sig;
  };

  const pushProgress = (row) => {
    const pid = String(row.id || '');
    if (!pid) return;
    const pct = Math.round(Number(row.progress_percent) || 0);
    const prevRaw = next.progress[pid];
    const prev = prevRaw == null || Number.isNaN(Number(prevRaw)) ? null : Number(prevRaw);
    if (bootstrap) {
      next.progress[pid] = pct;
      return;
    }
    if (prev == null) {
      next.progress[pid] = pct;
      return;
    }
    if (Math.abs(pct - prev) >= PROGRESS_STEP) {
      const name = row.full_name || 'Resident';
      toAdd.push({
        id: `auto-progress-${pid}-${pct}`,
        text: `${name}'s recovery progress is now ${pct}% (clinical: ${String(row.clinical_status || '—')}).`,
      });
      next.progress[pid] = pct;
    }
  };

  const patById = new Map(
    (patRows || []).map((p) => [String(p.id), String(p.full_name || '').trim()]).filter(([, n]) => n)
  );

  (admRows || []).forEach(pushAdmission);
  (disRows || []).forEach((row) => {
    const pname = patById.get(String(row.patient_id || '')) || String(row.patient_name || '').trim();
    pushDischarge({ ...row, patient_name: pname });
  });
  (visRows || []).forEach(pushVisit);
  (patRows || []).filter((r) => !r.discharged_at).forEach(pushProgress);

  writeState(uid, next);
  if (toAdd.length) appendFamilyNotificationsIfNew(toAdd, uid);
}
