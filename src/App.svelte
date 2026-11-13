<script lang="ts">
import { onMount } from "svelte";
import AddEntryModal from "./components/AddEntryModal.svelte";
import AlarmDialog from "./components/AlarmDialog.svelte";
import EntryList from "./components/EntryList.svelte";
import { applyAlarmAction } from "./lib/alarm-actions";
import {
	alarmFromNotification,
	applyPerformedAction,
	LOCAL_NOTIFICATION_RECEIVED,
	registerAlarmActions,
} from "./lib/alarm-bridge";
import { claimAndFire, firedKeyForDay, releaseFiredId } from "./lib/alarms-run";
import { mergeImportedEvents } from "./lib/calendar-import";
import type { CalendarPort } from "./lib/calendar-port";
import { syncToCalendar } from "./lib/calendar-port";
import { TICK_INTERVAL_MS } from "./lib/constants";
import { addEntry, loadEntries, removeEntry, saveEntries, updateEntry } from "./lib/entries";
import { AlarmActionId, StorageKey, Theme } from "./lib/enums";
import { THEME_LABEL } from "./lib/labels";
import { createCalendarPort } from "./lib/native-calendar-port";
import { isNativeShell } from "./lib/native-shell";
import type { NotificationPort } from "./lib/notification-port";
import { createNotificationPort } from "./lib/notification-port";
import { loadPreferences, savePreferences } from "./lib/preferences";
import { createAlarmPlayer } from "./lib/sound";
import { armSoundFiles, removeSoundFile } from "./lib/sound-file";
import { soundFilePort } from "./lib/sound-file-native";
import { createStoragePort, initStorage } from "./lib/storage";
import { isoDateKey } from "./lib/time";
import type { CalendarEntry } from "./lib/types";

const initial = new Date();

let now = $state<Date>(initial);
// localStorage (web) is synchronous and available immediately; only the
// native Preferences bridge needs an async init, so `ready` starts true on web.
let ready = $state(!isNativeShell());
let prefs = $state(loadPreferences());
let entries = $state<readonly CalendarEntry[]>(loadEntries());
let selectedIso = $state<string>(isoDateKey(initial));
let showAddModal = $state(false);
let editing = $state<CalendarEntry | undefined>(undefined);

let firedIds: string[] = [];
let firedDay = firedKeyForDay(initial);
let notificationPort = $state<NotificationPort | null>(null);
let calendarPort: CalendarPort | null = null;
// Snapshot of the last state pushed to the native calendar; kept outside the
// reactive graph so writing externalId back cannot retrigger the effect.
let syncedToCalendar: readonly CalendarEntry[] = loadEntries();
let calendarSyncRunning = false;
let activeAlarm = $state<CalendarEntry | undefined>(undefined);
// One shared, stoppable player: the alarm dialog owns foreground playback and
// stops it on Cancel/Snooze/unmount. The ticker only claims ids - no second,
// unstoppable Audio instance (the "sound keeps ringing after Cancel" bug).
const alarmPlayer = createAlarmPlayer();

$effect(() => {
	document.documentElement.classList.toggle("dark", prefs.theme === Theme.Dark);
});

$effect(() => {
	savePreferences(prefs);
});

$effect(() => {
	if (!ready) return;
	saveEntries(entries);
});

// Re-plan native alarms on every change (add/edit/delete/import). This is what
// makes the alarm fire even when the app is closed - the OS owns the schedule.
$effect(() => {
	const current = entries;
	const port = notificationPort;

	if (!port || !ready) return;
	void (async () => {
		// Own chimes MUST exist in Library/Sounds BEFORE scheduling. A failing
		// write is logged (never silently swallowed) so a silent alarm is debuggable.
		await armSoundFiles(current, soundFilePort(), (error) => {
			console.error("[clock] sound file write failed:", error);
		});
		await port.reschedule(current, new Date());
	})();
});

