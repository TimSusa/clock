import { describe, expect, it } from "vitest";
import { makeEntry } from "../test/fixtures";
import { HolidayMode, ListPeriod, PastMode } from "./enums";
import {
	filterByPeriod,
	holidayForIso,
	holidayLabelFor,
	isHoliday,
	isHolidayCalendar,
	isHolidayEvent,
} from "./list-filter";

const TODAY = new Date(2026, 10, 13, 12, 0, 0); // Friday, 13 Nov 2026

describe("isHolidayCalendar", () => {
	it("accepts a subscribed calendar", () => {
		expect(isHolidayCalendar({ id: "a", isSubscribed: true })).toBe(true);
	});

	it("accepts a subscription-type calendar", () => {
		expect(isHolidayCalendar({ id: "a", type: 3 })).toBe(true);
	});

	it("accepts a German/English holiday title", () => {
		expect(isHolidayCalendar({ id: "a", title: "Feiertage in Deutschland" })).toBe(true);
		expect(isHolidayCalendar({ id: "a", title: "Holidays in Germany" })).toBe(true);
	});

	it("rejects a normal calendar", () => {
		expect(isHolidayCalendar({ id: "a", title: "Todoist", isSubscribed: false, type: 2 })).toBe(
			false,
		);
	});
});

describe("isHolidayEvent (imported native calendar events)", () => {
	it("recognizes a Google holiday event by its description", () => {
		expect(
			isHolidayEvent({
				title: "Volkstrauertag",
				isAllDay: true,
				description:
					"Gedenktag\nWenn Sie Gedenktage ausblenden möchten, rufen Sie die Google Kalender-Einstellungen auf > Feiertage in Deutschland",
			}),
		).toBe(true);
	});

	it("recognizes common German memorial/holiday names in the title", () => {
		for (const title of [
			"Volkstrauertag",
			"Buß- und Bettag",
			"Totensonntag",
			"Reformationstag",
			"Fronleichnam",
			"Mariä Himmelfahrt",
			"Tag der Deutschen Einheit",
			"Weihnachten",
			"Ostermontag",
		]) {
			expect(isHolidayEvent({ title, isAllDay: true })).toBe(true);
		}
	});

	it("does NOT flag a normal all-day appointment", () => {
		expect(isHolidayEvent({ title: "Zahnarzt", isAllDay: true })).toBe(false);
		expect(isHolidayEvent({ title: "Team Sync", isAllDay: false })).toBe(false);
	});

	it("does NOT flag a regular named title without a holiday signal", () => {
		expect(isHolidayEvent({ title: "Geburtstag Mama", isAllDay: false })).toBe(false);
	});
});

describe("holidayForIso (German nationwide public holidays)", () => {
	it("detects fixed holidays", () => {
		expect(holidayForIso("2026-01-01")).toBe("Neujahr");
		expect(holidayForIso("2026-05-01")).toBe("Tag der Arbeit");
		expect(holidayForIso("2026-10-03")).toBe("Tag der Deutschen Einheit");
		expect(holidayForIso("2026-12-25")).toBe("1. Weihnachtstag");
		expect(holidayForIso("2026-12-26")).toBe("2. Weihnachtstag");
	});

	it("detects moveable holidays (Easter-based)", () => {
		expect(holidayForIso("2026-04-03")).toBe("Karfreitag");
		expect(holidayForIso("2026-04-06")).toBe("Ostermontag");
		expect(holidayForIso("2026-05-14")).toBe("Christi Himmelfahrt");
		expect(holidayForIso("2026-05-25")).toBe("Pfingstmontag");
	});

	it("labels an imported holiday from a subscribed calendar", () => {
		expect(
			holidayLabelFor(
				makeEntry({ id: "v", iso: "2026-11-15", title: "Volkstrauertag", isHoliday: true }),
			),
		).toBe("Volkstrauertag");
	});

	it("labels a computed public holiday", () => {
		expect(holidayLabelFor(makeEntry({ id: "x", iso: "2026-12-25" }))).toBe("1. Weihnachtstag");
	});

	it("returns null for an ordinary entry", () => {
		expect(holidayLabelFor(makeEntry({ id: "n", iso: "2026-11-13" }))).toBeNull();
	});

	it("returns null for an ordinary day", () => {
		expect(holidayForIso("2026-11-13")).toBeNull();
		expect(isHoliday("2026-11-13")).toBe(false);
	});
});

