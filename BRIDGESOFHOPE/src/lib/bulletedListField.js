/** Parse stored text for read-only display (trimmed items). */
export function parseBulletedListField(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return [];
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-•*]\s*/, '').trim())
    .filter(Boolean);
  return lines;
}

/** Parse stored text for editing — preserves in-progress spaces; keeps one empty row when blank. */
export function parseBulletedListFieldForEdit(raw) {
  const text = String(raw ?? '');
  if (!text.trim()) return [''];
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-•*]\s*/, ''));
  return lines.length ? lines : [''];
}

/** Serialize list items for DB / local storage (non-empty lines only). */
export function serializeBulletedListField(items) {
  return (Array.isArray(items) ? items : [])
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join('\n');
}

export function bulletedListHasContent(raw) {
  return serializeBulletedListField(parseBulletedListField(raw)).length > 0;
}

/** Plain-text bullet block for nurse_note sections. */
export function formatBulletedListInline(raw) {
  const items = parseBulletedListField(raw).filter(Boolean);
  if (!items.length) return '';
  return items.map((item) => `• ${item}`).join('\n');
}

export function formatBulletedListNoteSection(label, raw) {
  const block = formatBulletedListInline(raw);
  if (!block) return '';
  return `${label}:\n${block}`;
}
