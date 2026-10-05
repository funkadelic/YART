import { describe, expect, it } from "vitest";

import {
  PREFERS_DARK_QUERY,
  THEME_CHOICES,
  THEME_STORAGE_KEY,
  isExplicitTheme,
  resolveTheme,
  type ThemeChoice,
} from "./resolveTheme";

// All six combinations. The function has two inputs and one of them has three
// values, so the exhaustive table written out is shorter than the loop that
// would cover it and says plainly which case is which.
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
  // preference must not reach the result at all. It gets its own assertion
  // because a resolver that ignored the choice for one value would still pass
  // four of the six rows above.
  it("ignores the system preference whenever the choice is explicit", () => {
    for (const choice of ["light", "dark"] as const) {
      expect(resolveTheme(choice, true)).toBe(resolveTheme(choice, false));
    }
  });
});

describe("theme constants", () => {
  // The boot script reads both through BOOT_SETTINGS, so a rename here changes
  // it too; pinned so a rename cannot strand every stored choice silently.
  it("keeps the storage key and the media query as plain literals", () => {
    expect(THEME_STORAGE_KEY).toBe("yart-theme");
    expect(PREFERS_DARK_QUERY).toBe("(prefers-color-scheme: dark)");
  });

  // Pinned so adding or dropping a state is a deliberate edit. The boot script
  // accepts the non-default members, through BOOT_SETTINGS.
  it("keeps the three states and their order", () => {
    expect(THEME_CHOICES).toEqual(["light", "dark", "system"]);
  });
});

describe("isExplicitTheme", () => {
  it.each(["light", "dark"])("accepts %o", (value) => {
    expect(isExplicitTheme(value)).toBe(true);
  });

  it.each(["system", "blue", "", "DARK", null, 1])("rejects %o", (value) => {
    expect(isExplicitTheme(value)).toBe(false);
  });
});
