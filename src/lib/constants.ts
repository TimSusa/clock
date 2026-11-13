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
