import { readFileSync } from "node:fs";
import { join } from "node:path";
import { vi } from "vitest";

/**
 * Shared dataset request stubs.
 *
 * The DOM environment supplies no fetch, so the global under test is Node's own
 * implementation. It requires an absolute URL and rejects the root-relative path
 * the dataset URL resolves to under the runner, which means an unstubbed load
 * fails with a URL parse error rather than a network error. Every stub here
 * replaces that global, so a test asserts against a request it controls.
 */

// Resolved from this file's own location rather than from the working directory,
// which is wherever the runner happened to be invoked. Read off import.meta
// directly rather than through a URL, because the DOM environment replaces the
// global URL class and node:url will not convert the result.
const here = import.meta as ImportMeta & { dirname: string };
const assetPath = join(
  here.dirname,
  "..",
  "data",
  "worldcities",
  "cities.json",
);

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
 * Reads the committed dataset asset off disk.
 */
export function readCommittedAsset(): string {
  return readFileSync(assetPath, "utf8");
}
