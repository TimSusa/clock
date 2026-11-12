import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [tailwindcss(), svelte()],
	test: {
		environment: "jsdom",
		globals: false,
		include: ["src/**/*.{test,spec}.ts"],
		setupFiles: ["./src/test/setup.ts"],
	},
	...(process.env.VITEST ? { resolve: { conditions: ["browser"] } } : {}),
});
