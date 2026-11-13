import { describe, expect, it, vi } from "vitest";
import { makeEntry } from "../test/fixtures";
import { ChimeSource } from "./enums";
import type { SoundFileSystem } from "./sound-file";
import { writeSoundFiles } from "./sound-file";

const OWN_WAV =
	"data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

const own = () =>
	makeEntry({
		id: "rec",
		chimeSource: ChimeSource.Recorded,
		chimeDataUrl: OWN_WAV,
		extraChime: true,
	});

describe("writeSoundFiles — no mkdir error spam on iOS", () => {
	it("skips mkdir entirely when Sounds already exists (stat resolves)", async () => {
		const fs: SoundFileSystem = {
			stat: vi.fn().mockResolvedValue({ type: "directory" }),
			mkdir: vi.fn().mockResolvedValue(undefined),
			writeFile: vi.fn().mockResolvedValue(undefined),
			deleteFile: vi.fn().mockResolvedValue(undefined),
		};
		await writeSoundFiles(fs, [own()]);
		expect(fs.mkdir).not.toHaveBeenCalled();
		expect(fs.writeFile).toHaveBeenCalledTimes(1);
	});

	it("creates the folder when stat says it is missing", async () => {
		const fs: SoundFileSystem = {
			stat: vi.fn().mockRejectedValue(new Error("not-found")),
			mkdir: vi.fn().mockResolvedValue(undefined),
			writeFile: vi.fn().mockResolvedValue(undefined),
			deleteFile: vi.fn().mockResolvedValue(undefined),
		};
		await writeSoundFiles(fs, [own()]);
		expect(fs.mkdir).toHaveBeenCalledTimes(1);
		expect(fs.writeFile).toHaveBeenCalledTimes(1);
	});

	it("falls back to the tolerant mkdir path when stat is unavailable (web / older mocks)", async () => {
		const fs: SoundFileSystem = {
			mkdir: vi
				.fn()
				.mockRejectedValue(
					Object.assign(new Error("already exists"), { code: "OS-PLUG-FILE-0010" }),
				),
			writeFile: vi.fn().mockResolvedValue(undefined),
			deleteFile: vi.fn().mockResolvedValue(undefined),
		};
		await writeSoundFiles(fs, [own()]);
		expect(fs.writeFile).toHaveBeenCalledTimes(1);
	});
});
