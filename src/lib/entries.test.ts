import { beforeEach, describe, expect, it } from "vitest";
import { makeEntry } from "../test/fixtures";
import { DEFAULT_CHIME_NAME, DEFAULT_TIME } from "./constants";
import {
	addEntry,
	createEntry,
	loadEntries,
	removeEntry,
	saveEntries,
	sortEntries,
	updateEntry,
	validateDraft,
} from "./entries";
import { ChimeSource, EntryCategory, EntryValidationError, StorageKey } from "./enums";
import type { CalendarEntry } from "./types";

const iso = "2026-11-12";
const time = "15:30";

function draft(overrides: Partial<CalendarEntry> = {}): CalendarEntry {
	return makeEntry({ id: "fixed-id", iso, time, title: "Zahnarzt", ...overrides });
}

describe("validateDraft", () => {
	it("accepts a complete draft", () => {
		expect(validateDraft(draft())).toBeNull();
	});

	it("rejects a blank title", () => {
		expect(validateDraft(draft({ title: "   " }))).toBe(EntryValidationError.EmptyTitle);
	});

	it("rejects an impossible date", () => {
		expect(validateDraft(draft({ iso: "2026-02-31" }))).toBe(EntryValidationError.InvalidDate);
	});

	it("rejects an invalid time", () => {
		expect(validateDraft(draft({ time: "25:99" }))).toBe(EntryValidationError.InvalidTime);
	});
});

describe("createEntry", () => {
	it("trims the title and note and keeps the chime fields", () => {
		const entry = createEntry(
			{
				iso,
				time,
				title: "  Team Sync  ",
				category: EntryCategory.Reminder,
				note: "  Raum 3  ",
				chimeSource: ChimeSource.Custom,
				chimeName: "Mein Ton",
				chimeDataUrl: "data:audio/mpeg;base64,AAA",
			},
			() => "id-1",
		);
		expect(entry).toEqual({
			id: "id-1",
			iso,
			time,
			title: "Team Sync",
			category: EntryCategory.Reminder,
			note: "Raum 3",
			chimeSource: ChimeSource.Custom,
			chimeName: "Mein Ton",
			chimeDataUrl: "data:audio/mpeg;base64,AAA",
		});
	});

	it("generates unique ids on successive calls", () => {
		let n = 0;
		const make = () =>
			createEntry(
				{
					iso,
					time,
					title: "X",
					category: EntryCategory.Note,
					note: "",
					chimeSource: ChimeSource.Default,
					chimeName: DEFAULT_CHIME_NAME,
					chimeDataUrl: "",
				},
				() => `id-${++n}`,
			);
		expect(make().id).not.toBe(make().id);
	});
});

describe("addEntry / removeEntry / updateEntry", () => {
	it("appends a new entry without mutating the input", () => {
		const original: CalendarEntry[] = [];
		const result = addEntry(original, draft());
		expect(original).toEqual([]);
		expect(result).toHaveLength(1);
	});

	it("rejects a duplicate id", () => {
		expect(() => addEntry([draft()], draft())).toThrow(EntryValidationError.DuplicateId);
	});

	it("removes by id and leaves other entries", () => {
		const list = [draft(), draft({ id: "other", title: "Anderer" })];
		expect(removeEntry(list, "fixed-id").map((e) => e.id)).toEqual(["other"]);
	});

	it("updates by id preserving order", () => {
		const list = [draft(), draft({ id: "other" })];
		expect(updateEntry(list, draft({ title: "Neu" }))[0]?.title).toBe("Neu");
	});
});

describe("sortEntries", () => {
	it("sorts by date, then time, then case-insensitive title", () => {
		const list = [
			draft({ id: "3", iso: "2026-11-12", time: "20:00", title: "zeta" }),
			draft({ id: "1", iso: "2026-11-10", time: "23:00", title: "Zulu" }),
			draft({ id: "2", iso: "2026-11-12", time: "08:00", title: "Alpha" }),
		];
		expect(sortEntries(list).map((e) => e.id)).toEqual(["1", "2", "3"]);
	});
});

describe("loadEntries / saveEntries", () => {
	beforeEach(() => localStorage.clear());

	it("returns an empty array when nothing is stored", () => {
		expect(loadEntries()).toEqual([]);
	});

	it("round-trips entries through localStorage", () => {
		saveEntries([draft()]);
		expect(loadEntries()).toEqual([draft()]);
	});

	it("drops malformed records instead of throwing", () => {
		localStorage.setItem(StorageKey.Entries, JSON.stringify([{ id: "bad" }, null, 42, draft()]));
		expect(loadEntries()).toEqual([draft()]);
	});

	it("migrates a legacy record without time and chime to defaults", () => {
		const legacy = { ...draft(), time: undefined, chimeSource: undefined };
		localStorage.setItem(StorageKey.Entries, JSON.stringify([legacy]));
		expect(loadEntries()).toEqual([draft({ time: DEFAULT_TIME })]);
	});

	it("replaces an invalid stored time with DEFAULT_TIME", () => {
		localStorage.setItem(StorageKey.Entries, JSON.stringify([draft({ time: "99:99" })]));
		expect(loadEntries()).toEqual([draft({ time: DEFAULT_TIME })]);
	});

	it("survives corrupt JSON", () => {
		localStorage.setItem(StorageKey.Entries, "{not json");
		expect(loadEntries()).toEqual([]);
	});
});
