import {
	AlarmStatus,
	CalendarProvider,
	ConnectionState,
	EntryCategory,
	EntryFilter,
	EntryValidationError,
	TabId,
	Theme,
} from "./enums";

export const TAB_IDS: readonly TabId[] = [TabId.Alarm, TabId.Calendar, TabId.Appointments];
export const ENTRY_CATEGORIES: readonly EntryCategory[] = [
	EntryCategory.Event,
	EntryCategory.Reminder,
	EntryCategory.Note,
];
export const ENTRY_FILTERS: readonly EntryFilter[] = [
	EntryFilter.All,
	EntryFilter.Event,
	EntryFilter.Reminder,
	EntryFilter.Note,
];

export const TAB_LABEL: Record<TabId, string> = {
	[TabId.Calendar]: "Kalender",
	[TabId.Appointments]: "Termine",
	[TabId.Alarm]: "Wecker",
};

export const ENTRY_FILTER_LABEL: Record<EntryFilter, string> = {
	[EntryFilter.All]: "Alle",
	[EntryFilter.Event]: "Termine",
	[EntryFilter.Reminder]: "Erinnerungen",
	[EntryFilter.Note]: "Notizen",
};

export const ENTRY_CATEGORY_LABEL: Record<EntryCategory, string> = {
	[EntryCategory.Event]: "Termin",
	[EntryCategory.Reminder]: "Erinnerung",
	[EntryCategory.Note]: "Notiz",
};

export const ENTRY_CATEGORY_DOT: Record<EntryCategory, string> = {
	[EntryCategory.Event]: "bg-sky-500",
	[EntryCategory.Reminder]: "bg-amber-500",
	[EntryCategory.Note]: "bg-emerald-500",
};

export const THEME_LABEL: Record<Theme, string> = {
	[Theme.Light]: "Hell",
	[Theme.Dark]: "Dunkel",
};

export const VALIDATION_MESSAGE: Record<EntryValidationError, string> = {
	[EntryValidationError.EmptyTitle]: "Bitte einen Titel eingeben.",
	[EntryValidationError.InvalidDate]: "Ungueltiges Datum.",
	[EntryValidationError.InvalidTime]: "Ungueltige Uhrzeit (HH:MM).",
	[EntryValidationError.DuplicateId]: "Dieser Eintrag existiert bereits.",
};

export const EMPTY_AGENDA_MESSAGE = "Heute keine Termine.";
export const CHIME_LABEL = "Klingelton";
export const CHIME_DEFAULT_LABEL = "Standard";
export const CHIME_CUSTOM_LABEL = "Eigene MP3";
export const CHIME_YOUTUBE_LABEL = "YouTube";
export const CHIME_RECORD_LABEL = "Aufnahme";
export const CHIME_RECORD_START = "● Aufnehmen";
export const CHIME_RECORD_STOP = "■ Stopp";
export const CHIME_RECORD_UNAVAILABLE = "Mikrofon nicht verfuegbar (Browser oder Berechtigung).";
export const CHIME_RECORD_DENIED = "Mikrofon-Zugriff verweigert.";
export const CHIME_RECORD_NAME = "Eigene Aufnahme";
export const CHIME_YOUTUBE_PLACEHOLDER = "https://www.youtube.com/watch?v=...";
export const CHIME_YOUTUBE_INVALID = "Keine gueltige YouTube-URL.";
export const YOUTUBE_EMBED_ORIGIN = "https://www.youtube-nocookie.com/embed/";
export const CHIME_PICK_LABEL = "MP3 vom Geraet waehlen";
export const CHIME_PREVIEW_LABEL = "Anhoeren";
export const CHIME_TOO_LARGE = "Datei zu gross (max. 1,5 MB).";
export const CHIME_WRONG_TYPE = "Bitte eine MP3-Datei waehlen.";

export const ALARM_STATUS_LABEL: Record<AlarmStatus, string> = {
	[AlarmStatus.Due]: "Jetzt faellig",
	[AlarmStatus.Upcoming]: "Heute",
	[AlarmStatus.Today]: "Heute",
	[AlarmStatus.Past]: "Vergangen",
	[AlarmStatus.Future]: "Demnaechst",
};

export const ALARM_STATUS_DOT: Record<AlarmStatus, string> = {
	[AlarmStatus.Due]: "bg-rose-500",
	[AlarmStatus.Upcoming]: "bg-sky-500",
	[AlarmStatus.Today]: "bg-sky-500",
	[AlarmStatus.Past]: "bg-slate-400",
	[AlarmStatus.Future]: "bg-emerald-500",
};

export const EMPTY_ALARM_MESSAGE = "Noch keine Weckzeiten. Tippe auf + um eine anzulegen.";
export const ADD_ENTRY_LABEL = "Neuer Eintrag";
export const EDIT_ENTRY_LABEL = "Eintrag bearbeiten";
export const ADD_ENTRY_SUBMIT = "+ Eintrag anlegen";
export const SAVE_ENTRY_SUBMIT = "Speichern";
export const ADD_ENTRY_HINT =
	"Ein Formular fuer Termine und Weckzeiten - beides sind Eintraege mit Datum und Uhrzeit.";
