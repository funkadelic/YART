// The theme's vocabulary and the one rule that turns it into something a
// selector can match. Everything the inline script in index.html duplicates by
// hand is declared here.

export type ThemeChoice = "light" | "dark" | "system";

export type ResolvedTheme = "light" | "dark";

/** The storage key. The inline script in index.html spells this out by hand. */
export const THEME_STORAGE_KEY = "yart-theme";

/** The media query. The inline script in index.html spells this out by hand. */
export const PREFERS_DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * The rule that turns a stored choice plus the operating system's preference into
 * the concrete theme the document element carries. The attribute is never the
 * word "system": that is a choice, not a theme, and a selector cannot resolve it.
 *
 * This same rule is written a second time, as a literal, inside the blocking
 * inline script in index.html. It has to be: that script runs before any module
 * loads, so it cannot import this function. A change to either one needs the same
 * change to the other, and nothing in the suite asserts that they agree.
 */
export function resolveTheme(
  choice: ThemeChoice,
  prefersDark: boolean,
): ResolvedTheme {
  if (choice === "system") return prefersDark ? "dark" : "light";
  return choice;
}
