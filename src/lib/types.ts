import type { AlarmStatus, ChimeSource, EntryCategory, Month } from "./enums";

export interface TimeParts {
	hours: number;
	minutes: number;
	seconds: number;
}

export interface CalendarCell {
	date: Date;
	iso: string;
	inMonth: boolean;
	isToday: boolean;
	isWeekend: boolean;
}

export interface MonthGrid {
	year: number;
	month: Month;
	label: string;
	weekdayLabels: readonly string[];
	cells: readonly CalendarCell[];
}

export interface CalendarEntry {
	id: string;
	iso: string;
	time: string;
	title: string;
	category: EntryCategory;
	note: string;
	chimeSource: ChimeSource;
	chimeName: string;
	chimeDataUrl: string;
	/** Play the entry's own chime (MP3/recording) instead of the bundled default. */
	extraChime: boolean;
	/** Native calendar event id (EventKit). Undefined until synced. */
	externalId?: string;
	/** From a subscribed holiday calendar (or a computed public holiday). */
	isHoliday?: boolean;
}

export interface AlarmRow {
	entry: CalendarEntry;
	time: string;
	label: string;
	status: AlarmStatus;
}

export interface AppointmentGroup {
	iso: string;
	label: string;
	isPast: boolean;
	entries: readonly CalendarEntry[];
}
