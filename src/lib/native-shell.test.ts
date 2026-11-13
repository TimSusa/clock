import { afterEach, describe, expect, it, vi } from "vitest";
import { isNativeShell } from "./native-shell";

describe("isNativeShell", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("recognizes the WKWebView served from capacitor://localhost", () => {
		vi.stubGlobal("window", { location: { protocol: "capacitor:" } });
		expect(isNativeShell()).toBe(true);
	});

	it("returns false for the plain web build", () => {
		vi.stubGlobal("window", { location: { protocol: "https:" } });
		expect(isNativeShell()).toBe(false);
	});

	it("trusts Capacitor's own isNativePlatform()", () => {
		vi.stubGlobal("window", {
			location: { protocol: "https:" },
			Capacitor: { isNativePlatform: () => true },
		});
		expect(isNativeShell()).toBe(true);
	});

	it("trusts Capacitor.getPlatform() === ios", () => {
		vi.stubGlobal("window", {
			location: { protocol: "file:" },
			Capacitor: { getPlatform: () => "ios" },
		});
		expect(isNativeShell()).toBe(true);
	});

	it("returns false without a window (SSR / node)", () => {
		vi.stubGlobal("window", undefined);
		expect(isNativeShell()).toBe(false);
	});
});
