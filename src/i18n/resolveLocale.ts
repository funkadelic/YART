// The locale's vocabulary and the rule that turns a stored choice plus the
// reader's preferences into a resolved locale. Everything the inline script in
// index.html duplicates by hand is declared here.

/** Every catalog that ships. The last is a pseudo-locale, not a language. */
export const CATALOG_IDS = ["en", "es", "fr", "ar-XB"] as const;

/** The literal union of the ids above, formed with no assertion anywhere. */
export type CatalogId = (typeof CATALOG_IDS)[number];

/**
 * The catalogs a preference list may select. The pseudo-locale's primary
 * subtag is ar, and negotiation matches on that, so an unfiltered walk would
 * serve bracketed English to a reader who wants Arabic. Excluding it here
 * leaves it reachable by being chosen.
 */
export const NEGOTIABLE_CATALOG_IDS = ["en", "es", "fr"] as const;

/** The word rather than an id means follow the machine, the default. */
export type LocaleChoice = CatalogId | "system";

/** The storage key. The inline script in index.html spells this out by hand. */
export const LOCALE_STORAGE_KEY = "yart-locale";

/** Three fields, because the pseudo-locale borrows a direction, not a tag. */
export interface ResolvedLocale {
  /** Which catalog supplies the strings. */
  readonly catalog: CatalogId;
  /** The language tag every platform formatter and the lang attribute get. */
  readonly tag: string;
  /** The direction the document element carries. */
  readonly dir: "ltr" | "rtl";
}

/** dir written out; Intl.Locale getTextInfo is above the browser floor. */
const RESOLVED_LOCALES = {
  en: { catalog: "en", tag: "en-US", dir: "ltr" },
  es: { catalog: "es", tag: "es-ES", dir: "ltr" },
  fr: { catalog: "fr", tag: "fr-FR", dir: "ltr" },
  "ar-XB": { catalog: "ar-XB", tag: "en-US", dir: "rtl" },
} as const satisfies Readonly<Record<CatalogId, ResolvedLocale>>;

/** The one gate between a reader-controlled string and the closed union. */
export function isCatalogId(value: unknown): value is CatalogId {
  // Widened for the search, since the tuple's own includes rejects an unknown.
  return (CATALOG_IDS as readonly unknown[]).includes(value);
}

/** Whether a value names something the picker can be set to. */
export function isLocaleChoice(value: unknown): value is LocaleChoice {
  return value === "system" || isCatalogId(value);
}

/**
 * A language tag's primary subtag. The separator is searched for, so a tag
 * carrying none takes a real branch; a split would index a position that can
 * never be absent.
 */
function primarySubtag(tag: string): string {
  const separator = tag.indexOf("-");

  return (separator === -1 ? tag : tag.slice(0, separator)).toLowerCase();
}

/**
 * Turns a choice plus a preference list into a resolved locale, always one of
 * four module constants, so identity is stable. Written a second time as a
 * literal in index.html's inline script; the parity guard holds the two.
 */
export function resolveLocale(
  choice: LocaleChoice,
  preferences: readonly string[],
): ResolvedLocale {
  if (choice !== "system") {
    return RESOLVED_LOCALES[choice];
  }

  for (const preference of preferences) {
    const wanted = primarySubtag(preference);
    const match = NEGOTIABLE_CATALOG_IDS.find(
      (id) => primarySubtag(id) === wanted,
    );

    if (match) {
      return RESOLVED_LOCALES[match];
    }
  }

  return RESOLVED_LOCALES.en;
}
