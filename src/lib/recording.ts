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
	/** The raw MediaRecorder blob. Transcoding consumes THIS, never a data URL. */
	blob: Blob;
	mimeType: string;
}

export interface RecordDeps {
	makeRecorder: () => RecorderLike | undefined;
	/** Stop as soon as the handlers are attached (user clicked stop during permission prompt). */
	stopImmediately?: boolean;
	onChunk?: (chunk: BlobPart) => void;
}

export function isAcceptableRecording(blob: BlobLike): boolean {
	return /^audio\//.test(blob.type) && blob.size > 0 && blob.size <= MAX_CUSTOM_CHIME_BYTES;
}

/**
 * Record one clip; resolves with the raw Blob when stop() fires. The blob is
 * handed straight to the WAV transcoder - no Blob->dataURL->Blob round-trip,
 * which is what broke decodeAudioData for iOS audio/mp4 recordings.
 */
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
			resolve({ blob, mimeType: blob.type });
		};
		recorder.start();
		if (deps.stopImmediately) recorder.stop();
	});
}
