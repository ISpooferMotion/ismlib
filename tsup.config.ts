import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm", "cjs"],
	dts: true,
	sourcemap: true,
	target: "es2022",
	clean: true,
	// Copy the CSS baseline into dist so it's accessible as @ismlib/core/styles.css
	async onSuccess() {
		const { copyFile } = await import("fs/promises");
		await copyFile("src/styles.css", "dist/styles.css");
	},
});
