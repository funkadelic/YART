import { readFileSync } from "node:fs";
import { join } from "node:path";
import { vi } from "vitest";

import { FILM_FIXTURE_ENVELOPE } from "./filmFixture";

/**
 * Shared dataset request stubs.
 *
 * The DOM environment supplies no fetch, so the global under test is Node's own
 * implementation. It requires an absolute URL and rejects the root-relative path
 * the dataset URL resolves to under the runner, so an unstubbed load fails
 * with a URL parse error, not a network error. Every stub here
 * replaces that global, so a test asserts against a request it controls.
 */

// Resolved from this file's own location, because the working directory is
// wherever the runner happened to be invoked. Read off import.meta directly
// instead of through a URL, because the DOM environment replaces the global URL
// class and node:url will not convert the result.
const here = import.meta as ImportMeta & { dirname: string };
const assetPath = join(
  here.dirname,
  "..",
  "data",
  "worldcities",
  "cities.json",
);
const filmAssetPath = join(here.dirname, "..", "data", "films", "films.json");

/**
 * Serves a payload as the dataset response, serializing it first.
 */
export function stubDatasetFetch(payload: unknown) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(payload))),
    );
}

/**
 * Serves an already-serialized body verbatim, so the real asset's own bytes
 * reach the parser and its data quirks stay in play.
 */
export function stubDatasetFetchFromDisk(body: string) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(() => Promise.resolve(new Response(body)));
}

/**
 * Serves the film envelope in place of the city one the setup file installs.
 *
 * Deliberately not a URL-discriminating stub. The shared stub above answers
 * whatever is asked for, and a films test installs this one over it in its own
 * hook, which runs after the setup file's. A films test that forgets fails with
 * a column-order failure and does not pass quietly against city data.
 */
export function stubFilmDatasetFetch(payload: unknown = FILM_FIXTURE_ENVELOPE) {
  return stubDatasetFetch(payload);
}

/**
 * Reads the committed dataset asset off disk.
 */
export function readCommittedAsset(): string {
  return readFileSync(assetPath, "utf8");
}

/**
 * Reads the committed film dataset asset off disk.
 */
export function readCommittedFilmAsset(): string {
  return readFileSync(filmAssetPath, "utf8");
}
