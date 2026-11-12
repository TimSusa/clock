import { describe, expect, it } from "vitest";
import { makeEntry } from "../test/fixtures";
import { updateEntry } from "./entries";
import type { CalendarEntry } from "./types";

const base: CalendarEntry = makeEntry({ id: "a", title: "Alt" });

describe("updateEntry", () => {
	it("replaces the entry with the same id and preserves order", () => {
		const other: CalendarEntry = { ...base, id: "b", title: "Anderer" };
		const edited: CalendarEntry = { ...base, title: "Neu", time: "15:30" };
		const result = updateEntry([base, other], edited);
		expect(result.map((e) => e.id)).toEqual(["a", "b"]);
		expect(result[0]).toEqual(edited);
	});

	it("does not mutate the input array", () => {
		const original = [base];
		updateEntry(original, { ...base, title: "Neu" });
		expect(original[0]?.title).toBe("Alt");
	});

	it("returns the list unchanged when the id is unknown", () => {
		const result = updateEntry([base], { ...base, id: "unknown", title: "Neu" });
		expect(result).toEqual([base]);
	});
});
