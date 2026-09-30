import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { City } from "../../api/getCities";
import { sortRows } from "../../components/DataTable/sortRows";
import { DatasetError } from "../../data/loadEnvelope";
import { SYNC_SORT_ROWS } from "../../hooks/useSortedRows";
import { en } from "../../i18n/catalogs/en";
import { fr } from "../../i18n/catalogs/fr";
import { numberFormatFor } from "../../i18n/format";
import { setLocaleChoice } from "../../i18n/localeStore";
import { required } from "../../test/required";
import { buildCityColumns, cityRowId } from "../CityTable/cityColumns";
import { CITY_PAGE } from "../cities/cityPage";
import { buildTableLabels } from "../tableLabels";
import { DatasetPage } from "./DatasetPage";

// A spy that delegates to the real builder, so every case in this file goes on
// exercising the shipping labels. The table holds the object it returns across
// renders, so the build count is the assertion that its identity follows the
// locale.
vi.mock("../tableLabels", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../tableLabels")>();

  return { ...actual, buildTableLabels: vi.fn(actual.buildTableLabels) };
});

/** The search seam's own type, so a stub is held to the page's contract. */
type CitySearch = (typeof CITY_PAGE)["search"];

// Mock data for testing
const mockCities: City[] = [
  {
    id: 1,
    name: "Tokyo",
    nameAscii: "Tokyo",
    country: "Japan",
    countryIso3: "JPN",
    capital: "primary",
    population: 37400068,
  },
  {
    id: 2,
    name: "Jakarta",
    nameAscii: "Jakarta",
    country: "Indonesia",
    countryIso3: "IDN",
    capital: "primary",
    population: 10562088,
  },
  {
    id: 3,
    name: "Osaka",
    nameAscii: "Osaka",
    country: "Japan",
    countryIso3: "JPN",
    capital: "admin",
    population: 2691185,
  },
  {
    id: 4,
    name: "Mumbai",
    nameAscii: "Mumbai",
    country: "India",
    countryIso3: "IND",
    capital: "admin",
    population: 20411274,
  },
  {
    id: 5,
    name: "New Delhi",
    nameAscii: "New Delhi",
    country: "India",
    countryIso3: "IND",
    capital: "primary",
    population: 28514000,
  },
];

/**
 * A run of rows wide enough to page, generated in a loop. Nothing in the
 * content is asserted, only how many there are.
 */
function pagedFixture(count: number): City[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `City ${index + 1}`,
    nameAscii: `City ${index + 1}`,
    country: `Country ${index + 1}`,
    countryIso3: `C${index.toString().padStart(2, "0")}`,
    capital: index % 2 === 0 ? "primary" : "admin",
    population: 1000000 + index * 100000,
  }));
}

/** Every rendered row's aria-rowindex, the header row's first. */
function renderedRowIndexes(): (string | null)[] {
  return screen
    .getAllByRole("row")
    .map((row) => row.getAttribute("aria-rowindex"));
}

/** The header row's index, then a run of body rows from firstBodyRow. */
function expectedRowIndexes(firstBodyRow: number, rows: number): string[] {
  return [
    "1",
    ...Array.from({ length: rows }, (_, offset) =>
      String(firstBodyRow + offset),
    ),
  ];
}

/**
 * The glyph count of every header, in column order. Nothing else inside a
 * header carries an svg, so the count is the sort indicator.
 */
function sortGlyphCounts(): number[] {
  return screen
    .getAllByRole("columnheader")
    .map((header) => header.querySelectorAll("svg").length);
}

/** The city page over a search that answers the given rows for any term. */
const pageWith = (rows: readonly City[]) => ({
  ...CITY_PAGE,
  search: vi.fn<CitySearch>(() => Promise.resolve(rows)),
});

/** The city page over a search that never settles, so it stays in flight. */
const pendingPage = () => ({
  ...CITY_PAGE,
  search: vi.fn<CitySearch>(() => new Promise<never>(() => {})),
});

/** The city page over a search that fails with a transport error. */
const failingPage = () => ({
  ...CITY_PAGE,
  search: vi.fn<CitySearch>(() =>
    Promise.reject(new DatasetError("transport", 0, "developer-facing text")),
  ),
});

/** The sentence a transport failure paints, in English. */
const TRANSPORT_ERROR = `Error: ${en.cities.datasetError.transport("en-US", 0)}`;

/**
 * Renders the page over rows and waits until they are on screen and the
 * request has settled, so a case starts from a quiet table.
 */
