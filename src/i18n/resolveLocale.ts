// The locale's vocabulary and the one rule that turns a stored choice plus the
// reader's own preferences into something the document, the catalogs and the
// platform formatters can each act on. Everything the inline script in
// index.html duplicates by hand is declared here.

/**
 * Every catalog that ships, in the order the picker offers them.
 *
 * The last is not a language. It is the readable right-to-left pseudo-locale
 * that exists so direction and truncation have something to prove themselves
 * against, because the other three are all left to right.
 */
export const CATALOG_IDS = ["en", "es", "fr", "ar-XB"] as const;

/** The literal union of the ids above, formed with no assertion anywhere. */
export type CatalogId = (typeof CATALOG_IDS)[number];

/**
 * The catalogs a preference list is allowed to select.
 *
 * The pseudo-locale is excluded because its primary subtag is ar, and an
 * unfiltered walk would hand a reader who genuinely prefers Arabic a catalog of
 * bracketed English. It stays reachable the only way it should be, by being
 * chosen.
 */
export const NEGOTIABLE_CATALOG_IDS = ["en", "es", "fr"] as const;

/**
 * What the reader picked. The word rather than a catalog id means follow the
 * machine, which is the default and is a choice like any other rather than the
 * absence of one.
 */
export type LocaleChoice = CatalogId | "system";

/** The storage key. The inline script in index.html spells this out by hand. */
export const LOCALE_STORAGE_KEY = "yart-locale";

/**
 * A resolved locale is three fields rather than one: which catalog supplies the
 * strings, which language tag the platform formatters get, and which direction
 * the document carries.
 *
 * The split is load-bearing rather than tidy. The pseudo-locale's id is a well
 * formed language tag, so an engine carrying Arabic data would collate and
 * format for Arabic if the id were passed through, and jsdom, Chromium and Node
 * would each answer differently for reasons that have nothing to do with this
 * code. Its strings really are English, so its tag is English and only its
 * direction is borrowed.
 */
export interface ResolvedLocale {
  /** Which catalog supplies the strings. */
  readonly catalog: CatalogId;
  /** The language tag every platform formatter and the lang attribute get. */
  readonly tag: string;
  /** The direction the document element carries. */
  readonly dir: "ltr" | "rtl";
}

/**
 * The whole mapping, as literals.
 *
 * Direction is written out rather than asked of Intl.Locale.prototype
 * getTextInfo, which is Chrome 130, Firefox 153 and Safari 17 against this
 * app's floor of Chrome 111, Firefox 111 and Safari 16.4. Node 24 carries it,
 * so a test of it under this runner would pass while Firefox 111 through 152
 * threw at the reader.
 *
 * Indexed only by a value of the closed union, so the lookup is total and there
 * is no fallback arm here that nothing can reach.
 */
const RESOLVED_LOCALES = {
  en: { catalog: "en", tag: "en-US", dir: "ltr" },
  es: { catalog: "es", tag: "es-ES", dir: "ltr" },
  fr: { catalog: "fr", tag: "fr-FR", dir: "ltr" },
  "ar-XB": { catalog: "ar-XB", tag: "en-US", dir: "rtl" },
} as const satisfies Readonly<Record<CatalogId, ResolvedLocale>>;

/**
 * Whether a value names a catalog that ships. The one gate between a
 * reader-controlled string, from storage or from another document, and a lookup
 * in a record keyed by the closed union.
 */
export function isCatalogId(value: unknown): value is CatalogId {
  // Widened for the search alone. The array is a closed tuple of catalog ids,
  // so its own includes rejects an unknown argument outright, and the whole
  // point here is to ask about one.
  return (CATALOG_IDS as readonly unknown[]).includes(value);
}

/** Whether a value names something the picker can be set to. */
export function isLocaleChoice(value: unknown): value is LocaleChoice {
  return value === "system" || isCatalogId(value);
}

/**
 * A language tag's primary subtag, lowercased, which is the unit the lookup
 * below matches on. Written with a search rather than a split so a tag carrying
 * no separator takes a real branch instead of an index access that can never be
 * absent.
 */
function primarySubtag(tag: string): string {
  const separator = tag.indexOf("-");

  return (separator === -1 ? tag : tag.slice(0, separator)).toLowerCase();
}

/**
 * The rule that turns a choice plus the reader's preference list into the
 * locale everything downstream reads.
 *
 * An explicit choice wins outright. Otherwise the preferences are walked in
 * order and the first one whose primary subtag names a negotiable catalog is
 * taken, which is the lookup rule from the language-tag matching standard
 * reduced to the part this app can answer. Nothing matching is the base catalog
 * rather than a failure, so the function is total and no caller has a throw to
 * handle.
 *
 * Every answer is one of four module constants, so the same input returns the
 * same object identity. The store below depends on that: it is what lets a
 * snapshot reader be handed straight to React without a cache in front of it.
 *
 * This same rule is written a second time, as a literal, inside the blocking
 * inline script in index.html. It has to be: that script runs before any module
 * loads, so it cannot import this function. The guard in src/toolchain.test.ts
 * is what holds the two copies together.
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
