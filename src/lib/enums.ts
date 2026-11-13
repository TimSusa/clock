/** Shared keys: never scatter raw string/number literals across the app. */

export enum Locale {
	German = "de-DE",
}

export enum WeekStart {
	Monday = "monday",
	Sunday = "sunday",
}

export enum Theme {
	Light = "light",
	Dark = "dark",
}

export enum TabId {
	Calendar = "calendar",
	Appointments = "appointments",
	Alarm = "alarm",
}

/** Lifecycle of an alarm time relative to now. */
export enum AlarmStatus {
	Due = "due",
	Upcoming = "upcoming",
	Today = "today",
	Past = "past",
	Future = "future",
}

/** Filter for the appointment list: All shows every category. */
export enum EntryFilter {
	All = "all",
	Event = "event",
	Reminder = "reminder",
	Note = "note",
}

/** JS-Date compatible, 0-based month index. */
export enum Month {
	January = 0,
	February = 1,
	March = 2,
	April = 3,
	May = 4,
	June = 5,
	July = 6,
	August = 7,
	September = 8,
	October = 9,
	November = 10,
	December = 11,
}

/** ISO-8601 weekday numbers (1 = Monday ... 7 = Sunday). */
export enum Weekday {
	Monday = 1,
	Tuesday = 2,
	Wednesday = 3,
	Thursday = 4,
	Friday = 5,
	Saturday = 6,
	Sunday = 7,
}

export enum EntryCategory {
	Event = "event",
	Reminder = "reminder",
	Note = "note",
}

export enum StorageKey {
	Entries = "clock.entries.v1",
	Theme = "clock.theme.v1",
	ListPeriod = "clock.list.period.v1",
	ListHolidays = "clock.list.holidays.v1",
	ListPast = "clock.list.past.v1",
}

export enum ChimeSource {
	Default = "default",
	Custom = "custom",
	Recorded = "recorded",
}

export enum CalendarProvider {
	ICal = "ical",
	Google = "google",
	Outlook = "outlook",
	Apple = "apple",
	Custom = "custom",
}

export enum ConnectionState {
	Checking = "checking",
	Ready = "ready",
	MissingClientId = "missingClientId",
	MissingToken = "missingToken",
	Connected = "connected",
	Failed = "failed",
}

export enum SyncDirection {
	Export = "export",
	Import = "import",
}

/** Actions offered on a fired alarm notification. */
export enum AlarmActionId {
	Cancel = "cancel",
	Snooze = "snooze",
}

/** Period scope for the appointment list. */
export enum ListPeriod {
	Day = "day",
	Week = "week",
	Month = "month",
	All = "all",
}

/** Whether public holidays are shown in the list. */
export enum HolidayMode {
	With = "with",
	Without = "without",
}

/** iOS UNNotificationInterruptionLevel - time-sensitive breaks through Focus. */
export enum NotificationInterruptionLevel {
	Active = "active",
	TimeSensitive = "timeSensitive",
	Critical = "critical",
}

/** Whether past appointments are shown. Default: hidden. */
export enum PastMode {
	Hide = "hide",
	Show = "show",
}

export enum EntryValidationError {
	EmptyTitle = "emptyTitle",
	InvalidDate = "invalidDate",
	InvalidTime = "invalidTime",
	DuplicateId = "duplicateId",
}
