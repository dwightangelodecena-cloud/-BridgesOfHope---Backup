import { useEffect, useId } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { refreshAppData } from '@/lib/appDataRefresh';

/**
 * When staff update `patients.progress_percent` (recovery ladder save) or related rows,
 * refetch family UIs. Uses Supabase Realtime when enabled on the project, plus refetch on tab focus.
 */
export function useFamilyPatientProgressRealtime() {
  const instanceId = useId().replace(/:/g, '');
  useEffect(() => {
    if (!isSupabaseConfigured()) return undefined;
    let cancelled = false;
    const channelRef = { current: null };

    let debounceTimer = null;
    const run = () => {
      if (cancelled) return;
      if (debounceTimer) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null;
        if (!cancelled) refreshAppData();
      }, 600);
    };

    const onVis = () => {
      if (document.visibilityState === 'visible') run();
    };

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id || cancelled) return;

      document.addEventListener('visibilitychange', onVis);

      channelRef.current = supabase
        .channel(`family-patient-progress-${user.id}-${instanceId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'patients', filter: `family_id=eq.${user.id}` },
          run
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'patients', filter: `family_id=eq.${user.id}` },
          run
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (debounceTimer) window.clearTimeout(debounceTimer);
      document.removeEventListener('visibilitychange', onVis);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [instanceId]);
}
