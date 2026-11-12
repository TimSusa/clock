import { describe, expect, it } from "vitest";
import { makeEntry } from "../test/fixtures";
import {
	buildMonthGrid,
	entriesForDate,
	formatMonthLabel,
	isLeapYear,
	shiftMonth,
	weekdayLabels,
} from "./calendar";
import { EntryCategory, Locale, Month, Weekday, WeekStart } from "./enums";
import type { CalendarEntry } from "./types";

const today = new Date(2026, 10, 12);

describe("isLeapYear", () => {
	it("recognises 2024 as a leap year", () => {
		expect(isLeapYear(2024)).toBe(true);
	});

	it("recognises 1900 as not a leap year", () => {
		expect(isLeapYear(1900)).toBe(false);
	});

	it("recognises 2000 as a leap year", () => {
		expect(isLeapYear(2000)).toBe(true);
	});
});

describe("shiftMonth", () => {
	it("moves forward across a year boundary", () => {
		expect(shiftMonth(2026, Month.December, 1)).toEqual([2027, Month.January]);
	});

	it("moves backward across a year boundary", () => {
		expect(shiftMonth(2026, Month.January, -1)).toEqual([2025, Month.December]);
	});
});

describe("formatMonthLabel", () => {
	it("renders German month and year", () => {
		expect(formatMonthLabel(2026, Month.November, Locale.German)).toBe("November 2026");
	});
});

describe("weekdayLabels", () => {
	it("starts with Monday for the German locale", () => {
		expect(weekdayLabels(WeekStart.Monday, Locale.German)[0]).toBe("Mo");
	});
});

describe("buildMonthGrid", () => {
	it("returns exactly 35 cells for September 2026 (five weeks)", () => {
		expect(buildMonthGrid(2026, Month.September, today).cells).toHaveLength(35);
	});

	it("starts on the Monday before the 1st", () => {
		const cells = buildMonthGrid(2026, Month.November, today).cells;
		expect(cells[0]?.iso).toBe("2026-10-26");
		expect(cells[0]?.inMonth).toBe(false);
	});

	it("ends on Sunday and covers all 30 days", () => {
		const cells = buildMonthGrid(2026, Month.November, today).cells;
		expect(cells.at(-1)?.iso).toBe("2026-12-06");
		expect(cells.filter((c) => c.inMonth)).toHaveLength(30);
	});

	it("marks only 2026-11-12 as today", () => {
		const cells = buildMonthGrid(2026, Month.November, today).cells;
		expect(cells.filter((c) => c.isToday).map((c) => c.iso)).toEqual(["2026-11-12"]);
	});

	it("marks Saturday and Sunday as weekend", () => {
		const cells = buildMonthGrid(2026, Month.November, today).cells;
		const weekend = cells.filter((c) => c.isWeekend);
		expect(weekend).toHaveLength(12);
	});

	it("produces 42 cells for a month spanning six weeks", () => {
		expect(buildMonthGrid(2026, Month.August, today).cells).toHaveLength(42);
	});

	it("handles February in a leap year", () => {
		const cells = buildMonthGrid(2024, Month.February, today).cells;
		expect(cells.filter((c) => c.inMonth)).toHaveLength(29);
	});

	it("exposes German weekday labels in ISO order", () => {
		const grid = buildMonthGrid(2026, Month.November, today);
		expect(grid.weekdayLabels).toEqual(["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]);
	});
});

describe("entriesForDate", () => {
	const entries: readonly CalendarEntry[] = [
		makeEntry({ id: "a", iso: "2026-11-12", time: "09:00", title: "A" }),
		makeEntry({
			id: "b",
			iso: "2026-11-12",
			time: "10:00",
			title: "B",
			category: EntryCategory.Note,
		}),
		makeEntry({ id: "c", iso: "2026-11-13", time: "11:00", title: "C" }),
	];

	it("returns only entries of the requested date", () => {
		const result = entriesForDate([...entries], "2026-11-12");
		expect(result.map((e) => e.id)).toEqual(["a", "b"]);
	});

	it("returns an empty array when nothing matches", () => {
		expect(entriesForDate([...entries], "2026-11-20")).toEqual([]);
	});
});

describe("Weekday enum", () => {
	it("maps Sunday to 7", () => {
		expect(Weekday.Sunday).toBe(7);
	});
});
