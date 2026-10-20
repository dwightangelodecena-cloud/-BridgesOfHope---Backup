import React, { useState } from 'react';
import type { InboxItem } from '../../lib/useFamilyNotificationsInbox';
import { useActiveAnnouncements } from '../../lib/useActiveAnnouncements';
import { AnnouncementPopupFrame } from './AnnouncementPopupFrame';

type Props = {
  userId: string;
  /** The tapped announcement notification. Mount with key={item.id} so each open starts on it. */
  item: InboxItem;
  onClose: () => void;
};

/**
 * Opening an announcement notification shows the real popup card, read live from the
 * announcements table (realtime + poll), so admin edits appear immediately. Guardians can page
 * through every currently-active announcement, starting at the one they tapped. If that one has
 * since expired, the notification's stored text is shown with an "ended" note instead.
 */
export function NotificationAnnouncementModal({ userId, item, onClose }: Props) {
  const { all, loading, dismiss, ready } = useActiveAnnouncements(userId);
  const [selectedId, setSelectedId] = useState(item.relatedId || '');

  const liveIndex = all.findIndex((a) => a.id === selectedId);
  const live = liveIndex >= 0 ? all[liveIndex] : null;

  const close = () => {
    // Viewing it here counts as seeing it, so the Home popup won't show it again. Only once the
    // stored seen-list has loaded — dismiss() rewrites that whole list.
    if (item.relatedId && ready) dismiss(item.relatedId);
    onClose();
  };

  if (live) {
    return (
      <AnnouncementPopupFrame
        visible
        onClose={close}
        title={live.title}
        caption={live.caption}
        imageUrl={live.imageUrl}
        count={all.length}
        activeIndex={liveIndex}
        onSelectIndex={(i) => setSelectedId(all[i]?.id ?? selectedId)}
        notice={{ tone: 'live', text: all.length > 1 ? `Live now · ${liveIndex + 1} of ${all.length}` : 'Live now' }}
      />
    );
  }

  return (
    <AnnouncementPopupFrame
      visible
      onClose={close}
      title={item.title}
      caption={item.body !== item.title ? item.body : null}
      imageUrl={null}
      buttonLabel="Close"
      notice={loading ? null : { tone: 'ended', text: 'This announcement is no longer running' }}
    />
  );
}
