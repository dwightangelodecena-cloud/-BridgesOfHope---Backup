const FAMILY_NOTIFICATIONS_KEY = 'bh_family_notifications_v1';

export const DEFAULT_FAMILY_NOTIFICATIONS = [
  'Submit missing laboratory result before Friday.',
  'Family support session is scheduled on April 5, 10:00 AM.',
  'Weekly report reviewed by your assigned counselor.',
  'Community Update: Join the monthly Family Wellness Talk on April 9 to learn practical family recovery support strategies.',
];

export function loadFamilyNotifications() {
  try {
    const raw = localStorage.getItem(FAMILY_NOTIFICATIONS_KEY);
    if (!raw) return [...DEFAULT_FAMILY_NOTIFICATIONS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_FAMILY_NOTIFICATIONS];
    return parsed.map((item) => String(item || '').trim()).filter(Boolean);
  } catch {
    return [...DEFAULT_FAMILY_NOTIFICATIONS];
  }
}

export function saveFamilyNotifications(items) {
  const normalized = Array.isArray(items)
    ? items.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  localStorage.setItem(FAMILY_NOTIFICATIONS_KEY, JSON.stringify(normalized));
  return normalized;
}
