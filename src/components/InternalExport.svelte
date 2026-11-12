<script lang="ts">
import type { InternalSnapshot } from "../lib/internal-sync";
import {
	COPIED_LABEL,
	COPY_LABEL,
	INTERNAL_EXPORT_HINT,
	INTERNAL_EXPORT_LABEL,
} from "../lib/labels";

interface Props {
	snapshot: InternalSnapshot;
}

let { snapshot }: Props = $props();
let copied = $state(false);

async function copy(): Promise<void> {
	try {
		await navigator.clipboard.writeText(snapshot.ics);
		copied = true;
	} catch {
		copied = false;
	}
}
</script>

<section aria-label={INTERNAL_EXPORT_LABEL} class="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-800/60">
	<div class="mb-2 flex items-center justify-between gap-2">
		<h2 class="text-sm font-semibold text-slate-700 dark:text-slate-200">{INTERNAL_EXPORT_LABEL}</h2>
		<span data-testid="internal-export-count" class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-300">
			{snapshot.count}
		</span>
	</div>
	<p class="mb-2 text-xs text-slate-400 dark:text-slate-500">{INTERNAL_EXPORT_HINT}</p>

	{#if snapshot.count > 0}
		<pre data-testid="internal-export-summary" class="mb-3 max-h-32 overflow-auto rounded-lg bg-slate-50 p-2 text-xs whitespace-pre-wrap text-slate-600 dark:bg-slate-700/50 dark:text-slate-300">{snapshot.summary}</pre>
		<button type="button" data-testid="internal-export-copy" onclick={copy} class="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">
			{copied ? COPIED_LABEL : COPY_LABEL}
		</button>
	{:else}
		<p data-testid="internal-export-empty" class="py-3 text-center text-xs text-slate-400 dark:text-slate-500">Noch keine Eintraege.</p>
	{/if}
</section>
