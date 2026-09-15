import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";

/**
 * ──────────────────────────────────────────────────────────────────────────
 *  Notification sound — in-app preview + "which tone plays on a new alert"
 * ──────────────────────────────────────────────────────────────────────────
 *
 *  Tones live in `assets/sounds/*.wav` (16-bit / 44.1 kHz, ~0.3–2 s each) and
 *  are also declared in app.json under ["expo-notifications", { "sounds": [...] }]
 *  so the same file plays for OS-level notifications while the app is closed.
 *  After changing the file list, rebuild the dev client (`npx expo prebuild`
 *  / EAS build) for the OS sounds to take effect.
 *
 *  To add a tone: drop the .wav in `assets/sounds/`, add a row to
 *  NOTIFICATION_SOUNDS below, and add the path to app.json's `sounds` array.
 */

export type NotificationSoundKey =
  | "default"
  | "chime"
  | "bell"
  | "ping"
  | "pop"
  | "soft"
  | "silent";

export const NOTIFICATION_SOUNDS: {
  key: NotificationSoundKey;
  label: string;
  /** `require(...)` of the bundled audio file, or null for "Silent". */
  module: number | null;
  /** Filename expo-notifications expects for the OS-level sound (Android/iOS). */
  osSound?: string;
}[] = [
  { key: "default", label: "Default", module: require("../assets/sounds/ding.wav"), osSound: "ding.wav" },
  { key: "chime", label: "Chime", module: require("../assets/sounds/chime.wav"), osSound: "chime.wav" },
  { key: "bell", label: "Bell", module: require("../assets/sounds/bell.wav"), osSound: "bell.wav" },
  { key: "ping", label: "Ping", module: require("../assets/sounds/ping.wav"), osSound: "ping.wav" },
  { key: "pop", label: "Pop", module: require("../assets/sounds/pop.wav"), osSound: "pop.wav" },
  { key: "soft", label: "Soft", module: require("../assets/sounds/soft.wav"), osSound: "soft.wav" },
  { key: "silent", label: "Silent", module: null, osSound: undefined },
];

const SOUND_KEY = "bh_notification_sound_v1";
const ENABLED_KEY = "bh_notification_sound_enabled_v1";
const MUTE_UNTIL_KEY = "bh_notification_mute_until_v1";

export function soundLabel(key: string): string {
  return NOTIFICATION_SOUNDS.find((s) => s.key === key)?.label ?? "Default";
}

export function soundKeyFromLabel(label: string): NotificationSoundKey {
  return NOTIFICATION_SOUNDS.find((s) => s.label.toLowerCase() === String(label).toLowerCase())?.key ?? "default";
}

/** OS-sound filename for the currently selected tone (for expo-notifications). */
export async function getSelectedOsSound(): Promise<string | undefined> {
  const key = await getSelectedSound();
  return NOTIFICATION_SOUNDS.find((s) => s.key === key)?.osSound;
}

// ── Persisted preferences ───────────────────────────────────────────────────

export async function getSelectedSound(): Promise<NotificationSoundKey> {
  try {
    const v = await AsyncStorage.getItem(SOUND_KEY);
    if (v && NOTIFICATION_SOUNDS.some((s) => s.key === v)) return v as NotificationSoundKey;
  } catch {
    /* ignore */
  }
  return "chime";
}

export async function setSelectedSound(keyOrLabel: string): Promise<void> {
  const key = NOTIFICATION_SOUNDS.some((s) => s.key === keyOrLabel)
    ? (keyOrLabel as NotificationSoundKey)
    : soundKeyFromLabel(keyOrLabel);
  try {
    await AsyncStorage.setItem(SOUND_KEY, key);
  } catch {
    /* ignore */
  }
}

export async function getSoundEnabled(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(ENABLED_KEY);
    return v == null ? true : v === "1";
  } catch {
    return true;
  }
}

export async function setSoundEnabled(on: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(ENABLED_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** Epoch ms until which alerts are muted; 0 = not muted. `-1` = "until I change it". */
export async function getMuteUntil(): Promise<number> {
  try {
    const n = Number(await AsyncStorage.getItem(MUTE_UNTIL_KEY));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export async function setMuteUntil(ms: number): Promise<void> {
  try {
    await AsyncStorage.setItem(MUTE_UNTIL_KEY, String(ms));
  } catch {
    /* ignore */
  }
}

export async function isMutedNow(): Promise<boolean> {
  const until = await getMuteUntil();
  if (until === -1) return true;
  return until > Date.now();
}

// ── Playback ────────────────────────────────────────────────────────────────

let activePlayer: ReturnType<typeof createAudioPlayer> | null = null;

/**
 * Play a notification tone right now.
 * @param opts.key       force a specific tone (key or label); default = the saved one
 * @param opts.ignorePrefs when true, always plays (used by the preview button)
 * @returns true if a sound actually started
 */
export async function playNotificationSound(opts?: {
  key?: string;
  ignorePrefs?: boolean;
}): Promise<boolean> {
  if (!opts?.ignorePrefs) {
    if (!(await getSoundEnabled())) return false;
    if (await isMutedNow()) return false;
  }

  const key = opts?.key
    ? NOTIFICATION_SOUNDS.some((s) => s.key === opts.key)
      ? (opts.key as NotificationSoundKey)
      : soundKeyFromLabel(opts.key)
    : await getSelectedSound();

  if (key === "silent") return false;
  const entry = NOTIFICATION_SOUNDS.find((s) => s.key === key);
  if (!entry?.module) return false; // no audio file wired yet — safe no-op

  try {
    await setAudioModeAsync({ playsInSilentMode: true });
    // Release any previous one-shot player.
    activePlayer?.remove();
    const player = createAudioPlayer(entry.module);
    activePlayer = player;
    player.play();
    const sub = player.addListener("playbackStatusUpdate", (status: { didJustFinish?: boolean }) => {
      if (status.didJustFinish) {
        sub.remove();
        player.remove();
        if (activePlayer === player) activePlayer = null;
      }
    });
    return true;
  } catch (e) {
    console.warn("[notificationSound] playback failed", e);
    return false;
  }
}
