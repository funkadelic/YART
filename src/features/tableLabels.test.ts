import { describe, expect, it } from "vitest";

import { fr } from "../i18n/catalogs/fr";
import { en } from "../i18n/catalogs/en";
import { numberFormatFor } from "../i18n/format";
import { buildSearchLabels, buildTableLabels } from "./tableLabels";

describe("buildTableLabels", () => {
  it("carries the catalog's plain entries through untouched", () => {
    const labels = buildTableLabels(en, "cities", "en-US");

    expect(labels.loading).toBe(en.cities.loading);
    expect(labels.empty).toBe(en.cities.empty);
    expect(labels.emptyAnnouncement).toBe(en.cities.emptyAnnouncement);
    expect(labels.retry).toBe(en.common.retry);
    expect(labels.sortClearedAnnouncement).toBe(
      en.common.sortClearedAnnouncement,
    );
    expect(labels.unsorted).toBe(en.common.unsorted);
  });

  // The two function-valued entries are where the catalog and the table disagree
  // about arity. The catalog takes the resolved tag first so a number or a
  // plural can move behind the entry later, and the table takes only what it
  // knows. Closing the tag in here keeps those two contracts apart.
  it("closes the resolved tag into the entries the table calls", () => {
    const labels = buildTableLabels(en, "cities", "en-US");

    expect(labels.results(25, 500)).toBe(en.cities.results("en-US", 25, 500));
    expect(labels.caption(500, "not sorted")).toBe(
      en.cities.caption("en-US", 500, "not sorted"),
    );
  });

  it("keeps the wording the table shipped with", () => {
    const labels = buildTableLabels(en, "cities", "en-US");

    expect(labels.results(25, 500)).toBe(
      "Showing 25 cities out of 500 total results",
    );
    expect(labels.caption(500, "not sorted")).toBe(
      "City data with 500 entries, currently not sorted",
    );
    expect(labels.error("it went wrong")).toBe("Error: it went wrong");
    expect(labels.sortedAnnouncement("City", "asc")).toBe(
      "Table sorted by City in ascending order",
    );
    expect(labels.sortSummary("City", "desc")).toBe(
      "sorted by City descending",
    );
  });

  // There is one builder because the domain decides the page copy and nothing
  // more. A second near-copy differing only in which keys it read is what the
  // split catalog rules out.
  it("takes the page copy from the domain it is given and the chrome from neither", () => {
    const cities = buildTableLabels(en, "cities", "en-US");
    const films = buildTableLabels(en, "films", "en-US");

    expect(films.loading).toBe(en.films.loading);
    expect(films.empty).toBe(en.films.empty);
    expect(films.caption(500, "not sorted")).toBe(
      en.films.caption("en-US", 500, "not sorted"),
    );
    expect(films.loading).not.toBe(cities.loading);

    expect(films.retry).toBe(cities.retry);
    expect(films.unsorted).toBe(cities.unsorted);
    expect(films.pagination.nextPage).toBe(cities.pagination.nextPage);
  });

  // The page controls' strings are a slice of one object, because the table
  // hands them on without rendering them and two objects would be two things to
  // keep in step.
  it("nests the page controls' strings inside the table's own", () => {
    const labels = buildTableLabels(en, "cities", "en-US");

    expect(labels.pagination.pageSize).toBe(en.common.pageSize);
    expect(labels.pagination.navigation).toBe(en.common.paginationNavigation);
    expect(labels.pagination.firstPage).toBe(en.common.firstPage);
    expect(labels.pagination.previousPage).toBe(en.common.previousPage);
    expect(labels.pagination.nextPage).toBe(en.common.nextPage);
    expect(labels.pagination.lastPage).toBe(en.common.lastPage);
    expect(labels.pagination.pageStatus(2, 3)).toBe("Page 2 of 3");
  });

  // The page numbers are grouped by the tag closed in here, which is why that
  // entry is a function and not a template. Both expectations are computed
  // through the platform, because the French group separator is a narrow
  // no-break space and a typed literal holding an ordinary one fails on a
  // difference no terminal renders.
  it("groups the page numbers on the tag it was built with", () => {
    const labels = buildTableLabels(fr, "cities", "fr-FR");
    const grouped = numberFormatFor("fr-FR").format(1234);

    expect(grouped).not.toBe("1234");
    expect(labels.pagination.pageStatus(1, 1234)).toContain(grouped);
    expect(labels.pagination.pageStatus(1, 1234)).toBe(
      fr.common.pageStatus("fr-FR", 1, 1234),
    );
  });
});

describe("buildSearchLabels", () => {
  // The accessible name is the same word on both pages and the placeholder is
  // not, so one entry comes off the common half and one off the domain. No tag,
  // because neither of them weaves a number.
  it("names the box in common and places its hint per domain", () => {
    const cities = buildSearchLabels(en, "cities");
    const films = buildSearchLabels(en, "films");

    expect(cities.name).toBe(en.common.searchName);
    expect(films.name).toBe(cities.name);

    expect(cities.placeholder).toBe(en.cities.searchPlaceholder);
    expect(films.placeholder).toBe(en.films.searchPlaceholder);
    expect(films.placeholder).not.toBe(cities.placeholder);
  });
});
