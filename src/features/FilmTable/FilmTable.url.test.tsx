import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

import type { Film } from "../../api/getFilms";
import { RootLayout } from "../RootLayout";
import { stubFilmDatasetFetch } from "../../test/fetchStub";
import { FilmTable } from "./FilmTable";

/**
 * How long typing has to pause before the term is committed. The same window
 * the feature applies, restated here because a test that reached in for the
 * constant would pass for any window at all.
 */
const SEARCH_DEBOUNCE_MS = 150;

// Fifty rows, which at the default page size is five pages. That is the
// smallest set a position can be restored into, paged away from, and pushed
// past the end of.
const PAGED_FILMS: Film[] = Array.from({ length: 50 }, (_, index) => ({
  id: `Q${index + 1}`,
  title: `Film ${index + 1}`,
  year: 1950 + index,
  runtime: 90 + index,
  directors: [`Director ${index + 1}`],
  genres: ["drama film"],
  countries: ["United States"],
}));

const defaultProps = {
  data: PAGED_FILMS,
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

beforeEach(() => {
  // Installed over the city stub the setup file puts in place, so a suite that
  // forgets fails with a column-order failure where it would otherwise pass
  // quietly.
  stubFilmDatasetFetch();
});

// Unconditional, because a file that installs a controlled clock in one block
// and never puts the real one back leaks the frozen clock into whatever runs
// next, and a restore that only runs on the happy path leaves that hole open.
afterEach(() => {
  vi.useRealTimers();
});

describe("FilmTable and its own address", () => {
  it("paints the page named in the address on the first render", () => {
    openAt("?page=2");

    render(<FilmTable {...defaultProps} />);

    expect(screen.getByText("Page 2 of 5")).toBeInTheDocument();
    expect(screen.getByText("Film 11")).toBeInTheDocument();
    expect(screen.queryByText("Film 1")).not.toBeInTheDocument();
  });

  it("paints the sort and the page size a link carries, and leaves it as it arrived", () => {
    openAt("?sort=-year&page=2&size=25");

    render(<FilmTable {...defaultProps} />);

    expect(screen.getByRole("columnheader", { name: /Year/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Per page:")).toHaveValue("25");
    expect(window.location.search).toBe("?sort=-year&page=2&size=25");
  });

  // The one rule this page shares with the other and holds separately. The
  // address is replaced, never pushed, so one Back press leaves the site.
  it("writes the position through a replacing call and never a pushing one", async () => {
    const user = userEvent.setup({ delay: null });
    const replaceState = vi.spyOn(window.history, "replaceState");
    const pushState = vi.spyOn(window.history, "pushState");

    render(<FilmTable {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Go to next page" }));

    expect(window.location.search).toBe("?page=2");
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(pushState).not.toHaveBeenCalled();
  });

  it("writes nothing when the serialized state already equals the address", () => {
    openAt("?page=2");
    const replaceState = vi.spyOn(window.history, "replaceState");

    render(<FilmTable {...defaultProps} />);

    expect(screen.getByText("Page 2 of 5")).toBeInTheDocument();
    expect(replaceState).not.toHaveBeenCalled();
  });

  // A suite that only ever sets parameters never reaches this case. An empty
  // query has to be written as the path, because the empty string resolves to
  // the address it was given and leaves the stale query in place.
  it("writes the path and the fragment, not a bare question mark, when the query empties", async () => {
    const user = userEvent.setup({ delay: null });
    openAt("?page=5#credits");

    render(<FilmTable {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Go to first page" }));

    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("#credits");
    expect(window.location.href).not.toContain("?");
  });

  it("carries the fragment through a write that keeps a query", async () => {
    const user = userEvent.setup({ delay: null });
    openAt("#credits");

    render(<FilmTable {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Go to next page" }));

    expect(window.location.search).toBe("?page=2");
    expect(window.location.hash).toBe("#credits");
  });

  // The address is a convenience and the table is not. Browsers rate limit
  // history mutation, and past the limit the call throws; unguarded, that throw
  // lands in a commit-phase effect, where the boundary around the main slot
  // replaces the whole view with its fallback.
  it("keeps the table rendered when the browser refuses the address write", async () => {
    const user = userEvent.setup({ delay: null });
    vi.spyOn(window.history, "replaceState").mockImplementation(() => {
      throw new DOMException(
        "Attempt to use history.replaceState() more than 100 times per 30 seconds",
        "SecurityError",
      );
    });

    render(
      <RootLayout domain="films">
        <FilmTable {...defaultProps} />
      </RootLayout>,
    );

    await user.click(screen.getByRole("button", { name: "Go to next page" }));

    expect(screen.getByText("Page 2 of 5")).toBeInTheDocument();
    expect(screen.getByText("Film 11")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("carries an unowned parameter through a write, behind the keys it owns", async () => {
    const user = userEvent.setup({ delay: null });
    openAt("?utm_source=x");

    render(<FilmTable {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Go to next page" }));

    expect(window.location.search).toBe("?page=2&utm_source=x");
  });
});

describe("FilmTable and a browsing-history event", () => {
  it("re-parses the address back into the whole view state", () => {
    const onSearchChange = vi.fn();

    render(<FilmTable {...defaultProps} onSearchChange={onSearchChange} />);

    openAt("?q=Film&sort=-year&page=2&size=25");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(screen.getByRole("textbox", { name: "Search" })).toHaveValue("Film");
    expect(screen.getByRole("columnheader", { name: /Year/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(onSearchChange).toHaveBeenCalledWith("Film");
  });

  // A restored sort is still a first render, so announcing it would tell a
  // reader who has just followed a link that something happened when nothing
  // did. A traversal after a real press does have something to announce.
  it("stays silent for a restored sort the reader never applied, and speaks after one they did", async () => {
    const user = userEvent.setup({ delay: null });
    const { container } = render(<FilmTable {...defaultProps} />);

    const announcer = container.querySelector(
      '[aria-live="polite"][aria-atomic="true"]',
    );
    expect(announcer).toBeEmptyDOMElement();

    openAt("?sort=-year");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(announcer).toBeEmptyDOMElement();

    await user.click(screen.getByRole("button", { name: "Title" }));
    expect(announcer).toHaveTextContent(
      "Table sorted by Title in ascending order",
    );

    openAt("?sort=-year");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(announcer).toHaveTextContent(
      "Table sorted by Year in descending order",
    );
  });
});

// The clock is installed here and nowhere else in this file. The cases above
// run on a real one, and the pair below is about when a write happens, which is
// not observable without owning the clock.
describe("FilmTable and the debounced address write", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("writes the address once and reports upward once, after typing pauses", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSearchChange = vi.fn();
    const replaceState = vi.spyOn(window.history, "replaceState");

    render(<FilmTable {...defaultProps} onSearchChange={onSearchChange} />);

    await user.type(screen.getByRole("textbox", { name: "Search" }), "Film");

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
    expect(window.location.search).toBe("?q=Film");
  });

  // The narrow window where a traversal and a commit are both in play. The
  // keystrokes belong to the view the reader has left, so letting them land
  // afterwards would desync the box, the rows, the position and the address.
  it("drops a commit still pending when a browsing-history event lands inside the window", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSearchChange = vi.fn();

    render(<FilmTable {...defaultProps} onSearchChange={onSearchChange} />);

    await user.type(screen.getByRole("textbox", { name: "Search" }), "Film 4");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS - 1);
    });

    openAt("?q=Film 7&page=2");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    // Well past the boundary the canceled commit would have fired at.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS * 2);
    });

    expect(screen.getByRole("textbox", { name: "Search" })).toHaveValue(
      "Film 7",
    );
    expect(screen.getByText("Page 2 of 5")).toBeInTheDocument();
    expect(onSearchChange).toHaveBeenCalledTimes(1);
    expect(onSearchChange).toHaveBeenCalledWith("Film 7");
  });
});
