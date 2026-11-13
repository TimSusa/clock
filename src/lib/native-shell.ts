/**
 * Single source of truth for "are we inside the native Capacitor shell?".
 * Prefers Capacitor's own isNativePlatform()/getPlatform(); falls back to the
 * location protocol (WKWebView is served from capacitor://localhost). The
 * dynamic import of a plugin alone is NOT a valid check: @capacitor/core
 * registers an UNIMPLEMENTED web proxy that rejects every call.
 */
export function isNativeShell(): boolean {
	if (typeof window === "undefined") return false;
	const capacitor = (
		window as unknown as {
			Capacitor?: {
				isNativePlatform?: () => boolean;
				getPlatform?: () => string;
			};
		}
	).Capacitor;
	if (capacitor?.isNativePlatform?.() === true) return true;
	if (capacitor?.getPlatform?.() === "ios" || capacitor?.getPlatform?.() === "android") return true;
	return window.location?.protocol === "capacitor:";
}
