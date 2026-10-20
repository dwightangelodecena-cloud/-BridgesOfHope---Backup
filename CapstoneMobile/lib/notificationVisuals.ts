import type { Ionicons } from '@expo/vector-icons';
import type { InboxItem } from './useFamilyNotificationsInbox';
import { BH } from '../theme/tokens';

export type NotifVisual = {
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  color: string;
  accent: string;
  label: string;
};

/** Primary lookup: the notification's own `category` column. Covers every new send path. */
const CATEGORY_CFG: Record<string, NotifVisual> = {
  admission: { icon: 'document-text', bg: BH.brandSurface, color: BH.brand700, accent: BH.brand, label: 'Admission' },
  visitation: { icon: 'calendar', bg: BH.indigoTint, color: BH.indigo, accent: BH.indigo500, label: 'Visitation' },
  promo: { icon: 'megaphone', bg: '#FCE7F3', color: '#BE185D', accent: '#EC4899', label: 'Announcement' },
  clinical: { icon: 'medkit', bg: '#CCFBF1', color: '#0F766E', accent: '#14B8A6', label: 'Clinical' },
  progress: { icon: 'trending-up', bg: BH.infoBg, color: BH.info, accent: '#3B82F6', label: 'Progress' },
  discharge: { icon: 'exit-outline', bg: '#FFE4D6', color: '#9A3412', accent: '#F0851F', label: 'Discharge' },
};
const RELATED_CFG: Record<string, NotifVisual> = {
  admission_request: CATEGORY_CFG.admission,
  visitation_request: CATEGORY_CFG.visitation,
  discharge_pickup: CATEGORY_CFG.discharge,
  announcement: CATEGORY_CFG.promo,
};
const DEFAULT_CFG: NotifVisual = {
  icon: 'notifications-outline',
  bg: BH.slate100,
  color: BH.slate500,
  accent: BH.slate400,
  label: 'General',
};

/** Category-first lookup; falls back to the old title/related-type heuristics for rows without a meaningful category. */
export function getNotifVisual(item: InboxItem): NotifVisual {
  if (item.category && CATEGORY_CFG[item.category]) {
    return CATEGORY_CFG[item.category];
  }
  if (item.relatedType === 'announcement') return CATEGORY_CFG.promo;
  const t = item.title.toLowerCase();
  if (t.includes('approved') || t.includes('confirmed')) {
    return { icon: 'checkmark-circle', bg: BH.successBg, color: BH.successText, accent: BH.success, label: 'Approved' };
  }
  if (t.includes('rejected') || t.includes('declined')) {
    return { icon: 'close-circle', bg: BH.dangerBg, color: BH.danger, accent: BH.dangerStrong, label: 'Declined' };
  }
  if (t.includes('documents needed') || t.includes('required')) {
    return { icon: 'alert-circle', bg: BH.warningBg, color: BH.warning, accent: '#F59E0B', label: 'Action needed' };
  }
  if (t.includes('rescheduled')) {
    return { icon: 'time', bg: BH.indigoTint, color: BH.indigo, accent: BH.indigo500, label: 'Rescheduled' };
  }
  return RELATED_CFG[item.relatedType || ''] || DEFAULT_CFG;
}

/** Filter groups for the Notifications screen chips, in display order. */
export const NOTIF_GROUPS: { key: string; label: string }[] = [
  { key: 'admission', label: 'Admission' },
  { key: 'visitation', label: 'Visits' },
  { key: 'promo', label: 'Announcements' },
  { key: 'progress', label: 'Progress' },
  { key: 'clinical', label: 'Clinical' },
  { key: 'discharge', label: 'Discharge' },
  { key: 'general', label: 'Other' },
];

const RELATED_GROUP: Record<string, string> = {
  admission_request: 'admission',
  visitation_request: 'visitation',
  discharge_pickup: 'discharge',
  discharge_request: 'discharge',
  discharge_finalized: 'discharge',
  announcement: 'promo',
  weekly_report: 'progress',
  patient_progress: 'progress',
};

export function notifGroup(item: InboxItem): string {
  if (item.category && CATEGORY_CFG[item.category]) return item.category;
  return RELATED_GROUP[item.relatedType || ''] || 'general';
}

