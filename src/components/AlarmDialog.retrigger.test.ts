import { render } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import { createAlarmPlayer } from "../lib/sound";
import { makeEntry } from "../test/fixtures";
import AlarmDialog from "./AlarmDialog.svelte";

const RECORDED = makeEntry({
	id: "rec",
	title: "Aufnahme-Test",
	time: "09:00",
	chimeName: "Eigene Aufnahme",
	extraChime: true,
	chimeDataUrl: "data:audio/mp4;base64,QUJD",
});

describe("AlarmDialog — second trigger with own recording (reported bug)", () => {
	it("plays the own recording on EVERY trigger with the SAME shared player", async () => {
		const player = createAlarmPlayer(
			() =>
				({
					src: "",
					pause: vi.fn(),
					play: vi.fn().mockResolvedValue(undefined),
					onended: null,
					onerror: null,
				}) as never,
		);
		const playSpy = vi.spyOn(player, "play");

		// First alarm: mount, play, cancel (unmount).
		const first = render(AlarmDialog, {
			props: { entry: RECORDED, onCancel: vi.fn(), onSnooze: vi.fn(), player },
		});
		expect(playSpy).toHaveBeenCalledTimes(1);
		first.unmount();

		// Second alarm, SAME entry object and SAME shared player.
		const second = render(AlarmDialog, {
			props: { entry: RECORDED, onCancel: vi.fn(), onSnooze: vi.fn(), player },
		});
		expect(playSpy).toHaveBeenCalledTimes(2);
		second.unmount();
	});
});
