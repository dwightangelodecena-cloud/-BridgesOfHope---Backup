/**
 * Factory for CMS custom landing blocks (stored in site content JSON).
 */
export function buildCustomBlock(type, id, order) {
  const defaults = {
    design: 'default',
    spacing: 'normal',
    width: 'full',
    animation: 'fade-up',
    align: 'left',
  };
  const base = { id, type, order, ...defaults };
  switch (type) {
    case 'heading':
      return { ...base, level: 2, text: 'New heading' };
    case 'paragraph':
      return { ...base, text: 'Add your text here.' };
    case 'table':
      return { ...base, headers: ['Column A', 'Column B'], rows: [['', '']] };
    case 'columns':
      return { ...base, left: '', right: '' };
    case 'spacer':
      return { ...base, height: 32 };
    case 'divider':
      return { ...base };
    case 'button':
      return { ...base, label: 'Learn more', href: '' };
    case 'image':
      return { ...base, src: '', alt: '' };
    case 'quote':
      return { ...base, text: 'Add a short quote.', attribution: '' };
    case 'list':
      return { ...base, items: ['First point', 'Second point'] };
    default:
      return { ...base, type: 'paragraph', text: '' };
  }
}
