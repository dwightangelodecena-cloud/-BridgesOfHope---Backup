/**
 * Mirrors web `computeAdmissionDisplayId` (BRIDGESOFHOPE `src/lib/admissionDischargeStore.js`).
 * Human-readable label: year admitted + 6-digit tracking, e.g. 2026-042817.
 */

function stableTrackingSuffix(id: string): string {
  const hex = String(id).replace(/-/g, '');
  let n = 0;
  for (let i = 0; i < hex.length; i++) {
    const ch = hex[i];
    const v = parseInt(ch, 16);
    n = (n * 16 + (Number.isNaN(v) ? ch.charCodeAt(0) : v)) >>> 0;
  }
  return String(n % 1000000).padStart(6, '0');
}

export function computeAdmissionDisplayId(
  admissionRow: { id?: string; decided_at?: string | null; created_at?: string | null } | null,
  patientRow: { id?: string; admitted_at?: string | null } | null
): string {
  const admissionDate =
    patientRow?.admitted_at || admissionRow?.decided_at || admissionRow?.created_at || null;
  let year = new Date().getFullYear();
  if (admissionDate) {
    const d = new Date(admissionDate);
    if (!Number.isNaN(d.getTime())) year = d.getFullYear();
  }
  const idSource = admissionRow?.id ?? patientRow?.id;
  if (!idSource) return '—';
  return `${year}-${stableTrackingSuffix(String(idSource))}`;
}
