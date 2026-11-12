import { MAX_CUSTOM_CHIME_BYTES } from "./constants";

export interface BlobLike {
	size: number;
	type: string;
}

export interface RecorderLike {
	state: RecordingState;
	start(): void;
	stop(): void;
	ondataavailable: ((event: { data: BlobPart }) => void) | null;
	onstop: (() => void) | null;
}

export interface RecordedChime {
	dataUrl: string;
	mimeType: string;
}

export interface RecordDeps {
	makeRecorder: () => RecorderLike | undefined;
	toDataUrl: (blob: Blob) => Promise<string>;
	/** Stop as soon as the handlers are attached (user clicked stop during permission prompt). */
	stopImmediately?: boolean;
	onChunk?: (chunk: BlobPart) => void;
}

export function isAcceptableRecording(blob: BlobLike): boolean {
	return /^audio\//.test(blob.type) && blob.size > 0 && blob.size <= MAX_CUSTOM_CHIME_BYTES;
}

/** FileReader-backed Blob → data URL, injectable for tests. */
export function blobToDataUrl(
	blob: Blob,
	drive: (reader: FileReader) => void = (reader) => reader.readAsDataURL(blob),
): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result ?? ""));
		reader.onerror = () => reject(reader.error);
		drive(reader);
	});
}

/** Record one clip; resolves when stop() fires. No timers involved. */
export function recordChime(deps: RecordDeps): Promise<RecordedChime> {
	return new Promise((resolve, reject) => {
		const recorder = deps.makeRecorder();
		if (!recorder) {
			reject(new Error("recording-unavailable"));
			return;
		}

		const chunks: BlobPart[] = [];
		recorder.ondataavailable = (event) => {
			chunks.push(event.data);
			deps.onChunk?.(event.data);
		};
		recorder.onstop = () => {
			const blob = new Blob(chunks, {
				type:
					chunks.find((c): c is Blob => typeof c !== "string" && "type" in c && c.type.length > 0)
						?.type ?? "audio/webm",
			});
			if (!isAcceptableRecording(blob)) {
				reject(new Error("recording-invalid"));
				return;
			}
			void deps
				.toDataUrl(blob)
				.then((dataUrl) => resolve({ dataUrl, mimeType: blob.type }))
				.catch(reject);
		};
		recorder.start();
		if (deps.stopImmediately) recorder.stop();
	});
}
