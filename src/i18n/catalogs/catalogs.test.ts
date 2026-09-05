import { describe, expect, it } from "vitest";

import { DATASET_ERROR_CODES } from "../../api/getCities";
import { required } from "../../test/required";
import { listFormatFor, numberFormatFor, pluralRulesFor } from "../format";
import { CATALOG_IDS, resolveLocale } from "../resolveLocale";
import { AUTONYMS, CATALOGS } from "./index";
import { en, type DomainId } from "./en";
import { pseudoize } from "./pseudo";

/** The domains, taken off the base catalog so a third arrives here on its own. */
const DOMAIN_IDS = Object.keys(en).filter(
  (key): key is DomainId => key !== "common",
);

/** The base catalog's key sets, which every other catalog is held to. */
const BASE_KEYS = Object.keys(en).sort();
const BASE_COMMON_KEYS = Object.keys(en.common).sort();

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
      const catalog = CATALOGS[id];

      expect(Object.keys(catalog).sort(), `the ${id} catalog`).toEqual(
        BASE_KEYS,
      );
      expect(
        Object.keys(catalog.common).sort(),
        `the ${id} catalog's common half`,
      ).toEqual(BASE_COMMON_KEYS);
    }
  });

  // The phase's central claim: both domains are the same shape, so a films entry
  // present in English and missing in French is a compile error. A satisfies
  // clause is one deletion away from being gone, and the deletion looks like
  // tidying, so the claim is asserted here too. Walked rather than restated: a
  // twelfth key added to both domains arrives without touching this file.
  it("carries the same key set in both domains of every catalog", () => {
    for (const id of CATALOG_IDS) {
      const catalog = CATALOGS[id];
      const [first, ...rest] = DOMAIN_IDS.map((domain) =>
        Object.keys(catalog[domain]).sort(),
      );

      for (const keys of rest) {
        expect(keys, `the ${id} catalog's domains`).toEqual(first);
      }
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

  // The function-valued entries are the ones a translation can quietly get
  // wrong: dropping an argument out of the sentence still typechecks, still
  // renders, and leaves a reader in that language with a count they cannot see.
  // Asked of every catalog rather than of the base one, because the base one is
  // the only catalog that cannot have the defect.
  it("weaves every argument into the chrome sentences in every catalog", () => {
    for (const id of CATALOG_IDS) {
      const { common } = CATALOGS[id];

      expect(common.error("it went wrong"), `the ${id} catalog`).toContain(
        "it went wrong",
      );
      expect(
        common.sortedAnnouncement("Population", "asc"),
        `the ${id} catalog`,
      ).toContain("Population");
      expect(
        common.sortSummary("Population", "asc"),
        `the ${id} catalog`,
      ).toContain("Population");
      expect(common.pageStatus("en-US", 2, 3), `the ${id} catalog`).toMatch(
        /2(?=.*3)/s,
      );
    }
  });

  it("weaves every argument into the page sentences of both domains", () => {
    for (const id of CATALOG_IDS) {
      for (const domain of DOMAIN_IDS) {
        const copy = CATALOGS[id][domain];
        const where = `the ${id} catalog, ${domain}`;

        expect(copy.results("en-US", 25, 500), where).toMatch(/25(?=.*500)/s);
        expect(copy.caption("en-US", 500, "not sorted"), where).toMatch(
          /500(?=.*not sorted)/s,
        );
      }
    }
  });

  // A multi-valued cell joins through the platform on the resolved tag, so no
  // component and no column builder writes a separator of its own. The
  // expectation is computed rather than typed: the conjunction and the spacing
  // are CLDR data, and a typed literal would be English pinned into the loop.
  it("joins a multi-valued list on its own tag in every catalog", () => {
    const values = ["one", "two", "three"];

    for (const id of CATALOG_IDS) {
      const { tag } = resolveLocale(id, []);
      const joined = CATALOGS[id].common.list(tag, values);

      for (const value of values) {
        expect(joined, `the ${id} catalog`).toContain(value);
      }
      expect(joined, `the ${id} catalog`).toContain(
        listFormatFor(tag).format(values),
      );
    }
  });

  // Every failure the loader can report has a sentence in every catalog and in
  // every domain, and a missing arm is a reader shown the word undefined at the
  // moment the application has already failed. The type check catches an absent
  // key; this catches an entry present and empty, and it walks the code tuple
  // rather than restating it, so a code added to the loader arrives here alone.
  it("says something for every dataset failure in every catalog", () => {
    for (const id of CATALOG_IDS) {
      for (const domain of DOMAIN_IDS) {
        const { datasetError } = CATALOGS[id][domain];

        for (const code of DATASET_ERROR_CODES) {
          expect(
            datasetError[code]("en-US", 7).trim(),
            `the ${id} catalog, ${domain}, ${code}`,
          ).not.toBe("");
        }
      }
    }
  });

  // The three sentences that name a number are the ones a translation can
  // quietly drop: the row failures and the status failure all read fluently
  // without it and tell the reader nothing.
  it("weaves the detail into every dataset failure that names one", () => {
    for (const id of CATALOG_IDS) {
      for (const domain of DOMAIN_IDS) {
        const { datasetError } = CATALOGS[id][domain];

        for (const code of ["rowShape", "rowFieldType", "status"] as const) {
          expect(
            datasetError[code]("en-US", 404),
            `the ${id} catalog, ${domain}, ${code}`,
          ).toContain("404");
        }
      }
    }
  });

  // The two domains report different failures for the same code. Collapsing the
  // nine sentences into one set taking the noun as an argument would typecheck
  // and would break on gender and agreement in Spanish and French, so this is
  // what says the two sets are genuinely written out rather than shared.
  it("names its own subject in each domain's failure sentences", () => {
    for (const id of CATALOG_IDS) {
      const sentences = new Set(
        DOMAIN_IDS.map((domain) =>
          CATALOGS[id][domain].datasetError.notAnObject("en-US", 0),
        ),
      );

      expect(sentences.size, `the ${id} catalog`).toBe(DOMAIN_IDS.length);
    }
  });

  // The direction arrives at these two entries as a value so that each language
  // can spell the pair out. A catalog that ignored it would render one word for
  // both states, which typechecks, renders, and tells a reader the opposite of
  // what the table is doing half the time.
  it("says something different for each sort direction in every catalog", () => {
    for (const id of CATALOG_IDS) {
      const { common } = CATALOGS[id];

      expect(
        common.sortedAnnouncement("Population", "asc"),
        `the ${id} catalog`,
      ).not.toBe(common.sortedAnnouncement("Population", "desc"));
      expect(
        common.sortSummary("Population", "asc"),
        `the ${id} catalog`,
      ).not.toBe(common.sortSummary("Population", "desc"));
    }
  });

  // The city attribution is a licence obligation rather than copy: it has to
  // credit the creator, link the source, link the licence and say the work was
  // changed, in every language. The film credit is a courtesy and carries the
  // same three parts anyway. The two identifiers travel through both as
  // arguments and a translation that dropped either one would leave the footer
  // with a link it never rendered.
  it("carries both attribution identifiers in every catalog and domain", () => {
    for (const id of CATALOG_IDS) {
      for (const domain of DOMAIN_IDS) {
        const sentence = CATALOGS[id][domain].attribution(
          "a source name",
          "a licence name",
        );

        expect(sentence, `the ${id} catalog, ${domain}`).toContain(
          "a source name",
        );
        expect(sentence, `the ${id} catalog, ${domain}`).toContain(
          "a licence name",
        );
      }
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

        for (const domain of DOMAIN_IDS) {
          const copy = CATALOGS[id][domain];
          const where = `the ${id} catalog, ${domain}, at ${category}`;

          expect(copy.results(tag, count, count), where).not.toContain(
            "undefined",
          );
          expect(copy.caption(tag, count, "not sorted"), where).not.toContain(
            "undefined",
          );
        }
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
        catalog.common.pageStatus(tag, 1, GROUPED),
        `the ${id} catalog`,
      ).toContain(grouped);

      for (const domain of DOMAIN_IDS) {
        const copy = catalog[domain];
        const where = `the ${id} catalog, ${domain}`;

        expect(copy.results(tag, GROUPED, GROUPED), where).toContain(grouped);
        expect(copy.caption(tag, GROUPED, "not sorted"), where).toContain(
          grouped,
        );
      }

      expect(grouped, `the ${id} catalog`).not.toBe(String(GROUPED));
    }
  });

  it("translates rather than transliterating the base copy", () => {
    expect(CATALOGS.es.cities.empty).toBe("No se encontraron ciudades");
    expect(CATALOGS.fr.cities.empty).toBe("Aucune ville trouvée");
    expect(CATALOGS.es.films.empty).toBe("No se encontraron películas");
    expect(CATALOGS.fr.films.empty).toBe("Aucun film trouvé");
  });

  // The column headings are the one part of a domain block the shape type has
  // to key loosely, because the two domains have different columns. The outer
  // satisfies clause still holds every catalog to the base's ids; what it
  // cannot say is that a heading carries a word.
  it("gives every column of every domain a heading in every catalog", () => {
    for (const id of CATALOG_IDS) {
      for (const domain of DOMAIN_IDS) {
        const headings = Object.entries(CATALOGS[id][domain].columns);

        expect(headings.length, `the ${id} catalog, ${domain}`).toBeGreaterThan(
          0,
        );

        for (const [key, heading] of headings) {
          expect(
            heading.trim(),
            `the ${id} catalog, ${domain}.${key}`,
          ).not.toBe("");
        }
      }
    }
  });
});

