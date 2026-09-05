import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CityTable } from "./CityTable";
import type { City } from "../../api/getCities";
import { fr } from "../../i18n/catalogs/fr";
import { numberFormatFor } from "../../i18n/format";
import { setLocaleChoice } from "../../i18n/localeStore";
import { required } from "../../test/required";
import { buildCityColumns } from "./cityColumns";
import { buildTableLabels } from "../tableLabels";

// A spy over the real builder rather than a replacement for it, so every case
// in this file goes on exercising the shipping columns. The one thing a spy can
// see that the rendered output cannot is how many times the array was built,
// which is the whole content of the claim that its identity follows the locale
// and nothing else.
vi.mock("./cityColumns", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./cityColumns")>();

  return { ...actual, buildCityColumns: vi.fn(actual.buildCityColumns) };
});

// The same spy over the labels builder, and for the same reason. The object it
// returns is held by the table across renders, so how often it is built is the
// whole content of the claim that its identity follows the locale.
vi.mock("../tableLabels", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../tableLabels")>();

  return { ...actual, buildTableLabels: vi.fn(actual.buildTableLabels) };
});

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
 * A run of rows wide enough to page, generated rather than written out. Nothing
 * in the content is asserted; only how many there are.
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

const defaultProps = {
  data: mockCities,
  onSearchChange: vi.fn(),
  loading: false,
  // The honest default for a fixture that already carries rows.
  datasetReady: true,
  errorMessage: null,
};

