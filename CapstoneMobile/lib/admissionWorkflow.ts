/** Admission request workflow statuses (Kalinga revisions). */

export const ADMISSION_STATUSES = {
  PROCESSING: 'processing',
  IN_REVIEW: 'in_review',
  ACCEPTED: 'approved',
  REJECTED: 'declined',
} as const;

export const FAMILY_ACTIVE_ADMISSION_STATUSES = ['pending', 'processing', 'in_review'] as const;

export const ADMISSION_STATUS_LABELS: Record<string, string> = {
  pending: 'Processing',
  processing: 'Processing',
  in_review: 'In Review',
  approved: 'Accepted',
  accepted: 'Accepted',
  declined: 'Rejected',
  rejected: 'Rejected',
};

export function admissionStatusLabel(status: unknown): string {
  const key = String(status || '').toLowerCase();
  return ADMISSION_STATUS_LABELS[key] || String(status || 'Unknown');
}

export function parseAttachedFiles(raw: unknown): { name: string; path?: string; url?: string }[] {
  if (Array.isArray(raw)) return raw as { name: string; path?: string; url?: string }[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
