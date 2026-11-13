import { describe, expect, it } from "vitest";
import { makeEntry } from "../test/fixtures";
import { AlarmStatus } from "./enums";
import { buildAlarmRows } from "./wecker";

const now = new Date(2026, 10, 12, 9, 5, 30);

describe("buildAlarmRows — Upcoming within the same hour", () => {
	it("marks a later minute in the current hour as Upcoming instead of Today", () => {
		const rows = buildAlarmRows([makeEntry({ id: "soon", iso: "2026-11-12", time: "09:30" })], now);
		expect(rows[0]?.status).toBe(AlarmStatus.Upcoming);
	});

	it("keeps Due for the exact current minute", () => {
		const rows = buildAlarmRows([makeEntry({ id: "hit", iso: "2026-11-12", time: "09:05" })], now);
		expect(rows[0]?.status).toBe(AlarmStatus.Due);
	});

	it("keeps Today for a later hour (not the current hour)", () => {
		const rows = buildAlarmRows(
			[makeEntry({ id: "later", iso: "2026-11-12", time: "10:30" })],
			now,
		);
		expect(rows[0]?.status).toBe(AlarmStatus.Today);
	});
});
