import { describe, expect, it, vi } from "vitest";
import { createPreviewController } from "./sound";

function fakeAudio() {
	const instance = {
		src: "",
		paused: true,
		play: vi.fn().mockResolvedValue(undefined),
		pause: vi.fn(),
	};
	return instance;
}

describe("createPreviewController", () => {
	it("starts playback for a url and reports playing", async () => {
		const audio = fakeAudio();
		const ctl = createPreviewController(() => audio);
		await ctl.toggle("a.mp3");
		expect(audio.play).toHaveBeenCalledTimes(1);
		expect(ctl.isPlaying()).toBe(true);
	});

	it("stops playback when toggled again with the same url", async () => {
		const audio = fakeAudio();
		const ctl = createPreviewController(() => audio);
		await ctl.toggle("a.mp3");
		await ctl.toggle("a.mp3");
		expect(audio.pause).toHaveBeenCalledTimes(1);
		expect(ctl.isPlaying()).toBe(false);
	});

	it("switches to a new url instead of stopping", async () => {
		const audio = fakeAudio();
		const ctl = createPreviewController(() => audio);
		await ctl.toggle("a.mp3");
		await ctl.toggle("b.mp3");
		expect(audio.src).toBe("b.mp3");
		expect(audio.play).toHaveBeenCalledTimes(2);
	});

	it("stop() is safe when nothing is playing", () => {
		const audio = fakeAudio();
		const ctl = createPreviewController(() => audio);
		expect(() => ctl.stop()).not.toThrow();
		expect(ctl.isPlaying()).toBe(false);
	});

	it("stop() ends playback and clears the current url", async () => {
		const audio = fakeAudio();
		const ctl = createPreviewController(() => audio);
		await ctl.toggle("a.mp3");
		ctl.stop();
		expect(audio.pause).toHaveBeenCalledTimes(1);
		expect(ctl.isPlaying()).toBe(false);
		expect(ctl.currentUrl()).toBeNull();
	});
});
