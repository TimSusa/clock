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
