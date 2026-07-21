/*
 * ──────────────────────────────────────────────────────────────────────────
 *  Bridges of Hope / Kalinga — Mobile design tokens (single source of truth)
 * ──────────────────────────────────────────────────────────────────────────
 *  The React Native mirror of the web token layer (BRIDGESOFHOPE/src/styles/
 *  tokens.css). Values are identical to the web app so the two platforms share
 *  ONE visual language. Import `BH` and reference these instead of raw hex in
 *  StyleSheet definitions.
 *
 *  Adopting a token is a no-visual-change swap — every value below is the same
 *  colour already used across the family screens.
 * ──────────────────────────────────────────────────────────────────────────
 */

import { Platform, type ViewStyle } from 'react-native';

export const BH = {
  // ── Brand ──────────────────────────────────────────────────────────────
  brand: '#F54E25',
  brand600: '#EA580C', // orange-600 (gradient partner)
  brand700: '#C2410C', // orange-700 — readable brand text on light orange tints
  brandHover: '#E0421A',
  brandStrong: '#D63E17',
  brandLight: '#FF6A3D',
  brandDark: '#FF4D1F',
  brandContrast: '#FFFFFF',
  brandA45: 'rgba(245, 78, 37, 0.45)',
  brandA22: 'rgba(245, 78, 37, 0.22)',
  brandA12: 'rgba(245, 78, 37, 0.12)',
  brandA08: 'rgba(245, 78, 37, 0.08)',
  brandSurface: '#FFF7ED', // soft orange plate background (orange-50)
  brandSurfaceBorder: '#FED7AA', // orange-200

  // ── Ink & neutrals (navy + slate ramp) ─────────────────────────────────
  navy: '#1B2559',
  slate900: '#0F172A',
  slate800: '#1E293B',
  slate700: '#334155',
  slate600: '#475569',
  slate500: '#64748B',
  slate400: '#94A3B8',
  slate300: '#CBD5E1',
  slate200: '#E2E8F0',
  slate100: '#F1F5F9',
  slate50: '#F8FAFC',

  // Semantic text aliases
  text: '#334155',
  textStrong: '#1B2559',
  textMuted: '#64748B',
  textSubtle: '#94A3B8',
  textFaint: '#A3AED0',

  // ── Surfaces & borders ─────────────────────────────────────────────────
  bg: '#F8F9FD',
  bgAlt: '#F4F7FE',
  surface: '#FFFFFF',
  surface2: '#F8FAFF',
  border: '#E9EDF7',
  borderStrong: '#E2E8F0',

  // ── Accent (focus / links / indigo) ────────────────────────────────────
  indigo: '#4338CA',
  indigo500: '#6366F1',
  indigoTint: '#EEF2FF',

  // ── Semantic status ────────────────────────────────────────────────────
  success: '#10B981',
  successText: '#166534',
  successBg: '#F0FDF4',
  successBorder: '#BBF7D0',

  danger: '#DC2626',
  dangerStrong: '#BE123C',
  dangerBg: '#FEF2F2',
  dangerBorder: '#FECACA',

  info: '#1D4ED8',
  infoBg: '#EFF6FF',
  infoBorder: '#BFDBFE',

  warning: '#D97706',
  warningBg: '#FFFBEB',
  warningBorder: '#FDE68A',
} as const;

/** Spacing (8px grid, 4px half-step) — numbers for RN style props. */
export const SPACE = {
  half: 4,
  1: 8,
  2: 16,
  3: 24,
  4: 32,
  5: 40,
  6: 48,
  8: 64,
} as const;

/** Border radius scale. */
export const RADIUS = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 14,
  xl: 18,
  '2xl': 24,
  pill: 999,
} as const;

/** Type scale (font sizes in px). */
export const FONT = {
  xs: 12,
  sm: 13,
  base: 14,
  md: 15,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
} as const;

/**
 * Elevation presets — cross-platform (iOS shadow* + Android elevation).
 * Spread into a StyleSheet entry: `{ ...SHADOW.card }`.
 */
export const SHADOW: Record<'sm' | 'card' | 'lg' | 'brand', ViewStyle> = {
  sm: Platform.select({
    ios: { shadowColor: BH.slate900, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
    android: { elevation: 2 },
    default: {},
  }) as ViewStyle,
  card: Platform.select({
    ios: { shadowColor: BH.slate900, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24 },
    android: { elevation: 6 },
    default: {},
  }) as ViewStyle,
  lg: Platform.select({
    ios: { shadowColor: BH.slate900, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 32 },
    android: { elevation: 12 },
    default: {},
  }) as ViewStyle,
  brand: Platform.select({
    ios: { shadowColor: BH.brand, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.22, shadowRadius: 6 },
    android: { elevation: 3 },
    default: {},
  }) as ViewStyle,
};

export type BHColor = (typeof BH)[keyof typeof BH];
