import { playwright } from "@vitest/browser-playwright";
import react from "@vitejs/plugin-react";
import { defaultExclude, defineConfig } from "vitest/config";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import type { Plugin } from "vite";

/**
 * Adds a Content-Security-Policy to the built shell.
 *
 * Delivered as a meta element because the app ships as a static bundle to a
 * host whose response headers it does not control. That costs three directives
 * a header would carry: frame-ancestors, report-uri and sandbox are all ignored
 * in a policy delivered this way, so clickjacking stays outside what this can
 * express.
 *
 * The theme script in index.html is inline and blocking, which a policy has to
 * name by hash or drop. Dropping it brings back the wrong-theme flash it exists
 * to prevent, with nothing reporting that it happened, so the hash is computed
 * here from the script the shell actually carries. Writing it into index.html
 * by hand would leave two things to change together, and the failure of not
 * doing so is silent in exactly the same way.
 *
 * Build only, so the dev server is unaffected: it serves styles as injected
 * style elements, which this policy does not allow and which the built page
 * never contains.
 */
function contentSecurityPolicy(): Plugin {
  return {
    name: "yart-content-security-policy",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        const inline = [
          ...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g),
        ];

        // A length check narrows neither the match nor its capture group, so
        // the guard reads the group itself. Hashing an undefined would name a
        // script the document does not carry, and the browser refuses the real
        // one, which brings back the flash the inline script exists to prevent.
        const source = inline[0]?.[1];

        if (inline.length !== 1 || source === undefined) {
          throw new Error(
            `expected exactly one inline script to hash, found ${inline.length}`,
          );
        }

        const digest = createHash("sha256")
          .update(source, "utf8")
          .digest("base64");

        return [
          {
            tag: "meta",
            // Before the script it names, because a policy delivered this way
            // governs only what follows it in the document.
            injectTo: "head-prepend",
            attrs: {
              "http-equiv": "Content-Security-Policy",
              content: [
                // Everything the page does not do is denied by the default, so
                // a directive below is a statement that the page needs it.
                "default-src 'none'",
                `script-src 'sha256-${digest}' 'self'`,
                "style-src 'self'",
                "img-src 'self'",
                // The dataset, which is the only request the running page makes.
                "connect-src 'self'",
                "manifest-src 'self'",
                "base-uri 'none'",
                "form-action 'none'",
              ].join("; "),
            },
          },
        ];
      },
    },
  };
}

/**
 * Adds a preload for the dataset asset to the built shell.
 *
 * The dataset is requested by a module that cannot run until the entry chunk
 * has downloaded and parsed, so the largest thing the page needs is the last
 * thing it asks for. The link below moves that request to the shell, where the
 * preload scanner reaches it immediately and the two downloads overlap.
 *
 * The name is content-hashed and exists only once the bundle does, which is why
 * this reads it off the build rather than being written into index.html by
 * hand. A shell carrying a stale hash would preload a file that is not there,
 * pay for the request and still fetch the real one afterwards, so the lookup
 * throws rather than skipping quietly when it finds anything but one match.
 *
 * The lookup is per entry chunk rather than over the bundle. context.bundle is
 * the whole build's bundle and every shell is handed the same one, so with two
 * entries a name-based filter over it matches the same single asset for both
 * shells and the guard never fires. That was measured with a two-entry probe
 * build rather than inferred, and the shell that gets the wrong preload reports
 * nothing.
 *
 * The ceiling that comes with reading the entry: importedAssets is attributed
 * to the chunk that imports the asset, so a dataset module landing in the shared
 * chunk instead of an entry chunk leaves the entry's set empty and the plugin
 * throws on a count of zero. That is the intended loud failure, a red build
 * rather than a wrong preload. Each dataset module here is reached from exactly
 * one entry, so the case does not arise today.
 */
function preloadDataset(): Plugin {
  return {
    name: "yart-preload-dataset",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(_html, context) {
        const datasets = [
          ...(context.chunk?.viteMetadata?.importedAssets ?? []),
        ].filter((fileName) => fileName.endsWith(".json"));

        // A length check does not narrow an index access under
        // noUncheckedIndexedAccess, so the guard rides on a destructured
        // binding rather than on the index at the use site.
        const [dataset] = datasets;

        if (!dataset || datasets.length !== 1) {
          throw new Error(
            `expected exactly one emitted dataset asset, found ${datasets.length}`,
          );
        }

        return [
          {
            tag: "link",
            injectTo: "head",
            attrs: {
              rel: "preload",
              as: "fetch",
              // Required for an as="fetch" preload to be reused rather than
              // downloaded a second time, which on this asset would cost more
              // than the preload saves.
              crossorigin: "anonymous",
              // Written relative here rather than root-absolute, because the
              // base this build uses is relative and a tag injected at this
              // point is past the rewrite that would otherwise apply it.
              href: `./${dataset}`,
            },
          },
        ];
      },
    },
  };
}

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
  plugins: [react(), preloadDataset(), contentSecurityPolicy()],
  // Relative rather than the literal repository subpath the site is published
  // under. One build has to serve from two addresses: the root, which is where
  // `vite preview` serves it and therefore where both browser suites drive it,
  // and /YART/, which is where GitHub Pages serves a project site. A literal
  // base would move the preview address out from under the suites, and reading
  // the base off an environment variable would leave the built artifact the
  // pipeline measures different from the one it publishes.
  //
  // Safe here because the app writes its own address from window.location
  // rather than from a hardcoded path, so nothing in the tree assumes the root.
  base: "./",
  build: {
    // Spelled out from the same four floors the browserslist declares, because
    // the bundler does not read that field and the two are otherwise free to
    // drift. They already had: the default is baseline-widely-available, which
    // is Firefox 114 against the declared floor of 111, and the other three
    // agree exactly. The divergence emits nothing today, since a build pinned
    // to these targets and a build on the default produce the same chunk down
    // to its content hash, so this pins a floor rather than changing output.
    // Update it and the browserslist together; nothing asserts they agree.
    target: ["chrome111", "edge111", "firefox111", "safari16.4"],
    rollupOptions: {
      // Declaring an input replaces the implicit single-shell one, so the
      // original shell has to be named here or it stops being built. Both stay
      // at the repository root: a nested shell would resolve the relative asset
      // prefix this build emits one directory too deep.
      input: {
        index: resolve(import.meta.dirname, "index.html"),
        movies: resolve(import.meta.dirname, "movies.html"),
      },
    },
  },
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
          // collection. The first added pattern is the browser project's whole
          // input. The second is the other runner's whole input: both runners
          // match the same spec filenames from the same project root, so without
          // it this one collects the end-to-end specs and each of them fails on
          // import with a message about being called from a configuration file.
          exclude: [...defaultExclude, "src/**/*.browser.test.tsx", "e2e/**"],
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
