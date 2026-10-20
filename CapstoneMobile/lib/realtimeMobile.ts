import { supabase, isSupabaseConfigured } from './supabase';

/**
 * Generic Supabase Realtime subscribe helper — same `.channel().on('postgres_changes', ...)`
 * shape already used in `subscribeSupportMessages` (supportMessagingMobile.ts), generalized so
 * screens don't each repeat the channel/unsubscribe boilerplate. Requires the target table to be
 * added to the `supabase_realtime` publication (see the matching Supabase migration) — otherwise
 * this silently receives nothing.
 * @returns unsubscribe function
 */
export function subscribeToTableChanges(
  channelName: string,
  table: string,
  filter: string,
  onChange: () => void
): () => void {
  if (!isSupabaseConfigured()) return () => {};
  // Unique per subscription: several mounted screens may watch the same table (e.g. the header
  // bell and the Notifications screen), and reusing one channel name would hand the second caller
  // the first caller's already-subscribed channel.
  const channel = supabase
    .channel(`${channelName}-${Math.random().toString(36).slice(2, 10)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table, filter }, () => onChange())
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
