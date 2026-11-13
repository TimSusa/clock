import { describe, expect, it, vi } from "vitest";
import { encodeWav, toWavDataUrl, wavHeaderIsValid } from "./wav";

describe("encodeWav", () => {
	it("writes a RIFF/WAVE header with fmt and data chunks", () => {
		const bytes = encodeWav(new Float32Array([0, 1, -1, 0]), 44100);
		const view = new DataView(bytes.buffer);
		expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("RIFF");
		expect(String.fromCharCode(...bytes.slice(8, 12))).toBe("WAVE");
		expect(String.fromCharCode(...bytes.slice(12, 16))).toBe("fmt ");
		expect(view.getUint16(20, true)).toBe(1); // PCM
		expect(view.getUint16(22, true)).toBe(1); // mono
		expect(view.getUint32(24, true)).toBe(44100);
		expect(String.fromCharCode(...bytes.slice(36, 40))).toBe("data");
	});

	it("declares the correct data length and interleaves mono 16-bit PCM", () => {
		const bytes = encodeWav(new Float32Array([0, 1, -1]), 8000);
		const view = new DataView(bytes.buffer);
		expect(view.getUint32(40, true)).toBe(3 * 2);
		expect(bytes.length).toBe(44 + 3 * 2);
		expect(view.getInt16(44, true)).toBe(0);
		expect(view.getInt16(46, true)).toBe(32767);
		expect(view.getInt16(48, true)).toBe(-32768); // full negative scale
	});

	it("clamps out-of-range float samples instead of wrapping", () => {
		const bytes = encodeWav(new Float32Array([2, -2]), 8000);
		const view = new DataView(bytes.buffer);
		expect(view.getInt16(44, true)).toBe(32767);
		expect(view.getInt16(46, true)).toBe(-32768);
	});
});

describe("wavHeaderIsValid", () => {
	it("accepts a real WAV and rejects a WebM/MP4 payload", () => {
		expect(wavHeaderIsValid(encodeWav(new Float32Array([0, 0.5]), 44100))).toBe(true);
		expect(wavHeaderIsValid(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]))).toBe(false);
	});
});

/** Minimal decodable-audio stand-in: jsdom has no WebAudio. */
function fakeDecoder(samples: Float32Array) {
	return {
		decode: vi.fn(async () => ({
			numberOfChannels: 1,
			sampleRate: 44100,
			length: samples.length,
			getChannelData: () => samples,
		})),
		toDataUrl: vi.fn(async (_bytes: Uint8Array) => "data:audio/wav;base64,AAAA"),
	};
}

describe("toWavDataUrl", () => {
	it("decodes the blob and returns a WAV data URL", async () => {
		const deps = fakeDecoder(new Float32Array([0, 0.25, -0.25]));
		const url = await toWavDataUrl(new Blob(["raw"]), deps);
		expect(deps.decode).toHaveBeenCalledTimes(1);
		expect(deps.toDataUrl).toHaveBeenCalledTimes(1);
		expect(url).toContain("data:audio/wav");
	});

	it("mixes down stereo to mono before encoding", async () => {
		const deps = {
			decode: vi.fn(async () => ({
				numberOfChannels: 2,
				sampleRate: 22050,
				length: 2,
				getChannelData: (i: number) => new Float32Array(i === 0 ? [1, 1] : [0, 0]),
			})),
			toDataUrl: vi.fn(async (bytes: Uint8Array) => {
				const view = new DataView(bytes.buffer);
				// 0.5 + 0 mixed down, then scaled to 16-bit PCM.
				expect(view.getInt16(44, true)).toBe(16384);
				return "ok";
			}),
		};
		await toWavDataUrl(new Blob(["raw"]), deps);
		expect(deps.toDataUrl).toHaveBeenCalledTimes(1);
	});
});
