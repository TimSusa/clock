<script lang="ts">
import { onDestroy } from "svelte";
import { buildMonthGrid, shiftMonth } from "../lib/calendar";
import { defaultChime } from "../lib/chime";
import { AUDIO_FILE_ACCEPT, DEFAULT_CHIME_NAME } from "../lib/constants";
import { createEntry, validateDraft } from "../lib/entries";
import { ChimeSource, EntryCategory, EntryValidationError, Month } from "../lib/enums";
import {
	ADD_ENTRY_CATEGORY_LABEL,
	ADD_ENTRY_DATE_LABEL,
	ADD_ENTRY_HINT,
	ADD_ENTRY_LABEL,
	ADD_ENTRY_NOTE_LABEL,
	ADD_ENTRY_SUBMIT,
	ADD_ENTRY_TIME_LABEL,
	ADD_ENTRY_TITLE_LABEL,
	CHIME_CONVERT_FAILED,
	CHIME_CUSTOM_LABEL,
	CHIME_DEFAULT_LABEL,
	CHIME_FILE_INVALID,
	CHIME_LABEL,
	CHIME_NONE_HINT,
	CHIME_PREVIEW_LABEL,
	CHIME_RECORD_DENIED,
	CHIME_RECORD_LABEL,
	CHIME_RECORD_NAME,
	CHIME_RECORD_START,
	CHIME_RECORD_STOP,
	CHIME_RECORD_UNAVAILABLE,
	CLOSE_LABEL,
	EDIT_ENTRY_HINT,
	EDIT_ENTRY_LABEL,
	ENTRY_CATEGORIES,
	ENTRY_CATEGORY_LABEL,
	EXTRA_CHIME_LABEL,
	EXTRA_CHIME_OFF,
	EXTRA_CHIME_ON,
	HIDE_CALENDAR_LABEL,
	PICK_DATE_LABEL,
	SAVE_ENTRY_SUBMIT,
	VALIDATION_MESSAGE,
} from "../lib/labels";
import type { RecorderLike } from "../lib/recording";
import { isAcceptableRecording, recordChime } from "../lib/recording";
import { createPreviewController, isAcceptableAudioFile, resolveChimeUrl } from "../lib/sound";
import { currentTimeKey, parseIsoDate } from "../lib/time";
import type { CalendarEntry, MonthGrid } from "../lib/types";
import { blobToDataUrl, browserWavDeps, normalizeOwnChime } from "../lib/wav";
import CalendarGrid from "./CalendarGrid.svelte";

interface Props {
	defaultIso: string;
	entries: readonly CalendarEntry[];
	entry?: CalendarEntry | undefined;
	onSave: (entry: CalendarEntry) => void;
	onClose: () => void;
}

let { defaultIso, entries, entry, onSave, onClose }: Props = $props();

// The modal is mounted fresh on each open ({#if} in App). Reading the props once
// inside an initialiser keeps the edit form stable while every field stays editable.
function snapshot(): {
	initial: CalendarEntry | undefined;
	initialIso: string;
	initialDate: Date;
} {
	const target = entry;
	const iso = target?.iso ?? defaultIso;
	return {
		initial: target,
		initialIso: iso,
		initialDate: parseIsoDate(iso) ?? new Date(),
	};
}

const { initial, initialIso, initialDate } = snapshot();
const isEdit: boolean = initial !== undefined;

let title: string = $state(initial?.title ?? "");
let note: string = $state(initial?.note ?? "");
// New entries start at the current time; editing keeps the stored time.
let time: string = $state(initial?.time ?? currentTimeKey());
let category: EntryCategory = $state(initial?.category ?? EntryCategory.Event);
let dateOverride = $state<string | null>(null);
let error: EntryValidationError | null = $state(null);
let showCalendar = $state(false);
let extraChime: boolean = $state(initial?.extraChime ?? defaultChime().extraChime);
let chimeSource: ChimeSource = $state(initial?.chimeSource ?? defaultChime().chimeSource);
let chimeName: string = $state(initial?.chimeName ?? DEFAULT_CHIME_NAME);
let chimeDataUrl: string = $state(initial?.chimeDataUrl ?? "");
let chimeError = $state("");
let chimeFallbackHint = $state("");
/** In-flight file conversion; handleSubmit awaits it so a fast Save never stores an empty chime. */
let pendingChime: Promise<void> | null = null;
let isRecording = $state(false);
let pendingStop = false;
let activeRecorder: RecorderLike | null = null;
let activeStream: MediaStream | null = null;

const preview = createPreviewController();

