// The theme's vocabulary and the one rule that turns it into something a
// selector can match. Everything the inline script in index.html duplicates by
// hand is declared here.

/**
 * Every state the theme control offers, in the order it offers them.
 *
 * A value rather than a bare union, so the accepted set has one definition that
 * both the hook's stored-choice check and the parity guard in
 * src/toolchain.test.ts can read. The locale's own vocabulary derives its union
 * from a tuple the same way, for the same reason.
 */
export const THEME_CHOICES = ["light", "dark", "system"] as const;

/** The literal union of the words above, formed with no assertion anywhere. */
export type ThemeChoice = (typeof THEME_CHOICES)[number];

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
 * loads, so it cannot import this function. A change to either one needs the
 * same change to the other, and the parity guard in src/toolchain.test.ts is
 * what fails when they stop agreeing.
 */
export function resolveTheme(
  choice: ThemeChoice,
  prefersDark: boolean,
): ResolvedTheme {
  if (choice === "system") return prefersDark ? "dark" : "light";
  return choice;
}
