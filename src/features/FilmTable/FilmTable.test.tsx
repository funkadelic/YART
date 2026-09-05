import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

import type { Film } from "../../api/getFilms";
import { fr } from "../../i18n/catalogs/fr";
import { durationFormatFor } from "../../i18n/format";
import { setLocaleChoice } from "../../i18n/localeStore";
import { FILM_FIXTURE } from "../../test/filmFixture";
import { required } from "../../test/required";
import { stubFilmDatasetFetch } from "../../test/fetchStub";
import { buildTableLabels } from "../tableLabels";
import { FilmTable } from "./FilmTable";
import { buildFilmColumns } from "./filmColumns";

// A spy that delegates to the real builder, so every case in this file goes on
// exercising the shipping columns. How many times the array was built is
// invisible in the rendered output, so the count is asserted directly to pin
// the array's identity to the locale.
vi.mock("./filmColumns", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./filmColumns")>();

  return { ...actual, buildFilmColumns: vi.fn(actual.buildFilmColumns) };
});

// The same spy over the labels builder, and for the same reason. The table
// holds the object it returns across renders, so the build count is the
// assertion that its identity follows the locale.
vi.mock("../tableLabels", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../tableLabels")>();

  return { ...actual, buildTableLabels: vi.fn(actual.buildTableLabels) };
});

/** How long typing has to pause before the term is committed. */
const SEARCH_DEBOUNCE_MS = 150;

/** A row with a recorded runtime, so a formatted cell has something to be. */
const WITH_RUNTIME = required(
  FILM_FIXTURE.find((film) => film.runtime !== null),
  "a fixture row with a runtime",
);

/** A row with no recorded runtime, which has to paint an empty cell. */
const WITHOUT_RUNTIME = required(
  FILM_FIXTURE.find((film) => film.runtime === null && film.year !== null),
  "a fixture row with no runtime",
);

/** A row with no recorded year either, so both empty cells are exercised. */
const WITHOUT_YEAR = required(
  FILM_FIXTURE.find((film) => film.year === null),
  "a fixture row with no year",
);

/**
 * A run of rows wide enough to page, generated in a loop. Nothing in the
 * content is asserted, only how many there are and where they sit.
 */
function pagedFixture(count: number): Film[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `Q${index + 1}`,
    title: `Film ${index + 1}`,
    year: 1950 + index,
    runtime: 90 + index,
    directors: [`Director ${index + 1}`],
    genres: ["drama film"],
    countries: ["United States"],
  }));
}

const defaultProps = {
  data: FILM_FIXTURE,
  onSearchChange: vi.fn(),
  loading: false,
  // The honest default for a fixture that already carries rows.
  datasetReady: true,
  errorMessage: null,
};

/**
 * The three scalar cells of the one rendered row, in column order. The three
 * multi-valued ones follow them and are asserted beside the builder that joins
 * them, where the catalog entry doing the joining is in reach.
 */
function onlyRowCells() {
  return screen
    .getAllByRole("cell")
    .slice(0, 3)
    .map((cell) => cell.textContent);
}

beforeEach(() => {
  // Installed over the city stub the setup file puts in place. A films suite
  // that forgets this fails with a column-order failure where it would
  // otherwise pass quietly against city data.
  stubFilmDatasetFetch();
  vi.clearAllMocks();
  vi.useFakeTimers();
});

// Unconditional, because a file that installs a controlled clock and never puts
// the real one back leaks the frozen clock into whatever runs next.
afterEach(() => {
  vi.useRealTimers();
});

