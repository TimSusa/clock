import { describe, expect, it } from "vitest";
import { isIosSafari } from "./platform";

describe("isIosSafari", () => {
	it("detects iPhone and iPad", () => {
		expect(isIosSafari("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
		expect(isIosSafari("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe(true);
	});

	it("detects iPadOS desktop-mode (Macintosh + touch points)", () => {
		expect(isIosSafari("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", 5)).toBe(true);
	});

	it("does not flag desktop Safari or Chrome", () => {
		expect(isIosSafari("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", 0)).toBe(false);
		expect(isIosSafari("Mozilla/5.0 (Windows NT 10.0) Chrome/120", 0)).toBe(false);
	});
});
