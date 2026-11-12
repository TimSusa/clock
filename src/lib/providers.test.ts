import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeEntry } from "../test/fixtures";
import { CalendarProvider } from "./enums";
import {
	getProviderConfig,
	googleEventPayload,
	isProviderConfigured,
	outlookEventPayload,
	pushEvents,
} from "./providers";
import type { CalendarEntry } from "./types";

const entries: readonly CalendarEntry[] = [
	makeEntry({ id: "a", iso: "2026-11-12", time: "09:05", title: "Zahnarzt", note: "Raum 3" }),
];

describe("payload builders", () => {
	it("builds a Google Calendar event with a UTC dateTime", () => {
		const payload = googleEventPayload(entries[0] as CalendarEntry);
		expect(payload.summary).toBe("Zahnarzt");
		expect(payload.description).toBe("Raum 3");
		expect(payload.start.dateTime).toMatch(/^2026-11-12T08:05:00/);
		expect(payload.end.dateTime).toMatch(/^2026-11-12T09:05:00/);
	});

	it("builds an Outlook/Graph event with UTC and a timezone", () => {
		const payload = outlookEventPayload(entries[0] as CalendarEntry);
		expect(payload.subject).toBe("Zahnarzt");
		expect(payload.body.content).toBe("Raum 3");
		expect(payload.start.timeZone).toBe("UTC");
		expect(payload.start.dateTime).toMatch(/^2026-11-12T08:05:00/);
	});
});

describe("isProviderConfigured", () => {
	it("iCal is always available (no credentials needed)", () => {
		expect(isProviderConfigured(CalendarProvider.ICal)).toBe(true);
	});

	it("Google/Outlook report the configured client id", () => {
		const google = getProviderConfig(CalendarProvider.Google, "google-client-123");
		expect(google.configured).toBe(true);
		const outlook = getProviderConfig(CalendarProvider.Outlook, "");
		expect(outlook.configured).toBe(false);
	});
});

describe("pushEvents", () => {
	beforeEach(() => vi.restoreAllMocks());

	it("returns not-configured without a client id", async () => {
		const result = await pushEvents(CalendarProvider.Google, entries, "token", "");
		expect(result).toEqual({ ok: false, reason: "not-configured", count: 0 });
	});

	it("returns not-configured without an access token", async () => {
		const result = await pushEvents(CalendarProvider.Google, entries, "", "client-123");
		expect(result).toEqual({ ok: false, reason: "not-configured", count: 0 });
	});

	it("POSTs each event to the Google Calendar API with a Bearer token", async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
		vi.stubGlobal("fetch", fetchMock);
		const result = await pushEvents(
			CalendarProvider.Google,
			entries,
			"tok",
			"client-123",
			fetchMock,
		);
		expect(result).toEqual({ ok: true, reason: "ok", count: 1 });
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toContain("calendar/v3/calendars/primary/events");
		expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
		expect(JSON.parse(init.body as string).summary).toBe("Zahnarzt");
	});

	it("POSTs each event to Microsoft Graph", async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
		vi.stubGlobal("fetch", fetchMock);
		const result = await pushEvents(
			CalendarProvider.Outlook,
			entries,
			"tok",
			"outlook-123",
			fetchMock,
		);
		expect(result).toEqual({ ok: true, reason: "ok", count: 1 });
		expect(fetchMock.mock.calls[0]?.[0]).toContain("graph.microsoft.com/v1.0/me/events");
	});

	it("reports an API failure without throwing", async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403 });
		const result = await pushEvents(
			CalendarProvider.Google,
			entries,
			"tok",
			"client-123",
			fetchMock,
		);
		expect(result).toEqual({ ok: false, reason: "api-error", count: 0 });
	});
});
