import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, isSupabaseConfigured } from "./supabase";
import { appendFamilyNotificationsIfNewMobile } from "./familyNotificationsMobile";

const LEGACY_ENTITY_STATE_KEY = "bh_family_notif_entity_state_v1";
const ENTITY_STATE_PREFIX = "bh_family_notif_entity_state_v2:";
const PROGRESS_STEP = 5;

// Admission and visitation notifications are now real, admin-editable-template rows
// in `family_notifications` (see lib/familyNotificationsDb.ts + useFamilyNotificationsInbox),
// inserted directly by admin/staff actions on the web side. This sync only still owns
// discharge + progress, which have no other producer.
type EntityState = {
  discharge: Record<string, string>;
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
  if (!key) return { discharge: {}, progress: {}, bootstrapped: false };
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return { discharge: {}, progress: {}, bootstrapped: false };
    const o = JSON.parse(raw) as Record<string, unknown>;
    return {
      discharge: o.discharge && typeof o.discharge === "object" ? (o.discharge as Record<string, string>) : {},
      progress: o.progress && typeof o.progress === "object" ? (o.progress as Record<string, number>) : {},
      bootstrapped: Boolean(o.bootstrapped),
    };
  } catch {
    return { discharge: {}, progress: {}, bootstrapped: false };
  }
}

async function writeState(userId: string, s: EntityState): Promise<void> {
  const key = entityStateKey(userId);
  if (!key) return;
  try {
    await AsyncStorage.setItem(
      key,
      JSON.stringify({
        discharge: s.discharge,
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

function dischargeSignature(row: { status?: unknown; updated_at?: unknown; created_at?: unknown }) {
  return [normStatus(row.status), String(row.updated_at || row.created_at || "")].join("|");
}

function describeDischarge(name: string, status: unknown): string {
  const st = normStatus(status);
  const who = name ? ` for ${name}` : "";
  if (st === "approved") return `Discharge request${who}: approved by the facility.`;
  if (st === "declined" || st === "rejected") return `Discharge request${who}: declined by the facility.`;
  if (st === "pending") return `Discharge request${who}: received and pending admin review.`;
  return `Discharge request${who}: status updated to ${String(status || "Updated").trim()}.`;
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

  const [{ data: disRows, error: disErr }, { data: patRows, error: patErr }] = await Promise.all([
    supabase.from("discharge_requests").select("*").eq("family_id", uid).order("created_at", { ascending: false }).limit(200),
    supabase
      .from("patients")
      .select("id, full_name, progress_percent, clinical_status, discharged_at")
      .eq("family_id", uid)
      .limit(200),
  ]);

  if (disErr) console.warn("[familyNotificationSyncMobile] discharge_requests", disErr.message);
  if (patErr) console.warn("[familyNotificationSyncMobile] patients", patErr.message);

  const state = await readState(uid);
  const next: EntityState = {
    discharge: { ...state.discharge },
    progress: { ...state.progress },
    bootstrapped: true,
  };
  const toAdd: { id: string; text: string }[] = [];
  const bootstrap = !state.bootstrapped;

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

  (disRows || []).forEach((row) => {
    const pname = patById.get(String(row.patient_id || "")) || String(row.patient_name || "").trim();
    pushDischarge({ ...row, patient_name: pname });
  });
  (patRows || []).filter((r) => !r.discharged_at).forEach((row) => pushProgress(row));

  await writeState(uid, next);
  if (toAdd.length) await appendFamilyNotificationsIfNewMobile(toAdd, uid);
}
