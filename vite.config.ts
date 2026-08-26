import { playwright } from "@vitest/browser-playwright";
import react from "@vitejs/plugin-react";
import { defaultExclude, defineConfig } from "vitest/config";

// https://vitejs.dev/config/
export default defineConfig({
  // What a default import from a CommonJS module resolves to changed in this
  // major. It is module.exports when the importer is .mjs or .mts, or the
  // closest manifest declares the module type, or the importee does not mark
  // itself as an ES module, and module.exports.default otherwise. This manifest
  // declares the module type, so the second condition fires for every file
  // under src/.
  //
  // Nothing the browser bundle contains is reached by that change. The view
  // library and its DOM renderer are the CommonJS-only packages src/ depends on,
  // and they are never default-imported; every import of them here is named. The
  // pre-bundled set was read out of the optimizer's own output directory and is
  // exactly those two, the DOM client entry, the two icon subpaths and the two
  // JSX runtimes.
  //
  // Test-only packages are default-imported in places, and none of them reaches
  // that set, because the app optimizer scans the entry graph rather than the
  // test files. The accessibility engine, axe-core, in the two axe test files,
  // ships no exports map and no module type, so it resolves as CommonJS and the
  // third condition fires for it. The CSS processor, postcss, in the token
  // guard, resolves through its own exports map to lib/postcss.mjs, so no
  // interop rule applies to it at all.
  //
  // That measurement is why legacy.inconsistentCjsInterop, the deprecated
  // opt-out back to the previous behavior, is declined here rather than
  // overlooked. The evidence it is not needed is the whole suite staying green
  // across the bump, coverage included.

  // The plugin is taken at 6.x and taken bare. Its three peers other than the
  // bundler are every one of them optional, so none of them is installed by
  // taking it: oxc-transform-react is the Rust port of React Compiler, reached
  // through the compiler option, and @rolldown/plugin-babel together with
  // babel-plugin-react-compiler is the Babel route to the same adoption through
  // the exported reactCompilerPreset. What is declined here is therefore an
  // experimental compiler rather than a faster JSX transform. The JSX transform
  // is Oxc's, arrives with the plugin itself and needs no peer at all, which is
  // also why this major drops the refresh runtime out of the tree instead of
  // adding to it. Babel is still installed, at @babel/core, but it arrives
  // through the lint plugin's dependency edge rather than this one and was here
  // before this bump as well. Adopting the compiler is a change of its own with
  // its own gate run, so the option stays unset and the peers stay uninstalled.
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
      // Four patterns and no named file. Three of them name artifacts that
      // never execute. The fourth, src/test/**, names the shared scaffolding,
      // which does run on every pass of this suite and is deliberately not
      // measured: it is support code for the tests rather than code the
      // product ships. That makes it the one directory holding executing code
      // outside the gate, so eslint.config.js forbids importing it from
      // anything that is not itself a test. An entry naming an application
      // source file is how a coverage gate stops measuring the code it exists
      // to measure.
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
            // The runner's own default is a phone-sized window, at which the
            // table overflows its scroll container and the last column is
            // clipped. The contrast rule then reports every cell in that column
            // as undecided rather than passing or failing it, because a
            // partially obscured element has no determinable background. A
            // desktop window is the layout this table is built for and the one
            // in which the rule can actually reach a verdict.
            viewport: { width: 1280, height: 900 },
            // A factory in this major version. The bare string throws while the
            // projects are still resolving, before a single test is collected.
            provider: playwright(),
            // The pipeline downloads chromium-headless-shell alone, and this
            // launch resolves to exactly that: Playwright routes a headless
            // launch that names no channel to the shell. Naming a channel, or
            // turning headless off for a local debugging run, asks for a binary
            // CI never fetched. src/toolchain.test.ts holds the two files
            // together, so that edit is a red test here rather than a missing
            // executable in the pipeline saying nothing about accessibility.
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