describe("FilmTable", () => {
  it("renders the columns and the rows it was given", () => {
    render(<FilmTable {...defaultProps} data={[WITH_RUNTIME]} />);

    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Year")).toBeInTheDocument();
    expect(screen.getByText("Runtime")).toBeInTheDocument();
    expect(screen.getByText(WITH_RUNTIME.title)).toBeInTheDocument();
  });

  // The nullable half of the row type, read from the only place it shows. A
  // cell painting the word null would be a rendered value nobody authored.
  it("paints an empty cell for a film with no recorded runtime", () => {
    render(<FilmTable {...defaultProps} data={[WITHOUT_RUNTIME]} />);

    expect(onlyRowCells()).toEqual([
      WITHOUT_RUNTIME.title,
      String(WITHOUT_RUNTIME.year),
      "",
    ]);
  });

  it("paints an empty cell for a film with no recorded year", () => {
    render(<FilmTable {...defaultProps} data={[WITHOUT_YEAR]} />);

    expect(onlyRowCells()).toEqual([WITHOUT_YEAR.title, "", ""]);
  });

  // A year is an identifier a reader reads as four digits, so it is the one
  // number on this page that is not grouped and a group separator in it would
  // only be wrong. The runtime does carry its unit, because a reader cannot
  // infer minutes from a bare 1,234.
  it("groups the runtime with its unit and leaves the year ungrouped", () => {
    const long: Film = { ...WITH_RUNTIME, year: 2011, runtime: 1234 };

    render(<FilmTable {...defaultProps} data={[long]} />);

    // Computed through the platform, so the case states the rule and not one
    // locale's rendering of it.
    const runtime = durationFormatFor("en-US").format(1234);

    expect(runtime).toContain("1,234");
    expect(runtime).not.toBe("1,234");
    expect(onlyRowCells()).toEqual([long.title, "2011", runtime]);
  });

  it("renders the search box with the film copy", () => {
    render(<FilmTable {...defaultProps} />);

    const box = screen.getByRole("textbox", { name: "Search" });

    expect(box).toBeInTheDocument();
    expect(box).toHaveAttribute("placeholder", "Search for a film");
  });

  it("reports the term upward once typing has paused, not once per keystroke", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSearchChange = vi.fn();

    render(<FilmTable {...defaultProps} onSearchChange={onSearchChange} />);

    await user.type(screen.getByRole("textbox", { name: "Search" }), "Kick");

    expect(onSearchChange).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    });

    expect(onSearchChange).toHaveBeenCalledTimes(1);
    expect(onSearchChange).toHaveBeenCalledWith("Kick");
  });

  it("paints every keystroke in the box while the commit waits", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<FilmTable {...defaultProps} />);

    const box = screen.getByRole("textbox", { name: "Search" });
    await user.type(box, "Kick");

    expect(box).toHaveValue("Kick");
  });
});

describe("FilmTable sorting", () => {
  it("cycles a column through ascending, descending and unsorted", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<FilmTable {...defaultProps} data={pagedFixture(3)} />);

    const header = () => screen.getByRole("columnheader", { name: /Year/ });
    const button = screen.getByRole("button", { name: "Year" });

    expect(header()).toHaveAttribute("aria-sort", "none");

    await user.click(button);
    expect(header()).toHaveAttribute("aria-sort", "ascending");

    await user.click(button);
    expect(header()).toHaveAttribute("aria-sort", "descending");

    await user.click(button);
    expect(header()).toHaveAttribute("aria-sort", "none");
  });

  // The blank arm of the shared comparator, reached here through a real column.
  // A film with no runtime has nothing to order by and belongs at the end
  // whichever way the reader turns the column.
  it("sorts films with no runtime last in both directions", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const rows = [WITHOUT_RUNTIME, WITH_RUNTIME];

    render(<FilmTable {...defaultProps} data={rows} />);

    const button = screen.getByRole("button", { name: "Runtime" });
    const titles = () =>
      screen.getAllByRole("row").slice(1).map(rowTitle).filter(Boolean);

    await user.click(button);
    expect(titles()).toEqual([WITH_RUNTIME.title, WITHOUT_RUNTIME.title]);

    await user.click(button);
    expect(titles()).toEqual([WITH_RUNTIME.title, WITHOUT_RUNTIME.title]);
  });

  it("returns the reader to the first page when the sort changes", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<FilmTable {...defaultProps} data={pagedFixture(30)} />);

    await user.click(screen.getByRole("button", { name: "Go to last page" }));
    expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Title" }));

    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
  });
});

/** The title cell of a rendered row, which is its first. */
function rowTitle(row: HTMLElement): string {
  return row.querySelector("td")?.textContent ?? "";
}

describe("FilmTable pagination", () => {
  it("pages forward and back", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<FilmTable {...defaultProps} data={pagedFixture(30)} />);

    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Go to next page" }));
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Go to previous page" }),
    );
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
  });

  it("returns the reader to the first page when the page size changes", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<FilmTable {...defaultProps} data={pagedFixture(30)} />);

    await user.click(screen.getByRole("button", { name: "Go to last page" }));
    expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Per page:"), "25");

    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  });

  it("returns the reader to the first page when the term changes", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<FilmTable {...defaultProps} data={pagedFixture(30)} />);

    await user.click(screen.getByRole("button", { name: "Go to last page" }));
    expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "Search" }), "Film");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    });

    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
  });
});

