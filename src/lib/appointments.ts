import { sortEntries } from "./entries";
import { EntryCategory, EntryFilter } from "./enums";
import { formatLongDate, isoDateKey, parseIsoDate } from "./time";
import type { AppointmentGroup, CalendarEntry } from "./types";

/** Maps a list filter to the category it selects (null = all). */
function categoryForFilter(filter: EntryFilter): EntryCategory | null {
	switch (filter) {
		case EntryFilter.Event:
			return EntryCategory.Event;
		case EntryFilter.Reminder:
			return EntryCategory.Reminder;
		case EntryFilter.Note:
			return EntryCategory.Note;
		case EntryFilter.All:
			return null;
	}
}

export function filterEntries(
	entries: readonly CalendarEntry[],
	filter: EntryFilter,
): readonly CalendarEntry[] {
	const category = categoryForFilter(filter);
	if (category === null) return [...entries];
	return entries.filter((entry) => entry.category === category);
}

export function countByFilter(entries: readonly CalendarEntry[], filter: EntryFilter): number {
	return filterEntries(entries, filter).length;
}

/** Chronological groups; titles sorted A–Z inside each day; "past" is strictly before today. */
export function buildAppointmentGroups(
	entries: readonly CalendarEntry[],
	filter: EntryFilter,
	today: Date,
): readonly AppointmentGroup[] {
	const selected = sortEntries(filterEntries(entries, filter));
	const todayKey = isoDateKey(today);
	const byDay = new Map<string, CalendarEntry[]>();

	for (const entry of selected) {
		const bucket = byDay.get(entry.iso);
		if (bucket) {
			bucket.push(entry);
		} else {
			byDay.set(entry.iso, [entry]);
		}
	}

	return [...byDay.entries()].map(([iso, groupEntries]) => ({
		iso,
		label: (() => {
			const date = parseIsoDate(iso);
			return date ? formatLongDate(date) : iso;
		})(),
		isPast: iso < todayKey,
		entries: groupEntries,
	}));
}
