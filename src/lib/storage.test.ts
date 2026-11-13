import { beforeEach, describe, expect, it, vi } from "vitest";
import { StorageKey } from "./enums";
import {
	createStoragePort,
	initStorage,
	migrateLegacyStorage,
	NativeStoragePort,
	readCached,
	setActiveStorage,
	WebStoragePort,
	writeCached,
} from "./storage";

describe("WebStoragePort", () => {
	let port: WebStoragePort;

	beforeEach(() => {
		localStorage.clear();
		port = new WebStoragePort();
	});

	it("returns null for a missing key", async () => {
		expect(await port.get("clock.theme.v1")).toBeNull();
	});

	it("round-trips a value", async () => {
		await port.set("clock.theme.v1", "dark");
		expect(await port.get("clock.theme.v1")).toBe("dark");
	});

	it("removes a value", async () => {
		await port.set("clock.theme.v1", "dark");
		await port.remove("clock.theme.v1");
		expect(await port.get("clock.theme.v1")).toBeNull();
	});
});

/** Minimal shape of @capacitor/preferences, injected so tests stay pure. */
function preferences() {
	const data = new Map<string, string>();
	return {
		get: vi.fn(async ({ key }: { key: string }) => ({ value: data.get(key) ?? null })),
		set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
			data.set(key, value);
		}),
		remove: vi.fn(async ({ key }: { key: string }) => {
			data.delete(key);
		}),
	};
}

describe("NativeStoragePort", () => {
	it("round-trips a value through the injected Preferences bridge", async () => {
		const pref = preferences();
		const port = new NativeStoragePort(pref);
		await port.set("clock.theme.v1", "dark");
		expect(await port.get("clock.theme.v1")).toBe("dark");
		expect(pref.set).toHaveBeenCalledWith({ key: "clock.theme.v1", value: "dark" });
	});

	it("returns null for a missing key", async () => {
		const port = new NativeStoragePort(preferences());
		expect(await port.get("missing")).toBeNull();
	});

	it("removes a value", async () => {
		const pref = preferences();
		const port = new NativeStoragePort(pref);
		await port.set("k", "v");
		await port.remove("k");
		expect(await port.get("k")).toBeNull();
		expect(pref.remove).toHaveBeenCalledWith({ key: "k" });
	});
});

describe("migrateLegacyStorage", () => {
	it("copies every legacy localStorage key into Preferences once", async () => {
		localStorage.setItem(StorageKey.Entries, "[1]");
		localStorage.setItem(StorageKey.Theme, "dark");
		const pref = preferences();
		const target = new NativeStoragePort(pref);

		await migrateLegacyStorage(target, Object.values(StorageKey));

		expect(await target.get(StorageKey.Entries)).toBe("[1]");
		expect(await target.get(StorageKey.Theme)).toBe("dark");
		expect(localStorage.getItem(StorageKey.Entries)).toBeNull();
	});

	it("never overwrites a value already present in Preferences", async () => {
		localStorage.setItem(StorageKey.Theme, "dark");
		const pref = preferences();
		const target = new NativeStoragePort(pref);
		await target.set(StorageKey.Theme, "light");

		await migrateLegacyStorage(target, Object.values(StorageKey));

		expect(await target.get(StorageKey.Theme)).toBe("light");
	});

	it("is a no-op on the web port (nothing native to migrate to)", async () => {
		localStorage.setItem(StorageKey.Theme, "dark");
		await migrateLegacyStorage(new WebStoragePort(), Object.values(StorageKey));
		expect(localStorage.getItem(StorageKey.Theme)).toBe("dark");
	});
});

describe("active storage cache", () => {
	it("reads a value loaded into the cache", () => {
		setActiveStorage(new WebStoragePort());
		writeCached(StorageKey.Theme, "dark");
		expect(readCached(StorageKey.Theme)).toBe("dark");
	});

	it("persists a write through the active port", async () => {
		const pref = preferences();
		setActiveStorage(new NativeStoragePort(pref));
		writeCached(StorageKey.Entries, "[1]");
		await Promise.resolve();
		expect(pref.set).toHaveBeenCalledWith({ key: StorageKey.Entries, value: "[1]" });
	});

	it("returns null for a key that was never loaded", () => {
		setActiveStorage(new WebStoragePort());
		expect(readCached("never-loaded")).toBeNull();
	});

	it("falls back to localStorage on the web port (test seeding stays visible)", () => {
		setActiveStorage(new WebStoragePort());
		localStorage.setItem("seeded", "value");
		expect(readCached("seeded")).toBe("value");
	});
});

describe("initStorage", () => {
	it("migrates legacy data, primes the cache and reads through the native port", async () => {
		localStorage.setItem(StorageKey.Theme, "dark");
		const pref = preferences();
		const port = await createStoragePort(pref);

		await initStorage(port, Object.values(StorageKey));

		expect(await pref.get({ key: StorageKey.Theme })).toEqual({ value: "dark" });
		expect(readCached(StorageKey.Theme)).toBe("dark");
	});

	it("keeps native values that already exist", async () => {
		localStorage.setItem(StorageKey.Theme, "dark");
		const pref = preferences();
		const port = await createStoragePort(pref);
		await port.set(StorageKey.Theme, "light");

		await initStorage(port, Object.values(StorageKey));

		expect(readCached(StorageKey.Theme)).toBe("light");
	});
});

describe("createStoragePort", () => {
	it("returns the web port without a native shell", async () => {
		const port = await createStoragePort(null);
		expect(port).toBeInstanceOf(WebStoragePort);
	});

	it("returns the native port when the bridge is injected", async () => {
		const port = await createStoragePort(preferences());
		expect(port).toBeInstanceOf(NativeStoragePort);
	});
});
