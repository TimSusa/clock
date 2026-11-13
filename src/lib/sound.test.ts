import { describe, expect, it, vi } from "vitest";
import { makeEntry } from "../test/fixtures";
import { DEFAULT_CHIME_URL, MAX_CUSTOM_CHIME_BYTES } from "./constants";
import { ChimeSource } from "./enums";
import { createAlarmPlayer, isAcceptableAudioFile, resolveChimeUrl } from "./sound";
import type { CalendarEntry } from "./types";

function entry(overrides: Partial<CalendarEntry> = {}): CalendarEntry {
	return makeEntry(overrides);
}

describe("resolveChimeUrl", () => {
	it("uses the bundled default for Default source", () => {
		expect(resolveChimeUrl(entry())).toBe(DEFAULT_CHIME_URL);
	});

	it("uses the stored data url for Custom source", () => {
		expect(
			resolveChimeUrl(
				entry({
					chimeSource: ChimeSource.Custom,
					chimeDataUrl: "data:audio/mpeg;base64,AAA",
					extraChime: true,
				}),
			),
		).toBe("data:audio/mpeg;base64,AAA");
	});

	it("uses the stored data url for a recorded clip", () => {
		expect(
			resolveChimeUrl(
				entry({
					chimeSource: ChimeSource.Recorded,
					chimeDataUrl: "data:audio/webm;base64,REC",
					extraChime: true,
				}),
			),
		).toBe("data:audio/webm;base64,REC");
	});

	it("plays the bundled default when extraChime is OFF despite stored own audio", () => {
		expect(
			resolveChimeUrl(
				entry({
					chimeSource: ChimeSource.Custom,
					chimeDataUrl: "data:audio/mpeg;base64,AAA",
					extraChime: false,
				}),
			),
		).toBe(DEFAULT_CHIME_URL);
	});

	it("falls back to the default when a custom url is empty", () => {
		expect(resolveChimeUrl(entry({ chimeSource: ChimeSource.Custom, chimeDataUrl: "" }))).toBe(
			DEFAULT_CHIME_URL,
		);
	});
});

describe("createAlarmPlayer", () => {
	function fakeAudio() {
		return {
			src: "",
			pause: vi.fn(),
			play: vi.fn().mockResolvedValue(undefined),
			onended: null as null | (() => void),
			onError: null as null | (() => void),
		};
	}

	it("stops the running audio on stop()", async () => {
		const audio = fakeAudio();
		const player = createAlarmPlayer(() => audio as never);
		void player.play("a.mp3");
		await Promise.resolve();
		player.stop();
		expect(audio.pause).toHaveBeenCalledTimes(1);
		expect(player.isPlaying()).toBe(false);
	});

	it("resolves a pending play when stopped so the ticker is not left hanging", async () => {
		const audio = fakeAudio();
		const player = createAlarmPlayer(() => audio as never);
		const pending = player.play("a.mp3");
		player.stop();
		await expect(pending).resolves.toBeUndefined();
	});

	it("plays only one clip at a time", async () => {
		const first = fakeAudio();
		const audios = [first, fakeAudio()];
		const player = createAlarmPlayer(() => audios.shift() as never);
		void player.play("a.mp3");
		await Promise.resolve();
		void player.play("b.mp3");
		await Promise.resolve();
		expect(first.pause).toHaveBeenCalledTimes(1);
	});
});

describe("isAcceptableAudioFile", () => {
	it("accepts an mp3 within the size limit", () => {
		expect(isAcceptableAudioFile({ name: "a.mp3", type: "audio/mpeg", size: 1000 })).toBe(true);
	});

	it("accepts an mp3 by extension when the type is empty", () => {
		expect(isAcceptableAudioFile({ name: "song.MP3", type: "", size: 1000 })).toBe(true);
	});

	it("rejects non-mp3 files", () => {
		expect(isAcceptableAudioFile({ name: "a.wav", type: "audio/wav", size: 1000 })).toBe(false);
	});

	it("rejects files above the size limit", () => {
		expect(
			isAcceptableAudioFile({
				name: "a.mp3",
				type: "audio/mpeg",
				size: MAX_CUSTOM_CHIME_BYTES + 1,
			}),
		).toBe(false);
	});
});
