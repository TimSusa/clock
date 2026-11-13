import { combineDateTime } from "./alarm";
import type { CalendarEntry } from "./types";

/** Earliest entry strictly in the future, or undefined when none exists. */
export function nextEvent(entries: readonly CalendarEntry[], now: Date): CalendarEntry | undefined {
	let best: CalendarEntry | undefined;
	let bestTime = Number.POSITIVE_INFINITY;
	for (const entry of entries) {
		const at = combineDateTime(entry.iso, entry.time);
		if (at === null || at.getTime() <= now.getTime() || at.getTime() >= bestTime) continue;
		best = entry;
		bestTime = at.getTime();
	}
	return best;
}

/**
 * Anchor for the progress bar: the most recent past entry, or `now` when there
 * is none. Keeps the bar meaningful from a cold start (0 % → 100 %).
 */
export function previousAnchor(entries: readonly CalendarEntry[], now: Date): Date {
	let latest = Number.NEGATIVE_INFINITY;
	for (const entry of entries) {
		const at = combineDateTime(entry.iso, entry.time);
		if (at === null || at.getTime() > now.getTime()) continue;
		latest = Math.max(latest, at.getTime());
	}
	return latest === Number.NEGATIVE_INFINITY ? now : new Date(latest);
}

/** Percent of time elapsed between the anchor and the next event, clamped 0..100. */
export function progressToNext(next: CalendarEntry, now: Date, anchor: Date): number {
	const target = combineDateTime(next.iso, next.time);
	if (target === null) return 0;
	const span = target.getTime() - anchor.getTime();
	if (span <= 0) return 100;
	const elapsed = now.getTime() - anchor.getTime();
	return Math.min(100, Math.max(0, Math.round((elapsed / span) * 100)));
}
