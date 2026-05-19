import React, { useEffect, useState } from 'react';
import {
  FAMILY_PROFILE_AVATAR_CHANGED,
  loadFamilyProfileAvatar,
  resolveFamilyProfileAvatar,
} from '@/lib/familyProfileAvatar';

export default function FamilyHeaderAvatar({
  userId,
  initials = 'FU',
  onClick,
  className = 'user-avatar-top',
  size = 40,
  style,
  /** When false, render a div (e.g. inside another clickable sidebar row). */
  interactive = true,
}) {
  const [src, setSrc] = useState(() => loadFamilyProfileAvatar(userId));

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const local = loadFamilyProfileAvatar(userId);
      if (!cancelled && local) setSrc(local);
      const resolved = await resolveFamilyProfileAvatar(userId);
      if (!cancelled) setSrc(resolved);
    };
    refresh();
    const onChange = () => {
      setSrc(loadFamilyProfileAvatar(userId));
      void resolveFamilyProfileAvatar(userId).then((url) => {
        if (!cancelled) setSrc(url);
      });
    };
    window.addEventListener(FAMILY_PROFILE_AVATAR_CHANGED, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(FAMILY_PROFILE_AVATAR_CHANGED, onChange);
    };
  }, [userId]);

  const dimension = { width: size, height: size, minWidth: size, minHeight: size };
  const inner = src ? <img src={src} alt="" /> : initials;

  if (!interactive) {
    return (
      <div
        className={className}
        aria-hidden
        style={{
          ...dimension,
          ...(style || {}),
        }}
      >
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      aria-label="Open profile"
      style={{
        ...dimension,
        ...(style || {}),
      }}
    >
      {inner}
    </button>
  );
}
