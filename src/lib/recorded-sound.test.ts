import { describe, expect, it } from "vitest";
import { makeEntry } from "../test/fixtures";
import { ChimeSource } from "./enums";
import { notificationSoundFor, soundFileNameFor } from "./notification-plan";

const OWN_WAV =
	"data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

const RECORDED = makeEntry({
	id: "abc-123",
	chimeSource: ChimeSource.Recorded,
	chimeName: "Eigene Aufnahme",
	chimeDataUrl: OWN_WAV,
	extraChime: true,
});

describe("soundFileNameFor", () => {
	it("is stable for the same entry id", () => {
		expect(soundFileNameFor("abc-123")).toBe(soundFileNameFor("abc-123"));
	});

	it("differs for different entries", () => {
		expect(soundFileNameFor("a")).not.toBe(soundFileNameFor("b"));
	});

	it("is a short .wav filename without path separators or data-url chars", () => {
		const name = soundFileNameFor("weird/id:with?chars");
		expect(name).toMatch(/^clock-chime-[a-z0-9]+\.wav$/);
		expect(name.length).toBeLessThan(60);
	});
});

describe("notificationSoundFor — per-entry recorded chime", () => {
	it("uses the per-entry sound file for a recorded chime", () => {
		expect(notificationSoundFor(RECORDED)).toBe(soundFileNameFor("abc-123"));
	});

	it("uses the per-entry sound file for a custom MP3", () => {
		const custom = makeEntry({
			id: "custom-1",
			chimeSource: ChimeSource.Custom,
			chimeDataUrl: OWN_WAV,
			extraChime: true,
		});
		expect(notificationSoundFor(custom)).toBe(soundFileNameFor("custom-1"));
	});

	it("keeps the bundled default for a default chime", () => {
		expect(notificationSoundFor(makeEntry({ id: "d" }))).toBe("chime-notification.wav");
	});
});