function releaseRecorder(): void {
	if (activeRecorder && activeRecorder.state === "recording") activeRecorder.stop();
	activeRecorder = null;
	activeStream?.getTracks().forEach((track) => track.stop());
	activeStream = null;
	isRecording = false;
	pendingStop = false;
}

onDestroy(() => {
	preview.stop();
	releaseRecorder();
});

const date: string = $derived(dateOverride ?? initialIso);
let viewYear = $state<number>(initialDate.getFullYear());
let viewMonth: Month = $state(initialDate.getMonth() as Month);

const grid: MonthGrid = $derived(buildMonthGrid(viewYear, viewMonth, new Date()));

async function handleSubmit(event: SubmitEvent): Promise<void> {
	event.preventDefault();
	// A picked file is transcoded asynchronously. Await it before building the
	// draft, otherwise a quick Save would persist an empty chime silently.
	if (pendingChime) {
		await pendingChime;
		pendingChime = null;
	}
	const draft = createEntry({
		iso: date,
		time,
		title,
		category,
		note,
		chimeSource,
		chimeName,
		chimeDataUrl,
		extraChime,
	});
	const validation = validateDraft(draft);
	if (validation !== null) {
		error = validation;
		return;
	}
	preview.stop();
	releaseRecorder();
	if (initial) {
		const edited: CalendarEntry = { ...draft, id: initial.id };
		// Keep the native calendar link so editing updates the exact EventKit event.
		if (initial.externalId) edited.externalId = initial.externalId;
		onSave(edited);
	} else {
		onSave(draft);
	}
	onClose();
}

function closeModal(): void {
	preview.stop();
	releaseRecorder();
	onClose();
}

function selectDefaultChime(): void {
	preview.stop();
	chimeSource = ChimeSource.Default;
	chimeName = DEFAULT_CHIME_NAME;
	chimeDataUrl = "";
	chimeError = "";
	chimeFallbackHint = "";
}

/**
 * ONE path for any own chime (microphone Blob or picked MP3 File). The raw
 * Blob is transcoded directly - no data-URL round-trip. On a real codec gap
 * the entry falls back to the bundled default sound at alarm time, so the
 * hint says exactly that instead of claiming the recording will be used.
 */
async function applyOwnChime(blob: Blob): Promise<void> {
	chimeError = "";
	chimeFallbackHint = "";
	try {
		// Keep the raw clip for the in-app preview even when transcoding fails.
		chimeDataUrl = await blobToDataUrl(blob);
		chimeDataUrl = await normalizeOwnChime(blob, browserWavDeps());
	} catch {
		// ONE error channel: conversion (or reading the file) did not work.
		// The alarm will play the bundled default; the preview stays audible.
		chimeFallbackHint = CHIME_CONVERT_FAILED;
	}
}

async function startRecording(): Promise<void> {
	preview.stop();
	chimeError = "";
	chimeFallbackHint = "";

	if (
		typeof navigator === "undefined" ||
		!navigator.mediaDevices?.getUserMedia ||
		typeof MediaRecorder === "undefined"
	) {
		chimeError = CHIME_RECORD_UNAVAILABLE;
		return;
	}

	isRecording = true;
	let stream: MediaStream;
	try {
		stream = await navigator.mediaDevices.getUserMedia({ audio: true });
	} catch {
		chimeError = CHIME_RECORD_DENIED;
		releaseRecorder();
		return;
	}

	activeStream = stream;
	const recorder = new MediaRecorder(stream) as unknown as RecorderLike;
	activeRecorder = recorder;

	try {
		const { blob } = await recordChime({
			makeRecorder: () => recorder,
			...(pendingStop ? { stopImmediately: true } : {}),
		});
		if (!isAcceptableRecording(blob)) {
			chimeError = CHIME_FILE_INVALID;
		} else {
			await applyOwnChime(blob);
			chimeSource = ChimeSource.Recorded;
			chimeName = CHIME_RECORD_NAME;
		}
	} catch {
		// Only the recording step itself can fail here (mic/MediaRecorder).
		chimeError = CHIME_RECORD_UNAVAILABLE;
	} finally {
		releaseRecorder();
	}
}

function toggleRecording(): void {
	if (isRecording) {
		if (activeRecorder) activeRecorder.stop();
		else pendingStop = true;
		return;
	}
	void startRecording();
}

