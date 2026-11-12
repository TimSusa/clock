import { describe, expect, it } from "vitest";
import { makeEntry } from "../test/fixtures";
import { buildAppointmentGroups, countByFilter, filterEntries } from "./appointments";
import { EntryCategory, EntryFilter } from "./enums";
import type { CalendarEntry } from "./types";

const today = new Date(2026, 10, 12);

function entry(
	id: string,
	iso: string,
	category: EntryCategory = EntryCategory.Event,
	title = "Termin",
	time = "09:00",
): CalendarEntry {
	return makeEntry({ id, iso, time, title, category });
}

const entries: readonly CalendarEntry[] = [
	entry("a", "2026-11-20", EntryCategory.Event, "Zahnarzt"),
	entry("b", "2026-11-10", EntryCategory.Reminder, "Rechnung"),
	entry("c", "2026-11-20", EntryCategory.Event, "Sport"),
	entry("d", "2026-12-01", EntryCategory.Note, "Idee"),
	entry("e", "2026-11-12", EntryCategory.Note, "Einkauf"),
];

describe("filterEntries", () => {
	it("returns all entries for the All filter", () => {
		expect(filterEntries(entries, EntryFilter.All)).toHaveLength(5);
	});

	it("keeps only events for the Event filter", () => {
		expect(filterEntries(entries, EntryFilter.Event).map((e) => e.id)).toEqual(["a", "c"]);
	});

	it("keeps only reminders", () => {
		expect(filterEntries(entries, EntryFilter.Reminder).map((e) => e.id)).toEqual(["b"]);
	});

	it("does not mutate the input array", () => {
		const original = [...entries];
		filterEntries(original, EntryFilter.Event);
		expect(original).toHaveLength(5);
	});
});

describe("countByFilter", () => {
	it("counts all entries", () => {
		expect(countByFilter(entries, EntryFilter.All)).toBe(5);
	});

	it("counts only notes", () => {
		expect(countByFilter(entries, EntryFilter.Note)).toBe(2);
	});
});

describe("buildAppointmentGroups", () => {
	it("groups by date in ascending order", () => {
		const groups = buildAppointmentGroups(entries, EntryFilter.All, today);
		expect(groups.map((g) => g.iso)).toEqual([
			"2026-11-10",
			"2026-11-12",
			"2026-11-20",
			"2026-12-01",
		]);
	});

	it("sorts titles alphabetically within a day", () => {
		const groups = buildAppointmentGroups(entries, EntryFilter.All, today);
		const group = groups.find((g) => g.iso === "2026-11-20");
		expect(group?.entries.map((e) => e.title)).toEqual(["Sport", "Zahnarzt"]);
	});

	it("marks past days relative to today (exclusive)", () => {
		const groups = buildAppointmentGroups(entries, EntryFilter.All, today);
		expect(groups.find((g) => g.iso === "2026-11-10")?.isPast).toBe(true);
		expect(groups.find((g) => g.iso === "2026-11-12")?.isPast).toBe(false);
		expect(groups.find((g) => g.iso === "2026-12-01")?.isPast).toBe(false);
	});

	it("renders a German long date label", () => {
		const groups = buildAppointmentGroups(entries, EntryFilter.All, today);
		expect(groups[2]?.label).toBe("Freitag, 20. November 2026");
	});

	it("applies the category filter before grouping", () => {
		const groups = buildAppointmentGroups(entries, EntryFilter.Note, today);
		expect(groups.map((g) => g.iso)).toEqual(["2026-11-12", "2026-12-01"]);
	});

	it("returns no groups when the filter matches nothing", () => {
		expect(buildAppointmentGroups([], EntryFilter.All, today)).toEqual([]);
	});
});
