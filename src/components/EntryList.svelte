<script lang="ts">
import { EntryCategory } from "../lib/enums";
import {
	ALARM_STATUS_DOT,
	ALARM_STATUS_LABEL,
	EMPTY_ALARM_MESSAGE,
	ENTRY_CATEGORY_DOT,
	ENTRY_CATEGORY_LABEL,
} from "../lib/labels";
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

const rows = $derived(buildAlarmRows(entries, now));

function handleImport(imported: readonly CalendarEntry[]): void {
	const existingIds = new Set(entries.map((entry) => entry.id));
	onImport(imported.filter((entry) => !existingIds.has(entry.id)));
}

function handleRemove(id: string): void {
	onRemove(id);
}
</script>

<section aria-label="Alle Eintraege" class="space-y-6">
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
									♪ {row.entry.chimeName}
								</p>
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

	<CalendarSync {entries} onImport={handleImport} />
</section>
