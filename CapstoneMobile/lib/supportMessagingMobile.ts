import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, isSupabaseConfigured } from "./supabase";

const LOCAL_KEY = "bh_support_messages_v1";

const WELCOME_TEXT =
  "Hello! How can we help you today? Reach out anytime — our care team will respond here.";

type MessagingListener = () => void;
const messagingListeners = new Set<MessagingListener>();

export function notifyMessagingChangedMobile() {
  messagingListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

function addMessagingListener(fn: MessagingListener): () => void {
  messagingListeners.add(fn);
  return () => messagingListeners.delete(fn);
}

export type SupportUiMessage = {
  id: string;
  text: string;
  sender: "user" | "staff";
  time: string;
  createdAt: string | null;
};

export function supportWelcomeMessage(): SupportUiMessage {
  return {
    id: "welcome",
    text: WELCOME_TEXT,
    sender: "staff",
    time: "",
    createdAt: null,
  };
}

function rowToUi(row: Record<string, unknown>): SupportUiMessage {
  const createdAt = (row.created_at as string) || null;
  let time = "";
  try {
    if (createdAt) {
      time = new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
  } catch {
    /* ignore */
  }
  return {
    id: String(row.id),
    text: String(row.body || ""),
    sender: row.sender_role === "family" ? "user" : "staff",
    time,
    createdAt,
  };
}

async function readLocalStore(): Promise<Record<string, unknown>[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function writeLocalStore(rows: Record<string, unknown>[]): Promise<void> {
  await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(-500)));
  notifyMessagingChangedMobile();
}

async function localRowsForFamily(familyId: string): Promise<Record<string, unknown>[]> {
  const rows = await readLocalStore();
  return rows
    .filter((r) => String(r.family_id) === String(familyId))
    .sort(
      (a, b) =>
        new Date(String(a.created_at)).getTime() - new Date(String(b.created_at)).getTime()
    );
}

function isMissingTableError(message: string): boolean {
  const m = String(message || "").toLowerCase();
  return (
    m.includes("support_messages") &&
    (m.includes("does not exist") ||
      m.includes("schema cache") ||
      m.includes("could not find the table"))
  );
}

async function ensureFamilyProfile(familyId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured() || !familyId) return { ok: true };
  const { data: existing, error: readErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", familyId)
    .maybeSingle();
  if (readErr) console.warn("[supportMessagingMobile] ensureFamilyProfile read", readErr.message);
  if (existing?.id) return { ok: true };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meta = (user?.user_metadata || {}) as Record<string, unknown>;
  const fullName =
    String(meta.full_name || "").trim() ||
    [meta.first_name, meta.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    "Family User";

  const { error: upsertErr } = await supabase.from("profiles").upsert(
    {
      id: familyId,
      full_name: fullName,
      account_type: "family",
    },
    { onConflict: "id" }
  );
  if (upsertErr) return { ok: false, error: upsertErr.message };
  return { ok: true };
}

export async function fetchFamilyThread(familyId: string): Promise<SupportUiMessage[]> {
  if (!familyId) return [supportWelcomeMessage()];
  if (!isSupabaseConfigured()) {
    const rows = await localRowsForFamily(familyId);
    if (!rows.length) return [supportWelcomeMessage()];
    return rows.map(rowToUi);
  }

  const { data, error } = await supabase
    .from("support_messages")
    .select("*")
    .eq("family_id", familyId)
    .order("created_at", { ascending: true })
    .limit(300);

  if (error) {
    console.warn("[supportMessagingMobile] fetchFamilyThread", error.message);
    if (isMissingTableError(error.message)) {
      const rows = await localRowsForFamily(familyId);
      if (!rows.length) return [supportWelcomeMessage()];
      return rows.map(rowToUi);
    }
    const local = await localRowsForFamily(familyId);
    if (local.length) return local.map(rowToUi);
    return [supportWelcomeMessage()];
  }

  const remote = (data || []).map((r) => rowToUi(r as Record<string, unknown>));
  const localOnly = (await localRowsForFamily(familyId))
    .filter((r) => !remote.some((m) => String(m.id) === String(r.id)))
    .map(rowToUi);
  const merged = [...remote, ...localOnly].sort(
    (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
  );
  if (!merged.length) return [supportWelcomeMessage()];
  return merged;
}

export async function sendFamilyMessage(
  familyId: string,
  body: string
): Promise<{ message?: SupportUiMessage; error?: string }> {
  const text = String(body || "").trim();
  if (!text || !familyId) return { error: "Missing message or user." };
  const createdAt = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    const row = {
      id: `local-${Date.now()}`,
      family_id: familyId,
      sender_role: "family",
      body: text,
      created_at: createdAt,
      read_by_family_at: createdAt,
      read_by_admin_at: null,
    };
    const all = await readLocalStore();
    await writeLocalStore([...all, row]);
    return { message: rowToUi(row) };
  }

  const profileCheck = await ensureFamilyProfile(familyId);
  if (!profileCheck.ok) {
    console.warn("[supportMessagingMobile] profile", profileCheck.error);
  }

  const { data, error } = await supabase
    .from("support_messages")
    .insert({
      family_id: familyId,
      sender_role: "family",
      body: text,
      read_by_family_at: createdAt,
    })
    .select("*");

  if (error) {
    console.warn("[supportMessagingMobile] sendFamilyMessage", error.message);
    if (isMissingTableError(error.message)) {
      const row = {
        id: `local-${Date.now()}`,
        family_id: familyId,
        sender_role: "family",
        body: text,
        created_at: createdAt,
        read_by_family_at: createdAt,
        read_by_admin_at: null,
      };
      const all = await readLocalStore();
      await writeLocalStore([...all, row]);
      return { message: rowToUi(row) };
    }
    return { error: error.message || "Could not send message." };
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    return {
      error:
        "Message may not have saved. Run the support_messages migration on Supabase, or check RLS policies.",
    };
  }
  notifyMessagingChangedMobile();
  return { message: rowToUi(row as Record<string, unknown>) };
}

export async function markThreadReadByFamily(familyId: string): Promise<void> {
  if (!familyId) return;
  const now = new Date().toISOString();
  if (!isSupabaseConfigured()) {
    const all = await readLocalStore();
    const next = all.map((r) =>
      String(r.family_id) === String(familyId) &&
      r.sender_role === "admin" &&
      !r.read_by_family_at
        ? { ...r, read_by_family_at: now }
        : r
    );
    await writeLocalStore(next);
    return;
  }
  await supabase
    .from("support_messages")
    .update({ read_by_family_at: now })
    .eq("family_id", familyId)
    .eq("sender_role", "admin")
    .is("read_by_family_at", null);
  notifyMessagingChangedMobile();
}

/** Unread admin replies for family badge (FAB / Messages inbox). */
export async function fetchFamilyUnreadAdminCount(familyId: string): Promise<number> {
  if (!familyId) return 0;
  if (!isSupabaseConfigured()) {
    const rows = await readLocalStore();
    return rows.filter(
      (r) =>
        String(r.family_id) === String(familyId) &&
        r.sender_role === "admin" &&
        !r.read_by_family_at
    ).length;
  }
  const { data, error } = await supabase
    .from("support_messages")
    .select("id")
    .eq("family_id", familyId)
    .eq("sender_role", "admin")
    .is("read_by_family_at", null);
  if (error) {
    console.warn("[supportMessagingMobile] fetchFamilyUnreadAdminCount", error.message);
    return 0;
  }
  return (data || []).length;
}

export function subscribeAdminInbox(onChange: () => void): () => void {
  const offLocal = addMessagingListener(onChange);
  if (!isSupabaseConfigured()) return offLocal;
  const channel = supabase
    .channel("support_messages:admin_inbox_mobile")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "support_messages" },
      () => onChange()
    )
    .subscribe();
  return () => {
    offLocal();
    supabase.removeChannel(channel);
  };
}

export function subscribeSupportMessages(
  familyId: string,
  onChange: () => void
): () => void {
  if (!familyId) return () => {};
  const offLocal = addMessagingListener(onChange);

  if (!isSupabaseConfigured()) {
    return offLocal;
  }

  const channel = supabase
    .channel(`support_messages:${familyId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "support_messages",
        filter: `family_id=eq.${familyId}`,
      },
      () => onChange()
    )
    .subscribe();

  return () => {
    offLocal();
    supabase.removeChannel(channel);
  };
}
