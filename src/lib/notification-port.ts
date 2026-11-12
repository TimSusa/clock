import type { PlannedNotification } from "./notification-plan";
import { planNotifications } from "./notification-plan";
import type { CalendarEntry } from "./types";

export interface NotificationPort {
	requestPermission(): Promise<boolean>;
	reschedule(entries: readonly CalendarEntry[], now: Date): Promise<void>;
}

export interface NativeNotifications {
	checkPermissions(): Promise<{ display: string }>;
	requestPermissions(): Promise<{ display: string }>;
	cancel(options: { notifications: Array<{ id: number }> }): Promise<void>;
	schedule(options: {
		notifications: Array<{
			id: number;
			title: string;
			body: string;
			schedule: { at: Date };
		}>;
	}): Promise<void>;
	getPending(): Promise<{ notifications: Array<{ id: number }> }>;
}

/**
 * A native bridge only exists inside the Capacitor shell. Checking for it
 * before importing keeps the plain web build (and jsdom) completely clean.
 */
function hasNativeBridge(): boolean {
	return (
		typeof window !== "undefined" &&
		(
			window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }
		).Capacitor?.isNativePlatform?.() === true
	);
}

async function loadNative(): Promise<NativeNotifications | null> {
	if (!hasNativeBridge()) return null;
	try {
		const mod = await import("@capacitor/local-notifications");
		return mod.LocalNotifications as unknown as NativeNotifications;
	} catch {
		return null;
	}
}

/**
 * Cancel all previously scheduled alarms and schedule the current set.
 * Called whenever `entries` change, so edits/deletes never leave stale alarms.
 */
export async function rescheduleWith(
	native: NativeNotifications,
	entries: readonly CalendarEntry[],
	now: Date,
): Promise<void> {
	const pending = await native.getPending();
	if (pending.notifications.length > 0) {
		await native.cancel({ notifications: pending.notifications });
	}

	const planned = planNotifications(entries, now);
	if (planned.length === 0) return;

	await native.schedule({
		notifications: planned.map((item: PlannedNotification) => ({
			id: item.id,
			title: item.title,
			body: item.body,
			schedule: { at: item.at },
		})),
	});
}

/** Native-backed port. On the web it degrades to a no-op port. */
export async function createNotificationPort(): Promise<NotificationPort> {
	const native = await loadNative();
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
			const current = await native.checkPermissions();
			if (current.display === "granted") return true;
			const requested = await native.requestPermissions();
			return requested.display === "granted";
		},
		async reschedule(entries, now) {
			await rescheduleWith(native, entries, now);
		},
	};
}
