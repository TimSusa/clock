import { describe, expect, it } from "vitest";
import { missingFields, resolveConnectionState } from "./connection";
import { CalendarProvider, ConnectionState } from "./enums";

describe("resolveConnectionState", () => {
	it("reports a missing client id", () => {
		expect(resolveConnectionState({ clientId: "", accessToken: "tok" })).toBe(
			ConnectionState.MissingClientId,
		);
	});

	it("reports a missing token when the client id exists", () => {
		expect(resolveConnectionState({ clientId: "cid", accessToken: "" })).toBe(
			ConnectionState.MissingToken,
		);
	});

	it("is ready when both are present", () => {
		expect(resolveConnectionState({ clientId: "cid", accessToken: "tok" })).toBe(
			ConnectionState.Ready,
		);
	});
});

describe("missingFields", () => {
	it("lists exactly what is missing", () => {
		expect(missingFields({ clientId: "", accessToken: "" }, CalendarProvider.Google)).toEqual([
			"VITE_GOOGLE_CLIENT_ID",
			"Access Token",
		]);
	});

	it("uses the Outlook env name", () => {
		expect(missingFields({ clientId: "", accessToken: "" }, CalendarProvider.Outlook)).toEqual([
			"VITE_OUTLOOK_CLIENT_ID",
			"Access Token",
		]);
	});

	it("is empty when everything is present", () => {
		expect(missingFields({ clientId: "cid", accessToken: "tok" }, CalendarProvider.Google)).toEqual(
			[],
		);
	});
});