export function relativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "Today, 9:41 AM" / "Yesterday, 4:02 PM" / "Oct 12, 2026, 8:15 AM". */
export function fullTimestamp(ts: number): string {
  const d = new Date(ts);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((startOfToday.getTime() - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  if (dayDiff === 0) return `Today, ${time}`;
  if (dayDiff === 1) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, ${time}`;
}

/** Section heading for the grouped list. */
export function dateGroupLabel(ts: number): string {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const dayDiff = Math.floor((startOfToday.getTime() - new Date(ts).setHours(0, 0, 0, 0)) / 86_400_000);
  if (dayDiff <= 0) return 'Today';
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff < 7) return 'This week';
  return 'Earlier';
}

const NAME = "([A-Z][A-Za-z'\\-]*(?:\\s[A-Z][A-Za-z'\\-]*){0,4})";

/** Resident named in the template text ("for Lance Miranda's …", "for Lance Miranda is …"). */
export function extractResident(item: InboxItem): string | null {
  const text = `${item.body} ${item.title}`;
  const m = text.match(new RegExp(`for ${NAME}'s\\b`)) || text.match(new RegExp(`for ${NAME} (?:is|has|on)\\b`));
  return m ? m[1].trim() : null;
}

export type NotifSchedule = {
  month: string; // "OCT"
  day: string; // "21"
  weekday: string; // "Wednesday"
  dateLabel: string; // "October 21, 2026"
  time: string | null; // "9:00 AM"
};

/** First YYYY-MM-DD [at] HH:MM [AM|PM] the message mentions. */
export function extractSchedule(item: InboxItem): NotifSchedule | null {
  const m = `${item.body} ${item.title}`.match(
    /(\d{4})-(\d{2})-(\d{2})(?:\s*(?:at)?\s*(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?)?/
  );
  if (!m) return null;
  const [, y, mo, da, hh, mm, ampm] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(da));
  if (Number.isNaN(date.getTime())) return null;
  let time: string | null = null;
  if (hh != null && mm != null) {
    let h = Number(hh);
    if (ampm) {
      const pm = ampm.toLowerCase() === 'pm';
      if (pm && h < 12) h += 12;
      if (!pm && h === 12) h = 0;
    }
    time = new Date(2000, 0, 1, h, Number(mm)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  return {
    month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: String(date.getDate()),
    weekday: date.toLocaleDateString('en-US', { weekday: 'long' }),
    dateLabel: date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    time,
  };
}

/**
 * Documents listed in a "missing documents" message ("Please upload the following documents
 * for X: Valid ID, Birth certificate"). Empty when the message doesn't list any.
 */
export function extractDocumentList(item: InboxItem): string[] {
  if (!item.title.toLowerCase().includes('document')) return [];
  const idx = item.body.lastIndexOf(':');
  if (idx < 0) return [];
  return item.body
    .slice(idx + 1)
    .split(/[,;\n•]|\s+and\s+/i)
    .map((s) => s.replace(/^[\s\-*\d.)]+/, '').replace(/[.\s]+$/, '').trim())
    .filter((s) => s.length > 1)
    .slice(0, 10);
}

export type NotifTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';
export type NotifStatus = { label: string; tone: NotifTone };

/** Outcome stated by the notification title, shown as a status tag on the detail sheet. */
export function notifStatus(item: InboxItem): NotifStatus | null {
  const t = item.title.toLowerCase();
  if (t.includes('document') || t.includes('required')) return { label: 'Action needed', tone: 'warning' };
  if (t.includes('rejected') || t.includes('declined')) return { label: 'Declined', tone: 'danger' };
  if (t.includes('cancel')) return { label: 'Cancelled', tone: 'neutral' };
  if (t.includes('unavailable') || t.includes('rescheduled') || t.includes('new time'))
    return { label: 'New schedule proposed', tone: 'warning' };
  if (t.includes('approved')) return { label: 'Approved', tone: 'success' };
  if (t.includes('confirmed')) return { label: 'Confirmed', tone: 'success' };
  if (t.includes('completed')) return { label: 'Completed', tone: 'info' };
  if (t.includes('milestone')) return { label: 'Milestone reached', tone: 'success' };
  if (t.includes('finalized')) return { label: 'Finalized', tone: 'neutral' };
  if (t.includes('scheduled')) return { label: 'Scheduled', tone: 'info' };
  if (t.includes('available') || t.includes('new weekly report')) return { label: 'Ready to view', tone: 'info' };
  return null;
}

export const TONE_COLORS: Record<NotifTone, { fg: string; bg: string; border: string }> = {
  success: { fg: BH.successText, bg: BH.successBg, border: BH.successBorder },
  danger: { fg: BH.danger, bg: BH.dangerBg, border: BH.dangerBorder },
  warning: { fg: '#92400E', bg: BH.warningBg, border: BH.warningBorder },
  info: { fg: BH.info, bg: BH.infoBg, border: BH.infoBorder },
  neutral: { fg: BH.slate600, bg: BH.slate100, border: BH.slate200 },
};
