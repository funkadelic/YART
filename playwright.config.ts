import { defineConfig } from "@playwright/test";

// This is the second test runner in the tree, and it collects no coverage at
// all. The hundred percent threshold stays measured over the deterministic
// jsdom project alone, which is the project the only command asking for
// coverage is scoped to. The other half of that agreement lives in the coverage
// block of vite.config.ts, and the guard that keeps the end-to-end script from
// quietly growing a coverage flag lives in src/toolchain.test.ts.
//
// Two alternatives were rejected. Merging this runner's numbers into the one
// report the static analysis import reads would cost a hand-rolled protocol
// collection plus a merge step, because this runner ships no coverage provider
// of the kind the jsdom project's does, and it would put a hard failure on a
// browser binary being present and on a bespoke pipeline. Emitting a second
// report the analyzer is configured to ignore would cost an exclusion to keep
// in step by hand, in exchange for a number nothing ever fails on.
//
// The reason the carve was taken rather than the merge: coverage merges by
// union, so a merge cannot lower the number, only raise it, and the real risk
// is the inverted one. A line covered only by the slowest and most
// engine-dependent suite in the tree would satisfy a hard failure, which puts
// the gate's floor on the suite least able to hold it. A run over a real
// server, a real network and a real browser is further along that axis than
// anything already in the tree. What would make the merge question live again
// is this suite covering an application path the jsdom suite cannot reach.

// The preview server's own default port, named here rather than left implicit
// so the address the browser is pointed at and the address the readiness poll
// waits on are derived from one value and cannot drift.
const PREVIEW_PORT = 4173;
const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}`;

export default defineConfig({
  // The default file match is rooted at this file's own directory, which is the
  // repository root, so without this the runner collects every test file under
  // src/ and fails in a storm of import errors.
  testDir: "e2e",
  // Runs before the web server starts, which is what turns a missing build into
  // a one second message naming the build command rather than a sixty second
  // readiness timeout blaming the server.
  globalSetup: "./e2e/globalSetup.ts",
  // ponytail: one worker, because every spec pulls the same multi-megabyte
  // dataset asset over the preview server. Raise it when the spec count makes
  // the wall clock matter.
  workers: 1,
  use: {
    baseURL: PREVIEW_URL,
    // No device preset, deliberately: a preset smuggles in a viewport and a
    // browser type past the guard that holds this file against the pipeline's
    // browser install.
    browserName: "chromium",
    // The pipeline downloads chromium-headless-shell alone, and this launch
    // resolves to exactly that: a headless launch that names no channel routes
    // to the shell. Naming a channel, or turning headless off for a local
    // debugging run, asks for a binary the pipeline never fetched. The same
    // constraint already binds the browser project in vite.config.ts, and
    // src/toolchain.test.ts holds both files against the install line.
    headless: true,
  },
  webServer: {
    // The port is explicit and strict because the preview server otherwise
    // walks silently to the next free port, leaving the readiness poll waiting
    // on an address nothing is listening on.
    command: `npm run preview -- --port ${PREVIEW_PORT} --strictPort`,
    url: PREVIEW_URL,
    // A local run attaches to a preview server already up; the pipeline, which
    // sets this variable, always starts its own.
    reuseExistingServer: !process.env.CI,
  },
});
