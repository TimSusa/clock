import { describe, expect, it, vi } from "vitest";
import { makeEntry } from "../test/fixtures";
import { ChimeSource } from "./enums";
import { soundFileNameFor } from "./notification-plan";
import type { SoundFileSystem } from "./sound-file";
import { armSoundFiles, base64FromDataUrl, soundWritePlan, writeSoundFiles } from "./sound-file";

describe("base64FromDataUrl", () => {
	it("strips the data-url prefix and keeps only the payload", () => {
		expect(base64FromDataUrl("data:audio/mp4;base64,QUJD")).toBe("QUJD");
	});

	it("returns null for a non-data-url", () => {
		expect(base64FromDataUrl("https://example.com/a.mp3")).toBeNull();
	});

	it("returns null for an empty payload", () => {
		expect(base64FromDataUrl("data:audio/webm;base64,")).toBeNull();
	});
});

const OWN_WAV =
	"data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

describe("soundWritePlan", () => {
	it("produces a Library/Sounds write plan for a recorded chime", () => {
		const entry = makeEntry({
			id: "rec-1",
			chimeSource: ChimeSource.Recorded,
			chimeDataUrl: OWN_WAV,
			extraChime: true,
		});
		expect(soundWritePlan(entry)).toEqual({
			path: `Sounds/${soundFileNameFor("rec-1")}`,
			directory: "LIBRARY",
			data: OWN_WAV.split(",")[1],
		});
	});

	it("produces the same plan for a custom MP3", () => {
		const entry = makeEntry({
			id: "c",
			chimeSource: ChimeSource.Custom,
			chimeDataUrl: OWN_WAV,
			extraChime: true,
		});
		expect(soundWritePlan(entry)?.data).toBe(OWN_WAV.split(",")[1]);
	});

	it("returns null when extraChime is OFF (no orphan sound file)", () => {
		const entry = makeEntry({
			id: "off",
			chimeSource: ChimeSource.Custom,
			chimeDataUrl: OWN_WAV,
			extraChime: false,
		});
		expect(soundWritePlan(entry)).toBeNull();
	});

	it("returns null for the bundled default (nothing to write)", () => {
		expect(soundWritePlan(makeEntry({ id: "d" }))).toBeNull();
	});

	it("reports a failing native sound write instead of silently swallowing it", async () => {
		const failing: SoundFileSystem = {
			mkdir: vi.fn().mockRejectedValue(new Error("mkdir-denied")),
			writeFile: vi.fn().mockResolvedValue(undefined),
			deleteFile: vi.fn().mockResolvedValue(undefined),
		};
		const onError = vi.fn();
		await armSoundFiles(
			[
				makeEntry({
					id: "w",
					chimeSource: ChimeSource.Recorded,
					chimeDataUrl: OWN_WAV,
					extraChime: true,
				}),
			],
			failing,
			onError,
		);
		expect(onError).toHaveBeenCalledTimes(1);
		expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
	});

	it("does NOT report anything when there is no own WAV to write", async () => {
		const onError = vi.fn();
		await armSoundFiles([makeEntry({ id: "plain" })], {} as SoundFileSystem, onError);
		expect(onError).not.toHaveBeenCalled();
	});

	it("does NOT write a fake *.wav when own audio is not real WAV", () => {
		// Consistency with notificationSoundFor(): a failed transcode must not
		// leave MP4 bytes in Library/Sounds under a .wav name.
		const entry = makeEntry({
			id: "raw",
			chimeSource: ChimeSource.Recorded,
			chimeDataUrl: "data:audio/mp4;base64,Y",
			extraChime: true,
		});
		expect(soundWritePlan(entry)).toBeNull();
	});

	it("returns null for an invalid data url", () => {
		const entry = makeEntry({
			id: "bad",
			chimeSource: ChimeSource.Recorded,
			chimeDataUrl: "not-a-data-url",
		});
		expect(soundWritePlan(entry)).toBeNull();
	});
});

describe("writeSoundFiles (iOS OS-PLUG-FILE-0010)", () => {
	it("STILL writes the chime when Library/Sounds already exists (2nd launch)", async () => {
		// Real device log: Capacitor Filesystem.mkdir rejects with
		// OS-PLUG-FILE-0010 "already exists" even with recursive:true on iOS.
		// That must NOT abort the writeFile that follows - otherwise the own
		// recording is never refreshed and stays silent on every later alarm.
		const alreadyExists = Object.assign(new Error("already exists"), {
			code: "OS-PLUG-FILE-0010",
		});
		const fs: SoundFileSystem = {
			mkdir: vi.fn().mockRejectedValue(alreadyExists),
			writeFile: vi.fn().mockResolvedValue(undefined),
			deleteFile: vi.fn().mockResolvedValue(undefined),
		};
		const entry = makeEntry({
			id: "rec-2",
			chimeSource: ChimeSource.Recorded,
			chimeDataUrl: OWN_WAV,
			extraChime: true,
		});
		await writeSoundFiles(fs, [entry]);
		expect(fs.writeFile).toHaveBeenCalledTimes(1);
	});

	it("still propagates a REAL mkdir failure (permission denied)", async () => {
		const fs: SoundFileSystem = {
			mkdir: vi.fn().mockRejectedValue(new Error("permission-denied")),
			writeFile: vi.fn().mockResolvedValue(undefined),
			deleteFile: vi.fn().mockResolvedValue(undefined),
		};
		const entry = makeEntry({
			id: "rec-3",
			chimeSource: ChimeSource.Recorded,
			chimeDataUrl: OWN_WAV,
			extraChime: true,
		});
		await expect(writeSoundFiles(fs, [entry])).rejects.toThrow("permission-denied");
		expect(fs.writeFile).not.toHaveBeenCalled();
	});
});
