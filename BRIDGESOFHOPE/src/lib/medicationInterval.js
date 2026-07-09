export const MEDICATION_INTERVAL_OPTIONS = [
  { value: '', label: 'Select interval' },
  { value: 'every_hours', label: 'Every X hours' },
  { value: 'before_meal', label: 'Before meal' },
  { value: 'after_meal', label: 'After meal' },
  { value: 'before_after_meal', label: 'Before and after meal' },
];

export const MEDICATION_INTERVAL_HOUR_OPTIONS = [
  { value: '', label: 'Select hours' },
  { value: '1', label: 'Every 1 hour' },
  { value: '2', label: 'Every 2 hours' },
  { value: '3', label: 'Every 3 hours' },
  { value: '4', label: 'Every 4 hours' },
  { value: '6', label: 'Every 6 hours' },
  { value: '8', label: 'Every 8 hours' },
  { value: '12', label: 'Every 12 hours' },
  { value: '24', label: 'Every 24 hours' },
];

export function getMedicationIntervalHourOptions(currentHours = '') {
  const hours = String(currentHours ?? '').trim();
  const preset = MEDICATION_INTERVAL_HOUR_OPTIONS.some((opt) => opt.value === hours);
  if (!hours || preset) return MEDICATION_INTERVAL_HOUR_OPTIONS;
  return [
    ...MEDICATION_INTERVAL_HOUR_OPTIONS,
    { value: hours, label: `Every ${hours} hour${hours === '1' ? '' : 's'}` },
  ];
}

export function formatMedicationInterval(row) {
  const type = String(row?.intervalType ?? row?.interval_type ?? '').trim();
  const hours = String(row?.intervalHours ?? row?.interval_hours ?? '').trim();
  if (type === 'every_hours') {
    if (!hours) return 'Every X hours';
    const n = Number(hours);
    return Number.isFinite(n) && n > 0 ? `Every ${n} hour${n === 1 ? '' : 's'}` : `Every ${hours} hours`;
  }
  if (type === 'before_meal') return 'Before meal';
  if (type === 'after_meal') return 'After meal';
  if (type === 'before_after_meal') return 'Before and after meal';
  return '';
}

/** Best-effort split of legacy combined dosageInterval strings. */
export function splitLegacyDosageInterval(raw) {
  const text = String(raw ?? '').trim();
  if (!text) {
    return { dosage: '', intervalType: '', intervalHours: '' };
  }

  const everyMatch = text.match(/(?:\/|\s|,)\s*every\s+(\d+)\s*hours?/i)
    || text.match(/^every\s+(\d+)\s*hours?/i);
  if (everyMatch) {
    const dosage = text.replace(/\s*\/?\s*every\s+\d+\s*hours?/i, '').replace(/^every\s+\d+\s*hours?\s*\/?\s*/i, '').trim();
    return { dosage, intervalType: 'every_hours', intervalHours: everyMatch[1] };
  }

  const lower = text.toLowerCase();
  if (lower.includes('before and after') || lower.includes('before & after')) {
    return { dosage: text.replace(/before\s+(and|&)\s+after\s+meal/gi, '').replace(/\s*\/\s*$/, '').trim(), intervalType: 'before_after_meal', intervalHours: '' };
  }
  if (/\bbefore\s+meal\b/i.test(text)) {
    return { dosage: text.replace(/\s*\/?\s*before\s+meal/gi, '').trim(), intervalType: 'before_meal', intervalHours: '' };
  }
  if (/\bafter\s+meal\b/i.test(text)) {
    return { dosage: text.replace(/\s*\/?\s*after\s+meal/gi, '').trim(), intervalType: 'after_meal', intervalHours: '' };
  }

  return { dosage: text, intervalType: '', intervalHours: '' };
}
