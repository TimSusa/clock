import { Locale, Weekday } from "./enums";
import type { TimeParts } from "./types";

function pad2(value: number): string {
	return String(value).padStart(2, "0");
}

export function toTimeParts(date: Date): TimeParts {
	return {
		hours: date.getHours(),
		minutes: date.getMinutes(),
		seconds: date.getSeconds(),
	};
}

export function formatLongDate(date: Date, locale: Locale = Locale.German): string {
	return new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
	}).format(date);
}

/** Local calendar date as YYYY-MM-DD (never UTC, avoids off-by-one across timezones). */
export function isoDateKey(date: Date): string {
	return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function parseIsoDate(key: string): Date | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
	if (!match) return null;

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = new Date(year, month - 1, day);

	if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
		return null;
	}
	return date;
}

export function sameDay(a: Date, b: Date): boolean {
	return isoDateKey(a) === isoDateKey(b);
}

/** JS getDay() (0 = Sunday) → ISO weekday (1 = Monday ... 7 = Sunday). */
export function weekdayIso(date: Date): Weekday {
	const jsDay = date.getDay();
	return (jsDay === 0 ? 7 : jsDay) as Weekday;
}
