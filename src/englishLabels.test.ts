import { describe, expect, it } from "vitest";

import { englishSearchLabels, englishTableLabels } from "./englishLabels";

const labels = englishTableLabels;

describe("englishTableLabels", () => {
  it("pluralizes and groups the results sentence on the total", () => {
    expect(labels.results(1, 1)).toBe("Showing 1 of 1 row");
    expect(labels.results(10, 1234)).toBe("Showing 10 of 1,234 rows");
  });

  it("pluralizes and groups the caption on the total", () => {
    expect(labels.caption(1, "not sorted")).toBe("1 row, not sorted");
    expect(labels.caption(50250, labels.sortSummary("Name", "asc"))).toBe(
      "50,250 rows, sorted by Name, ascending",
    );
  });

  it("names the column and direction in the sort sentences", () => {
    expect(labels.sortedAnnouncement("Name", "desc")).toBe(
      "Sorted by Name, descending",
    );
    expect(labels.sortSummary("Name", "desc")).toBe(
      "sorted by Name, descending",
    );
  });

  it("prefixes the host's error message", () => {
    expect(labels.error("timeout")).toBe("Error: timeout");
  });

  it("groups the page count", () => {
    expect(labels.pagination.pageStatus(2, 1234)).toBe("Page 2 of 1,234");
  });

  it("holds dataset-neutral fixed strings", () => {
    expect(labels).toMatchObject({
      loading: "Loading...",
      empty: "No rows found",
      emptyAnnouncement: "No rows found for that search",
      retry: "Try again",
      sortClearedAnnouncement: "Sort removed",
      unsorted: "not sorted",
      pagination: {
        pageSize: "Rows per page",
        navigation: "Pagination",
        firstPage: "First page",
        previousPage: "Previous page",
        nextPage: "Next page",
        lastPage: "Last page",
      },
    });
  });
});

describe("englishSearchLabels", () => {
  it("names the box and describes the search", () => {
    expect(englishSearchLabels).toEqual({
      name: "Search",
      placeholder: "Search the table",
    });
  });
});
