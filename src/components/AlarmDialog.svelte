<script lang="ts">
import { SNOOZE_MINUTES } from "../lib/alarm-actions";
import { ALARM_CANCEL_LABEL, ALARM_SNOOZE_LABEL } from "../lib/labels";
import { type AlarmPlayer, createAlarmPlayer, resolveChimeUrl } from "../lib/sound";
import type { CalendarEntry } from "../lib/types";

interface Props {
	entry: CalendarEntry;
	onCancel: () => void;
	onSnooze: () => void;
	player?: AlarmPlayer;
}

let { entry, onCancel, onSnooze, player = createAlarmPlayer() }: Props = $props();

// The dialog owns playback. The effect cleanup silences the chime on EVERY exit
// path (Cancel, Snooze, unmount) - otherwise it keeps ringing after the window
// closes, which was the reported bug. Only an enabled extra chime is played.
$effect(() => {
	if (!entry.extraChime) return;
	void player.play(resolveChimeUrl(entry)).catch(() => {
		/* blocked autoplay must not break the alarm window */
	});
	return () => player.stop();
});

function cancel(): void {
	player.stop();
	onCancel();
}

function snooze(): void {
	player.stop();
	onSnooze();
}
</script>

<div
	class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 p-5 backdrop-blur-sm"
	role="presentation"
>
	<div
		role="alertdialog"
		aria-modal="true"
		aria-label="Wecker"
		data-testid="alarm-dialog"
		class="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-2xl dark:border-slate-600 dark:bg-slate-800"
	>
		<p class="text-4xl">⏰</p>
		<h2 class="mt-3 text-xl font-semibold text-slate-800 dark:text-slate-100">{entry.title}</h2>
		<p class="mt-1 font-mono text-3xl font-semibold tabular-nums text-sky-600 dark:text-sky-400">
			{entry.time}
		</p>
		<p class="mt-2 text-xs text-slate-500 dark:text-slate-400">♪ {entry.chimeName}</p>
		{#if entry.note}
			<p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{entry.note}</p>
		{/if}

		<div class="mt-6 flex gap-2">
			<button
				type="button"
				data-testid="alarm-cancel"
				onclick={cancel}
				class="h-12 flex-1 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
			>
				{ALARM_CANCEL_LABEL}
			</button>
			<button
				type="button"
				data-testid="alarm-snooze"
				onclick={snooze}
				class="h-12 flex-1 rounded-xl bg-sky-600 text-sm font-semibold text-white hover:bg-sky-500"
			>
				{ALARM_SNOOZE_LABEL} {SNOOZE_MINUTES} Min
			</button>
		</div>
	</div>
</div>
