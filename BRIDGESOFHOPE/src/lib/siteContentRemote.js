/**
 * Cloud sync for site content (public.home JSON) via Supabase `public.site_pages`.
 * Requires migration: supabase/migrations/20260418120000_create_site_pages.sql
 */
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { mergeSiteContent } from '@/lib/siteContentStore';

export const SITE_PAGE_SLUG_HOME = 'home';

/**
 * Fetch merged site content from Supabase, or null if missing / error / not configured.
 */
export async function pullSiteContentFromSupabase(slug = SITE_PAGE_SLUG_HOME) {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase.from('site_pages').select('content').eq('slug', slug).maybeSingle();
  if (error) {
    console.warn('[siteContentRemote] pull', error.message);
    return null;
  }
  if (!data?.content || typeof data.content !== 'object') return null;
  return mergeSiteContent(data.content);
}

/**
 * Upsert full merged content. Caller should pass the same shape as loadSiteContent() after merge.
 * @returns {{ ok: true } | { ok: false, skipped?: boolean, error?: string }}
 */
export async function pushSiteContentToSupabase(merged, slug = SITE_PAGE_SLUG_HOME) {
  if (!isSupabaseConfigured()) {
    return { ok: false, skipped: true };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Sign in required to save to the cloud.' };
  }
  const row = {
    slug,
    content: merged,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };
  const { error } = await supabase.from('site_pages').upsert(row, { onConflict: 'slug' });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
