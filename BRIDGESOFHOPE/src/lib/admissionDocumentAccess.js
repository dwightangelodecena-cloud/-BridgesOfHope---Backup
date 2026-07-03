import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  admissionDocumentsMatch,
  isSupplementalAdmissionFile,
  parseAttachedFiles,
} from '@/lib/admissionWorkflow';

export const ADMISSION_DOCUMENTS_BUCKET = 'admission-documents';
const SIGNED_URL_TTL_SECONDS = 3600;

async function listStoredAdmissionDocuments(familyId, requestId, createdAfter) {
  const familyKey = String(familyId || '').trim();
  const requestKey = String(requestId || '').trim();
  if (!familyKey) return [];

  const createdAfterTs = createdAfter ? new Date(createdAfter).getTime() : 0;
  const prefixes = requestKey
    ? [`${familyKey}/${requestKey}`, `${familyKey}/pending`, `${familyKey}/draft`]
    : [`${familyKey}/pending`, `${familyKey}/draft`];

  const byPath = new Map();

  for (const prefix of prefixes) {
    const isRequestFolder = requestKey && prefix === `${familyKey}/${requestKey}`;
    const { data, error } = await supabase.storage.from(ADMISSION_DOCUMENTS_BUCKET).list(prefix, {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' },
    });
    if (error || !data?.length) continue;

    for (const entry of data) {
      if (!entry?.name || !entry.name.includes('.')) continue;
      if (!isRequestFolder && createdAfterTs > 0) {
        const uploadedTs = new Date(entry.created_at || entry.updated_at || 0).getTime();
        if (!Number.isNaN(uploadedTs) && uploadedTs + 60_000 < createdAfterTs) continue;
      }
      const path = `${prefix}/${entry.name}`;
      if (byPath.has(path)) continue;
      byPath.set(path, {
        name: entry.name,
        path,
        uploadedAt: entry.created_at || entry.updated_at || '',
      });
    }
  }

  return Array.from(byPath.values());
}

/**
 * Load documents for admin/family views. Uses DB metadata first, then storage fallback.
 * @param {{ requestId?: string, attachedFiles?: unknown, familyId?: string, createdAfter?: string }} params
 * @returns {Promise<object[]>}
 */
export async function resolveAdmissionDocumentsForView({ requestId, attachedFiles, familyId, createdAfter }) {
  let parsed = parseAttachedFiles(attachedFiles);
  let resolvedFamilyId = familyId;
  let resolvedCreatedAt = createdAfter;

  if (requestId && isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('admission_requests')
      .select('attached_files, family_id, created_at')
      .eq('id', requestId)
      .maybeSingle();
    if (!error && data) {
      if (data.attached_files) parsed = parseAttachedFiles(data.attached_files);
      if (!resolvedFamilyId && data.family_id) resolvedFamilyId = data.family_id;
      if (!resolvedCreatedAt && data.created_at) resolvedCreatedAt = data.created_at;
    }
  }

  if (parsed.length) return parsed;
  return listStoredAdmissionDocuments(resolvedFamilyId, requestId, resolvedCreatedAt);
}

/**
 * @param {string} path Storage object path within admission-documents bucket.
 * @returns {Promise<string | null>}
 */
export async function getAdmissionDocumentSignedUrl(path) {
  const storagePath = String(path || '').trim();
  if (!storagePath) return null;

  const { data, error } = await supabase.storage
    .from(ADMISSION_DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error) {
    console.warn('[admissionDocumentAccess]', error.message);
    return null;
  }
  return data?.signedUrl || null;
}

/**
 * Open an admission document in a new tab. Uses a signed URL when path is stored.
 * @param {{ path?: string, url?: string, name?: string }} file
 * @returns {Promise<boolean>}
 */
export async function openAdmissionDocument(file) {
  const path = file?.path;
  if (path) {
    const signedUrl = await getAdmissionDocumentSignedUrl(path);
    if (signedUrl) {
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
      return true;
    }
  }

  const fallbackUrl = String(file?.url || '').trim();
  if (fallbackUrl) {
    window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
    return true;
  }

  return false;
}

/**
 * Remove a storage object from the admission-documents bucket (best effort).
 * @param {string} path
 * @returns {Promise<boolean>}
 */
export async function deleteAdmissionDocument(path) {
  const storagePath = String(path || '').trim();
  if (!storagePath) return false;
  const { error } = await supabase.storage.from(ADMISSION_DOCUMENTS_BUCKET).remove([storagePath]);
  if (error) {
    console.warn('[admissionDocumentAccess] delete:', error.message);
    return false;
  }
  return true;
}

/**
 * Remove a supplemental admission document from DB metadata and storage.
 * @returns {Promise<{ ok: true, remaining: object[] } | { ok: false, errorMessage: string }>}
 */
export async function removeSupplementalAdmissionDocument(requestId, fileRef) {
  const requestKey = String(requestId || '').trim();
  if (!requestKey) return { ok: false, errorMessage: 'Invalid request.' };

  const { data: row, error: rowErr } = await supabase
    .from('admission_requests')
    .select('attached_files, family_id, created_at')
    .eq('id', requestKey)
    .maybeSingle();

  if (rowErr || !row) {
    return { ok: false, errorMessage: rowErr?.message || 'Could not load admission request.' };
  }

  const resolved = await resolveAdmissionDocumentsForView({
    requestId: requestKey,
    attachedFiles: row.attached_files,
    familyId: row.family_id,
    createdAfter: row.created_at,
  });

  const target = resolved.find((file) => admissionDocumentsMatch(file, fileRef));
  if (!target) {
    return { ok: false, errorMessage: 'Document not found on this request.' };
  }
  if (!isSupplementalAdmissionFile(target)) {
    return { ok: false, errorMessage: 'Only missing documents can be removed here.' };
  }

  const remaining = resolved.filter((file) => !admissionDocumentsMatch(file, target));
  const { error: updateErr } = await supabase
    .from('admission_requests')
    .update({ attached_files: remaining })
    .eq('id', requestKey);

  if (updateErr) {
    return { ok: false, errorMessage: updateErr.message || 'Could not update document list.' };
  }

  if (target.path) {
    await deleteAdmissionDocument(target.path);
  }

  return { ok: true, remaining };
}
