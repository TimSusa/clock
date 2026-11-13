import type { CalendarEntry } from "./types";

/**
 * Merge native calendar events into the local store at startup.
 * An event is considered already present when its id matches a local id OR
 * when any local entry carries the same `externalId` (the link created when
 * we pushed to EventKit). Locals stay the source of truth — their chime, note
 * and category must never be overwritten by an import.
 */
export function mergeImportedEvents(
	local: readonly CalendarEntry[],
	imported: readonly CalendarEntry[],
): readonly CalendarEntry[] {
	const seenIds = new Set(local.map((e) => e.id));
	const seenExternalIds = new Set(local.flatMap((e) => (e.externalId ? [e.externalId] : [])));
	// EventKit returns one entry per occurrence of a recurring event, all sharing
	// the same eventIdentifier. Without intra-import dedupe these collapse into
	// duplicate keys in Svelte's keyed {#each} (each_key_duplicate, blank screen).
	const holidayIds = new Set(imported.filter((event) => event.isHoliday).map((event) => event.id));
	const additions = imported.filter((event) => {
		if (seenIds.has(event.id)) return false;
		if (event.externalId && seenExternalIds.has(event.externalId)) return false;
		seenIds.add(event.id);
		if (event.externalId) seenExternalIds.add(event.externalId);
		return true;
	});
	// Events imported by an older version have no isHoliday flag. The fresh
	// import carries it, but is discarded as a duplicate - so upgrade ONLY that
	// metadata on the existing local row (never overwrite title/chime/note).
	const upgraded =
		holidayIds.size === 0
			? local
			: local.map((entry) => (holidayIds.has(entry.id) ? { ...entry, isHoliday: true } : entry));
	return additions.length === 0 ? upgraded : [...upgraded, ...additions];
}