async function handleChimeFile(event: Event): Promise<void> {
	const input = event.currentTarget as HTMLInputElement;
	const file = input.files?.[0];
	if (!file) return;
	preview.stop();
	if (!isAcceptableAudioFile(file)) {
		chimeError = CHIME_FILE_INVALID;
		return;
	}
	chimeSource = ChimeSource.Custom;
	chimeName = file.name;
	pendingChime = applyOwnChime(file);
	await pendingChime;
	pendingChime = null;
	input.value = "";
}

function previewChime(): void {
	void preview.toggle(resolveChimeUrl({ chimeSource, chimeDataUrl, extraChime }));
}

function handleKeydown(event: KeyboardEvent): void {
	if (event.key === "Escape") closeModal();
}

function toggleCalendar(): void {
	showCalendar = !showCalendar;
}

function goToPreviousMonth(): void {
	const [year, month] = shiftMonth(viewYear, viewMonth, -1);
	viewYear = year;
	viewMonth = month;
}

function goToNextMonth(): void {
	const [year, month] = shiftMonth(viewYear, viewMonth, 1);
	viewYear = year;
	viewMonth = month;
}

function goToToday(): void {
	const today = new Date();
	viewYear = today.getFullYear();
	viewMonth = today.getMonth() as Month;
}

function pickDate(iso: string): void {
	dateOverride = iso;
	showCalendar = false;
}
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center"
	role="presentation"
	onclick={(event) => {
		if (event.target === event.currentTarget) onClose();
	}}
