import { describe, expect, it } from "vitest";

import {
  CATALOG_IDS,
  LOCALE_STORAGE_KEY,
  NEGOTIABLE_CATALOG_IDS,
  isCatalogId,
  isLocaleChoice,
  resolveLocale,
} from "./resolveLocale";

describe("resolveLocale", () => {
  describe("an explicit choice", () => {
    // Written out rather than generated. Four catalogs against three fields is
    // shorter as a table than as the loop that would build it, and the table is
    // the only place the whole mapping is visible in one glance.
    it.each([
      ["en", "en-US", "ltr"],
      ["es", "es-ES", "ltr"],
      ["fr", "fr-FR", "ltr"],
      ["ar-XB", "en-US", "rtl"],
    ] as const)("resolves %o to the tag %o and %o", (catalog, tag, dir) => {
      expect(resolveLocale(catalog, [])).toEqual({ catalog, tag, dir });
    });

    // The pseudo-locale's id is a well formed language tag, so an engine
    // carrying Arabic data would happily collate for Arabic if it were passed
    // through. Its strings are English and only its direction is borrowed.
    it("hands the platform English for the pseudo-locale rather than its own id", () => {
      expect(resolveLocale("ar-XB", []).tag).toBe("en-US");
      expect(resolveLocale("ar-XB", []).dir).toBe("rtl");
    });

    it("ignores the preference list entirely", () => {
      expect(resolveLocale("fr", ["es-ES", "en"])).toBe(
        resolveLocale("fr", []),
      );
    });
  });

  describe("following the machine", () => {
    it("takes the first preference whose primary subtag names a catalog", () => {
      expect(resolveLocale("system", ["es-419", "en"]).catalog).toBe("es");
    });

    it("matches a preference carrying no region at all", () => {
      expect(resolveLocale("system", ["fr"]).catalog).toBe("fr");
    });

    it("keeps the preference order rather than the catalog order", () => {
      expect(resolveLocale("system", ["fr-CA", "es-MX"]).catalog).toBe("fr");
      expect(resolveLocale("system", ["es-MX", "fr-CA"]).catalog).toBe("es");
    });

    it("skips a preference that names no catalog", () => {
      expect(resolveLocale("system", ["zz-ZZ", "es"]).catalog).toBe("es");
    });

    // The pseudo-locale's primary subtag is ar, and a reader who genuinely
    // prefers Arabic must not be handed a catalog of bracketed English. It is
    // reachable the only way it should be, by being chosen.
    it("never negotiates the pseudo-locale", () => {
      expect(resolveLocale("system", ["ar-SA", "ar"]).catalog).toBe("en");
    });

    it("falls back to the base catalog when nothing matches", () => {
      expect(resolveLocale("system", ["zz"]).catalog).toBe("en");
    });

    it("falls back to the base catalog when the reader states nothing", () => {
      expect(resolveLocale("system", []).catalog).toBe("en");
    });
  });

  // The store hands this straight to React with no cache in front of it, which
  // only holds because every answer is one of four module constants. A resolver
  // that built its answer would re-render forever instead of failing here.
  it("returns one object identity per answer", () => {
    expect(resolveLocale("system", ["es"])).toBe(resolveLocale("es", []));
    expect(resolveLocale("system", [])).toBe(resolveLocale("en", []));
  });
});

describe("the closed sets", () => {
  it("negotiates every catalog except the pseudo-locale", () => {
    expect(CATALOG_IDS).toEqual(["en", "es", "fr", "ar-XB"]);
    expect(NEGOTIABLE_CATALOG_IDS).toEqual(["en", "es", "fr"]);
  });

  // Duplicated by hand inside the inline script in index.html. The parity guard
  // in toolchain.test.ts reads both, so a rename here fails loudly instead of
  // stranding every stored choice.
  it("keeps the storage key as a plain literal", () => {
    expect(LOCALE_STORAGE_KEY).toBe("yart-locale");
  });

  it("recognizes every shipped catalog id and nothing else", () => {
    for (const id of CATALOG_IDS) {
      expect(isCatalogId(id)).toBe(true);
    }

    expect(isCatalogId("system")).toBe(false);
    expect(isCatalogId("en-GB")).toBe(false);
    expect(isCatalogId(null)).toBe(false);
  });

  it("recognizes a catalog id and the word for following the machine", () => {
    expect(isLocaleChoice("system")).toBe(true);
    expect(isLocaleChoice("fr")).toBe(true);
    expect(isLocaleChoice("klingon")).toBe(false);
  });
});
