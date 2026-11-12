import { describe, expect, it } from "vitest";
import { makeEntry } from "../test/fixtures";
import { DEFAULT_CHIME_URL, MAX_CUSTOM_CHIME_BYTES } from "./constants";
import { ChimeSource } from "./enums";
import { isAcceptableAudioFile, resolveChimeUrl } from "./sound";
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
				entry({ chimeSource: ChimeSource.Custom, chimeDataUrl: "data:audio/mpeg;base64,AAA" }),
			),
		).toBe("data:audio/mpeg;base64,AAA");
	});

	it("uses the stored data url for a recorded clip", () => {
		expect(
			resolveChimeUrl(
				entry({
					chimeSource: ChimeSource.Recorded,
					chimeDataUrl: "data:audio/webm;base64,REC",
				}),
			),
		).toBe("data:audio/webm;base64,REC");
	});

	it("falls back to the default when a custom url is empty", () => {
		expect(resolveChimeUrl(entry({ chimeSource: ChimeSource.Custom, chimeDataUrl: "" }))).toBe(
			DEFAULT_CHIME_URL,
		);
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
