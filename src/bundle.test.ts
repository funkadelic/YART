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
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "vite";
import { expect, it } from "vitest";

import { required } from "./test/required";

// Resolved from this file's own location rather than from the working directory,
// which is wherever the runner happened to be invoked and is not the project root
// under an IDE runner or an explicit root argument.
const here = import.meta as ImportMeta & { dirname: string };
const projectRoot = join(here.dirname, "..");

// One value from each dataset, each unlike Tokyo or Paris unlikely to appear in
// a fixture, a comment, or a dependency. Both are checked against every chunk,
// so a value import of either dataset is caught.
const SENTINELS = ["Guangzhou", "Eraserhead"];

// The shells the site ships, one per page, each paired with the dataset its own
// entry imports. The pairing is the claim: asserting only that the two shells
// preload different assets passes a build that swapped them, which is the same
// wrong-page request as preloading nothing.
const SHELLS = ["index.html", "movies.html"];
const SHELL_DATASET: Readonly<Record<string, string>> = {
  "index.html": "cities",
  "movies.html": "films",
};

// The build tool's own chunk-size warning threshold: a little over twice the real
// chunk, and roughly a seventh of what a re-bundled regression produces, so it sits
// between the two with room on both sides and needs no retuning on every dependency
// bump. A chunk that outgrows it is re-measured and explained, never accommodated by
// moving this number upward. A ceiling that follows each regression has stopped
// being a gate.
const JS_CHUNK_SIZE_CEILING_BYTES = 512000;

// Each emitted dataset carries a content hash in its name. That is what makes a
// corrected dataset reach a returning visitor rather than their cache.
//
// Both names are spelled out rather than dropped from the pattern: the pattern's
// job is to prove a hash is present, and one matching any JSON at all would pass
// for an asset emitted without one.
//
// e2e/dataset.spec.ts holds the same claim from the transport side, restating
// this pattern rather than importing it: this file owns the emitted artifact,
// that one owns what the running page actually pulled over the wire.
const HASHED_JSON_ASSET = /^(?:cities|films)-[A-Za-z0-9_-]{6,}\.json$/;

// The build takes under a second warm. The generous allowance covers a cold
// runner plus a dependency optimize pass.
const BUILD_TIMEOUT_MS = 60000;

it(
  "emits no dataset rows in any JavaScript chunk",
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
        const compiled = readFileSync(join(assets, chunk), "utf8");

        for (const sentinel of SENTINELS) {
          expect(compiled, `${chunk} carries dataset rows`).not.toContain(
            sentinel,
          );
        }

        expect(
          statSync(join(assets, chunk)).size,
          `${chunk} is at or over the chunk-size ceiling`,
        ).toBeLessThan(JS_CHUNK_SIZE_CEILING_BYTES);
      }

      const datasets = emitted.filter((name) => name.endsWith(".json"));

      expect(
        datasets,
        "the two datasets were not emitted exactly once each",
      ).toHaveLength(2);

      // Compared as a set rather than by position: chunk emission order is not
      // a property this file should depend on, and two names collapsing into
      // one is exactly the regression the cross-shell assertion below rests on.
      const hashed = [
        ...new Set(datasets.filter((name) => HASHED_JSON_ASSET.test(name))),
      ];

      expect(
        hashed,
        `${datasets.join(", ")} is not two distinct content-hashed dataset assets, so a corrected dataset would keep the same URL`,
      ).toHaveLength(2);

      const preloaded: string[] = [];

      for (const shell of SHELLS) {
        const markup = readFileSync(join(outDir, shell), "utf8");

        // The shell names the emitted dataset so the preload scanner can start
        // the largest request on the page before the entry chunk has parsed. It
        // has to name the file exactly: a preload for a name that is not there
        // costs a request and still leaves the real fetch to make, and one
        // without crossorigin is not reusable by that fetch, so the dataset
        // arrives twice. Both failures are silent in a browser and neither is
        // visible in the source, since the name only exists once the bundle
        // does.
        const preload = /<link[^>]*rel="preload"[^>]*>/.exec(markup)?.[0];

        expect(preload, `${shell} carries no dataset preload`).toBeDefined();

        const named = hashed.find((name) =>
          (preload ?? "").includes(`assets/${name}`),
        );

        expect(
          named,
          `${shell} preloads no asset this build emitted`,
        ).toBeDefined();
        expect(
          preload ?? "",
          `${shell} preloads without crossorigin, so the dataset downloads twice`,
        ).toContain("crossorigin");

        // Which asset, not merely some asset. The set comparison below catches
        // two shells naming one file; only this catches the two names being
        // swapped, which serves every reader of both pages the wrong dataset.
        const expected = required(
          SHELL_DATASET[shell],
          `a declared dataset for ${shell}`,
        );

        expect(
          named,
          `${shell} preloads ${named ?? "nothing"} rather than its own ${expected} asset`,
        ).toMatch(new RegExp(`^${expected}-`));

        preloaded.push(named ?? "");

        // The policy names the inline theme script by hash, and a hash taken
        // over anything but the script the shell ships silently drops it: the
        // browser reports a refusal nobody reads, the theme lands after first
        // paint, and the page still works. Recomputed here from each built
        // shell's own script rather than trusted from the plugin, so a
        // transform touching the script after the hash is taken fails this
        // rather than the reader's first frame.
        const policy =
          /<meta[^>]*http-equiv="Content-Security-Policy"[^>]*>/.exec(
            markup,
          )?.[0];

        expect(policy, `${shell} carries no policy`).toBeDefined();

        const inline = [
          ...markup.matchAll(
            /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g,
          ),
        ];

        expect(inline, `${shell} has no inline script`).toHaveLength(1);

        const script = inline[0]?.[1] ?? "";

        expect(script, `${shell} carries an empty inline script`).not.toBe("");
        expect(
          policy ?? "",
          `the policy in ${shell} does not name the inline script it carries`,
        ).toContain(
          `sha256-${createHash("sha256").update(script, "utf8").digest("base64")}`,
        );

        // A policy delivered this way governs only what follows it, so one
        // placed after the script it names is a policy the script never sees.
        expect(
          markup.indexOf("Content-Security-Policy"),
          `the policy in ${shell} is declared after the script it names`,
        ).toBeLessThan(markup.indexOf("<script"));
      }

      // The test half of the entry-aware preload. Each shell above resolves its
      // preload against the build output, which a shell naming the other page's
      // asset would still pass; only comparing the two catches that, and it is
      // the failure a whole-bundle lookup produces with nothing else reporting
      // it.
      expect(
        [...new Set(preloaded)],
        `the shells preload ${preloaded.join(", ")}, so an entry did not get its own asset`,
      ).toHaveLength(SHELLS.length);
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
