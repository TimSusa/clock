import { ChimeSource } from "./enums";
import { soundFileNameFor } from "./notification-plan";
import type { CalendarEntry } from "./types";
import { isPlayableWavDataUrl } from "./wav";

/** Directory.Library value as a plain string, so this module stays web-safe. */
export const SOUND_DIRECTORY = "LIBRARY";
const SOUNDS_FOLDER = "Sounds";

export interface SoundWritePlan {
	path: string;
	directory: string;
	data: string;
}

/** Strip `data:<mime>;base64,` — Capacitor Filesystem wants the bare payload. */
export function base64FromDataUrl(dataUrl: string): string | null {
	const match = /^data:[^;]+;base64,(.+)$/.exec(dataUrl);
	return match?.[1] ?? null;
}

/**
 * Pure plan for writing an entry's own chime into Library/Sounds. iOS looks
 * there first for UNNotificationSound names. Null = nothing to write.
 */
export function soundWritePlan(entry: CalendarEntry): SoundWritePlan | null {
	const own =
		entry.extraChime &&
		(entry.chimeSource === ChimeSource.Recorded || entry.chimeSource === ChimeSource.Custom);
	if (!own || !isPlayableWavDataUrl(entry.chimeDataUrl)) return null;
	const data = base64FromDataUrl(entry.chimeDataUrl);
	if (data === null) return null;
	return {
		path: `${SOUNDS_FOLDER}/${soundFileNameFor(entry.id)}`,
		directory: SOUND_DIRECTORY,
		data,
	};
}

/** Minimal Filesystem shape, injected so tests never need a native bridge. */
export interface SoundFileSystem {
	mkdir(options: { path: string; directory: string; recursive: boolean }): Promise<void>;
	writeFile(options: { path: string; directory: string; data: string }): Promise<unknown>;
	deleteFile(options: { path: string; directory: string }): Promise<void>;
}

/** Write (or refresh) every own chime before notifications are scheduled. */
export async function writeSoundFiles(
	fs: SoundFileSystem,
	entries: readonly CalendarEntry[],
): Promise<void> {
	const plans = entries.map(soundWritePlan).filter((p): p is SoundWritePlan => p !== null);
	if (plans.length === 0) return;
	await fs.mkdir({ path: SOUNDS_FOLDER, directory: SOUND_DIRECTORY, recursive: true });
	for (const plan of plans) {
		await fs.writeFile(plan);
	}
}

/**
 * Write own chimes and REPORT failures. Previously App.svelte swallowed every
 * error in a bare catch block, so on iOS a failing Library/Sounds write
 * silently left notifications pointing at a file that never existed.
 */
export async function armSoundFiles(
	entries: readonly CalendarEntry[],
	fs: SoundFileSystem,
	onError: (error: unknown) => void,
): Promise<void> {
	try {
		await writeSoundFiles(fs, entries);
	} catch (error) {
		onError(error);
	}
}

/** Remove the sound file belonging to a deleted entry. */
export async function removeSoundFile(fs: SoundFileSystem, entryId: string): Promise<void> {
	await fs.deleteFile({
		path: `${SOUNDS_FOLDER}/${soundFileNameFor(entryId)}`,
		directory: SOUND_DIRECTORY,
	});
}
