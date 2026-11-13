import { AUDIO_FILE_EXTENSIONS, DEFAULT_CHIME_URL, MAX_CUSTOM_CHIME_BYTES } from "./constants";
import { ChimeSource } from "./enums";
import type { CalendarEntry } from "./types";

export interface AudioFileLike {
	name: string;
	type: string;
	size: number;
}

/** Any decodable audio file within the size limit; WAV transcoding does the rest. */
export function isAcceptableAudioFile(file: AudioFileLike): boolean {
	const byName = AUDIO_FILE_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(`.${ext}`));
	const byMime = file.type.startsWith("audio/");
	return (byName || byMime) && file.size > 0 && file.size <= MAX_CUSTOM_CHIME_BYTES;
}

export type ChimeFields = Pick<CalendarEntry, "chimeSource" | "chimeDataUrl" | "extraChime">;

/**
 * Single source of truth for the FOREGROUND chime. When the per-entry extra
 * chime is off, the bundled default plays - even if own audio is still stored
 * (the toggle is a gate, not a reset, so switching back restores the clip).
 */
export function resolveChimeUrl(entry: ChimeFields): string {
	if (!entry.extraChime) return DEFAULT_CHIME_URL;
	return (entry.chimeSource === ChimeSource.Custom || entry.chimeSource === ChimeSource.Recorded) &&
		entry.chimeDataUrl.length > 0
		? entry.chimeDataUrl
		: DEFAULT_CHIME_URL;
}

/** Injectable player: the browser side uses HTMLAudioElement, tests pass a spy. */
export type ChimePlayer = (url: string) => Promise<void>;

export async function playChime(entry: ChimeFields, play: ChimePlayer): Promise<void> {
	await play(resolveChimeUrl(entry));
}

export function browserPlayer(url: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const audio = new Audio(url);
		audio.onended = () => resolve();
		audio.onerror = () => reject(new Error("audio-playback-failed"));
		void audio.play().catch(reject);
	});
}

export interface AlarmPlayer {
	play(url: string): Promise<void>;
	stop(): void;
	isPlaying(): boolean;
}

/**
 * Stoppable alarm player. Unlike browserPlayer() it keeps the Audio instance,
 * so Cancel/Snooze/unmount can actually silence a running chime. stop() also
 * resolves the pending play promise - otherwise the alarm loop would hang.
 */
export function createAlarmPlayer(
	makeAudio: () => {
		src: string;
		pause(): void;
		play(): Promise<void>;
		onended: (() => void) | null;
		onerror: (() => void) | null;
	} = () => new Audio() as never,
): AlarmPlayer {
	let audio: ReturnType<typeof makeAudio> | null = null;
	let resolvePending: (() => void) | null = null;

	/** Drop the audio state WITHOUT resolving - used on playback errors. */
	function clear(): void {
		resolvePending = null;
		audio = null;
	}

	/** Normal end or explicit stop: resolve the pending play, then clear. */
	function finish(): void {
		resolvePending?.();
		clear();
	}

	function stop(): void {
		if (!audio) return;
		audio.onended = null;
		audio.onerror = null;
		audio.pause();
		finish();
	}

	return {
		play(url: string): Promise<void> {
			stop();
			const current = makeAudio();
			audio = current;
			current.src = url;
			return new Promise<void>((resolve, reject) => {
				resolvePending = resolve;
				const fail = (): void => {
					if (audio !== current) return;
					current.onended = null;
					current.onerror = null;
					clear();
					reject(new Error("audio-playback-failed"));
				};
				current.onended = () => {
					if (audio === current) finish();
				};
				current.onerror = fail;
				void current.play().catch(fail);
			});
		},
		stop,
		isPlaying(): boolean {
			return audio !== null;
		},
	};
}

export interface PreviewAudio {
	src: string;
	pause(): void;
	play(): Promise<void>;
}

export interface PreviewController {
	toggle(url: string): Promise<void>;
	stop(): void;
	isPlaying(): boolean;
	currentUrl(): string | null;
}

/**
 * One audio instance for the preview. Toggling the same url stops it; a different
 * url switches. Injectable factory makes this testable without a real Audio element.
 */
export function createPreviewController(
	makeAudio: () => PreviewAudio = () => new Audio() as unknown as PreviewAudio,
): PreviewController {
	let audio: PreviewAudio | null = null;
	let activeUrl: string | null = null;

	return {
		async toggle(url: string): Promise<void> {
			if (activeUrl === url) {
				this.stop();
				return;
			}
			if (audio === null) audio = makeAudio();
			audio.src = url;
			activeUrl = url;
			await audio.play();
		},
		stop(): void {
			audio?.pause();
			audio = null;
			activeUrl = null;
		},
		isPlaying(): boolean {
			return audio !== null;
		},
		currentUrl(): string | null {
			return activeUrl;
		},
	};
}
