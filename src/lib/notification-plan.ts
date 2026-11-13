import { combineDateTime } from "./alarm";
import { ALARM_ACTION_TYPE_ID } from "./alarm-bridge";
import { NOTIFICATION_SOUND } from "./constants";
import { ChimeSource, NotificationInterruptionLevel } from "./enums";
import type { CalendarEntry } from "./types";
import { isPlayableWavDataUrl } from "./wav";

export interface PlannedNotification {
	id: number;
	title: string;
	body: string;
	at: Date;
	sound: string;
	actionTypeId: string;
	entryId: string;
	/** iOS: break through Focus / show on the Lock Screen. */
	interruptionLevel: NotificationInterruptionLevel;
	/** Show the banner even while the app is in the foreground. */
	foreground: boolean;
}

/**
 * Stable, iOS-safe filename for an entry's own chime. iOS looks for notification
 * sounds in Library/Sounds (or the app bundle); a per-entry name lets one
 * recording coexist with every other event. No path separators / data-url chars.
 */
export function soundFileNameFor(entryId: string): string {
	let hash = 0;
	for (let i = 0; i < entryId.length; i += 1) {
		hash = (hash * 31 + entryId.charCodeAt(i)) | 0;
	}
	return `clock-chime-${(hash >>> 0).toString(36)}.wav`;
}

function hasOwnAudio(entry: CalendarEntry): boolean {
	return (
		entry.extraChime &&
		(entry.chimeSource === ChimeSource.Recorded || entry.chimeSource === ChimeSource.Custom) &&
		isPlayableWavDataUrl(entry.chimeDataUrl)
	);
}

/**
 * iOS plays no sound unless a sound file is named explicitly. Own recordings /
 * custom MP3s are written to Library/Sounds as <soundFileNameFor(id)> before the
 * notification is scheduled; the bundled default covers everything else. A
 * data: URL itself can never be a UNNotificationSound.
 */
export function notificationSoundFor(entry: CalendarEntry): string {
	return hasOwnAudio(entry) ? soundFileNameFor(entry.id) : NOTIFICATION_SOUND;
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
			sound: notificationSoundFor(entry),
			actionTypeId: ALARM_ACTION_TYPE_ID,
			entryId: entry.id,
			interruptionLevel: NotificationInterruptionLevel.TimeSensitive,
			foreground: true,
		});
	}
	return result;
}
