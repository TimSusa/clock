import { describe, expect, it } from "vitest";
import { Locale, Weekday } from "./enums";
import {
	currentTimeKey,
	formatLongDate,
	isoDateKey,
	parseIsoDate,
	sameDay,
	toTimeParts,
	weekdayIso,
} from "./time";

const morning = new Date(2026, 10, 12, 9, 5, 7);

describe("toTimeParts", () => {
	it("reads local clock components", () => {
		expect(toTimeParts(morning)).toEqual({ hours: 9, minutes: 5, seconds: 7 });
	});
});

describe("formatLongDate", () => {
	it("renders a German long date", () => {
		expect(formatLongDate(morning, Locale.German)).toBe("Donnerstag, 12. November 2026");
	});
});

describe("currentTimeKey", () => {
	it("formats the current local time as HH:MM", () => {
		expect(currentTimeKey(new Date(2026, 10, 13, 14, 5, 37))).toBe("14:05");
	});

	it("pads single-digit hours and minutes", () => {
		expect(currentTimeKey(new Date(2026, 10, 13, 9, 7, 0))).toBe("09:07");
	});

	it("handles midnight", () => {
		expect(currentTimeKey(new Date(2026, 10, 13, 0, 0, 0))).toBe("00:00");
	});
});

describe("isoDateKey", () => {
	it("uses local calendar date, not UTC", () => {
		expect(isoDateKey(morning)).toBe("2026-11-12");
	});

	it("zero-pads month and day", () => {
		expect(isoDateKey(new Date(2026, 0, 3))).toBe("2026-01-03");
	});
});

describe("parseIsoDate", () => {
	it("round-trips an ISO key", () => {
		expect(parseIsoDate("2026-11-12")?.getTime()).toBe(new Date(2026, 10, 12).getTime());
	});

	it("rejects an impossible date", () => {
		expect(parseIsoDate("2026-02-31")).toBeNull();
	});

	it("rejects malformed input", () => {
		expect(parseIsoDate("12.11.2026")).toBeNull();
	});
});

describe("sameDay", () => {
	it("ignores the time of day", () => {
		expect(sameDay(morning, new Date(2026, 10, 12, 23, 59))).toBe(true);
	});

	it("detects a different day", () => {
		expect(sameDay(morning, new Date(2026, 10, 13))).toBe(false);
	});
});

describe("weekdayIso", () => {
	it("returns ISO weekday (Monday = 1)", () => {
		expect(weekdayIso(morning)).toBe(Weekday.Thursday);
	});
});