describe("filterByPeriod", () => {
	const entries = [
		makeEntry({ id: "today", iso: "2026-11-13", time: "09:00" }),
		makeEntry({ id: "thisWeek", iso: "2026-11-14", time: "09:00" }),
		makeEntry({ id: "thisMonth", iso: "2026-11-28", time: "09:00" }),
		makeEntry({ id: "nextMonth", iso: "2026-12-05", time: "09:00" }),
	];

	it("Day keeps only today", () => {
		expect(
			filterByPeriod(entries, ListPeriod.Day, HolidayMode.With, TODAY).map((e) => e.id),
		).toEqual(["today"]);
	});

	it("Week keeps the Monday..Sunday containing today", () => {
		expect(
			filterByPeriod(entries, ListPeriod.Week, HolidayMode.With, TODAY).map((e) => e.id),
		).toEqual(["today", "thisWeek"]);
	});

	it("Month keeps the current calendar month", () => {
		expect(
			filterByPeriod(entries, ListPeriod.Month, HolidayMode.With, TODAY).map((e) => e.id),
		).toEqual(["today", "thisWeek", "thisMonth"]);
	});

	it("All keeps everything", () => {
		expect(filterByPeriod(entries, ListPeriod.All, HolidayMode.With, TODAY)).toHaveLength(4);
	});

	it("Without hides entries falling on a public holiday", () => {
		const holiday = makeEntry({ id: "holiday", iso: "2026-12-25", time: "09:00" });
		const normal = makeEntry({ id: "normal", iso: "2026-12-24", time: "09:00" });
		expect(
			filterByPeriod([holiday, normal], ListPeriod.All, HolidayMode.Without, TODAY).map(
				(e) => e.id,
			),
		).toEqual(["normal"]);
	});

	it("With keeps entries falling on a public holiday", () => {
		const holiday = makeEntry({ id: "holiday", iso: "2026-12-25", time: "09:00" });
		expect(
			filterByPeriod([holiday], ListPeriod.All, HolidayMode.With, TODAY).map((e) => e.id),
		).toEqual(["holiday"]);
	});

	it("hides past entries by default (Hide), including earlier TODAY", () => {
		const past = [
			makeEntry({ id: "yesterday", iso: "2026-11-12", time: "09:00" }),
			makeEntry({ id: "earlierToday", iso: "2026-11-13", time: "08:00" }),
		];
		const future = makeEntry({ id: "laterToday", iso: "2026-11-13", time: "18:00" });
		expect(
			filterByPeriod([...past, future], ListPeriod.All, HolidayMode.With, TODAY, PastMode.Hide).map(
				(e) => e.id,
			),
		).toEqual(["laterToday"]);
	});

	it("Without ALSO hides entries imported from a subscribed holiday calendar", () => {
		const importedHoliday = makeEntry({
			id: "volkstrauertag",
			iso: "2026-11-15",
			time: "00:00",
			title: "Volkstrauertag",
			isHoliday: true,
		});
		const normal = makeEntry({ id: "normal", iso: "2026-11-15", time: "10:00" });
		expect(
			filterByPeriod([importedHoliday, normal], ListPeriod.All, HolidayMode.Without, TODAY).map(
				(e) => e.id,
			),
		).toEqual(["normal"]);
	});

	it("With keeps imported holidays", () => {
		const importedHoliday = makeEntry({ id: "h", iso: "2026-11-15", isHoliday: true });
		expect(
			filterByPeriod([importedHoliday], ListPeriod.All, HolidayMode.With, TODAY).map((e) => e.id),
		).toEqual(["h"]);
	});

	it("shows past entries when PastMode.Show is set", () => {
		const past = makeEntry({ id: "yesterday", iso: "2026-11-12", time: "09:00" });
		expect(
			filterByPeriod([past], ListPeriod.All, HolidayMode.With, TODAY, PastMode.Show).map(
				(e) => e.id,
			),
		).toEqual(["yesterday"]);
	});
});
