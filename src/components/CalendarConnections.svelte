<script lang="ts">
import { CalendarProvider } from "../lib/enums";
import type { InternalSnapshot } from "../lib/internal-sync";
import {
	PENDING_CONNECTION_HINT,
	SIGN_IN_APPLE_LABEL,
	SIGN_IN_CUSTOM_LABEL,
	SIGN_IN_GOOGLE_LABEL,
} from "../lib/labels";

interface Props {
	snapshot: InternalSnapshot;
	pendingConnections: readonly CalendarProvider[];
	onSignIn: (provider: CalendarProvider) => void;
	onImportFile: () => void;
}

let { snapshot, pendingConnections, onSignIn, onImportFile }: Props = $props();
</script>

<section aria-label="Kalender-Anmeldung" class="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-800/60">
	<h2 class="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Kalender anmelden</h2>
	<p class="mb-3 text-xs text-slate-400 dark:text-slate-500">
		{snapshot.count} Eintrag{snapshot.count === 1 ? "" : "e"} beim Start automatisch intern geladen.
	</p>

	<div class="flex flex-wrap gap-2">
		<button
			type="button"
			data-testid="signin-google"
			onclick={() => onSignIn(CalendarProvider.Google)}
			class="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
		>
			{SIGN_IN_GOOGLE_LABEL}
		</button>
		<button
			type="button"
			data-testid="signin-apple"
			onclick={() => onSignIn(CalendarProvider.Apple)}
			class="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
		>
			{SIGN_IN_APPLE_LABEL}
		</button>
		<button
			type="button"
			data-testid="signin-custom"
			onclick={() => onSignIn(CalendarProvider.Custom)}
			class="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
		>
			{SIGN_IN_CUSTOM_LABEL}
		</button>
		<button
			type="button"
			data-testid="signin-import"
			onclick={onImportFile}
			class="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
		>
			.ics importieren
		</button>
	</div>

	{#if pendingConnections.length > 0}
		<p data-testid="pending-connections" class="mt-3 text-xs text-amber-600 dark:text-amber-400">
			{PENDING_CONNECTION_HINT}
		</p>
	{/if}
</section>
