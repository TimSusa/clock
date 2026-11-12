import { CalendarProvider } from "./enums";
import type { InternalSnapshot } from "./internal-sync";
import { syncInternalExport } from "./internal-sync";
import type { CalendarEntry } from "./types";

export interface BootstrapResult {
	entries: readonly CalendarEntry[];
	snapshot: InternalSnapshot;
	pendingConnections: readonly CalendarProvider[];
	connected: readonly CalendarProvider[];
}

/**
 * Startup bootstrap: import all existing local entries and build the internal
 * export snapshot in one step - no user confirmation needed for local data.
 * Remote providers are NEVER connected silently (OAuth requires a user gesture);
 * they are returned as pending so the UI can offer a "sign in again" button.
 */
export function bootstrapCalendar(
	stored: readonly CalendarEntry[],
	remoteImports: readonly CalendarEntry[] = [],
	savedConnections: readonly CalendarProvider[] = [],
): BootstrapResult {
	const byId = new Map<string, CalendarEntry>();
	for (const entry of [...stored, ...remoteImports]) {
		if (!byId.has(entry.id)) byId.set(entry.id, entry);
	}
	const entries = Array.from(byId.values());

	return {
		entries,
		snapshot: syncInternalExport(entries, 0),
		pendingConnections: savedConnections,
		connected: [],
	};
}
