import { playwright } from "@vitest/browser-playwright";
import react from "@vitejs/plugin-react";
import { defaultExclude, defineConfig } from "vitest/config";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    coverage: {
      // Declared once at root level rather than inside a project, because the
      // runner rejects coverage options on a project. That is also the mechanism
      // by which the gate is measured over the deterministic jsdom suite alone:
      // the only command that asks for coverage is the one scoped to that project.
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
    projects: [
      {
        // Everything that runs without an engine. This is the suite the coverage
        // gate measures and the one a clean install can run, so it is named rather
        // than left implicit: a second project turns an unfiltered run into a
        // browser launch.
        extends: true,
        test: {
          name: "jsdom",
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          // Supplying exclude replaces the runner's own default rather than adding
          // to it, so the spread is what keeps the dependency directory out of
          // collection. The added pattern is the browser project's whole input.
          exclude: [...defaultExclude, "src/**/*.browser.test.tsx"],
        },
      },
      {
        // A real engine, for the checks that need layout and paint. It shares the
        // root plugin list through extends, without which the JSX here never
        // transforms, and it takes no setup file: the shared setup stubs the media
        // query this project exists to exercise for real, and stubs the dataset
        // fetch down to a fixture that would leave the paged table three pages long.
        extends: true,
        test: {
          name: "browser",
          include: ["src/**/*.browser.test.tsx"],
          setupFiles: [],
          browser: {
            enabled: true,
            headless: true,
            // A factory in this major version. The bare string throws while the
            // projects are still resolving, before a single test is collected.
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
