import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, it, expect, vi } from "vitest";

import type { Film } from "../../api/getFilms";
import { fr } from "../../i18n/catalogs/fr";
import { durationFormatFor } from "../../i18n/format";
import { setLocaleChoice } from "../../i18n/localeStore";
import { FILM_FIXTURE } from "../../test/filmFixture";
import { required } from "../../test/required";
import { buildFilmColumns } from "../films/filmColumns";
import { FILM_PAGE } from "../films/filmPage";
import { buildTableLabels } from "../tableLabels";
import { DatasetPage } from "./DatasetPage";

// A spy that delegates to the real builder, so every case goes on exercising
// the shipping labels while the build count pins the object to the locale.
vi.mock("../tableLabels", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../tableLabels")>();

  return { ...actual, buildTableLabels: vi.fn(actual.buildTableLabels) };
});

/** The film seam's own type, so a stub is held to the page's contract. */
type FilmSearch = (typeof FILM_PAGE)["search"];

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

/** The film page over a search that answers the given rows for any term. */
const pageWith = (rows: readonly Film[]) => ({
  ...FILM_PAGE,
  search: vi.fn<FilmSearch>(() => Promise.resolve(rows)),
});

/**
 * Renders the page over rows and waits until the request has settled, so a
 * case starts from a quiet table.
 */
async function renderPage(rows: readonly Film[] = FILM_FIXTURE) {
  const config = pageWith(rows);
  const view = render(<DatasetPage config={config} />);

  await waitFor(() => {
    expect(screen.getByRole("table").closest("[aria-busy]")).toHaveAttribute(
      "aria-busy",
      "false",
    );
  });

  return { ...view, config };
}

/** The page body, so a query cannot be satisfied by the header or footer. */
const main = () => within(screen.getByRole("main"));

/**
 * The three scalar cells of the one rendered row, in column order. The three
 * multi-valued ones follow them and are asserted beside the builder that joins
 * them.
 */
function onlyRowCells() {
  return screen
    .getAllByRole("cell")
    .slice(0, 3)
    .map((cell) => cell.textContent);
}

/** The title cell of a rendered row, which is its first. */
function rowTitle(row: HTMLElement): string {
  return row.querySelector("td")?.textContent ?? "";
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DatasetPage on the films page", () => {
  it("renders the columns and the rows it was given", async () => {
    await renderPage([WITH_RUNTIME]);

    expect(main().getByText("Title")).toBeInTheDocument();
    expect(main().getByText("Year")).toBeInTheDocument();
    expect(main().getByText("Runtime")).toBeInTheDocument();
    expect(main().getByText(WITH_RUNTIME.title)).toBeInTheDocument();
  });

  // The nullable half of the row type, read from the only place it shows. A
  // cell painting the word null would be a rendered value nobody authored.
  it("paints an empty cell for a film with no recorded runtime", async () => {
    await renderPage([WITHOUT_RUNTIME]);

    expect(onlyRowCells()).toEqual([
      WITHOUT_RUNTIME.title,
      String(WITHOUT_RUNTIME.year),
      "",
    ]);
  });

  it("paints an empty cell for a film with no recorded year", async () => {
    await renderPage([WITHOUT_YEAR]);

    expect(onlyRowCells()).toEqual([WITHOUT_YEAR.title, "", ""]);
  });

  // A year is read as four digits, so a group separator in it would be wrong.
  // The runtime carries its unit, because minutes cannot be inferred from 1,234.
  it("groups the runtime with its unit and leaves the year ungrouped", async () => {
    const long: Film = { ...WITH_RUNTIME, year: 2011, runtime: 1234 };

    await renderPage([long]);

    // Computed through the platform, so the case states the rule and not one
    // locale's rendering of it.
    const runtime = durationFormatFor("en-US").format(1234);

    expect(runtime).toContain("1,234");
    expect(runtime).not.toBe("1,234");
    expect(onlyRowCells()).toEqual([long.title, "2011", runtime]);
  });

  it("renders the search box with the film copy", async () => {
    await renderPage();

    const box = screen.getByRole("textbox", { name: "Search" });

    expect(box).toHaveAttribute("placeholder", "Search for a film");
  });

  // The blank arm of the shared comparator, reached here through a real column.
  // A film with no runtime has nothing to order by and belongs at the end
  // whichever way the reader turns the column.
  it("sorts films with no runtime last in both directions", async () => {
    const user = userEvent.setup();

    await renderPage([WITHOUT_RUNTIME, WITH_RUNTIME]);

    const button = screen.getByRole("button", { name: "Runtime" });
    const titles = () =>
      screen.getAllByRole("row").slice(1).map(rowTitle).filter(Boolean);

    await user.click(button);
    expect(titles()).toEqual([WITH_RUNTIME.title, WITHOUT_RUNTIME.title]);

    await user.click(button);
    expect(titles()).toEqual([WITH_RUNTIME.title, WITHOUT_RUNTIME.title]);
  });
});

