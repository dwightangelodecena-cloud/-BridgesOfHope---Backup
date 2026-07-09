import { formatMedicationInterval, splitLegacyDosageInterval } from '@/lib/medicationInterval';

export const EMPTY_MEDICATION_ROW = {
  medicine: '',
  dosage: '',
  intervalType: '',
  intervalHours: '',
};

const normalizeRow = (row) => {
  let medicine = String(row?.medicine ?? row?.name ?? '').trim();
  let dosage = String(row?.dosage ?? '').trim();
  let intervalType = String(row?.intervalType ?? row?.interval_type ?? '').trim();
  let intervalHours = String(row?.intervalHours ?? row?.interval_hours ?? '').trim();

  if (!dosage && !intervalType && row?.dosageInterval != null) {
    const split = splitLegacyDosageInterval(row.dosageInterval);
    dosage = split.dosage;
    intervalType = split.intervalType;
    intervalHours = split.intervalHours;
  }

  return { medicine, dosage, intervalType, intervalHours };
};

const rowHasContent = (row) => {
  const n = normalizeRow(row);
  return Boolean(n.medicine || n.dosage || n.intervalType);
};

/** Parse `current_medications` text (JSON table or legacy free text). */
export function parseMedicationTableField(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map((row) => normalizeRow(row));
      }
    } catch {
      /* fall through to legacy */
    }
  }
  const legacy = splitLegacyDosageInterval(text);
  return [{ medicine: '', ...legacy }];
}

/** Rows for editing — always at least one row. */
export function parseMedicationTableFieldForEdit(raw) {
  const rows = parseMedicationTableField(raw);
  return rows.length ? rows : [{ ...EMPTY_MEDICATION_ROW }];
}

export function serializeMedicationTableField(rows) {
  const cleaned = (Array.isArray(rows) ? rows : [])
    .map(normalizeRow)
    .filter(rowHasContent);
  return cleaned.length ? JSON.stringify(cleaned) : '';
}

export function medicationTableHasContent(raw) {
  return serializeMedicationTableField(parseMedicationTableField(raw)).length > 0;
}

/** Human-readable block for summaries and nurse notes. */
export function formatMedicationTableSummary(raw) {
  const rows = parseMedicationTableField(raw).filter(rowHasContent);
  if (!rows.length) return '';
  return rows
    .map((row) => {
      const n = normalizeRow(row);
      const interval = formatMedicationInterval(n);
      const parts = [
        n.medicine || 'Medicine',
        n.dosage,
        interval,
      ].filter(Boolean);
      return `• ${parts.join(' — ')}`;
    })
    .join('\n');
}

export function formatMedicationTableNoteSection(label, raw) {
  const block = formatMedicationTableSummary(raw);
  if (!block) return '';
  return `${label}:\n${block}`;
}

/** True when stored value is legacy plain text (not JSON table). */
export function isLegacyMedicationText(raw) {
  const text = String(raw ?? '').trim();
  return Boolean(text) && !text.startsWith('[');
}

export { formatMedicationInterval };
