import React from 'react';
import { useFamilyUserMobile } from '../../lib/useFamilyUserMobile';
import { useActiveAnnouncements } from '../../lib/useActiveAnnouncements';
import { AnnouncementPopupFrame } from './AnnouncementPopupFrame';

/**
 * Self-contained promo popup for the family/mobile app — no props, mounts once at the Home
 * screen root. Shows the oldest-first queue of currently-active, not-yet-dismissed
 * announcements as a premium promotional card, one at a time with pagination dots when more
 * than one is active. Dismissing removes the front item, so the next one moves to the front.
 */
export function AnnouncementPopup() {
  const { userId } = useFamilyUserMobile();
  const { unseen, dismiss } = useActiveAnnouncements(userId);
  const current = unseen[0];

  const handleGotIt = () => {
    if (!current) return;
    dismiss(current.id);
  };

  return (
    <AnnouncementPopupFrame
      visible={Boolean(current)}
      onClose={handleGotIt}
      title={current?.title ?? ''}
      caption={current?.caption}
      imageUrl={current?.imageUrl}
      count={unseen.length}
      activeIndex={0}
    />
  );
}
