import { describe, expect, it } from "vitest";
import { makeEntry } from "../test/fixtures";
import { nextEvent, progressToNext } from "./next-event";

const NOW = new Date(2026, 10, 13, 12, 0, 0);

describe("nextEvent", () => {
	it("returns the earliest future entry, ignoring past ones", () => {
		const entries = [
			makeEntry({ id: "past", iso: "2026-11-13", time: "09:00" }),
			makeEntry({ id: "later", iso: "2026-11-13", time: "18:00" }),
			makeEntry({ id: "sooner", iso: "2026-11-13", time: "14:00" }),
		];
		expect(nextEvent(entries, NOW)?.id).toBe("sooner");
	});

	it("returns undefined when there is no future entry", () => {
		expect(nextEvent([makeEntry({ iso: "2026-11-13", time: "09:00" })], NOW)).toBeUndefined();
	});
});

describe("progressToNext", () => {
	it("is 0 percent right after the previous anchor", () => {
		const next = makeEntry({ iso: "2026-11-13", time: "14:00" });
		const previous = new Date(2026, 10, 13, 12, 0, 0);
		expect(progressToNext(next, NOW, previous)).toBe(0);
	});

	it("is 50 percent halfway between the previous event and the next", () => {
		const next = makeEntry({ iso: "2026-11-13", time: "14:00" });
		const previous = new Date(2026, 10, 13, 10, 0, 0);
		const halfway = new Date(2026, 10, 13, 12, 0, 0);
		expect(progressToNext(next, halfway, previous)).toBe(50);
	});

	it("reaches 100 percent at the next event time", () => {
		const next = makeEntry({ iso: "2026-11-13", time: "14:00" });
		const previous = new Date(2026, 10, 13, 12, 0, 0);
		const at = new Date(2026, 10, 13, 14, 0, 0);
		expect(progressToNext(next, at, previous)).toBe(100);
	});

	it("clamps to [0, 100] for out-of-range times", () => {
		const next = makeEntry({ iso: "2026-11-13", time: "14:00" });
		const previous = new Date(2026, 10, 13, 12, 0, 0);
		expect(progressToNext(next, new Date(2026, 10, 13, 11, 0, 0), previous)).toBe(0);
		expect(progressToNext(next, new Date(2026, 10, 13, 20, 0, 0), previous)).toBe(100);
	});

	it("clamps to 0 when now is before the anchor (stale/corrupt anchor)", () => {
		const next = makeEntry({ iso: "2026-11-13", time: "14:00" });
		const laterAnchor = new Date(2026, 10, 13, 13, 0, 0);
		expect(progressToNext(next, NOW, laterAnchor)).toBe(0);
	});

	it("returns 100 for a zero-width window (anchor at or after the target)", () => {
		const next = makeEntry({ iso: "2026-11-13", time: "14:00" });
		expect(progressToNext(next, NOW, new Date(2026, 10, 13, 14, 0, 0))).toBe(100);
	});
});
