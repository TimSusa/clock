<script lang="ts">
import { missingFields, resolveConnectionState } from "../lib/connection";
import { CalendarProvider, ConnectionState } from "../lib/enums";
import {
	CLOSE_LABEL,
	CONNECTION_MODAL_TITLE,
	CONNECTION_STATE_LABEL,
	RETRY_LABEL,
} from "../lib/labels";
import { pushEvents } from "../lib/providers";
import type { CalendarEntry } from "../lib/types";

interface Props {
	provider: CalendarProvider;
	clientId: string;
	entries: readonly CalendarEntry[];
	onClose: () => void;
}

let { provider, clientId, entries, onClose }: Props = $props();

let accessToken = $state("");
let connectionState: ConnectionState = $state(ConnectionState.Checking);
let sentCount = $state(0);

const missing = $derived(missingFields({ clientId, accessToken }, provider));

// Auto-check on open and whenever the token changes: connect immediately if ready.
$effect(() => {
	const next = resolveConnectionState({ clientId, accessToken });
	connectionState = next;
	if (next === ConnectionState.Ready) {
		void connect();
	}
});

async function connect(): Promise<void> {
	const result = await pushEvents(provider, entries, accessToken, clientId);
	if (result.ok) {
		sentCount = result.count;
		connectionState = ConnectionState.Connected;
	} else {
		connectionState = ConnectionState.Failed;
	}
}

function handleTokenInput(event: Event): void {
	accessToken = (event.currentTarget as HTMLInputElement).value;
}

function handleKeydown(event: KeyboardEvent): void {
	if (event.key === "Escape") onClose();
}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" role="presentation">
	<div
		role="dialog"
		aria-modal="true"
		aria-label={CONNECTION_MODAL_TITLE[provider]}
		data-testid="connection-modal"
		class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-600 dark:bg-slate-800"
	>
		<div class="mb-4 flex items-start justify-between gap-3">
			<div>
				<h2 class="text-base font-semibold text-slate-800 dark:text-slate-100">{CONNECTION_MODAL_TITLE[provider]}</h2>
				<p class="mt-0.5 text-xs text-slate-400 dark:text-slate-500">Automatische Verbindung prueft die vorhandenen Zugangsdaten.</p>
			</div>
			<button type="button" data-testid="modal-close" aria-label={CLOSE_LABEL} onclick={onClose} class="rounded-lg px-2 py-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200">✕</button>
		</div>

		<div data-testid="connection-state" class="mb-4 rounded-xl bg-slate-50 px-3 py-2.5 text-sm dark:bg-slate-700/50 {connectionState === ConnectionState.Connected ? 'text-emerald-700 dark:text-emerald-300' : connectionState === ConnectionState.Failed || connectionState === ConnectionState.MissingClientId || connectionState === ConnectionState.MissingToken ? 'text-amber-700 dark:text-amber-300' : 'text-slate-600 dark:text-slate-300'}">
			{CONNECTION_STATE_LABEL[connectionState]}
			{#if connectionState === ConnectionState.Connected}
				<span class="block text-xs opacity-80">{sentCount} Termin{sentCount === 1 ? "" : "e"} uebertragen.</span>
			{/if}
		</div>

		{#if missing.length > 0}
			<div class="mb-4">
				<p class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Es fehlt</p>
				<ul data-testid="missing-fields" class="space-y-1">
					{#each missing as field (field)}
						<li class="rounded-lg bg-amber-50 px-2.5 py-1.5 font-mono text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">{field}</li>
					{/each}
				</ul>
				<p class="mt-2 text-xs text-slate-400 dark:text-slate-500">.env.sample → .env.local kopieren und Client-ID eintragen. Token nur fuer diese Sitzung.</p>
			</div>
		{/if}

		<label class="mb-4 block">
			<span class="mb-1 block text-xs text-slate-500 dark:text-slate-400">OAuth Access Token</span>
			<input
				data-testid="modal-token"
				type="password"
				placeholder="Token einfuegen - Verbindung startet automatisch"
				value={accessToken}
				oninput={handleTokenInput}
				class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
			/>
		</label>

		<div class="flex justify-end gap-2">
			{#if connectionState === ConnectionState.Failed}
				<button type="button" data-testid="modal-retry" onclick={connect} class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">{RETRY_LABEL}</button>
			{/if}
			<button type="button" onclick={onClose} class="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900">{CLOSE_LABEL}</button>
		</div>
	</div>
</div>
