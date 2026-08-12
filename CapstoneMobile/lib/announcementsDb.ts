import { supabase, isSupabaseConfigured } from './supabase';

export type DbAnnouncement = {
  id: string;
  title: string;
  caption: string;
  imageUrl: string;
  createdAt: number;
};

function mapRow(r: Record<string, unknown>): DbAnnouncement {
  return {
    id: String(r.id),
    title: String(r.title || ''),
    caption: String(r.caption || ''),
    imageUrl: String(r.image_url || ''),
    createdAt: r.created_at ? new Date(String(r.created_at)).getTime() : Date.now(),
  };
}

/**
 * Currently-active published announcements for the signed-in family user. No status/date
 * filtering happens here — `announcements_select_family_active` RLS already restricts the
 * rows a family client can even see to `status='published' AND show_from<=now() AND
 * hide_after>=now()`, evaluated fresh on every call, independent of any admin session.
 */
export async function fetchActiveAnnouncements(): Promise<DbAnnouncement[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, caption, image_url, created_at')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapRow);
}
