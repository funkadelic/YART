import { describe, expect, it } from "vitest";

import { required } from "../../test/required";
import { numberFormatFor, pluralRulesFor } from "../format";
import { CATALOG_IDS, resolveLocale } from "../resolveLocale";
import { AUTONYMS, CATALOGS } from "./index";
import { en } from "./en";
import { pseudoize } from "./pseudo";

/** The base catalog's key set, which every other catalog is held to. */
const BASE_KEYS = Object.keys(en).sort();

/**
 * Counts wide enough to reach every plural category any shipped tag reports.
 * Zero and one separate French from the other two, and the round million is the
 * only value that reaches the third category Spanish and French both have.
 */
const PROBE_COUNTS = [0, 1, 2, 1000000];

/** A count large enough that every shipped tag groups it, and groups it differently. */
const GROUPED = 1234567;

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
      expect(catalog.error("it went wrong"), `the ${id} catalog`).toContain(
        "it went wrong",
      );
      expect(
        catalog.sortedAnnouncement("Population", "asc"),
        `the ${id} catalog`,
      ).toContain("Population");
      expect(
        catalog.sortSummary("Population", "asc"),
        `the ${id} catalog`,
      ).toContain("Population");
      expect(catalog.pageStatus("en-US", 2, 3), `the ${id} catalog`).toMatch(
        /2(?=.*3)/s,
      );
    }
  });

  // The direction arrives at these two entries as a value so that each language
  // can spell the pair out. A catalog that ignored it would render one word for
  // both states, which typechecks, renders, and tells a reader the opposite of
  // what the table is doing half the time.
  it("says something different for each sort direction in every catalog", () => {
    for (const id of CATALOG_IDS) {
      const catalog = CATALOGS[id];

      expect(
        catalog.sortedAnnouncement("Population", "asc"),
        `the ${id} catalog`,
      ).not.toBe(catalog.sortedAnnouncement("Population", "desc"));
      expect(
        catalog.sortSummary("Population", "asc"),
        `the ${id} catalog`,
      ).not.toBe(catalog.sortSummary("Population", "desc"));
    }
  });

  // The record of plural forms in each catalog is total over the categories its
  // own tag reports, and nothing in the type system can check that: the category
  // set is CLDR data rather than a type, so the selection narrows the platform's
  // answer to what the catalog declared. This is what makes that narrowing
  // sound. A missing arm shows up as the word undefined inside a sentence a
  // reader would have been shown.
  it("declares a plural form for every category its own tag reports", () => {
    for (const id of CATALOG_IDS) {
      const { tag } = resolveLocale(id, []);
      const rules = pluralRulesFor(tag);
      const categories = rules.resolvedOptions().pluralCategories;

      expect(categories.length, `the ${id} catalog`).toBeGreaterThanOrEqual(2);

      for (const category of categories) {
        const count = required(
          PROBE_COUNTS.find((probe) => rules.select(probe) === category),
          `a count selecting ${category} under ${tag}`,
        );
        const catalog = CATALOGS[id];

        expect(
          catalog.results(tag, count, count),
          `the ${id} catalog at ${category}`,
        ).not.toContain("undefined");
        expect(
          catalog.caption(tag, count, "not sorted"),
          `the ${id} catalog at ${category}`,
        ).not.toContain("undefined");
      }
    }
  });

  // Grouped through the platform on the resolved tag rather than by hand, and
  // asserted against a string computed at test time rather than typed. The
  // French group separator is a narrow no-break space, and a typed literal
  // holding an ordinary one fails on a difference no terminal renders.
  it("groups every count it weaves in on its own tag", () => {
    for (const id of CATALOG_IDS) {
      const { tag } = resolveLocale(id, []);
      const grouped = numberFormatFor(tag).format(GROUPED);
      const catalog = CATALOGS[id];

      expect(
        catalog.results(tag, GROUPED, GROUPED),
        `the ${id} catalog`,
      ).toContain(grouped);
      expect(
        catalog.caption(tag, GROUPED, "not sorted"),
        `the ${id} catalog`,
      ).toContain(grouped);
      expect(
        catalog.pageStatus(tag, 1, GROUPED),
        `the ${id} catalog`,
      ).toContain(grouped);
      expect(grouped, `the ${id} catalog`).not.toBe(String(GROUPED));
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
