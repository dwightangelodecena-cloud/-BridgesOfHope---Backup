import React from 'react';
import {
  formatMedicationInterval,
  isLegacyMedicationText,
  parseMedicationTableField,
} from '@/lib/medicationTableField';

export default function MedicationTableDisplay({
  value,
  emptyText = '—',
  compact = false,
}) {
  const text = String(value ?? '').trim();
  if (!text) {
    return <span style={{ color: '#94a3b8' }}>{emptyText}</span>;
  }

  if (isLegacyMedicationText(value)) {
    return (
      <div style={{ fontSize: compact ? 13 : 14, color: '#475569', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
        {text}
      </div>
    );
  }

  const rows = parseMedicationTableField(value).filter(
    (row) => row.medicine || row.dosage || row.intervalType
  );

  if (!rows.length) {
    return <span style={{ color: '#94a3b8' }}>{emptyText}</span>;
  }

  return (
    <div className="med-table-display-wrap" style={{ overflowX: 'auto' }}>
      <style>{`
        .med-table-display {
          width: 100%;
          border-collapse: collapse;
          font-size: ${compact ? '12px' : '13px'};
          color: #1B2559;
        }
        .med-table-display th,
        .med-table-display td {
          border: 1px solid #CBD5E1;
          padding: ${compact ? '8px 10px' : '10px 12px'};
          text-align: left;
          vertical-align: top;
        }
        .med-table-display th {
          background: #F8FAFC;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #475569;
        }
        .med-table-display td {
          font-weight: 600;
          background: #fff;
        }
      `}</style>
      <table className="med-table-display">
        <thead>
          <tr>
            <th>Medicine Intake</th>
            <th>Dosage</th>
            <th>Interval hours</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.medicine}-${index}`}>
              <td>{row.medicine || '—'}</td>
              <td>{row.dosage || '—'}</td>
              <td>{formatMedicationInterval(row) || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
