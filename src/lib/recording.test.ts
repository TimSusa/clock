import { describe, expect, it, vi } from "vitest";
import { MAX_CUSTOM_CHIME_BYTES } from "./constants";
import { isAcceptableRecording, recordChime } from "./recording";
import { blobToDataUrl } from "./wav";

describe("isAcceptableRecording", () => {
	it("accepts a webm/audio blob within the size limit", () => {
		expect(isAcceptableRecording({ type: "audio/webm", size: 1000 })).toBe(true);
	});

	it("accepts an mp4/audio blob (Safari)", () => {
		expect(isAcceptableRecording({ type: "audio/mp4", size: 1000 })).toBe(true);
	});

	it("rejects empty or oversized blobs", () => {
		expect(isAcceptableRecording({ type: "audio/webm", size: 0 })).toBe(false);
		expect(isAcceptableRecording({ type: "audio/webm", size: MAX_CUSTOM_CHIME_BYTES + 1 })).toBe(
			false,
		);
	});

	it("rejects a non-audio blob", () => {
		expect(isAcceptableRecording({ type: "image/png", size: 1000 })).toBe(false);
	});
});

describe("blobToDataUrl", () => {
	it("keeps the audio MIME type in the data URL", async () => {
		const result = await blobToDataUrl(new Blob(["abcd"], { type: "audio/webm" }));
		expect(result.startsWith("data:audio/webm;base64,")).toBe(true);
	});
});

describe("recordChime (raw blob path)", () => {
	it("resolves with the raw Blob so transcoding never round-trips through a data URL", async () => {
		const chunk = new Blob(["aac"], { type: "audio/mp4" });
		const recorder = {
			state: "inactive" as RecordingState,
			start: vi.fn(),
			stop: vi.fn(),
			ondataavailable: null as ((e: { data: BlobPart }) => void) | null,
			onstop: null as (() => void) | null,
		};
		const promise = recordChime({
			makeRecorder: () => recorder,
		});
		recorder.ondataavailable?.({ data: chunk });
		recorder.onstop?.();
		const result = await promise;
		expect(result.blob).toBeInstanceOf(Blob);
		expect(result.blob.type).toBe("audio/mp4");
	});
});

describe("recordChime", () => {
	it("starts the recorder and resolves with the raw blob on stop", async () => {
		const chunk = new Blob(["aaa"], { type: "audio/webm" });
		const recorder = {
			state: "inactive" as RecordingState,
			start: vi.fn(function (this: { state: RecordingState }) {
				this.state = "recording";
			}),
			stop: vi.fn(function (this: { state: RecordingState }) {
				this.state = "inactive";
			}),
			ondataavailable: null as ((e: { data: BlobPart }) => void) | null,
			onstop: null as (() => void) | null,
		};

		const promise = recordChime({ makeRecorder: () => recorder });

		expect(recorder.start).toHaveBeenCalledTimes(1);
		recorder.ondataavailable?.({ data: chunk });
		recorder.onstop?.();
		const result = await promise;
		expect(result.blob.type).toBe("audio/webm");
		expect(result.mimeType).toBe("audio/webm");
	});

	it("rejects clearly when MediaRecorder is unavailable", async () => {
		await expect(recordChime({ makeRecorder: () => undefined })).rejects.toThrow(
			"recording-unavailable",
		);
	});
});
