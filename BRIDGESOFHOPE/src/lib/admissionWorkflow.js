/** Admission request workflow statuses (Kalinga revisions). */

export const ADMISSION_STATUSES = {
  PROCESSING: 'processing',
  IN_REVIEW: 'in_review',
  ACCEPTED: 'approved',
  REJECTED: 'declined',
};

export const ADMISSION_STATUS_LABELS = {
  pending: 'Processing',
  processing: 'Processing',
  in_review: 'In Review',
  approved: 'Accepted',
  accepted: 'Accepted',
  declined: 'Rejected',
  rejected: 'Rejected',
};

export function admissionStatusLabel(status) {
  const key = String(status || '').toLowerCase();
  return ADMISSION_STATUS_LABELS[key] || String(status || 'Unknown');
}

export function admissionStatusPillClass(status) {
  const key = String(status || '').toLowerCase();
  if (key === 'approved' || key === 'accepted') return 'am-pill--ok';
  if (key === 'processing' || key === 'pending') return 'am-pill--pending';
  if (key === 'in_review') return 'am-pill--warn';
  if (key === 'declined' || key === 'rejected') return 'am-pill--bad';
  return 'am-pill--muted';
}

export function canScheduleMeeting(row) {
  const st = String(row?.dbStatus || row?.status || '').toLowerCase();
  return st === 'processing' || st === 'pending';
}

export function canMarkMeetingComplete(row) {
  const st = String(row?.dbStatus || row?.status || '').toLowerCase();
  return (st === 'processing' || st === 'pending') && Boolean(row?.meetingDate || row?.meeting_date);
}

export function canApproveAdmission(row) {
  const st = String(row?.dbStatus || row?.status || '').toLowerCase();
  if (st === 'approved' || st === 'accepted' || st === 'declined' || st === 'rejected') return false;
  if (st === 'in_review') return Boolean(row?.documentsComplete ?? row?.documents_complete);
  if (st === 'processing' || st === 'pending') {
    const meetingDone = Boolean(row?.meetingCompleted ?? row?.meeting_completed);
    const docsOk = Boolean(row?.documentsComplete ?? row?.documents_complete);
    return meetingDone && docsOk;
  }
  return false;
}

export function parseAttachedFiles(raw) {
  if (Array.isArray(raw)) return raw;
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
