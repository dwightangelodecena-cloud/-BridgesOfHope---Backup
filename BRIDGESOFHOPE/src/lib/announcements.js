import { supabase } from '@/lib/supabase';
import { insertFamilyNotificationBroadcast } from '@/lib/notificationTemplates';

/**
 * @returns {{ ok: true, announcements: object[] } | { ok: false, errorMessage: string }}
 */
export async function fetchAnnouncements() {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    return { ok: false, errorMessage: error.message || 'Could not load announcements.' };
  }
  return { ok: true, announcements: data || [] };
}

export async function createAnnouncement({ title, caption, imageUrl, showFrom, hideAfter, status, notifyOnPublish }) {
  if (!title?.trim()) {
    return { ok: false, errorMessage: 'Title is required.' };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('announcements')
    .insert({
      title: title.trim(),
      caption: caption?.trim() || null,
      image_url: imageUrl?.trim() || null,
      status: status || 'draft',
      show_from: showFrom || null,
      hide_after: hideAfter || null,
      notify_on_publish: notifyOnPublish !== false,
      created_by: user?.id || null,
    })
    .select('*')
    .single();
  if (error) {
    return { ok: false, errorMessage: error.message || 'Could not create announcement.' };
  }
  return { ok: true, announcement: data };
}

export async function updateAnnouncement(id, patch) {
  if (!id) return { ok: false, errorMessage: 'Missing announcement id.' };
  const row = {};
  if (patch.title !== undefined) row.title = String(patch.title || '').trim();
  if (patch.caption !== undefined) row.caption = patch.caption?.trim() || null;
  if (patch.imageUrl !== undefined) row.image_url = patch.imageUrl?.trim() || null;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.showFrom !== undefined) row.show_from = patch.showFrom || null;
  if (patch.hideAfter !== undefined) row.hide_after = patch.hideAfter || null;
  if (patch.notifyOnPublish !== undefined) row.notify_on_publish = Boolean(patch.notifyOnPublish);
  row.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('announcements')
    .update(row)
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    return { ok: false, errorMessage: error.message || 'Could not save announcement.' };
  }
  return { ok: true, announcement: data };
}

export async function deleteAnnouncement(id) {
  if (!id) return { ok: false, errorMessage: 'Missing announcement id.' };
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) {
    return { ok: false, errorMessage: error.message || 'Could not delete announcement.' };
  }
  return { ok: true };
}

/**
 * Marks a draft as published. Does NOT send the notification directly — that's handled by
 * checkAndSendDueAnnouncementNotifications(), called right after this, so an immediately-due
 * item (show_from null/past) notifies right away while a future-dated one waits correctly.
 */
export async function publishAnnouncement(id) {
  const res = await updateAnnouncement(id, { status: 'published' });
  if (!res.ok) return res;
  await checkAndSendDueAnnouncementNotifications();
  return res;
}

/**
 * Finds published announcements whose "notify on publish" is still pending and whose show_from
 * has actually arrived, sends the one-shot guardian broadcast for each, and stamps notified_at
 * so it can never double-send. Gated on show_from<=now() so a scheduled-for-later announcement
 * is never notified early — see the "no cron, catch-up-on-session-load" note in the plan this
 * shipped from. Safe to call opportunistically (on page mount/focus) as often as needed.
 * @returns {{ ok: true, sent: number } | { ok: false, errorMessage: string }}
 */
export async function checkAndSendDueAnnouncementNotifications() {
  const nowIso = new Date().toISOString();
  const { data: due, error } = await supabase
    .from('announcements')
    .select('id, title, caption')
    .eq('status', 'published')
    .eq('notify_on_publish', true)
    .is('notified_at', null)
    .or(`show_from.is.null,show_from.lte.${nowIso}`);
  if (error) {
    return { ok: false, errorMessage: error.message || 'Could not check due announcements.' };
  }
  let sent = 0;
  for (const row of due || []) {
    const res = await insertFamilyNotificationBroadcast({
      toAll: true,
      category: 'promo',
      title: row.title,
      body: row.caption?.trim() || row.title,
    });
    if (res.ok) {
      await supabase.from('announcements').update({ notified_at: new Date().toISOString() }).eq('id', row.id);
      sent += 1;
    }
  }
  return { ok: true, sent };
}

/** Pure helper — derives a display-only status for the admin list badge. Never persisted. */
export function deriveAnnouncementDisplayStatus(row) {
  if (row.status !== 'published') return 'draft';
  const now = Date.now();
  const showFrom = row.show_from ? new Date(row.show_from).getTime() : null;
  const hideAfter = row.hide_after ? new Date(row.hide_after).getTime() : null;
  if (hideAfter != null && now > hideAfter) return 'expired';
  if (showFrom != null && now < showFrom) return 'scheduled';
  return 'live';
}
