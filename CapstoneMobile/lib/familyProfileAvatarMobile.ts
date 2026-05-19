import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { isSupabaseConfigured, supabase } from './supabase';

const URL_PREFIX = 'bh_family_avatar_url_v1:';
const BUCKET = 'profile-avatars';
const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

export const FAMILY_PROFILE_AVATAR_CHANGED = 'bh_family_profile_avatar_changed';

function emitChanged() {
  try {
    DeviceEventEmitter.emit(FAMILY_PROFILE_AVATAR_CHANGED);
  } catch {
    /* ignore */
  }
}

function urlKey(userId: string) {
  const id = String(userId || '').trim();
  return id ? `${URL_PREFIX}${id}` : null;
}

function isImageSrc(value: string | null | undefined) {
  if (!value || typeof value !== 'string') return false;
  const v = value.trim();
  return v.startsWith('http://') || v.startsWith('https://') || v.startsWith('file://');
}

export async function loadFamilyProfileAvatarMobile(userId: string | null): Promise<string | null> {
  const key = urlKey(userId || '');
  if (!key) return null;
  try {
    const cached = await AsyncStorage.getItem(key);
    if (isImageSrc(cached)) return cached!.trim();
  } catch {
    /* ignore */
  }
  return null;
}

async function cacheAvatarUrl(userId: string, publicUrl: string | null) {
  const key = urlKey(userId);
  if (!key) return;
  if (publicUrl && isImageSrc(publicUrl)) {
    await AsyncStorage.setItem(key, publicUrl);
  } else {
    await AsyncStorage.removeItem(key);
  }
  emitChanged();
}

async function persistAvatarUrlToProfile(userId: string, publicUrl: string) {
  if (!isSupabaseConfigured() || !userId || !publicUrl) return;
  try {
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);
  } catch {
    /* non-blocking */
  }
}

/** Upload local image URI (expo-image-picker) to Supabase Storage — same bucket as web. */
export async function uploadFamilyProfileAvatarToCloudMobile(
  localUri: string,
  userId: string
): Promise<string> {
  if (!localUri || !userId) {
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

  const response = await fetch(localUri);
  const blob = await response.blob();
  if (blob.size > 5_242_880) {
    throw new Error('Image is too large. Please use a photo under 5 MB.');
  }

  const mime = blob.type || 'image/jpeg';
  if (!mime.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }
  const extFromMime = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const ext = ALLOWED_EXT.has(extFromMime) ? extFromMime : 'jpg';
  const path = `${userId}/avatar.${ext}`;

  const arrayBuffer = await blob.arrayBuffer();
  const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
    contentType: mime,
    upsert: true,
  });
  if (error) {
    throw new Error(error.message || 'Could not upload profile photo.');
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = `${data.publicUrl}?v=${Date.now()}`;
  await cacheAvatarUrl(userId, publicUrl);
  await persistAvatarUrlToProfile(userId, publicUrl);
  return publicUrl;
}

export async function resolveFamilyProfileAvatarMobile(userId: string | null): Promise<string | null> {
  const local = await loadFamilyProfileAvatarMobile(userId);
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
      await cacheAvatarUrl(userId, url);
      return url;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function clearFamilyProfileAvatarCacheMobile(userId: string) {
  const key = urlKey(userId);
  if (key) await AsyncStorage.removeItem(key);
  emitChanged();
}