describe("CityTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders table with correct headers", () => {
      render(<CityTable {...defaultProps} />);

      expect(screen.getByText("City")).toBeInTheDocument();
      expect(screen.getByText("Country")).toBeInTheDocument();
      expect(screen.getByText("Capital")).toBeInTheDocument();
      expect(screen.getByText("Country Code")).toBeInTheDocument();
      expect(screen.getByText("Population")).toBeInTheDocument();
    });

    it("renders all city data", () => {
      render(<CityTable {...defaultProps} />);

      expect(screen.getByText("Tokyo")).toBeInTheDocument();
      expect(screen.getByText("Jakarta")).toBeInTheDocument();
      expect(screen.getByText("Osaka")).toBeInTheDocument();
      expect(screen.getByText("Mumbai")).toBeInTheDocument();
      expect(screen.getByText("New Delhi")).toBeInTheDocument();
    });

    it("renders search input", () => {
      render(<CityTable {...defaultProps} />);

      const searchInput = screen.getByRole("textbox", { name: "Search" });
      expect(searchInput).toBeInTheDocument();
      expect(searchInput).toHaveAttribute("placeholder", "Search for a city");
    });
  });

  describe("Search Functionality", () => {
    it("reports the term upward once typing has paused, not once per keystroke", async () => {
      const user = userEvent.setup();
      const mockOnSearchChange = vi.fn();

      render(
        <CityTable {...defaultProps} onSearchChange={mockOnSearchChange} />,
      );

      const searchInput = screen.getByRole("textbox", { name: "Search" });
      await user.type(searchInput, "Tok");

      // The commit waits for the pause, so three keystrokes settle into one
      // call carrying the whole word rather than three carrying prefixes.
      await waitFor(() => {
        expect(mockOnSearchChange).toHaveBeenCalledWith("Tok");
      });
      expect(mockOnSearchChange).toHaveBeenCalledTimes(1);
    });

    it("displays what has been typed into the search input", async () => {
      const user = userEvent.setup();
      render(<CityTable {...defaultProps} />);

      const searchInput = screen.getByRole("textbox", { name: "Search" });
      await user.type(searchInput, "Tokyo");

      // The box repaints on every keystroke, so it shows the term before the
      // table has been asked for it.
      expect(searchInput).toHaveValue("Tokyo");
    });

    it("shows search input even when there's an error", () => {
      render(<CityTable {...defaultProps} errorMessage="Test error" />);

      expect(
        screen.getByRole("textbox", { name: "Search" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Error: Test error")).toBeInTheDocument();
    });
  });

  describe("Loading and Error States", () => {
    it("renders the download copy while the dataset has never arrived", () => {
      render(
        <CityTable
          {...defaultProps}
          data={[]}
          loading={true}
          datasetReady={false}
        />,
      );

      expect(
        screen.getByText("Downloading the city data..."),
      ).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("renders no download copy while refetching over a dataset that has already arrived", () => {
      // The user path this stands for: a search that returned nothing,
      // followed by one more keystroke. Nothing is downloading, and a row
      // count cannot tell that apart from a cold start.
      render(
        <CityTable
          {...defaultProps}
          data={[]}
          loading={true}
          datasetReady={true}
        />,
      );

      expect(screen.queryByText("Downloading the city data...")).toBeNull();
      expect(screen.getByText("No cities found")).toBeInTheDocument();
    });

    it("does not claim an empty search before the first request starts", () => {
      // The container's first paint, before the effect raises the loading
      // flag. Nothing has arrived and nothing has been searched for, so the
      // empty-result copy would be a statement about a search that never ran.
      const { container } = render(
        <CityTable
          {...defaultProps}
          data={[]}
          loading={false}
          datasetReady={false}
        />,
      );

      expect(screen.queryByText("No cities found")).toBeNull();
      expect(
        screen.getByText("Downloading the city data..."),
      ).toBeInTheDocument();
      expect(container.textContent).not.toContain(
        "No cities found for that search",
      );
    });

    it("keeps the table mounted while refetching with results on screen", () => {
      const { rerender } = render(<CityTable {...defaultProps} />);
      const tableBeforeRefetch = screen.getByRole("table");

      rerender(<CityTable {...defaultProps} loading={true} />);

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

    it("shows error state", () => {
      render(
        <CityTable {...defaultProps} errorMessage="Failed to fetch cities" />,
      );

      expect(
        screen.getByText("Error: Failed to fetch cities"),
      ).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("shows empty state when no data", () => {
      render(<CityTable {...defaultProps} data={[]} />);

      expect(screen.getByText("No cities found")).toBeInTheDocument();
    });

    it("keeps the download copy off screen while refetching with rows on show", () => {
      render(<CityTable {...defaultProps} loading={true} />);

      // The refetch path. Replacing the view here is what would unmount the
      // table on every keystroke.
      expect(
        screen.queryByText("Downloading the city data..."),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("table")).toBeInTheDocument();
    });

    it("offers a retry control in the error region when a handler is given", async () => {
      const user = userEvent.setup();
      const onRetry = vi.fn();

      render(
        <CityTable
          {...defaultProps}
          data={[]}
          errorMessage="The city data could not be downloaded."
          onRetry={onRetry}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Try again" }));

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("offers no retry control when no handler is given", () => {
      render(
        <CityTable
          {...defaultProps}
          data={[]}
          errorMessage="The city data could not be downloaded."
        />,
      );

      expect(
        screen.getByText("Error: The city data could not be downloaded."),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Try again" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Sorting Functionality", () => {
    it("sorts by city name in ascending order", async () => {
      const user = userEvent.setup();
      render(<CityTable {...defaultProps} />);

      await user.click(screen.getByRole("button", { name: "City" }));

      const rows = screen.getAllByRole("row");
      const firstDataRow = rows[1]; // Skip header row
      expect(firstDataRow).toHaveTextContent("Jakarta"); // First alphabetically
    });

    it("sorts by population in ascending order", async () => {
      const user = userEvent.setup();
      render(<CityTable {...defaultProps} />);

      await user.click(screen.getByRole("button", { name: "Population" }));

      const rows = screen.getAllByRole("row");
      const firstDataRow = rows[1];
      expect(firstDataRow).toHaveTextContent("Osaka"); // Smallest population
    });

    it("implements three-state sorting (asc -> desc -> none)", async () => {
      const user = userEvent.setup();
      render(<CityTable {...defaultProps} />);

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
      render(<CityTable {...defaultProps} />);

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

    it("switches sort when clicking different column", async () => {
      const user = userEvent.setup();
      render(<CityTable {...defaultProps} />);

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
     * Fifty rows rather than the twenty-five the neighbouring cases use. At the
     * default page size of ten that is five pages, which is what the narrowing
     * regression case needs: a page position deep enough that shrinking the set
     * leaves it well past the end. Twenty-five rows reach only page three.
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

    it("shows pagination controls when data exceeds page size", () => {
      render(<CityTable {...defaultProps} data={largeMockData} />);

      expect(screen.getByText(/Page \d+ of \d+/)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Go to next page/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Go to previous page/ }),
      ).toBeInTheDocument();
    });

    it("doesn't show pagination for single page of data", () => {
      render(<CityTable {...defaultProps} />);

      expect(screen.queryByText(/Page \d+ of \d+/)).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Go to next page/ }),
      ).not.toBeInTheDocument();
    });

    it("navigates to next page", async () => {
      const user = userEvent.setup();
      render(<CityTable {...defaultProps} data={largeMockData} />);

      expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();

      const nextButton = screen.getByRole("button", {
        name: /Go to next page/,
      });
      await user.click(nextButton);

      expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    });

    it("navigates to previous page", async () => {
      const user = userEvent.setup();
      render(<CityTable {...defaultProps} data={largeMockData} />);

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
      render(<CityTable {...defaultProps} data={largeMockData} />);

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
      render(<CityTable {...defaultProps} data={largeMockData} />);

      const lastButton = screen.getByRole("button", {
        name: /Go to last page/,
      });
      await user.click(lastButton);

      expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();
    });

    it("disables navigation buttons appropriately", () => {
      render(<CityTable {...defaultProps} data={largeMockData} />);

      // On first page, prev and first should be disabled
      expect(
        screen.getByRole("button", { name: /Go to previous page/ }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: /Go to first page/ }),
      ).toBeDisabled();

      // Next and last should be enabled
      expect(
        screen.getByRole("button", { name: /Go to next page/ }),
      ).not.toBeDisabled();
      expect(
        screen.getByRole("button", { name: /Go to last page/ }),
      ).not.toBeDisabled();
    });

    it("changes page size", async () => {
      const user = userEvent.setup();
      render(<CityTable {...defaultProps} data={largeMockData} />);

      const pageSelect = screen.getByLabelText("Per page:");
      expect(pageSelect).toHaveValue("10"); // Default value

      await user.selectOptions(pageSelect, "25");
      expect(pageSelect).toHaveValue("25"); // Value changed
    });

    it("resets to page 1 when page size changes", async () => {
      const user = userEvent.setup();
      render(<CityTable {...defaultProps} data={largeMockData} />);

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
      const { rerender } = render(
        <CityTable {...defaultProps} data={fiftyRowData} />,
      );

      await user.click(screen.getByRole("button", { name: /Go to last page/ }));
      expect(screen.getByText("Page 5 of 5")).toBeInTheDocument();

      // Rerendering the mounted instance is what reproduces the trap. A fresh
      // render would start on page one and never reach the state where the
      // navigation has vanished and no control on screen offers a way back.
      rerender(<CityTable {...defaultProps} data={fiftyRowData.slice(0, 3)} />);

      expect(screen.queryByText("No cities found")).not.toBeInTheDocument();
      expect(screen.getAllByRole("row")).toHaveLength(4);
    });

    it("shows no pagination navigation at exactly one page of rows", () => {
      render(<CityTable {...defaultProps} data={fiftyRowData.slice(0, 10)} />);

      // Header row plus all ten data rows.
      expect(screen.getAllByRole("row")).toHaveLength(11);
      expect(
        screen.queryByRole("navigation", {
          name: "Table pagination navigation",
        }),
      ).not.toBeInTheDocument();
    });

    it("shows pagination navigation reporting two pages at one row past a page", () => {
      render(<CityTable {...defaultProps} data={fiftyRowData.slice(0, 11)} />);

      expect(
        screen.getByRole("navigation", {
          name: "Table pagination navigation",
        }),
      ).toBeInTheDocument();
      expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    });

    // This case is a guard rather than a proof, and the assertions in it pass
    // against the unfixed code too. The page count is rendered inside the
    // navigation, the navigation is hidden below two pages, and both sit inside
    // the branch taken only when rows exist, so a page count of zero was never
    // reachable in the rendered output either before or after the arithmetic
    // was corrected. What this case catches is a future change that lets an
    // empty result set reach the navigation at all.
    it("renders the empty state and no navigation when the result set narrows to nothing", async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <CityTable {...defaultProps} data={fiftyRowData} />,
      );

      await user.click(screen.getByRole("button", { name: /Go to last page/ }));

      rerender(<CityTable {...defaultProps} data={[]} />);

      expect(screen.getByText("No cities found")).toBeInTheDocument();
      expect(
        screen.queryByRole("navigation", {
          name: "Table pagination navigation",
        }),
      ).not.toBeInTheDocument();
    });

    it("restores the original page when the result set widens again", async () => {
      // The clamp reads the position without rewriting it, which is what makes
      // the narrowing recoverable: it shows the user a different page without
      // moving them off the one they chose.
      const user = userEvent.setup();
      const { rerender } = render(
        <CityTable {...defaultProps} data={fiftyRowData} />,
      );

      await user.click(screen.getByRole("button", { name: /Go to last page/ }));
      expect(screen.getByText("Page 5 of 5")).toBeInTheDocument();

      rerender(
        <CityTable {...defaultProps} data={fiftyRowData.slice(0, 25)} />,
      );
      expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();

      rerender(<CityTable {...defaultProps} data={fiftyRowData} />);
      expect(screen.getByText("Page 5 of 5")).toBeInTheDocument();
    });

    it("returns to the first page when the search term changes", async () => {
      // A different term is a different set of rows, so the position chosen in
      // the old set carries no meaning into it. Driven by typing, because that
      // is the path a reader takes to a new term.
      const user = userEvent.setup();
      render(<CityTable {...defaultProps} data={fiftyRowData} />);

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
      render(<CityTable {...defaultProps} data={largeMockData} />);

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
      render(<CityTable {...defaultProps} data={largeMockData} />);

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
    it("has proper ARIA labels on sort buttons", () => {
      render(<CityTable {...defaultProps} />);

      const cityHeader = screen.getByRole("columnheader", { name: /City/ });
      expect(cityHeader).toHaveAttribute("aria-sort", "none");
    });

    it("updates ARIA sort attributes when sorting", async () => {
      const user = userEvent.setup();
      render(<CityTable {...defaultProps} />);

      const cityHeader = screen.getByRole("columnheader", { name: /City/ });
      const citySortButton = screen.getByRole("button", { name: "City" });
      await user.click(citySortButton);

      expect(cityHeader).toHaveAttribute("aria-sort", "ascending");

      await user.click(citySortButton);
      expect(cityHeader).toHaveAttribute("aria-sort", "descending");
    });

    it("advances one sort state per enter press on the sort button", async () => {
      const user = userEvent.setup();
      render(<CityTable {...defaultProps} />);

      const cityHeader = screen.getByRole("columnheader", { name: /City/ });
      screen.getByRole("button", { name: "City" }).focus();

      // One press, one state. A manual key handler retained alongside the
      // native button would fire twice here and land on descending.
      await user.keyboard("{Enter}");
      expect(cityHeader).toHaveAttribute("aria-sort", "ascending");
    });

    it("advances one sort state per space press on the sort button", async () => {
      const user = userEvent.setup();
      render(<CityTable {...defaultProps} />);

      const cityHeader = screen.getByRole("columnheader", { name: /City/ });
      screen.getByRole("button", { name: "City" }).focus();

      // Two presses, two states. A doubled activation would skip descending
      // and land back on none, which is what makes this the single-fire
      // assertion rather than a keyboard-reachability one.
      await user.keyboard(" ");
      expect(cityHeader).toHaveAttribute("aria-sort", "ascending");

      await user.keyboard(" ");
      expect(cityHeader).toHaveAttribute("aria-sort", "descending");
    });

    it("keeps the sort button named by its column label alone", async () => {
      const user = userEvent.setup();
      render(<CityTable {...defaultProps} />);

      const citySortButton = screen.getByRole("button", { name: "City" });

      await user.click(citySortButton);
      await user.click(citySortButton);

      // Same control, same name, two activations later. A name that restated
      // the next action would have changed identity twice by now.
      expect(screen.getByRole("button", { name: "City" })).toBe(citySortButton);
    });

    it("marks no rendered element as the current page", () => {
      const pagedData = Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        name: `City ${i + 1}`,
        nameAscii: `City ${i + 1}`,
        country: `Country ${i + 1}`,
        countryIso3: `C${i.toString().padStart(2, "0")}`,
        capital: i % 2 === 0 ? "primary" : "admin",
        population: 1000000 + i * 100000,
      }));

      const { rerender, container } = render(
        <CityTable {...defaultProps} data={pagedData} />,
      );

      // Matched on the exact attribute name rather than on a substring of the
      // serialized markup, so a differently cased or partly matching
      // attribute cannot satisfy the assertion.
      expect(container.querySelectorAll("[aria-current]")).toHaveLength(0);

      // And again in the single-page state, where the navigation carrying it
      // is absent altogether.
      rerender(<CityTable {...defaultProps} />);
      expect(container.querySelectorAll("[aria-current]")).toHaveLength(0);
    });

    it("announces the sort change in the polite region", async () => {
      const user = userEvent.setup();
      const { container } = render(<CityTable {...defaultProps} />);

      const announcer = container.querySelector(
        '[aria-live="polite"][aria-atomic="true"]',
      );
      expect(announcer).toBeEmptyDOMElement();

      await user.click(screen.getByRole("button", { name: "City" }));

      // The control no longer renames itself to say what just happened, so
      // this region is what carries it.
      expect(announcer).toHaveTextContent(
        "Table sorted by City in ascending order",
      );

      // The label rather than the field name: countryIso3 is not the name of
      // anything on screen, and it is not a string a screen reader renders.
      await user.click(screen.getByRole("button", { name: "Country Code" }));
      expect(announcer).toHaveTextContent(
        "Table sorted by Country Code in ascending order",
      );
    });

    it("announces the cleared sort, and stays silent until one is applied", async () => {
      const user = userEvent.setup();
      const { container } = render(<CityTable {...defaultProps} />);

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

    it("announces a search that matches no rows", () => {
      const { container, rerender } = render(<CityTable {...defaultProps} />);

      rerender(<CityTable {...defaultProps} data={[]} />);

      const regions = container.querySelectorAll('[aria-live="polite"]');
      const announced = Array.from(regions).map((region) => region.textContent);
      expect(announced).toContain("No cities found for that search");
    });

    it("has table caption for screen readers", () => {
      render(<CityTable {...defaultProps} />);

      const table = screen.getByRole("table");
      const caption = table.querySelector("caption");
      expect(caption).toBeInTheDocument();
      expect(caption).toHaveTextContent(/City data with \d+ entries/);
    });

    it("has proper ARIA labels on pagination buttons", () => {
      const largeMockData = Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        name: `City ${i + 1}`,
        nameAscii: `City ${i + 1}`,
        country: `Country ${i + 1}`,
        countryIso3: `C${i.toString().padStart(2, "0")}`,
        capital: i % 2 === 0 ? "primary" : "admin",
        population: 1000000 + i * 100000,
      }));

      render(<CityTable {...defaultProps} data={largeMockData} />);

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
      render(<CityTable {...defaultProps} data={pagedData} />);

      const pageInfo = screen.getByText(/Page \d+ of \d+/);
      expect(pageInfo).toHaveAttribute("aria-live", "polite");
      expect(pageInfo).toHaveAttribute("aria-atomic", "true");

      await user.click(screen.getByRole("button", { name: "Go to next page" }));
      expect(screen.getByText(/Page \d+ of \d+/)).toHaveTextContent(
        "Page 2 of 3",
      );
    });

    it("has the results region already mounted before the first rows arrive", () => {
      // A live region created with its message already inside it announces
      // nothing. Mounting it empty ahead of the data is what makes the first
      // row count, on a cold start and again after a retry, an addition to an
      // existing region rather than a new region with content.
      const { container, rerender } = render(
        <CityTable
          {...defaultProps}
          data={[]}
          loading={true}
          datasetReady={false}
        />,
      );

      // The sort region is declared first and the results region second; the
      // page-position region is not rendered in this state. Both are empty
      // here, which is the point, so they are told apart by position.
      const regions = container.querySelectorAll('[aria-live="polite"]');
      expect(regions).toHaveLength(2);
      const resultsRegion = regions[1];
      expect(resultsRegion).toBeEmptyDOMElement();

      rerender(<CityTable {...defaultProps} />);

      expect(resultsRegion).toHaveTextContent(/^Showing \d+ cities out of \d+/);
    });

    it("has live regions for dynamic updates", () => {
      render(<CityTable {...defaultProps} />);

      const liveRegions = document.querySelectorAll('[aria-live="polite"]');
      expect(liveRegions.length).toBeGreaterThan(0);
    });
  });

  describe("Data Display", () => {
    it("formats population numbers with commas", () => {
      render(<CityTable {...defaultProps} />);

      expect(screen.getByText("37,400,068")).toBeInTheDocument(); // Tokyo population
    });

    it("displays capital status correctly", () => {
      render(<CityTable {...defaultProps} />);

      // Should show "primary" for capitals and "admin" for non-capitals
      expect(screen.getAllByText("primary")).toHaveLength(3); // Tokyo, Jakarta, New Delhi are primary capitals
      expect(screen.getAllByText("admin")).toHaveLength(2); // Osaka, Mumbai are admin cities
    });

    it("displays all country codes", () => {
      render(<CityTable {...defaultProps} />);

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
     * character being asserted about. Trimming and nothing else is what leaves
     * the separator intact on both sides of the comparison.
     */
    const asWritten = { normalizer: (text: string) => text.trim() };

    // Both expected strings are computed through the platform rather than
    // typed. The separator above is invisible in every terminal a failure is
    // read in, so a typed literal holding an ordinary space fails on a
    // difference nobody can see.
    it("groups the population column on the resolved locale", () => {
      setLocaleChoice("fr");

      render(<CityTable {...defaultProps} />);

      const french = numberFormatFor("fr-FR").format(LARGEST);
      const english = numberFormatFor("en-US").format(LARGEST);

      expect(french).not.toBe(english);
      expect(screen.getByText(french, asWritten)).toBeInTheDocument();
      expect(screen.queryByText(english, asWritten)).not.toBeInTheDocument();
    });

    it("takes its column labels from the catalog", () => {
      setLocaleChoice("fr");

      render(<CityTable {...defaultProps} />);

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
        <CityTable
          {...defaultProps}
          data={[]}
          loading={true}
          datasetReady={false}
        />,
      );

      expect(screen.getByText(fr.cities.loading)).toBeInTheDocument();

      rerender(<CityTable {...defaultProps} />);

      // Re-read rather than held, because the assertion is about what the
      // caption says now and the second read happens after a re-render.
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

    it("takes the failure and the way back from the catalog", () => {
      setLocaleChoice("fr");

      render(
        <CityTable
          {...defaultProps}
          data={[]}
          errorMessage="quelque chose a mal tourné"
          onRetry={() => {}}
        />,
      );

      expect(
        screen.getByText(
          fr.common.error("quelque chose a mal tourné"),
          asWritten,
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: fr.common.retry }),
      ).toBeInTheDocument();
    });

    it("takes the search box's own two strings from the catalog", () => {
      setLocaleChoice("fr");

      render(<CityTable {...defaultProps} />);

      const box = screen.getByRole("textbox", { name: fr.common.searchName });
      expect(box).toHaveAttribute("placeholder", fr.cities.searchPlaceholder);
    });

    // One catalog entry per control, read twice. Two entries would let a
    // translation move the tooltip and leave the accessible name in the
    // previous language, which nothing on screen would show.
    it("names each page control once, as both its tooltip and its accessible name", () => {
      setLocaleChoice("fr");

      render(<CityTable {...defaultProps} data={pagedFixture(25)} />);

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
    // is about grouping rather than about a number too small to group. Both
    // sides are computed through the catalog on the resolved tag: the French
    // separator is a narrow no-break space and a typed literal holding an
    // ordinary one fails on a difference no terminal renders.
    it("groups the page label's numbers on the resolved locale", () => {
      setLocaleChoice("fr");

      const rows = pagedFixture(10010);
      const totalPages = rows.length / 10;

      render(<CityTable {...defaultProps} data={rows} />);

      const expected = fr.common.pageStatus("fr-FR", 1, totalPages);

      expect(expected).not.toBe(`Page 1 sur ${String(totalPages)}`);
      expect(screen.getByText(expected, asWritten)).toBeInTheDocument();
    });

    // The same claim the column array carries, and for the same reason: the
    // table holds this object across renders and several of its entries are
    // closures, so its identity has to move when the locale does and must not
    // move otherwise.
    it("builds the labels object once per locale and not once per render", () => {
      const built = vi.mocked(buildTableLabels);

      setLocaleChoice("en");

      const { rerender } = render(<CityTable {...defaultProps} />);

      expect(built).toHaveBeenCalledTimes(1);

      rerender(<CityTable {...defaultProps} />);
      rerender(<CityTable {...defaultProps} loading={true} />);

      expect(built).toHaveBeenCalledTimes(1);

      act(() => {
        setLocaleChoice("fr");
      });

      expect(built).toHaveBeenCalledTimes(2);
    });

    // The array identity is what the sort and page memos downstream depend on:
    // a build on a render where the locale did not move would re-sort the whole
    // collection and re-slice the page for nothing. A second call to the
    // builder is exactly what a changed identity looks like from here, which is
    // why the count is the assertion.
    it("builds the column array once per locale and not once per render", () => {
      const built = vi.mocked(buildCityColumns);

      // Pinned before the first render rather than left to the machine, so the
      // store has nothing left to settle on once the table is mounted.
      setLocaleChoice("en");

      const { rerender } = render(<CityTable {...defaultProps} />);

      expect(built).toHaveBeenCalledTimes(1);

      rerender(<CityTable {...defaultProps} />);
      rerender(<CityTable {...defaultProps} />);

      expect(built).toHaveBeenCalledTimes(1);

      act(() => {
        setLocaleChoice("fr");
      });

      expect(built).toHaveBeenCalledTimes(2);

      // Narrowed rather than read straight: a recorded result is either a
      // return or a throw, so its value is untyped until it is treated as the
      // opaque thing this assertion actually needs.
      const [first, second] = built.mock.results.map(
        (call) => call.value as unknown,
      );

      expect(second).not.toBe(first);
    });
  });
});
