import { describe, expect, it } from "vitest";
import { makeEntry } from "../test/fixtures";
import { mergeImportedEvents } from "./calendar-import";

const LOCAL = makeEntry({ id: "local-1", title: "Lokal", iso: "2026-11-13", time: "09:00" });
const LINKED = { ...LOCAL, externalId: "EK-1" };

describe("mergeImportedEvents", () => {
	it("adds native events that are not yet in the local store", () => {
		const native = makeEntry({ id: "EK-NEW", title: "Vom Geraet" });
		const result = mergeImportedEvents([LOCAL], [native]);
		expect(result.map((e) => e.id)).toEqual(["local-1", "EK-NEW"]);
	});

	it("does NOT duplicate an event already linked via externalId", () => {
		const native = makeEntry({ id: "other-id", title: "Lokal" });
		const asNative = { ...native, externalId: "EK-1" };
		const result = mergeImportedEvents([LINKED], [asNative]);
		expect(result).toHaveLength(1);
		expect(result[0]?.id).toBe("local-1");
	});

	it("skips an imported event whose id already exists locally", () => {
		const result = mergeImportedEvents([LOCAL], [makeEntry({ id: "local-1" })]);
		expect(result).toHaveLength(1);
	});

	it("keeps the local entry (with its chime) as the source of truth", () => {
		const local = makeEntry({ id: "l", chimeName: "Eigene Aufnahme" });
		const result = mergeImportedEvents([local], [{ ...local, externalId: "EK-X" }]);
		expect(result[0]?.chimeName).toBe("Eigene Aufnahme");
	});

	it("upgrades an existing local entry with the fresh import's isHoliday flag", () => {
		const stale = makeEntry({ id: "EK-1", externalId: "EK-1", title: "Volkstrauertag" });
		const fresh = makeEntry({
			id: "EK-1",
			externalId: "EK-1",
			title: "Volkstrauertag",
			isHoliday: true,
		});
		const result = mergeImportedEvents([stale], [fresh]);
		expect(result).toHaveLength(1);
		expect(result[0]?.isHoliday).toBe(true);
		expect(result[0]?.title).toBe("Volkstrauertag");
	});

	it("never clears isHoliday or overwrites local data when the import has no flag", () => {
		const local = makeEntry({
			id: "EK-1",
			externalId: "EK-1",
			isHoliday: true,
			chimeName: "Eigene Aufnahme",
		});
		const fresh = makeEntry({ id: "EK-1", externalId: "EK-1" });
		const result = mergeImportedEvents([local], [fresh]);
		expect(result[0]?.isHoliday).toBe(true);
		expect(result[0]?.chimeName).toBe("Eigene Aufnahme");
	});

	it("returns the local list unchanged when there are no imports", () => {
		expect(mergeImportedEvents([LOCAL], [])).toEqual([LOCAL]);
	});

	it("collapses duplicate ids inside the native import (recurring EventKit occurrences)", () => {
		const first = makeEntry({ id: "EK-RECURRING", externalId: "EK-RECURRING", title: "Weekly" });
		const second = makeEntry({ id: "EK-RECURRING", externalId: "EK-RECURRING", title: "Weekly" });
		const third = makeEntry({ id: "EK-OTHER", externalId: "EK-OTHER", title: "Other" });
		const result = mergeImportedEvents([], [first, second, third]);
		expect(result.map((e) => e.id)).toEqual(["EK-RECURRING", "EK-OTHER"]);
	});
});
