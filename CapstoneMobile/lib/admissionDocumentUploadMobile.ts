import { supabase } from './supabase';

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

export type PickedAdmissionFile = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
};

function safeFileName(name: string): string {
  return String(name || 'file')
    .replace(/[^\w.\-() ]+/g, '_')
    .slice(0, 120);
}

export async function uploadAdmissionDocumentsMobile(
  files: PickedAdmissionFile[],
  userId: string,
  requestId = 'draft'
): Promise<{ ok: true; files: object[] } | { ok: false; errorMessage: string }> {
  const list = (files || []).filter((f) => f?.uri);
  if (!list.length) return { ok: true, files: [] };
  if (!userId) return { ok: false, errorMessage: 'Sign in to upload documents.' };

  const uploaded: object[] = [];
  for (const file of list) {
    const size = file.size ?? 0;
    if (size > MAX_BYTES) {
      return { ok: false, errorMessage: `${file.name} exceeds 10 MB.` };
    }
    const mime = file.mimeType || 'application/octet-stream';
    if (mime && !ALLOWED_TYPES.has(mime) && !mime.startsWith('image/')) {
      return { ok: false, errorMessage: `${file.name}: file type not allowed.` };
    }
    const path = `${userId}/${requestId}/${Date.now()}-${safeFileName(file.name)}`;
    try {
      const response = await fetch(file.uri);
      const blob = await response.blob();
      if (blob.size > MAX_BYTES) {
        return { ok: false, errorMessage: `${file.name} exceeds 10 MB.` };
      }
      const arrayBuffer = await blob.arrayBuffer();
      const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
        contentType: mime,
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
    } catch (e) {
      return { ok: false, errorMessage: e instanceof Error ? e.message : `Could not upload ${file.name}.` };
    }
  }
  return { ok: true, files: uploaded };
}
