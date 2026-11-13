import { isValidTime, sortByDateTime } from "./alarm";
import { isValidEntryDate } from "./calendar";
import { defaultChime } from "./chime";
import { DEFAULT_CHIME_NAME, DEFAULT_TIME } from "./constants";
import { ChimeSource, EntryCategory, EntryValidationError, StorageKey } from "./enums";
import { newEntryId } from "./ids";
import { readCached, writeCached } from "./storage";
import type { CalendarEntry } from "./types";
import { parseYouTubeUrl } from "./youtube";

export interface EntryDraft {
	iso: string;
	time: string;
	title: string;
	category: EntryCategory;
	note: string;
	chimeSource: ChimeSource;
	chimeName: string;
	chimeDataUrl: string;
	extraChime: boolean;
}

function isEntryCategory(value: unknown): value is EntryCategory {
	return Object.values(EntryCategory).includes(value as EntryCategory);
}

/** Legacy rows (no time) are migrated to DEFAULT_TIME instead of being dropped. */
function normalizeEntry(value: unknown): CalendarEntry | null {
	if (typeof value !== "object" || value === null) return null;
	const e = value as Record<string, unknown>;
	if (
		typeof e.id !== "string" ||
		e.id.length === 0 ||
		typeof e.iso !== "string" ||
		!isValidEntryDate(e.iso) ||
		typeof e.title !== "string" ||
		e.title.length === 0 ||
		!isEntryCategory(e.category) ||
		typeof e.note !== "string"
	) {
		return null;
	}
	const custom =
		(e.chimeSource === ChimeSource.Custom || e.chimeSource === ChimeSource.Recorded) &&
		typeof e.chimeDataUrl === "string" &&
		e.chimeDataUrl.length > 0;
	const youtube =
		e.chimeSource === ChimeSource.YouTube &&
		typeof e.chimeDataUrl === "string" &&
		parseYouTubeUrl(e.chimeDataUrl) !== null;
	const chime =
		custom || youtube
			? {
					chimeSource: youtube
						? ChimeSource.YouTube
						: e.chimeSource === ChimeSource.Recorded
							? ChimeSource.Recorded
							: ChimeSource.Custom,
					chimeName:
						typeof e.chimeName === "string" && e.chimeName.length > 0
							? e.chimeName
							: DEFAULT_CHIME_NAME,
					chimeDataUrl: e.chimeDataUrl as string,
				}
			: defaultChime();
	const entry: CalendarEntry = {
		id: e.id,
		iso: e.iso,
		time: typeof e.time === "string" && isValidTime(e.time) ? e.time : DEFAULT_TIME,
		title: e.title,
		category: e.category,
		note: e.note,
		...chime,
		// Legacy rows predate the per-entry toggle. An own chime must keep ringing
		// (migrate to on); a bundled default stays off. Never silently mute.
		extraChime:
			typeof e.extraChime === "boolean" ? e.extraChime : chime.chimeSource !== ChimeSource.Default,
	};
	// The native calendar link must survive a reload (exactOptionalPropertyTypes:
	// only set the key when a real id exists, never assign undefined).
	if (typeof e.externalId === "string" && e.externalId.length > 0) {
		entry.externalId = e.externalId;
	}
	// Imported holidays must survive a reload, otherwise "Ohne Feiertage"
	// would silently stop hiding them after the next app start.
	if (e.isHoliday === true) {
		entry.isHoliday = true;
	}
	return entry;
}

export function validateDraft(draft: CalendarEntry): EntryValidationError | null {
	if (draft.title.trim().length === 0) return EntryValidationError.EmptyTitle;
	if (!isValidEntryDate(draft.iso)) return EntryValidationError.InvalidDate;
	if (!isValidTime(draft.time)) return EntryValidationError.InvalidTime;
	return null;
}

export function createEntry(draft: EntryDraft, makeId: () => string = newEntryId): CalendarEntry {
	return {
		id: makeId(),
		iso: draft.iso,
		time: draft.time,
		title: draft.title.trim(),
		category: draft.category,
		note: draft.note.trim(),
		chimeSource: draft.chimeSource,
		chimeName: draft.chimeName,
		chimeDataUrl: draft.chimeDataUrl,
		extraChime: draft.extraChime,
	};
}

export function addEntry(
	entries: readonly CalendarEntry[],
	entry: CalendarEntry,
): readonly CalendarEntry[] {
	if (entries.some((e) => e.id === entry.id)) {
		throw new Error(EntryValidationError.DuplicateId);
	}
	return [...entries, entry];
}

export function removeEntry(
	entries: readonly CalendarEntry[],
	id: string,
): readonly CalendarEntry[] {
	return entries.filter((entry) => entry.id !== id);
}

/** Replace an existing entry by id, preserving position and immutability. */
export function updateEntry(
	entries: readonly CalendarEntry[],
	updated: CalendarEntry,
): readonly CalendarEntry[] {
	return entries.map((entry) => (entry.id === updated.id ? updated : entry));
}

export const sortEntries = sortByDateTime;

export function saveEntries(entries: readonly CalendarEntry[]): void {
	writeCached(StorageKey.Entries, JSON.stringify(entries));
}

export function loadEntries(): readonly CalendarEntry[] {
	const raw = readCached(StorageKey.Entries);
	if (!raw) return [];
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.map(normalizeEntry).filter((e): e is CalendarEntry => e !== null);
	} catch {
		return [];
	}
}
