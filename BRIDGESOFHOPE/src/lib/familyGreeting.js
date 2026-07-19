/** Time-based greeting for the family home dashboard only. */
export function getFamilyTimeGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Icon paired with the time-based home greeting (no emoji). */
export function getFamilyGreetingIcon(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'sun';
  if (hour < 17) return 'cloud-sun';
  return 'moon';
}

export function getFamilyFirstName(displayName, fallback = 'Family') {
  const first = String(displayName || 'Family User').trim().split(/\s+/).filter(Boolean)[0];
  return first || fallback;
}
