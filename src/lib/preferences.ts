import { StorageKey, Theme } from "./enums";
import { readCached, writeCached } from "./storage";

export interface Preferences {
	theme: Theme;
}

const DEFAULTS: Preferences = { theme: Theme.Light };

function readEnum<T extends string>(key: StorageKey, allowed: readonly T[]): T | null {
	const value = readCached(key);
	return value !== null && allowed.includes(value as T) ? (value as T) : null;
}

export function loadPreferences(): Preferences {
	return { theme: readEnum(StorageKey.Theme, Object.values(Theme)) ?? DEFAULTS.theme };
}

export function savePreferences(preferences: Preferences): void {
	writeCached(StorageKey.Theme, preferences.theme);
}
