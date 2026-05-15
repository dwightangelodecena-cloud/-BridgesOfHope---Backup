import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const LOCAL_KEY = 'bh_support_messages_v1';
const ADMIN_READ_THREADS_KEY = 'bh_support_admin_read_threads_v1';
export const SUPPORT_MESSAGES_CHANGED = 'bh_support_messages_changed';

const WELCOME_TEXT =
  'Hello! How can we help you today? Reach out anytime — our care team will respond here.';

function notifyMessagingChanged() {
  try {
    window.dispatchEvent(new CustomEvent(SUPPORT_MESSAGES_CHANGED));
    window.dispatchEvent(new Event('storage'));
  } catch {
    /* ignore */
  }
}

export function supportWelcomeMessage() {
  return {
    id: 'welcome',
    text: WELCOME_TEXT,
    sender: 'staff',
    time: '',
    createdAt: null,
    persisted: false,
  };
}

function rowToUi(row) {
  const createdAt = row.created_at || null;
  let time = '';
  try {
    if (createdAt) {
      time = new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  } catch {
    /* ignore */
  }
  return {
    id: row.id,
    text: row.body,
    sender: row.sender_role === 'family' ? 'user' : 'staff',
    time,
    createdAt,
    senderRole: row.sender_role,
    familyId: row.family_id,
    readByFamilyAt: row.read_by_family_at,
    readByAdminAt: row.read_by_admin_at,
  };
}

function readLocalStore() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeLocalStore(rows, { notify = true } = {}) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(-500)));
  if (notify) notifyMessagingChanged();
}

