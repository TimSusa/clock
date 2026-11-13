import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const plist = readFileSync("ios/App/App/Info.plist", "utf8");

describe("iOS Info.plist", () => {
	it("disables the system Shake-to-Undo dialog (WKWebView text fields)", () => {
		expect(plist).toContain("UIApplicationSupportsShakeToEdit");
		expect(plist).toMatch(/<key>UIApplicationSupportsShakeToEdit<\/key>\s*<false\/>/);
	});
});
