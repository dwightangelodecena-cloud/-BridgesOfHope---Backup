import React, { useState } from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import { DOCUMENT_TYPE_LABELS } from '@/lib/admissionFormConfig';
import { openAdmissionDocument } from '@/lib/admissionDocumentAccess';

export function AdmissionAttachedFilesList({ files }) {
  const [openingKey, setOpeningKey] = useState('');
  const [openError, setOpenError] = useState('');

  if (!files?.length) return null;

  const handleOpen = async (file) => {
    const key = file.path || file.name;
    setOpeningKey(key);
    setOpenError('');
    try {
      const opened = await openAdmissionDocument(file);
      if (!opened) {
        setOpenError(`Could not open ${file.name || 'document'}.`);
      }
    } finally {
      setOpeningKey('');
    }
  };

  return (
    <div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
        {files.map((file) => {
          const key = file.path || file.name;
          const label = file.documentType
            ? DOCUMENT_TYPE_LABELS[file.documentType] || file.documentType
            : null;
          return (
            <li
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <FileText size={16} color="#64748b" />
                <span style={{ wordBreak: 'break-word' }}>
                  {label ? <strong>{label}: </strong> : null}
                  {file.name || 'Document'}
                </span>
              </div>
              <button
                type="button"
                className="db-action-btn"
                disabled={openingKey === key}
                onClick={() => void handleOpen(file)}
              >
                <ExternalLink size={14} />
                {openingKey === key ? 'Opening…' : 'Open'}
              </button>
            </li>
          );
        })}
      </ul>
      {openError ? (
        <p style={{ margin: '10px 0 0', fontSize: 12, color: '#dc2626', fontWeight: 600 }}>{openError}</p>
      ) : null}
    </div>
  );
}
