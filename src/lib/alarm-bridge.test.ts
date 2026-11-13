import { describe, expect, it, vi } from "vitest";
import { planAlarmActions } from "./alarm-actions";
import { alarmFromNotification, applyPerformedAction, registerAlarmActions } from "./alarm-bridge";
import { AlarmActionId } from "./enums";

function native() {
	return {
		registerActionTypes: vi.fn().mockResolvedValue(undefined),
		addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
	};
}

describe("registerAlarmActions", () => {
	it("registers a category with cancel + snooze buttons", async () => {
		const n = native();
		await registerAlarmActions(n);
		expect(n.registerActionTypes).toHaveBeenCalledWith({
			types: [
				expect.objectContaining({
					actions: expect.arrayContaining([
						expect.objectContaining({ id: AlarmActionId.Cancel }),
						expect.objectContaining({ id: AlarmActionId.Snooze }),
					]),
				}),
			],
		});
	});
});

describe("alarmFromNotification", () => {
	it("extracts the entry id when a notification is received (lock screen / background)", () => {
		expect(alarmFromNotification({ notification: { extra: { entryId: "EK-1" } } })).toBe("EK-1");
	});

	it("returns null for a notification without an entry id", () => {
		expect(alarmFromNotification({ notification: {} })).toBeNull();
		expect(alarmFromNotification({})).toBeNull();
	});
});

describe("applyPerformedAction", () => {
	it("maps a cancel action to cancellation of the entry", () => {
		const onAction = vi.fn();
		applyPerformedAction(
			{ actionId: AlarmActionId.Cancel, notification: { extra: { entryId: "a" } } },
			onAction,
		);
		expect(onAction).toHaveBeenCalledWith("a", AlarmActionId.Cancel);
	});

	it("maps a snooze action to snoozing the entry", () => {
		const onAction = vi.fn();
		applyPerformedAction(
			{ actionId: AlarmActionId.Snooze, notification: { extra: { entryId: "a" } } },
			onAction,
		);
		expect(onAction).toHaveBeenCalledWith("a", AlarmActionId.Snooze);
	});

	it("ignores unknown action ids and missing entryId", () => {
		const onAction = vi.fn();
		applyPerformedAction({ actionId: "tap", notification: { extra: { entryId: "a" } } }, onAction);
		applyPerformedAction({ actionId: AlarmActionId.Cancel, notification: { extra: {} } }, onAction);
		expect(onAction).not.toHaveBeenCalled();
	});
});

describe("planAlarmActions", () => {
	it("formats the actions into the notification category shape", () => {
		const shaped = planAlarmActions().map((a) => ({
			id: a.id,
			title: a.title,
			foreground: true,
		}));
		expect(shaped[0]?.id).toBe(AlarmActionId.Cancel);
		expect(shaped[1]?.title).toContain("15");
	});
});
