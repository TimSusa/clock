/**
 * One async persistence interface for the whole app. Web (PWA/jsdom) uses
 * localStorage; native shells use @capacitor/preferences. Async by design so
 * both backends share exactly the same call sites.
 *
 * The native bridge is INJECTED (never imported a second time here) - a second
 * dynamic import of a Capacitor plugin was the root cause of the alarm bug.
 */
export interface StoragePort {
	get(key: string): Promise<string | null>;
	set(key: string, value: string): Promise<void>;
	remove(key: string): Promise<void>;
}

/** Minimal shape of @capacitor/preferences' Preferences object. */
export interface PreferencesBridge {
	get(options: { key: string }): Promise<{ value: string | null }>;
	set(options: { key: string; value: string }): Promise<void>;
	remove(options: { key: string }): Promise<void>;
}

/** Web / PWA / test backend backed by window.localStorage. */
export class WebStoragePort implements StoragePort {
	async get(key: string): Promise<string | null> {
		return localStorage.getItem(key);
	}

	async set(key: string, value: string): Promise<void> {
		localStorage.setItem(key, value);
	}

	async remove(key: string): Promise<void> {
		localStorage.removeItem(key);
	}
}

/** iOS UserDefaults / Android SharedPreferences via @capacitor/preferences. */
export class NativeStoragePort implements StoragePort {
	constructor(private readonly preferences: PreferencesBridge) {}

	async get(key: string): Promise<string | null> {
		const { value } = await this.preferences.get({ key });
		return value;
	}

	async set(key: string, value: string): Promise<void> {
		await this.preferences.set({ key, value });
	}

	async remove(key: string): Promise<void> {
		await this.preferences.remove({ key });
	}
}

/**
 * One-time upgrade from WebView localStorage to native Preferences. Runs only
 * for the native port: existing entries must survive the update, but a value
 * already stored natively always wins (never clobber newer data).
 */
export async function migrateLegacyStorage(
	target: StoragePort,
	keys: readonly string[],
): Promise<void> {
	if (!(target instanceof NativeStoragePort)) return;
	for (const key of keys) {
		const legacy = localStorage.getItem(key);
		if (legacy === null) continue;
		const existing = await target.get(key);
		if (existing === null) await target.set(key, legacy);
		localStorage.removeItem(key);
	}
}

/**
 * Synchronous read/write facade. App.svelte loads all StorageKeys ONCE at
 * startup (await) into this cache; the rest of the app keeps its synchronous
 * APIs, so no component or test needs to become async. Writes mirror into the
 * native port fire-and-forget - a slow UserDefaults write never blocks the UI.
 */
let activePort: StoragePort = new WebStoragePort();
const cache = new Map<string, string>();

export function setActiveStorage(port: StoragePort): void {
	activePort = port;
	cache.clear();
}

/** Load one key into the cache at startup. */
export async function primeStorage(keys: readonly string[]): Promise<void> {
	for (const key of keys) {
		const value = await activePort.get(key);
		if (value !== null) cache.set(key, value);
	}
}

export function readCached(key: string): string | null {
	// On the web localStorage IS the port: read it directly so direct seeds,
	// beforeEach(localStorage.clear()) and existing tests behave unchanged.
	if (activePort instanceof WebStoragePort) return localStorage.getItem(key);
	return cache.get(key) ?? null;
}

export function writeCached(key: string, value: string): void {
	cache.set(key, value);
	if (activePort instanceof WebStoragePort) {
		localStorage.setItem(key, value);
		return;
	}
	void activePort.set(key, value).catch(() => {});
}

export function removeCached(key: string): void {
	cache.delete(key);
	void activePort.remove(key).catch(() => {});
}

/**
 * Called ONCE at app startup: activate the port, migrate legacy localStorage
 * data (native only), then load every key into the synchronous cache. On the
 * web the port is localStorage itself, so the migration is a no-op and the
 * cache is not used for reads.
 */
export async function initStorage(port: StoragePort, keys: readonly string[]): Promise<void> {
	setActiveStorage(port);
	await migrateLegacyStorage(port, keys);
	await primeStorage(keys);
}

/** Single factory: App.svelte injects the already-imported Preferences object. */
export async function createStoragePort(
	preferences: PreferencesBridge | null,
): Promise<StoragePort> {
	return preferences ? new NativeStoragePort(preferences) : new WebStoragePort();
}
