import { supabase } from '@/lib/supabase';

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

/**
 * Render `templateKey` with `vars` and insert a real, DB-backed notification for the guardian.
 * This is the one call site admin code should use instead of the old (dead) localStorage writer.
 * @returns {{ ok: true } | { ok: false, errorMessage: string }}
 */
export async function insertFamilyNotification({ familyId, templateKey, vars = {}, relatedType, relatedId }) {
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
  });
  if (error) {
    return { ok: false, errorMessage: error.message || 'Could not send notification.' };
  }
  return { ok: true };
}
