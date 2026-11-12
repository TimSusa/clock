import { defaultChime } from "../lib/chime";
import { EntryCategory } from "../lib/enums";
import type { CalendarEntry } from "../lib/types";

/** Canonical entry factory for tests: one place, no scattered literals. */
export function makeEntry(overrides: Partial<CalendarEntry> = {}): CalendarEntry {
	return {
		id: "fixed-id",
		iso: "2026-11-12",
		time: "09:00",
		title: "Termin",
		category: EntryCategory.Event,
		note: "",
		...defaultChime(),
		...overrides,
	};
}
