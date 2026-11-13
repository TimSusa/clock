import { combineDateTime, sortByDateTime } from "./alarm";
import { AlarmStatus } from "./enums";
import { formatLongDate, isoDateKey } from "./time";
import type { AlarmRow, CalendarEntry } from "./types";

/** Chronological alarm rows with a lifecycle status relative to now. */
export function buildAlarmRows(entries: readonly CalendarEntry[], now: Date): readonly AlarmRow[] {
	const dayKey = isoDateKey(now);
	const minuteKey = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

	return sortByDateTime(entries).map((entry) => {
		const date = combineDateTime(entry.iso, entry.time);
		let status: AlarmStatus;
		if (entry.iso === dayKey && entry.time === minuteKey) {
			status = AlarmStatus.Due;
		} else if (date !== null && date.getTime() < now.getTime()) {
			status = AlarmStatus.Past;
		} else if (entry.iso === dayKey && date !== null && date.getHours() === now.getHours()) {
			status = AlarmStatus.Upcoming;
		} else if (entry.iso === dayKey) {
			status = AlarmStatus.Today;
		} else {
			status = AlarmStatus.Future;
		}

		return {
			entry,
			time: entry.time,
			label: date ? formatLongDate(date) : entry.iso,
			status,
		};
	});
}
