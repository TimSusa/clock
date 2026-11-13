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

/**
 * Claim due ids synchronously, THEN play. The ticker can call this every second
 * without a race: the second call sees the claimed id and does nothing.
 */
export function claimAndFire(
	entries: readonly CalendarEntry[],
	now: Date,
	firedIds: string[],
	player?: ChimePlayer,
): Promise<void> {
	const due = pendingAlarms(entries, now, firedIds);
	for (const entry of due) firedIds.push(entry.id);
	if (due.length === 0 || !player) return Promise.resolve();

	return (async () => {
		for (const entry of due) {
			try {
				await playChime(entry, player);
			} catch {
				// A blocked/autoplay-denied audio must not stop the ticker.
			}
		}
	})();
}

/** Reset the fired-set when the calendar day changes. */
export function firedKeyForDay(now: Date): string {
	return isoDateKey(now);
}

/**
 * Release a claimed id when the user dismisses/snoozes the alarm window.
 * `firedIds` only protects the 1-s ticker from firing the SAME minute 60x -
 * it must NOT permanently block an alarm that is triggered again (e.g. the
 * native notification bringing the app back, or the user re-triggering it).
 */
export function releaseFiredId(firedIds: readonly string[], entryId: string): string[] {
	return firedIds.filter((id) => id !== entryId);
}
