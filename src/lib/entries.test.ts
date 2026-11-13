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
				extraChime: true,
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
			extraChime: true,
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
					extraChime: false,
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

	it("keeps a recorded chime source across save/load", () => {
		const recorded = draft({
			chimeSource: ChimeSource.Recorded,
			chimeName: "Eigene Aufnahme",
			chimeDataUrl: "data:audio/webm;base64,REC",
			extraChime: true,
		});
		saveEntries([recorded]);
		expect(loadEntries()).toEqual([recorded]);
	});

	it("round-trips the extraChime flag through localStorage", () => {
		const withExtra = draft({ extraChime: true });
		saveEntries([withExtra]);
		expect(loadEntries()[0]?.extraChime).toBe(true);
		saveEntries([draft({ extraChime: false })]);
		expect(loadEntries()[0]?.extraChime).toBe(false);
	});

	it("migrates a legacy row with an own chime to extraChime=true (no silent mute)", () => {
		const legacy = {
			...draft({ chimeSource: ChimeSource.Custom, chimeDataUrl: "data:audio/mpeg;base64,AAA" }),
			extraChime: undefined,
		};
		localStorage.setItem(StorageKey.Entries, JSON.stringify([legacy]));
		expect(loadEntries()[0]?.extraChime).toBe(true);
	});

	it("migrates a legacy row with the default chime to extraChime=false", () => {
		const legacy = { ...draft(), extraChime: undefined };
		localStorage.setItem(StorageKey.Entries, JSON.stringify([legacy]));
		expect(loadEntries()[0]?.extraChime).toBe(false);
	});

	it("keeps an imported EventKit entry (externalId) across a cold restart", () => {
		const imported = {
			...draft({ id: "EK-1", title: "Vom iPhone Kalender", extraChime: false }),
			externalId: "EK-1",
		};
		localStorage.setItem(StorageKey.Entries, JSON.stringify([imported]));
		expect(loadEntries()).toEqual([imported]);
	});

	it("keeps a native-import row without the new extraChime flag (legacy device data)", () => {
		const legacy = {
			id: "EK-LEGACY",
			iso: "2026-11-13",
			time: "10:00",
			title: "Alt",
			category: "event",
			note: "",
			chimeSource: "default",
			chimeName: "Standard (Saraba)",
			chimeDataUrl: "",
			externalId: "EK-LEGACY",
		};
		localStorage.setItem(StorageKey.Entries, JSON.stringify([legacy]));
		expect(loadEntries()).toHaveLength(1);
		expect(loadEntries()[0]?.extraChime).toBe(false);
	});

	it("keeps the imported-holiday flag across save/load", () => {
		const holiday = draft({ id: "EK-H", isHoliday: true });
		saveEntries([holiday]);
		expect(loadEntries()[0]?.isHoliday).toBe(true);
		expect(loadEntries()[0]).toEqual(holiday);
	});

	it("survives corrupt JSON", () => {
		localStorage.setItem(StorageKey.Entries, "{not json");
		expect(loadEntries()).toEqual([]);
	});
});
