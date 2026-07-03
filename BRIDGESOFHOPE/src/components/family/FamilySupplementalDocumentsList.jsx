import React, { useState } from 'react';
import { ExternalLink, FileText, RefreshCw, Trash2 } from 'lucide-react';
import { openAdmissionDocument } from '@/lib/admissionDocumentAccess';
import { admissionDocumentKey } from '@/lib/admissionWorkflow';

export function FamilySupplementalDocumentsList({
  files,
  requestId,
  onRemove,
  onReplace,
  busyKey = '',
}) {
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
      <ul className="adm-supplemental-files">
        {files.map((file) => {
          const key = admissionDocumentKey(file);
          const isBusy = busyKey === key;
          return (
            <li key={key} className="adm-supplemental-files__item">
              <div className="adm-supplemental-files__info">
                <FileText size={16} color="#64748b" />
                <span className="adm-supplemental-files__name">{file.name || 'Document'}</span>
              </div>
              <div className="adm-supplemental-files__actions">
                <button
                  type="button"
                  className="db-action-btn"
                  disabled={isBusy || openingKey === key}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void handleOpen(file);
                  }}
                >
                  <ExternalLink size={14} />
                  {openingKey === key ? 'Opening…' : 'Open'}
                </button>
                <button
                  type="button"
                  className="db-action-btn adm-supplemental-files__btn--muted"
                  disabled={isBusy}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onReplace?.(requestId, file);
                  }}
                >
                  <RefreshCw size={14} />
                  {isBusy ? 'Replacing…' : 'Replace'}
                </button>
                <button
                  type="button"
                  className="db-action-btn adm-supplemental-files__btn--danger"
                  disabled={isBusy}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRemove?.(requestId, file);
                  }}
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {openError ? <p className="adm-supplemental-files__error">{openError}</p> : null}
    </div>
  );
}
