import { describe, expect, it, vi } from "vitest";
import { makeEntry } from "../test/fixtures";
import { createNativeCalendarPort } from "./native-calendar-port";

function plugin() {
	return {
		checkPermission: vi.fn().mockResolvedValue({ result: "granted" }),
		requestPermission: vi.fn().mockResolvedValue({ result: "granted" }),
		createEvent: vi.fn().mockResolvedValue({ id: "EK-1", ics: null }),
		modifyEvent: vi.fn().mockResolvedValue(undefined),
		deleteEventsById: vi.fn().mockResolvedValue(undefined),
		listEventsInRange: vi.fn().mockResolvedValue({ result: [] }),
		listCalendars: vi.fn().mockResolvedValue({ result: [] }),
	};
}

const ENTRY = makeEntry({
	id: "a",
	title: "Zahnarzt",
	iso: "2026-11-13",
	time: "15:30",
	note: "Praxis",
});

describe("createNativeCalendarPort", () => {
	it("maps an entry to a native createEvent call with a real timestamp", async () => {
		const p = plugin();
		const port = createNativeCalendarPort(p);
		const id = await port.createEvent(ENTRY);
		expect(id).toBe("EK-1");
		const opts = p.createEvent.mock.calls[0]?.[0] as Record<string, unknown>;
		expect(opts["title"]).toBe("Zahnarzt");
		expect(opts["description"]).toBe("Praxis");
		expect(typeof opts["startDate"]).toBe("number");
	});

	it("modifies by the native event id", async () => {
		const p = plugin();
		const port = createNativeCalendarPort(p);
		await port.modifyEvent({ ...ENTRY, title: "Zahnarzt neu" }, "EK-1");
		expect(p.modifyEvent).toHaveBeenCalledWith(
			expect.objectContaining({ id: "EK-1", title: "Zahnarzt neu" }),
		);
	});

	it("deletes by native ids", async () => {
		const p = plugin();
		const port = createNativeCalendarPort(p);
		await port.deleteEvents(["EK-1", "EK-2"]);
		expect(p.deleteEventsById).toHaveBeenCalledWith({ ids: ["EK-1", "EK-2"] });
	});

	it("marks events from a SUBSCRIBED calendar as holidays", async () => {
		const p = plugin();
		p.listCalendars.mockResolvedValue({
			result: [
				{ id: "normal-cal", title: "Privat", type: 0, isSubscribed: false },
				{ id: "holiday-cal", title: "Feiertage in Deutschland", type: 3, isSubscribed: true },
			],
		});
		p.listEventsInRange.mockResolvedValue({
			result: [
				{
					id: "e1",
					title: "Zahnarzt",
					startDate: Date.UTC(2026, 10, 15, 9, 0),
					calendarId: "normal-cal",
				},
				{
					id: "e2",
					title: "Volkstrauertag",
					startDate: Date.UTC(2026, 10, 15, 0, 0),
					calendarId: "holiday-cal",
				},
			],
		});
		const port = createNativeCalendarPort(p);
		const events = await port.listEvents();
		expect(events.find((e) => e.id === "e1")?.isHoliday).toBeUndefined();
		expect(events.find((e) => e.id === "e2")?.isHoliday).toBe(true);
	});

	it("marks a Google holiday event by its description (no calendarId needed)", async () => {
		const p = plugin();
		p.listEventsInRange.mockResolvedValue({
			result: [
				{
					id: "volkstrauertag",
					title: "Volkstrauertag",
					startDate: Date.UTC(2026, 10, 15, 0, 0),
					isAllDay: true,
					description:
						"Gedenktag\nWenn Sie Gedenktage ausblenden möchten … Feiertage in Deutschland",
				},
			],
		});
		const port = createNativeCalendarPort(p);
		expect((await port.listEvents())[0]?.isHoliday).toBe(true);
	});

	it("marks an all-day memorial day by title alone", async () => {
		const p = plugin();
		p.listEventsInRange.mockResolvedValue({
			result: [
				{
					id: "b",
					title: "Buß- und Bettag",
					startDate: Date.UTC(2026, 10, 18, 0, 0),
					isAllDay: true,
				},
			],
		});
		const port = createNativeCalendarPort(p);
		expect((await port.listEvents())[0]?.isHoliday).toBe(true);
	});

	it("recognizes a holiday calendar by its title even if isSubscribed is false", async () => {
		const p = plugin();
		p.listCalendars.mockResolvedValue({
			result: [
				{ id: "holiday-cal", title: "Feiertage in Deutschland", type: 2, isSubscribed: false },
			],
		});
		p.listEventsInRange.mockResolvedValue({
			result: [
				{
					id: "v",
					title: "Volkstrauertag",
					startDate: Date.UTC(2026, 10, 15, 0, 0),
					calendarId: "holiday-cal",
				},
			],
		});
		const port = createNativeCalendarPort(p);
		expect((await port.listEvents())[0]?.isHoliday).toBe(true);
	});

	it("marks computed public holidays even without a subscribed calendar", async () => {
		const p = plugin();
		p.listEventsInRange.mockResolvedValue({
			result: [
				{
					id: "xmas",
					title: "Weihnachten",
					startDate: Date.UTC(2026, 11, 25, 0, 0),
					calendarId: "normal-cal",
				},
			],
		});
		const port = createNativeCalendarPort(p);
		const events = await port.listEvents();
		expect(events.find((e) => e.id === "xmas")?.isHoliday).toBe(true);
	});

	it("returns false when permission is denied", async () => {
		const p = plugin();
		p.requestPermission.mockResolvedValue({ result: "denied" });
		const port = createNativeCalendarPort(p);
		expect(await port.requestPermissions()).toBe(false);
	});
});
