import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.svelte";
import { CalendarProvider, EntryCategory, StorageKey, Theme } from "./lib/enums";

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
	vi.stubGlobal("Audio", FakeAudio);
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
		await fireEvent.input(screen.getByTestId("add-entry-title"), {
			target: { value: "Weg damit" },
		});
		await fireEvent.click(screen.getByTestId("add-entry-submit"));
		await fireEvent.click(screen.getByRole("button", { name: "Eintrag Weg damit loeschen" }));
		expect(screen.getByTestId("entry-empty")).toBeInTheDocument();
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
		expect(stored[0]?.chimeDataUrl).toMatch(/^data:/);
		expect(fakeTrack.stop).toHaveBeenCalled();
	});

	it("reports clearly when the microphone is unavailable", async () => {
		vi.stubGlobal("MediaRecorder", undefined);
		render(App);
		await fireEvent.click(screen.getByTestId("add-entry-toggle"));
		await fireEvent.click(screen.getByTestId("chime-record"));
		expect(screen.getByTestId("chime-error")).toHaveTextContent("Mikrofon nicht verfuegbar");
	});

	it("has no global chime toggle - the chime belongs to each entry", () => {
		render(App);
		expect(screen.queryByTestId("chime-toggle")).not.toBeInTheDocument();
	});

	it("shows the default chime and lets the user pick a YouTube url", async () => {
		render(App);
		await fireEvent.click(screen.getByTestId("add-entry-toggle"));
		expect(screen.getByTestId("chime-name")).toHaveTextContent("Standard");
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
});
