/** Default HH:MM for legacy entries created before times existed. */
export const DEFAULT_TIME = "09:00";

/** Minimal interval of the wall-clock ticker in milliseconds. */
export const TICK_INTERVAL_MS = 1000;

/** Bundled default chime (served statically, never stored in localStorage). */
export const DEFAULT_CHIME_URL = "/chime-default.mp3";
export const DEFAULT_CHIME_NAME = "Standard (Saraba)";

/** localStorage is ~5 MB; keep custom audio well below that. */
export const MAX_CUSTOM_CHIME_BYTES = 1_500_000;
