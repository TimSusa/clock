import type { PlannedNotification } from "./notification-plan";
import { planNotifications } from "./notification-plan";
import type { CalendarEntry } from "./types";

export interface NotificationPort {
	requestPermission(): Promise<boolean>;
	reschedule(entries: readonly CalendarEntry[], now: Date): Promise<void>;
}

/** Exactly the shape of @capacitor/local-notifications' LocalNotifications. */
export interface NativeNotifications {
	checkPermissions(): Promise<{ display: string }>;
	requestPermissions(): Promise<{ display: string }>;
	cancel(options: { notifications: Array<{ id: number }> }): Promise<void>;
	schedule(options: {
		notifications: Array<{
			id: number;
			title: string;
			body: string;
			sound: string;
			actionTypeId: string;
			interruptionLevel: string;
			foreground: boolean;
			extra: { entryId: string };
			schedule: { at: Date };
		}>;
	}): Promise<void>;
	getPending(): Promise<{ notifications: Array<{ id: number }> }>;
}

/**
 * Re-plan the native alarm schedule. `schedule()` replaces notifications with
 * the same id, so it MUST NOT wait on getPending(): on iOS that call can hang
 * during startup, which left every alarm unscheduled. Stale entries are
 * cancelled best-effort afterwards, never in the critical path.
 */
export async function rescheduleWith(
	native: NativeNotifications,
	entries: readonly CalendarEntry[],
	now: Date,
): Promise<void> {
	const planned = planNotifications(entries, now);
	const plannedIds = new Set(planned.map((item) => item.id));

	if (planned.length > 0) {
		await native.schedule({
			notifications: planned.map((item: PlannedNotification) => ({
				id: item.id,
				title: item.title,
				body: item.body,
				sound: item.sound,
				actionTypeId: item.actionTypeId,
				interruptionLevel: item.interruptionLevel,
				foreground: item.foreground,
				extra: { entryId: item.entryId },
				schedule: { at: item.at },
			})),
		});
	}

	void native
		.getPending()
		.then((pending) => {
			const stale = pending.notifications.filter((n) => !plannedIds.has(n.id));
			if (stale.length > 0) void native.cancel({ notifications: stale }).catch(() => {});
		})
		.catch(() => {});
}

/**
 * ONE source of truth: the caller passes the SAME LocalNotifications object it
 * already imported for registerActionTypes/addListener. No second dynamic
 * import (Vite split it into a different chunk that never resolved on iOS),
 * no separate platform gate.
 */
export function createNotificationPort(native: NativeNotifications | null): NotificationPort {
	if (!native) {
		return {
			async requestPermission() {
				return false;
			},
			async reschedule() {
				/* web fallback: in-app ticker handles alarms */
			},
		};
	}
	return {
		async requestPermission() {
			try {
				const current = await native.checkPermissions();
				if (current.display === "granted") return true;
				const requested = await native.requestPermissions();
				return requested.display === "granted";
			} catch {
				return false;
			}
		},
		async reschedule(entries, now) {
			await rescheduleWith(native, entries, now);
		},
	};
}