describe("DatasetPage on the films page and the locale", () => {
  /**
   * Testing Library collapses every run of whitespace in the text it matches
   * against, and the French group separator is a narrow no-break space, which
   * is whitespace. Trimming and nothing else leaves the separator intact.
   */
  const asWritten = { normalizer: (text: string) => text.trim() };

  it("groups the runtime column on the resolved locale", async () => {
    setLocaleChoice("fr");

    await renderPage([{ ...WITH_RUNTIME, runtime: 1234 }]);

    // Computed through the platform, because the separator above is invisible
    // in every terminal a failure is read in.
    const french = durationFormatFor("fr-FR").format(1234);
    const english = durationFormatFor("en-US").format(1234);

    expect(french).not.toBe(english);
    expect(screen.getByText(french, asWritten)).toBeInTheDocument();
    expect(screen.queryByText(english, asWritten)).not.toBeInTheDocument();
  });

  it("takes its column labels from the catalog", async () => {
    setLocaleChoice("fr");

    await renderPage();

    expect(main().getByText(fr.films.columns.title)).toBeInTheDocument();
    expect(main().getByText(fr.films.columns.runtime)).toBeInTheDocument();
    expect(main().queryByText("Runtime")).not.toBeInTheDocument();
  });

  it("leaves the film titles in their source form", async () => {
    setLocaleChoice("fr");

    await renderPage([WITH_RUNTIME]);

    expect(main().getByText(WITH_RUNTIME.title)).toBeInTheDocument();
  });

  // The sort and page memos downstream depend on the array identity, so a
  // build on a render where the locale did not move would re-sort the whole
  // collection and re-slice the page for nothing.
  it("builds the column array once per locale and not once per render", async () => {
    const built = vi.fn(buildFilmColumns);
    const config = { ...pageWith(FILM_FIXTURE), buildColumns: built };

    // Pinned before the first render, so the store has nothing left to settle
    // on once the table is mounted.
    setLocaleChoice("en");

    const { rerender } = render(<DatasetPage config={config} />);
    await screen.findByRole("table");

    expect(built).toHaveBeenCalledTimes(1);

    rerender(<DatasetPage config={config} />);
    rerender(<DatasetPage config={config} />);

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

  it("builds the labels object once per locale and not once per render", async () => {
    const built = vi.mocked(buildTableLabels);

    setLocaleChoice("en");

    const { rerender, config } = await renderPage();

    expect(built).toHaveBeenCalledTimes(1);

    rerender(<DatasetPage config={config} />);
    rerender(<DatasetPage config={config} />);

    expect(built).toHaveBeenCalledTimes(1);

    act(() => {
      setLocaleChoice("fr");
    });

    expect(built).toHaveBeenCalledTimes(2);
  });

  // Switched after mount: the memo behind these two strings recomputes only
  // when the catalog moves, and a switch before the first render proves nothing.
  it("takes the search box's own two strings from the catalog", async () => {
    // Pinned first, so the switch below is what the mounted memo sees rather
    // than a locale an earlier case left behind.
    setLocaleChoice("en");

    await renderPage();

    act(() => {
      setLocaleChoice("fr");
    });

    const box = screen.getByRole("textbox", { name: fr.common.searchName });
    expect(box).toHaveAttribute("placeholder", fr.films.searchPlaceholder);
  });
});
