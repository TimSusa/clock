import { describe, expect, it } from "vitest";
import { releaseFiredId } from "./alarms-run";

describe("releaseFiredId", () => {
	it("removes the id so the same alarm can trigger again in the same day", () => {
		const fired = ["a", "b"];
		const next = releaseFiredId(fired, "a");
		expect(next).toEqual(["b"]);
	});

	it("does not mutate the input array (pure)", () => {
		const fired = ["a"];
		releaseFiredId(fired, "a");
		expect(fired).toEqual(["a"]);
	});

	it("returns an equal list when the id was not claimed", () => {
		expect(releaseFiredId(["a"], "z")).toEqual(["a"]);
	});
});
