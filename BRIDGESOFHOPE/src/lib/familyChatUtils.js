function isSameCalendarDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  );
}

export function getMessageDate(msg) {
  if (msg?.createdAt) {
    const d = new Date(msg.createdAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

export function formatChatDateLabel(date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameCalendarDay(date, today)) return 'Today';
  if (isSameCalendarDay(date, yesterday)) return 'Yesterday';

  const diffMs = today.setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0);
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays > 0 && diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function shouldShowChatDateSeparator(msg, prevMsg) {
  const date = getMessageDate(msg);
  if (!date) return false;
  const prevDate = getMessageDate(prevMsg);
  if (!prevDate) return true;
  return !isSameCalendarDay(date, prevDate);
}

export function countUnreadStaffMessages(messages, { chatOpen = false } = {}) {
  if (chatOpen) return 0;
  return (messages || []).filter(
    (m) => m.id !== 'welcome' && m.sender === 'staff' && !m.readByFamilyAt,
  ).length;
}
