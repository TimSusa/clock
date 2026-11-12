import { Locale, type Month, Weekday, WeekStart } from "./enums";
import { isoDateKey, parseIsoDate, weekdayIso } from "./time";
import type { CalendarCell, CalendarEntry, MonthGrid } from "./types";

const GERMAN_WEEKDAYS: readonly string[] = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export function isLeapYear(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function shiftMonth(year: number, month: Month, delta: number): [number, Month] {
	const absolute = year * 12 + month + delta;
	return [Math.floor(absolute / 12), (absolute % 12) as Month];
}

export function formatMonthLabel(
	year: number,
	month: Month,
	locale: Locale = Locale.German,
): string {
	return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
		new Date(year, month, 1),
	);
}

export function weekdayLabels(
	start: WeekStart = WeekStart.Monday,
	_locale: Locale = Locale.German,
): readonly string[] {
	if (start === WeekStart.Sunday) {
		return [...GERMAN_WEEKDAYS.slice(6), ...GERMAN_WEEKDAYS.slice(0, 6)];
	}
	return GERMAN_WEEKDAYS;
}

/** Monday-first grid, always whole weeks, leading/trailing days from adjacent months. */
export function buildMonthGrid(
	year: number,
	month: Month,
	today: Date,
	start: WeekStart = WeekStart.Monday,
): MonthGrid {
	const first = new Date(year, month, 1);
	const jsDay = first.getDay();
	const offset = start === WeekStart.Monday ? (jsDay === 0 ? 6 : jsDay - 1) : jsDay;
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	const cellCount = Math.ceil((offset + daysInMonth) / 7) * 7;
	const gridStart = new Date(year, month, 1 - offset);
	const todayKey = isoDateKey(today);

	const cells: CalendarCell[] = [];
	for (let i = 0; i < cellCount; i += 1) {
		const date = new Date(gridStart);
		date.setDate(gridStart.getDate() + i);
		const iso = isoDateKey(date);
		const weekday = weekdayIso(date);
		cells.push({
			date,
			iso,
			inMonth: date.getMonth() === month && date.getFullYear() === year,
			isToday: iso === todayKey,
			isWeekend: weekday === Weekday.Saturday || weekday === Weekday.Sunday,
		});
	}

	return {
		year,
		month,
		label: formatMonthLabel(year, month),
		weekdayLabels: weekdayLabels(start),
		cells,
	};
}

export function entriesForDate(
	entries: readonly CalendarEntry[],
	iso: string,
): readonly CalendarEntry[] {
	return entries.filter((entry) => entry.iso === iso);
}

/** Guard used by the form: only valid ISO keys reach storage. */
export function isValidEntryDate(iso: string): boolean {
	return parseIsoDate(iso) !== null;
}
