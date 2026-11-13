import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.svelte";
import { TICK_INTERVAL_MS } from "./lib/constants";
import { CalendarProvider, ChimeSource, EntryCategory, StorageKey, Theme } from "./lib/enums";
import { makeEntry } from "./test/fixtures";

const importGate = vi.hoisted(() => ({
	resolve: undefined as ((events: unknown[]) => void) | undefined,
}));

vi.mock("./lib/native-calendar-port", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./lib/native-calendar-port")>();
	return {
		...actual,
		createCalendarPort: vi.fn(async () => ({
			requestPermissions: vi.fn().mockResolvedValue(true),
			listEvents: vi.fn(
				() =>
					new Promise<unknown[]>((resolve) => {
						importGate.resolve = resolve;
					}),
			),
			createEvent: vi.fn().mockResolvedValue("EK-NEW"),
			modifyEvent: vi.fn().mockResolvedValue(undefined),
			deleteEvents: vi.fn().mockResolvedValue(undefined),
		})),
	};
});

vi.mock("./lib/sound-file", async (importOriginal) => ({
	...(await importOriginal<typeof import("./lib/sound-file")>()),
	removeSoundFile: vi.fn().mockResolvedValue(undefined),
}));

import { removeSoundFile } from "./lib/sound-file";

const FIXED = new Date(2026, 10, 12, 9, 5, 7);

// jsdom has no HTMLMediaElement; the preview controller only needs play/pause/src.
class FakeAudio {
	src = "";
	play = vi.fn().mockResolvedValue(undefined);
	pause = vi.fn();
}

/** Minimal MediaRecorder stand-in: fires one chunk and resolves on stop(). */
class FakeMediaRecorder {
	state: RecordingState = "inactive";
	ondataavailable: ((e: { data: BlobPart }) => void) | null = null;
	onstop: (() => void) | null = null;
	start(): void {
		this.state = "recording";
	}
	stop(): void {
		this.state = "inactive";
		this.ondataavailable?.({ data: new Blob(["rec"], { type: "audio/webm" }) });
		this.onstop?.();
	}
}

const fakeTrack = { stop: vi.fn() };
const fakeStream = { getTracks: () => [fakeTrack] } as unknown as MediaStream;

beforeEach(() => {
	localStorage.clear();
	// Neutral baseline for tests that assert list contents. The dedicated
	// "starts in the day view" test clears these keys itself.
	localStorage.setItem(StorageKey.ListPeriod, "all");
	localStorage.setItem(StorageKey.ListHolidays, "with");
	localStorage.setItem(StorageKey.ListPast, "hide");
	vi.stubGlobal("Audio", FakeAudio);
	// WebAudio stub so the REAL WAV transcoding path runs in jsdom.
	vi.stubGlobal(
		"AudioContext",
		class {
			decodeAudioData = vi.fn().mockResolvedValue({
				numberOfChannels: 1,
				sampleRate: 8000,
				length: 2,
				getChannelData: () => new Float32Array([0, 0.5]),
			});
			close = vi.fn().mockResolvedValue(undefined);
		},
	);
	vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
	vi.stubGlobal("navigator", {
		...navigator,
		mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream) },
	});
	vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
	vi.setSystemTime(FIXED);
	document.documentElement.classList.remove("dark");
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	document.documentElement.classList.remove("dark");
});