export const EDIT_ENTRY_HINT = "Klick auf einen Eintrag in der Liste bearbeitet ihn hier.";
export const ADD_ENTRY_TITLE_LABEL = "Titel";
export const ADD_ENTRY_DATE_LABEL = "Datum";
export const ADD_ENTRY_TIME_LABEL = "Uhrzeit";
export const ADD_ENTRY_NOTE_LABEL = "Notiz (optional)";
export const ADD_ENTRY_CATEGORY_LABEL = "Kategorie";
export const PICK_DATE_LABEL = "Datum im Kalender waehlen";
export const HIDE_CALENDAR_LABEL = "Kalender ausblenden";

export const CALENDAR_PROVIDERS: readonly CalendarProvider[] = [
	CalendarProvider.ICal,
	CalendarProvider.Google,
	CalendarProvider.Outlook,
];

export const CALENDAR_PROVIDER_LABEL: Record<CalendarProvider, string> = {
	[CalendarProvider.ICal]: "iCal (.ics)",
	[CalendarProvider.Google]: "Google Kalender",
	[CalendarProvider.Outlook]: "Outlook",
	[CalendarProvider.Apple]: "Mac / Apple Kalender",
	[CalendarProvider.Custom]: "Custom-Anbieter",
};
export const SIGN_IN_GOOGLE_LABEL = "Bei Google anmelden";
export const SIGN_IN_APPLE_LABEL = "Bei Mac anmelden";
export const SIGN_IN_CUSTOM_LABEL = "Custom-Anbieter waehlen";
export const PENDING_CONNECTION_HINT =
	"Gespeicherte Verbindung - bitte erneut anmelden (OAuth braucht einen Klick).";

export const CALENDAR_PROVIDER_HINT: Record<CalendarProvider, string> = {
	[CalendarProvider.ICal]: "Datei exportieren oder importieren - ohne Anmeldung.",
	[CalendarProvider.Google]: "Braucht VITE_GOOGLE_CLIENT_ID (OAuth).",
	[CalendarProvider.Outlook]: "Braucht VITE_OUTLOOK_CLIENT_ID (OAuth).",
	[CalendarProvider.Apple]: "Apple Kalender: .ics-Export oder Anmeldung ueber den Systemdialog.",
	[CalendarProvider.Custom]: "Eigener CalDAV-/ICS-Endpunkt.",
};

export const EXPORT_LABEL = "Exportieren";
export const IMPORT_LABEL = "Importieren";
export const INTERNAL_EXPORT_LABEL = "Interner Export";
export const INTERNAL_EXPORT_HINT =
	"Aktualisiert sich automatisch bei jeder Aenderung - ohne Datei.";
export const COPY_LABEL = "Kopieren";
export const COPIED_LABEL = "Kopiert";
export const SYNC_NOT_CONFIGURED = "OAuth-Client-ID fehlt. Bitte .env anlegen (siehe .env.sample).";
export const SYNC_ICAL_EXPORT_OK = "ICS-Datei heruntergeladen.";
export const SYNC_IMPORT_OK = "Termine importiert.";
export const SYNC_IMPORT_EMPTY = "Keine Termine in der Datei gefunden.";
export const SYNC_ERROR_EMPTY_EXPORT = "Keine Termine zum Exportieren vorhanden.";
export const SYNC_GOOGLE_OK = "An Google Kalender gesendet.";
export const SYNC_OUTLOOK_OK = "An Outlook gesendet.";

export const CONNECT_GOOGLE_LABEL = "Mit Google verbinden";
export const CONNECT_OUTLOOK_LABEL = "Mit Outlook verbinden";
export const CONNECTION_MODAL_TITLE: Record<CalendarProvider, string> = {
	[CalendarProvider.ICal]: "iCal",
	[CalendarProvider.Google]: "Google Kalender verbinden",
	[CalendarProvider.Outlook]: "Outlook verbinden",
	[CalendarProvider.Apple]: "Mac / Apple Kalender verbinden",
	[CalendarProvider.Custom]: "Custom-Anbieter verbinden",
};
export const CONNECTION_STATE_LABEL: Record<ConnectionState, string> = {
	[ConnectionState.Checking]: "Verbindung wird geprueft...",
	[ConnectionState.Ready]: "Konfiguriert - verbinde automatisch...",
	[ConnectionState.MissingClientId]:
		"OAuth-Client-ID fehlt (VITE_GOOGLE_CLIENT_ID bzw. VITE_OUTLOOK_CLIENT_ID in .env.local).",
	[ConnectionState.MissingToken]: "Access Token fehlt - bitte einfuegen.",
	[ConnectionState.Connected]: "Verbunden. Termine uebertragen.",
	[ConnectionState.Failed]: "Verbindung fehlgeschlagen.",
};
export const CLOSE_LABEL = "Schliessen";
export const RETRY_LABEL = "Erneut versuchen";

export const EMPTY_LIST_MESSAGE: Record<EntryFilter, string> = {
	[EntryFilter.All]: "Noch keine Eintraege. Lege oben einen Termin an.",
	[EntryFilter.Event]: "Keine Termine vorhanden.",
	[EntryFilter.Reminder]: "Keine Erinnerungen vorhanden.",
	[EntryFilter.Note]: "Keine Notizen vorhanden.",
};
