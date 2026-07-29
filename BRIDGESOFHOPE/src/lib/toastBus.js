/** Fire-and-forget toast bus — same dispatch/listen shape as appDataRefresh.js, not a new paradigm. */
export const TOAST_EVENT = 'bh_toast';

export function showToast({ type = 'error', message, duration = 5000 } = {}) {
  if (!message) return;
  try {
    window.dispatchEvent(
      new CustomEvent(TOAST_EVENT, {
        detail: { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, type, message, duration },
      })
    );
  } catch {
    /* ignore */
  }
}

export function showErrorToast(message) {
  showToast({ type: 'error', message });
}

export function showSuccessToast(message) {
  showToast({ type: 'success', message });
}
