import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { CityTable } from "./CityTable";
import type { City } from "../../api/getCities";

// Fifty rows rather than the handful the neighbouring suite renders. At the
// default page size that is five pages, which is the smallest set a position
// can be restored into, paged away from, and pushed past the end of.
const PAGED_CITIES: City[] = Array.from({ length: 50 }, (_, index) => ({
  id: index + 1,
  name: `City ${index + 1}`,
  nameAscii: `City ${index + 1}`,
  country: `Country ${index + 1}`,
  countryIso3: `C${index.toString().padStart(2, "0")}`,
  capital: index % 2 === 0 ? "primary" : "admin",
  population: 1000000 + index * 100000,
}));

const defaultProps = {
  data: PAGED_CITIES,
  onSearchChange: vi.fn(),
  loading: false,
  // The honest default for a fixture that already carries rows.
  datasetReady: true,
  error: null,
};

/** Puts a query in the address the way a shared link delivers one. */
const openAt = (search: string) => {
  window.history.replaceState(null, "", search);
};

describe("CityTable and the address", () => {
  it("paints the page named in the address on the first render", () => {
    openAt("?page=2");

    render(<CityTable {...defaultProps} />);

    expect(screen.getByText("Page 2 of 5")).toBeInTheDocument();
    expect(screen.getByText("City 11")).toBeInTheDocument();
    expect(screen.queryByText("City 1")).not.toBeInTheDocument();
  });

  it("leaves a link that is already canonical exactly as it arrived", () => {
    openAt("?page=2");

    render(<CityTable {...defaultProps} />);

    expect(window.location.search).toBe("?page=2");
  });

  it("writes the position into the address when the reader pages away", async () => {
    // The session disables the delay between keystrokes rather than taking the
    // default. A later plan puts a controlled clock in this file for the
    // debounce cases, and the toolchain guard fails the build for any file that
    // combines a controlled clock with a session that is not bound to it, so
    // every session here is written in the form that survives that addition.
    const user = userEvent.setup({ delay: null });

    render(<CityTable {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Go to next page" }));

    expect(screen.getByText("Page 2 of 5")).toBeInTheDocument();
    expect(window.location.search).toBe("?page=2");
  });

  it("re-hydrates the table when a back navigation lands on another position", () => {
    render(<CityTable {...defaultProps} />);

    openAt("?page=3");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(screen.getByText("Page 3 of 5")).toBeInTheDocument();
    // The write runs again for the restored state and finds the address already
    // equal to it, so the traversal costs no second write.
    expect(window.location.search).toBe("?page=3");
  });

  // The empty branch in the shared table asks how many rows the slice produced,
  // not how many rows there are, so a position that reaches the slice without
  // passing through the clamp renders the no-results copy over rows that exist.
  // The clamp is what stops that, and it corrects the read alone: the position
  // the reader was handed stays where they can see it, so a set that widens
  // again puts them back and a position arriving before its rows do is not
  // corrected against no rows at all.
  it("shows the last page that exists for a position past the end, and leaves that position in the address", () => {
    openAt("?page=999");

    render(<CityTable {...defaultProps} />);

    expect(screen.getByText("Page 5 of 5")).toBeInTheDocument();
    expect(screen.getByText("City 50")).toBeInTheDocument();
    expect(screen.queryByText("No cities found")).not.toBeInTheDocument();
    expect(window.location.search).toBe("?page=999");
  });

  // What makes one Back press leave the site rather than walking the reader
  // back through positions they never asked to record.
  it("adds no history entry for any amount of paging", async () => {
    const user = userEvent.setup({ delay: null });

    render(<CityTable {...defaultProps} />);

    const entriesBefore = window.history.length;

    await user.click(screen.getByRole("button", { name: "Go to next page" }));
    await user.click(screen.getByRole("button", { name: "Go to last page" }));
    await user.click(
      screen.getByRole("button", { name: "Go to previous page" }),
    );
    await user.selectOptions(screen.getByLabelText("Per page:"), "25");

    expect(window.history.length).toBe(entriesBefore);
  });

  // The case a suite that only ever sets parameters never reaches: an empty
  // query has to be written as the path, because the empty string resolves to
  // the address it was given and leaves the stale query in place.
  it("clears the query completely when the reader returns to the first page", async () => {
    const user = userEvent.setup({ delay: null });

    render(<CityTable {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Go to last page" }));
    expect(window.location.search).toBe("?page=5");

    await user.click(screen.getByRole("button", { name: "Go to first page" }));

    expect(screen.getByText("Page 1 of 5")).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });

  it("paints the sort named in the address on the first render", () => {
    openAt("?sort=-population");

    render(<CityTable {...defaultProps} />);

    // The header cell's own attribute rather than the row order, because that
    // is where the state lives and what a screen reader reads: matching row
    // order would also pass for a table that happened to arrive sorted.
    expect(
      screen.getByRole("columnheader", { name: /Population/ }),
    ).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByText("City 50")).toBeInTheDocument();
  });

  it("writes the sort token as the reader cycles a column, and removes the key when the sort clears", async () => {
    const user = userEvent.setup({ delay: null });

    render(<CityTable {...defaultProps} />);

    const header = screen.getByRole("button", { name: "Population" });

    await user.click(header);
    expect(window.location.search).toBe("?sort=population");

    await user.click(header);
    expect(window.location.search).toBe("?sort=-population");

    // Removed outright rather than written empty: an unsorted table is the
    // default, and the address states nothing it does not have to.
    await user.click(header);
    expect(window.location.search).toBe("");
  });

  it("paints an offered page size named in the address, and shows it in the select", () => {
    openAt("?size=25");

    render(<CityTable {...defaultProps} />);

    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Per page:")).toHaveValue("25");
  });

  it("falls back to the default for a size the table does not offer, leaving the select on one of its own options", () => {
    openAt("?size=7");

    render(<CityTable {...defaultProps} />);

    const select = screen.getByLabelText<HTMLSelectElement>("Per page:");
    const offered = Array.from(select.options).map((option) => option.value);

    expect(screen.getByText("Page 1 of 5")).toBeInTheDocument();
    expect(offered).toContain(select.value);
  });

  it("re-hydrates the sort, the position, and the page size together on one back navigation", () => {
    render(<CityTable {...defaultProps} />);

    openAt("?sort=-population&page=2&size=25");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    // All three in one update, which is what holding the view state as one
    // object buys: three separate writes would be three chances to paint a
    // position against a page size it was not chosen for.
    expect(
      screen.getByRole("columnheader", { name: /Population/ }),
    ).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Per page:")).toHaveValue("25");
    expect(screen.getByText("City 1")).toBeInTheDocument();
  });

  // The pair below is one rule read from both sides. A restored sort is still a
  // first render, so announcing it tells a reader who has just followed a link
  // that something happened when nothing did. A traversal after a real press is
  // the opposite case: that reader did sort, and the region is the only thing
  // that reports where the traversal put them.
  it("stays silent when a back navigation restores a sort the reader never applied", () => {
    const { container } = render(<CityTable {...defaultProps} />);

    const announcer = container.querySelector(
      '[aria-live="polite"][aria-atomic="true"]',
    );
    expect(announcer).toBeEmptyDOMElement();

    openAt("?sort=-population");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(announcer).toBeEmptyDOMElement();
  });

  it("still announces when a back navigation follows a sort the reader did apply", async () => {
    const user = userEvent.setup({ delay: null });
    const { container } = render(<CityTable {...defaultProps} />);

    const announcer = container.querySelector(
      '[aria-live="polite"][aria-atomic="true"]',
    );

    await user.click(screen.getByRole("button", { name: "City" }));
    expect(announcer).toHaveTextContent(
      "Table sorted by City in ascending order",
    );

    openAt("?sort=-population");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(announcer).toHaveTextContent(
      "Table sorted by Population in descending order",
    );
  });

  it("carries a tracking parameter and an unrecognized key through a write, behind the keys it owns", async () => {
    const user = userEvent.setup({ delay: null });

    // dir is not a key this schema owns: the column and the direction ride one
    // signed token, so an incoming direction is a stranger's parameter rather
    // than an invalid value, and preserving it is the rule working.
    openAt("?utm_source=x&dir=sideways");

    render(<CityTable {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Go to next page" }));

    expect(window.location.search).toBe("?page=2&utm_source=x&dir=sideways");
  });
});
