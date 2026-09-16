import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Pagination, type PaginationLabels } from "./Pagination";

const labels: PaginationLabels = {
  pageSize: "Per page:",
  navigation: "Pagination",
  firstPage: "Go to first page",
  previousPage: "Go to previous page",
  nextPage: "Go to next page",
  lastPage: "Go to last page",
  pageStatus: (page, totalPages) => `Page ${page} of ${totalPages}`,
};

/** Renders the controls at one position and returns the page change spy. */
function renderAt(page: number) {
  const onPageChange = vi.fn();

  render(
    <Pagination
      page={page}
      totalPages={3}
      pageSize={10}
      onPageChange={onPageChange}
      onPageSizeChange={vi.fn()}
      labels={labels}
    />,
  );

  return onPageChange;
}

describe("Pagination", () => {
  it("ignores first and previous on the first page", async () => {
    const user = userEvent.setup();
    const onPageChange = renderAt(1);

    await user.click(screen.getByRole("button", { name: "Go to first page" }));
    await user.click(
      screen.getByRole("button", { name: "Go to previous page" }),
    );

    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("ignores next and last on the last page", async () => {
    const user = userEvent.setup();
    const onPageChange = renderAt(3);

    await user.click(screen.getByRole("button", { name: "Go to next page" }));
    await user.click(screen.getByRole("button", { name: "Go to last page" }));

    expect(onPageChange).not.toHaveBeenCalled();
  });
});
