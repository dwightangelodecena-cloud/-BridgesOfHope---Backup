/** Admission request workflow statuses (Kalinga revisions). */

export const ADMISSION_STATUSES = {
  PROCESSING: 'processing',
  AWAITING_SCHEDULE_REVIEW: 'awaiting_schedule_review',
  AWAITING_GUARDIAN_RESPONSE: 'awaiting_guardian_response',
  IN_REVIEW: 'in_review',
  ACCEPTED: 'approved',
  REJECTED: 'declined',
};

export const ADMISSION_STATUS_LABELS = {
  pending: 'Processing',
  processing: 'Processing',
  awaiting_schedule_review: 'Awaiting Schedule Review',
  awaiting_guardian_response: 'Awaiting Guardian Response',
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
  if (key === 'in_review' || key === 'awaiting_schedule_review' || key === 'awaiting_guardian_response') return 'am-pill--warn';
  if (key === 'declined' || key === 'rejected') return 'am-pill--bad';
  return 'am-pill--muted';
}

/** Admin can act on a meeting (confirm/counter a guardian proposal, or cold-start one) in these statuses. */
export function canScheduleMeeting(row) {
  const st = String(row?.dbStatus || row?.status || '').toLowerCase();
  return st === 'processing' || st === 'pending' || st === 'awaiting_schedule_review';
}

/** True once the guardian has a proposed slot admin hasn't decided on yet. */
export function hasPendingGuardianProposal(row) {
  const st = String(row?.dbStatus || row?.status || '').toLowerCase();
  return st === 'awaiting_schedule_review' && Boolean(row?.preferredMeetingDate || row?.preferred_meeting_date);
}

/** True while admin is waiting on the guardian to accept/counter a suggested time — nothing for admin to do but wait. */
export function isAwaitingGuardianResponse(row) {
  const st = String(row?.dbStatus || row?.status || '').toLowerCase();
  return st === 'awaiting_guardian_response';
}

export function canMarkMeetingComplete(row) {
  const st = String(row?.dbStatus || row?.status || '').toLowerCase();
  const hasMeeting = Boolean(row?.meetingDate || row?.meeting_date);
  const confirmedByFamily = Boolean(row?.meetingConfirmedByFamily ?? row?.meeting_confirmed_by_family);
  return (st === 'processing' || st === 'pending') && hasMeeting && confirmedByFamily;
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

const ORIGINAL_ADMISSION_DOCUMENT_TYPES = new Set(['valid_id', 'birth_cert', 'hospital_referral']);

/** Whether a file was uploaded as a supplemental / missing document (not initial intake). */
export function isSupplementalAdmissionFile(file) {
  if (file?.isSupplemental === true || file?.supplemental === true) return true;
  const docType = String(file?.documentType || '').trim();
  if (docType && ORIGINAL_ADMISSION_DOCUMENT_TYPES.has(docType)) return false;
  return true;
}

/** Split attached files into initial submission vs supplemental uploads. */
export function partitionAdmissionDocuments(files) {
  const submitted = [];
  const supplemental = [];
  for (const file of parseAttachedFiles(files)) {
    if (isSupplementalAdmissionFile(file)) supplemental.push(file);
    else submitted.push(file);
  }
  return { submitted, supplemental };
}

export function admissionDocumentKey(file) {
  return String(file?.path || file?.name || '').trim();
}

export function admissionDocumentsMatch(file, keyOrFile) {
  const left = admissionDocumentKey(file);
  if (!left) return false;
  if (typeof keyOrFile === 'string') return left === keyOrFile.trim();
  return left === admissionDocumentKey(keyOrFile);
}
