import { describe, expect, it } from "vitest";
import { makeEntry } from "../test/fixtures";
import { exportIcs } from "./ical";

describe("exportIcs uses the current entry state", () => {
	it("writes an edited title into SUMMARY", () => {
		const edited = makeEntry({ id: "a", title: "Neuer Titel" });
		const ics = exportIcs([edited]);
		expect(ics).toContain("SUMMARY:Neuer Titel");
		expect(ics).not.toContain("SUMMARY:Termin");
	});

	it("writes each entry's own title", () => {
		const ics = exportIcs([
			makeEntry({ id: "a", title: "Alpha" }),
			makeEntry({ id: "b", title: "Beta", iso: "2026-12-24", time: "18:00" }),
		]);
		expect(ics).toContain("SUMMARY:Alpha");
		expect(ics).toContain("SUMMARY:Beta");
	});

	it("escapes an edited title with a comma", () => {
		const ics = exportIcs([makeEntry({ id: "a", title: "A, B" })]);
		expect(ics).toContain("SUMMARY:A\\, B");
	});
});
