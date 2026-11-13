import { describe, expect, it, vi } from "vitest";
import { ChimeSource, EntryCategory } from "./enums";
import { createNativeCalendarPort } from "./native-calendar-port";

const START = new Date(2026, 10, 13, 9, 30, 0).getTime();

function plugin(events: Array<Record<string, unknown>> = []) {
	return {
		checkPermission: vi.fn().mockResolvedValue({ result: "granted" }),
		requestPermission: vi.fn().mockResolvedValue({ result: "granted" }),
		createEvent: vi.fn().mockResolvedValue({ id: "EK-1", ics: null }),
		modifyEvent: vi.fn().mockResolvedValue(undefined),
		deleteEventsById: vi.fn().mockResolvedValue(undefined),
		listEventsInRange: vi.fn().mockResolvedValue({ result: events }),
	};
}

const NATIVE_EVENT = {
	id: "EK-EXISTING-1",
	title: "Bestehender Termin",
	startDate: START,
	endDate: START + 1_800_000,
	description: "Notiz aus dem Kalender",
	location: null,
	alerts: [0],
	calendarId: "cal-1",
	calendarItemExternalIdentifier: "EXT-1",
	isAllDay: false,
	availability: null,
	attendees: [],
};

describe("createNativeCalendarPort.listEvents (import bestehender Events)", () => {
	it("converts a native event into a CalendarEntry with its native id", async () => {
		const p = plugin([NATIVE_EVENT]);
		const port = createNativeCalendarPort(p);
		const imported = await port.listEvents();
		expect(imported).toHaveLength(1);
		expect(imported[0]?.title).toBe("Bestehender Termin");
		expect(imported[0]?.iso).toBe("2026-11-13");
		expect(imported[0]?.time).toBe("09:30");
		expect(imported[0]?.note).toBe("Notiz aus dem Kalender");
		expect(imported[0]?.externalId).toBe("EK-EXISTING-1");
	});

	it("uses safe defaults for chime/category on imported events", async () => {
		const p = plugin([NATIVE_EVENT]);
		const port = createNativeCalendarPort(p);
		const imported = await port.listEvents();
		expect(imported[0]?.chimeSource).toBe(ChimeSource.Default);
		expect(imported[0]?.category).toBe(EntryCategory.Event);
	});

	it("skips events without a valid start date", async () => {
		const p = plugin([{ ...NATIVE_EVENT, startDate: undefined }]);
		const port = createNativeCalendarPort(p);
		expect(await port.listEvents()).toEqual([]);
	});

	it("returns an empty list when the plugin returns none", async () => {
		const port = createNativeCalendarPort(plugin([]));
		expect(await port.listEvents()).toEqual([]);
	});

	it("queries a wide range around now (not just today)", async () => {
		const p = plugin([]);
		const port = createNativeCalendarPort(p);
		await port.listEvents();
		const opts = p.listEventsInRange.mock.calls[0]?.[0] as { from: number; to: number };
		expect(opts.to - opts.from).toBeGreaterThan(365 * 24 * 60 * 60 * 1000);
	});
});
