import { internalExportText } from "./ical";
import type { CalendarEntry } from "./types";

export interface InternalSnapshot {
	ics: string;
	summary: string;
	count: number;
	updatedAt: number;
}

/**
 * Single auto-update entry point for the internal (file-less) export.
 * Called from a Svelte $effect whenever `entries` change - no user confirmation.
 */
export function syncInternalExport(
	entries: readonly CalendarEntry[],
	updatedAt: number = Date.now(),
): InternalSnapshot {
	return { ...internalExportText(entries), updatedAt };
}
