// The theme's vocabulary and the one rule that turns it into something a
// selector can match. Everything the inline script in index.html duplicates by
// hand is declared here.

/** A tuple, so the accepted set has one definition the type is derived from. */
export const THEME_CHOICES = ["light", "dark", "system"] as const;

/** The literal union of the words above, formed with no assertion anywhere. */
export type ThemeChoice = (typeof THEME_CHOICES)[number];

export type ResolvedTheme = "light" | "dark";

/** The storage key. The inline script in index.html spells this out by hand. */
export const THEME_STORAGE_KEY = "yart-theme";

/** The media query. The inline script in index.html spells this out by hand. */
export const PREFERS_DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Turns a choice plus the system preference into the theme the document element
 * carries; the attribute is never "system". Written again as a literal in the
 * inline script of every shell, and the parity guard holds all the copies
 * together.
 */
export function resolveTheme(
  choice: ThemeChoice,
  prefersDark: boolean,
): ResolvedTheme {
  if (choice === "system") return prefersDark ? "dark" : "light";
  return choice;
}
