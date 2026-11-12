<script lang="ts">
import { entriesForDate } from "../lib/calendar";
import { EntryCategory } from "../lib/enums";
import { ENTRY_CATEGORY_DOT } from "../lib/labels";
import type { CalendarCell, CalendarEntry, MonthGrid } from "../lib/types";

interface Props {
	grid: MonthGrid;
	entries: readonly CalendarEntry[];
	selectedIso: string;
	onSelect: (iso: string) => void;
	onPrevious: () => void;
	onNext: () => void;
	onToday: () => void;
}

let { grid, entries, selectedIso, onSelect, onPrevious, onNext, onToday }: Props = $props();

function countFor(cell: CalendarCell): number {
	return entriesForDate(entries, cell.iso).length;
}
</script>

<section aria-label="Monatskalender" class="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-800/60">
	<header class="mb-4 flex items-center justify-between gap-2">
		<button type="button" aria-label="Vorheriger Monat" onclick={onPrevious} class="rounded-lg px-3 py-1.5 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700">
			&#8249;
		</button>
		<h2 data-testid="month-label" class="text-lg font-semibold text-slate-900 dark:text-slate-100">{grid.label}</h2>
		<button type="button" aria-label="Naechster Monat" onclick={onNext} class="rounded-lg px-3 py-1.5 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700">
			&#8250;
		</button>
		<button type="button" onclick={onToday} class="ml-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">
			Heute
		</button>
	</header>

	<div class="grid grid-cols-7 gap-1">
		{#each grid.weekdayLabels as label (label)}
			<div class="pb-1 text-center text-xs font-semibold tracking-wide text-slate-400 uppercase dark:text-slate-500">{label}</div>
		{/each}

		{#each grid.cells as cell (cell.iso)}
			{@const count = countFor(cell)}
			<button
				type="button"
				data-testid="day-{cell.iso}"
				aria-label={cell.iso}
				aria-pressed={selectedIso === cell.iso}
				onclick={() => onSelect(cell.iso)}
				class="relative flex h-11 flex-col items-center justify-center rounded-lg text-sm transition-colors
					{cell.inMonth ? 'text-slate-800 dark:text-slate-100' : 'text-slate-300 dark:text-slate-600'}
					{cell.isWeekend && cell.inMonth ? 'text-slate-400 dark:text-slate-500' : ''}
					{cell.isToday ? 'font-bold ring-2 ring-sky-500' : ''}
					{selectedIso === cell.iso ? 'bg-sky-500 text-white dark:text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}"
			>
				<span>{cell.date.getDate()}</span>
				{#if count > 0}
					<span class="mt-0.5 flex gap-0.5" aria-label="{count} Eintraege">
						{#each Array(Math.min(count, 3)) as _, i (i)}
							<span class="h-1 w-1 rounded-full {selectedIso === cell.iso ? 'bg-white' : ENTRY_CATEGORY_DOT[entriesForDate(entries, cell.iso)[i]?.category ?? EntryCategory.Event]}"></span>
						{/each}
					</span>
				{/if}
			</button>
		{/each}
	</div>
</section>
