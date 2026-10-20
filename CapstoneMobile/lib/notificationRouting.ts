import { TAB_ROUTES } from './navigationConfig';
import type { InboxItem } from './useFamilyNotificationsInbox';

export type NotificationTarget = {
  pathname: string;
  params?: Record<string, string>;
  /** Short call-to-action shown on the notification detail sheet. */
  actionLabel: string;
  /** One line telling the guardian what they'll find / need to do there. */
  hint: string;
};

/** Announcement notifications open the live announcement popup instead of a screen. */
export function isAnnouncementNotification(item: InboxItem): boolean {
  return item.relatedType === 'announcement';
}

/**
 * Where tapping a family notification should take the guardian.
 * Returns null when there is no screen for it (announcements, broadcasts, legacy on-device
 * notifications) — callers then show the notification's own detail view instead.
 *
 * `admission_request` covers several templates with different destinations; the template key
 * isn't stored on the row, so the (admin-editable but stable) title is the signal, the same
 * heuristic getNotifVisual uses.
 */
export function notificationTarget(item: InboxItem): NotificationTarget | null {
  const type = item.relatedType || '';
  const id = item.relatedId || '';
  const t = item.title.toLowerCase();

  switch (type) {
    case 'visitation_request':
    case 'discharge_pickup':
      return {
        pathname: TAB_ROUTES.appointments,
        actionLabel: 'View appointment',
        hint: 'Check the date, time and status in Appointments.',
      };

    case 'admission_request': {
      const withRequest = id ? { requestId: id } : undefined;
      // Documents to upload and the nurse's pre-admission summary both live on the
      // request's detail sheet in Requests.
      if (t.includes('document')) {
        return {
          pathname: TAB_ROUTES.progress,
          params: withRequest,
          actionLabel: 'Upload documents',
          hint: 'Upload the requested files from your admission request.',
        };
      }
      if (t.includes('pre-admission') || t.includes('summary')) {
        return {
          pathname: TAB_ROUTES.progress,
          params: withRequest,
          actionLabel: 'View medical summary',
          hint: "The nurse's vitals and assessment are on your admission request.",
        };
      }
      if (t.includes('meeting') || t.includes('unavailable') || t.includes('new time')) {
        return {
          pathname: TAB_ROUTES.admissionMeetingRequest,
          params: withRequest,
          actionLabel: 'View meeting',
          hint: 'Confirm the meeting schedule or propose another time.',
        };
      }
      if (t.includes('approved')) {
        return {
          pathname: TAB_ROUTES.patientDetails,
          actionLabel: 'View resident',
          hint: 'Your resident now appears under Residents.',
        };
      }
      return {
        pathname: TAB_ROUTES.progress,
        params: withRequest,
        actionLabel: 'View admission request',
        hint: 'See the latest status of this admission request.',
      };
    }

    case 'discharge_request':
      return {
        pathname: TAB_ROUTES.progress,
        actionLabel: 'View request',
        hint: 'See the latest status of this request.',
      };

    case 'discharge_finalized':
      return {
        pathname: TAB_ROUTES.patientArchives,
        actionLabel: 'View discharged residents',
        hint: 'Discharged residents and their records are kept in the archive.',
      };

    case 'weekly_report':
      return {
        pathname: TAB_ROUTES.reports,
        actionLabel: 'View weekly report',
        hint: "Read the care team's full weekly report.",
      };

    case 'patient_progress':
      return {
        pathname: TAB_ROUTES.patientDetails,
        actionLabel: 'View progress',
        hint: "See your resident's latest recovery progress.",
      };

    default:
      return null;
  }
}
