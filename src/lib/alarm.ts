import { DEFAULT_TIME } from "./constants";
import { isoDateKey, parseIsoDate } from "./time";
import type { CalendarEntry } from "./types";

export { DEFAULT_TIME };

export function isValidTime(value: string): boolean {
	const match = /^(\d{2}):(\d{2})$/.exec(value);
	if (!match) return false;
	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

export function formatTime(value: string): string {
	return isValidTime(value) ? value : DEFAULT_TIME;
}

/** Local Date for an ISO day + HH:MM; null on an impossible day. */
export function combineDateTime(iso: string, time: string): Date | null {
	const date = parseIsoDate(iso);
	if (!date) return null;
	const [hours, minutes] = time.split(":").map(Number);
	date.setHours(hours ?? 0, minutes ?? 0, 0, 0);
	return date;
}

function effectiveTime(entry: CalendarEntry): string {
	return isValidTime(entry.time) ? entry.time : DEFAULT_TIME;
}

export function sortByDateTime(entries: readonly CalendarEntry[]): readonly CalendarEntry[] {
	return [...entries].sort((a, b) => {
		if (a.iso !== b.iso) return a.iso < b.iso ? -1 : 1;
		const timeA = effectiveTime(a);
		const timeB = effectiveTime(b);
		if (timeA !== timeB) return timeA < timeB ? -1 : 1;
		return a.title.localeCompare(b.title, "de", { sensitivity: "base" });
	});
}

/** Today's entries, chronological; legacy rows without a time fall back to DEFAULT_TIME. */
export function upcomingToday(
	entries: readonly CalendarEntry[],
	todayKey: string,
): readonly CalendarEntry[] {
	return sortByDateTime(entries.filter((entry) => entry.iso === todayKey)).map((entry) => ({
		...entry,
		time: effectiveTime(entry),
	}));
}

/** Entries whose minute matches now and that haven't fired yet. No timers involved. */
export function pendingAlarms(
	entries: readonly CalendarEntry[],
	now: Date,
	firedIds: readonly string[],
): readonly CalendarEntry[] {
	const dayKey = isoDateKey(now);
	const minuteKey = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
	return entries.filter(
		(entry) =>
			entry.iso === dayKey && effectiveTime(entry) === minuteKey && !firedIds.includes(entry.id),
	);
}
