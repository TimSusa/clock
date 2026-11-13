import { describe, expect, it } from "vitest";
import { makeEntry } from "../test/fixtures";
import { ChimeSource } from "./enums";
import { notificationSoundFor, planNotifications, soundFileNameFor } from "./notification-plan";

const NOW = new Date(2026, 10, 12, 9, 0, 0);
const OWN_WAV =
	"data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

describe("notificationSoundFor", () => {
	it("uses the bundled short chime for the default source", () => {
		expect(notificationSoundFor(makeEntry())).toBe("chime-notification.wav");
	});

	it("uses the per-entry Library/Sounds file for own recordings and custom MP3s", () => {
		// NOTE: these must be REAL WAV data - see the fallback test below.
		expect(
			notificationSoundFor(
				makeEntry({
					id: "c",
					chimeSource: ChimeSource.Custom,
					chimeDataUrl: OWN_WAV,
					extraChime: true,
				}),
			),
		).toBe(soundFileNameFor("c"));
		expect(
			notificationSoundFor(
				makeEntry({
					id: "r",
					chimeSource: ChimeSource.Recorded,
					chimeDataUrl: OWN_WAV,
					extraChime: true,
				}),
			),
		).toBe(soundFileNameFor("r"));
	});

	it("FALLS BACK to the bundled WAV when own audio is not decodable WAV", () => {
		// iOS audio/mp4 could not be transcoded -> the raw bytes would be written
		// under a *.wav name and stay silent. The OS must play the bundled WAV.
		expect(
			notificationSoundFor(
				makeEntry({
					id: "mp4",
					chimeSource: ChimeSource.Recorded,
					chimeDataUrl: "data:audio/mp4;base64,Y",
					extraChime: true,
				}),
			),
		).toBe("chime-notification.wav");
		expect(
			notificationSoundFor(
				makeEntry({
					id: "webm",
					chimeSource: ChimeSource.Recorded,
					chimeDataUrl: "data:audio/webm;base64,REC",
					extraChime: true,
				}),
			),
		).toBe("chime-notification.wav");
	});

	it("falls back to the bundled chime when extraChime is OFF despite own audio", () => {
		expect(
			notificationSoundFor(
				makeEntry({
					id: "off",
					chimeSource: ChimeSource.Recorded,
					chimeDataUrl: "data:audio/mp4;base64,Y",
					extraChime: false,
				}),
			),
		).toBe("chime-notification.wav");
	});

	it("keeps the bundled short chime for a YouTube link (no local audio file)", () => {
		expect(notificationSoundFor(makeEntry({ chimeSource: ChimeSource.YouTube }))).toBe(
			"chime-notification.wav",
		);
	});
});

describe("planNotifications — iOS needs an explicit sound", () => {
	it("carries a sound on every planned notification", () => {
		const future = makeEntry({ id: "f", iso: "2026-11-12", time: "10:00" });
		const planned = planNotifications([future], NOW);
		expect(planned[0]?.sound).toBe("chime-notification.wav");
	});
});
