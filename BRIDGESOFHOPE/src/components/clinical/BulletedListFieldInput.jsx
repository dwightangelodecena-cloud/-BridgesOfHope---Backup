import React, { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  parseBulletedListFieldForEdit,
  serializeBulletedListField,
} from '@/lib/bulletedListField';

import BulletedListDisplay from '@/components/clinical/BulletedListDisplay';

/**
 * Multi-row bulleted input: one row by default, "Add" appends another.
 * Uses local row state so empty draft rows and in-progress spaces are not lost.
 */
export default function BulletedListFieldInput({
  value = '',
  onChange,
  placeholder = '',
  inputClassName = '',
  multiline = false,
  addLabel = 'Add another',
  readOnly = false,
  emptyText = '—',
}) {
  const [items, setItems] = useState(() => parseBulletedListFieldForEdit(value));
  const lastEmittedRef = useRef(serializeBulletedListField(parseBulletedListFieldForEdit(value)));

  useEffect(() => {
    const nextSerialized = serializeBulletedListField(parseBulletedListFieldForEdit(value));
    if (nextSerialized !== lastEmittedRef.current) {
      setItems(parseBulletedListFieldForEdit(value));
      lastEmittedRef.current = nextSerialized;
    }
  }, [value]);

  const emitChange = (nextItems) => {
    const serialized = serializeBulletedListField(nextItems);
    lastEmittedRef.current = serialized;
    onChange(serialized);
  };

  const updateItem = (index, text) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = text;
      emitChange(next);
      return next;
    });
  };

  const addItem = () => {
    setItems((prev) => [...prev, '']);
  };

  const removeItem = (index) => {
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      const safe = next.length ? next : [''];
      emitChange(safe);
      return safe;
    });
  };

  const InputTag = multiline ? 'textarea' : 'input';

  if (readOnly) {
    return (
      <div className="bulleted-list-field bulleted-list-field--readonly">
        <BulletedListDisplay
          value={value}
          emptyText={emptyText}
          style={{ fontSize: 14, fontWeight: 600, color: '#475569', lineHeight: 1.5 }}
        />
      </div>
    );
  }

  return (
    <div className="bulleted-list-field">
      <style>{`
        .bulleted-list-field { display: flex; flex-direction: column; gap: 10px; }
        .bulleted-list-field-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }
        .bulleted-list-field-marker {
          color: #F54E25;
          font-size: 18px;
          font-weight: 900;
          line-height: 1.2;
          margin-top: 10px;
          flex-shrink: 0;
          user-select: none;
        }
        .bulleted-list-field-input {
          flex: 1;
          min-width: 0;
        }
        .bulleted-list-field-input.form-textarea {
          min-height: 84px;
          height: auto;
          resize: vertical;
        }
        .bulleted-list-field-remove {
          border: 1px solid #FECACA;
          background: #FEF2F2;
          color: #B91C1C;
          border-radius: 8px;
          width: 34px;
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          margin-top: 4px;
        }
        .bulleted-list-field-remove:hover { background: #FEE2E2; }
        .bulleted-list-field-add {
          align-self: flex-start;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px dashed #C7D2FE;
          background: #F8FAFF;
          color: #4338CA;
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .bulleted-list-field-add:hover { background: #EEF2FF; border-color: #A5B4FC; }
      `}</style>
      {items.map((item, index) => (
        <div key={index} className="bulleted-list-field-row">
          <span className="bulleted-list-field-marker" aria-hidden="true">
            •
          </span>
          <InputTag
            className={`bulleted-list-field-input ${inputClassName}`.trim()}
            value={item}
            placeholder={placeholder}
            onChange={(e) => updateItem(index, e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            {...(multiline ? { rows: 3 } : { type: 'text' })}
          />
          {items.length > 1 ? (
            <button
              type="button"
              className="bulleted-list-field-remove"
              onClick={() => removeItem(index)}
              aria-label={`Remove item ${index + 1}`}
            >
              <X size={16} />
            </button>
          ) : null}
        </div>
      ))}
      <button
        type="button"
        className="bulleted-list-field-add"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          addItem();
        }}
      >
        <Plus size={14} />
        {addLabel}
      </button>
    </div>
  );
}
