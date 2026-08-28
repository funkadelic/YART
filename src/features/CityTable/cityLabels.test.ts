import { describe, expect, it } from "vitest";

import { fr } from "../../i18n/catalogs/fr";
import { en } from "../../i18n/catalogs/en";
import { numberFormatFor } from "../../i18n/format";
import { buildTableLabels } from "./cityLabels";

describe("buildTableLabels", () => {
  it("carries the catalog's plain entries through untouched", () => {
    const labels = buildTableLabels(en, "en-US");

    expect(labels.loading).toBe(en.loading);
    expect(labels.empty).toBe(en.empty);
    expect(labels.emptyAnnouncement).toBe(en.emptyAnnouncement);
    expect(labels.retry).toBe(en.retry);
    expect(labels.sortClearedAnnouncement).toBe(en.sortClearedAnnouncement);
    expect(labels.unsorted).toBe(en.unsorted);
  });

  // The two function-valued entries are where the catalog and the table disagree
  // about arity: the catalog takes the resolved tag first so a number or a
  // plural can move behind the entry later, and the table takes only what it
  // knows. Closing the tag in here is what keeps those two contracts apart.
  it("closes the resolved tag into the entries the table calls", () => {
    const labels = buildTableLabels(en, "en-US");

    expect(labels.results(25, 500)).toBe(en.results("en-US", 25, 500));
    expect(labels.caption(500, "not sorted")).toBe(
      en.caption("en-US", 500, "not sorted"),
    );
  });

  it("keeps the wording the table shipped with", () => {
    const labels = buildTableLabels(en, "en-US");

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

  // The page controls' strings are a slice of one object rather than a second
  // one the caller assembles, because the table hands them on rather than
  // rendering them, and two objects would be two things to keep in step.
  it("nests the page controls' strings inside the table's own", () => {
    const labels = buildTableLabels(en, "en-US");

    expect(labels.pagination.pageSize).toBe(en.pageSize);
    expect(labels.pagination.navigation).toBe(en.paginationNavigation);
    expect(labels.pagination.firstPage).toBe(en.firstPage);
    expect(labels.pagination.previousPage).toBe(en.previousPage);
    expect(labels.pagination.nextPage).toBe(en.nextPage);
    expect(labels.pagination.lastPage).toBe(en.lastPage);
    expect(labels.pagination.pageStatus(2, 3)).toBe("Page 2 of 3");
  });

  // The page numbers are grouped by the tag closed in here, which is the only
  // reason that entry is a function rather than a template. Both expectations
  // are computed through the platform: the French group separator is a narrow
  // no-break space, and a typed literal holding an ordinary one fails on a
  // difference no terminal renders.
  it("groups the page numbers on the tag it was built with", () => {
    const labels = buildTableLabels(fr, "fr-FR");
    const grouped = numberFormatFor("fr-FR").format(1234);

    expect(grouped).not.toBe("1234");
    expect(labels.pagination.pageStatus(1, 1234)).toContain(grouped);
    expect(labels.pagination.pageStatus(1, 1234)).toBe(
      fr.pageStatus("fr-FR", 1, 1234),
    );
  });
});
