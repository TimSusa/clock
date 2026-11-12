import { combineDateTime } from "./alarm";
import { CalendarProvider } from "./enums";
import type { CalendarEntry } from "./types";

const GOOGLE_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const GRAPH_EVENTS_URL = "https://graph.microsoft.com/v1.0/me/events";
const DURATION_MS = 60 * 60 * 1000;

export interface ProviderConfig {
	provider: CalendarProvider;
	configured: boolean;
	clientId: string;
}

export type PushReason = "ok" | "not-configured" | "api-error";

export interface PushResult {
	ok: boolean;
	reason: PushReason;
	count: number;
}

function isoUtc(date: Date): string {
	return date.toISOString();
}

function startEnd(entry: CalendarEntry): [Date, Date] | null {
	const start = combineDateTime(entry.iso, entry.time);
	if (!start) return null;
	return [start, new Date(start.getTime() + DURATION_MS)];
}

export function googleEventPayload(entry: CalendarEntry) {
	const times = startEnd(entry);
	return {
		summary: entry.title,
		description: entry.note,
		start: { dateTime: times ? isoUtc(times[0]) : "" },
		end: { dateTime: times ? isoUtc(times[1]) : "" },
		reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 0 }] },
	};
}

export function outlookEventPayload(entry: CalendarEntry) {
	const times = startEnd(entry);
	return {
		subject: entry.title,
		body: { contentType: "Text", content: entry.note },
		start: { dateTime: times ? isoUtc(times[0]) : "", timeZone: "UTC" },
		end: { dateTime: times ? isoUtc(times[1]) : "", timeZone: "UTC" },
		isReminderOn: true,
		reminderMinutesBeforeStart: 0,
	};
}

export function getProviderConfig(provider: CalendarProvider, clientId: string): ProviderConfig {
	return {
		provider,
		configured: provider === CalendarProvider.ICal || clientId.length > 0,
		clientId,
	};
}

export function isProviderConfigured(provider: CalendarProvider): boolean {
	return provider === CalendarProvider.ICal;
}

function urlFor(provider: CalendarProvider): string {
	return provider === CalendarProvider.Google ? GOOGLE_EVENTS_URL : GRAPH_EVENTS_URL;
}

function payloadFor(provider: CalendarProvider, entry: CalendarEntry): unknown {
	return provider === CalendarProvider.Google
		? googleEventPayload(entry)
		: outlookEventPayload(entry);
}

/**
 * Push entries to a remote calendar. OAuth client-id and access token are supplied
 * by the caller (never stored, never bundled as a secret). `fetchFn` is injectable
 * so the request path is testable without network access.
 */
export async function pushEvents(
	provider: CalendarProvider,
	entries: readonly CalendarEntry[],
	accessToken: string,
	clientId: string,
	fetchFn: typeof fetch = fetch,
): Promise<PushResult> {
	if (!getProviderConfig(provider, clientId).configured || accessToken.length === 0) {
		return { ok: false, reason: "not-configured", count: 0 };
	}

	let sent = 0;
	for (const entry of entries) {
		const response = await fetchFn(urlFor(provider), {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payloadFor(provider, entry)),
		});
		if (!response.ok) return { ok: false, reason: "api-error", count: sent };
		sent += 1;
	}
	return { ok: true, reason: "ok", count: sent };
}
