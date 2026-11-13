import { describe, expect, it, vi } from "vitest";
import { makeEntry } from "../test/fixtures";
import type { CalendarPort } from "./calendar-port";
import { diffCalendarOps, syncToCalendar } from "./calendar-port";
import type { CalendarEntry } from "./types";

const A = makeEntry({ id: "a", title: "Alpha", iso: "2026-11-13", time: "09:00" });
const B = makeEntry({ id: "b", title: "Beta", iso: "2026-11-13", time: "10:00" });

describe("diffCalendarOps", () => {
	it("creates entries that are new", () => {
		expect(diffCalendarOps([], [A, B])).toEqual({ create: [A, B], update: [], remove: [] });
	});

	it("updates entries whose content changed but keeps the externalId", () => {
		const changed: CalendarEntry = { ...A, title: "Alpha neu" };
		expect(diffCalendarOps([A], [changed])).toEqual({
			create: [],
			update: [changed],
			remove: [],
		});
	});

	it("removes entries that disappeared", () => {
		expect(diffCalendarOps([A, B], [A])).toEqual({
			create: [],
			update: [],
			remove: [B],
		});
	});

	it("is a no-op when nothing changed", () => {
		expect(diffCalendarOps([A], [A])).toEqual({ create: [], update: [], remove: [] });
	});
});

function mockPort(): CalendarPort {
	return {
		requestPermissions: vi.fn().mockResolvedValue(true),
		createEvent: vi.fn().mockResolvedValue("native-a"),
		modifyEvent: vi.fn().mockResolvedValue(undefined),
		deleteEvents: vi.fn().mockResolvedValue(undefined),
		listEvents: vi.fn().mockResolvedValue([]),
	};
}

describe("syncToCalendar", () => {
	it("modifies changed entries by their externalId and deletes removed ones", async () => {
		const port = mockPort();
		const syncedA: CalendarEntry = { ...A, externalId: "native-a" };
		const syncedB: CalendarEntry = { ...B, externalId: "native-b" };
		const changed: CalendarEntry = { ...syncedA, title: "Alpha neu" };
		await syncToCalendar(port, [syncedA, syncedB], [changed]);
		expect(port.modifyEvent).toHaveBeenCalledWith(changed, "native-a");
		expect(port.deleteEvents).toHaveBeenCalledWith(["native-b"]);
	});

	it("creates a newly added entry", async () => {
		const port = mockPort();
		await syncToCalendar(port, [], [A]);
		expect(port.createEvent).toHaveBeenCalledTimes(1);
	});

	it("returns the new native ids so the caller can persist externalId", async () => {
		const port = mockPort();
		const links = await syncToCalendar(port, [], [A]);
		expect(links).toEqual([{ id: "a", externalId: "native-a" }]);
	});
});