function readAdminReadThreadMap() {
  try {
    const raw = localStorage.getItem(ADMIN_READ_THREADS_KEY);
    const o = raw ? JSON.parse(raw) : {};
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

function markAdminReadThreadLocal(familyId) {
  const fid = String(familyId);
  const map = readAdminReadThreadMap();
  map[fid] = new Date().toISOString();
  localStorage.setItem(ADMIN_READ_THREADS_KEY, JSON.stringify(map));
}

/** Family message still unread for admin (DB + local fallbacks). */
function isUnreadByAdmin(row) {
  if (!row || row.sender_role !== 'family') return false;
  if (row.read_by_admin_at != null && row.read_by_admin_at !== '') return false;

  const fid = String(row.family_id);
  const localRow = readLocalStore().find((r) => String(r.id) === String(row.id));
  if (localRow?.read_by_admin_at) return false;

  const readAt = readAdminReadThreadMap()[fid];
  if (readAt) {
    const msgMs = new Date(row.created_at || 0).getTime();
    const readMs = new Date(readAt).getTime();
    if (!Number.isNaN(msgMs) && !Number.isNaN(readMs) && msgMs <= readMs) return false;
  }
  return true;
}

function countUnreadForFamily(rows, familyId) {
  const fid = String(familyId);
  return (rows || []).filter((m) => String(m.family_id) === fid && isUnreadByAdmin(m)).length;
}

function localRowsForFamily(familyId) {
  return readLocalStore()
    .filter((r) => String(r.family_id) === String(familyId))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

function isMissingTableError(message) {
  const m = String(message || '').toLowerCase();
  return (
    m.includes('support_messages') &&
    (m.includes('does not exist') || m.includes('schema cache') || m.includes('could not find the table'))
  );
}

function nameFromProfileRow(profile) {
  if (!profile) return '';
  const full = String(profile.full_name || '').trim();
  if (full) return full;
  const composed = [profile.first_name, profile.last_name]
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .join(' ');
  if (composed) return composed;
  const email = String(profile.login_email || profile.email || '').trim();
  if (email.includes('@')) return email.split('@')[0];
  return '';
}

function nameFromLocalFamilyProfile(familyId) {
  try {
    const raw = localStorage.getItem('bh_family_profile');
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    const uid = String(parsed.userId || parsed.id || '');
    if (uid && uid === String(familyId)) {
      return String(parsed.fullName || parsed.full_name || '').trim();
    }
  } catch {
    /* ignore */
  }
  return '';
}

/** @returns {Promise<Map<string, object>>} */
async function fetchProfileMapForFamilyIds(familyIds) {
  const map = new Map();
  const ids = [...new Set((familyIds || []).map((id) => String(id)).filter(Boolean))];
  if (!ids.length) return map;

  if (isSupabaseConfigured()) {
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name, login_email, email, account_type')
        .in('id', chunk);
      if (error) {
        console.warn('[supportMessaging] profile names', error.message);
        continue;
      }
      for (const row of data || []) {
        map.set(String(row.id), row);
      }
    }
  }

  for (const id of ids) {
    if (nameFromProfileRow(map.get(id))) continue;
    const localName = nameFromLocalFamilyProfile(id);
    if (localName) map.set(id, { id, full_name: localName });
  }

  return map;
}

function displayNameForFamilyId(familyId, profileMap) {
  const fromProfile = nameFromProfileRow(profileMap.get(String(familyId)));
  if (fromProfile) return fromProfile;
  return 'Unknown user';
}

function emailForFamilyId(familyId, profileMap) {
  const prof = profileMap.get(String(familyId));
  if (!prof) return '';
  return String(prof.login_email || prof.email || '').trim();
}

/** Ensure profiles row exists so legacy FK constraints do not block inserts. */
async function ensureFamilyProfile(familyId) {
  if (!isSupabaseConfigured() || !familyId) return { ok: true };
  const { data: existing, error: readErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', familyId)
    .maybeSingle();
  if (readErr) {
    console.warn('[supportMessaging] ensureFamilyProfile read', readErr.message);
  }
  if (existing?.id) return { ok: true };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meta = user?.user_metadata || {};
  const fullName =
    meta.full_name ||
    [meta.first_name, meta.last_name].filter(Boolean).join(' ').trim() ||
    'Family User';

  const { error: upsertErr } = await supabase.from('profiles').upsert(
    {
      id: familyId,
      full_name: fullName,
      account_type: 'family',
    },
    { onConflict: 'id' }
  );
  if (upsertErr) {
    return { ok: false, error: upsertErr.message };
  }
  return { ok: true };
}

export async function fetchFamilyThread(familyId) {
  if (!familyId) return [supportWelcomeMessage()];
  if (!isSupabaseConfigured()) {
    const rows = localRowsForFamily(familyId);
    if (!rows.length) return [supportWelcomeMessage()];
    return rows.map(rowToUi);
  }
  const { data, error } = await supabase
    .from('support_messages')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: true })
    .limit(300);
  if (error) {
    console.warn('[supportMessaging] fetchFamilyThread', error.message);
    if (isMissingTableError(error.message)) {
      const rows = localRowsForFamily(familyId);
      if (!rows.length) return [supportWelcomeMessage()];
      return rows.map(rowToUi);
    }
    const local = localRowsForFamily(familyId);
    if (local.length) return local.map(rowToUi);
    return [supportWelcomeMessage()];
  }

  const remote = (data || []).map(rowToUi);
  const localOnly = localRowsForFamily(familyId)
    .filter((r) => !remote.some((m) => String(m.id) === String(r.id)))
    .map(rowToUi);
  const merged = [...remote, ...localOnly].sort(
    (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
  );
  if (!merged.length) return [supportWelcomeMessage()];
  return merged;
}

/**
 * @returns {Promise<{ message?: object, error?: string }>}
 */
export async function sendFamilyMessage(familyId, body) {
  const text = String(body || '').trim();
  if (!text || !familyId) return { error: 'Missing message or user.' };
  const createdAt = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    const row = {
      id: `local-${Date.now()}`,
      family_id: familyId,
      sender_role: 'family',
      body: text,
      created_at: createdAt,
      read_by_family_at: createdAt,
      read_by_admin_at: null,
    };
    writeLocalStore([...readLocalStore(), row]);
    return { message: rowToUi(row) };
  }

  const profileCheck = await ensureFamilyProfile(familyId);
  if (!profileCheck.ok) {
    console.warn('[supportMessaging] profile', profileCheck.error);
  }

  const { data, error } = await supabase
    .from('support_messages')
    .insert({
      family_id: familyId,
      sender_role: 'family',
      body: text,
      read_by_family_at: createdAt,
    })
    .select('*');

  if (error) {
    console.warn('[supportMessaging] sendFamilyMessage', error.message);
    if (isMissingTableError(error.message)) {
      const row = {
        id: `local-${Date.now()}`,
        family_id: familyId,
        sender_role: 'family',
        body: text,
        created_at: createdAt,
        read_by_family_at: createdAt,
        read_by_admin_at: null,
      };
      writeLocalStore([...readLocalStore(), row]);
      return { message: rowToUi(row) };
    }
    return { error: error.message || 'Could not send message.' };
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    return {
      error:
        'Message may not have saved. Run the support_messages migration on Supabase, or check RLS policies.',
    };
  }
  return { message: rowToUi(row) };
}

/**
 * @returns {Promise<{ message?: object, error?: string }>}
 */
export async function sendAdminMessage(familyId, body) {
  const text = String(body || '').trim();
  if (!text || !familyId) return { error: 'Missing message or family user.' };
  const createdAt = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    const row = {
      id: `local-${Date.now()}`,
      family_id: familyId,
      sender_role: 'admin',
      body: text,
      created_at: createdAt,
      read_by_family_at: null,
      read_by_admin_at: createdAt,
    };
    writeLocalStore([...readLocalStore(), row]);
    return { message: rowToUi(row) };
  }

  await ensureFamilyProfile(familyId);

  const { data, error } = await supabase
    .from('support_messages')
    .insert({
      family_id: familyId,
      sender_role: 'admin',
      body: text,
      read_by_admin_at: createdAt,
    })
    .select('*');

  if (error) {
    console.warn('[supportMessaging] sendAdminMessage', error.message);
    if (isMissingTableError(error.message)) {
      const row = {
        id: `local-${Date.now()}`,
        family_id: familyId,
        sender_role: 'admin',
        body: text,
        created_at: createdAt,
        read_by_family_at: null,
        read_by_admin_at: createdAt,
      };
      writeLocalStore([...readLocalStore(), row]);
      return { message: rowToUi(row) };
    }
    return { error: error.message || 'Could not send message.' };
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return { error: 'Message saved but could not be loaded.' };
  return { message: rowToUi(row) };
}

export async function markThreadReadByFamily(familyId) {
  if (!familyId) return;
  const now = new Date().toISOString();
  if (!isSupabaseConfigured()) {
    const all = readLocalStore().map((r) =>
      String(r.family_id) === String(familyId) && r.sender_role === 'admin' && !r.read_by_family_at
        ? { ...r, read_by_family_at: now }
        : r
    );
    writeLocalStore(all);
    return;
  }
  await supabase
    .from('support_messages')
    .update({ read_by_family_at: now })
    .eq('family_id', familyId)
    .eq('sender_role', 'admin')
    .is('read_by_family_at', null);
}

export async function markThreadReadByAdmin(familyId, { notify = true } = {}) {
  if (!familyId) return;
  const fid = String(familyId);
  const now = new Date().toISOString();

  markAdminReadThreadLocal(fid);

  const all = readLocalStore().map((r) =>
    String(r.family_id) === fid && r.sender_role === 'family' && !r.read_by_admin_at
      ? { ...r, read_by_admin_at: now }
      : r
  );
  writeLocalStore(all, { notify: false });

  if (!isSupabaseConfigured()) {
    if (notify) notifyMessagingChanged();
    return;
  }

  const { error: rpcErr } = await supabase.rpc('bh_mark_support_read_by_admin', {
    p_family_id: fid,
  });
  if (rpcErr) {
    const { error: updErr } = await supabase
      .from('support_messages')
      .update({ read_by_admin_at: now })
      .eq('family_id', fid)
      .eq('sender_role', 'family')
      .is('read_by_admin_at', null);
    if (updErr) {
      console.warn('[supportMessaging] markThreadReadByAdmin', rpcErr.message, updErr.message);
    }
  }
  if (notify) notifyMessagingChanged();
}

/** Total unread family messages for admin sidebar badge. */
export async function fetchAdminUnreadMessageCount() {
  const threads = await fetchAdminInboxThreads();
  return threads.reduce((sum, t) => sum + (t.unreadCount || 0), 0);
}

export async function fetchAdminInboxThreads() {
  if (!isSupabaseConfigured()) {
    return fetchAdminInboxThreadsLocalOnly();
  }

  const { data: msgs, error: msgErr } = await supabase
    .from('support_messages')
    .select('id, family_id, sender_role, body, created_at, read_by_admin_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (msgErr) {
    console.warn('[supportMessaging] inbox messages', msgErr.message);
    if (isMissingTableError(msgErr.message)) {
      return fetchAdminInboxThreadsLocalOnly();
    }
  }

  const mergedById = new Map();
  for (const r of [...(msgs || []), ...readLocalStore()]) {
    const id = String(r.id);
    const prev = mergedById.get(id);
    if (!prev) {
      mergedById.set(id, r);
      continue;
    }
    if (r.read_by_admin_at && !prev.read_by_admin_at) mergedById.set(id, r);
  }
  const allMsgRows = [...mergedById.values()];
  const familyIdsFromMsgs = [...new Set(allMsgRows.map((r) => String(r.family_id)).filter(Boolean))];
  const profileMap = await fetchProfileMapForFamilyIds(familyIdsFromMsgs);
  const byFamily = new Map();

  for (const row of allMsgRows) {
    const fid = String(row.family_id);
    const body = row.body;
    const created = row.created_at;
    const existing = byFamily.get(fid);
    if (!existing || new Date(created) > new Date(existing.lastAt || 0)) {
      const unreadCount = countUnreadForFamily(allMsgRows, fid);
      byFamily.set(fid, {
        familyId: fid,
        fullName: displayNameForFamilyId(fid, profileMap),
        email: emailForFamilyId(fid, profileMap),
        lastMessage: body,
        lastAt: created,
        unreadCount,
      });
    }
  }

  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('id, full_name, first_name, last_name, login_email, email, account_type');
  if (profErr) console.warn('[supportMessaging] inbox profiles', profErr.message);

  const familyProfiles = (profiles || []).filter(
    (p) => String(p.account_type || '').trim().toLowerCase() === 'family'
  );
  for (const p of familyProfiles) {
    const fid = String(p.id);
    profileMap.set(fid, p);
    if (byFamily.has(fid)) {
      const thread = byFamily.get(fid);
      thread.fullName = displayNameForFamilyId(fid, profileMap);
      thread.email = emailForFamilyId(fid, profileMap);
    } else {
      byFamily.set(fid, {
        familyId: fid,
        fullName: displayNameForFamilyId(fid, profileMap),
        email: emailForFamilyId(fid, profileMap),
        lastMessage: '',
        lastAt: '',
        unreadCount: 0,
      });
    }
  }

  return [...byFamily.values()].sort((a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0));
}

async function fetchAdminInboxThreadsLocalOnly() {
  const rows = readLocalStore();
  const familyIds = [...new Set(rows.map((r) => String(r.family_id)).filter(Boolean))];
  const profileMap = await fetchProfileMapForFamilyIds(familyIds);
  const byFamily = new Map();

  for (const row of rows) {
    const fid = String(row.family_id);
    if (!byFamily.has(fid)) {
      byFamily.set(fid, {
        familyId: fid,
        fullName: displayNameForFamilyId(fid, profileMap),
        email: emailForFamilyId(fid, profileMap),
        lastMessage: row.body,
        lastAt: row.created_at,
        unreadCount: countUnreadForFamily(rows, fid),
      });
    } else {
      const cur = byFamily.get(fid);
      if (new Date(row.created_at) > new Date(cur.lastAt || 0)) {
        cur.lastMessage = row.body;
        cur.lastAt = row.created_at;
      }
      cur.unreadCount = countUnreadForFamily(rows, fid);
    }
  }

  return [...byFamily.values()].sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
}

export function subscribeSupportMessages(familyId, onChange) {
  const handler = () => onChange();
  if (!familyId) return () => {};

  window.addEventListener(SUPPORT_MESSAGES_CHANGED, handler);

  if (!isSupabaseConfigured()) {
    return () => window.removeEventListener(SUPPORT_MESSAGES_CHANGED, handler);
  }

  const channel = supabase
    .channel(`support_messages:${familyId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'support_messages',
        filter: `family_id=eq.${familyId}`,
      },
      handler
    )
    .subscribe();

  return () => {
    window.removeEventListener(SUPPORT_MESSAGES_CHANGED, handler);
    supabase.removeChannel(channel);
  };
}

export function subscribeAdminInbox(onChange) {
  const handler = () => onChange();
  window.addEventListener(SUPPORT_MESSAGES_CHANGED, handler);

  if (!isSupabaseConfigured()) {
    return () => window.removeEventListener(SUPPORT_MESSAGES_CHANGED, handler);
  }

  const channel = supabase
    .channel('support_messages:admin_inbox')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, handler)
    .subscribe();

  return () => {
    window.removeEventListener(SUPPORT_MESSAGES_CHANGED, handler);
    supabase.removeChannel(channel);
  };
}
