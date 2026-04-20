/**
 * Upload images to Supabase Storage bucket `cms-media` (see supabase migration).
 * Public URL is returned for use in hero, services slides, and image blocks.
 */
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const BUCKET = 'cms-media';
const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

export async function uploadCmsImageToStorage(file) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured');
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Sign in as an admin to upload images');
  }
  const rawExt = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const ext = ALLOWED_EXT.has(rawExt) ? rawExt : 'jpg';
  const path = `cms/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    upsert: false,
  });
  if (error) {
    throw new Error(error.message);
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
