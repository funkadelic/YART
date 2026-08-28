import { describe, expect, it } from "vitest";

import { en } from "../../i18n/catalogs/en";
import { buildTableLabels } from "./cityLabels";

describe("buildTableLabels", () => {
  it("carries the catalog's plain entries through untouched", () => {
    const labels = buildTableLabels(en, "en-US");

    expect(labels.loading).toBe(en.loading);
    expect(labels.empty).toBe(en.empty);
    expect(labels.emptyAnnouncement).toBe(en.emptyAnnouncement);
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
  });
});
