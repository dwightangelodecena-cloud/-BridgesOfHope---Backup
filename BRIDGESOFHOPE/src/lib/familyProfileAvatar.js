import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const DATA_URL_PREFIX = 'bh_family_avatar_v1:';
const URL_PREFIX = 'bh_family_avatar_url_v1:';
const BUCKET = 'profile-avatars';
const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

export const FAMILY_PROFILE_AVATAR_CHANGED = 'bh_family_profile_avatar_changed';

function dispatchAvatarChanged() {
  try {
    window.dispatchEvent(new CustomEvent(FAMILY_PROFILE_AVATAR_CHANGED));
  } catch {
    /* ignore */
  }
}

function dataKey(userId) {
  const id = userId != null ? String(userId).trim() : '';
  return id ? `${DATA_URL_PREFIX}${id}` : null;
}

function urlKey(userId) {
  const id = userId != null ? String(userId).trim() : '';
  return id ? `${URL_PREFIX}${id}` : null;
}

function isImageSrc(value) {
  if (!value || typeof value !== 'string') return false;
  const v = value.trim();
  return v.startsWith('data:image/') || v.startsWith('http://') || v.startsWith('https://');
}

export function loadFamilyProfileAvatar(userId) {
  const uk = urlKey(userId);
  if (uk) {
    try {
      const cachedUrl = localStorage.getItem(uk);
      if (isImageSrc(cachedUrl)) return cachedUrl.trim();
    } catch {
      /* ignore */
    }
  }
  const dk = dataKey(userId);
  if (!dk) return null;
  try {
    const raw = localStorage.getItem(dk);
    return raw && String(raw).startsWith('data:image/') ? raw : null;
  } catch {
    return null;
  }
}

function cacheAvatarLocally(userId, src) {
  const uk = urlKey(userId);
  const dk = dataKey(userId);
  if (!uk || !dk) return;
  if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
    localStorage.setItem(uk, src);
    localStorage.removeItem(dk);
  } else if (src && src.startsWith('data:image/')) {
    localStorage.setItem(dk, src);
    localStorage.removeItem(uk);
  } else {
    localStorage.removeItem(uk);
    localStorage.removeItem(dk);
  }
}

export function saveFamilyProfileAvatar(userId, dataUrl) {
  const dk = dataKey(userId);
  if (!dk) return;
  const next = dataUrl && String(dataUrl).startsWith('data:image/') ? String(dataUrl) : '';
  const prev = localStorage.getItem(dk) || '';
  if (prev === next) return;
  if (next) {
    localStorage.setItem(dk, next);
    const uk = urlKey(userId);
    if (uk) localStorage.removeItem(uk);
  } else {
    localStorage.removeItem(dk);
  }
  dispatchAvatarChanged();
}

async function persistAvatarUrlToProfile(userId, publicUrl) {
  if (!isSupabaseConfigured() || !userId || !publicUrl) return;
  try {
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);
  } catch {
    /* non-blocking */
  }
}

/** Upload to Supabase Storage and cache public URL locally + on profiles row. */
export async function uploadFamilyProfileAvatarToCloud(file, userId) {
  if (!file || !userId) {
    throw new Error('Sign in to upload a profile photo.');
  }
  if (!isSupabaseConfigured()) {
    throw new Error('Cloud storage is not configured.');
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id || String(user.id) !== String(userId)) {
    throw new Error('Sign in to upload a profile photo.');
  }
  if (!String(file.type || '').startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }
  if (file.size > 5_242_880) {
    throw new Error('Image is too large. Please use a photo under 5 MB.');
  }
  const rawExt = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const ext = ALLOWED_EXT.has(rawExt) ? rawExt : 'jpg';
  const path = `${userId}/avatar.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    upsert: true,
  });
  if (error) {
    throw new Error(error.message || 'Could not upload profile photo.');
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = `${data.publicUrl}?v=${Date.now()}`;
  cacheAvatarLocally(userId, publicUrl);
  await persistAvatarUrlToProfile(userId, publicUrl);
  dispatchAvatarChanged();
  return publicUrl;
}

/** Load avatar from cloud (profiles.avatar_url) with local cache fallback. */
export async function resolveFamilyProfileAvatar(userId) {
  const local = loadFamilyProfileAvatar(userId);
  if (local) return local;
  if (!isSupabaseConfigured() || !userId) return null;
  try {
    const { data } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .maybeSingle();
    const url = String(data?.avatar_url || '').trim();
    if (isImageSrc(url)) {
      cacheAvatarLocally(userId, url);
      dispatchAvatarChanged();
      return url;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function readImageFileAsDataUrl(file, maxBytes = 900_000) {
  return new Promise((resolve, reject) => {
    if (!file || !String(file.type || '').startsWith('image/')) {
      reject(new Error('Please choose an image file.'));
      return;
    }
    if (file.size > maxBytes) {
      reject(new Error('Image is too large. Please use a photo under 900 KB.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string' && result.startsWith('data:image/')) resolve(result);
      else reject(new Error('Could not read image.'));
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read image.'));
    reader.readAsDataURL(file);
  });
}
