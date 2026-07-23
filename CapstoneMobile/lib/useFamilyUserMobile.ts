import { useEffect, useState } from 'react';
import { supabase } from './supabase';

type FamilyUserState = {
  userId: string;
  displayName: string;
  initials: string;
  loading: boolean;
};

let cached: Omit<FamilyUserState, 'loading'> | null = null;
let loadPromise: Promise<Omit<FamilyUserState, 'loading'>> | null = null;

// Safety net alongside the explicit invalidateFamilyUserCacheMobile() calls on logout:
// if the Supabase session's user ever changes without that call running first (e.g. a
// dev/test account switch), this clears the stale cache so the next read re-fetches the
// *current* signed-in user instead of leaking a previous account's name into the UI.
// Registered lazily (not at module scope) — Expo's web build server-renders this module in
// Node during `expo start`, and supabase-js's auth listener touches `window`, which doesn't
// exist there; calling onAuthStateChange at import time crashed every screen's SSR pass.
let lastKnownAuthUserId: string | null | undefined;
let authListenerRegistered = false;
function ensureAuthChangeListener() {
  if (authListenerRegistered) return;
  authListenerRegistered = true;
  supabase.auth.onAuthStateChange((_event, session) => {
    const uid = session?.user?.id || null;
    if (lastKnownAuthUserId !== undefined && uid !== lastKnownAuthUserId) {
      cached = null;
      loadPromise = null;
    }
    lastKnownAuthUserId = uid;
  });
}

export function deriveFamilyInitials(name: string): string {
  return (
    String(name || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('') || 'FU'
  );
}

async function fetchFamilyUser(): Promise<Omit<FamilyUserState, 'loading'>> {
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  let resolvedName =
    (user?.user_metadata?.full_name as string | undefined)?.trim() ||
    [user?.user_metadata?.first_name, user?.user_metadata?.last_name].filter(Boolean).join(' ').trim() ||
    'Family User';

  if (user?.id) {
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();
    if (profileRow?.full_name?.trim()) resolvedName = profileRow.full_name.trim();
  }

  return {
    userId: user?.id || 'local-family',
    displayName: resolvedName,
    initials: deriveFamilyInitials(resolvedName),
  };
}

/** Cached family user — same idea as web `useFamilyUser` for consistent header across tabs. */
export function useFamilyUserMobile(): FamilyUserState {
  const [state, setState] = useState<FamilyUserState>(
    () =>
      cached
        ? { ...cached, loading: false }
        : { userId: '', displayName: 'Family User', initials: 'FU', loading: true }
  );

  useEffect(() => {
    ensureAuthChangeListener();

    if (cached) {
      setState({ ...cached, loading: false });
      return undefined;
    }

    let mounted = true;
    if (!loadPromise) {
      loadPromise = fetchFamilyUser().finally(() => {
        loadPromise = null;
      });
    }

    loadPromise.then((user) => {
      cached = user;
      if (mounted) setState({ ...user, loading: false });
    });

    return () => {
      mounted = false;
    };
  }, []);

  return state;
}

export function invalidateFamilyUserCacheMobile() {
  cached = null;
  loadPromise = null;
}
