/** Time-based greeting for the family home dashboard only. */
export function getFamilyTimeGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Icon paired with the time-based home greeting (no emoji). */
export function getFamilyGreetingIcon(date = new Date()): 'sunny-outline' | 'partly-sunny-outline' | 'moon-outline' {
  const hour = date.getHours();
  if (hour < 12) return 'sunny-outline';
  if (hour < 17) return 'partly-sunny-outline';
  return 'moon-outline';
}

export function getFamilyFirstName(displayName?: string | null, fallback = 'Family'): string {
  const first = String(displayName || 'Family User').trim().split(/\s+/)[0];
  return first || fallback;
}