describe("the pseudo-locale", () => {
  // Readable is the whole requirement: the reversal the real right-to-left
  // pseudo-locale performs is dropped so that anyone reading this repository can
  // review the catalog.
  it("keeps the English words readable", () => {
    expect(CATALOGS["ar-XB"].cities.empty).toContain("No cities found");
    expect(CATALOGS["ar-XB"].films.empty).toContain("No films found");
  });

  it("bounds each message unit so two entries cannot read as one line", () => {
    expect(pseudoize("hello")).toMatch(/^\[.*\]$/);
  });

  // The isolate is what keeps a Latin run rendering as its own run inside a
  // right-to-left document. A directional mark states a direction at a point
  // and cannot bound a run, which is why these two characters and not those.
  it("isolates the readable run", () => {
    const rendered = pseudoize("hello");

    expect(rendered.indexOf("\u2066")).toBeLessThan(rendered.indexOf("hello"));
    expect(rendered.indexOf("\u2069")).toBeGreaterThan(
      rendered.indexOf("hello"),
    );
  });

  it("pads by roughly a third, which is about what a real translation costs", () => {
    const message = "123456789";

    expect(pseudoize(message).length).toBeGreaterThanOrEqual(
      message.length + 3,
    );
  });

  it("derives its woven sentences from the base catalog", () => {
    for (const domain of DOMAIN_IDS) {
      const copy = CATALOGS["ar-XB"][domain];

      expect(copy.results("en-US", 25, 500)).toBe(
        pseudoize(en[domain].results("en-US", 25, 500)),
      );
      expect(copy.caption("en-US", 500, "not sorted")).toBe(
        pseudoize(en[domain].caption("en-US", 500, "not sorted")),
      );
    }
  });
});
