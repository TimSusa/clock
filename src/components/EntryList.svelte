<script lang="ts">
import { untrack } from "svelte";
import { EntryCategory, HolidayMode, ListPeriod, PastMode } from "../lib/enums";
import {
	ALARM_STATUS_DOT,
	ALARM_STATUS_LABEL,
	EMPTY_ALARM_MESSAGE,
	ENTRY_CATEGORY_DOT,
	ENTRY_CATEGORY_LABEL,
	HOLIDAY_MODE_LABEL,
	LIST_PERIOD_FILTER_LABEL,
	LIST_PERIOD_LABEL,
	PAST_MODE_LABEL,
} from "../lib/labels";
import { filterByPeriod, holidayLabelFor } from "../lib/list-filter";
import { loadListView, saveListView } from "../lib/list-view";
import { nextEvent, previousAnchor, progressToNext } from "../lib/next-event";
import type { CalendarEntry } from "../lib/types";
import { buildAlarmRows } from "../lib/wecker";
import CalendarSync from "./CalendarSync.svelte";

interface Props {
	now: Date;
	entries: readonly CalendarEntry[];
	onAdd: () => void;
	onEdit: (entry: CalendarEntry) => void;
	onRemove: (id: string) => void;
	onImport: (entries: readonly CalendarEntry[]) => void;
}

let { now, entries, onAdd, onEdit, onRemove, onImport }: Props = $props();

// Filter selections are user preferences: load them on mount and persist every
// change, so the next app start shows the exact same view.
const savedView = loadListView();
let period = $state<ListPeriod>(savedView.period);
let holidayMode = $state<HolidayMode>(savedView.holidays);
let pastMode = $state<PastMode>(savedView.past);

$effect(() => {
	saveListView({ period, holidays: holidayMode, past: pastMode });
});

const PERIODS: readonly ListPeriod[] = [
	ListPeriod.Day,
	ListPeriod.Week,
	ListPeriod.Month,
	ListPeriod.All,
];
const HOLIDAY_MODES: readonly HolidayMode[] = [HolidayMode.With, HolidayMode.Without];
const PAST_MODES: readonly PastMode[] = [PastMode.Hide, PastMode.Show];

const visible = $derived(filterByPeriod(entries, period, holidayMode, now, pastMode));
const rows = $derived(buildAlarmRows(visible, now));

// Anchored once on mount so the bar grows steadily from 0 to 100 % instead of
// re-anchoring on every tick. `now` comes from App's existing 1-s ticker.
// The ticker follows the SAME selection as the list: a hidden holiday must
// never remain the "next event". Anchor is read once so the bar grows steadily.
const anchor = untrack(() => previousAnchor(visible, new Date()));
const upcoming = $derived(nextEvent(visible, now));
const progress = $derived(upcoming ? progressToNext(upcoming, now, anchor) : null);

function handleRemove(id: string): void {
	onRemove(id);
}
</script>

