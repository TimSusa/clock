import { describe, expect, it } from "vitest";
import { makeEntry } from "../test/fixtures";
import { exportIcs, internalExportText } from "./ical";
import { googleEventPayload, outlookEventPayload } from "./providers";

describe("VALARM in exported events", () => {
	it("adds a display alarm at the event start for every VEVENT", () => {
		const ics = exportIcs([makeEntry({ id: "a" }), makeEntry({ id: "b", iso: "2026-12-24" })]);
		expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(2);
		expect(ics).toContain("TRIGGER:-PT0M");
		expect(ics).toContain("ACTION:DISPLAY");
	});

	it("uses the edited title in the alarm description", () => {
		const ics = exportIcs([makeEntry({ id: "a", title: "Neuer Titel" })]);
		expect(ics).toContain("DESCRIPTION:Neuer Titel");
		expect(ics).toContain("SUMMARY:Neuer Titel");
	});
});

describe("remote provider reminders", () => {
	it("sets Google reminders to a popup at 0 minutes", () => {
		const payload = googleEventPayload(makeEntry({ id: "a", title: "X" }));
		expect(payload.reminders).toEqual({
			useDefault: false,
			overrides: [{ method: "popup", minutes: 0 }],
		});
	});

	it("enables the Outlook reminder", () => {
		const payload = outlookEventPayload(makeEntry({ id: "a", title: "X" }));
		expect(payload.isReminderOn).toBe(true);
		expect(payload.reminderMinutesBeforeStart).toBe(0);
	});
});

describe("internal export without a file", () => {
	it("returns the ICS text plus a human-readable summary", () => {
		const result = internalExportText([makeEntry({ id: "a", title: "Zahnarzt", time: "15:30" })]);
		expect(result.ics).toContain("SUMMARY:Zahnarzt");
		expect(result.ics).toContain("BEGIN:VALARM");
		expect(result.summary).toContain("Zahnarzt");
		expect(result.count).toBe(1);
	});

	it("handles an empty list", () => {
		const result = internalExportText([]);
		expect(result.count).toBe(0);
		expect(result.summary).toBe("");
	});
});
