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
    <div
      className="med-table-display-wrap"
      style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: 10 }}
    >
      <style>{`
        .med-table-display {
          width: 100%;
          border-collapse: collapse;
          font-size: ${compact ? '12px' : '13px'};
          color: #1B2559;
        }
        .med-table-display th,
        .med-table-display td {
          border: none;
          border-bottom: 1px solid #EEF2F7;
          padding: ${compact ? '8px 10px' : '10px 12px'};
          text-align: left;
          vertical-align: top;
        }
        .med-table-display tbody tr:last-child td { border-bottom: none; }
        .med-table-display th {
          background: #F8FAFC;
          border-bottom: 1px solid #E2E8F0;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #475569;
          white-space: nowrap;
        }
        .med-table-display td {
          font-weight: 600;
          background: #fff;
        }
        .med-table-display tbody tr:nth-child(even) td {
          background: #FAFBFD;
        }
      `}</style>
      <table className="med-table-display">
        <thead>
          <tr>
            <th>Medicine</th>
            <th>Dosage</th>
            <th>Interval</th>
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
