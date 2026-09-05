import { describe, expect, it } from "vitest";

import {
  collatorFor,
  listFormatFor,
  numberFormatFor,
  pluralRulesFor,
  selectPlural,
} from "./format";

/**
 * Two tags whose collation genuinely disagrees, and one that agrees with the
 * base. Spanish treats the tilde as its own letter, so it orders after every
 * plain n; the root collation the other two inherit treats it as a variant of n
 * and decides the pair on the following character instead.
 *
 * The pair is chosen because it is the smallest one where a wrong tag is
 * visible. A cache handing back a formatter built for some other tag is
 * otherwise indistinguishable from a correct one on most input.
 */
const TILDE = "ñu";
const PLAIN = "nz";

/**
 * A number large enough to be grouped, and large enough to select the plural
 * category that only two of the three tags report. One value proves both.
 */
const LARGE = 1234567;

/**
 * Three values, because the separator before the last one is the part a tag
 * decides and a two-item list never shows.
 */
const MANY = ["Drama", "Comedy", "Western"];

describe("collatorFor", () => {
  it("hands back the identical instance for a repeated tag", () => {
    expect(collatorFor("en-US")).toBe(collatorFor("en-US"));
  });

  it("hands back a different instance for a different tag", () => {
    expect(collatorFor("en-US")).not.toBe(collatorFor("es-ES"));
  });

  // The reason this module exists. Naming no tag takes whatever the machine
  // running the code happens to prefer, which is four independent defaults
  // rather than one resolved locale.
  it("orders a pair by the tag it was asked for", () => {
    expect(collatorFor("es-ES").compare(TILDE, PLAIN)).toBeGreaterThan(0);
    expect(collatorFor("en-US").compare(TILDE, PLAIN)).toBeLessThan(0);
    expect(collatorFor("fr-FR").compare(TILDE, PLAIN)).toBeLessThan(0);
  });
});

describe("numberFormatFor", () => {
  it("hands back the identical instance for a repeated tag", () => {
    expect(numberFormatFor("fr-FR")).toBe(numberFormatFor("fr-FR"));
  });

  it("hands back a different instance for a different tag", () => {
    expect(numberFormatFor("fr-FR")).not.toBe(numberFormatFor("es-ES"));
  });

  // Every expected string here is computed rather than typed. The French
  // group separator is a narrow no-break space, and the difference between it
  // and an ordinary space is invisible in every terminal a failure is read in.
  it("groups by the tag it was asked for", () => {
    for (const tag of ["en-US", "es-ES", "fr-FR"]) {
      expect(numberFormatFor(tag).format(LARGE)).toBe(
        new Intl.NumberFormat(tag).format(LARGE),
      );
    }

    expect(numberFormatFor("fr-FR").format(LARGE)).not.toBe(
      numberFormatFor("en-US").format(LARGE),
    );
  });
});

describe("pluralRulesFor", () => {
  it("hands back the identical instance for a repeated tag", () => {
    expect(pluralRulesFor("es-ES")).toBe(pluralRulesFor("es-ES"));
  });

  it("hands back a different instance for a different tag", () => {
    expect(pluralRulesFor("es-ES")).not.toBe(pluralRulesFor("en-US"));
  });

  // Two categories against three is the whole reason a ternary on the count is
  // wrong in half the catalogs that ship.
  it("reports the categories its own tag has, not the base tag's", () => {
    expect(
      pluralRulesFor("en-US").resolvedOptions().pluralCategories.toSorted(),
    ).toEqual(["one", "other"]);
    expect(
      pluralRulesFor("es-ES").resolvedOptions().pluralCategories.toSorted(),
    ).toEqual(["many", "one", "other"]);
  });
});

describe("listFormatFor", () => {
  it("hands back the identical instance for a repeated tag", () => {
    expect(listFormatFor("en-US")).toBe(listFormatFor("en-US"));
  });

  it("hands back a different instance for a different tag", () => {
    expect(listFormatFor("en-US")).not.toBe(listFormatFor("es-ES"));
  });

  // Computed rather than typed, for the same reason the grouping case is: the
  // conjunction and the serial comma differ by tag and a typed expectation
  // would be asserting this file's own idea of Spanish.
  it("joins by the tag it was asked for", () => {
    for (const tag of ["en-US", "es-ES", "fr-FR"]) {
      expect(listFormatFor(tag).format(MANY)).toBe(
        new Intl.ListFormat(tag).format(MANY),
      );
    }

    expect(listFormatFor("es-ES").format(MANY)).not.toBe(
      listFormatFor("en-US").format(MANY),
    );
  });
});

describe("selectPlural", () => {
  const ENGLISH = { one: "city", other: "cities" };
  const SPANISH = { one: "ciudad", many: "ciudades", other: "ciudades" };
  const FRENCH = { one: "ville", many: "villes", other: "villes" };

  it("picks the form for the category the count selects", () => {
    expect(selectPlural("en-US", 1, ENGLISH)).toBe("city");
    expect(selectPlural("en-US", 0, ENGLISH)).toBe("cities");
    expect(selectPlural("en-US", LARGE, ENGLISH)).toBe("cities");
  });

  // Zero is the singular category in French and the plural one in Spanish and
  // English, which is a rule no count-driven ternary in this tree could have
  // expressed.
  it("selects over the reporting tag's categories rather than a pair", () => {
    expect(pluralRulesFor("es-ES").select(1000000)).toBe("many");
    expect(selectPlural("es-ES", 1000000, SPANISH)).toBe(SPANISH.many);

    // Zero is the singular in French and the plural everywhere else here, so a
    // pair keyed on the count alone is wrong in one of the three and reads
    // correct in the other two.
    expect(selectPlural("fr-FR", 0, FRENCH)).toBe(FRENCH.one);
    expect(selectPlural("en-US", 0, ENGLISH)).toBe(ENGLISH.other);
  });
});
