import { defineConfig } from "@playwright/test";

import globalSetup from "./e2e/globalSetup";

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

// Called here rather than registered through the runner's globalSetup key,
// which is where it started and where it did not work. Measured: the web server
// is started before the registered setup runs, so a missing build failed as the
// sixty second readiness timeout this check exists to replace, and the setup it
// would have failed in was never reached. This module is loaded before anything
// is started, so the same check fails in under a second here.
globalSetup();

export default defineConfig({
  // The default file match is rooted at this file's own directory, which is the
  // repository root, so without this the runner collects every test file under
  // src/ and fails in a storm of import errors.
  testDir: "e2e",
  // ponytail: one worker, because every spec pulls the same multi-megabyte
  // dataset asset over the preview server. Raise it when the spec count makes
  // the wall clock matter.
  workers: 1,
  // A committed test.only silently reduces this gate to one spec and still
  // exits zero, which is the same class of failure as a vacuous assertion: the
  // pipeline reports green over work it never ran. Local runs keep the
  // shorthand, because narrowing to one spec is what it is for.
  forbidOnly: !!process.env.CI,
  // Two specs wait out the dataset arriving twice, at the twenty seconds each
  // of those waits declares. Under the thirty second default the second wait
  // could never spend its allowance, so the number written beside it was not
  // the number in force. Sized to hold both waits plus the rest of the spec.
  timeout: 60_000,
  use: {
    baseURL: PREVIEW_URL,
    // Both default to off, which left the ignore entries for them describing
    // files nothing wrote. Kept to failures alone: a green run produces no
    // evidence worth keeping, and a trace over a multi-megabyte dataset fetch
    // is not cheap.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
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
    // Stated rather than inherited. The theme spec stores a dark choice and
    // asserts the blocking script stamps it, which only discriminates while the
    // preference underneath disagrees: the script falls back to the media query
    // when no choice is stored, so under a dark preference it would stamp dark
    // on its own and the assertion would hold with the stored choice ignored.
    // That currently works because this is the runner's default, which is a
    // coincidence the spec should not be resting on.
    colorScheme: "light",
    // Stated for the same reason, and now that the application follows the
    // reader's locale it decides more than a colour. The negotiation walks the
    // browser's own preference list, so on a machine preferring French every
    // string these specs assert would arrive translated and every grouped count
    // would carry a different separator. Pinning it makes the copy under test
    // the copy the specs were written against.
    locale: "en-US",
  },
  webServer: {
    // The port is explicit and strict because the preview server otherwise
    // walks silently to the next free port, leaving the readiness poll waiting
    // on an address nothing is listening on.
    command: `npm run preview -- --port ${PREVIEW_PORT} --strictPort`,
    url: PREVIEW_URL,
    // Never reused, including locally. The precondition above proves a build
    // exists, not that the server already listening is serving it, and nothing
    // in the deterministic suite refreshes dist/ (the bundle test builds into a
    // temporary directory), so a stale preview left running is the ordinary
    // local case rather than an unlucky one. Paired with the strict port, a
    // stale server now fails the run loudly on the bind instead of quietly
    // answering it from an old build.
    reuseExistingServer: false,
  },
});
