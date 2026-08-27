import { expect, test } from "@playwright/test";

/**
 * The dataset arriving over the application's own request, as an emitted
 * content-hashed asset.
 *
 * What this adds over the build-side assertion in src/bundle.test.ts: that one
 * owns the emitted artifact, reading the file the bundler wrote. This one owns
 * the transport, reading what the running page actually pulled over the wire.
 * A build can emit the right asset and a page can still fetch something else,
 * or nothing at all, and neither test alone would notice.
 */

// The engine fetches the real multi-megabyte dataset asset over the preview
// server, parses and indexes it, and only then waits out the seam's deliberate
// simulated latency. Raised deliberately rather than as a flake allowance.
const DATASET_READY_TIMEOUT_MS = 20_000;

// Restated here rather than imported, per the convention that a constant the
// subject also defines is restated in the test, so this file cannot pass for
// whatever value the subject happens to hold. src/bundle.test.ts holds the same
// claim from the build side and carries the mirror of this comment. Exporting
// the pattern from one test file so the other could import it would put a
// cross-runner import edge into the tree for six characters.
//
// Rooted at the built assets directory, and the hash is what makes a corrected
// dataset reach a returning visitor rather than their cache.
const HASHED_JSON_ASSET = /^\/assets\/cities-[A-Za-z0-9_-]{6,}\.json$/;

// The floor is what turns "not a stub" into a machine-checkable claim rather
// than an argument about which directory the file sits in. The per-test stub in
// vitest.setup.ts returns a small fixture, so a megabyte separates the two by
// three orders of magnitude while leaving room for the dataset to grow or
// shrink. Measured today at 3,507,706 bytes.
const STUB_FLOOR_BYTES = 1_000_000;

// Every row in the committed dataset, src/data/worldcities/cities.json, since
// the unsearched view filters nothing.
const TOTAL_ROWS = 50250;

test("the running page fetches the content-hashed dataset asset", async ({
  page,
}) => {
  // Armed before the navigation, never after: the request is issued during the
  // load and a wait armed afterwards races it.
  const datasetResponse = page.waitForResponse(
    (response) => HASHED_JSON_ASSET.test(new URL(response.url()).pathname),
    { timeout: DATASET_READY_TIMEOUT_MS },
  );

  await page.goto("/");

  const response = await datasetResponse;
  expect(response.ok()).toBe(true);

  const body = await response.body();
  expect(body.byteLength).toBeGreaterThan(STUB_FLOOR_BYTES);

  // Distinguishes the application's own runtime request from the document
  // itself or a bundled script, each of which the engine reports under its own
  // type.
  expect(response.request().resourceType()).toBe("fetch");

  // Ties the transport back to what the reader sees: a fixture-sized payload
  // would report a fixture-sized count here.
  await expect(page.getByRole("table")).toHaveAccessibleName(
    `City data with ${TOTAL_ROWS} entries, currently not sorted`,
    { timeout: DATASET_READY_TIMEOUT_MS },
  );
});
