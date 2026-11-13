import { describe, expect, it } from "vitest";
import { makeEntry } from "../test/fixtures";
import { applyAlarmAction, planAlarmActions, SNOOZE_MINUTES, snoozedEntry } from "./alarm-actions";
import { AlarmActionId } from "./enums";

const ENTRY = makeEntry({ id: "a", iso: "2026-11-13", time: "09:00", title: "Zahnarzt" });

describe("snoozedEntry", () => {
	it("moves the event 15 minutes into the future, preserving its id", () => {
		const base = new Date(2026, 10, 13, 9, 0, 0);
		const moved = snoozedEntry(ENTRY, base);
		expect(moved.id).toBe("a");
		expect(moved.time).toBe("09:15");
		expect(moved.iso).toBe("2026-11-13");
	});

	it("rolls over midnight into the next day", () => {
		const base = new Date(2026, 10, 13, 23, 50, 0);
		const late = makeEntry({ id: "late", iso: "2026-11-13", time: "23:50" });
		const moved = snoozedEntry(late, base);
		expect(moved.time).toBe("00:05");
		expect(moved.iso).toBe("2026-11-14");
	});
});

describe("applyAlarmAction", () => {
	it("cancel keeps the entry — dismissing the alarm must not delete the appointment", () => {
		const result = applyAlarmAction([ENTRY], "a", AlarmActionId.Cancel);
		expect(result).toEqual([ENTRY]);
	});

	it("snooze replaces the entry with a +15min copy", () => {
		const base = new Date(2026, 10, 13, 9, 0, 0);
		const result = applyAlarmAction([ENTRY], "a", AlarmActionId.Snooze, base);
		expect(result[0]?.time).toBe("09:15");
		expect(result[0]?.externalId).toBe(ENTRY.externalId);
	});

	it("unknown id leaves the list untouched", () => {
		expect(applyAlarmAction([ENTRY], "other", AlarmActionId.Cancel)).toEqual([ENTRY]);
	});
});

describe("planAlarmActions", () => {
	it("declares cancel and snooze buttons with the snooze minutes", () => {
		const actions = planAlarmActions();
		expect(actions.map((a) => a.id)).toEqual([AlarmActionId.Cancel, AlarmActionId.Snooze]);
		expect(actions.find((a) => a.id === AlarmActionId.Snooze)?.minutes).toBe(SNOOZE_MINUTES);
	});
});

describe("SNOOZE_MINUTES", () => {
	it("is 15", () => {
		expect(SNOOZE_MINUTES).toBe(15);
	});
});
