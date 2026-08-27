// @vitest-environment node
//
// The pragma above has no correctness reason left, measured rather than
// assumed. The reason that stood here until the bundler moved to Vite 8
// described an invariant belonging to the old transform tool: it was live on
// Vite 7.3.6, where deleting the pragma stopped the build outright, and it went
// away with the tool, because Vite 8 does not depend on it and the same probe
// now passes. What the pragma saves today is only the DOM environment's setup
// cost, which a file that shells out to a build has no reason to pay.
//
// The environment variable this file sets in its body is a separate matter, and
// this paragraph is about that rather than about the pragma. The runner sets the
// environment name to a test value, and a programmatic build inherits it, so the
// view library resolves to its development build and the artifact measured comes
// out close to twice the size of the one a release build produces. Passing a
// production mode to the build call does not correct that. Setting the
// environment variable does, and reproduces the release build's content hash
// exactly.
//
// What goes undetected without this file: a plain value import of the dataset in
// place of the URL-suffixed one. It compiles, it typechecks, and it puts the
// whole dataset back into the JavaScript chunk with nothing in the suite
// noticing, while the app downloads the data a second time as well. A lint rule
// over the import site would not catch it honestly: it also fires on an unused
// import the bundler removes, and it says nothing about what actually ships.
// This guard reads the emitted artifact instead of the source that produced it.

import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "vite";
import { expect, it } from "vitest";

// Resolved from this file's own location rather than from the working directory,
// which is wherever the runner happened to be invoked and is not the project root
// under an IDE runner or an explicit root argument.
const here = import.meta as ImportMeta & { dirname: string };
const projectRoot = join(here.dirname, "..");

// Present in the dataset, and unlike Tokyo or Paris unlikely to appear in a
// fixture, a comment, or a dependency.
const SENTINEL_CITY = "Guangzhou";

// The build tool's own chunk-size warning threshold: a little over twice the real
// chunk, and roughly a seventh of what a re-bundled regression produces, so it sits
// between the two with room on both sides and needs no retuning on every dependency
// bump. A chunk that outgrows it is re-measured and explained, never accommodated by
// moving this number upward. A ceiling that follows each regression has stopped
// being a gate.
const JS_CHUNK_SIZE_CEILING_BYTES = 512000;

// The emitted dataset carries a content hash in its name. That is what makes a
// corrected dataset reach a returning visitor rather than their cache.
//
// e2e/dataset.spec.ts holds the same claim from the transport side, restating
// this pattern rather than importing it: this file owns the emitted artifact,
// that one owns what the running page actually pulled over the wire.
const HASHED_JSON_ASSET = /^cities-[A-Za-z0-9_-]{6,}\.json$/;

// The build takes under a second warm. The generous allowance covers a cold
// runner plus a dependency optimize pass.
const BUILD_TIMEOUT_MS = 60000;

it(
  "emits no city data in any JavaScript chunk",
  async () => {
    // Built into a temporary directory rather than the default output path, so a
    // developer running the suite does not have their own build output replaced
    // by one this test made.
    const outDir = mkdtempSync(join(tmpdir(), "yart-build-"));
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      await build({
        root: projectRoot,
        logLevel: "silent",
        build: { outDir, emptyOutDir: true },
      });

      const assets = join(outDir, "assets");
      const emitted = readdirSync(assets);
      const chunks = emitted.filter((name) => name.endsWith(".js"));

      expect(
        chunks.length,
        "the build emitted no JavaScript chunk at all",
      ).toBeGreaterThan(0);

      for (const chunk of chunks) {
        expect(
          readFileSync(join(assets, chunk), "utf8"),
          `${chunk} carries city data`,
        ).not.toContain(SENTINEL_CITY);

        expect(
          statSync(join(assets, chunk)).size,
          `${chunk} is at or over the chunk-size ceiling`,
        ).toBeLessThan(JS_CHUNK_SIZE_CEILING_BYTES);
      }

      const datasets = emitted.filter((name) => name.endsWith(".json"));

      expect(datasets, "the dataset was not emitted exactly once").toHaveLength(
        1,
      );

      expect(
        datasets[0],
        `${datasets[0]} carries no content hash, so a corrected dataset would keep the same URL`,
      ).toMatch(HASHED_JSON_ASSET);

      // The shell names the emitted dataset so the preload scanner can start
      // the largest request on the page before the entry chunk has parsed. It
      // has to name the file exactly: a preload for a name that is not there
      // costs a request and still leaves the real fetch to make, and one
      // without crossorigin is not reusable by that fetch, so the dataset
      // arrives twice. Both failures are silent in a browser and neither is
      // visible in the source, since the name only exists once the bundle does.
      const preload = /<link[^>]*rel="preload"[^>]*>/.exec(
        readFileSync(join(outDir, "index.html"), "utf8"),
      )?.[0];

      expect(
        preload,
        "the built shell carries no dataset preload",
      ).toBeDefined();
      expect(
        preload ?? "",
        "the preload does not name the emitted dataset",
      ).toContain(`assets/${datasets[0]}`);
      expect(
        preload ?? "",
        "the preload carries no crossorigin, so the dataset downloads twice",
      ).toContain("crossorigin");
    } finally {
      // Assigning undefined would store the string "undefined" rather than
      // clearing the variable, so an absent NODE_ENV has to be deleted.
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
      rmSync(outDir, { recursive: true, force: true });
    }
  },
  BUILD_TIMEOUT_MS,
);
