import { describe, expect, it, vi } from "vitest";
import { MAX_CUSTOM_CHIME_BYTES } from "./constants";
import { blobToDataUrl, isAcceptableRecording, recordChime } from "./recording";

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
	it("resolves with the FileReader result", async () => {
		const result = await blobToDataUrl(new Blob(["abcd"], { type: "audio/webm" }), (reader) => {
			// simulate a successful read
			reader.onload?.({ target: reader } as unknown as ProgressEvent<FileReader>);
		});
		expect(typeof result).toBe("string");
	});
});

describe("recordChime", () => {
	it("starts the recorder and resolves with a data url on stop", async () => {
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

		const promise = recordChime({
			makeRecorder: () => recorder,
			toDataUrl: async () => "data:audio/webm;base64,AAA",
		});

		expect(recorder.start).toHaveBeenCalledTimes(1);
		recorder.ondataavailable?.({ data: chunk });
		recorder.onstop?.();
		await expect(promise).resolves.toEqual({
			dataUrl: "data:audio/webm;base64,AAA",
			mimeType: "audio/webm",
		});
	});

	it("rejects clearly when MediaRecorder is unavailable", async () => {
		await expect(
			recordChime({ makeRecorder: () => undefined, toDataUrl: async () => "" }),
		).rejects.toThrow("recording-unavailable");
	});
});
