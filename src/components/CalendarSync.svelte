<script lang="ts">
import { CalendarProvider } from "../lib/enums";
import { exportIcs, parseIcs } from "../lib/ical";
import {
	CALENDAR_PROVIDER_HINT,
	CALENDAR_PROVIDER_LABEL,
	CALENDAR_PROVIDERS,
	CONNECT_GOOGLE_LABEL,
	CONNECT_OUTLOOK_LABEL,
	EXPORT_LABEL,
	IMPORT_LABEL,
	SYNC_ERROR_EMPTY_EXPORT,
	SYNC_GOOGLE_OK,
	SYNC_ICAL_EXPORT_OK,
	SYNC_IMPORT_EMPTY,
	SYNC_IMPORT_OK,
	SYNC_NOT_CONFIGURED,
	SYNC_OUTLOOK_OK,
} from "../lib/labels";
import { isIosSafari } from "../lib/platform";
import { getProviderConfig, pushEvents } from "../lib/providers";
import type { CalendarEntry } from "../lib/types";
import ConnectionModal from "./ConnectionModal.svelte";

interface Props {
	entries: readonly CalendarEntry[];
	onImport: (entries: readonly CalendarEntry[]) => void;
}

let { entries, onImport }: Props = $props();

let provider = $state<CalendarProvider>(CalendarProvider.ICal);
let accessToken = $state("");
let message = $state("");
let isError = $state(false);
let modalOpen = $state(false);

const googleClientId: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
const outlookClientId: string = import.meta.env.VITE_OUTLOOK_CLIENT_ID ?? "";

const config = $derived(
	getProviderConfig(
		provider,
		provider === CalendarProvider.Google ? googleClientId : outlookClientId,
	),
);

function setProvider(next: CalendarProvider): void {
	provider = next;
	message = "";
	isError = false;
	modalOpen = false;
}

function openConnection(): void {
	modalOpen = true;
}

function closeConnection(): void {
	modalOpen = false;
}

function notify(text: string, error = false): void {
	message = text;
	isError = error;
}

function downloadIcs(): void {
	const ics = exportIcs(entries);
	const ios = isIosSafari(navigator.userAgent, navigator.maxTouchPoints);
	if (ios) {
		// iOS Safari ignores <a download>; open the calendar data in a new tab.
		const dataUrl = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
		window.open(dataUrl, "_blank");
		return;
	}
	const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = "clock-termine.ics";
	anchor.click();
	URL.revokeObjectURL(url);
}

async function handleExport(): Promise<void> {
	message = "";
	if (entries.length === 0) {
		notify(SYNC_ERROR_EMPTY_EXPORT, true);
		return;
	}

	if (provider === CalendarProvider.ICal) {
		downloadIcs();
		notify(SYNC_ICAL_EXPORT_OK);
		return;
	}

	if (!config.configured) {
		notify(SYNC_NOT_CONFIGURED, true);
		return;
	}

	const result = await pushEvents(provider, entries, accessToken, config.clientId);
	if (!result.ok) {
		notify(
			result.reason === "api-error" ? "API hat den Termin abgelehnt." : SYNC_NOT_CONFIGURED,
			true,
		);
		return;
	}
	notify(provider === CalendarProvider.Google ? SYNC_GOOGLE_OK : SYNC_OUTLOOK_OK);
}

function readFile(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result ?? ""));
		reader.onerror = () => reject(reader.error);
		reader.readAsText(file);
	});
}

async function handleFile(event: Event): Promise<void> {
	const input = event.currentTarget as HTMLInputElement;
	const file = input.files?.[0];
	if (!file) return;
	const parsed = parseIcs(await readFile(file));
	if (parsed.length === 0) {
		notify(SYNC_IMPORT_EMPTY, true);
		return;
	}
	onImport(parsed);
	notify(SYNC_IMPORT_OK.replace("Termine", `${parsed.length} Termine`));
	input.value = "";
}
</script>

<section aria-label="Kalender-Synchronisierung" class="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-800/60">
	<div class="mb-3 flex items-center justify-between gap-2">
		<h2 class="text-sm font-semibold text-slate-700 dark:text-slate-200">Kalender verbinden</h2>
		{#if config.configured}
			<span class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">bereit</span>
		{:else}
			<span class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">nicht konfiguriert</span>
		{/if}
	</div>

	<fieldset class="mb-3">
		<legend class="sr-only">Kalender-Anbieter</legend>
		<div class="flex flex-wrap gap-1">
			{#each CALENDAR_PROVIDERS as option (option)}
				<button
					type="button"
					data-testid="provider-{option}"
					aria-pressed={provider === option}
					onclick={() => setProvider(option)}
					class="rounded-full border px-3 py-1 text-xs font-medium transition-colors {provider === option
						? 'border-sky-500 bg-sky-500 text-white'
						: 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-600 dark:text-slate-400'}"
				>
					{CALENDAR_PROVIDER_LABEL[option]}
				</button>
			{/each}
		</div>
	</fieldset>

	<p class="mb-3 text-xs text-slate-400 dark:text-slate-500">{CALENDAR_PROVIDER_HINT[provider]}</p>

	{#if provider !== CalendarProvider.ICal}
		<button type="button" data-testid="open-connection" onclick={openConnection} class="mb-3 w-full rounded-lg border border-sky-500 px-3 py-2 text-xs font-semibold text-sky-600 transition-colors hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-900/20">
			{provider === CalendarProvider.Google ? CONNECT_GOOGLE_LABEL : CONNECT_OUTLOOK_LABEL}
		</button>
	{/if}

	<div class="flex flex-wrap gap-2">
		<button type="button" data-testid="sync-export" onclick={handleExport} class="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-500">
			{EXPORT_LABEL}
		</button>

		<label class="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">
			{IMPORT_LABEL}
			<input data-testid="sync-import" type="file" accept=".ics,text/calendar" onchange={handleFile} class="sr-only" />
		</label>
	</div>

	{#if message}
		<p role="status" data-testid="sync-status" class="mt-3 text-xs font-medium {isError ? 'text-rose-600' : 'text-emerald-600'}">{message}</p>
	{/if}
</section>

{#if modalOpen && provider !== CalendarProvider.ICal}
	<ConnectionModal
		{provider}
		clientId={config.clientId}
		{entries}
		onClose={closeConnection}
	/>
{/if}
