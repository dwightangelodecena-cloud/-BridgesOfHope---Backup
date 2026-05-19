import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

let cachedUser = null;
let loadPromise = null;

export function deriveFamilyInitials(name) {
  return (
    String(name || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'FU'
  );
}

async function fetchFamilyUser() {
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  const fallbackProfile = localStorage.getItem('bh_family_profile');
  let fallbackName = null;
  try {
    fallbackName = fallbackProfile ? JSON.parse(fallbackProfile).fullName : null;
  } catch {
    fallbackName = null;
  }

  let resolvedName =
    user?.user_metadata?.full_name ||
    [user?.user_metadata?.first_name, user?.user_metadata?.last_name].filter(Boolean).join(' ') ||
    fallbackName ||
    'Family User';

  if (user?.id) {
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();
    if (profileRow?.full_name) resolvedName = profileRow.full_name;
  }

  return {
    userId: user?.id || 'local-family',
    displayName: resolvedName,
    initials: deriveFamilyInitials(resolvedName),
  };
}

/** Cached family user for consistent header across page navigations. */
export function useFamilyUser() {
  const [state, setState] = useState(
    () =>
      cachedUser || {
        userId: '',
        displayName: 'Family User',
        initials: 'FU',
        loading: true,
      }
  );

  useEffect(() => {
    if (cachedUser) {
      setState({ ...cachedUser, loading: false });
      return undefined;
    }

    let mounted = true;
    if (!loadPromise) {
      loadPromise = fetchFamilyUser()
        .then((user) => {
          cachedUser = user;
          return user;
        })
        .finally(() => {
          loadPromise = null;
        });
    }

    loadPromise
      .then((user) => {
        if (mounted) setState({ ...user, loading: false });
      })
      .catch(() => {
        if (mounted) {
          setState({
            userId: 'local-family',
            displayName: 'Family User',
            initials: 'FU',
            loading: false,
          });
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return state;
}

export function invalidateFamilyUserCache() {
  cachedUser = null;
  loadPromise = null;
}
