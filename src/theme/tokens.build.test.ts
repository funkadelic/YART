// @vitest-environment node
//
// The generated stylesheet is committed, so a rebuild must reproduce it exactly.
// No DOM is needed.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

import { buildCss } from "../../scripts/build-tokens.mjs";

const here = import.meta as ImportMeta & { dirname: string };
const committed = readFileSync(
  join(here.dirname, "..", "styles", "tokens.css"),
  "utf8",
);
const generated = await buildCss();

it("generating tokens.css from the token files produces no diff", () => {
  expect(generated).toBe(committed);
});

it("light-dark() wraps only colors", () => {
  const lines = generated
    .split("\n")
    .filter((line) => line.includes("light-dark("));

  expect(lines.length).toBeGreaterThan(0);
  for (const line of lines) {
    expect(line.trim()).toMatch(/^--color-/);
  }
});
