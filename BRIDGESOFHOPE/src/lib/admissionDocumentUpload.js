import { supabase } from '@/lib/supabase';

const BUCKET = 'admission-documents';
const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function safeFileName(name) {
  return String(name || 'file')
    .replace(/[^\w.\-() ]+/g, '_')
    .slice(0, 120);
}

/**
 * @param {File[]} files
 * @param {string} userId
 * @param {string} [requestId]
 * @returns {Promise<{ ok: true, files: object[] } | { ok: false, errorMessage: string }>}
 */
export async function uploadAdmissionDocuments(files, userId, requestId = 'draft') {
  const list = Array.from(files || []).filter(Boolean);
  if (!list.length) return { ok: true, files: [] };
  if (!userId) return { ok: false, errorMessage: 'Sign in to upload documents.' };

  const uploaded = [];
  for (const file of list) {
    if (file.size > MAX_BYTES) {
      return { ok: false, errorMessage: `${file.name} exceeds 10 MB.` };
    }
    if (file.type && !ALLOWED_TYPES.has(file.type)) {
      return { ok: false, errorMessage: `${file.name}: file type not allowed.` };
    }
    const path = `${userId}/${requestId}/${Date.now()}-${safeFileName(file.name)}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) {
      return { ok: false, errorMessage: error.message || `Could not upload ${file.name}.` };
    }
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    uploaded.push({
      name: file.name,
      path,
      url: urlData?.publicUrl || '',
      uploadedAt: new Date().toISOString(),
    });
  }
  return { ok: true, files: uploaded };
}
