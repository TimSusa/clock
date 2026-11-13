/** Default HH:MM for legacy entries created before times existed. */
export const DEFAULT_TIME = "09:00";

/** Minimal interval of the wall-clock ticker in milliseconds. */
export const TICK_INTERVAL_MS = 1000;

/** Bundled default chime (served statically, never stored in localStorage). */
export const DEFAULT_CHIME_URL = "/chime-default.mp3";
export const DEFAULT_CHIME_NAME = "Standard (Saraba)";

/** iOS notifications need an explicit sound; must be <30s and bundled in the app. */
export const NOTIFICATION_SOUND = "chime-notification.wav";

/** localStorage is ~5 MB; keep custom audio well below that. */
export const MAX_CUSTOM_CHIME_BYTES = 1_500_000;

/**
 * ONE source of truth for the local audio file browser: extensions accepted
 * by the picker and the validator. normalizeOwnChime() transcodes any of them
 * to a real WAV, so the format only has to be decodable by the WebView.
 */
export const AUDIO_FILE_EXTENSIONS = ["mp3", "wav", "m4a", "aac", "ogg", "flac", "webm"] as const;

/** `accept` value for <input type="file">, derived from the same list. */
export const AUDIO_FILE_ACCEPT = AUDIO_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(",");
