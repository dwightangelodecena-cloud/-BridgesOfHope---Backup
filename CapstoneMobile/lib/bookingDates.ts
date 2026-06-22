/** Local-date helpers for appointment / calendar booking (no past dates). */

export function todayIsoLocal(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

export function isPastIsoDate(iso: string | null | undefined): boolean {
  if (!iso || typeof iso !== 'string') return false;
  const day = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  return day < todayIsoLocal();
}

export function isTodayOrFutureIsoDate(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return !isPastIsoDate(iso);
}