async function renderPage(rows: readonly City[] = mockCities) {
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

describe("DatasetPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders table with correct headers", async () => {
      await renderPage();

      expect(screen.getByText("City")).toBeInTheDocument();
      expect(screen.getByText("Country")).toBeInTheDocument();
      expect(screen.getByText("Capital")).toBeInTheDocument();
      expect(screen.getByText("Country Code")).toBeInTheDocument();
      expect(screen.getByText("Population")).toBeInTheDocument();
    });

    it("renders all city data", async () => {
      await renderPage();

      expect(screen.getByText("Tokyo")).toBeInTheDocument();
      expect(screen.getByText("Jakarta")).toBeInTheDocument();
      expect(screen.getByText("Osaka")).toBeInTheDocument();
      expect(screen.getByText("Mumbai")).toBeInTheDocument();
      expect(screen.getByText("New Delhi")).toBeInTheDocument();
    });

    it("renders search input", async () => {
      await renderPage();

      const searchInput = screen.getByRole("textbox", { name: "Search" });
      expect(searchInput).toBeInTheDocument();
      expect(searchInput).toHaveAttribute("placeholder", "Search for a city");
    });

    // Matched as a substring, because the runner hands a CSS Module a proxy
    // that decorates the key, so the class on the element is not the key the
    // source writes.
    it("marks the population sort control as numeric and no other", async () => {
      await renderPage();

      expect(
        screen.getByRole("button", { name: "Population" }).className,
      ).toContain("sortButtonNumeric");
      expect(
        screen.getByRole("button", { name: "City" }).className,
      ).not.toContain("sortButtonNumeric");
    });
  });

  describe("Search Functionality", () => {
    it("searches the term once typing has paused, not once per keystroke", async () => {
      const user = userEvent.setup();
      const { config } = await renderPage();

      const searchInput = screen.getByRole("textbox", { name: "Search" });
      await user.type(searchInput, "Tok");

      // The commit waits for the pause, so three keystrokes settle into one
      // search carrying the whole word, after the one the mount issued.
      await waitFor(() => {
        expect(config.search).toHaveBeenLastCalledWith({ searchTerm: "Tok" });
      });
      expect(config.search).toHaveBeenCalledTimes(2);
    });

    it("displays what has been typed into the search input", async () => {
      const user = userEvent.setup();
      await renderPage();

      const searchInput = screen.getByRole("textbox", { name: "Search" });
      await user.type(searchInput, "Tokyo");

      // The box repaints on every keystroke, so it shows the term before the
      // table has been asked for it.
      expect(searchInput).toHaveValue("Tokyo");
    });

    it("shows search input even when there's an error", async () => {
      render(<DatasetPage config={failingPage()} />);

      expect(await screen.findByText(TRANSPORT_ERROR)).toBeInTheDocument();
      expect(
        screen.getByRole("textbox", { name: "Search" }),
      ).toBeInTheDocument();
    });
  });

  describe("Loading and Error States", () => {
    it("renders the download copy while the dataset has never arrived", () => {
      render(<DatasetPage config={pendingPage()} />);

      expect(
        screen.getByText("Downloading the city data..."),
      ).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("renders no download copy while refetching over a dataset that has already arrived", async () => {
      // The user path this stands for is a search that returned nothing,
      // followed by one more keystroke. Nothing is downloading, and a row
      // count cannot tell that apart from a cold start.
      const { rerender } = render(<DatasetPage config={pageWith([])} />);
      expect(await screen.findByText("No cities found")).toBeInTheDocument();

      rerender(<DatasetPage config={pendingPage()} />);

      expect(screen.queryByText("Downloading the city data...")).toBeNull();
      expect(screen.getByText("No cities found")).toBeInTheDocument();
    });

    it("keeps the table mounted while refetching with results on screen", async () => {
      const { rerender } = await renderPage();
      const tableBeforeRefetch = screen.getByRole("table");

      rerender(<DatasetPage config={pendingPage()} />);

      // Same DOM node, so the table is dimmed in place instead of unmounting
      // and flashing on every keystroke.
      expect(screen.getByRole("table")).toBe(tableBeforeRefetch);
      expect(
        screen.queryByText("Downloading the city data..."),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("table").closest("[aria-busy]")).toHaveAttribute(
        "aria-busy",
        "true",
      );
    });

    it("paints busy at once for a large cold sort, then settles on the sorted order", async () => {
      const user = userEvent.setup();
      // Past the slice deadline on every read, so the pass yields on any machine.
      let clock = 0;
      vi.spyOn(performance, "now").mockImplementation(() => (clock += 10));
      const rows = pagedFixture(SYNC_SORT_ROWS + 1).reverse();
      const name = required(
        buildCityColumns(en, "en-US").find((column) => column.id === "name"),
        "the name column",
      );
      const sortedFirst = required(
        sortRows(rows, name, "asc", cityRowId)[0],
        "the first sorted city",
      );
      const { container } = await renderPage(rows);
      const sortRegion = container.querySelector(
        '[aria-live="polite"][aria-atomic="true"]',
      );

      const firstCity = () =>
        within(
          required(screen.getAllByRole("row")[1], "the first body row"),
        ).getAllByRole("cell")[0]?.textContent;
      const busyContainer = () =>
        screen.getByRole("table").closest("[aria-busy]");

      await user.click(screen.getByRole("button", { name: "City" }));

      expect(busyContainer()).toHaveAttribute("aria-busy", "true");
      expect(firstCity()).toBe(required(rows[0], "the first city").name);
      expect(sortRegion).toBeEmptyDOMElement();

      await waitFor(() =>
        expect(busyContainer()).toHaveAttribute("aria-busy", "false"),
      );
      expect(firstCity()).toBe(sortedFirst.name);
      expect(sortRegion).toHaveTextContent(
        "Table sorted by City in ascending order",
      );
    });

    it("reads as loading while a linked sort has nothing settled to show", async () => {
      let clock = 0;
      vi.spyOn(performance, "now").mockImplementation(() => (clock += 10));
      window.history.replaceState(null, "", "?sort=name");
      const rows = pagedFixture(SYNC_SORT_ROWS + 1).reverse();
      const name = required(
        buildCityColumns(en, "en-US").find((column) => column.id === "name"),
        "the name column",
      );
      const sortedFirst = required(
        sortRows(rows, name, "asc", cityRowId)[0],
        "the first sorted city",
      );
      const { container } = render(<DatasetPage config={pageWith(rows)} />);

      expect(
        screen.getByText("Downloading the city data..."),
      ).toBeInTheDocument();
      const announced = () =>
        Array.from(container.querySelectorAll('[aria-live="polite"]')).map(
          (region) => region.textContent,
        );
      expect(announced()).not.toContain("No cities found for that search");

      await screen.findByRole("table");
      const firstRow = required(
        screen.getAllByRole("row")[1],
        "the first body row",
      );
      expect(within(firstRow).getAllByRole("cell")[0]?.textContent).toBe(
        sortedFirst.name,
      );
    });

    it("shows error state", async () => {
      render(<DatasetPage config={failingPage()} />);

      expect(await screen.findByText(TRANSPORT_ERROR)).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("shows empty state when no data", async () => {
      render(<DatasetPage config={pageWith([])} />);

      expect(await screen.findByText("No cities found")).toBeInTheDocument();
    });

    it("keeps the download copy off screen while refetching with rows on show", async () => {
      const { rerender } = await renderPage();
      rerender(<DatasetPage config={pendingPage()} />);

      // The refetch path. Replacing the view here would unmount the table on
      // every keystroke.
      expect(
        screen.queryByText("Downloading the city data..."),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("table")).toBeInTheDocument();
    });

    it("offers a retry control that refocuses the search box and searches again", async () => {
      const user = userEvent.setup();
      const config = failingPage();

      render(<DatasetPage config={config} />);

      await user.click(
        await screen.findByRole("button", { name: "Try again" }),
      );

      expect(screen.getByRole("textbox", { name: "Search" })).toHaveFocus();
      expect(config.search).toHaveBeenCalledTimes(2);
    });
  });

  describe("Sorting Functionality", () => {
    it("sorts by city name in ascending order", async () => {
      const user = userEvent.setup();
      await renderPage();

      await user.click(screen.getByRole("button", { name: "City" }));

      const rows = screen.getAllByRole("row");
      const firstDataRow = rows[1]; // Skip header row
      expect(firstDataRow).toHaveTextContent("Jakarta"); // First alphabetically
    });

    it("sorts by population in ascending order", async () => {
      const user = userEvent.setup();
      await renderPage();

      await user.click(screen.getByRole("button", { name: "Population" }));

      const rows = screen.getAllByRole("row");
      const firstDataRow = rows[1];
      expect(firstDataRow).toHaveTextContent("Osaka"); // Smallest population
    });

    it("implements three-state sorting (asc -> desc -> none)", async () => {
      const user = userEvent.setup();
      await renderPage();

      // The activation lives on the button, the state lives on the cell.
      const cityHeader = screen.getByRole("columnheader", { name: /City/ });
      const citySortButton = screen.getByRole("button", { name: "City" });

      // First activation: ascending - should show up arrow
      await user.click(citySortButton);
      expect(cityHeader).toHaveAttribute("aria-sort", "ascending");

      // Second activation: descending - should show down arrow
      await user.click(citySortButton);
      expect(cityHeader).toHaveAttribute("aria-sort", "descending");

      // Third activation: no sort
      await user.click(citySortButton);
      expect(cityHeader).toHaveAttribute("aria-sort", "none");
    });

    it("shows sort icons only for active column", async () => {
      const user = userEvent.setup();
      await renderPage();

      const cityHeader = screen.getByRole("columnheader", { name: /City/ });
      await user.click(screen.getByRole("button", { name: "City" }));

      expect(cityHeader).toHaveAttribute("aria-sort", "ascending");

      // Other columns should not be sorted. Anchored, because "Country Code"
      // is also a column and an unanchored pattern matches both.
      const countryHeader = screen.getByRole("columnheader", {
        name: /^Country$/,
      });
      expect(countryHeader).toHaveAttribute("aria-sort", "none");
    });

    it("draws one glyph, on the sorted column and only while sorted", async () => {
      const user = userEvent.setup();
      await renderPage();

      const citySortButton = screen.getByRole("button", { name: "City" });

      // Order is City, Country, Capital, Country Code, Population. The zeros
      // are load-bearing: a guard that always fires draws both glyphs on every
      // unsorted column.
      expect(sortGlyphCounts()).toEqual([0, 0, 0, 0, 0]);

      await user.click(citySortButton);
      expect(sortGlyphCounts()).toEqual([1, 0, 0, 0, 0]);

      // Descending is the only state that reaches the second guard.
      await user.click(citySortButton);
      expect(sortGlyphCounts()).toEqual([1, 0, 0, 0, 0]);
    });

    it("switches sort when clicking different column", async () => {
      const user = userEvent.setup();
      await renderPage();

      // Sort by city first
      const cityHeader = screen.getByRole("columnheader", { name: /City/ });
      await user.click(screen.getByRole("button", { name: "City" }));
      expect(cityHeader).toHaveAttribute("aria-sort", "ascending");

      // Sort by country
      const countryHeader = screen.getByRole("columnheader", {
        name: /^Country$/,
      });
      await user.click(screen.getByRole("button", { name: "Country" }));

      // Should have sort on country column, not city
      expect(countryHeader).toHaveAttribute("aria-sort", "ascending");
      expect(cityHeader).toHaveAttribute("aria-sort", "none");
    });
  });

  describe("Pagination", () => {
    const largeMockData = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      name: `City ${i + 1}`,
      nameAscii: `City ${i + 1}`,
      country: `Country ${i + 1}`,
      countryIso3: `C${i.toString().padStart(2, "0")}`,
      capital: i % 2 === 0 ? "primary" : "admin",
      population: 1000000 + i * 100000,
    }));

    /*
     * Fifty rows, where the neighboring cases use twenty-five. At the default
     * page size of ten that is five pages, deep enough that shrinking the set
     * leaves the position well past the end. Twenty-five rows reach only page
     * three.
     */
    const fiftyRowData = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      name: `City ${i + 1}`,
      nameAscii: `City ${i + 1}`,
      country: `Country ${i + 1}`,
      countryIso3: `C${i.toString().padStart(2, "0")}`,
      capital: i % 2 === 0 ? "primary" : "admin",
      population: 1000000 + i * 100000,
    }));

    it("shows pagination controls when data exceeds page size", async () => {
      await renderPage(largeMockData);

      expect(screen.getByText(/Page \d+ of \d+/)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Go to next page/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Go to previous page/ }),
      ).toBeInTheDocument();
    });

    it("doesn't show pagination for single page of data", async () => {
      await renderPage();

      expect(screen.queryByText(/Page \d+ of \d+/)).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Go to next page/ }),
      ).not.toBeInTheDocument();
    });

    it("navigates to next page", async () => {
      const user = userEvent.setup();
      await renderPage(largeMockData);

      expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();

      const nextButton = screen.getByRole("button", {
        name: /Go to next page/,
      });
      await user.click(nextButton);

      expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    });

    it("navigates to previous page", async () => {
      const user = userEvent.setup();
      await renderPage(largeMockData);

      // Go to page 2 first
      const nextButton = screen.getByRole("button", {
        name: /Go to next page/,
      });
      await user.click(nextButton);

      // Then go back to page 1
      const prevButton = screen.getByRole("button", {
        name: /Go to previous page/,
      });
      await user.click(prevButton);

      expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    });

    it("navigates to first page", async () => {
      const user = userEvent.setup();
      await renderPage(largeMockData);

      // Go to page 2
      const nextButton = screen.getByRole("button", {
        name: /Go to next page/,
      });
      await user.click(nextButton);

      // Go to first page
      const firstButton = screen.getByRole("button", {
        name: /Go to first page/,
      });
      await user.click(firstButton);

      expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    });

    it("navigates to last page", async () => {
      const user = userEvent.setup();
      await renderPage(largeMockData);

      const lastButton = screen.getByRole("button", {
        name: /Go to last page/,
      });
      await user.click(lastButton);

      expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();
    });

    it("marks the controls at either end unavailable without disabling them", async () => {
      const user = userEvent.setup();
      await renderPage(largeMockData);

      // On the first page, previous and first are unavailable
      expect(
        screen.getByRole("button", { name: /Go to previous page/ }),
      ).toHaveAttribute("aria-disabled", "true");
      expect(
        screen.getByRole("button", { name: /Go to first page/ }),
      ).toHaveAttribute("aria-disabled", "true");
      expect(
        screen.getByRole("button", { name: /Go to next page/ }),
      ).toHaveAttribute("aria-disabled", "false");
      expect(
        screen.getByRole("button", { name: /Go to last page/ }),
      ).toHaveAttribute("aria-disabled", "false");

      // And the far end, where the two pairs swap.
      await user.click(screen.getByRole("button", { name: /Go to last page/ }));

      expect(
        screen.getByRole("button", { name: /Go to next page/ }),
      ).toHaveAttribute("aria-disabled", "true");
      expect(
        screen.getByRole("button", { name: /Go to last page/ }),
      ).toHaveAttribute("aria-disabled", "true");
      expect(
        screen.getByRole("button", { name: /Go to previous page/ }),
      ).toHaveAttribute("aria-disabled", "false");
      expect(
        screen.getByRole("button", { name: /Go to first page/ }),
      ).toHaveAttribute("aria-disabled", "false");
    });

    it("keeps focus on next when the keyboard reaches the last page", async () => {
      const user = userEvent.setup();
      await renderPage(largeMockData);

      const nextButton = screen.getByRole("button", {
        name: /Go to next page/,
      });
      nextButton.focus();
      await user.keyboard("{Enter}{Enter}");

      expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();
      // jsdom never moves focus off a disabled control, so the attribute is
      // what tells a native disabled apart here.
      expect(nextButton).toHaveFocus();
      expect(nextButton).not.toBeDisabled();
      expect(nextButton).toHaveAttribute("aria-disabled", "true");

      await user.keyboard("{Enter}");

      expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();
      expect(window.location.search).toBe("?page=3");
    });

    it("changes page size", async () => {
      const user = userEvent.setup();
      await renderPage(largeMockData);

      const pageSelect = screen.getByLabelText("Per page:");
      expect(pageSelect).toHaveValue("10"); // Default value

      await user.selectOptions(pageSelect, "25");
      expect(pageSelect).toHaveValue("25"); // Value changed
    });

    it("resets to page 1 when page size changes", async () => {
      const user = userEvent.setup();
      await renderPage(largeMockData);

      // Go to page 2
      const nextButton = screen.getByRole("button", {
        name: /Go to next page/,
      });
      await user.click(nextButton);
      expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();

      // Change page size to show fewer items per page, keeping pagination
      const pageSelect = screen.getByLabelText("Per page:");
      await user.selectOptions(pageSelect, "10"); // Keep at 10 to maintain pagination

      // Should still be on page 1 (or still have pagination)
      expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    });

    it("keeps rendering rows when the result set narrows under the current page", async () => {
      const user = userEvent.setup();
      const { rerender } = await renderPage(fiftyRowData);

      await user.click(screen.getByRole("button", { name: /Go to last page/ }));
      expect(screen.getByText("Page 5 of 5")).toBeInTheDocument();

      // Rerendering the mounted instance reproduces the trap. A fresh
      // render would start on page one and never reach the state where the
      // navigation has vanished and no control on screen offers a way back.
      rerender(<DatasetPage config={pageWith(fiftyRowData.slice(0, 3))} />);

      await waitFor(() => {
        expect(screen.getAllByRole("row")).toHaveLength(4);
      });
      expect(screen.queryByText("No cities found")).not.toBeInTheDocument();
    });

    it("shows no pagination navigation at exactly one page of rows", async () => {
      await renderPage(fiftyRowData.slice(0, 10));

      // Header row plus all ten data rows.
      expect(screen.getAllByRole("row")).toHaveLength(11);
      expect(
        screen.queryByRole("navigation", {
          name: "Table pagination navigation",
        }),
      ).not.toBeInTheDocument();
    });

    it("shows pagination navigation reporting two pages at one row past a page", async () => {
      await renderPage(fiftyRowData.slice(0, 11));

      expect(
        screen.getByRole("navigation", {
          name: "Table pagination navigation",
        }),
      ).toBeInTheDocument();
      expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    });

    // This case is a guard, and the assertions in it pass against the unfixed
    // code too. The page count is rendered inside the
    // navigation, the navigation is hidden below two pages, and both sit inside
    // the branch taken only when rows exist, so a page count of zero was never
    // reachable in the rendered output either before or after the arithmetic
    // was corrected. It catches a future change that lets an empty result set
    // reach the navigation at all.
    it("renders the empty state and no navigation when the result set narrows to nothing", async () => {
      const user = userEvent.setup();
      const { rerender } = await renderPage(fiftyRowData);

      await user.click(screen.getByRole("button", { name: /Go to last page/ }));

      rerender(<DatasetPage config={pageWith([])} />);

      expect(await screen.findByText("No cities found")).toBeInTheDocument();
      expect(
        screen.queryByRole("navigation", {
          name: "Table pagination navigation",
        }),
      ).not.toBeInTheDocument();
    });

    it("restores the original page when the result set widens again", async () => {
      // The clamp reads the position without rewriting it, so the narrowing is
      // recoverable. The user is shown a different page without being moved off
      // the one they chose.
      const user = userEvent.setup();
      const { rerender } = await renderPage(fiftyRowData);

      await user.click(screen.getByRole("button", { name: /Go to last page/ }));
      expect(screen.getByText("Page 5 of 5")).toBeInTheDocument();

      rerender(<DatasetPage config={pageWith(fiftyRowData.slice(0, 25))} />);
      expect(await screen.findByText("Page 3 of 3")).toBeInTheDocument();

      rerender(<DatasetPage config={pageWith(fiftyRowData)} />);
      expect(await screen.findByText("Page 5 of 5")).toBeInTheDocument();
    });

    it("returns to the first page when the search term changes", async () => {
      // A different term is a different set of rows, so the position chosen in
      // the old set carries no meaning into it. Driven by typing, because that
      // is the path a reader takes to a new term.
      const user = userEvent.setup();
      await renderPage(fiftyRowData);

      await user.click(screen.getByRole("button", { name: "Go to last page" }));
      expect(screen.getByText("Page 5 of 5")).toBeInTheDocument();

      await user.type(screen.getByRole("textbox", { name: "Search" }), "city");

      await waitFor(() => {
        expect(screen.getByText("Page 1 of 5")).toBeInTheDocument();
      });
    });
  });

  describe("Sorting with Pagination", () => {
    const largeMockData = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      name: `City ${String.fromCharCode(90 - (i % 26))}${i + 1}`, // Z25, Y24, etc.
      nameAscii: `City ${String.fromCharCode(90 - (i % 26))}${i + 1}`,
      country: `Country ${i + 1}`,
      countryIso3: `C${i.toString().padStart(2, "0")}`,
      capital: i % 2 === 0 ? "primary" : "admin",
      population: 1000000 + i * 100000,
    }));

    it("resets to page 1 when sorting changes", async () => {
      const user = userEvent.setup();
      await renderPage(largeMockData);

      // Go to page 2
      const nextButton = screen.getByRole("button", {
        name: /Go to next page/,
      });
      await user.click(nextButton);
      expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();

      // Sort by city
      await user.click(screen.getByRole("button", { name: "City" }));

      // Should reset to page 1
      expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    });

    it("maintains sort order across pages", async () => {
      const user = userEvent.setup();
      await renderPage(largeMockData);

      // Sort by city (ascending)
      await user.click(screen.getByRole("button", { name: "City" }));

      // Get first city on page 1
      const rows = screen.getAllByRole("row");
      const firstCityPage1 = required(
        rows[1],
        "the first body row",
      ).textContent;

      // Go to page 2
      const nextButton = screen.getByRole("button", {
        name: /Go to next page/,
      });
      await user.click(nextButton);

      // Get first city on page 2
      const rowsPage2 = screen.getAllByRole("row");
      const firstCityPage2 = required(
        rowsPage2[1],
        "the first body row on page two",
      ).textContent;

      // Page 2 first city should be alphabetically after page 1 first city
      expect(firstCityPage1.localeCompare(firstCityPage2)).toBeLessThan(0);
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA labels on sort buttons", async () => {
      await renderPage();

      const cityHeader = screen.getByRole("columnheader", { name: /City/ });
      expect(cityHeader).toHaveAttribute("aria-sort", "none");
    });

    it("updates ARIA sort attributes when sorting", async () => {
      const user = userEvent.setup();
      await renderPage();

      const cityHeader = screen.getByRole("columnheader", { name: /City/ });
      const citySortButton = screen.getByRole("button", { name: "City" });
      await user.click(citySortButton);

      expect(cityHeader).toHaveAttribute("aria-sort", "ascending");

      await user.click(citySortButton);
      expect(cityHeader).toHaveAttribute("aria-sort", "descending");
    });

    it("advances one sort state per enter press on the sort button", async () => {
      const user = userEvent.setup();
      await renderPage();

      const cityHeader = screen.getByRole("columnheader", { name: /City/ });
      screen.getByRole("button", { name: "City" }).focus();

      // One press, one state. A manual key handler retained alongside the
      // native button would fire twice here and land on descending.
      await user.keyboard("{Enter}");
      expect(cityHeader).toHaveAttribute("aria-sort", "ascending");
    });

    it("advances one sort state per space press on the sort button", async () => {
      const user = userEvent.setup();
      await renderPage();

      const cityHeader = screen.getByRole("columnheader", { name: /City/ });
      screen.getByRole("button", { name: "City" }).focus();

      // Two presses, two states. A doubled activation would skip descending and
      // land back on none, so this case asserts a single fire and not merely
      // that the key reaches the control.
      await user.keyboard(" ");
      expect(cityHeader).toHaveAttribute("aria-sort", "ascending");

      await user.keyboard(" ");
      expect(cityHeader).toHaveAttribute("aria-sort", "descending");
    });

    it("keeps the sort button named by its column label alone", async () => {
      const user = userEvent.setup();
      await renderPage();

      const citySortButton = screen.getByRole("button", { name: "City" });

      await user.click(citySortButton);
      await user.click(citySortButton);

      // Same control, same name, two activations later. A name that restated
      // the next action would have changed identity twice by now.
      expect(screen.getByRole("button", { name: "City" })).toBe(citySortButton);
    });

    it("marks no rendered element as the current page", async () => {
      const pagedData = Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        name: `City ${i + 1}`,
        nameAscii: `City ${i + 1}`,
        country: `Country ${i + 1}`,
        countryIso3: `C${i.toString().padStart(2, "0")}`,
        capital: i % 2 === 0 ? "primary" : "admin",
        population: 1000000 + i * 100000,
      }));

      const { rerender } = await renderPage(pagedData);
      // Scoped to the main landmark, because the header's dataset nav marks its
      // own link as the current page.
      const main = () => screen.getByRole("main");

      // Matched on the exact attribute name, so a differently cased or partly
      // matching substring of the serialized markup cannot satisfy the
      // assertion.
      expect(main().querySelectorAll("[aria-current]")).toHaveLength(0);

      // And again in the single-page state, where the navigation carrying it
      // is absent altogether.
      rerender(<DatasetPage config={pageWith(mockCities)} />);
      await waitFor(() => {
        expect(screen.queryByText(/Page \d+ of \d+/)).not.toBeInTheDocument();
      });
      expect(main().querySelectorAll("[aria-current]")).toHaveLength(0);
    });

    it("numbers the rows against the whole result set rather than the page", async () => {
      const user = userEvent.setup();
      await renderPage(pagedFixture(45));

      // Forty-five rows and the header row, which ARIA counts alongside them.
      expect(screen.getByRole("table")).toHaveAttribute("aria-rowcount", "46");
      expect(renderedRowIndexes()).toEqual(expectedRowIndexes(2, 10));

      await user.click(screen.getByRole("button", { name: "Go to next page" }));
      await user.click(screen.getByRole("button", { name: "Go to next page" }));
      expect(renderedRowIndexes()).toEqual(expectedRowIndexes(22, 10));

      // The last page is short, so its five rows end at the count above.
      await user.click(screen.getByRole("button", { name: "Go to last page" }));
      expect(renderedRowIndexes()).toEqual(expectedRowIndexes(42, 5));
    });

    it("announces the sort change in the polite region", async () => {
      const user = userEvent.setup();
      const { container } = await renderPage();

      const announcer = container.querySelector(
        '[aria-live="polite"][aria-atomic="true"]',
      );
      expect(announcer).toBeEmptyDOMElement();

      await user.click(screen.getByRole("button", { name: "City" }));

      // The control no longer renames itself to say what just happened, so
      // this region carries it.
      expect(announcer).toHaveTextContent(
        "Table sorted by City in ascending order",
      );

      // The label, because the field name countryIso3 appears nowhere on screen
      // and is not a string a screen reader renders.
      await user.click(screen.getByRole("button", { name: "Country Code" }));
      expect(announcer).toHaveTextContent(
        "Table sorted by Country Code in ascending order",
      );
    });

    it("announces the cleared sort, and stays silent until one is applied", async () => {
      const user = userEvent.setup();
      const { container } = await renderPage();

      const announcer = container.querySelector(
        '[aria-live="polite"][aria-atomic="true"]',
      );
      expect(announcer).toBeEmptyDOMElement();

      const header = screen.getByRole("button", { name: "City" });
      await user.click(header);
      await user.click(header);
      await user.click(header);

      // Emptying the region would announce nothing, so the third press has to
      // say that it removed the sort.
      expect(announcer).toHaveTextContent("Table sort cleared");
    });

    it("announces a search that matches no rows", async () => {
      const { container, rerender } = await renderPage();

      rerender(<DatasetPage config={pageWith([])} />);
      await screen.findByText("No cities found");

      const regions = container.querySelectorAll('[aria-live="polite"]');
      const announced = Array.from(regions).map((region) => region.textContent);
      expect(announced).toContain("No cities found for that search");
    });

    it("has table caption for screen readers", async () => {
      await renderPage();

      const table = screen.getByRole("table");
      const caption = table.querySelector("caption");
      expect(caption).toBeInTheDocument();
      // Matched on the text rather than through toHaveTextContent, whose
      // regex overload the browser project's matcher types shadow.
      expect(caption?.textContent).toMatch(/City data with \d+ entries/);
    });

    it("has proper ARIA labels on pagination buttons", async () => {
      const largeMockData = Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        name: `City ${i + 1}`,
        nameAscii: `City ${i + 1}`,
        country: `Country ${i + 1}`,
        countryIso3: `C${i.toString().padStart(2, "0")}`,
        capital: i % 2 === 0 ? "primary" : "admin",
        population: 1000000 + i * 100000,
      }));

      await renderPage(largeMockData);

      // Named by the action alone. A name carrying the position would change
      // under focus on every press, which re-announces the whole control.
      expect(
        screen.getByRole("button", { name: "Go to first page" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Go to next page" }),
      ).toBeInTheDocument();
    });

    it("announces the whole page position rather than the bare number", async () => {
      // The controls are named by their action alone, so this region is the
      // only thing reporting where the user landed. React mutates just the
      // number inside it, and without aria-atomic that lone text node is the
      // entire announcement.
      const user = userEvent.setup();
      const pagedData = Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        name: `City ${i + 1}`,
        nameAscii: `City ${i + 1}`,
        country: `Country ${i + 1}`,
        countryIso3: `C${i.toString().padStart(2, "0")}`,
        capital: i % 2 === 0 ? "primary" : "admin",
        population: 1000000 + i * 100000,
      }));
      await renderPage(pagedData);

      const pageInfo = screen.getByText(/Page \d+ of \d+/);
      expect(pageInfo).toHaveAttribute("aria-live", "polite");
      expect(pageInfo).toHaveAttribute("aria-atomic", "true");

      await user.click(screen.getByRole("button", { name: "Go to next page" }));
      expect(screen.getByText(/Page \d+ of \d+/)).toHaveTextContent(
        "Page 2 of 3",
      );
    });

    it("has the results region already mounted before the first rows arrive", async () => {
      // A live region created with its message already inside it announces
      // nothing. Mounting it empty ahead of the data makes the first row count,
      // on a cold start and again after a retry, an addition to an existing
      // region instead of a new region arriving with content.
      const { container, rerender } = render(
        <DatasetPage config={pendingPage()} />,
      );

      // The sort region is declared first and the results region second; the
      // page-position region is not rendered in this state. Both are empty
      // here, so they are told apart by position.
      const regions = container.querySelectorAll('[aria-live="polite"]');
      expect(regions).toHaveLength(2);
      const resultsRegion = regions[1];
      expect(resultsRegion).toBeEmptyDOMElement();

      rerender(<DatasetPage config={pageWith(mockCities)} />);
      await screen.findByRole("table");

      expect(resultsRegion?.textContent).toMatch(
        /^Showing \d+ cities out of \d+/,
      );
    });

    it("stays silent while a refresh runs over a dataset already in hand", async () => {
      // A count taken mid-request names rows that are about to go.
      const { container, rerender } = render(
        <DatasetPage config={pageWith([])} />,
      );
      await screen.findByText("No cities found");
      rerender(<DatasetPage config={pendingPage()} />);

      // Two regions here, told apart by position: the page-position region
      // renders only on the data branch.
      const regions = container.querySelectorAll('[aria-live="polite"]');
      expect(regions).toHaveLength(2);
      const resultsRegion = required(regions[1], "the results region");
      expect(resultsRegion).toBeEmptyDOMElement();

      // The same state with the request settled does speak, so the silence
      // above is not vacuous.
      rerender(<DatasetPage config={pageWith([])} />);
      await waitFor(() => {
        expect(resultsRegion).toHaveTextContent(
          "No cities found for that search",
        );
      });
    });

    it("stays silent while a failure shows over a dataset already in hand", async () => {
      const { container, rerender } = await renderPage();
      rerender(<DatasetPage config={failingPage()} />);
      await screen.findByRole("alert");

      // The failure branch is a role="alert" with no aria-live, so the count
      // is still two.
      const regions = container.querySelectorAll('[aria-live="polite"]');
      expect(regions).toHaveLength(2);
      expect(required(regions[1], "the results region")).toBeEmptyDOMElement();
    });

    it("has live regions for dynamic updates", async () => {
      await renderPage();

      const liveRegions = document.querySelectorAll('[aria-live="polite"]');
      expect(liveRegions.length).toBeGreaterThan(0);
    });
  });

  describe("Data Display", () => {
    it("formats population numbers with commas", async () => {
      await renderPage();

      expect(screen.getByText("37,400,068")).toBeInTheDocument(); // Tokyo population
    });

    it("displays capital status correctly", async () => {
      await renderPage();

      // Should show "primary" for capitals and "admin" for non-capitals
      expect(screen.getAllByText("primary")).toHaveLength(3); // Tokyo, Jakarta, New Delhi are primary capitals
      expect(screen.getAllByText("admin")).toHaveLength(2); // Osaka, Mumbai are admin cities
    });

    it("displays all country codes", async () => {
      await renderPage();

      expect(screen.getAllByText("JPN")).toHaveLength(2); // Tokyo and Osaka both in Japan
      expect(screen.getByText("IDN")).toBeInTheDocument(); // Jakarta in Indonesia
      expect(screen.getAllByText("IND")).toHaveLength(2); // Mumbai and New Delhi both in India
    });
  });

  describe("Locale", () => {
    /** Tokyo's population, which is the largest the fixture carries. */
    const LARGEST = required(mockCities[0], "the first fixture row").population;

    /**
     * Testing Library collapses every run of whitespace in the text it matches
     * against, and the French group separator is a narrow no-break space, which
     * is whitespace. The default normalizer would therefore rewrite the very
     * character being asserted about. Trimming and nothing else leaves the
     * separator intact on both sides of the comparison.
     */
    const asWritten = { normalizer: (text: string) => text.trim() };

    // Both expected strings are computed through the platform. The separator
    // above is invisible in every terminal a failure is read in, so a typed
    // literal holding an ordinary space fails on a difference nobody can see.
    it("groups the population column on the resolved locale", async () => {
      setLocaleChoice("fr");

      await renderPage();

      const french = numberFormatFor("fr-FR").format(LARGEST);
      const english = numberFormatFor("en-US").format(LARGEST);

      expect(french).not.toBe(english);
      expect(screen.getByText(french, asWritten)).toBeInTheDocument();
      expect(screen.queryByText(english, asWritten)).not.toBeInTheDocument();
    });

    it("takes its column labels from the catalog", async () => {
      setLocaleChoice("fr");

      await renderPage();

      expect(screen.getByText(fr.cities.columns.name)).toBeInTheDocument();
      expect(
        screen.getByText(fr.cities.columns.countryIso3),
      ).toBeInTheDocument();
      expect(screen.queryByText("Country Code")).not.toBeInTheDocument();
    });

    // The table's own chrome, which used to be English literals inside the
    // shared component. Every one of them moves on the same render, because
    // they all arrive in the one object the memo below rebuilds.
    it("takes the table's own chrome from the catalog", async () => {
      const user = userEvent.setup();
      setLocaleChoice("fr");

      const { container, rerender } = render(
        <DatasetPage config={pendingPage()} />,
      );

      expect(screen.getByText(fr.cities.loading)).toBeInTheDocument();

      rerender(<DatasetPage config={pageWith(mockCities)} />);
      await screen.findByRole("table");

      // Re-read on each call, because the assertion is about what the caption
      // says now and the second read happens after a re-render.
      const captionText = () =>
        screen.getByRole("table").querySelector("caption")?.textContent ?? "";

      expect(captionText()).toContain(fr.common.unsorted);

      const announcer = container.querySelector(
        '[aria-live="polite"][aria-atomic="true"]',
      );

      await user.click(
        screen.getByRole("button", { name: fr.cities.columns.name }),
      );

      expect(announcer).toHaveTextContent(
        fr.common.sortedAnnouncement(fr.cities.columns.name, "asc"),
      );
      expect(captionText()).toContain(
        fr.common.sortSummary(fr.cities.columns.name, "asc"),
      );
    });

    it("takes the failure and the way back from the catalog", async () => {
      setLocaleChoice("fr");

      render(<DatasetPage config={failingPage()} />);

      expect(
        await screen.findByText(
          fr.common.error(fr.cities.datasetError.transport("fr-FR", 0)),
          asWritten,
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: fr.common.retry }),
      ).toBeInTheDocument();
    });

    it("takes the search box's own two strings from the catalog", async () => {
      setLocaleChoice("fr");

      await renderPage();

      const box = screen.getByRole("textbox", { name: fr.common.searchName });
      expect(box).toHaveAttribute("placeholder", fr.cities.searchPlaceholder);
    });

    // One catalog entry per control, read twice. Two entries would let a
    // translation move the tooltip and leave the accessible name in the
    // previous language, which nothing on screen would show.
    it("names each page control once, as both its tooltip and its accessible name", async () => {
      setLocaleChoice("fr");

      await renderPage(pagedFixture(25));

      expect(
        screen.getByRole("navigation", {
          name: fr.common.paginationNavigation,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(fr.common.pageSize, asWritten),
      ).toBeInTheDocument();

      for (const name of [
        fr.common.firstPage,
        fr.common.previousPage,
        fr.common.nextPage,
        fr.common.lastPage,
      ]) {
        expect(screen.getByRole("button", { name })).toHaveAttribute(
          "title",
          name,
        );
      }
    });

    // Enough pages that the total carries a group separator, so the assertion
    // reaches the grouping at all. Both sides are computed through the catalog
    // on the resolved tag, because the French separator is a narrow no-break
    // space and a typed literal holding an ordinary one fails on a difference
    // no terminal renders.
    it("groups the page label's numbers on the resolved locale", async () => {
      setLocaleChoice("fr");

      const rows = pagedFixture(10010);
      const totalPages = rows.length / 10;

      await renderPage(rows);

      const expected = fr.common.pageStatus("fr-FR", 1, totalPages);

      expect(expected).not.toBe(`Page 1 sur ${String(totalPages)}`);
      expect(screen.getByText(expected, asWritten)).toBeInTheDocument();
    });

    // The same claim the column array carries, and for the same reason. The
    // table holds this object across renders and several of its entries are
    // closures, so its identity has to move when the locale does and must not
    // move otherwise.
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

    // The sort and page memos downstream depend on the array identity, so a
    // build on a render where the locale did not move would re-sort the whole
    // collection and re-slice the page for nothing. From here a changed
    // identity shows up as a second call to the builder, so the count is what
    // this case asserts.
    it("builds the column array once per locale and not once per render", async () => {
      const built = vi.fn(buildCityColumns);
      const config = { ...pageWith(mockCities), buildColumns: built };

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
  });
});
