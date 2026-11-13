import { describe, expect, it } from "vitest";
import { makeEntry } from "../test/fixtures";
import { loadEntries, saveEntries, updateEntry } from "./entries";
import { StorageKey } from "./enums";

describe("externalId persistence", () => {
	it("survives a save/load round-trip", () => {
		const entry = { ...makeEntry({ id: "a" }), externalId: "EK-1" };
		saveEntries([entry]);
		expect(loadEntries()[0]?.externalId).toBe("EK-1");
		localStorage.removeItem(StorageKey.Entries);
	});

	it("is preserved when an entry is edited", () => {
		const synced = { ...makeEntry({ id: "a", title: "Alt" }), externalId: "EK-1" };
		const edited = { ...synced, title: "Neu" };
		const result = updateEntry([synced], edited);
		expect(result[0]?.externalId).toBe("EK-1");
	});

	it("keeps a legacy entry without externalId loadable", () => {
		const legacy = makeEntry({ id: "old" });
		saveEntries([legacy]);
		expect(loadEntries()[0]?.externalId).toBeUndefined();
		localStorage.removeItem(StorageKey.Entries);
	});
});
