import { DEFAULT_CHIME_URL, MAX_CUSTOM_CHIME_BYTES } from "./constants";
import { ChimeSource } from "./enums";
import type { CalendarEntry } from "./types";
import { parseYouTubeUrl, youtubeEmbedUrl } from "./youtube";

export interface AudioFileLike {
	name: string;
	type: string;
	size: number;
}

export function isAcceptableAudioFile(file: AudioFileLike): boolean {
	const isMp3 = /\.mp3$/i.test(file.name) || file.type === "audio/mpeg";
	return isMp3 && file.size > 0 && file.size <= MAX_CUSTOM_CHIME_BYTES;
}

export type ChimeFields = Pick<CalendarEntry, "chimeSource" | "chimeDataUrl">;

export function resolveChimeUrl(entry: ChimeFields): string {
	if (entry.chimeSource === ChimeSource.YouTube) {
		const id = parseYouTubeUrl(entry.chimeDataUrl);
		return id !== null ? (youtubeEmbedUrl(id) ?? DEFAULT_CHIME_URL) : DEFAULT_CHIME_URL;
	}
	return entry.chimeSource === ChimeSource.Custom && entry.chimeDataUrl.length > 0
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