<section aria-label="Alle Eintraege" class="space-y-6">
	{#if upcoming && progress !== null}
		<div data-testid="next-event-progress" class="rounded-2xl border border-slate-200 bg-white/70 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
			<div class="mb-2 flex items-center justify-between gap-2 text-xs">
				<span class="truncate text-slate-600 dark:text-slate-300">⏭ {upcoming.title} · {upcoming.time}</span>
				<span class="font-mono font-semibold tabular-nums text-sky-600 dark:text-sky-400">{progress} %</span>
			</div>
			<div
				data-testid="next-event-bar"
				role="progressbar"
				aria-label="Zeit bis zum naechsten Termin"
				aria-valuemin="0"
				aria-valuemax="100"
				aria-valuenow={progress}
				class="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
			>
				<div
					class="h-full rounded-full bg-sky-500 transition-[width] duration-1000 ease-linear"
					style="width: {progress}%"
				></div>
			</div>
		</div>
	{/if}

	<div class="flex flex-wrap items-center gap-3" data-testid="list-filter">
		<div class="flex items-center gap-1">
			<span class="text-xs text-slate-500 dark:text-slate-400">{LIST_PERIOD_FILTER_LABEL}</span>
			{#each PERIODS as option (option)}
				<button
					type="button"
					data-testid="period-{option}"
					aria-pressed={period === option}
					onclick={() => (period = option)}
					class="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors {period === option
						? 'bg-sky-600 text-white'
						: 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'}"
				>
					{LIST_PERIOD_LABEL[option]}
				</button>
			{/each}
		</div>
		<div class="flex items-center gap-1">
			{#each HOLIDAY_MODES as option (option)}
				<button
					type="button"
					data-testid="holidays-{option}"
					aria-pressed={holidayMode === option}
					onclick={() => (holidayMode = option)}
					class="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors {holidayMode === option
						? 'bg-sky-600 text-white'
						: 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'}"
				>
					{HOLIDAY_MODE_LABEL[option]}
				</button>
			{/each}
		</div>
		<div class="flex items-center gap-1">
			{#each PAST_MODES as option (option)}
				<button
					type="button"
					data-testid="past-{option}"
					aria-pressed={pastMode === option}
					onclick={() => (pastMode = option)}
					class="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors {pastMode === option
						? 'bg-sky-600 text-white'
						: 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'}"
				>
					{PAST_MODE_LABEL[option]}
				</button>
			{/each}
		</div>
	</div>

	<div class="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-800/60">
		<div class="mb-4 flex items-center justify-between gap-2">
			<div class="flex items-center gap-2">
				<h2 class="text-sm font-semibold text-slate-700 dark:text-slate-200">Alle Eintraege</h2>
				<span
					data-testid="entry-count"
					class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-300"
				>
					{rows.length}
				</span>
			</div>
			<button
				type="button"
				data-testid="add-entry-toggle"
				aria-label="Neuen Eintrag anlegen"
				onclick={onAdd}
				class="flex h-9 w-9 items-center justify-center rounded-full bg-sky-600 text-xl leading-none text-white transition-colors hover:bg-sky-500 active:bg-sky-700"
			>
				+
			</button>
		</div>

		{#if rows.length === 0}
			<p data-testid="entry-empty" class="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
				{EMPTY_ALARM_MESSAGE}
			</p>
		{:else}
			<ul data-testid="entry-list" class="space-y-2">
				{#each rows as row (row.entry.id)}
					<li
						data-testid="entry-row-{row.entry.id}"
						class="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3 transition-colors hover:bg-slate-100 dark:bg-slate-700/50 dark:hover:bg-slate-700"
					>
						<button
							type="button"
							data-testid="entry-edit-{row.entry.id}"
							aria-label="Eintrag {row.entry.title} bearbeiten"
							onclick={() => onEdit(row.entry)}
							class="flex min-w-0 flex-1 items-center gap-3 text-left"
						>
							<span class="h-2 w-2 shrink-0 rounded-full {ALARM_STATUS_DOT[row.status]}"></span>
							<span
								data-testid="entry-time"
								class="w-14 shrink-0 font-mono text-lg font-semibold tabular-nums text-slate-800 dark:text-slate-100"
							>
								{row.time}
							</span>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{row.entry.title}</p>
								<p class="truncate text-xs text-slate-400 dark:text-slate-500">
									{row.label} · {ENTRY_CATEGORY_LABEL[row.entry.category]}
								</p>
								<p data-testid="entry-chime" class="truncate text-xs text-sky-600 dark:text-sky-400">
									♪ {row.entry.extraChime ? row.entry.chimeName : "Standard (Saraba)"}
								</p>
								{#if holidayLabelFor(row.entry)}
									<p data-testid="entry-holiday" class="truncate text-xs text-amber-600 dark:text-amber-400">
										★ {holidayLabelFor(row.entry)}
									</p>
								{/if}
								{#if row.entry.note}
									<p class="truncate text-xs text-slate-500 dark:text-slate-400">{row.entry.note}</p>
								{/if}
							</div>
							<span
								class="hidden shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 sm:inline dark:bg-slate-600 dark:text-slate-300"
							>
								{ALARM_STATUS_LABEL[row.status]}
							</span>
							<span
								class="h-2 w-2 shrink-0 rounded-full {ENTRY_CATEGORY_DOT[row.entry.category] ?? ENTRY_CATEGORY_DOT[EntryCategory.Event]}"
							></span>
						</button>
						<button
							type="button"
							aria-label="Eintrag {row.entry.title} loeschen"
							data-testid="entry-delete-{row.entry.id}"
							onclick={() => handleRemove(row.entry.id)}
							class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/40"
						>
							✕
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<CalendarSync {entries} onImport={onImport} />
</section>
