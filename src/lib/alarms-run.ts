import { pendingAlarms } from "./alarm";
import type { ChimePlayer } from "./sound";
import { playChime } from "./sound";
import { isoDateKey } from "./time";
import type { CalendarEntry } from "./types";

/** Fire each due entry once per day. Pure apart from the injected player. */
export async function fireAlarms(
	entries: readonly CalendarEntry[],
	now: Date,
	firedIds: readonly string[],
	player: ChimePlayer,
): Promise<readonly string[]> {
	const due = pendingAlarms(entries, now, firedIds);
	if (due.length === 0) return firedIds;

	const nextFired = [...firedIds];
	for (const entry of due) {
		nextFired.push(entry.id);
		try {
			await playChime(entry, player);
		} catch {
			// A blocked/autoplay-denied audio must not stop the ticker.
		}
	}
	return nextFired;
}

/** Reset the fired-set when the calendar day changes. */
export function firedKeyForDay(now: Date): string {
	return isoDateKey(now);
}
