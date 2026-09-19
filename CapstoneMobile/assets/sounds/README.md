# Notification sounds

Short tones (~0.3–2 s), 16‑bit / 44.1 kHz WAV so they work for both the
in‑app `expo-audio` preview and iOS's OS‑level notification sound.

| File        | Picker label |
| ----------- | ------------ |
| `ding.wav`  | Default      |
| `chime.wav` | Chime        |
| `bell.wav`  | Bell         |
| `ping.wav`  | Ping         |
| `pop.wav`   | Pop          |
| `soft.wav`  | Soft         |

## Adding / changing a tone

1. Drop the `.wav` here (avoid reserved names — `default`, `new`, etc. are
   rejected by the Android resource compiler; that's why "Default" is `ding.wav`).
2. Add a row to `NOTIFICATION_SOUNDS` in `lib/notificationSound.ts`.
3. Add the path to the `sounds` array of the `expo-notifications` plugin in
   `app.json`.
4. Rebuild the dev client (`npx expo run:android` / EAS) for the OS sound.

Sources: mixkit.co (Technology theme) and pixabay.com — both free for
commercial use, no attribution.
