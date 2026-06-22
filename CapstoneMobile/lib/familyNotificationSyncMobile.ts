import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, isSupabaseConfigured } from "./supabase";
import { appendFamilyNotificationsIfNewMobile } from "./familyNotificationsMobile";
import { normalizeVisitationStatus } from "./visitationAppointmentsMobile";

const LEGACY_ENTITY_STATE_KEY = "bh_family_notif_entity_state_v1";
const ENTITY_STATE_PREFIX = "bh_family_notif_entity_state_v2:";
const PROGRESS_STEP = 5;

type EntityState = {
  admission: Record<string, string>;
  discharge: Record<string, string>;
  visit: Record<string, string>;
  progress: Record<string, number>;
  bootstrapped: boolean;
};

function entityStateKey(userId: string): string | null {
  const id = String(userId || "").trim();
  if (!id) return null;
  return `${ENTITY_STATE_PREFIX}${id}`;
}

async function readState(userId: string): Promise<EntityState> {
  const key = entityStateKey(userId);
  if (!key) return { admission: {}, discharge: {}, visit: {}, progress: {}, bootstrapped: false };
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return { admission: {}, discharge: {}, visit: {}, progress: {}, bootstrapped: false };
    const o = JSON.parse(raw) as Record<string, unknown>;
    return {
      admission: o.admission && typeof o.admission === "object" ? (o.admission as Record<string, string>) : {},
      discharge: o.discharge && typeof o.discharge === "object" ? (o.discharge as Record<string, string>) : {},
      visit: o.visit && typeof o.visit === "object" ? (o.visit as Record<string, string>) : {},
      progress: o.progress && typeof o.progress === "object" ? (o.progress as Record<string, number>) : {},
      bootstrapped: Boolean(o.bootstrapped),
    };
  } catch {
    return { admission: {}, discharge: {}, visit: {}, progress: {}, bootstrapped: false };
  }
}

async function writeState(userId: string, s: EntityState): Promise<void> {
  const key = entityStateKey(userId);
  if (!key) return;
  try {
    await AsyncStorage.setItem(
      key,
      JSON.stringify({
        admission: s.admission,
        discharge: s.discharge,
        visit: s.visit,
        progress: s.progress,
        bootstrapped: true,
      })
    );
  } catch {
    /* ignore */
  }
}

function normStatus(s: unknown): string {
  return String(s || "")
    .trim()
    .toLowerCase();
}

function admissionSignature(row: { status?: unknown; decided_at?: unknown; updated_at?: unknown; created_at?: unknown }) {
  return [normStatus(row.status), String(row.decided_at || row.updated_at || row.created_at || "")].join("|");
}

function dischargeSignature(row: { status?: unknown; updated_at?: unknown; created_at?: unknown }) {
  return [normStatus(row.status), String(row.updated_at || row.created_at || "")].join("|");
}

function visitSignature(row: {
  status?: unknown;
  confirmed_date?: unknown;
  confirmed_time?: unknown;
  updated_at?: unknown;
  created_at?: unknown;
}) {
  const st = normalizeVisitationStatus(row.status);
  return [st, String(row.confirmed_date || ""), String(row.confirmed_time || ""), String(row.updated_at || row.created_at || "")].join(
    "|"
  );
}

function describeAdmission(name: unknown, status: unknown, row?: Record<string, unknown>): string {
  const st = normStatus(status);
  const who = name ? ` for ${name}` : "";
  if (st === "approved" || st === "accepted") return `Admission request${who}: accepted by the facility.`;
  if (st === "declined" || st === "rejected") return `Admission request${who}: rejected by the facility.`;
  if (st === "in_review") {
    const notes = String(row?.required_document_notes || "").trim();
    return notes
      ? `Admission request${who}: in review — please upload required documents (${notes}).`
      : `Admission request${who}: in review — please complete required documents.`;
  }
  if (st === "processing" || st === "pending") {
    if (row?.meeting_date) {
      const when = [row.meeting_date, row.meeting_time].filter(Boolean).join(" at ");
      return `Admission request${who}: meeting scheduled with Bridges of Hope on ${when}.`;
    }
    return `Admission request${who}: received and is being processed.`;
  }
  return `Admission request${who}: status updated to ${String(status || "Updated").trim()}.`;
}

function describeDischarge(name: string, status: unknown): string {
  const st = normStatus(status);
  const who = name ? ` for ${name}` : "";
  if (st === "approved") return `Discharge request${who}: approved by the facility.`;
  if (st === "declined" || st === "rejected") return `Discharge request${who}: declined by the facility.`;
  if (st === "pending") return `Discharge request${who}: received and pending admin review.`;
  return `Discharge request${who}: status updated to ${String(status || "Updated").trim()}.`;
}

function describeVisit(row: {
  patient_name?: unknown;
  status?: unknown;
  confirmed_date?: unknown;
  confirmed_time?: unknown;
}): string {
  const st = normalizeVisitationStatus(row.status);
  const who = row.patient_name ? ` (${row.patient_name})` : "";
  if (st === "Approved")
    return `Visitation appointment${who}: approved${row.confirmed_date ? ` — ${row.confirmed_date}${row.confirmed_time ? ` at ${row.confirmed_time}` : ""}` : "."}`;
  if (st === "Declined") return `Visitation appointment${who}: declined by the facility.`;
  if (st === "Rescheduled")
    return `Visitation appointment${who}: rescheduled${row.confirmed_date ? ` to ${row.confirmed_date}${row.confirmed_time ? ` at ${row.confirmed_time}` : ""}` : "."}`;
  if (st === "Requested") return `Visitation request${who}: submitted and awaiting admin response.`;
  return `Visitation appointment${who}: updated (${st}).`;
}

