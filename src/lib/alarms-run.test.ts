import { describe, expect, it, vi } from "vitest";
import { makeEntry } from "../test/fixtures";
import { fireAlarms, firedKeyForDay } from "./alarms-run";
import { DEFAULT_CHIME_URL } from "./constants";
import { ChimeSource } from "./enums";

const NOW = new Date(2026, 10, 12, 9, 5, 30);

describe("fireAlarms", () => {
	it("plays the default chime for an entry due this minute", async () => {
		const player = vi.fn().mockResolvedValue(undefined);
		const entries = [makeEntry({ id: "a", time: "09:05" })];
		const fired = await fireAlarms(entries, NOW, [], player);
		expect(player).toHaveBeenCalledWith(DEFAULT_CHIME_URL);
		expect(fired).toEqual(["a"]);
	});

	it("uses a custom data url when the entry has one", async () => {
		const player = vi.fn().mockResolvedValue(undefined);
		const entries = [
			makeEntry({
				id: "a",
				time: "09:05",
				chimeSource: ChimeSource.Custom,
				chimeDataUrl: "data:audio/mpeg;base64,X",
			}),
		];
		await fireAlarms(entries, NOW, [], player);
		expect(player).toHaveBeenCalledWith("data:audio/mpeg;base64,X");
	});

	it("does not replay an id already fired", async () => {
		const player = vi.fn().mockResolvedValue(undefined);
		const entries = [makeEntry({ id: "a", time: "09:05" })];
		const fired = await fireAlarms(entries, NOW, ["a"], player);
		expect(player).not.toHaveBeenCalled();
		expect(fired).toEqual(["a"]);
	});

	it("survives a rejected player without throwing", async () => {
		const player = vi.fn().mockRejectedValue(new Error("blocked"));
		const entries = [makeEntry({ id: "a", time: "09:05" })];
		await expect(fireAlarms(entries, NOW, [], player)).resolves.toEqual(["a"]);
	});
});

describe("firedKeyForDay", () => {
	it("returns the local ISO day", () => {
		expect(firedKeyForDay(NOW)).toBe("2026-11-12");
	});
});
