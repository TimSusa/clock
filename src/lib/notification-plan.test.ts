import { describe, expect, it } from "vitest";
import { makeEntry } from "../test/fixtures";
import { combineDateTime } from "./alarm";
import { notificationIdFor, planNotifications } from "./notification-plan";

const NOW = new Date(2026, 10, 12, 9, 0, 0);

describe("notificationIdFor", () => {
	it("is stable and numeric-friendly", () => {
		expect(notificationIdFor("abc-123")).toBe(notificationIdFor("abc-123"));
		expect(notificationIdFor("abc-123")).not.toBe(notificationIdFor("abc-124"));
	});
});

describe("planNotifications", () => {
	it("schedules only future entries", () => {
		const future = makeEntry({ id: "f", iso: "2026-11-12", time: "10:00", title: "Zahnarzt" });
		const past = makeEntry({ id: "p", iso: "2026-11-12", time: "08:00" });
		expect(planNotifications([future, past], NOW)).toHaveLength(1);
		expect(planNotifications([future, past], NOW)[0]?.title).toBe("Zahnarzt");
	});

	it("uses the entry id as the notification id so edits replace, not duplicate", () => {
		const future = makeEntry({ id: "f", iso: "2026-11-12", time: "10:00" });
		expect(planNotifications([future], NOW)[0]?.id).toBe(notificationIdFor("f"));
	});

	it("carries the chime name into the notification body", () => {
		const future = makeEntry({
			id: "f",
			iso: "2026-11-12",
			time: "10:00",
			chimeName: "Eigene Aufnahme",
		});
		expect(planNotifications([future], NOW)[0]?.body).toContain("Eigene Aufnahme");
	});

	it("skips invalid dates", () => {
		const broken = makeEntry({ id: "b", iso: "not-a-date", time: "10:00" });
		expect(planNotifications([broken], NOW)).toEqual([]);
	});

	it("returns dates as real Date objects in local time", () => {
		const future = makeEntry({ id: "f", iso: "2026-11-12", time: "10:00" });
		const at = planNotifications([future], NOW)[0]?.at;
		expect(at).toEqual(combineDateTime("2026-11-12", "10:00"));
	});
});
