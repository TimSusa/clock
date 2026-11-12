import { combineDateTime } from "./alarm";
import type { CalendarEntry } from "./types";

export interface PlannedNotification {
	id: number;
	title: string;
	body: string;
	at: Date;
}

/** Stable numeric id from the entry id (LocalNotifications needs an int). */
export function notificationIdFor(entryId: string): number {
	let hash = 0;
	for (let i = 0; i < entryId.length; i += 1) {
		hash = (hash * 31 + entryId.charCodeAt(i)) | 0;
	}
	return Math.abs(hash) % 2_147_483_647 || 1;
}

/**
 * Build the notification schedule for all future entries. Pure - the native
 * adapter (@capacitor/local-notifications) consumes this unchanged.
 */
export function planNotifications(
	entries: readonly CalendarEntry[],
	now: Date,
): readonly PlannedNotification[] {
	const result: PlannedNotification[] = [];
	for (const entry of entries) {
		const at = combineDateTime(entry.iso, entry.time);
		if (at === null || Number.isNaN(at.getTime()) || at.getTime() <= now.getTime()) continue;
		result.push({
			id: notificationIdFor(entry.id),
			title: entry.title,
			body: `Weckton: ${entry.chimeName}`,
			at,
		});
	}
	return result;
}