// Mirror every change into the native calendar (save / load / edit / delete).
// The guard prevents overlapping syncs; links are written back once, then the
// snapshot advances so the $effect settles instead of looping.
$effect(() => {
	const current = entries;
	const port = calendarPort;
	if (!port || calendarSyncRunning) return;
	calendarSyncRunning = true;
	void (async () => {
		try {
			const links = await syncToCalendar(port, syncedToCalendar, current);
			if (links.length > 0) {
				entries = current.map((entry) => {
					const link = links.find((l) => l.id === entry.id);
					return link ? { ...entry, externalId: link.externalId } : entry;
				});
			}
			syncedToCalendar = entries;
		} finally {
			calendarSyncRunning = false;
		}
	})();
});

onMount(() => {
	// ONE startup init: inject the (single) Preferences bridge, migrate legacy
	// localStorage data, prime the cache, THEN expose the stored state.
	void (async () => {
		let preferences = null;
		if (isNativeShell()) {
			try {
				const mod = await import("@capacitor/preferences");
				preferences = mod.Preferences as never;
			} catch {
				/* web proxy: fall back to localStorage */
			}
		}
		const port = await createStoragePort(preferences);
		await initStorage(port, Object.values(StorageKey));
		prefs = loadPreferences();
		entries = loadEntries();
		syncedToCalendar = entries;
		ready = true;
	})();

	// Ask for authorization BEFORE exposing the port: the reschedule $effect
	// only runs once notificationPort is set, so center.add() can never race
	// ahead of the permission prompt and silently fail.

	// SINGLE import shared by action registration, listeners AND the port.
	void (async () => {
		if (!isNativeShell()) {
			notificationPort = createNotificationPort(null);
			return;
		}
		try {
			const { LocalNotifications } = await import("@capacitor/local-notifications");
			const port = createNotificationPort(LocalNotifications as never);
			try {
				await port.requestPermission();
			} finally {
				notificationPort = port;
			}
		} catch {
			notificationPort = createNotificationPort(null);
		}
	})();

	// Import existing native calendar events at startup, merge without duplicates,
	// then arm the sync snapshot so imported events are not written back again.
	void createCalendarPort().then(async (port) => {
		const granted = await port.requestPermissions();
		if (granted) {
			try {
				const imported = await port.listEvents();
				const merged = mergeImportedEvents(entries, imported);
				entries = merged;
				syncedToCalendar = merged;
			} catch {
				/* permission denied / no calendar: local store stays intact */
			}
		}
		calendarPort = port;
	});

	// Native notification buttons: Cancel / +15min. Foreground:true brings the
	// app up so the in-app alarm dialog is visible when the alarm fires.
	void (async () => {
		if (!isNativeShell()) return;
		try {
			const { LocalNotifications } = await import("@capacitor/local-notifications");
			await registerAlarmActions(LocalNotifications as never);
			await LocalNotifications.addListener(
				"localNotificationActionPerformed",
				(event: { actionId: string; notification: { extra?: Record<string, unknown> } }) => {
					applyPerformedAction(event, handleAlarmAction);
				},
			);
			// Fired when the app is brought up by the Lock-Screen banner (or is
			// already active). The OS already played the chime; the dialog follows.
			await LocalNotifications.addListener(LOCAL_NOTIFICATION_RECEIVED, (event: unknown) => {
				const entryId = alarmFromNotification(
					event as { notification?: { extra?: Record<string, unknown> } },
				);
				if (entryId) raiseAlarm(entryId);
			});
		} catch {
			/* web build: no native notification bridge */
		}
	})();

	const timer = window.setInterval(() => {
		const next = new Date();
		now = next;
		const day = firedKeyForDay(next);
		if (day !== firedDay) {
			firedDay = day;
			firedIds = [];
		}
		// In-app alarm window for the foreground case.
		const due = entries.find(
			(e) =>
				e.iso === isoDateKey(next) &&
				e.time ===
					`${String(next.getHours()).padStart(2, "0")}:${String(next.getMinutes()).padStart(2, "0")}` &&
				!firedIds.includes(e.id),
		);
		if (due) raiseAlarm(due.id);
		void claimAndFire(entries, next, firedIds);
	}, TICK_INTERVAL_MS);
	return () => window.clearInterval(timer);
});

