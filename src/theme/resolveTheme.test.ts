import { describe, expect, it } from "vitest";

import {
  PREFERS_DARK_QUERY,
  THEME_STORAGE_KEY,
  resolveTheme,
  type ThemeChoice,
} from "./resolveTheme";

// All six combinations, written out rather than generated. The function has two
// inputs and one of them has three values, so the exhaustive table is shorter
// than the loop that would cover it and says plainly which case is which.
const CASES: Array<[ThemeChoice, boolean, string]> = [
  ["light", false, "light"],
  ["light", true, "light"],
  ["dark", false, "dark"],
  ["dark", true, "dark"],
  ["system", false, "light"],
  ["system", true, "dark"],
];

describe("resolveTheme", () => {
  for (const [choice, prefersDark, expected] of CASES) {
    it(`resolves ${choice} with prefersDark=${prefersDark} to ${expected}`, () => {
      expect(resolveTheme(choice, prefersDark)).toBe(expected);
    });
  }

  // An explicit choice is the user overriding the operating system, so the
  // preference must not reach the result at all. Asserted as its own property
  // rather than left implied by the table above, because a resolver that ignored
  // the choice for one value would still pass four of those six rows.
  it("ignores the system preference whenever the choice is explicit", () => {
    for (const choice of ["light", "dark"] as const) {
      expect(resolveTheme(choice, true)).toBe(resolveTheme(choice, false));
    }
  });
});

describe("theme constants", () => {
  // Both are duplicated by hand inside the inline script in index.html. The
  // structural guard in tokens.test.ts imports these and looks for them there,
  // so a rename here fails loudly instead of stranding every stored choice.
  it("keeps the storage key and the media query as plain literals", () => {
    expect(THEME_STORAGE_KEY).toBe("yart-theme");
    expect(PREFERS_DARK_QUERY).toBe("(prefers-color-scheme: dark)");
  });
});
