import { combineDateTime } from "./alarm";
import type { CalendarPort } from "./calendar-port";
import { defaultChime } from "./chime";
import { EntryCategory } from "./enums";
import { isHoliday, isHolidayCalendar, isHolidayEvent } from "./list-filter";
import { isoDateKey } from "./time";
import type { CalendarEntry } from "./types";

/** Minimal shape of @ebarooni/capacitor-calendar; injected so tests stay pure. */
export interface NativeCalendarPlugin {
	checkPermission(options: { scope: string }): Promise<{ result: string }>;
	requestPermission(options: { scope: string }): Promise<{ result: string }>;
	createEvent(options: Record<string, unknown>): Promise<{ id: string | null }>;
	modifyEvent(options: Record<string, unknown>): Promise<void>;
	deleteEventsById(options: { ids: string[] }): Promise<void>;
	listEventsInRange(options: { from: number; to: number }): Promise<{
		result: Array<{
			id?: string;
			title?: string;
			startDate?: number;
			description?: string | null;
			calendarId?: string | null;
			isAllDay?: boolean;
		}>;
	}>;
	/** Optional: older bridges / minimal mocks may not expose it. */
	listCalendars?(): Promise<{
		result: Array<{
			id?: string;
			title?: string | null;
			type?: number | null;
			isSubscribed?: boolean | null;
		}>;
	}>;
}

const READ_SCOPE = "readCalendar";
const WRITE_SCOPE = "writeCalendar";
const EVENT_DURATION_MS = 30 * 60 * 1000;
/** Import one year back and two years ahead so existing events are found. */
const IMPORT_PAST_MS = 365 * 24 * 60 * 60 * 1000;
const IMPORT_FUTURE_MS = 2 * 365 * 24 * 60 * 60 * 1000;

function startMs(entry: CalendarEntry): number | null {
	const date = combineDateTime(entry.iso, entry.time);
	return date === null || Number.isNaN(date.getTime()) ? null : date.getTime();
}

export function createNativeCalendarPort(native: NativeCalendarPlugin): CalendarPort {
	return {
		async requestPermissions(): Promise<boolean> {
			try {
				const write = await native.requestPermission({ scope: WRITE_SCOPE });
				if (write.result !== "granted") return false;
				await native.requestPermission({ scope: READ_SCOPE });
				return true;
			} catch {
				return false;
			}
		},

		async createEvent(entry: CalendarEntry): Promise<string> {
			const start = startMs(entry);
			if (start === null) throw new Error("invalid-date");
			const { id } = await native.createEvent({
				title: entry.title,
				description: entry.note,
				startDate: start,
				endDate: start + EVENT_DURATION_MS,
				alerts: [0],
			});
			if (!id) throw new Error("no-native-id");
			return id;
		},

		async modifyEvent(entry: CalendarEntry, externalId: string): Promise<void> {
			const start = startMs(entry);
			if (start === null) throw new Error("invalid-date");
			await native.modifyEvent({
				id: externalId,
				title: entry.title,
				description: entry.note,
				startDate: start,
				endDate: start + EVENT_DURATION_MS,
				alerts: [0],
			});
		},

		async deleteEvents(externalIds: readonly string[]): Promise<void> {
			await native.deleteEventsById({ ids: [...externalIds] });
		},

		async listEvents(): Promise<readonly CalendarEntry[]> {
			const now = Date.now();
			const { result } = await native.listEventsInRange({
				from: now - IMPORT_PAST_MS,
				to: now + IMPORT_FUTURE_MS,
			});
			// Subscribed calendars on iOS are typically holiday/birthday feeds.
			// Best-effort: a failed lookup just leaves computed holidays in place.
			let holidayCalendarIds = new Set<string>();
			try {
				if (!native.listCalendars) throw new Error("no-listCalendars");
				const { result: calendars } = await native.listCalendars();
				holidayCalendarIds = new Set(
					calendars.filter(isHolidayCalendar).flatMap((c) => (c.id ? [c.id] : [])),
				);
			} catch {
				/* plugin without listCalendars: computed holidays still work */
			}
			return result.flatMap((event) => {
				if (typeof event.startDate !== "number" || !Number.isFinite(event.startDate)) return [];
				const date = new Date(event.startDate);
				if (Number.isNaN(date.getTime()) || typeof event.id !== "string" || !event.id) return [];
				const hh = String(date.getHours()).padStart(2, "0");
				const mm = String(date.getMinutes()).padStart(2, "0");
				const iso = isoDateKey(date);
				const fromHolidayCalendar =
					event.calendarId !== null &&
					event.calendarId !== undefined &&
					holidayCalendarIds.has(event.calendarId);
				// Event-level signal is synchronous and reliable; the calendar
				// lookup is only an additional hint (iOS calendarId varies).
				const holiday = fromHolidayCalendar || isHolidayEvent(event) || isHoliday(iso);
				return [
					{
						id: event.id,
						...(holiday ? { isHoliday: true } : {}),
						iso,
						time: `${hh}:${mm}`,
						title: event.title?.trim() || "Kalender-Eintrag",
						category: EntryCategory.Event,
						note: event.description?.trim() ?? "",
						...defaultChime(),
						externalId: event.id,
					},
				] satisfies CalendarEntry[];
			});
		},
	};
}

/** Web fallback: no native calendar access (OAuth/EventKit need the Capacitor shell). */
export function createWebCalendarPort(): CalendarPort {
	return {
		async requestPermissions() {
			return false;
		},
		async createEvent() {
			throw new Error("web-no-calendar");
		},
		async modifyEvent() {
			/* no-op */
		},
		async deleteEvents() {
			/* no-op */
		},
		async listEvents() {
			return [];
		},
	};
}

/** Detect the Capacitor bridge before importing the native plugin. */
export function hasCalendarBridge(): boolean {
	return (
		typeof window !== "undefined" &&
		(
			window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }
		).Capacitor?.isNativePlatform?.() === true
	);
}

export async function createCalendarPort(): Promise<CalendarPort> {
	if (!hasCalendarBridge()) return createWebCalendarPort();
	try {
		const mod = await import("@ebarooni/capacitor-calendar");
		return createNativeCalendarPort(mod.CapacitorCalendar as unknown as NativeCalendarPlugin);
	} catch {
		return createWebCalendarPort();
	}
}
