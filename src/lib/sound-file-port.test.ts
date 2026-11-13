import { afterEach, describe, expect, it, vi } from "vitest";
import { makeEntry } from "../test/fixtures";
import { ChimeSource } from "./enums";
import { armSoundFiles } from "./sound-file";

const OWN_WAV =
	"data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

const ownChime = () =>
	makeEntry({
		id: "w",
		chimeSource: ChimeSource.Recorded,
		chimeDataUrl: OWN_WAV,
		extraChime: true,
	});

describe("soundFilePort (ONE platform gate for both callers)", () => {
	afterEach(() => vi.doUnmock("./lib/native-shell"));

	it("is a silent no-op in the web build - no Filesystem, no error to report", async () => {
		vi.doMock("./lib/native-shell", () => ({ isNativeShell: () => false }));
		vi.resetModules();
		const { soundFilePort: port } = await import("./sound-file-native");
		const onError = vi.fn();
		await armSoundFiles([ownChime()], port(), onError);
		expect(onError).not.toHaveBeenCalled();
	});

	it("deletes without throwing in the web build", async () => {
		vi.doMock("./lib/native-shell", () => ({ isNativeShell: () => false }));
		vi.resetModules();
		const { soundFilePort: port } = await import("./sound-file-native");
		await expect(
			port().deleteFile({ path: "Sounds/x.wav", directory: "LIBRARY" }),
		).resolves.toBeUndefined();
	});
});
