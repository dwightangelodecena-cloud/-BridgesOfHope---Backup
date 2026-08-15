import { supabase } from '@/lib/supabase';
import { isMessagingRecipientProfile } from '@/lib/supportMessaging';

/** Simple {{var}} substitution; missing vars render as empty string, not literal "undefined". */
export function renderNotificationTemplate(template, vars = {}) {
  return String(template || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => (
    vars[key] != null ? String(vars[key]) : ''
  ));
}

let templateCache = null;
let templateCacheAt = 0;
const CACHE_TTL_MS = 60_000;

/**
 * @returns {{ ok: true, templates: object[] } | { ok: false, errorMessage: string }}
 */
export async function fetchNotificationTemplates({ force = false } = {}) {
  if (!force && templateCache && Date.now() - templateCacheAt < CACHE_TTL_MS) {
    return { ok: true, templates: templateCache };
  }
  const { data, error } = await supabase
    .from('notification_templates')
    .select('*')
    .order('template_key', { ascending: true });
  if (error) {
    return { ok: false, errorMessage: error.message || 'Could not load notification templates.' };
  }
  templateCache = data || [];
  templateCacheAt = Date.now();
  return { ok: true, templates: templateCache };
}

export async function updateNotificationTemplate(id, { title, body }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('notification_templates')
    .update({
      title,
      body,
      updated_at: new Date().toISOString(),
      updated_by: user?.id || null,
    })
    .eq('id', id);
  if (error) {
    return { ok: false, errorMessage: error.message || 'Could not save template.' };
  }
  templateCache = null;
  return { ok: true };
}

async function getTemplateByKey(templateKey) {
  const res = await fetchNotificationTemplates();
  if (!res.ok) return null;
  return res.templates.find((t) => t.template_key === templateKey) || null;
}

/** Mirrors the DB backfill in the category migration: derive a category when the caller doesn't pass one. */
function deriveCategory(relatedType) {
  if (relatedType === 'admission_request') return 'admission';
  if (relatedType === 'visitation_request') return 'visitation';
  return 'general';
}

export const SENDABLE_NOTIFICATION_CATEGORIES = [
  { value: 'promo', label: 'Promo' },
  { value: 'clinical', label: 'Clinical Concern' },
  { value: 'progress', label: 'Progress Update' },
  { value: 'general', label: 'General Announcement' },
];

/**
 * Render `templateKey` with `vars` and insert a real, DB-backed notification for the guardian.
 * This is the one call site admin code should use instead of the old (dead) localStorage writer.
 * @returns {{ ok: true } | { ok: false, errorMessage: string }}
 */
export async function insertFamilyNotification({ familyId, templateKey, vars = {}, relatedType, relatedId, category }) {
  if (!familyId) return { ok: false, errorMessage: 'Missing guardian to notify.' };
  const template = await getTemplateByKey(templateKey);
  if (!template) return { ok: false, errorMessage: `Notification template "${templateKey}" not found.` };
  const body = renderNotificationTemplate(template.body, vars);
  const { error } = await supabase.from('family_notifications').insert({
    family_id: familyId,
    template_key: templateKey,
    title: template.title,
    body,
    related_type: relatedType || null,
    related_id: relatedId != null ? String(relatedId) : null,
    category: category || deriveCategory(relatedType),
  });
  if (error) {
    return { ok: false, errorMessage: error.message || 'Could not send notification.' };
  }
  return { ok: true };
}

/** All guardian profiles eligible to receive notifications (same eligibility as messaging: everyone except internal staff). */
export async function fetchNotifiableFamilyProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, first_name, last_name, login_email, account_type')
    .order('full_name', { ascending: true });
  if (error) {
    return { ok: false, errorMessage: error.message || 'Could not load guardians.' };
  }
  return { ok: true, profiles: (data || []).filter(isMessagingRecipientProfile) };
}

/**
 * Ad-hoc (non-template) notification composed directly by staff — promos, clinical concerns,
 * progress updates, or general announcements — sent either to one guardian or to every guardian.
 * @returns {{ ok: true, sent: number } | { ok: false, errorMessage: string }}
 */
export async function insertFamilyNotificationBroadcast({ toAll, familyId, category, title, body, relatedType, relatedId }) {
  if (!title?.trim() || !body?.trim()) {
    return { ok: false, errorMessage: 'Title and message are required.' };
  }
  let familyIds = [];
  if (toAll) {
    const res = await fetchNotifiableFamilyProfiles();
    if (!res.ok) return res;
    familyIds = res.profiles.map((p) => p.id);
    if (familyIds.length === 0) {
      return { ok: false, errorMessage: 'No guardians found to notify.' };
    }
  } else {
    if (!familyId) return { ok: false, errorMessage: 'Choose a guardian to notify.' };
    familyIds = [familyId];
  }

  const rows = familyIds.map((id) => ({
    family_id: id,
    template_key: null,
    title: title.trim(),
    body: body.trim(),
    related_type: relatedType || null,
    related_id: relatedId || null,
    category: category || 'general',
  }));
  const { error } = await supabase.from('family_notifications').insert(rows);
  if (error) {
    return { ok: false, errorMessage: error.message || 'Could not send notification.' };
  }
  return { ok: true, sent: rows.length };
}
