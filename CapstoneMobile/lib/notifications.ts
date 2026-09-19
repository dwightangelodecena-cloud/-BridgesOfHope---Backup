import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { supabase, isSupabaseConfigured } from "./supabase";
import {
  NOTIFICATION_SOUNDS,
  getSelectedSound,
  getSoundEnabled,
  isMutedNow,
} from "./notificationSound";

/**
 * ──────────────────────────────────────────────────────────────────────────
 *  OS-level notifications (banner + sound, even outside the app)
 * ──────────────────────────────────────────────────────────────────────────
 *
 *  WHAT WORKS WITH JUST THIS FILE
 *  • A local notification banner when the in-app sync spots a new alert
 *    (`notifyNewAlert`). Audio while the app is open is handled separately by
 *    `lib/notificationSound.ts` (expo-audio), so tones stay in sync with the
 *    user's picked sound without waiting on notification permissions.
 *
 *  PUSH WHILE THE APP IS CLOSED (FCM direct — no Expo push service):
 *  • `syncPushToken()` stores this device's raw FCM token + chosen tone in
 *    `device_push_tokens` (migration 20260901160000). Needs google-services.json
 *    (app.json → android.googleServicesFile) so Firebase Messaging initialises.
 *  • A trigger on `family_notifications` calls the `send-push-notification`
 *    Edge Function, which signs a JWT with FCM_SERVICE_ACCOUNT and POSTs to
 *    https://fcm.googleapis.com/v1/projects/<id>/messages:send.
 *  • Android sound per tone = one channel per tone (below); the Edge Function
 *    sends `channel_id: alerts_<tone>` to match.
 *
 *  NOTE: expo-audio, expo-notifications, and google-services.json all need a
 *  native rebuild (`npx expo run:android` / EAS).
 */

/** Android channel id for a given tone key, e.g. "chime" → "alerts_chime". */
export function channelIdForSound(soundKey: string): string {
  return `alerts_${soundKey || "default"}`;
}

let configured = false;

/** Call once on app start (e.g. in app/_layout.tsx). Safe to call repeatedly. */
export async function initNotifications(): Promise<void> {
  if (configured) return;
  configured = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        // Audio is handled in-app by lib/notificationSound.ts while the app is
        // open; this banner is the visual cue. Server push while the app is
        // closed plays its own sound (payload `sound` / Android channel).
        shouldPlaySound: false,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    if (Platform.OS === "android") {
      // One channel per tone — on Android 8+ the channel owns the sound, so a
      // single channel could only ever play one tone. Channel sound is frozen
      // at creation; changing a tone later just routes to a different channel.
      for (const s of NOTIFICATION_SOUNDS) {
        await Notifications.setNotificationChannelAsync(channelIdForSound(s.key), {
          name: `Alerts — ${s.label}`,
          importance: Notifications.AndroidImportance.HIGH,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          sound: s.key === "silent" ? undefined : s.osSound, // bundled filename, e.g. "chime.wav"
          vibrationPattern: s.key === "silent" ? undefined : [0, 250, 250, 250],
          lightColor: "#F54E25",
        });
      }
    }
  } catch (e) {
    console.warn("[notifications] init skipped (native module unavailable?)", e);
  }

  watchAuthForPush();
}

let authWatchRegistered = false;

/** Keep `device_push_tokens` in step with the auth session. */
function watchAuthForPush(): void {
  if (authWatchRegistered) return;
  authWatchRegistered = true;
  try {
    void syncPushToken(); // already-signed-in case (app cold start)
    supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") void syncPushToken();
      else if (event === "SIGNED_OUT") void clearPushToken();
    });
  } catch (e) {
    console.warn("[notifications] watchAuthForPush failed", e);
  }
}

/**
 * Ask permission + return the raw native push token.
 * Android → an FCM registration token; iOS → an APNs device token (hex).
 * The `send-push-notification` Edge Function talks to FCM directly, so we use
 * the device token, not an Expo push token (no Expo account needed).
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    let granted =
      settings.granted ||
      settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.granted;
    }
    if (!granted) return null;

    const token = await Notifications.getDevicePushTokenAsync(); // { type, data }
    return typeof token.data === "string" ? token.data : null;
  } catch (e) {
    console.warn("[notifications] registerForPushNotificationsAsync failed", e);
    return null;
  }
}

let lastSyncedToken: string | null = null;

/**
 * Register this device for push + store its Expo token in `device_push_tokens`
 * so the `send-push-notification` Edge Function can reach it while the app is
 * closed. Call after login and on app start when a session exists.
 */
export async function syncPushToken(): Promise<void> {
  try {
    if (!isSupabaseConfigured()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const token = await registerForPushNotificationsAsync();
    if (!token) return;

    const sound = await getSelectedSound();
    const platform = Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "unknown";

    const { error } = await supabase
      .from("device_push_tokens")
      .upsert(
        { user_id: user.id, token, platform, sound, updated_at: new Date().toISOString() },
        { onConflict: "user_id,token" }
      );
    if (error) {
      console.warn("[notifications] token upsert failed", error.message);
      return;
    }
    lastSyncedToken = token;
  } catch (e) {
    console.warn("[notifications] syncPushToken failed", e);
  }
}

/** Push the newly-chosen tone to the server row for this device. */
export async function syncPushSound(): Promise<void> {
  try {
    if (!isSupabaseConfigured() || !lastSyncedToken) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("device_push_tokens")
      .update({ sound: await getSelectedSound(), updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("token", lastSyncedToken);
  } catch (e) {
    console.warn("[notifications] syncPushSound failed", e);
  }
}

/** Remove this device's token on logout so it stops receiving pushes. */
export async function clearPushToken(): Promise<void> {
  try {
    if (!isSupabaseConfigured() || !lastSyncedToken) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("device_push_tokens")
        .delete()
        .eq("user_id", user.id)
        .eq("token", lastSyncedToken);
    }
    lastSyncedToken = null;
  } catch (e) {
    console.warn("[notifications] clearPushToken failed", e);
  }
}

/**
 * Fire a local notification for a freshly-detected alert. Honors the sound
 * toggle + mute window and uses the tone chosen in settings.
 */
export async function notifyNewAlert(title: string, body: string): Promise<void> {
  try {
    const key = await getSelectedSound();
    const muted = (await isMutedNow()) || !(await getSoundEnabled());
    // Android: the channel owns the sound. Route to the tone's channel (or the
    // silent one when off/muted). iOS: set sound on the notification itself.
    const channelId = channelIdForSound(muted ? "silent" : key);
    const iosSound =
      muted || key === "silent"
        ? false
        : key === "default"
          ? true
          : NOTIFICATION_SOUNDS.find((s) => s.key === key)?.osSound ?? true;

    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: iosSound },
      trigger:
        Platform.OS === "android"
          ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, channelId }
          : null,
    });
  } catch (e) {
    console.warn("[notifications] notifyNewAlert failed", e);
  }
}
