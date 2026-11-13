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
			onerror: null as null | (() => void),
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

	it("binds the REAL onerror handler so a failed own recording clears the player", async () => {
		const audio = fakeAudio();
		audio.play.mockRejectedValue(new Error("codec-gap"));
		const player = createAlarmPlayer(() => audio as never);
		await expect(player.play("data:audio/mp4;base64,QUJD")).rejects.toThrow(
			"audio-playback-failed",
		);
		expect(player.isPlaying()).toBe(false);
	});
});

describe("isAcceptableAudioFile", () => {
	it.each([
		["a.mp3", "audio/mpeg"],
		["song.MP3", ""],
		["Aufnahme.wav", "audio/wav"],
		["clip.m4a", "audio/mp4"],
		["voice.aac", "audio/aac"],
		["track.ogg", "audio/ogg"],
		["master.flac", "audio/flac"],
		["rec.webm", "audio/webm"],
	])("accepts playable audio %s (%s)", (name, type) => {
		expect(isAcceptableAudioFile({ name, type, size: 1000 })).toBe(true);
	});

	it("rejects a non-audio file even with an audio-ish name", () => {
		expect(isAcceptableAudioFile({ name: "a.png", type: "image/png", size: 1000 })).toBe(false);
		expect(isAcceptableAudioFile({ name: "note.txt", type: "text/plain", size: 1000 })).toBe(false);
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
