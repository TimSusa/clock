import { describe, expect, it } from "vitest";
import { makeEntry } from "../test/fixtures";
import { internalExportText } from "./ical";
import { syncInternalExport } from "./internal-sync";

describe("syncInternalExport", () => {
	it("reflects a newly added entry without extra confirmation", () => {
		const snapshot = syncInternalExport([makeEntry({ id: "a", title: "Zahnarzt" })]);
		expect(snapshot.count).toBe(1);
		expect(snapshot.summary).toContain("Zahnarzt");
		expect(snapshot.ics).toContain("SUMMARY:Zahnarzt");
	});

	it("reflects an edited title on the next update", () => {
		const before = syncInternalExport([makeEntry({ id: "a", title: "Alt" })]);
		const after = syncInternalExport([makeEntry({ id: "a", title: "Neu" })]);
		expect(before.ics).not.toContain("SUMMARY:Neu");
		expect(after.ics).toContain("SUMMARY:Neu");
		expect(after.ics).not.toContain("SUMMARY:Alt");
	});

	it("reflects a removal", () => {
		const after = syncInternalExport([]);
		expect(after.count).toBe(0);
		expect(after.summary).toBe("");
	});

	it("carries the VALARM so exported events ring", () => {
		expect(syncInternalExport([makeEntry({ id: "a" })]).ics).toContain("BEGIN:VALARM");
	});

	it("is identical to internalExportText apart from the timestamp", () => {
		const entries = [makeEntry({ id: "a", title: "X" })];
		expect(syncInternalExport(entries, 0)).toEqual({
			...internalExportText(entries),
			updatedAt: 0,
		});
	});
});
