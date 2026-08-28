import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchActiveAnnouncements, type DbAnnouncement } from './announcementsDb';
import { subscribeToTableChanges } from './realtimeMobile';

const SEEN_ANNOUNCEMENT_IDS_PREFIX = 'bh_mobile_seen_announcement_ids_v1:';
const POLL_INTERVAL_MS = 30_000;

async function loadSeenIds(userId: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(`${SEEN_ANNOUNCEMENT_IDS_PREFIX}${userId}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

/**
 * Active announcements minus ones this guardian has already dismissed, kept fresh via mount
 * fetch + realtime subscription + a 30s poll. The poll exists because a pure show_from/hide_after
 * time boundary passing has no accompanying table write to trigger the realtime path, and RLS
 * hides a not-yet-active row's dates from this client entirely, so no local timer can be scheduled
 * against it ahead of time — see the Announcements feature plan for the full rationale.
 */
export function useActiveAnnouncements(userId: string) {
  const [items, setItems] = useState<DbAnnouncement[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [seenIdsLoaded, setSeenIdsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const active = await fetchActiveAnnouncements();
      setItems(active);
    } catch {
      /* ignore — keep previous items on transient failure */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userId.trim()) {
      setSeenIds(new Set());
      setSeenIdsLoaded(true);
      return;
    }
    let mounted = true;
    setSeenIdsLoaded(false);
    loadSeenIds(userId).then((ids) => {
      if (mounted) {
        setSeenIds(ids);
        setSeenIdsLoaded(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, [userId]);

  useEffect(() => {
    void reload();
    const interval = setInterval(() => void reload(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [reload]);

  useEffect(
    () =>
      subscribeToTableChanges('announcements-active', 'announcements', 'status=eq.published', () => void reload()),
    [reload]
  );

  const unseen = useMemo(() => items.filter((a) => !seenIds.has(a.id)), [items, seenIds]);

  const dismiss = useCallback(
    (id: string) => {
      if (!userId.trim()) return;
      setSeenIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        void AsyncStorage.setItem(`${SEEN_ANNOUNCEMENT_IDS_PREFIX}${userId}`, JSON.stringify(Array.from(next)));
        return next;
      });
    },
    [userId]
  );

  // Gate on seenIdsLoaded, not just loading: items can arrive before the async AsyncStorage
  // read resolves, and until it does, seenIds is an empty placeholder — so an already-dismissed
  // announcement would briefly count as unseen, flash open, then vanish the instant the real
  // seen-ids load and filter it back out.
  const ready = seenIdsLoaded;
  return { unseen: ready ? unseen : [], loading, dismiss, ready };
}
