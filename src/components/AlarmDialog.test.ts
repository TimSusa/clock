import { fireEvent, render, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import { makeEntry } from "../test/fixtures";
import AlarmDialog from "./AlarmDialog.svelte";

const ENTRY = makeEntry({
	id: "a",
	title: "Zahnarzt",
	time: "09:00",
	chimeName: "Eigene Aufnahme",
});

function mount() {
	const onCancel = vi.fn();
	const onSnooze = vi.fn();
	const { container } = render(AlarmDialog, { entry: ENTRY, onCancel, onSnooze });
	const view = within(container);
	return { getByTestId: view.getByTestId, getByText: view.getByText, onCancel, onSnooze };
}

describe("AlarmDialog", () => {
	it("shows the event title, time and chime when an alarm fires", () => {
		const { getByTestId, getByText } = mount();
		expect(getByTestId("alarm-dialog")).toBeInTheDocument();
		expect(getByText("Zahnarzt")).toBeInTheDocument();
		expect(getByText(/09:00/)).toBeInTheDocument();
		expect(getByText(/Eigene Aufnahme/)).toBeInTheDocument();
	});

	it("offers cancel and +15min buttons", () => {
		const { getByTestId } = mount();
		expect(getByTestId("alarm-cancel")).toBeInTheDocument();
		expect(getByTestId("alarm-snooze")).toHaveTextContent("15");
	});

	it("calls onCancel when cancel is clicked", async () => {
		const { getByTestId, onCancel } = mount();
		await fireEvent.click(getByTestId("alarm-cancel"));
		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	it("calls onSnooze when snooze is clicked", async () => {
		const { getByTestId, onSnooze } = mount();
		await fireEvent.click(getByTestId("alarm-snooze"));
		expect(onSnooze).toHaveBeenCalledTimes(1);
	});
});

describe("AlarmDialog — chime playback (stoppable)", () => {
	function mountWithPlayer(
		entry = makeEntry(),
		player = {
			play: vi.fn().mockResolvedValue(undefined),
			stop: vi.fn(),
			isPlaying: vi.fn().mockReturnValue(false),
		},
	) {
		const { container, unmount } = render(AlarmDialog, {
			props: { entry, onCancel: vi.fn(), onSnooze: vi.fn(), player },
		});
		return { getByTestId: within(container).getByTestId, player, unmount };
	}

	it("plays the extra chime when the entry has extraChime enabled", () => {
		const player = {
			play: vi.fn().mockResolvedValue(undefined),
			stop: vi.fn(),
			isPlaying: vi.fn().mockReturnValue(false),
		};
		mountWithPlayer(
			makeEntry({ extraChime: true, chimeDataUrl: "data:audio/mp4;base64,X" }),
			player,
		);
		expect(player.play).toHaveBeenCalledTimes(1);
	});

	it("plays nothing when extraChime is off", () => {
		const player = {
			play: vi.fn().mockResolvedValue(undefined),
			stop: vi.fn(),
			isPlaying: vi.fn().mockReturnValue(false),
		};
		mountWithPlayer(makeEntry({ extraChime: false }), player);
		expect(player.play).not.toHaveBeenCalled();
	});

	it("STOPS the chime when Cancel is pressed (the reported bug)", async () => {
		const { getByTestId, player } = mountWithPlayer(makeEntry({ extraChime: true }));
		await fireEvent.click(getByTestId("alarm-cancel"));
		expect(player.stop).toHaveBeenCalledTimes(1);
	});

	it("STOPS the chime when Snooze is pressed", async () => {
		const { getByTestId, player } = mountWithPlayer(makeEntry({ extraChime: true }));
		await fireEvent.click(getByTestId("alarm-snooze"));
		expect(player.stop).toHaveBeenCalledTimes(1);
	});

	it("STOPS the chime on unmount", () => {
		const { player, unmount } = mountWithPlayer(makeEntry({ extraChime: true }));
		unmount();
		expect(player.stop).toHaveBeenCalledTimes(1);
	});
});