/**
 * Raise the in-app alarm window for an entry. Used by the foreground ticker
 * AND by the native notification listener (the only path that works after the
 * device was locked, because iOS suspends the WebView while locked).
 */
function raiseAlarm(entryId: string): void {
	if (activeAlarm) return;
	const entry = entries.find((e) => e.id === entryId);
	if (!entry) return;
	activeAlarm = entry;
	// `firedIds` is claimed ONLY by claimAndFire() in the same tick (one source
	// of truth). Do not claim here: it would permanently block a second trigger
	// of the same alarm on the same day.
}

function handleAlarmAction(entryId: string, action: AlarmActionId): void {
	if (action === AlarmActionId.Snooze) entries = applyAlarmAction(entries, entryId, action);
	activeAlarm = undefined;
	firedIds = releaseFiredId(firedIds, entryId);
}

function dismissAlarm(): void {
	if (activeAlarm) firedIds = releaseFiredId(firedIds, activeAlarm.id);
	activeAlarm = undefined;
}

function snoozeAlarm(): void {
	if (activeAlarm) {
		firedIds = releaseFiredId(firedIds, activeAlarm.id);
		entries = applyAlarmAction(entries, activeAlarm.id, AlarmActionId.Snooze);
	}
	activeAlarm = undefined;
}

function openAddModal(): void {
	selectedIso = isoDateKey(new Date());
	editing = undefined;
	showAddModal = true;
}

function openEditModal(entry: CalendarEntry): void {
	editing = entry;
	showAddModal = true;
}

function closeAddModal(): void {
	showAddModal = false;
	editing = undefined;
}

function handleSave(entry: CalendarEntry): void {
	entries = editing ? updateEntry(entries, entry) : addEntry(entries, entry);
}

function handleRemove(id: string): void {
	entries = removeEntry(entries, id);
	void removeSoundFile(soundFilePort(), id);
}

function handleImport(imported: readonly CalendarEntry[]): void {
	entries = mergeImportedEvents(entries, imported);
}

function toggleTheme(): void {
	prefs = {
		...prefs,
		theme: prefs.theme === Theme.Light ? Theme.Dark : Theme.Light,
	};
}
</script>

<svelte:head>
	<title>Clock</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/40 to-slate-100 text-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-slate-100">
	<div class="mx-auto max-w-2xl px-5 pt-[calc(2rem+env(safe-area-inset-top))] pb-10">
		<header class="mb-8 flex items-center justify-between gap-4">
			<div>
				<h1 class="text-xl font-semibold tracking-tight">Clock</h1>
				<p class="text-xs text-slate-400 dark:text-slate-500">Alle Termine &amp; Weckzeiten</p>
			</div>

			<button
				type="button"
				data-testid="theme-toggle"
				aria-label="Farbschema wechseln"
				onclick={toggleTheme}
				class="rounded-full border border-slate-200 bg-white/60 px-3 py-1.5 text-sm transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-700"
			>
				{prefs.theme === Theme.Light ? "◐" : "☀"} <span class="hidden sm:inline">{THEME_LABEL[prefs.theme]}</span>
			</button>
		</header>

		<main>
			{#if ready}
				<EntryList
					{now}
					{entries}
					onAdd={openAddModal}
					onEdit={openEditModal}
					onRemove={handleRemove}
					onImport={handleImport}
				/>
			{:else}
				<p data-testid="storage-loading" class="py-8 text-center text-sm text-slate-400">Lade …</p>
			{/if}
		</main>

		<footer class="mt-4 text-center text-xs text-slate-400 dark:text-slate-600">
			{entries.length} Eintrag{entries.length === 1 ? "" : "e"} gespeichert
		</footer>
	</div>

	{#if activeAlarm}
		<AlarmDialog
			entry={activeAlarm}
			player={alarmPlayer}
			onCancel={dismissAlarm}
			onSnooze={snoozeAlarm}
		/>
	{/if}

	{#if showAddModal}
		<AddEntryModal
			{entries}
			entry={editing}
			defaultIso={selectedIso}
			onSave={handleSave}
			onClose={closeAddModal}
		/>
	{/if}
</div>
