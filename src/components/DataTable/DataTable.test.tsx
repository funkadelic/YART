import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { collatorFor } from "../../i18n/format";
import { columns } from "./column";
import { DataTable, type DataTableLabels } from "./DataTable";
import { DEFAULT_TABLE_STATE } from "./tableState";

/** A row type the application never has, so the table is tested on its own. */
interface Part {
  sku: string;
  qty: number;
}

const builder = columns<Part>(collatorFor("en-US"));

/** Two columns, one of them numeric. */
const PART_COLUMNS = [
  builder.key("sku", { label: "SKU" }),
  builder.key("qty", { label: "Quantity", numeric: true }),
];

/** Keys a part by its stock number. */
const partId = (part: Part) => part.sku;

const labels: DataTableLabels = {
  loading: "Loading parts...",
  empty: "No parts found",
  emptyAnnouncement: "No parts found for that search",
  results: (shown, total) => `Showing ${shown} parts out of ${total}`,
  caption: (total, sortSummary) => `Parts, ${total} entries, ${sortSummary}`,
  error: (message) => `Error: ${message}`,
  retry: "Try again",
  sortedAnnouncement: (column, direction) => `Sorted by ${column} ${direction}`,
  sortClearedAnnouncement: "Sort cleared",
  unsorted: "unsorted",
  sortSummary: (column, direction) => `sorted by ${column} ${direction}`,
  pagination: {
    pageSize: "Per page:",
    navigation: "Pagination",
    firstPage: "Go to first page",
    previousPage: "Go to previous page",
    nextPage: "Go to next page",
    lastPage: "Go to last page",
    pageStatus: (page, totalPages) => `Page ${page} of ${totalPages}`,
  },
};

/** The props every case shares; each case supplies the request state. */
const baseProps = {
  rows: [] as readonly Part[],
  columns: PART_COLUMNS,
  getRowId: partId,
  state: DEFAULT_TABLE_STATE,
  onSortChange: vi.fn(),
  onPageChange: vi.fn(),
  onPageSizeChange: vi.fn(),
  labels,
};

describe("DataTable", () => {
  it("does not claim an empty search before the first request starts", () => {
    // A container's first paint, before its effect raises the loading flag.
    // Nothing has been searched for, so the empty copy would be a false claim.
    render(
      <DataTable
        {...baseProps}
        loading={false}
        datasetReady={false}
        errorMessage={null}
      />,
    );

    expect(screen.getByText("Loading parts...")).toBeInTheDocument();
    expect(screen.queryByText("No parts found")).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(
      "No parts found for that search",
    );
  });

  it("offers no retry control when no handler is given", () => {
    render(
      <DataTable
        {...baseProps}
        loading={false}
        datasetReady={false}
        errorMessage="The part data could not be downloaded."
      />,
    );

    expect(
      screen.getByText("Error: The part data could not be downloaded."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });
});
