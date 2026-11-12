import { beforeEach, describe, expect, it } from "vitest";
import { StorageKey, Theme } from "./enums";
import { loadPreferences, savePreferences } from "./preferences";

describe("preferences", () => {
	beforeEach(() => localStorage.clear());

	it("returns the documented default when storage is empty", () => {
		expect(loadPreferences()).toEqual({ theme: Theme.Light });
	});

	it("round-trips a dark selection", () => {
		savePreferences({ theme: Theme.Dark });
		expect(loadPreferences()).toEqual({ theme: Theme.Dark });
	});

	it("falls back to the default on an invalid stored value", () => {
		localStorage.setItem(StorageKey.Theme, "neon");
		expect(loadPreferences()).toEqual({ theme: Theme.Light });
	});
});
