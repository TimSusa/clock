import { describe, expect, it, vi } from "vitest";
import { browserWavDeps, normalizeOwnChime } from "./wav";

describe("browserWavDeps.decode", () => {
	it("works with a Blob that has no arrayBuffer() (jsdom / older WebViews)", async () => {
		vi.stubGlobal(
			"AudioContext",
			class {
				decodeAudioData = vi.fn().mockResolvedValue({
					numberOfChannels: 1,
					sampleRate: 8000,
					length: 1,
					getChannelData: () => new Float32Array([0]),
				});
				close = vi.fn().mockResolvedValue(undefined);
			},
		);
		const audio = await browserWavDeps().decode(new Blob(["raw"], { type: "audio/webm" }));
		expect(audio.length).toBe(1);
		vi.unstubAllGlobals();
	});

	it("hands the iOS audio/mp4 bytes straight to decodeAudioData (no data-URL round-trip)", async () => {
		const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]); // ftyp box
		const decodeAudioData = vi.fn().mockResolvedValue({
			numberOfChannels: 1,
			sampleRate: 44100,
			length: 1,
			getChannelData: () => new Float32Array([0]),
		});
		vi.stubGlobal(
			"AudioContext",
			class {
				decodeAudioData = decodeAudioData;
				close = vi.fn().mockResolvedValue(undefined);
			},
		);
		const blob = new Blob([bytes], { type: "audio/mp4" });
		await browserWavDeps().decode(blob);
		const buffer = decodeAudioData.mock.calls[0]?.[0] as ArrayBuffer;
		expect(new Uint8Array(buffer)).toEqual(bytes);
		vi.unstubAllGlobals();
	});
});

describe("normalizeOwnChime", () => {
	it("transcodes an audio/webm recording into a WAV data URL", async () => {
		const deps = {
			decode: vi.fn(async () => ({
				numberOfChannels: 1,
				sampleRate: 44100,
				length: 2,
				getChannelData: () => new Float32Array([0, 0.5]),
			})),
			toDataUrl: vi.fn(async () => "data:audio/wav;base64,RIFF"),
		};
		const result = await normalizeOwnChime(new Blob(["webm-bytes"], { type: "audio/webm" }), deps);
		expect(deps.decode).toHaveBeenCalledTimes(1);
		expect(result).toBe("data:audio/wav;base64,RIFF");
	});

	it("keeps an already-WAV blob (no needless re-encode)", async () => {
		const deps = {
			decode: vi.fn(async () => ({
				numberOfChannels: 1,
				sampleRate: 44100,
				length: 1,
				getChannelData: () => new Float32Array([0]),
			})),
			toDataUrl: vi.fn(async () => "data:audio/wav;base64,RIFF"),
		};
		const result = await normalizeOwnChime(new Blob(["wav-bytes"], { type: "audio/wav" }), deps);
		expect(deps.decode).not.toHaveBeenCalled();
		expect(result.startsWith("data:audio/wav")).toBe(true);
	});
});
