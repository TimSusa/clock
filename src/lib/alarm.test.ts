import { describe, expect, it } from "vitest";
import { makeEntry } from "../test/fixtures";
import {
	combineDateTime,
	DEFAULT_TIME,
	formatTime,
	isValidTime,
	pendingAlarms,
	sortByDateTime,
	upcomingToday,
} from "./alarm";
import type { CalendarEntry } from "./types";

function entry(id: string, iso: string, time: string): CalendarEntry {
	return makeEntry({ id, iso, time, title: id });
}

describe("isValidTime", () => {
	it("accepts zero-padded HH:MM", () => {
		expect(isValidTime("09:30")).toBe(true);
		expect(isValidTime("23:59")).toBe(true);
	});

	it("rejects out-of-range and malformed values", () => {
		expect(isValidTime("24:00")).toBe(false);
		expect(isValidTime("12:60")).toBe(false);
		expect(isValidTime("9:30")).toBe(false);
		expect(isValidTime("")).toBe(false);
	});
});

describe("formatTime", () => {
	it("uses a German HH:mm display", () => {
		expect(formatTime("09:05")).toBe("09:05");
	});
});

describe("combineDateTime", () => {
	it("builds a local Date from an ISO day and HH:MM", () => {
		const date = combineDateTime("2026-11-12", "15:30");
		expect(date?.getFullYear()).toBe(2026);
		expect(date?.getMonth()).toBe(10);
		expect(date?.getDate()).toBe(12);
		expect(date?.getHours()).toBe(15);
		expect(date?.getMinutes()).toBe(30);
	});

	it("returns null for an invalid day", () => {
		expect(combineDateTime("2026-02-31", "10:00")).toBeNull();
	});
});

describe("sortByDateTime", () => {
	it("sorts by date then time then title", () => {
		const list = [
			entry("c", "2026-11-12", "08:00"),
			entry("a", "2026-11-12", "17:00"),
			entry("b", "2026-11-10", "23:00"),
		];
		expect(sortByDateTime(list).map((e) => e.id)).toEqual(["b", "c", "a"]);
	});
});

describe("upcomingToday", () => {
	it("returns only today's entries sorted by time", () => {
		const list = [
			entry("late", "2026-11-12", "18:00"),
			entry("other", "2026-11-13", "08:00"),
			entry("early", "2026-11-12", "07:30"),
		];
		expect(upcomingToday(list, "2026-11-12").map((e) => e.id)).toEqual(["early", "late"]);
	});

	it("falls back to DEFAULT_TIME for a legacy entry without time", () => {
		const legacy = makeEntry({
			id: "old",
			iso: "2026-11-12",
			title: "Alt",
			time: "",
		}) as unknown as CalendarEntry;
		expect(upcomingToday([legacy], "2026-11-12")[0]?.time).toBe(DEFAULT_TIME);
	});
});

describe("pendingAlarms", () => {
	it("fires exactly the entries whose time equals the current minute", () => {
		const now = new Date(2026, 10, 12, 9, 5, 30);
		const list = [
			entry("hit", "2026-11-12", "09:05"),
			entry("later", "2026-11-12", "09:06"),
			entry("past", "2026-11-12", "09:04"),
			entry("otherDay", "2026-11-13", "09:05"),
		];
		expect(pendingAlarms(list, now, []).map((e) => e.id)).toEqual(["hit"]);
	});

	it("never fires the same id twice", () => {
		const now = new Date(2026, 10, 12, 9, 5, 10);
		const list = [entry("hit", "2026-11-12", "09:05")];
		expect(pendingAlarms(list, now, ["hit"])).toEqual([]);
	});

	it("fires only within the matching minute (seconds ignored)", () => {
		const a = new Date(2026, 10, 12, 9, 5, 0);
		const b = new Date(2026, 10, 12, 9, 5, 59);
		const list = [entry("hit", "2026-11-12", "09:05")];
		expect(pendingAlarms(list, a, [])).toHaveLength(1);
		expect(pendingAlarms(list, b, [])).toHaveLength(1);
	});
});
