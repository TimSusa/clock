import { describe, expect, it } from "vitest";
import { makeEntry } from "../test/fixtures";
import { exportIcs, parseIcs } from "./ical";
import type { CalendarEntry } from "./types";

function entry(id: string, iso: string, time: string, title: string): CalendarEntry {
	return makeEntry({ id, iso, time, title });
}

const entries: readonly CalendarEntry[] = [
	entry("a", "2026-11-12", "09:05", "Zahnarzt"),
	entry("b", "2026-12-24", "18:00", "Heiligabend, bei Oma"),
];

describe("exportIcs", () => {
	it("produces a VCALENDAR with one VEVENT per entry and CRLF line endings", () => {
		const ics = exportIcs(entries);
		expect(ics).toContain("BEGIN:VCALENDAR");
		expect(ics).toContain("END:VCALENDAR");
		expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
		expect(ics).toContain("\r\n");
	});

	it("renders local date+time as UTC DTSTART/DTEND", () => {
		const ics = exportIcs([entry("a", "2026-11-12", "09:05", "X")]);
		expect(ics).toContain("DTSTART:20261112T080500Z");
		expect(ics).toContain("DTEND:20261112T090500Z");
	});

	it("escapes commas, semicolons and backslashes in the summary", () => {
		const ics = exportIcs([entry("a", "2026-11-12", "09:00", "A, B; C\\D")]);
		expect(ics).toContain("SUMMARY:A\\, B\\; C\\\\D");
	});

	it("uses the entry id as UID", () => {
		expect(exportIcs([entry("my-id", "2026-11-12", "09:00", "X")])).toContain("UID:my-id@clock");
	});

	it("returns an empty calendar for no entries", () => {
		expect(exportIcs([])).toContain("BEGIN:VCALENDAR");
		expect(exportIcs([])).not.toContain("BEGIN:VEVENT");
	});
});

describe("parseIcs", () => {
	it("round-trips exported entries", () => {
		const parsed = parseIcs(exportIcs(entries));
		expect(parsed.map((e) => ({ id: e.id, iso: e.iso, time: e.time, title: e.title }))).toEqual([
			{ id: "a", iso: "2026-11-12", time: "09:05", title: "Zahnarzt" },
			{ id: "b", iso: "2026-12-24", time: "18:00", title: "Heiligabend, bei Oma" },
		]);
	});

	it("parses an external ICS with a TZID-less UTC timestamp", () => {
		const ics = [
			"BEGIN:VCALENDAR",
			"VERSION:2.0",
			"BEGIN:VEVENT",
			"UID:ext-1@example.com",
			"DTSTART:20261120T100000Z",
			"SUMMARY:Externer Termin",
			"END:VEVENT",
			"END:VCALENDAR",
		].join("\r\n");
		expect(parseIcs(ics)[0]).toMatchObject({
			iso: "2026-11-20",
			time: "11:00",
			title: "Externer Termin",
		});
	});

	it("handles LF-only input and unescapes the summary", () => {
		const ics = [
			"BEGIN:VCALENDAR",
			"BEGIN:VEVENT",
			"UID:x@y",
			"DTSTART:20261120T100000Z",
			"SUMMARY:A\\, B\\; C",
			"END:VEVENT",
			"END:VCALENDAR",
		].join("\n");
		expect(parseIcs(ics)[0]?.title).toBe("A, B; C");
	});

	it("ignores events without DTSTART", () => {
		const ics =
			"BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:x\r\nSUMMARY:Y\r\nEND:VEVENT\r\nEND:VCALENDAR";
		expect(parseIcs(ics)).toEqual([]);
	});

	it("returns an empty array for garbage input", () => {
		expect(parseIcs("kein ical")).toEqual([]);
	});
});
