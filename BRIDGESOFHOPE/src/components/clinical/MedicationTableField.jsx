import React, { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { MEDICATION_OPTIONS } from '@/lib/medicationCatalog';
import { MEDICATION_INTERVAL_OPTIONS, getMedicationIntervalHourOptions } from '@/lib/medicationInterval';
import {
  EMPTY_MEDICATION_ROW,
  parseMedicationTableFieldForEdit,
  serializeMedicationTableField,
} from '@/lib/medicationTableField';
import MedicationTableDisplay from '@/components/clinical/MedicationTableDisplay';

export default function MedicationTableField({
  value = '',
  onChange,
  readOnly = false,
  emptyText = 'Not recorded by nurse yet.',
}) {
  const [rows, setRows] = useState(() => parseMedicationTableFieldForEdit(value));
  const lastEmittedRef = useRef(serializeMedicationTableField(parseMedicationTableFieldForEdit(value)));

  useEffect(() => {
    const nextSerialized = serializeMedicationTableField(parseMedicationTableFieldForEdit(value));
    if (nextSerialized !== lastEmittedRef.current) {
      setRows(parseMedicationTableFieldForEdit(value));
      lastEmittedRef.current = nextSerialized;
    }
  }, [value]);

  const emitChange = (nextRows) => {
    const serialized = serializeMedicationTableField(nextRows);
    lastEmittedRef.current = serialized;
    onChange(serialized);
  };

  const updateRow = (index, field, fieldValue) => {
    setRows((prev) => {
      const next = prev.map((row, i) => {
        if (i !== index) return row;
        const updated = { ...row, [field]: fieldValue };
        if (field === 'intervalType' && fieldValue !== 'every_hours') {
          updated.intervalHours = '';
        }
        return updated;
      });
      emitChange(next);
      return next;
    });
  };

  const addRow = () => {
    setRows((prev) => [...prev, { ...EMPTY_MEDICATION_ROW }]);
  };

  const removeRow = (index) => {
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== index);
      const safe = next.length ? next : [{ ...EMPTY_MEDICATION_ROW }];
      emitChange(safe);
      return safe;
    });
  };

  if (readOnly) {
    return <MedicationTableDisplay value={value} emptyText={emptyText} />;
  }

  return (
    <div className="med-table-field">
      <style>{`
        .med-table-field { display: flex; flex-direction: column; gap: 12px; }
        .med-table-field-scroll { overflow-x: auto; }
        .med-table-field-table {
          width: 100%;
          min-width: 720px;
          border-collapse: collapse;
        }
        .med-table-field-table th,
        .med-table-field-table td {
          border: 1px solid #CBD5E1;
          padding: 8px 10px;
          text-align: left;
          vertical-align: top;
          background: #fff;
        }
        .med-table-field-table th {
          background: #F8FAFC;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #475569;
        }
        .med-table-field-table select,
        .med-table-field-table input {
          width: 100%;
          border: 1px solid #E5ECFF;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 13px;
          font-weight: 600;
          color: #1B2559;
          font-family: 'Inter', sans-serif;
          background: #FCFDFF;
        }
        .med-table-field-table select:focus,
        .med-table-field-table input:focus {
          outline: none;
          border-color: #8EA2FF;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
          background: #fff;
        }
        .med-table-interval-cell {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .med-table-field-remove {
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
        }
        .med-table-field-remove:hover { background: #FEE2E2; }
        .med-table-field-add {
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
        .med-table-field-add:hover { background: #EEF2FF; border-color: #A5B4FC; }
      `}</style>
      <div className="med-table-field-scroll">
        <table className="med-table-field-table">
          <thead>
            <tr>
              <th style={{ width: '26%' }}>Medicine Intake</th>
              <th style={{ width: '22%' }}>Dosage</th>
              <th style={{ width: '40%' }}>Interval hours</th>
              <th style={{ width: '6%' }} aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <td>
                  <select
                    value={row.medicine}
                    onChange={(e) => updateRow(index, 'medicine', e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    aria-label={`Medicine intake row ${index + 1}`}
                  >
                    {MEDICATION_OPTIONS.map((opt) => (
                      <option key={opt.value || 'empty'} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="text"
                    value={row.dosage}
                    placeholder="e.g. 300ml"
                    onChange={(e) => updateRow(index, 'dosage', e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    aria-label={`Dosage row ${index + 1}`}
                  />
                </td>
                <td>
                  <div className="med-table-interval-cell">
                    <select
                      value={row.intervalType}
                      onChange={(e) => updateRow(index, 'intervalType', e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      aria-label={`Interval type row ${index + 1}`}
                    >
                      {MEDICATION_INTERVAL_OPTIONS.map((opt) => (
                        <option key={opt.value || 'empty'} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {row.intervalType === 'every_hours' ? (
                      <select
                        value={row.intervalHours}
                        onChange={(e) => updateRow(index, 'intervalHours', e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        aria-label={`Interval hours row ${index + 1}`}
                      >
                        {getMedicationIntervalHourOptions(row.intervalHours).map((opt) => (
                          <option key={opt.value || 'empty'} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                </td>
                <td>
                  {rows.length > 1 ? (
                    <button
                      type="button"
                      className="med-table-field-remove"
                      onClick={() => removeRow(index)}
                      aria-label={`Remove medicine row ${index + 1}`}
                    >
                      <X size={16} />
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="med-table-field-add"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          addRow();
        }}
      >
        <Plus size={14} />
        Add medicine
      </button>
    </div>
  );
}
