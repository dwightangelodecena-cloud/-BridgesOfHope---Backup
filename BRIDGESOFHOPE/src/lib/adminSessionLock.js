// Admin idle lock (see RoleGuard) persisted in localStorage so a page refresh or a new tab
// can't skip the password prompt. Only a correct unlock password or a fresh login clears it.

const KEY_PREFIX = 'bh_admin_session_locked:';

export function adminSessionLockKey(userId) {
  return `${KEY_PREFIX}${userId}`;
}

export function isAdminSessionLocked(userId) {
  if (!userId) return false;
  try {
    return localStorage.getItem(adminSessionLockKey(userId)) === '1';
  } catch {
    return false;
  }
}

export function setAdminSessionLocked(userId, locked) {
  if (!userId) return;
  try {
    if (locked) localStorage.setItem(adminSessionLockKey(userId), '1');
    else localStorage.removeItem(adminSessionLockKey(userId));
  } catch {
    /* storage unavailable — lock still applies for this page view */
  }
}

/** Called after a successful password / OAuth login: the user just proved who they are. */
export function clearAllAdminSessionLocks() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(KEY_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
