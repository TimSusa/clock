import { CalendarProvider, ConnectionState } from "./enums";

export interface ConnectionInputs {
	clientId: string;
	accessToken: string;
}

function envNameFor(provider: CalendarProvider): string {
	return provider === CalendarProvider.Google ? "VITE_GOOGLE_CLIENT_ID" : "VITE_OUTLOOK_CLIENT_ID";
}

/** Pure state resolution: no timers, no network — callers decide when to run the sync. */
export function resolveConnectionState(inputs: ConnectionInputs): ConnectionState {
	if (inputs.clientId.trim().length === 0) return ConnectionState.MissingClientId;
	if (inputs.accessToken.trim().length === 0) return ConnectionState.MissingToken;
	return ConnectionState.Ready;
}

export function missingFields(
	inputs: ConnectionInputs,
	provider: CalendarProvider,
): readonly string[] {
	const missing: string[] = [];
	if (inputs.clientId.trim().length === 0) missing.push(envNameFor(provider));
	if (inputs.accessToken.trim().length === 0) missing.push("Access Token");
	return missing;
}
