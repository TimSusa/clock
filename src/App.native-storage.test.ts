import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import App from "./App.svelte";
import { StorageKey } from "./lib/enums";
import { makeEntry } from "./test/fixtures";

const data = vi.hoisted(() => new Map<string, string>());

vi.mock("./lib/native-shell", () => ({ isNativeShell: () => true }));
vi.mock("@capacitor/local-notifications", () => ({
	LocalNotifications: {
		checkPermissions: vi.fn().mockResolvedValue({ display: "granted" }),
		requestPermissions: vi.fn().mockResolvedValue({ display: "granted" }),
		registerActionTypes: vi.fn().mockResolvedValue(undefined),
		addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
		getPending: vi.fn().mockResolvedValue({ notifications: [] }),
		cancel: vi.fn().mockResolvedValue(undefined),
		schedule: vi.fn().mockResolvedValue(undefined),
	},
}));
vi.mock("@capacitor/preferences", () => ({
	Preferences: {
		get: vi.fn(async ({ key }: { key: string }) => ({ value: data.get(key) ?? null })),
		set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
			data.set(key, value);
		}),
		remove: vi.fn(async ({ key }: { key: string }) => {
			data.delete(key);
		}),
	},
}));
vi.mock("./lib/native-calendar-port", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./lib/native-calendar-port")>();
	return {
		...actual,
		createCalendarPort: vi.fn(async () => ({
			requestPermissions: vi.fn().mockResolvedValue(false),
			listEvents: vi.fn().mockResolvedValue([]),
			createEvent: vi.fn().mockResolvedValue("EK"),
			modifyEvent: vi.fn().mockResolvedValue(undefined),
			deleteEvents: vi.fn().mockResolvedValue(undefined),
		})),
	};
});

describe("App - native storage init", () => {
	it("starts in a loading state and shows stored entries after the async init", async () => {
		data.set(
			StorageKey.Entries,
			JSON.stringify([
				makeEntry({ id: "native-init", title: "Nativ geladen", iso: "2026-11-13", time: "18:00" }),
			]),
		);
		render(App);
		expect(screen.getByTestId("storage-loading")).toBeInTheDocument();
		expect(await screen.findByText("Nativ geladen")).toBeInTheDocument();
	});
});