describe("FilmTable loading and failure", () => {
  it("renders the download copy while the dataset has never arrived", () => {
    render(
      <FilmTable
        {...defaultProps}
        data={[]}
        loading={true}
        datasetReady={false}
      />,
    );

    expect(
      screen.getByText("Downloading the film data..."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  // A table torn down whenever a request is in flight flashes on every
  // keystroke, so the full replacement is gated on the dataset and not on the
  // request.
  it("keeps the table mounted while refetching over rows already on screen", () => {
    render(<FilmTable {...defaultProps} loading={true} />);

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByText("Downloading the film data...")).toBeNull();
  });

  it("renders the failure and a way back when a handler is given", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onRetry = vi.fn();

    render(
      <FilmTable {...defaultProps} errorMessage="No films" onRetry={onRetry} />,
    );

    expect(screen.getByText("Error: No films")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("offers no way back when no handler is given", () => {
    render(<FilmTable {...defaultProps} errorMessage="No films" />);

    expect(screen.getByText("Error: No films")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });

  it("renders the empty copy when a search matched nothing", () => {
    render(<FilmTable {...defaultProps} data={[]} />);

    expect(screen.getByText("No films found")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("FilmTable and the locale", () => {
  /**
   * Testing Library collapses every run of whitespace in the text it matches
   * against, and the French group separator is a narrow no-break space, which
   * is whitespace. Trimming and nothing else leaves the separator intact on
   * both sides of the comparison.
   */
  const asWritten = { normalizer: (text: string) => text.trim() };

  it("groups the runtime column on the resolved locale", () => {
    setLocaleChoice("fr");
    const long: Film = { ...WITH_RUNTIME, runtime: 1234 };

    render(<FilmTable {...defaultProps} data={[long]} />);

    // Computed through the platform, because the separator above is invisible
    // in every terminal a failure is read in.
    const french = durationFormatFor("fr-FR").format(1234);
    const english = durationFormatFor("en-US").format(1234);

    expect(french).not.toBe(english);
    expect(screen.getByText(french, asWritten)).toBeInTheDocument();
    expect(screen.queryByText(english, asWritten)).not.toBeInTheDocument();
  });

  it("takes its column labels from the catalog", () => {
    setLocaleChoice("fr");

    render(<FilmTable {...defaultProps} />);

    expect(screen.getByText(fr.films.columns.title)).toBeInTheDocument();
    expect(screen.getByText(fr.films.columns.runtime)).toBeInTheDocument();
    expect(screen.queryByText("Runtime")).not.toBeInTheDocument();
  });

  it("leaves the film titles in their source form", () => {
    setLocaleChoice("fr");

    render(<FilmTable {...defaultProps} data={[WITH_RUNTIME]} />);

    expect(screen.getByText(WITH_RUNTIME.title)).toBeInTheDocument();
  });

  // The sort and page memos downstream depend on the array identity, so a
  // build on a render where the locale did not move would re-sort the whole
  // collection and re-slice the page for nothing.
  it("builds the column array once per locale and not once per render", () => {
    const built = vi.mocked(buildFilmColumns);

    // Pinned before the first render, so the store has nothing left to settle
    // on once the table is mounted.
    setLocaleChoice("en");

    const { rerender } = render(<FilmTable {...defaultProps} />);

    expect(built).toHaveBeenCalledTimes(1);

    rerender(<FilmTable {...defaultProps} />);
    rerender(<FilmTable {...defaultProps} loading={true} />);

    expect(built).toHaveBeenCalledTimes(1);

    act(() => {
      setLocaleChoice("fr");
    });

    expect(built).toHaveBeenCalledTimes(2);

    // Narrowed here, because a recorded result is either a return or a throw,
    // so its value is untyped until it is treated as the opaque thing this
    // assertion needs.
    const [first, second] = built.mock.results.map(
      (call) => call.value as unknown,
    );

    expect(second).not.toBe(first);
  });

  it("builds the labels object once per locale and not once per render", () => {
    const built = vi.mocked(buildTableLabels);

    setLocaleChoice("en");

    const { rerender } = render(<FilmTable {...defaultProps} />);

    expect(built).toHaveBeenCalledTimes(1);

    rerender(<FilmTable {...defaultProps} />);
    rerender(<FilmTable {...defaultProps} loading={true} />);

    expect(built).toHaveBeenCalledTimes(1);

    act(() => {
      setLocaleChoice("fr");
    });

    expect(built).toHaveBeenCalledTimes(2);
  });
});
