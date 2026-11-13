import { planAlarmActions } from "./alarm-actions";
import { AlarmActionId } from "./enums";

/** Category id shared by planNotifications() and registerAlarmActions(). */
export const ALARM_ACTION_TYPE_ID = "CLOCK_ALARM";

export interface AlarmNativeNotifications {
	registerActionTypes(options: {
		types: Array<{ id: string; actions?: Array<Record<string, unknown>> }>;
	}): Promise<void>;
	addListener(
		eventName: string,
		listener: (event: PerformedAction) => void,
	): Promise<{ remove: () => Promise<void> } | unknown>;
}

export interface PerformedAction {
	actionId: string;
	notification: { extra?: Record<string, unknown> };
}

/** Register the Cancel / +15min category once at startup. */
export async function registerAlarmActions(native: AlarmNativeNotifications): Promise<void> {
	await native.registerActionTypes({
		types: [
			{
				id: ALARM_ACTION_TYPE_ID,
				actions: planAlarmActions().map((action) => ({
					id: action.id,
					title: action.title,
					foreground: true,
				})),
			},
		],
	});
}

/** Event name fired when a notification arrives while the app is foregrounded. */
export const LOCAL_NOTIFICATION_RECEIVED: "localNotificationReceived" = "localNotificationReceived";

/**
 * Extract the entry id from a received notification. iOS delivers this when
 * the user taps the Lock-Screen banner (or when the app is already active),
 * which is the ONLY point where a suspended WebView can show the alarm dialog.
 */
export function alarmFromNotification(event: {
	notification?: { extra?: Record<string, unknown> };
}): string | null {
	const entryId = event.notification?.extra?.entryId;
	return typeof entryId === "string" && entryId.length > 0 ? entryId : null;
}

/** Translate a Capacitor action event into a pure (entryId, action) callback. */
export function applyPerformedAction(
	event: PerformedAction,
	onAction: (entryId: string, action: AlarmActionId) => void,
): void {
	if (event.actionId !== AlarmActionId.Cancel && event.actionId !== AlarmActionId.Snooze) return;
	const entryId = event.notification.extra?.entryId;
	if (typeof entryId !== "string" || entryId.length === 0) return;
	onAction(entryId, event.actionId as AlarmActionId);
}
