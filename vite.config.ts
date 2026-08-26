import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      // lcov for the Sonar import, text so a local run says the same thing the
      // gate will. The default reporters write html into coverage/ as well,
      // which is noise for a directory CI only reads one file out of.
      reporter: ["text", "lcov"],
      // Coverage is reported over the application source alone. Without this the
      // report covers only files a test happened to import, so deleting the last
      // test that touched a module would raise the percentage.
      include: ["src/**/*.{ts,tsx}"],
      // Four patterns over artifacts that never execute, and no named file. An
      // entry naming an application source file is how a coverage gate stops
      // measuring the code it exists to measure.
      exclude: [
        "src/**/*.test.{ts,tsx}",
        // Type-level assertions, settled by the compiler and never run.
        "src/**/*.test-d.ts",
        "src/test/**",
        "src/**/*.d.ts",
      ],
      // Without this the number is a report rather than a gate, and a change
      // that drops coverage merges green with the drop recorded in a log
      // nobody reads.
      thresholds: { 100: true },
    },
  },
});
