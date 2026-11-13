import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
	appId: "de.timsusa.clock",
	appName: "Clock",
	webDir: "dist",
	ios: {
		contentInset: "always",
	},
	plugins: {
		LocalNotifications: {
			smallIcon: "ic_stat_icon",
			// Fallback when the plugin's in-memory request lookup is empty after
			// an app restart: alarms must still show a banner on the Lock Screen.
			presentationOptions: ["banner", "list", "sound", "badge"],
		},
	},
};

export default config;
