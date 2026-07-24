import { Text } from 'react-native';

// RN's <Text> is a function component in this RN/React version, and React 19
// dropped defaultProps support for function components — so patching
// Text.defaultProps (the classic RN trick for a global default font) is a
// silent no-op here. Instead we patch the JSX runtime that every <Text>
// element actually goes through, so a default fontFamily (matched to the
// component's fontWeight) is injected before render, with no per-screen edits.

const WEIGHT_TO_FAMILY: Record<string, string> = {
  '100': 'Inter_400Regular',
  '200': 'Inter_400Regular',
  '300': 'Inter_400Regular',
  normal: 'Inter_400Regular',
  '400': 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  '700': 'Inter_700Bold',
  '800': 'Inter_800ExtraBold',
  '900': 'Inter_900Black',
};

function flattenStyle(style: unknown): Record<string, unknown> {
  if (!style) return {};
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>((acc, s) => Object.assign(acc, flattenStyle(s)), {});
  }
  return style as Record<string, unknown>;
}

function withDefaultFont(type: unknown, props: unknown) {
  if (type !== Text || !props || typeof props !== 'object') return props;
  const p = props as { style?: unknown };
  const flat = flattenStyle(p.style);
  if (flat.fontFamily) return props;
  const weight = String(flat.fontWeight ?? '400');
  const family = WEIGHT_TO_FAMILY[weight] || 'Inter_400Regular';
  return { ...p, style: [p.style, { fontFamily: family }] };
}

type JsxRuntime = {
  jsx?: (type: unknown, props: unknown, key?: unknown) => unknown;
  jsxs?: (type: unknown, props: unknown, key?: unknown) => unknown;
  jsxDEV?: (type: unknown, props: unknown, ...rest: unknown[]) => unknown;
  __interPatched?: boolean;
};

let patched = false;

export function applyInterFontDefault() {
  if (patched) return;
  patched = true;

  const runtimes: JsxRuntime[] = [];
  try {
    runtimes.push(require('react/jsx-runtime'));
  } catch {}
  try {
    runtimes.push(require('react/jsx-dev-runtime'));
  } catch {}

  for (const runtime of runtimes) {
    if (!runtime || runtime.__interPatched) continue;
    runtime.__interPatched = true;

    const originalJsx = runtime.jsx;
    const originalJsxs = runtime.jsxs;
    const originalJsxDEV = runtime.jsxDEV;

    if (originalJsx) {
      runtime.jsx = (type, props, key) => originalJsx(type, withDefaultFont(type, props), key);
    }
    if (originalJsxs) {
      runtime.jsxs = (type, props, key) => originalJsxs(type, withDefaultFont(type, props), key);
    }
    if (originalJsxDEV) {
      runtime.jsxDEV = (type, props, ...rest) => originalJsxDEV(type, withDefaultFont(type, props), ...rest);
    }
  }
}
