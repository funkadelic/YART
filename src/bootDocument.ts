// Runs as a blocking classic inline script before first paint. Shipped as its
// own source text, so bootDocument must stay self-contained.

import {
  CATALOG_IDS,
  LOCALE_STORAGE_KEY,
  NEGOTIABLE_CATALOG_IDS,
  resolveLocale,
  type CatalogId,
  type ResolvedLocale,
} from "./i18n/resolveLocale.ts";
import {
  PREFERS_DARK_QUERY,
  THEME_CHOICES,
  THEME_STORAGE_KEY,
} from "./theme/resolveTheme.ts";

/** Everything the boot script matches against, passed in as JSON. */
export interface BootSettings {
  /** Storage key of the theme choice. */
  readonly themeKey: string;
  /** Media query for the dark system preference. */
  readonly darkQuery: string;
  /** Stored theme words accepted as they are. */
  readonly themes: readonly string[];
  /** Storage key of the locale choice. */
  readonly localeKey: string;
  /** Catalog ids a preference list may select. */
  readonly negotiable: readonly string[];
  /** Each catalog's lang tag and direction. */
  readonly locales: Readonly<
    Record<CatalogId, Pick<ResolvedLocale, "tag" | "dir">>
  >;
  /** The catalog used when nothing else resolves. */
  readonly fallback: CatalogId;
}

/**
 * Stamps the theme and the locale onto the document element. The rules mirror
 * resolveTheme and resolveLocale, which it cannot import.
 */
export function bootDocument(settings: BootSettings): void {
  const root = document.documentElement;

  let theme = "";
  try {
    theme = localStorage.getItem(settings.themeKey) ?? "";
  } catch {
    // Blocked storage says nothing about the system preference.
  }
  if (!settings.themes.includes(theme)) {
    try {
      theme = window.matchMedia(settings.darkQuery).matches ? "dark" : "light";
    } catch {
      theme = "light";
    }
  }
  root.setAttribute("data-theme", theme);
  // The stylesheet's color-scheme has not arrived yet.
  root.style.colorScheme = theme;

  let id = "";
  try {
    id = localStorage.getItem(settings.localeKey) ?? "";
  } catch {
    // Same as the theme read: fall through to the preferences.
  }
  // Own keys only, so "__proto__" or "toString" cannot reach the lookup.
  if (!Object.hasOwn(settings.locales, id)) {
    id = settings.fallback;
    for (const tag of navigator.languages) {
      const wanted = tag.toLowerCase().replace(/-.*/, "");
      if (settings.negotiable.includes(wanted)) {
        id = wanted;
        break;
      }
    }
  }
  const locale = settings.locales[id as CatalogId];
  root.setAttribute("lang", locale.tag);
  root.setAttribute("dir", locale.dir);
}

/** The settings bootDocument ships with, built from the resolver modules. */
export const BOOT_SETTINGS: BootSettings = {
  themeKey: THEME_STORAGE_KEY,
  darkQuery: PREFERS_DARK_QUERY,
  themes: THEME_CHOICES.filter((choice) => choice !== "system"),
  localeKey: LOCALE_STORAGE_KEY,
  negotiable: NEGOTIABLE_CATALOG_IDS,
  locales: Object.fromEntries(
    CATALOG_IDS.map((catalog) => {
      const { tag, dir } = resolveLocale(catalog, []);
      return [catalog, { tag, dir }];
    }),
  ) as BootSettings["locales"],
  fallback: resolveLocale("system", []).catalog,
};

/** The inline script text: bootDocument's source called with its settings. */
export function bootScript(): string {
  return `(${bootDocument.toString()})(${JSON.stringify(BOOT_SETTINGS)})`;
}
