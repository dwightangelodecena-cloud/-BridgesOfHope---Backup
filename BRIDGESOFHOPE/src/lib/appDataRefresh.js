/** Dispatch after Supabase mutations so the same tab refreshes lists (storage events do not fire for same-document writes). */
export const APP_DATA_REFRESH = 'bh_app_data_refresh';

const REFRESH_DEBOUNCE_MS = 900;
let refreshTimer = null;
let lastRefreshAt = 0;

function fireRefresh() {
  lastRefreshAt = Date.now();
  try {
    window.dispatchEvent(new CustomEvent(APP_DATA_REFRESH));
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(APP_DATA_REFRESH, String(lastRefreshAt));
  } catch {
    /* ignore — quota full should not crash the app */
  }
}

/** Debounced so realtime + many taps do not stack heavy reloads (mobile white-screen / freeze). */
export function refreshAppData() {
  const now = Date.now();
  if (now - lastRefreshAt >= REFRESH_DEBOUNCE_MS) {
    if (refreshTimer) {
      window.clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    fireRefresh();
    return;
  }
  if (refreshTimer) window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => {
    refreshTimer = null;
    fireRefresh();
  }, REFRESH_DEBOUNCE_MS);
}
