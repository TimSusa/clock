import { combineDateTime } from "./alarm";
import type { CalendarEntry } from "./types";

/**
 * One native calendar interface. The web implementation is a no-op; the
 * Capacitor implementation talks to EventKit through the plugin. Platform
 * differences stay in an adapter, never in the UI.
 */
export interface CalendarPort {
	requestPermissions(): Promise<boolean>;
	createEvent(entry: CalendarEntry): Promise<string>;
	modifyEvent(entry: CalendarEntry, externalId: string): Promise<void>;
	deleteEvents(externalIds: readonly string[]): Promise<void>;
	listEvents(): Promise<readonly CalendarEntry[]>;
}

export interface CalendarOps {
	create: readonly CalendarEntry[];
	update: readonly CalendarEntry[];
	remove: readonly CalendarEntry[];
}

export interface CalendarLink {
	id: string;
	externalId: string;
}

/** Pure diff between the last synced snapshot and the current entries. */
export function diffCalendarOps(
	synced: readonly CalendarEntry[],
	current: readonly CalendarEntry[],
): CalendarOps {
	const syncedById = new Map(synced.map((e) => [e.id, e]));
	const currentIds = new Set(current.map((e) => e.id));
	const create: CalendarEntry[] = [];
	const update: CalendarEntry[] = [];
	const remove: CalendarEntry[] = [];

	for (const entry of current) {
		const before = syncedById.get(entry.id);
		if (!before) {
			create.push(entry);
			continue;
		}
		if (
			before.title !== entry.title ||
			before.iso !== entry.iso ||
			before.time !== entry.time ||
			before.note !== entry.note ||
			before.category !== entry.category ||
			before.extraChime !== entry.extraChime
		) {
			update.push(entry);
		}
	}
	for (const entry of synced) {
		if (!currentIds.has(entry.id)) remove.push(entry);
	}
	return { create, update, remove };
}

/** Apply the diff through the port. Never throws: a failed sync must not block the UI. */
export async function syncToCalendar(
	port: CalendarPort,
	synced: readonly CalendarEntry[],
	current: readonly CalendarEntry[],
): Promise<readonly CalendarLink[]> {
	const ops = diffCalendarOps(synced, current);
	const links: CalendarLink[] = [];
	for (const entry of ops.create) {
		try {
			const externalId = await port.createEvent(entry);
			links.push({ id: entry.id, externalId });
		} catch {
			/* permission denied / no calendar: keep local data intact */
		}
	}
	for (const entry of ops.update) {
		const before = synced.find((e) => e.id === entry.id);
		if (before?.externalId) {
			try {
				await port.modifyEvent(entry, before.externalId);
			} catch {
				/* keep local data intact */
			}
		}
	}
	const ids = ops.remove
		.map((e) => e.externalId)
		.filter((id): id is string => typeof id === "string");
	if (ids.length > 0) {
		try {
			await port.deleteEvents(ids);
		} catch {
			/* keep local data intact */
		}
	}
	return links;
}

/** Local Date (ms) for a native event start; null for an impossible day. */
export function eventStartDate(entry: CalendarEntry): number | null {
	const date = combineDateTime(entry.iso, entry.time);
	return date === null || Number.isNaN(date.getTime()) ? null : date.getTime();
}
