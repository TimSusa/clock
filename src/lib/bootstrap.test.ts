import { describe, expect, it } from "vitest";
import { makeEntry } from "../test/fixtures";
import { bootstrapCalendar } from "./bootstrap";
import { CalendarProvider } from "./enums";

describe("bootstrapCalendar", () => {
	it("imports all existing local entries at startup without confirmation", () => {
		const stored = [
			makeEntry({ id: "a", title: "Alt" }),
			makeEntry({ id: "b", title: "Alt2", iso: "2026-12-24" }),
		];
		const result = bootstrapCalendar(stored, []);
		expect(result.entries).toHaveLength(2);
		expect(result.snapshot.count).toBe(2);
		expect(result.snapshot.ics).toContain("SUMMARY:Alt");
	});

	it("merges remote imports without duplicating ids", () => {
		const stored = [makeEntry({ id: "a" })];
		const result = bootstrapCalendar(stored, [makeEntry({ id: "a" }), makeEntry({ id: "b" })]);
		expect(result.entries.map((e) => e.id)).toEqual(["a", "b"]);
	});

	it("lists configured providers that still need a user click", () => {
		const result = bootstrapCalendar([], [], [CalendarProvider.Google, CalendarProvider.Apple]);
		expect(result.pendingConnections).toEqual([CalendarProvider.Google, CalendarProvider.Apple]);
	});

	it("never silently connects remote providers", () => {
		const result = bootstrapCalendar([], [], [CalendarProvider.Google]);
		expect(result.connected).toEqual([]);
	});
});
