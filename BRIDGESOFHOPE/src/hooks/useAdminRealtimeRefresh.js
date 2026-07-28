import { useEffect, useId } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { refreshAppData } from '@/lib/appDataRefresh';

/**
 * Admin/staff counterpart to useFamilyPatientProgressRealtime: pushes a debounced refreshAppData()
 * when patients or admission_requests change, instead of only refetching on manual Refresh.
 * Unfiltered (staff sees every resident) — this facility has ~50 residents total, trivial load.
 */
export function useAdminRealtimeRefresh() {
  const instanceId = useId().replace(/:/g, '');
  useEffect(() => {
    if (!isSupabaseConfigured()) return undefined;
    let cancelled = false;
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
    document.addEventListener('visibilitychange', onVis);

    const channel = supabase
      .channel(`admin-realtime-refresh-${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, run)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admission_requests' }, run)
      .subscribe();

    return () => {
      cancelled = true;
      if (debounceTimer) window.clearTimeout(debounceTimer);
      document.removeEventListener('visibilitychange', onVis);
      supabase.removeChannel(channel);
    };
  }, [instanceId]);
}