export async function runFamilyNotificationSyncMobile(userId?: string | null): Promise<void> {
  if (!isSupabaseConfigured()) return;
  let uid = userId ?? null;
  if (!uid) {
    const { data: auth } = await supabase.auth.getUser();
    uid = auth?.user?.id ?? null;
  }
  if (!uid) return;

  try {
    await AsyncStorage.removeItem(LEGACY_ENTITY_STATE_KEY);
  } catch {
    /* ignore */
  }

  const [{ data: admRows, error: admErr }, { data: disRows, error: disErr }, { data: visRows, error: visErr }, { data: patRows, error: patErr }] =
    await Promise.all([
      supabase.from("admission_requests").select("*").eq("family_id", uid).order("created_at", { ascending: false }).limit(200),
      supabase.from("discharge_requests").select("*").eq("family_id", uid).order("created_at", { ascending: false }).limit(200),
      supabase.from("visitation_requests").select("*").eq("family_id", uid).order("created_at", { ascending: false }).limit(200),
      supabase
        .from("patients")
        .select("id, full_name, progress_percent, clinical_status, discharged_at")
        .eq("family_id", uid)
        .limit(200),
    ]);

  if (admErr) console.warn("[familyNotificationSyncMobile] admission_requests", admErr.message);
  if (disErr) console.warn("[familyNotificationSyncMobile] discharge_requests", disErr.message);
  if (visErr) console.warn("[familyNotificationSyncMobile] visitation_requests", visErr.message);
  if (patErr) console.warn("[familyNotificationSyncMobile] patients", patErr.message);

  const state = await readState(uid);
  const next: EntityState = {
    admission: { ...state.admission },
    discharge: { ...state.discharge },
    visit: { ...state.visit },
    progress: { ...state.progress },
    bootstrapped: true,
  };
  const toAdd: { id: string; text: string }[] = [];
  const bootstrap = !state.bootstrapped;

  const pushAdmission = (row: {
    id?: unknown;
    patient_name?: unknown;
    status?: unknown;
    decided_at?: unknown;
    updated_at?: unknown;
    created_at?: unknown;
  }) => {
    const id = String(row.id || "");
    if (!id) return;
    const sig = admissionSignature(row);
    const prev = next.admission[id];
    if (bootstrap) {
      next.admission[id] = sig;
      return;
    }
    if (prev === undefined) {
      toAdd.push({ id: `auto-admission-${id}-${sig}`, text: describeAdmission(row.patient_name, row.status, row as Record<string, unknown>) });
    } else if (prev !== sig) {
      toAdd.push({ id: `auto-admission-${id}-${sig}`, text: describeAdmission(row.patient_name, row.status, row as Record<string, unknown>) });
    }
    next.admission[id] = sig;
  };

  const pushDischarge = (row: {
    id?: unknown;
    patient_name?: string;
    status?: unknown;
    updated_at?: unknown;
    created_at?: unknown;
  }) => {
    const id = String(row.id || "");
    if (!id) return;
    const sig = dischargeSignature(row);
    const pname = String(row.patient_name || "").trim();
    const prev = next.discharge[id];
    if (bootstrap) {
      next.discharge[id] = sig;
      return;
    }
    if (prev === undefined) {
      toAdd.push({ id: `auto-discharge-${id}-${sig}`, text: describeDischarge(pname, row.status) });
    } else if (prev !== sig) {
      toAdd.push({ id: `auto-discharge-${id}-${sig}`, text: describeDischarge(pname, row.status) });
    }
    next.discharge[id] = sig;
  };

  const pushVisit = (row: {
    id?: unknown;
    patient_name?: unknown;
    status?: unknown;
    confirmed_date?: unknown;
    confirmed_time?: unknown;
    updated_at?: unknown;
    created_at?: unknown;
  }) => {
    const id = String(row.id || "");
    if (!id) return;
    const sig = visitSignature(row);
    const prev = next.visit[id];
    if (bootstrap) {
      next.visit[id] = sig;
      return;
    }
    const visitIdSuffix = String(sig).replace(/\W+/g, "-").slice(0, 64);
    if (prev === undefined) {
      toAdd.push({ id: `auto-visit-${id}-${visitIdSuffix}`, text: describeVisit(row) });
    } else if (prev !== sig) {
      toAdd.push({ id: `auto-visit-${id}-${visitIdSuffix}`, text: describeVisit(row) });
    }
    next.visit[id] = sig;
  };

  const pushProgress = (row: {
    id?: unknown;
    full_name?: unknown;
    progress_percent?: unknown;
    clinical_status?: unknown;
  }) => {
    const pid = String(row.id || "");
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
      const name = (row.full_name as string) || "Resident";
      toAdd.push({
        id: `auto-progress-${pid}-${pct}`,
        text: `${name}'s recovery progress is now ${pct}% (clinical: ${String(row.clinical_status || "—")}).`,
      });
      next.progress[pid] = pct;
    }
  };

  const patById = new Map<string, string>(
    (patRows || [])
      .map((p) => [String(p.id), String(p.full_name || "").trim()] as const)
      .filter((entry): entry is readonly [string, string] => Boolean(entry[0]) && Boolean(entry[1]))
  );

  (admRows || []).forEach((row) => pushAdmission(row));
  (disRows || []).forEach((row) => {
    const pname = patById.get(String(row.patient_id || "")) || String(row.patient_name || "").trim();
    pushDischarge({ ...row, patient_name: pname });
  });
  (visRows || []).forEach((row) => pushVisit(row));
  (patRows || []).filter((r) => !r.discharged_at).forEach((row) => pushProgress(row));

  await writeState(uid, next);
  if (toAdd.length) await appendFamilyNotificationsIfNewMobile(toAdd, uid);
}
