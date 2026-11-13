import { combineDateTime } from "./alarm";
import { HolidayMode, ListPeriod, PastMode } from "./enums";
import { isoDateKey, parseIsoDate } from "./time";
import type { CalendarEntry } from "./types";

/** Fixed, nationwide German public holidays (MM-DD → label). */
const FIXED_HOLIDAYS: Readonly<Record<string, string>> = {
	"01-01": "Neujahr",
	"05-01": "Tag der Arbeit",
	"10-03": "Tag der Deutschen Einheit",
	"12-25": "1. Weihnachtstag",
	"12-26": "2. Weihnachtstag",
	"12-31": "Silvester",
};

/** Gaussian Easter algorithm: returns the Easter Sunday Date for a given year. */
function easterSunday(year: number): Date {
	const a = year % 19;
	const b = Math.floor(year / 100);
	const c = year % 100;
	const d = Math.floor(b / 4);
	const e = b % 4;
	const f = Math.floor((b + 8) / 25);
	const g = Math.floor((b - f + 1) / 3);
	const h = (19 * a + b - d - g + 15) % 30;
	const i = Math.floor(c / 4);
	const k = c % 4;
	const l = (32 + 2 * e + 2 * i - h - k) % 7;
	const m = Math.floor((a + 11 * h + 22 * l) / 451);
	const month = Math.floor((h + l - 7 * m + 114) / 31);
	const day = ((h + l - 7 * m + 114) % 31) + 1;
	return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}

/** Moveable holidays are relative to Easter Sunday; computed once per year. */
function moveableHolidays(year: number): ReadonlyMap<string, string> {
	const easter = easterSunday(year);
	return new Map([
		[isoDateKey(addDays(easter, -2)), "Karfreitag"],
		[isoDateKey(addDays(easter, 1)), "Ostermontag"],
		[isoDateKey(addDays(easter, 39)), "Christi Himmelfahrt"],
		[isoDateKey(addDays(easter, 50)), "Pfingstmontag"],
	]);
}

/** Name of the German public holiday on an ISO day, or null. */
export function holidayForIso(iso: string): string | null {
	const date = parseIsoDate(iso);
	if (date === null) return null;
	const fixed = FIXED_HOLIDAYS[iso.slice(5)];
	if (fixed) return fixed;
	return moveableHolidays(date.getFullYear()).get(iso) ?? null;
}

export function isHoliday(iso: string): boolean {
	return holidayForIso(iso) !== null;
}

/** Structural + name signal for a holiday calendar (iOS/Google vary). */
export function isHolidayCalendar(calendar: {
	id?: string;
	title?: string | null;
	type?: number | null;
	isSubscribed?: boolean | null;
}): boolean {
	if (calendar.isSubscribed === true || calendar.type === 3) return true;
	const title = calendar.title?.toLowerCase() ?? "";
	return title.includes("feiertag") || title.includes("holiday");
}

/** German memorial/holiday names that are not nationwide days off. */
const HOLIDAY_TITLES: readonly string[] = [
	"volkstrauertag",
	"buß- und bettag",
	"buss- und bettag",
	"totensonntag",
	"ewigkeitssonntag",
	"reformationstag",
	"fronleichnam",
	"maria",
	"mariä",
	"heilige drei könige",
	"gründonnerstag",
	"aschermittwoch",
	"erntedankfest",
	"rosenmontag",
	"fastnacht",
	"karneval",
	"silvester",
	"weihnachten",
	"ostern",
	"ostermontag",
	"karfreitag",
	"pfingstmontag",
	"pfingsten",
	"himmelfahrt",
	"tag der deutschen einheit",
	"tag der arbeit",
	"neujahr",
	"gedenktag",
	"feiertag",
];

/**
 * Holiday signal on an IMPORTED native-calendar event. Works without a
 * reliable `calendarId`/`listCalendars()` result (iOS/Google vary): Google
 * puts "Feiertage in Deutschland" / "Gedenktage" in the description, and
 * memorial days carry a recognizable title. Pure + synchronous, so the flag
 * is set during import and cannot be lost by a late calendar lookup.
 */
export function isHolidayEvent(event: {
	title?: string | null;
	description?: string | null;
	isAllDay?: boolean | null;
}): boolean {
	const text = `${event.title ?? ""} ${event.description ?? ""}`.toLowerCase();
	if (text.includes("feiertag") || text.includes("gedenktag") || text.includes("holiday")) {
		return true;
	}
	if (!event.isAllDay) return false;
	return HOLIDAY_TITLES.some((name) => text.includes(name));
}

/**
 * Display label for ANY holiday - computed public holidays AND imported ones
 * from subscribed calendars. One source of truth for filter + UI badge.
 */
export function holidayLabelFor(entry: CalendarEntry): string | null {
	if (entry.isHoliday) return entry.title;
	return holidayForIso(entry.iso);
}

function mondayOfWeek(date: Date): Date {
	const offset = date.getDay() === 0 ? 6 : date.getDay() - 1;
	return addDays(date, -offset);
}

/** Inclusive period bounds as ISO day keys, or null for "All". */
function periodBounds(period: ListPeriod, now: Date): readonly [string, string] | null {
	switch (period) {
		case ListPeriod.Day:
			return [isoDateKey(now), isoDateKey(now)];
		case ListPeriod.Week: {
			const start = mondayOfWeek(now);
			return [isoDateKey(start), isoDateKey(addDays(start, 6))];
		}
		case ListPeriod.Month: {
			const start = new Date(now.getFullYear(), now.getMonth(), 1);
			const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
			return [isoDateKey(start), isoDateKey(end)];
		}
		case ListPeriod.All:
			return null;
	}
}

/** Pure list filter: one source of truth for period + holiday visibility. */
export function filterByPeriod(
	entries: readonly CalendarEntry[],
	period: ListPeriod,
	holidays: HolidayMode,
	now: Date,
	past: PastMode = PastMode.Show,
): readonly CalendarEntry[] {
	const bounds = periodBounds(period, now);
	return entries.filter((entry) => {
		if (bounds !== null && (entry.iso < bounds[0] || entry.iso > bounds[1])) return false;
		// Both computed public holidays AND imported (subscribed-calendar) ones.
		if (holidays === HolidayMode.Without && holidayLabelFor(entry) !== null) return false;
		if (past === PastMode.Hide) {
			const at = combineDateTime(entry.iso, entry.time);
			if (at !== null && at.getTime() < now.getTime()) return false;
		}
		return true;
	});
}
