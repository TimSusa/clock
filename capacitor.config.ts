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
		},
	},
};

export default config;
