import type { Router } from 'expo-router';
import { supabase } from './supabase';
import { invalidateFamilyUserCacheMobile } from './useFamilyUserMobile';

/** Sign out and return to login — works on native and web. */
export async function performFamilyLogoutMobile(router: Router): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: 'global' });
  } catch {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      /* still navigate away */
    }
  }

  invalidateFamilyUserCacheMobile();

  if (typeof router.dismissAll === 'function') {
    router.dismissAll();
  }
  router.replace('/login' as never);
}
