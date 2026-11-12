import { describe, expect, it, vi } from "vitest";
import { makeEntry } from "../test/fixtures";
import { claimAndFire } from "./alarms-run";

const NOW = new Date(2026, 10, 12, 9, 5, 30);

describe("claimAndFire", () => {
	it("claims due ids synchronously before any playback resolves", async () => {
		let resolvePlay: (() => void) | undefined;
		const player = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolvePlay = resolve;
				}),
		);
		const claimed: string[] = [];
		const play = claimAndFire([makeEntry({ id: "a", time: "09:05" })], NOW, claimed, player);

		// The id is claimed immediately, even though the player is still pending.
		expect(claimed).toEqual(["a"]);
		expect(player).toHaveBeenCalledTimes(1);

		resolvePlay?.();
		await play;
	});

	it("does not fire the same id twice across consecutive ticks", async () => {
		const player = vi.fn().mockResolvedValue(undefined);
		const claimed: string[] = [];
		const entries = [makeEntry({ id: "a", time: "09:05" })];

		const first = claimAndFire(entries, NOW, claimed, player);
		const second = claimAndFire(entries, NOW, claimed, player);
		await Promise.all([first, second]);

		expect(player).toHaveBeenCalledTimes(1);
		expect(claimed).toEqual(["a"]);
	});

	it("ignores entries that are not due", async () => {
		const player = vi.fn().mockResolvedValue(undefined);
		const claimed: string[] = [];
		await claimAndFire([makeEntry({ id: "a", time: "10:00" })], NOW, claimed, player);
		expect(player).not.toHaveBeenCalled();
		expect(claimed).toEqual([]);
	});
});
