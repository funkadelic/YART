import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

import { CityTable } from "./CityTable";
import App from "../../App";
import { RootLayout } from "../RootLayout";
import { getCities } from "../../api/getCities";
import type { City } from "../../api/getCities";

// One case in this file renders the whole application, because the property it
// asserts belongs to the address and not to either component. A link carrying a
// term has to produce exactly one request, and that is only observable where
// the request is issued. The factory delegates to the real module, so nothing
// else in the file changes behavior.
vi.mock("../../api/getCities", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/getCities")>();
  return { ...actual, getCities: vi.fn(actual.getCities) };
});

/**
 * How long typing has to pause before the term is committed. The same window
 * the feature applies, restated here because a test that reached in for the
 * constant would pass for any window at all.
 */
const SEARCH_DEBOUNCE_MS = 150;

// Fifty rows, where the neighboring suite renders a handful. At the default
// page size that is five pages, the smallest set a position can be restored
// into, paged away from, and pushed past the end of.
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
  errorMessage: null,
};

/** Puts a query in the address the way a shared link delivers one. */
const openAt = (search: string) => {
  window.history.replaceState(null, "", search);
};

// Unconditional, because a file that installs a controlled clock in one block
// and never puts the real one back leaks the frozen clock into whatever runs
// next, and a restore that only runs on the happy path leaves that hole open.
afterEach(() => {
  vi.useRealTimers();
});

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
    // The session disables the delay between keystrokes. This file later gains
    // a controlled clock for the debounce cases, and the toolchain guard fails
    // the build for any file that combines a controlled clock with a session
    // that is not bound to it, so every session here is written in the form
    // that survives that addition.
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
  // The clamp stops that, and it corrects the read alone. The position the
  // reader was handed stays where they can see it, so a set that widens again
  // puts them back, and a position arriving before its rows do is never
  // corrected against no rows at all.
  it("shows the last page that exists for a position past the end, and leaves that position in the address", () => {
    openAt("?page=999");

    render(<CityTable {...defaultProps} />);

    expect(screen.getByText("Page 5 of 5")).toBeInTheDocument();
    expect(screen.getByText("City 50")).toBeInTheDocument();
    expect(screen.queryByText("No cities found")).not.toBeInTheDocument();
    expect(window.location.search).toBe("?page=999");
  });

  // One Back press leaves the site, and never walks the reader back through
  // positions they never asked to record.
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

    expect(window.history).toHaveLength(entriesBefore);
  });

  // A suite that only ever sets parameters never reaches this case. An empty
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

    // The header cell's own attribute, because that is where the state lives
    // and what a screen reader reads. Matching row order would also pass for a
    // table that happened to arrive sorted.
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

    // Removed outright, because an unsorted table is the default and the
    // address states nothing it does not have to.
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
    // object buys. Three separate writes would be three chances to paint a
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
  // the other side. That reader did sort, and the region is the only thing that
  // reports where the traversal put them.
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

  // The address is a convenience and the table is not. Browsers rate limit
  // history mutation, and past the limit the call throws; a held Enter key on
  // the paging control reaches that ceiling over a collection with this many
  // pages. Unguarded, the throw lands in a commit-phase effect and the boundary
  // around the main slot replaces the whole view with its fallback, so the
  // reader loses the table over a link that failed to update.
  it("keeps the table rendered when the browser refuses the address write", async () => {
    const user = userEvent.setup({ delay: null });
    vi.spyOn(window.history, "replaceState").mockImplementation(() => {
      throw new DOMException(
        "Attempt to use history.replaceState() more than 100 times per 30 seconds",
        "SecurityError",
      );
    });

    render(
      <RootLayout domain="cities">
        <CityTable {...defaultProps} />
      </RootLayout>,
    );

    await user.click(screen.getByRole("button", { name: "Go to next page" }));

    expect(screen.getByText("Page 2 of 5")).toBeInTheDocument();
    expect(screen.getByText("City 11")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("carries a tracking parameter and an unrecognized key through a write, behind the keys it owns", async () => {
    const user = userEvent.setup({ delay: null });

    // dir is not a key this schema owns. The column and the direction ride one
    // signed token, so an incoming direction is a stranger's parameter and not
    // an invalid value of a key this table reads, and preserving it is the rule
    // working.
    openAt("?utm_source=x&dir=sideways");

    render(<CityTable {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Go to next page" }));

    expect(window.location.search).toBe("?page=2&utm_source=x&dir=sideways");
  });
});

describe("CityTable, the address, and the search term", () => {
  it("paints all five values on the first render for a link that carries all four keys", () => {
    openAt("?q=City&sort=-population&page=2&size=25");

    render(<CityTable {...defaultProps} />);

    expect(screen.getByRole("textbox", { name: "Search" })).toHaveValue("City");
    expect(
      screen.getByRole("columnheader", { name: /Population/ }),
    ).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Per page:")).toHaveValue("25");
    // Already canonical, so the arriving link is left exactly as it was.
    expect(window.location.search).toBe(
      "?q=City&sort=-population&page=2&size=25",
    );
  });

  it("issues one request, for the term the link carries, on a cold start", () => {
    openAt("?q=tokyo&sort=-population&page=2&size=25");

    const seam = vi.mocked(getCities);
    // Never settles, so the request is counted without a resolution landing
    // outside the render this case drives. What is asserted is which request
    // went out, not what came back.
    seam.mockReturnValue(new Promise<City[]>(() => {}));

    // Restored here, because the shared teardown restores spies and this seam
    // is not one. It is a plain mock function standing in for a module export,
    // so nothing global reaches it. Without this, the next
    // case in this file to render the application gets a request that never
    // resolves and reads as a bug in the code under test.
    try {
      render(<App />);

      expect(seam).toHaveBeenCalledTimes(1);
      expect(seam).toHaveBeenCalledWith({ searchTerm: "tokyo" });
    } finally {
      seam.mockRestore();
    }
  });

  it("restores the box, reports the term upward, and applies the other values in the same update", () => {
    const onSearchChange = vi.fn();

    render(<CityTable {...defaultProps} onSearchChange={onSearchChange} />);

    openAt("?q=kyoto&sort=-population&page=2&size=25");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(screen.getByRole("textbox", { name: "Search" })).toHaveValue(
      "kyoto",
    );
    expect(onSearchChange).toHaveBeenCalledTimes(1);
    expect(onSearchChange).toHaveBeenCalledWith("kyoto");
    expect(
      screen.getByRole("columnheader", { name: /Population/ }),
    ).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Per page:")).toHaveValue("25");
  });

  // A link stating the defaults out loud is the same view as a link stating
  // nothing, so the write that follows removes all four keys and leaves the
  // address a bare path.
  it("leaves no query at all for a link whose every value is the default", () => {
    openAt("?q=&sort=&page=1&size=10");

    render(<CityTable {...defaultProps} />);

    expect(screen.getByRole("textbox", { name: "Search" })).toHaveValue("");
    expect(screen.getByText("Page 1 of 5")).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });
});

// The clock is installed here and nowhere else in this file. The cases above
// run on a real one, and the ones below are about when a write happens, which
// is not observable without owning the clock.
describe("CityTable and the debounced address write", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("writes the address once and reports upward once, after typing pauses", async () => {
    const user = userEvent.setup({ delay: null });
    const onSearchChange = vi.fn();
    const replaceState = vi.spyOn(window.history, "replaceState");

    render(<CityTable {...defaultProps} onSearchChange={onSearchChange} />);

    await user.type(screen.getByRole("textbox", { name: "Search" }), "tokyo");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS - 1);
    });
    expect(replaceState).not.toHaveBeenCalled();
    expect(onSearchChange).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(onSearchChange).toHaveBeenCalledTimes(1);
    expect(onSearchChange).toHaveBeenCalledWith("tokyo");
    expect(window.location.search).toBe("?q=tokyo");
  });

  // The narrow window where a traversal and a commit are both in play. The
  // keystrokes belong to the view the reader has left, so letting them land
  // afterwards desyncs all three surfaces at once. The box would show the
  // restored term while the rows, the position, and the address carried the
  // typed one.
  it("drops a commit still pending when a back navigation lands inside the window", async () => {
    const user = userEvent.setup({ delay: null });
    const onSearchChange = vi.fn();

    render(<CityTable {...defaultProps} onSearchChange={onSearchChange} />);

    await user.type(screen.getByRole("textbox", { name: "Search" }), "tokyo");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS - 1);
    });

    openAt("?q=kyoto&page=2");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    // Well past the boundary the canceled commit would have fired at.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS * 2);
    });

    expect(screen.getByRole("textbox", { name: "Search" })).toHaveValue(
      "kyoto",
    );
    expect(screen.getByText("Page 2 of 5")).toBeInTheDocument();
    expect(window.location.search).toBe("?q=kyoto&page=2");
    expect(onSearchChange).toHaveBeenCalledTimes(1);
    expect(onSearchChange).toHaveBeenCalledWith("kyoto");
  });

  it("writes nothing further when the reader pauses again without typing", async () => {
    const user = userEvent.setup({ delay: null });
    const replaceState = vi.spyOn(window.history, "replaceState");

    render(<CityTable {...defaultProps} />);

    await user.type(screen.getByRole("textbox", { name: "Search" }), "tokyo");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    });
    expect(replaceState).toHaveBeenCalledTimes(1);

    // The state is unchanged, so the serialized address equals the one already
    // in the bar and the guard ahead of the write stops a second one.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    });

    expect(replaceState).toHaveBeenCalledTimes(1);
  });

  // A trailing space is what a reader types before a second word, and the
  // debounce commits on the pause between the two. The search matches on a
  // trimmed term and the address writes a trimmed term, so that keystroke
  // changes no row and has to change no view. The position stays where the
  // reader left it, the address keeps the key that would restore it on a
  // reload or a share, and nothing untrimmed is ever reported upward to be
  // scanned for a second time.
  it("keeps the position and the page in the address when a trailing space follows the term", async () => {
    const user = userEvent.setup({ delay: null });
    const onSearchChange = vi.fn();

    render(<CityTable {...defaultProps} onSearchChange={onSearchChange} />);

    await user.type(screen.getByRole("textbox", { name: "Search" }), "City");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    });
    await user.click(screen.getByRole("button", { name: "Go to last page" }));

    expect(screen.getByText("Page 5 of 5")).toBeInTheDocument();
    expect(window.location.search).toBe("?q=City&page=5");

    await user.type(screen.getByRole("textbox", { name: "Search" }), " ");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    });

    // The box still paints what was typed, so the trim belongs at the commit
    // and not in the box.
    expect(screen.getByRole("textbox", { name: "Search" })).toHaveValue(
      "City ",
    );
    expect(screen.getByText("Page 5 of 5")).toBeInTheDocument();
    expect(window.location.search).toBe("?q=City&page=5");
    expect(onSearchChange).toHaveBeenLastCalledWith("City");
    expect(onSearchChange).not.toHaveBeenCalledWith("City ");
  });
});
