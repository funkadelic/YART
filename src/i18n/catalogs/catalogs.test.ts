import { describe, expect, it } from "vitest";

import { CATALOG_IDS } from "../resolveLocale";
import { AUTONYMS, CATALOGS } from "./index";
import { en } from "./en";
import { pseudoize } from "./pseudo";

/** The base catalog's key set, which every other catalog is held to. */
const BASE_KEYS = Object.keys(en).sort();

describe("the catalogs", () => {
  // The type check already fails on a missing or misspelled key, which is the
  // whole reason the catalogs are TypeScript modules. This asserts the same
  // thing at runtime, because the type-level guarantee rests on every catalog
  // actually being declared against the base and a future one declared some
  // other way would lose it silently.
  it("carries the same key set in every catalog", () => {
    for (const id of CATALOG_IDS) {
      expect(Object.keys(CATALOGS[id]).sort(), `the ${id} catalog`).toEqual(
        BASE_KEYS,
      );
    }
  });

  it("maps every shipped id to a catalog and to an autonym", () => {
    expect(Object.keys(CATALOGS).sort()).toEqual([...CATALOG_IDS].sort());
    expect(Object.keys(AUTONYMS).sort()).toEqual([...CATALOG_IDS].sort());
  });

  // A reader who cannot read the interface they are looking at still has to
  // find their own language, which only works while each name is written in the
  // language it names rather than translated into the current one.
  it("names each catalog in its own language", () => {
    expect(AUTONYMS.en).toBe("English");
    expect(AUTONYMS.es).toBe("Español");
    expect(AUTONYMS.fr).toBe("Français");
  });

  // The two function-valued entries are the ones a translation can quietly get
  // wrong: dropping an argument out of the sentence still typechecks, still
  // renders, and leaves a reader in that language with a count they cannot see.
  // Asked of every catalog rather than of the base one, because the base one is
  // the only catalog that cannot have the defect.
  it("weaves every argument into the sentence in every catalog", () => {
    for (const id of CATALOG_IDS) {
      const catalog = CATALOGS[id];

      expect(catalog.results("en-US", 25, 500), `the ${id} catalog`).toMatch(
        /25(?=.*500)/s,
      );
      expect(
        catalog.caption("en-US", 500, "not sorted"),
        `the ${id} catalog`,
      ).toMatch(/500(?=.*not sorted)/s);
    }
  });

  it("translates rather than transliterating the base copy", () => {
    expect(CATALOGS.es.empty).toBe("No se encontraron ciudades");
    expect(CATALOGS.fr.empty).toBe("Aucune ville trouvée");
  });
});

describe("the pseudo-locale", () => {
  // Readable is the whole requirement: the reversal the real right-to-left
  // pseudo-locale performs is dropped so that anyone reading this repository can
  // review the catalog.
  it("keeps the English words readable", () => {
    expect(CATALOGS["ar-XB"].empty).toContain("No cities found");
  });

  it("bounds each message unit so two entries cannot read as one line", () => {
    expect(pseudoize("hello")).toMatch(/^\[.*\]$/);
  });

  // The isolate is what keeps a Latin run rendering as its own run inside a
  // right-to-left document. A directional mark states a direction at a point
  // and cannot bound a run, which is why these two characters and not those.
  it("isolates the readable run", () => {
    const rendered = pseudoize("hello");

    expect(rendered.indexOf("⁦")).toBeLessThan(rendered.indexOf("hello"));
    expect(rendered.indexOf("⁩")).toBeGreaterThan(rendered.indexOf("hello"));
  });

  it("pads by roughly a third, which is about what a real translation costs", () => {
    const message = "123456789";

    expect(pseudoize(message).length).toBeGreaterThanOrEqual(
      message.length + 3,
    );
  });

  it("derives its woven sentences from the base catalog", () => {
    expect(CATALOGS["ar-XB"].results("en-US", 25, 500)).toBe(
      pseudoize(en.results("en-US", 25, 500)),
    );
    expect(CATALOGS["ar-XB"].caption("en-US", 500, "not sorted")).toBe(
      pseudoize(en.caption("en-US", 500, "not sorted")),
    );
  });
});
