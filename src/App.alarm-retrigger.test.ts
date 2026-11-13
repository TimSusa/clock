import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.svelte";
import { TICK_INTERVAL_MS } from "./lib/constants";
import { ChimeSource, StorageKey } from "./lib/enums";
import { makeEntry } from "./test/fixtures";

const FIXED = new Date(2026, 10, 12, 9, 5, 7);

const playCalls = vi.hoisted(() => ({ count: 0 }));

class FakeAudio {
	src = "";
	play = vi.fn(() => {
		playCalls.count += 1;
		return Promise.resolve();
	});
	pause = vi.fn();
	onended: (() => void) | null = null;
	onerror: (() => void) | null = null;
}

beforeEach(() => {
	localStorage.clear();
	localStorage.setItem(StorageKey.ListPeriod, "all");
	localStorage.setItem(StorageKey.ListHolidays, "with");
	localStorage.setItem(StorageKey.ListPast, "show");
	playCalls.count = 0;
	vi.stubGlobal("Audio", FakeAudio);
	vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
	vi.setSystemTime(FIXED);
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

const RECORDED_ENTRY = makeEntry({
	id: "rec-1",
	iso: "2026-11-12",
	time: "09:05",
	title: "Aufnahme-Alarm",
	extraChime: true,
	chimeSource: ChimeSource.Recorded,
	chimeDataUrl: "data:audio/mp4;base64,QUJD",
});

describe("App - second trigger of the SAME alarm with an own recording", () => {
	it("does NOT re-raise the dialog on every 1-s tick within the same minute", async () => {
		localStorage.setItem(StorageKey.Entries, JSON.stringify([RECORDED_ENTRY]));
		render(App);
		vi.advanceTimersByTime(TICK_INTERVAL_MS);
		await waitFor(() => expect(screen.getByTestId("alarm-dialog")).toBeInTheDocument());
		const plays = playCalls.count;
		// Two more ticks in the very same minute must not re-open / re-play.
		vi.advanceTimersByTime(TICK_INTERVAL_MS);
		vi.advanceTimersByTime(TICK_INTERVAL_MS);
		expect(playCalls.count).toBe(plays);
	});

	it("plays the own recording again on the second trigger (reported bug)", async () => {
		localStorage.setItem(StorageKey.Entries, JSON.stringify([RECORDED_ENTRY]));
		render(App);

		// 1st trigger: dialog appears, own recording plays.
		vi.advanceTimersByTime(TICK_INTERVAL_MS);
		await waitFor(() => expect(screen.getByTestId("alarm-dialog")).toBeInTheDocument());
		const firstPlays = playCalls.count;
		expect(firstPlays).toBeGreaterThan(0);

		// User cancels the window - the alarm is due again in the same minute.
		await fireEvent.click(within(screen.getByTestId("alarm-dialog")).getByTestId("alarm-cancel"));
		expect(screen.queryByTestId("alarm-dialog")).not.toBeInTheDocument();

		// 2nd trigger, SAME day + SAME id. The OS notification sound is not the
		// own recording: the app's dialog player is the only source for it.
		vi.advanceTimersByTime(TICK_INTERVAL_MS);
		await waitFor(() => expect(screen.getByTestId("alarm-dialog")).toBeInTheDocument());
		expect(playCalls.count).toBeGreaterThan(firstPlays);
	});
});
