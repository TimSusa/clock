import { combineDateTime } from "./alarm";
import { AlarmActionId } from "./enums";
import { isoDateKey } from "./time";
import type { CalendarEntry } from "./types";

export const SNOOZE_MINUTES = 15;

export interface AlarmAction {
	id: AlarmActionId;
	title: string;
	/** Only set for snooze — minutes to postpone. */
	minutes?: number;
}

/** Buttons attached to every scheduled alarm notification. */
export function planAlarmActions(): readonly AlarmAction[] {
	return [
		{ id: AlarmActionId.Cancel, title: "Abbrechen" },
		{ id: AlarmActionId.Snooze, title: "+15 Minuten", minutes: SNOOZE_MINUTES },
	];
}

/** Pure +15min move; rolls over midnight via real Date arithmetic. */
export function snoozedEntry(entry: CalendarEntry, base: Date): CalendarEntry {
	const start = combineDateTime(entry.iso, entry.time) ?? base;
	const moved = new Date(start.getTime() + SNOOZE_MINUTES * 60_000);
	const hh = String(moved.getHours()).padStart(2, "0");
	const mm = String(moved.getMinutes()).padStart(2, "0");
	return { ...entry, iso: isoDateKey(moved), time: `${hh}:${mm}` };
}

/** Apply a fired-alarm action to the entry list; pure, keeps externalId. */
export function applyAlarmAction(
	entries: readonly CalendarEntry[],
	entryId: string,
	action: AlarmActionId,
	base: Date = new Date(),
): readonly CalendarEntry[] {
	const target = entries.find((e) => e.id === entryId);
	if (!target || action === AlarmActionId.Cancel) return entries;
	return entries.map((e) => (e.id === entryId ? snoozedEntry(e, base) : e));
}