describe("App - home view", () => {
	it("shows the list and no add form by default", () => {
		render(App);
		expect(screen.getByTestId("entry-empty")).toBeInTheDocument();
		expect(screen.getByTestId("add-entry-toggle")).toBeInTheDocument();
		expect(screen.queryByTestId("add-entry-modal")).not.toBeInTheDocument();
		expect(screen.queryByTestId("modal-calendar")).not.toBeInTheDocument();
	});

	it("shows no permanently visible calendar grid", () => {
		render(App);
		expect(screen.queryByTestId("panel-calendar")).not.toBeInTheDocument();
	});

	it("opens the add modal only when + is clicked and closes on cancel", async () => {
		render(App);
		await fireEvent.click(screen.getByTestId("add-entry-toggle"));
		expect(screen.getByTestId("add-entry-modal")).toBeInTheDocument();
		await fireEvent.click(screen.getByTestId("add-entry-close"));
		expect(screen.queryByTestId("add-entry-modal")).not.toBeInTheDocument();
	});

	it("shows the calendar only on demand inside the modal", async () => {
		render(App);
		await fireEvent.click(screen.getByTestId("add-entry-toggle"));
		expect(screen.queryByTestId("modal-calendar")).not.toBeInTheDocument();
		await fireEvent.click(screen.getByTestId("pick-date-toggle"));
		expect(screen.getByTestId("modal-calendar")).toBeInTheDocument();
		expect(screen.getByTestId("month-label")).toHaveTextContent("November 2026");
	});

	it("picks a date from the on-demand calendar and hides it again", async () => {
		render(App);
		await fireEvent.click(screen.getByTestId("add-entry-toggle"));
		await fireEvent.click(screen.getByTestId("pick-date-toggle"));
		await fireEvent.click(screen.getByTestId("day-2026-11-20"));
		expect(screen.queryByTestId("modal-calendar")).not.toBeInTheDocument();
		expect(screen.getByTestId("add-entry-date")).toHaveValue("2026-11-20");
	});

	it("creates one entry that appears in the single list", async () => {
		render(App);
		await fireEvent.click(screen.getByTestId("add-entry-toggle"));
		await fireEvent.input(screen.getByTestId("add-entry-title"), {
			target: { value: "Zahnarzt" },
		});
		await fireEvent.input(screen.getByTestId("add-entry-time"), { target: { value: "15:30" } });
		await fireEvent.click(screen.getByTestId("add-entry-submit"));

		expect(screen.queryByTestId("add-entry-modal")).not.toBeInTheDocument();
		expect(screen.getByTestId("entry-list")).toBeInTheDocument();
		expect(screen.getByTestId("entry-time")).toHaveTextContent("15:30");
		expect(screen.getByText("Zahnarzt")).toBeInTheDocument();
		const stored = JSON.parse(localStorage.getItem(StorageKey.Entries) ?? "[]") as Array<{
			title: string;
			iso: string;
			time: string;
			category: string;
		}>;
		expect(stored).toHaveLength(1);
		expect(stored[0]).toMatchObject({
			title: "Zahnarzt",
			iso: "2026-11-12",
			time: "15:30",
			category: EntryCategory.Event,
		});
	});

	it("supports choosing a category in the unified form", async () => {
		render(App);
		await fireEvent.click(screen.getByTestId("add-entry-toggle"));
		await fireEvent.input(screen.getByTestId("add-entry-title"), {
			target: { value: "Rechnung" },
		});
		await fireEvent.click(
			within(screen.getByTestId("add-entry-modal")).getByRole("button", { name: "Erinnerung" }),
		);
		await fireEvent.click(screen.getByTestId("add-entry-submit"));
		const stored = JSON.parse(localStorage.getItem(StorageKey.Entries) ?? "[]") as Array<{
			category: string;
		}>;
		expect(stored[0]?.category).toBe(EntryCategory.Reminder);
	});

	it("validates an empty title", async () => {
		render(App);
		await fireEvent.click(screen.getByTestId("add-entry-toggle"));
		await fireEvent.click(screen.getByTestId("add-entry-submit"));
		expect(screen.getByTestId("add-entry-error")).toHaveTextContent("Bitte einen Titel eingeben.");
	});

	it("removes an entry from the single list", async () => {
		render(App);
		await fireEvent.click(screen.getByTestId("add-entry-toggle"));
		await fireEvent.click(screen.getByTestId("past-show"));
		await fireEvent.input(screen.getByTestId("add-entry-title"), {
			target: { value: "Weg damit" },
		});
		await fireEvent.click(screen.getByTestId("add-entry-submit"));
		await fireEvent.click(screen.getByRole("button", { name: "Eintrag Weg damit loeschen" }));
		expect(screen.getByTestId("entry-empty")).toBeInTheDocument();
		expect(removeSoundFile).toHaveBeenCalledTimes(1);
	});

	it("edits an entry by clicking its row", async () => {
		render(App);
		await fireEvent.click(screen.getByTestId("add-entry-toggle"));
		await fireEvent.input(screen.getByTestId("add-entry-title"), {
			target: { value: "Zahnarzt" },
		});
		await fireEvent.input(screen.getByTestId("add-entry-time"), { target: { value: "15:30" } });
		await fireEvent.click(screen.getByTestId("add-entry-submit"));

		const storedBefore = JSON.parse(localStorage.getItem(StorageKey.Entries) ?? "[]") as Array<{
			id: string;
		}>;
		const id = storedBefore[0]?.id ?? "";
		await fireEvent.click(screen.getByTestId(`entry-edit-${id}`));

		expect(screen.getByTestId("add-entry-modal")).toBeInTheDocument();
		expect(screen.getByTestId("add-entry-title")).toHaveValue("Zahnarzt");
		expect(screen.getByTestId("add-entry-time")).toHaveValue("15:30");
		await fireEvent.input(screen.getByTestId("add-entry-title"), {
			target: { value: "Zahnarzt verschoben" },
		});
		await fireEvent.input(screen.getByTestId("add-entry-time"), { target: { value: "16:00" } });
		await fireEvent.click(screen.getByTestId("add-entry-submit"));

		const storedAfter = JSON.parse(localStorage.getItem(StorageKey.Entries) ?? "[]") as Array<{
			id: string;
			title: string;
			time: string;
		}>;
		expect(storedAfter).toHaveLength(1);
		expect(storedAfter[0]).toMatchObject({
			id,
			title: "Zahnarzt verschoben",
			time: "16:00",
		});
		expect(screen.getByTestId("entry-time")).toHaveTextContent("16:00");
	});

	it("records a chime with the microphone and stores it on the entry", async () => {
		// Microphone flow is promise-driven; real timers let the async chain settle.
		vi.useRealTimers();
		render(App);
		await fireEvent.click(screen.getByTestId("add-entry-toggle"));
		await fireEvent.click(screen.getByTestId("extra-chime-toggle"));
		await fireEvent.click(screen.getByTestId("chime-record"));
		expect(screen.getByTestId("chime-record")).toHaveAttribute("aria-pressed", "true");
		await fireEvent.click(screen.getByTestId("chime-record"));

		await waitFor(() => {
			expect(screen.getByTestId("chime-name")).toHaveTextContent("Eigene Aufnahme");
		});
		await fireEvent.input(screen.getByTestId("add-entry-title"), {
			target: { value: "Weckruf" },
		});
		await fireEvent.click(screen.getByTestId("add-entry-submit"));

		const stored = JSON.parse(localStorage.getItem(StorageKey.Entries) ?? "[]") as Array<{
			chimeSource: string;
			chimeDataUrl: string;
		}>;
		expect(stored[0]?.chimeSource).toBe("recorded");
		// Own recordings must be REAL WAV, not WebM under a .wav name (iOS stays silent otherwise).
		expect(stored[0]?.chimeDataUrl).toMatch(/^data:audio\/wav/);
		expect(fakeTrack.stop).toHaveBeenCalled();
	});

	it("a codec fallback is not shown as an error and the stop button resets", async () => {
		// AudioContext exists but decodeAudioData rejects (e.g. iOS audio/mp4 codec gap).
		vi.stubGlobal(
			"AudioContext",
			class {
				decodeAudioData = vi.fn().mockRejectedValue(new Error("cannot-decode"));
				close = vi.fn().mockResolvedValue(undefined);
			},
		);
		render(App);
		await fireEvent.click(screen.getByTestId("add-entry-toggle"));
		await fireEvent.click(screen.getByTestId("extra-chime-toggle"));
		await fireEvent.click(screen.getByTestId("chime-record"));
		await fireEvent.click(screen.getByTestId("chime-record"));
		await waitFor(() => {
			expect(screen.getByTestId("chime-name")).toHaveTextContent("Eigene Aufnahme");
		});
		// The error must NOT claim the microphone is unavailable.
		expect(screen.queryByText(/Mikrofon nicht verfuegbar/)).not.toBeInTheDocument();
		expect(screen.queryByTestId("chime-error")).not.toBeInTheDocument();
		await fireEvent.input(screen.getByTestId("add-entry-title"), {
			target: { value: "Fallback Aufnahme" },
		});
		await fireEvent.click(screen.getByTestId("add-entry-submit"));
		const stored = JSON.parse(localStorage.getItem(StorageKey.Entries) ?? "[]") as Array<{
			chimeDataUrl: string;
		}>;
		expect(stored[0]?.chimeDataUrl.startsWith("data:")).toBe(true);
	});

	it("reports clearly when the microphone is unavailable", async () => {
		vi.stubGlobal("MediaRecorder", undefined);
		render(App);
		await fireEvent.click(screen.getByTestId("add-entry-toggle"));
		await fireEvent.click(screen.getByTestId("extra-chime-toggle"));
		await fireEvent.click(screen.getByTestId("chime-record"));
		expect(screen.getByTestId("chime-error")).toHaveTextContent("Mikrofon nicht verfuegbar");
	});

	it("has no global chime toggle - the chime belongs to each entry", () => {
		render(App);
		expect(screen.queryByTestId("chime-toggle")).not.toBeInTheDocument();
	});

	it("hides the own-chime options until the per-entry toggle is switched on", async () => {
		render(App);
		await fireEvent.click(screen.getByTestId("add-entry-toggle"));
		expect(screen.queryByTestId("chime-record")).not.toBeInTheDocument();
		expect(screen.queryByTestId("chime-custom")).not.toBeInTheDocument();
		expect(screen.getByTestId("extra-chime-toggle")).toHaveAttribute("aria-pressed", "false");
		await fireEvent.click(screen.getByTestId("extra-chime-toggle"));
		expect(screen.getByTestId("extra-chime-toggle")).toHaveAttribute("aria-pressed", "true");
		expect(screen.getByTestId("chime-record")).toBeInTheDocument();
		expect(screen.getByTestId("chime-custom")).toBeInTheDocument();
	});

	it("async onstop (real iOS MediaRecorder) must not trigger a second stop()", async () => {
		// iOS fires onstop on a later task while `state` is still "recording".
		// releaseRecorder() then calls stop() AGAIN -> InvalidStateError -> false
		// "microphone unavailable". Reproduce with a deferred onstop.
		class AsyncStopRecorder {
			state: RecordingState = "inactive";
			ondataavailable: ((e: { data: BlobPart }) => void) | null = null;
			onstop: (() => void) | null = null;
			start(): void {
				this.state = "recording";
			}
			stop(): void {
				if (this.state !== "recording") throw new Error("InvalidStateError");
				setTimeout(() => {
					this.state = "inactive";
					this.ondataavailable?.({ data: new Blob(["rec"], { type: "audio/webm" }) });
					this.onstop?.();
				}, 0);
			}
		}
		vi.stubGlobal("MediaRecorder", AsyncStopRecorder);
		render(App);
		await fireEvent.click(screen.getByTestId("add-entry-toggle"));
		await fireEvent.click(screen.getByTestId("extra-chime-toggle"));
		await fireEvent.click(screen.getByTestId("chime-record"));
		await fireEvent.click(screen.getByTestId("chime-record")); // STOP
		await waitFor(() => {
			expect(screen.getByTestId("chime-name")).toHaveTextContent("Eigene Aufnahme");
		});
		expect(screen.queryByText(/Mikrofon nicht verfuegbar/)).not.toBeInTheDocument();
	});

	it("STOP while getUserMedia is still pending does not throw or discard the clip", async () => {
		// Slow permission prompt: user taps STOP before the recorder exists.
		let resolveStream: ((s: unknown) => void) | undefined;
		const slowStream = new Promise((resolve) => {
			resolveStream = resolve;
		});
		vi.stubGlobal("navigator", {
			...navigator,
			mediaDevices: { getUserMedia: vi.fn(() => slowStream) },
		});
		render(App);
		await fireEvent.click(screen.getByTestId("add-entry-toggle"));
		await fireEvent.click(screen.getByTestId("extra-chime-toggle"));
		await fireEvent.click(screen.getByTestId("chime-record")); // start
		await fireEvent.click(screen.getByTestId("chime-record")); // stop BEFORE stream resolves
		resolveStream?.(fakeStream);
		await waitFor(() => {
			expect(screen.getByTestId("chime-name")).toHaveTextContent("Eigene Aufnahme");
		});
		expect(screen.queryByText(/Mikrofon nicht verfuegbar/)).not.toBeInTheDocument();
	});

	it("stopping a recording does NOT report a microphone error (double-stop guard)", async () => {
		// Real MediaRecorder throws InvalidStateError if stop() is called twice.
		// releaseRecorder() used to do exactly that after toggleRecording() stopped it.
		class StrictRecorder {
			state: RecordingState = "inactive";
			ondataavailable: ((e: { data: BlobPart }) => void) | null = null;
			onstop: (() => void) | null = null;
			start(): void {
				this.state = "recording";
			}
			stop(): void {
				if (this.state !== "recording") throw new Error("InvalidStateError");
				this.state = "inactive";
				this.ondataavailable?.({ data: new Blob(["rec"], { type: "audio/webm" }) });
				this.onstop?.();
			}
		}
		vi.stubGlobal("MediaRecorder", StrictRecorder);
		render(App);
		await fireEvent.click(screen.getByTestId("add-entry-toggle"));
		await fireEvent.click(screen.getByTestId("extra-chime-toggle"));
		await fireEvent.click(screen.getByTestId("chime-record"));
		await fireEvent.click(screen.getByTestId("chime-record")); // STOP
		await waitFor(() => {
			expect(screen.getByTestId("chime-name")).toHaveTextContent("Eigene Aufnahme");
		});
		expect(screen.queryByText(/Mikrofon nicht verfuegbar/)).not.toBeInTheDocument();
		expect(screen.queryByTestId("chime-error")).not.toBeInTheDocument();
	});

	it("lets a NEW recording replace the chime while EDITING an existing entry", async () => {
		localStorage.setItem(
			StorageKey.Entries,
			JSON.stringify([
				makeEntry({
					id: "edit-me",
					iso: "2026-11-20",
					time: "10:00",
					title: "Bestehender Termin",
					extraChime: false,
				}),
			]),
		);
		render(App);
		await fireEvent.click(screen.getByTestId("entry-edit-edit-me"));
		await fireEvent.click(screen.getByTestId("extra-chime-toggle"));
		await fireEvent.click(screen.getByTestId("chime-record"));
		await fireEvent.click(screen.getByTestId("chime-record"));
		await waitFor(() => {
			expect(screen.getByTestId("chime-name")).toHaveTextContent("Eigene Aufnahme");
		});
		await fireEvent.click(screen.getByTestId("add-entry-submit"));
		const stored = JSON.parse(localStorage.getItem(StorageKey.Entries) ?? "[]") as Array<{
			id: string;
			extraChime: boolean;
			chimeSource: string;
			chimeDataUrl: string;
		}>;
		expect(stored).toHaveLength(1);
		expect(stored[0]?.id).toBe("edit-me");
		expect(stored[0]?.extraChime).toBe(true);
		expect(stored[0]?.chimeSource).toBe("recorded");
		expect(stored[0]?.chimeDataUrl.startsWith("data:")).toBe(true);
	});

	it("re-activating the toggle immediately restores the chosen own chime", async () => {
		render(App);
		await fireEvent.click(screen.getByTestId("add-entry-toggle"));
		await fireEvent.click(screen.getByTestId("extra-chime-toggle"));
		await fireEvent.click(screen.getByTestId("chime-record"));
		await fireEvent.click(screen.getByTestId("chime-record"));
		await waitFor(() => {
			expect(screen.getByTestId("chime-name")).toHaveTextContent("Eigene Aufnahme");
		});
		// Gate off keeps the data (no reset), then on restores it immediately.
		await fireEvent.click(screen.getByTestId("extra-chime-toggle"));
		expect(screen.getByTestId("chime-name")).toHaveTextContent("Standard");
		await fireEvent.click(screen.getByTestId("extra-chime-toggle"));
		expect(screen.getByTestId("chime-name")).toHaveTextContent("Eigene Aufnahme");
	});

	it("shows a clear hint when the toggle is on but no own chime was chosen", async () => {
		render(App);
		await fireEvent.click(screen.getByTestId("add-entry-toggle"));
		await fireEvent.click(screen.getByTestId("extra-chime-toggle"));
		expect(screen.getByTestId("chime-empty-hint")).toBeInTheDocument();
	});

	it("persists the extraChime flag on the created entry", async () => {
		render(App);
		await fireEvent.click(screen.getByTestId("add-entry-toggle"));
		await fireEvent.input(screen.getByTestId("add-entry-title"), {
			target: { value: "Mit Extraton" },
		});
		await fireEvent.click(screen.getByTestId("extra-chime-toggle"));
		await fireEvent.click(screen.getByTestId("add-entry-submit"));
		const stored = JSON.parse(localStorage.getItem(StorageKey.Entries) ?? "[]") as Array<{
			extraChime: boolean;
		}>;
		expect(stored[0]?.extraChime).toBe(true);
	});

	it("keeps a chosen own chime when the toggle is switched off and on again", async () => {
		render(App);
		await fireEvent.click(screen.getByTestId("add-entry-toggle"));
		await fireEvent.click(screen.getByTestId("extra-chime-toggle"));
		await fireEvent.click(screen.getByTestId("chime-youtube"));
		await fireEvent.input(screen.getByTestId("chime-youtube-url"), {
			target: { value: "https://youtu.be/dQw4w9WgXcQ" },
		});
		await fireEvent.click(screen.getByTestId("chime-youtube-apply"));
		await fireEvent.click(screen.getByTestId("extra-chime-toggle"));
		await fireEvent.click(screen.getByTestId("extra-chime-toggle"));
		expect(screen.getByTestId("chime-name")).toHaveTextContent("dQw4w9WgXcQ");
	});

	it("shows the default chime and lets the user pick a YouTube url", async () => {
		render(App);
		await fireEvent.click(screen.getByTestId("add-entry-toggle"));
		expect(screen.getByTestId("chime-name")).toHaveTextContent("Standard");
		await fireEvent.click(screen.getByTestId("extra-chime-toggle"));
		await fireEvent.click(screen.getByTestId("chime-youtube"));
		expect(screen.getByTestId("chime-youtube-url")).toBeInTheDocument();
		await fireEvent.input(screen.getByTestId("chime-youtube-url"), {
			target: { value: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
		});
		await fireEvent.click(screen.getByTestId("chime-youtube-apply"));
		expect(screen.getByTestId("chime-name")).toHaveTextContent("dQw4w9WgXcQ");
	});

	it("rejects an invalid YouTube url", async () => {
		render(App);
		await fireEvent.click(screen.getByTestId("add-entry-toggle"));
		await fireEvent.click(screen.getByTestId("extra-chime-toggle"));
		await fireEvent.click(screen.getByTestId("chime-youtube"));
		await fireEvent.input(screen.getByTestId("chime-youtube-url"), {
			target: { value: "https://vimeo.com/123" },
		});
		await fireEvent.click(screen.getByTestId("chime-youtube-apply"));
		expect(screen.getByTestId("chime-error")).toHaveTextContent("Keine gueltige YouTube-URL.");
	});

	it("toggles the YouTube preview on and off", async () => {
		render(App);
		await fireEvent.click(screen.getByTestId("add-entry-toggle"));
		await fireEvent.click(screen.getByTestId("extra-chime-toggle"));
		await fireEvent.click(screen.getByTestId("chime-youtube"));
		await fireEvent.input(screen.getByTestId("chime-youtube-url"), {
			target: { value: "https://youtu.be/dQw4w9WgXcQ" },
		});
		await fireEvent.click(screen.getByTestId("chime-youtube-apply"));
		await fireEvent.click(screen.getByTestId("chime-preview"));
		expect(screen.getByTestId("youtube-preview")).toBeInTheDocument();
		await fireEvent.click(screen.getByTestId("chime-preview"));
		expect(screen.queryByTestId("youtube-preview")).not.toBeInTheDocument();
	});

	it("toggles the theme", async () => {
		render(App);
		await fireEvent.click(screen.getByTestId("theme-toggle"));
		expect(document.documentElement.classList.contains("dark")).toBe(true);
		expect(localStorage.getItem(StorageKey.Theme)).toBe(Theme.Dark);
	});

	it("offers calendar providers without a permanent calendar", () => {
		render(App);
		expect(screen.getByTestId(`provider-${CalendarProvider.ICal}`)).toHaveAttribute(
			"aria-pressed",
			"true",
		);
	});

	it("opens the connection modal that reports missing credentials", async () => {
		render(App);
		await fireEvent.click(screen.getByTestId(`provider-${CalendarProvider.Google}`));
		await fireEvent.click(screen.getByTestId("open-connection"));
		expect(screen.getByTestId("connection-modal")).toBeInTheDocument();
		expect(screen.getByTestId("missing-fields")).toHaveTextContent("VITE_GOOGLE_CLIENT_ID");
		await fireEvent.click(screen.getByTestId("modal-close"));
		expect(screen.queryByTestId("connection-modal")).not.toBeInTheDocument();
	});

	it("keeps the native calendar link when an entry is edited", async () => {
		localStorage.setItem(
			StorageKey.Entries,
			JSON.stringify([
				{
					id: "linked",
					iso: "2026-11-12",
					time: "09:00",
					title: "Verknuepft",
					category: EntryCategory.Event,
					note: "",
					chimeSource: "default",
					chimeName: "Standard (Saraba)",
					chimeDataUrl: "",
					externalId: "EK-LINK-1",
				},
			]),
		);
		render(App);
		await fireEvent.click(screen.getByTestId("past-show"));
		await fireEvent.click(screen.getByTestId("entry-edit-linked"));
		await fireEvent.input(screen.getByTestId("add-entry-title"), {
			target: { value: "Umbenannt" },
		});
		await fireEvent.click(screen.getByTestId("add-entry-submit"));
		const saved = JSON.parse(localStorage.getItem(StorageKey.Entries) ?? "[]") as Array<{
			externalId?: string;
		}>;
		expect(saved[0]?.externalId).toBe("EK-LINK-1");
	});

	it("keeps a newly created entry when the native calendar import resolves later", async () => {
		render(App);
		await fireEvent.click(screen.getByTestId("past-show"));
		await fireEvent.click(screen.getByTestId("add-entry-toggle"));
		await fireEvent.input(screen.getByTestId("add-entry-title"), {
			target: { value: "Waehrend Import angelegt" },
		});
		await fireEvent.click(screen.getByTestId("add-entry-submit"));
		expect(screen.getByText("Waehrend Import angelegt")).toBeInTheDocument();

		// The EventKit import finishes AFTER the user created the entry.
		importGate.resolve?.([
			{
				id: "EK-1",
				iso: "2026-11-20",
				time: "10:00",
				title: "Vom Geraet",
				category: "event",
				note: "",
				chimeSource: "default",
				chimeName: "Standard (Saraba)",
				chimeDataUrl: "",
				externalId: "EK-1",
			},
		]);
		await waitFor(() => expect(screen.getByText("Vom Geraet")).toBeInTheDocument());
		expect(screen.getByText("Waehrend Import angelegt")).toBeInTheDocument();
	});

	it("keeps BOTH filter selections across a restart (period + holidays)", async () => {
		render(App);
		await fireEvent.click(screen.getByTestId("period-week"));
		await fireEvent.click(screen.getByTestId("holidays-without"));
		expect(screen.getByTestId("period-week")).toHaveAttribute("aria-pressed", "true");
		expect(screen.getByTestId("holidays-without")).toHaveAttribute("aria-pressed", "true");

		// Cold restart: a completely fresh component instance.
		cleanup();
		render(App);
		expect(screen.getByTestId("period-week")).toHaveAttribute("aria-pressed", "true");
		expect(screen.getByTestId("holidays-without")).toHaveAttribute("aria-pressed", "true");
	});

	it("shows a progress bar with percent to the next event", async () => {
		localStorage.setItem(
			StorageKey.Entries,
			JSON.stringify([
				makeEntry({ id: "past", iso: "2026-11-12", time: "08:05", title: "Anker" }),
				makeEntry({ id: "next", iso: "2026-11-12", time: "10:05", title: "Naechster" }),
			]),
		);
		// The anchor is computed once on mount from the visible selection, so
		// seed the persisted view BEFORE mounting to exercise the 50 % case.
		localStorage.setItem("clock.list.past.v1", "show");
		render(App);
		const bar = screen.getByTestId("next-event-progress");
		expect(bar).toBeInTheDocument();
		expect(screen.getByTestId("next-event-bar")).toHaveAttribute("aria-valuenow", "50");
		expect(screen.getAllByText(/Naechster/).length).toBeGreaterThan(0);

		// A cold start without a visible past anchor starts at 0 %.
		cleanup();
		localStorage.removeItem("clock.list.past.v1");
		render(App);
		expect(screen.getByTestId("next-event-bar")).toHaveAttribute("aria-valuenow", "0");
	});

	it("hides past entries by default and shows them via the toggle (persisted)", async () => {
		localStorage.setItem(
			StorageKey.Entries,
			JSON.stringify([
				makeEntry({ id: "past", iso: "2026-11-12", time: "09:00", title: "Gestern" }),
				makeEntry({ id: "future", iso: "2026-11-20", time: "09:00", title: "Bald" }),
			]),
		);
		render(App);
		expect(screen.getByTestId("past-hide")).toHaveAttribute("aria-pressed", "true");
		expect(screen.queryByText("Gestern")).not.toBeInTheDocument();
		expect(screen.getByText("Bald")).toBeInTheDocument();

		await fireEvent.click(screen.getByTestId("past-show"));
		expect(screen.getByText("Gestern")).toBeInTheDocument();

		cleanup();
		render(App);
		expect(screen.getByTestId("past-show")).toHaveAttribute("aria-pressed", "true");
		expect(screen.getByText("Gestern")).toBeInTheDocument();
	});

	it("restores a CHANGED sort selection on the next start (from the new initial view)", async () => {
		// Start from the fresh initial view (Day / Without / Hide).
		localStorage.removeItem(StorageKey.ListPeriod);
		localStorage.removeItem(StorageKey.ListHolidays);
		localStorage.removeItem(StorageKey.ListPast);
		render(App);
		expect(screen.getByTestId("period-day")).toHaveAttribute("aria-pressed", "true");
		expect(screen.getByTestId("holidays-without")).toHaveAttribute("aria-pressed", "true");

		// The user changes BOTH sort options.
		await fireEvent.click(screen.getByTestId("period-month"));
		await fireEvent.click(screen.getByTestId("holidays-with"));
		expect(screen.getByTestId("period-month")).toHaveAttribute("aria-pressed", "true");
		expect(screen.getByTestId("holidays-with")).toHaveAttribute("aria-pressed", "true");

		// Cold restart: the changed selection must win over the initial default.
		cleanup();
		render(App);
		expect(screen.getByTestId("period-month")).toHaveAttribute("aria-pressed", "true");
		expect(screen.getByTestId("holidays-with")).toHaveAttribute("aria-pressed", "true");
		expect(screen.getByTestId("period-day")).toHaveAttribute("aria-pressed", "false");
	});

	it("renders entries after the async storage init completes", async () => {
		localStorage.setItem(
			StorageKey.Entries,
			JSON.stringify([
				makeEntry({ id: "after-init", title: "Nach Init", iso: "2026-11-13", time: "18:00" }),
			]),
		);
		render(App);
		expect(await screen.findByText("Nach Init")).toBeInTheDocument();
	});

	it("presets a NEW entry to the current time but keeps the stored time when editing", async () => {
		const now = new Date();
		vi.setSystemTime(now);
		const expected = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
		localStorage.setItem(
			StorageKey.Entries,
			JSON.stringify([
				makeEntry({ id: "old", iso: "2026-11-20", time: "07:15", title: "Alter Termin" }),
			]),
		);
		render(App);
		await fireEvent.click(screen.getByTestId("add-entry-toggle"));
		expect(screen.getByTestId("add-entry-time")).toHaveValue(expected);
		await fireEvent.click(screen.getByTestId("add-entry-close"));
		await fireEvent.click(screen.getByTestId("entry-edit-old"));
		expect(screen.getByTestId("add-entry-time")).toHaveValue("07:15");
	});

	it("starts in the day view WITHOUT holidays on a fresh browser", () => {
		localStorage.removeItem(StorageKey.ListPeriod);
		localStorage.removeItem(StorageKey.ListHolidays);
		localStorage.removeItem(StorageKey.ListPast);
		render(App);
		expect(screen.getByTestId("period-day")).toHaveAttribute("aria-pressed", "true");
		expect(screen.getByTestId("holidays-without")).toHaveAttribute("aria-pressed", "true");
		expect(screen.getByTestId("past-hide")).toHaveAttribute("aria-pressed", "true");
	});

	it("filters the list by period (day/week/month/all)", async () => {
		localStorage.setItem(
			StorageKey.Entries,
			JSON.stringify([
				makeEntry({ id: "d", iso: "2026-11-12", time: "09:00", title: "Heute" }),
				makeEntry({ id: "m", iso: "2026-11-28", time: "09:00", title: "Im Monat" }),
				makeEntry({ id: "f", iso: "2026-12-05", time: "09:00", title: "Naechster Monat" }),
			]),
		);
		render(App);
		expect(screen.getByTestId("list-filter")).toBeInTheDocument();
		expect(screen.getByText("Naechster Monat")).toBeInTheDocument();

		await fireEvent.click(screen.getByTestId("period-month"));
		expect(screen.queryByText("Naechster Monat")).not.toBeInTheDocument();
		expect(screen.getByText("Im Monat")).toBeInTheDocument();

		await fireEvent.click(screen.getByTestId("period-all"));
		expect(screen.getByText("Naechster Monat")).toBeInTheDocument();
	});

	it("hides an IMPORTED holiday (subscribed calendar) via the toggle too", async () => {
		localStorage.setItem(
			StorageKey.Entries,
			JSON.stringify([
				makeEntry({
					id: "volkstrauertag",
					iso: "2026-11-15",
					time: "00:00",
					title: "Volkstrauertag",
					isHoliday: true,
				}),
				makeEntry({ id: "normal", iso: "2026-11-15", time: "10:00", title: "Normaler Termin" }),
			]),
		);
		render(App);
		expect(screen.getByTestId("entry-holiday")).toHaveTextContent("Volkstrauertag");
		expect(screen.getByText("Volkstrauertag")).toBeInTheDocument();

		await fireEvent.click(screen.getByTestId("holidays-without"));
		expect(screen.queryByText("Volkstrauertag")).not.toBeInTheDocument();
		expect(screen.getByText("Normaler Termin")).toBeInTheDocument();
		// The ticker must not point at an event the filter just hid.
		expect(screen.queryByTestId("next-event-progress")).toHaveTextContent("Normaler Termin");
	});

	it("hides and shows holidays via the toggle", async () => {
		localStorage.setItem(
			StorageKey.Entries,
			JSON.stringify([
				makeEntry({ id: "h", iso: "2026-12-25", time: "09:00", title: "Weihnachten" }),
				makeEntry({ id: "n", iso: "2026-12-24", time: "09:00", title: "Heiligabend" }),
			]),
		);
		render(App);
		expect(screen.getByTestId("entry-holiday")).toBeInTheDocument();

		await fireEvent.click(screen.getByTestId("holidays-without"));
		expect(screen.queryByText("Weihnachten")).not.toBeInTheDocument();
		expect(screen.getByText("Heiligabend")).toBeInTheDocument();

		await fireEvent.click(screen.getByTestId("holidays-with"));
		expect(screen.getByText("Weihnachten")).toBeInTheDocument();
	});

	it("keeps a new entry when the calendar sync writes externalIds back late", async () => {
		render(App);
		await fireEvent.click(screen.getByTestId("past-show"));
		await fireEvent.click(screen.getByTestId("add-entry-toggle"));
		await fireEvent.input(screen.getByTestId("add-entry-title"), {
			target: { value: "Sync Race" },
		});
		await fireEvent.click(screen.getByTestId("add-entry-submit"));
		expect(screen.getByText("Sync Race")).toBeInTheDocument();

		// The native calendar import resolves after creation and arms the snapshot.
		importGate.resolve?.([]);
		await waitFor(() => expect(screen.getByText("Sync Race")).toBeInTheDocument());

		// Cold restart: the entry must still be in localStorage.
		expect(localStorage.getItem(StorageKey.Entries)).toContain("Sync Race");
		cleanup();
		render(App);
		expect(screen.getByText("Sync Race")).toBeInTheDocument();
	});

	it("persists a new entry SYNCHRONOUSLY (survives an immediate app kill / restart)", async () => {
		render(App);
		await fireEvent.click(screen.getByTestId("past-show"));
		await fireEvent.click(screen.getByTestId("add-entry-toggle"));
		await fireEvent.input(screen.getByTestId("add-entry-title"), {
			target: { value: "Ueberlebt Neustart" },
		});
		await fireEvent.click(screen.getByTestId("add-entry-submit"));

		// No extra await/tick: iOS can suspend the app the instant the modal closes.
		const raw = localStorage.getItem(StorageKey.Entries);
		expect(raw).toContain("Ueberlebt Neustart");

		// Simulate a cold restart: a fresh component must load it again.
		cleanup();
		render(App);
		await fireEvent.click(screen.getByTestId("past-show"));
		expect(screen.getByText("Ueberlebt Neustart")).toBeInTheDocument();
	});

	it("stops the alarm chime when the dialog is cancelled", async () => {
		localStorage.setItem(
			StorageKey.Entries,
			JSON.stringify([
				makeEntry({
					id: "ringing",
					iso: "2026-11-12",
					time: "09:05",
					extraChime: true,
					chimeSource: ChimeSource.Recorded,
					chimeDataUrl: "data:audio/webm;base64,REC",
				}),
			]),
		);
		render(App);
		vi.advanceTimersByTime(TICK_INTERVAL_MS);
		await waitFor(() => expect(screen.getByTestId("alarm-dialog")).toBeInTheDocument());
		await fireEvent.click(screen.getByTestId("alarm-cancel"));
		expect(screen.queryByTestId("alarm-dialog")).not.toBeInTheDocument();
	});

	it("imports events from an .ics file", async () => {
		render(App);
		const ics = [
			"BEGIN:VCALENDAR",
			"BEGIN:VEVENT",
			"UID:import-1@example.com",
			"DTSTART:20261120T100000Z",
			"SUMMARY:Importierter Termin",
			"END:VEVENT",
			"END:VCALENDAR",
		].join("\r\n");
		const file = new File([ics], "termine.ics", { type: "text/calendar" });
		await fireEvent.change(screen.getByTestId("sync-import"), { target: { files: [file] } });
		expect(await screen.findByText("Importierter Termin")).toBeInTheDocument();
		expect(screen.getByTestId("entry-time")).toHaveTextContent("11:00");
	});

	it("imports an .ics with repeated UIDs only once (no duplicate list keys)", async () => {
		render(App);
		const vevent = [
			"BEGIN:VEVENT",
			"UID:dup@example.com",
			"DTSTART:20261120T100000Z",
			"SUMMARY:Wiederkehrender Termin",
			"END:VEVENT",
		].join("\r\n");
		const ics = ["BEGIN:VCALENDAR", vevent, vevent, "END:VCALENDAR"].join("\r\n");
		const file = new File([ics], "dup.ics", { type: "text/calendar" });
		await fireEvent.change(screen.getByTestId("sync-import"), { target: { files: [file] } });
		await screen.findByText("Wiederkehrender Termin");
		expect(screen.getAllByText("Wiederkehrender Termin")).toHaveLength(1);
	});
});
