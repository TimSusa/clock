import { HolidayMode, ListPeriod, PastMode, StorageKey } from "./enums";
import { readCached, writeCached } from "./storage";

export interface ListView {
	period: ListPeriod;
	holidays: HolidayMode;
	past: PastMode;
}

/** Initial view: today's appointments, no public holidays, no past items. */
export const DEFAULT_LIST_VIEW: ListView = {
	period: ListPeriod.Day,
	holidays: HolidayMode.Without,
	past: PastMode.Hide,
};

/** Only known enum values survive a reload; a stale/corrupt value falls back. */
function readEnum<T extends string>(key: StorageKey, allowed: readonly T[]): T | null {
	const value = readCached(key);
	return value !== null && allowed.includes(value as T) ? (value as T) : null;
}

export function loadListView(): ListView {
	return {
		period: readEnum(StorageKey.ListPeriod, Object.values(ListPeriod)) ?? DEFAULT_LIST_VIEW.period,
		holidays:
			readEnum(StorageKey.ListHolidays, Object.values(HolidayMode)) ?? DEFAULT_LIST_VIEW.holidays,
		past: readEnum(StorageKey.ListPast, Object.values(PastMode)) ?? DEFAULT_LIST_VIEW.past,
	};
}

export function saveListView(view: ListView): void {
	writeCached(StorageKey.ListPeriod, view.period);
	writeCached(StorageKey.ListHolidays, view.holidays);
	writeCached(StorageKey.ListPast, view.past);
}
