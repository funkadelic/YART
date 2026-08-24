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
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        "src/**/*.d.ts",
        // The type-level assertion file. Its claims are settled by the compiler
        // and it ships to nobody, but the two columns it asserts about are real
        // values built by the real factory, which is what makes the claims
        // testable rather than restatements of themselves. Nothing loads them,
        // so the file reports zero and no test could honestly raise it. Its
        // sibling under features/ needs no entry: that one holds types only and
        // compiles away to nothing.
        "src/components/DataTable/columnTypes.ts",
      ],
    },
  },
});
