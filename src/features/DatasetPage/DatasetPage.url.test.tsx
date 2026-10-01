import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

import type { City } from "../../api/getCities";
import type { Film } from "../../api/getFilms";
import { SYNC_SORT_ROWS } from "../../hooks/useSortedRows";
import { required } from "../../test/required";
import { CITY_PAGE } from "../cities/cityPage";
import { FILM_PAGE } from "../films/filmPage";
import { DatasetPage } from "./DatasetPage";

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

/** The city page with a search that answers the fifty rows above for any term. */
const pageOf = () => ({
  ...CITY_PAGE,
  search: vi.fn<(typeof CITY_PAGE)["search"]>(() =>
    Promise.resolve(PAGED_CITIES),
  ),
});

/** City columns whose name comparator throws during a sort. */
const throwingNameColumns: (typeof CITY_PAGE)["buildColumns"] = (
  catalog,
  tag,
) =>
  CITY_PAGE.buildColumns(catalog, tag).map((column) =>
    column.id === "name"
      ? {
          ...column,
          compare: () => {
            throw new Error("comparator broke");
          },
        }
      : column,
  );

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

describe("DatasetPage and the address", () => {
  it("paints the page named in the address on the first render", async () => {
    openAt("?page=2");

    render(<DatasetPage config={pageOf()} />);
    await screen.findByRole("table");

    expect(screen.getByText("Page 2 of 5")).toBeInTheDocument();
    expect(screen.getByText("City 11")).toBeInTheDocument();
    expect(screen.queryByText("City 1")).not.toBeInTheDocument();
  });

  it("leaves a link that is already canonical exactly as it arrived", async () => {
    openAt("?page=2");

    render(<DatasetPage config={pageOf()} />);
    await screen.findByRole("table");

    expect(window.location.search).toBe("?page=2");
  });

  it("writes the position into the address when the reader pages away", async () => {
    // The session disables the delay between keystrokes. This file later gains
    // a controlled clock for the debounce cases, and the toolchain guard fails
    // the build for any file that combines a controlled clock with a session
    // that is not bound to it, so every session here is written in the form
    // that survives that addition.
    const user = userEvent.setup({ delay: null });

    render(<DatasetPage config={pageOf()} />);
    await screen.findByRole("table");

    await user.click(screen.getByRole("button", { name: "Go to next page" }));

    expect(screen.getByText("Page 2 of 5")).toBeInTheDocument();
    expect(window.location.search).toBe("?page=2");
  });

  it("re-hydrates the table when a back navigation lands on another position", async () => {
    render(<DatasetPage config={pageOf()} />);
    await screen.findByRole("table");

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
  it("shows the last page that exists for a position past the end, and leaves that position in the address", async () => {
    openAt("?page=999");

    render(<DatasetPage config={pageOf()} />);
    await screen.findByRole("table");

    expect(screen.getByText("Page 5 of 5")).toBeInTheDocument();
    expect(screen.getByText("City 50")).toBeInTheDocument();
    expect(screen.queryByText("No cities found")).not.toBeInTheDocument();
    expect(window.location.search).toBe("?page=999");
  });

  // One Back press leaves the site, and never walks the reader back through
  // positions they never asked to record.
  it("adds no history entry for any amount of paging", async () => {
    const user = userEvent.setup({ delay: null });

    render(<DatasetPage config={pageOf()} />);
    await screen.findByRole("table");

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

    render(<DatasetPage config={pageOf()} />);
    await screen.findByRole("table");

    await user.click(screen.getByRole("button", { name: "Go to last page" }));
    expect(window.location.search).toBe("?page=5");

    await user.click(screen.getByRole("button", { name: "Go to first page" }));

    expect(screen.getByText("Page 1 of 5")).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });

  it("writes the path and the fragment, not a bare question mark, when the query empties", async () => {
    const user = userEvent.setup({ delay: null });
    openAt("?page=5#credits");
    const pathBefore = window.location.pathname;

    render(<DatasetPage config={pageOf()} />);
    await screen.findByRole("table");

    await user.click(screen.getByRole("button", { name: "Go to first page" }));

    // All three: an address built from the wrong operator is not a string at
    // all, and the empty search alone is satisfied by that too.
    expect(window.location.search).toBe("");
    expect(window.location.pathname).toBe(pathBefore);
    expect(window.location.hash).toBe("#credits");
  });

  it("paints the sort named in the address on the first render", async () => {
    openAt("?sort=-population");

    render(<DatasetPage config={pageOf()} />);
    await screen.findByRole("table");

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

    render(<DatasetPage config={pageOf()} />);
    await screen.findByRole("table");

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

  it("paints an offered page size named in the address, and shows it in the select", async () => {
    openAt("?size=25");

    render(<DatasetPage config={pageOf()} />);
    await screen.findByRole("table");

    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Per page:")).toHaveValue("25");
  });

  it("falls back to the default for a size the table does not offer, leaving the select on one of its own options", async () => {
    openAt("?size=7");

    render(<DatasetPage config={pageOf()} />);
    await screen.findByRole("table");

    const select = screen.getByLabelText<HTMLSelectElement>("Per page:");
    const offered = Array.from(select.options).map((option) => option.value);

    expect(screen.getByText("Page 1 of 5")).toBeInTheDocument();
    expect(offered).toContain(select.value);
  });

  it("re-hydrates the sort, the position, and the page size together on one back navigation", async () => {
    render(<DatasetPage config={pageOf()} />);
    await screen.findByRole("table");

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
  it("stays silent when a back navigation restores a sort the reader never applied", async () => {
    const { container } = render(<DatasetPage config={pageOf()} />);
    await screen.findByRole("table");

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
    const { container } = render(<DatasetPage config={pageOf()} />);
    await screen.findByRole("table");

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

    render(<DatasetPage config={pageOf()} />);
    await screen.findByRole("table");

    await user.click(screen.getByRole("button", { name: "Go to next page" }));

    expect(screen.getByText("Page 2 of 5")).toBeInTheDocument();
    expect(screen.getByText("City 11")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("brings the table back from the address when the recovery control follows a render throw", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    openAt("?page=2");
    const user = userEvent.setup({ delay: null });

    // Later searches never settle, so the table can only return from rows
    // fetched before the throw.
    const search = vi
      .fn<(typeof CITY_PAGE)["search"]>(() => new Promise<City[]>(() => {}))
      .mockResolvedValueOnce(PAGED_CITIES);
    const config = {
      ...CITY_PAGE,
      buildColumns: throwingNameColumns,
      search,
    };

    render(<DatasetPage config={config} />);
    await screen.findByText("Page 2 of 5");

    await user.click(screen.getByRole("button", { name: "City" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "could not be displayed",
    );
    expect(window.location.search).toBe("?page=2");

    await user.click(screen.getByRole("button", { name: "Show it again" }));

    await screen.findByText("Page 2 of 5");
    expect(screen.getByText("City 11")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /City/ })).toHaveAttribute(
      "aria-sort",
      "none",
    );
    expect(
      screen.queryByText(/could not be displayed/),
    ).not.toBeInTheDocument();
    expect(window.location.search).toBe("?page=2");
    expect(consoleError).toHaveBeenCalled();
  });

  it("keeps a sort that failed across frames out of the address, so the recovery control brings the table back", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    openAt("?page=2");
    const user = userEvent.setup({ delay: null });

    // Over the in-render limit, so the sort runs after the busy render commits.
    const rows = Array.from({ length: SYNC_SORT_ROWS + 1 }, (_, index) => ({
      ...required(PAGED_CITIES[0], "a city"),
      id: index + 1,
      name: `City ${index + 1}`,
    }));
    const search = vi
      .fn<(typeof CITY_PAGE)["search"]>(() => new Promise<City[]>(() => {}))
      .mockResolvedValueOnce(rows);
    const config = {
      ...CITY_PAGE,
      buildColumns: throwingNameColumns,
      search,
    };

    render(<DatasetPage config={config} />);
    await screen.findByText(/^Page 2 of/);

    await user.click(screen.getByRole("button", { name: "City" }));

    expect(
      await screen.findByText(/could not be displayed/),
    ).toBeInTheDocument();
    expect(window.location.search).toBe("?page=2");

    await user.click(screen.getByRole("button", { name: "Show it again" }));

    await screen.findByText(/^Page 2 of/);
    expect(screen.getByRole("columnheader", { name: /City/ })).toHaveAttribute(
      "aria-sort",
      "none",
    );
    expect(
      screen.queryByText(/could not be displayed/),
    ).not.toBeInTheDocument();
    expect(window.location.search).toBe("?page=2");
    expect(consoleError).toHaveBeenCalled();
  });

  it("carries a tracking parameter and an unrecognized key through a write, behind the keys it owns", async () => {
    const user = userEvent.setup({ delay: null });

    // dir is not a key this schema owns. The column and the direction ride one
    // signed token, so an incoming direction is a stranger's parameter and not
    // an invalid value of a key this table reads, and preserving it is the rule
    // working.
    openAt("?utm_source=x&dir=sideways");

    render(<DatasetPage config={pageOf()} />);
    await screen.findByRole("table");

    await user.click(screen.getByRole("button", { name: "Go to next page" }));

    expect(window.location.search).toBe("?page=2&utm_source=x&dir=sideways");
  });
});

describe("DatasetPage, the address, and the search term", () => {
  it("paints all five values on the first render for a link that carries all four keys", async () => {
    openAt("?q=City&sort=-population&page=2&size=25");

    render(<DatasetPage config={pageOf()} />);
    await screen.findByRole("table");

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

    // Never settles: what is asserted is which request went out, not what came
    // back.
    const search = vi.fn<(typeof CITY_PAGE)["search"]>(
      () => new Promise<City[]>(() => {}),
    );

    render(<DatasetPage config={{ ...CITY_PAGE, search }} />);

    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith({ searchTerm: "tokyo" });
  });

  it("restores the box, searches the restored term, and applies the other values in the same update", async () => {
    const config = pageOf();

    render(<DatasetPage config={config} />);
    await screen.findByRole("table");

    openAt("?q=kyoto&sort=-population&page=2&size=25");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(screen.getByRole("textbox", { name: "Search" })).toHaveValue(
      "kyoto",
    );
    // One search on mount, then one for the restored term.
    expect(config.search).toHaveBeenCalledTimes(2);
    expect(config.search).toHaveBeenLastCalledWith({ searchTerm: "kyoto" });
    expect(
      screen.getByRole("columnheader", { name: /Population/ }),
    ).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Per page:")).toHaveValue("25");
  });

  it("issues no request for a sort, a page change, a size change, or a traversal that keeps the term", async () => {
    openAt("?q=City");
    const user = userEvent.setup({ delay: null });
    const config = pageOf();

    render(<DatasetPage config={config} />);
    await screen.findByRole("table");

    await user.click(screen.getByRole("button", { name: "City" }));
    await user.click(screen.getByRole("button", { name: "Go to next page" }));
    await user.selectOptions(screen.getByLabelText("Per page:"), "25");

    openAt("?q=City&page=2");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(screen.getByText("Page 2 of 5")).toBeInTheDocument();
    // The term is the only thing the request is keyed on.
    expect(config.search).toHaveBeenCalledTimes(1);
    expect(config.search).toHaveBeenCalledWith({ searchTerm: "City" });
  });

  // A link stating the defaults out loud is the same view as a link stating
  // nothing, so the write that follows removes all four keys and leaves the
  // address a bare path.
  it("leaves no query at all for a link whose every value is the default", async () => {
    openAt("?q=&sort=&page=1&size=10");

    render(<DatasetPage config={pageOf()} />);
    await screen.findByRole("table");

    expect(screen.getByRole("textbox", { name: "Search" })).toHaveValue("");
    expect(screen.getByText("Page 1 of 5")).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });
});

// The clock is installed here and nowhere else in this file. The cases above
// run on a real one, and the ones below are about when a write happens, which
// is not observable without owning the clock.
describe("DatasetPage and the debounced address write", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("writes the address once and searches once, after typing pauses", async () => {
    const user = userEvent.setup({ delay: null });
    const config = pageOf();
    const replaceState = vi.spyOn(window.history, "replaceState");

    render(<DatasetPage config={config} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await user.type(screen.getByRole("textbox", { name: "Search" }), "tokyo");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS - 1);
    });
    expect(replaceState).not.toHaveBeenCalled();
    expect(config.search).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(config.search).toHaveBeenCalledTimes(2);
    expect(config.search).toHaveBeenLastCalledWith({ searchTerm: "tokyo" });
    expect(window.location.search).toBe("?q=tokyo");
  });

  // The narrow window where a traversal and a commit are both in play. The
  // keystrokes belong to the view the reader has left, so letting them land
  // afterwards desyncs all three surfaces at once. The box would show the
  // restored term while the rows, the position, and the address carried the
  // typed one.
  it("drops a commit still pending when a back navigation lands inside the window", async () => {
    const user = userEvent.setup({ delay: null });
    const config = pageOf();

    render(<DatasetPage config={config} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

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
    expect(config.search).toHaveBeenCalledTimes(2);
    expect(config.search).toHaveBeenLastCalledWith({ searchTerm: "kyoto" });
  });

  it("writes nothing further when the reader pauses again without typing", async () => {
    const user = userEvent.setup({ delay: null });
    const replaceState = vi.spyOn(window.history, "replaceState");

    render(<DatasetPage config={pageOf()} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

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
  // reload or a share, and nothing untrimmed is ever searched a second
  // time.
  it("keeps the position and the page in the address when a trailing space follows the term", async () => {
    const user = userEvent.setup({ delay: null });
    const config = pageOf();

    render(<DatasetPage config={config} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

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
    expect(config.search).toHaveBeenLastCalledWith({ searchTerm: "City" });
    expect(config.search).not.toHaveBeenCalledWith({ searchTerm: "City " });
  });
});

// Fifty film rows, five pages at the default size, like the city set above.
const PAGED_FILMS: Film[] = Array.from({ length: 50 }, (_, index) => ({
  id: `Q${index + 1}`,
  title: `Film ${index + 1}`,
  year: 1950 + index,
  runtime: 90 + index,
  directors: [`Director ${index + 1}`],
  genres: ["drama film"],
  countries: ["United States"],
}));

/** The film page with a search that answers the fifty rows above. */
const filmPageOf = () => ({
  ...FILM_PAGE,
  search: vi.fn<(typeof FILM_PAGE)["search"]>(() =>
    Promise.resolve(PAGED_FILMS),
  ),
});

// The city cases above hold the address rules; these prove the film column ids
// reach the parser, and that a fragment survives a write that keeps a query.
describe("DatasetPage and the address on the films page", () => {
  it("paints the sort and the page size a link carries, and leaves it as it arrived", async () => {
    openAt("?sort=-runtime&page=2&size=25");

    render(<DatasetPage config={filmPageOf()} />);
    await screen.findByRole("table");

    expect(
      screen.getByRole("columnheader", { name: /Runtime/ }),
    ).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Per page:")).toHaveValue("25");
    expect(window.location.search).toBe("?sort=-runtime&page=2&size=25");
  });

  it("carries the fragment through a write that keeps a query", async () => {
    const user = userEvent.setup({ delay: null });
    openAt("#credits");

    render(<DatasetPage config={filmPageOf()} />);
    await screen.findByRole("table");

    await user.click(screen.getByRole("button", { name: "Go to next page" }));

    expect(window.location.search).toBe("?page=2");
    expect(window.location.hash).toBe("#credits");
  });
});