>
	<div
		role="dialog"
		aria-modal="true"
		aria-label={isEdit ? EDIT_ENTRY_LABEL : ADD_ENTRY_LABEL}
		data-testid="add-entry-modal"
		class="w-full max-w-md rounded-t-3xl border border-slate-200 bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:pb-5 dark:border-slate-600 dark:bg-slate-800"
	>
		<div class="mb-4 flex items-start justify-between gap-3">
			<div>
				<h2 class="text-base font-semibold text-slate-800 dark:text-slate-100">
					{isEdit ? EDIT_ENTRY_LABEL : ADD_ENTRY_LABEL}
				</h2>
				<p class="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
					{isEdit ? EDIT_ENTRY_HINT : ADD_ENTRY_HINT}
				</p>
			</div>
			<button
				type="button"
				data-testid="add-entry-close"
				aria-label={CLOSE_LABEL}
				onclick={closeModal}
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
			>
				✕
			</button>
		</div>

		<form data-testid="add-entry-form" onsubmit={handleSubmit} class="space-y-3">
			<label class="block">
				<span class="mb-1 block text-xs text-slate-500 dark:text-slate-400">{ADD_ENTRY_TITLE_LABEL}</span>
				<input
					data-testid="add-entry-title"
					type="text"
					placeholder="z. B. Zahnarzt 15:30"
					bind:value={title}
					class="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
				/>
			</label>

			<div class="flex gap-3">
				<label class="block flex-1">
					<span class="mb-1 block text-xs text-slate-500 dark:text-slate-400">{ADD_ENTRY_DATE_LABEL}</span>
					<input
						data-testid="add-entry-date"
						type="date"
						value={date}
						oninput={(event) => (dateOverride = event.currentTarget.value)}
						class="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-sky-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
					/>
				</label>
				<label class="block flex-1">
					<span class="mb-1 block text-xs text-slate-500 dark:text-slate-400">{ADD_ENTRY_TIME_LABEL}</span>
					<input
						data-testid="add-entry-time"
						type="time"
						bind:value={time}
						class="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-sky-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
					/>
				</label>
			</div>

			<button
				type="button"
				data-testid="pick-date-toggle"
				aria-expanded={showCalendar}
				onclick={toggleCalendar}
				class="h-10 w-full rounded-lg border border-slate-200 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
			>
				{showCalendar ? HIDE_CALENDAR_LABEL : PICK_DATE_LABEL}
			</button>

			{#if showCalendar}
				<div data-testid="modal-calendar" class="rounded-xl border border-slate-200 p-2 dark:border-slate-600">
					<CalendarGrid
						{grid}
						{entries}
						selectedIso={date}
						onSelect={pickDate}
						onPrevious={goToPreviousMonth}
						onNext={goToNextMonth}
						onToday={goToToday}
					/>
				</div>
			{/if}

			<label class="block">
				<span class="mb-1 block text-xs text-slate-500 dark:text-slate-400">{ADD_ENTRY_NOTE_LABEL}</span>
				<input
					data-testid="add-entry-note"
					type="text"
					placeholder="Ort, Details..."
					bind:value={note}
					class="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
				/>
			</label>

			<fieldset>
				<legend class="mb-1 block text-xs text-slate-500 dark:text-slate-400">{CHIME_LABEL}</legend>
				<button
					type="button"
					data-testid="extra-chime-toggle"
					aria-label={EXTRA_CHIME_LABEL}
					aria-pressed={extraChime}
					onclick={() => (extraChime = !extraChime)}
					class="mb-2 flex h-10 w-full items-center justify-between rounded-lg border px-3 text-xs font-medium transition-colors {extraChime
						? 'border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
						: 'border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700'}"
				>
					<span>{EXTRA_CHIME_LABEL}</span>
					<span class="font-semibold">{extraChime ? EXTRA_CHIME_ON : EXTRA_CHIME_OFF}</span>
				</button>

				{#if extraChime}
					{#if chimeSource === ChimeSource.Default}
						<p data-testid="chime-empty-hint" class="mb-2 text-xs text-amber-600 dark:text-amber-400">
							{CHIME_NONE_HINT}
						</p>
					{/if}
					<div class="mb-2 flex flex-wrap gap-1">
						<button
							type="button"
							data-testid="chime-default"
							aria-pressed={chimeSource === ChimeSource.Default}
							onclick={selectDefaultChime}
							class="h-9 rounded-lg px-3 text-xs font-medium transition-colors {chimeSource === ChimeSource.Default
								? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
								: 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'}"
						>
							{CHIME_DEFAULT_LABEL}
						</button>
						<label
							data-testid="chime-custom"
							class="flex h-9 cursor-pointer items-center rounded-lg px-3 text-xs font-medium transition-colors {chimeSource === ChimeSource.Custom
								? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
								: 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'}"
						>
							{CHIME_CUSTOM_LABEL}
							<input
								data-testid="chime-file"
								type="file"
								accept={AUDIO_FILE_ACCEPT}
								onchange={handleChimeFile}
								class="sr-only"
							/>
						</label>
						<button
							type="button"
							data-testid="chime-record"
							aria-label={CHIME_RECORD_LABEL}
							aria-pressed={isRecording || chimeSource === ChimeSource.Recorded}
							onclick={toggleRecording}
							class="h-9 rounded-lg px-3 text-xs font-medium transition-colors {isRecording
								? 'bg-rose-600 text-white'
								: chimeSource === ChimeSource.Recorded
									? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
									: 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'}"
						>
							{isRecording ? CHIME_RECORD_STOP : CHIME_RECORD_START}
						</button>
						<button
							type="button"
							data-testid="chime-preview"
							aria-pressed={preview.isPlaying()}
							onclick={previewChime}
							class="h-9 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
						>
							{CHIME_PREVIEW_LABEL}
						</button>
					</div>
				{/if}

				<p data-testid="chime-name" class="mb-1 truncate text-xs text-slate-500 dark:text-slate-400">
					♪ {extraChime ? chimeName : "Standard (Saraba)"}
				</p>
				{#if chimeError}
					<p role="alert" data-testid="chime-error" class="text-xs font-medium text-rose-600">{chimeError}</p>
				{/if}
				{#if chimeFallbackHint}
					<p data-testid="chime-fallback-hint" class="text-xs text-sky-600 dark:text-sky-400">
						♪ {chimeFallbackHint}
					</p>
				{/if}
			</fieldset>

			<fieldset>
				<legend class="mb-1 block text-xs text-slate-500 dark:text-slate-400">{ADD_ENTRY_CATEGORY_LABEL}</legend>
				<div class="flex flex-wrap gap-1">
					{#each ENTRY_CATEGORIES as cat (cat)}
						<button
							type="button"
							aria-pressed={category === cat}
							onclick={() => (category = cat)}
							class="h-9 rounded-lg px-3 text-xs font-medium transition-colors {category === cat
								? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
								: 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'}"
						>
							{ENTRY_CATEGORY_LABEL[cat]}
						</button>
					{/each}
				</div>
			</fieldset>

			{#if error !== null}
				<p role="alert" data-testid="add-entry-error" class="text-xs font-medium text-rose-600">
					{VALIDATION_MESSAGE[error]}
				</p>
			{/if}

			<div class="flex gap-2 pt-1">
				<button
					type="submit"
					data-testid="add-entry-submit"
					class="h-11 flex-1 rounded-lg bg-sky-600 text-sm font-semibold text-white transition-colors hover:bg-sky-500"
				>
					{isEdit ? SAVE_ENTRY_SUBMIT : ADD_ENTRY_SUBMIT}
				</button>
				<button
					type="button"
					onclick={closeModal}
					class="h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
				>
					{CLOSE_LABEL}
				</button>
			</div>
		</form>
	</div>
</div>
