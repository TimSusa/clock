<script lang="ts">
import { onMount } from "svelte";
import AddEntryModal from "./components/AddEntryModal.svelte";
import EntryList from "./components/EntryList.svelte";
import { claimAndFire, firedKeyForDay } from "./lib/alarms-run";
import { TICK_INTERVAL_MS } from "./lib/constants";
import { addEntry, loadEntries, removeEntry, saveEntries, updateEntry } from "./lib/entries";
import { Theme } from "./lib/enums";
import { THEME_LABEL } from "./lib/labels";
import type { NotificationPort } from "./lib/notification-port";
import { createNotificationPort } from "./lib/notification-port";
import { loadPreferences, savePreferences } from "./lib/preferences";
import { browserPlayer } from "./lib/sound";
import { isoDateKey } from "./lib/time";
import type { CalendarEntry } from "./lib/types";

const initial = new Date();

let now = $state<Date>(initial);
let prefs = $state(loadPreferences());
let entries = $state<readonly CalendarEntry[]>(loadEntries());
let selectedIso = $state<string>(isoDateKey(initial));
let showAddModal = $state(false);
let editing = $state<CalendarEntry | undefined>(undefined);

let firedIds: string[] = [];
let firedDay = firedKeyForDay(initial);
let notificationPort = $state<NotificationPort | null>(null);

$effect(() => {
	document.documentElement.classList.toggle("dark", prefs.theme === Theme.Dark);
});

$effect(() => {
	savePreferences(prefs);
});

$effect(() => {
	saveEntries(entries);
});

// Re-plan native alarms on every change (add/edit/delete/import). This is what
// makes the alarm fire even when the app is closed - the OS owns the schedule.
$effect(() => {
	const current = entries;
	const port = notificationPort;
	if (port) void port.reschedule(current, new Date());
});

onMount(() => {
	void createNotificationPort().then(async (port) => {
		await port.requestPermission();
		notificationPort = port;
	});

	const timer = window.setInterval(() => {
		const next = new Date();
		now = next;
		const day = firedKeyForDay(next);
		if (day !== firedDay) {
			firedDay = day;
			firedIds = [];
		}
		void claimAndFire(entries, next, firedIds, browserPlayer);
	}, TICK_INTERVAL_MS);
	return () => window.clearInterval(timer);
});

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
}

function handleImport(imported: readonly CalendarEntry[]): void {
	entries = [...entries, ...imported];
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
			<EntryList
				{now}
				{entries}
				onAdd={openAddModal}
				onEdit={openEditModal}
				onRemove={handleRemove}
				onImport={handleImport}
			/>
		</main>

		<footer class="mt-4 text-center text-xs text-slate-400 dark:text-slate-600">
			{entries.length} Eintrag{entries.length === 1 ? "" : "e"} gespeichert
		</footer>
	</div>

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
