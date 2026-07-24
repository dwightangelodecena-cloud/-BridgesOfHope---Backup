import { supabase, isSupabaseConfigured } from './supabase';

export type DbFamilyNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  readAt: number | null;
  relatedType: string;
  relatedId: string;
};

function mapRow(r: Record<string, unknown>): DbFamilyNotification {
  return {
    id: String(r.id),
    title: String(r.title || ''),
    body: String(r.body || ''),
    createdAt: r.created_at ? new Date(String(r.created_at)).getTime() : Date.now(),
    readAt: r.read_at ? new Date(String(r.read_at)).getTime() : null,
    relatedType: String(r.related_type || ''),
    relatedId: String(r.related_id || ''),
  };
}

/** Real, DB-backed notifications for admission + visitation events (admin/staff-triggered). */
export async function fetchDbFamilyNotifications(familyId: string): Promise<DbFamilyNotification[]> {
  if (!isSupabaseConfigured() || !familyId) return [];
  const { data, error } = await supabase
    .from('family_notifications')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapRow);
}

export async function markDbFamilyNotificationRead(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase
    .from('family_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null);
}
