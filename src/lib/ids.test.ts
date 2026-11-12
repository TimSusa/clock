import { describe, expect, it } from "vitest";
import { newEntryId } from "./ids";

describe("newEntryId", () => {
	it("uses the provided uuid when available", () => {
		expect(newEntryId(() => "uuid-1")).toBe("uuid-1");
	});

	it("falls back to a unique local id when randomUUID is missing (plain HTTP on iPad)", () => {
		const a = newEntryId(() => undefined);
		const b = newEntryId(() => undefined);
		expect(a).toMatch(/^entry-/);
		expect(a).not.toBe(b);
	});
});
