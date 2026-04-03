/** Dispatch after Supabase mutations so the same tab refreshes lists (storage events do not fire for same-document writes). */
export const APP_DATA_REFRESH = 'bh_app_data_refresh';

export function refreshAppData() {
  try {
    window.dispatchEvent(new CustomEvent(APP_DATA_REFRESH));
  } catch {
    /* ignore */
  }
}
