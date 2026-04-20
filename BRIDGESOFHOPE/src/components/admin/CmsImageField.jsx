import React, { useRef, useState } from 'react';
import { ImagePlus, Trash2, Upload } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';
import { uploadCmsImageToStorage } from '@/lib/cmsMediaUpload';

const FIELD = { marginBottom: 14 };
const LABEL = { fontSize: 12, fontWeight: 700, color: '#707EAE', display: 'block', marginBottom: 6 };
const INPUT = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #E9EDF7',
  borderRadius: 10,
  fontSize: 13,
  fontFamily: 'Inter, sans-serif',
};

/**
 * CMS image control: paste URL, upload to Supabase Storage, clear, small preview.
 */
export default function CmsImageField({ label, value, onChange, hint }) {
  const fileRef = useRef(null);
  const [uploadErr, setUploadErr] = useState('');
  const [uploading, setUploading] = useState(false);
  const url = typeof value === 'string' ? value.trim() : '';

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    setUploadErr('');
    setUploading(true);
    try {
      const publicUrl = await uploadCmsImageToStorage(file);
      onChange(publicUrl);
    } catch (err) {
      setUploadErr(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={FIELD}>
      <label style={LABEL}>{label}</label>
      {hint ? (
        <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 8px', lineHeight: 1.45 }}>{hint}</p>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <input
          style={{ ...INPUT, flex: '1 1 200px', minWidth: 0 }}
          type="url"
          placeholder="https://… or Supabase public URL"
          value={url}
          onChange={(e) => onChange(e.target.value)}
        />
        {isSupabaseConfigured() && (
          <>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={handleFile} />
            <button
              type="button"
              style={{
                padding: '8px 12px',
                fontSize: 12,
                fontWeight: 700,
                border: 'none',
                borderRadius: 10,
                background: '#E9EDF7',
                color: '#1B2559',
                cursor: uploading ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'inherit',
              }}
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              title="Upload to Supabase Storage (cms-media bucket)"
            >
              <Upload size={14} /> {uploading ? '…' : 'Upload'}
            </button>
          </>
        )}
        {url ? (
          <button
            type="button"
            style={{
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 700,
              color: '#b91c1c',
              border: 'none',
              borderRadius: 10,
              background: '#E9EDF7',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: 'inherit',
            }}
            onClick={() => onChange('')}
            title="Remove image URL"
          >
            <Trash2 size={14} /> Clear
          </button>
        ) : null}
      </div>
      {uploadErr ? <p style={{ fontSize: 12, color: '#b91c1c', margin: '0 0 6px' }}>{uploadErr}</p> : null}
      {url && (url.startsWith('http') || url.startsWith('/')) ? (
        <div
          style={{
            borderRadius: 10,
            border: '1px solid #E9EDF7',
            overflow: 'hidden',
            maxWidth: 280,
            background: '#f8fafc',
          }}
        >
          <img src={url} alt="" style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 160, objectFit: 'cover' }} />
        </div>
      ) : (
        <div
          style={{
            border: '1px dashed #cbd5e1',
            borderRadius: 10,
            padding: 16,
            color: '#94a3b8',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <ImagePlus size={18} /> No preview — add a URL or upload
        </div>
      )}
    </div>
  );
}
