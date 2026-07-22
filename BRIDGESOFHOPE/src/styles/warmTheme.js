/**
 * Shared warm/editorial palette — the landing page's own theme (distinct
 * from the auth navy theme and the global --bh-* token layer). Extracted
 * here so pages/components reached FROM the landing page (legal pages,
 * cookie banner) can match it exactly instead of re-guessing hex values.
 */
export const WARM_THEME_VARS = `
  --cream: #F7F5F1;
  --cream-2: #EEEBE5;
  --surface: #FDFCFA;
  --ink: #0C0A08;
  --ink-2: #2A2420;
  --ink-3: #5C534A;
  --muted: #8A8075;
  --accent: #D94F2A;
  --accent-h: #B83F20;
  --accent-2: #E86B4A;
  --accent-s: rgba(217, 79, 42, 0.12);
  --shadow-s: 0 2px 8px rgba(12,10,8,0.045), 0 14px 36px rgba(12,10,8,0.055);
  --shadow-m: 0 6px 20px rgba(12,10,8,0.055), 0 22px 52px rgba(12,10,8,0.07);
  --r-md: 18px;
  --r-lg: 22px;
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
`;
