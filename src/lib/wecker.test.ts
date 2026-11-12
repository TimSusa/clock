import { describe, expect, it } from "vitest";
import { makeEntry } from "../test/fixtures";
import { AlarmStatus } from "./enums";
import type { CalendarEntry } from "./types";
import { buildAlarmRows } from "./wecker";

const now = new Date(2026, 10, 12, 9, 5, 30);

function entry(id: string, iso: string, time: string): CalendarEntry {
	return makeEntry({ id, iso, time, title: id });
}

describe("buildAlarmRows", () => {
	it("sorts all entries chronologically by date and time", () => {
		const rows = buildAlarmRows(
			[
				entry("c", "2026-11-13", "08:00"),
				entry("a", "2026-11-12", "10:00"),
				entry("b", "2026-11-10", "23:00"),
			],
			now,
		);
		expect(rows.map((r) => r.entry.id)).toEqual(["b", "a", "c"]);
	});

	it("marks the current minute as Due", () => {
		const rows = buildAlarmRows([entry("hit", "2026-11-12", "09:05")], now);
		expect(rows[0]?.status).toBe(AlarmStatus.Due);
	});

	it("marks a later time today as Today", () => {
		const rows = buildAlarmRows([entry("later", "2026-11-12", "18:00")], now);
		expect(rows[0]?.status).toBe(AlarmStatus.Today);
	});

	it("marks an earlier time today as Past", () => {
		const rows = buildAlarmRows([entry("early", "2026-11-12", "07:00")], now);
		expect(rows[0]?.status).toBe(AlarmStatus.Past);
	});

	it("marks another day in the future as Future", () => {
		const rows = buildAlarmRows([entry("future", "2026-12-01", "09:05")], now);
		expect(rows[0]?.status).toBe(AlarmStatus.Future);
	});

	it("exposes a German date label and the HH:MM time", () => {
		const rows = buildAlarmRows([entry("x", "2026-11-12", "10:30")], now);
		expect(rows[0]?.time).toBe("10:30");
		expect(rows[0]?.label).toBe("Donnerstag, 12. November 2026");
	});

	it("returns an empty array for no entries", () => {
		expect(buildAlarmRows([], now)).toEqual([]);
	});
});
