import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SortableTable } from "./SortableTable";
import type { City } from "../api/getCities";

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

const defaultProps = {
  data: mockCities,
  searchTerm: "",
  onSearchChange: vi.fn(),
  loading: false,
  // The honest default for a fixture that already carries rows.
  datasetReady: true,
  error: null,
};

describe("SortableTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders table with correct headers", () => {
      render(<SortableTable {...defaultProps} />);

      expect(screen.getByText("City")).toBeInTheDocument();
      expect(screen.getByText("Country")).toBeInTheDocument();
      expect(screen.getByText("Capital")).toBeInTheDocument();
      expect(screen.getByText("Country Code")).toBeInTheDocument();
      expect(screen.getByText("Population")).toBeInTheDocument();
    });

    it("renders all city data", () => {
      render(<SortableTable {...defaultProps} />);

      expect(screen.getByText("Tokyo")).toBeInTheDocument();
      expect(screen.getByText("Jakarta")).toBeInTheDocument();
      expect(screen.getByText("Osaka")).toBeInTheDocument();
      expect(screen.getByText("Mumbai")).toBeInTheDocument();
      expect(screen.getByText("New Delhi")).toBeInTheDocument();
    });

    it("renders search input", () => {
      render(<SortableTable {...defaultProps} />);

      const searchInput = screen.getByRole("textbox", { name: "Search" });
      expect(searchInput).toBeInTheDocument();
      expect(searchInput).toHaveAttribute("placeholder", "Search for a city");
    });
  });

  describe("Search Functionality", () => {
    it("calls onSearchChange when typing in search input", async () => {
      const user = userEvent.setup();
      const mockOnSearchChange = vi.fn();

      render(
        <SortableTable {...defaultProps} onSearchChange={mockOnSearchChange} />,
      );

      const searchInput = screen.getByRole("textbox", { name: "Search" });
      await user.type(searchInput, "T");

      // Should be called when typing
      expect(mockOnSearchChange).toHaveBeenCalledWith("T");
    });

    it("displays search term in input", () => {
      render(<SortableTable {...defaultProps} searchTerm="Tokyo" />);

      const searchInput = screen.getByRole("textbox", { name: "Search" });
      expect(searchInput).toHaveValue("Tokyo");
    });

    it("shows search input even when there's an error", () => {
      const error = new Error("Test error");
      render(<SortableTable {...defaultProps} error={error} />);

      expect(
        screen.getByRole("textbox", { name: "Search" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Error: Test error")).toBeInTheDocument();
    });
  });

  describe("Loading and Error States", () => {
    it("renders the download copy while the dataset has never arrived", () => {
      render(
        <SortableTable
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
        <SortableTable
          {...defaultProps}
          data={[]}
          loading={true}
          datasetReady={true}
        />,
      );

      expect(screen.queryByText("Downloading the city data...")).toBeNull();
      expect(screen.getByText("No cities found")).toBeInTheDocument();
    });

    it("renders no download copy before the first request starts", () => {
      // The container's first paint, before the effect raises the loading
      // flag. It is what makes the loading operand load-bearing rather than
      // decorative.
      render(
        <SortableTable
          {...defaultProps}
          data={[]}
          loading={false}
          datasetReady={false}
        />,
      );

      expect(screen.queryByText("Downloading the city data...")).toBeNull();
    });

    it("keeps the table mounted while refetching with results on screen", () => {
      const { rerender } = render(<SortableTable {...defaultProps} />);
      const tableBeforeRefetch = screen.getByRole("table");

      rerender(<SortableTable {...defaultProps} loading={true} />);

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
      const error = new Error("Failed to fetch cities");
      render(<SortableTable {...defaultProps} error={error} />);

      expect(
        screen.getByText("Error: Failed to fetch cities"),
      ).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("shows empty state when no data", () => {
      render(<SortableTable {...defaultProps} data={[]} />);

      expect(screen.getByText("No cities found")).toBeInTheDocument();
    });

    it("keeps the download copy off screen while refetching with rows on show", () => {
      render(<SortableTable {...defaultProps} loading={true} />);

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
      const error = new Error("The city data could not be downloaded.");

      render(
        <SortableTable
          {...defaultProps}
          data={[]}
          error={error}
          onRetry={onRetry}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Try again" }));

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("offers no retry control when no handler is given", () => {
      const error = new Error("The city data could not be downloaded.");

      render(<SortableTable {...defaultProps} data={[]} error={error} />);

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
      render(<SortableTable {...defaultProps} />);

      await user.click(screen.getByRole("button", { name: "City" }));

      const rows = screen.getAllByRole("row");
      const firstDataRow = rows[1]; // Skip header row
      expect(firstDataRow).toHaveTextContent("Jakarta"); // First alphabetically
    });

    it("sorts by population in ascending order", async () => {
      const user = userEvent.setup();
      render(<SortableTable {...defaultProps} />);

      await user.click(screen.getByRole("button", { name: "Population" }));

      const rows = screen.getAllByRole("row");
      const firstDataRow = rows[1];
      expect(firstDataRow).toHaveTextContent("Osaka"); // Smallest population
    });

    it("implements three-state sorting (asc -> desc -> none)", async () => {
      const user = userEvent.setup();
      render(<SortableTable {...defaultProps} />);

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
      render(<SortableTable {...defaultProps} />);

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
      render(<SortableTable {...defaultProps} />);

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
      render(<SortableTable {...defaultProps} data={largeMockData} />);

      expect(screen.getByText(/Page \d+ of \d+/)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Go to next page/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Go to previous page/ }),
      ).toBeInTheDocument();
    });

    it("doesn't show pagination for single page of data", () => {
      render(<SortableTable {...defaultProps} />);

      expect(screen.queryByText(/Page \d+ of \d+/)).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Go to next page/ }),
      ).not.toBeInTheDocument();
    });

    it("navigates to next page", async () => {
      const user = userEvent.setup();
      render(<SortableTable {...defaultProps} data={largeMockData} />);

      expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();

      const nextButton = screen.getByRole("button", {
        name: /Go to next page/,
      });
      await user.click(nextButton);

      expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    });

    it("navigates to previous page", async () => {
      const user = userEvent.setup();
      render(<SortableTable {...defaultProps} data={largeMockData} />);

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
      render(<SortableTable {...defaultProps} data={largeMockData} />);

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
      render(<SortableTable {...defaultProps} data={largeMockData} />);

      const lastButton = screen.getByRole("button", {
        name: /Go to last page/,
      });
      await user.click(lastButton);

      expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();
    });

    it("disables navigation buttons appropriately", () => {
      render(<SortableTable {...defaultProps} data={largeMockData} />);

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
      render(<SortableTable {...defaultProps} data={largeMockData} />);

      const pageSelect = screen.getByLabelText("Per page:");
      expect(pageSelect).toHaveValue("10"); // Default value

      await user.selectOptions(pageSelect, "25");
      expect(pageSelect).toHaveValue("25"); // Value changed
    });

    it("resets to page 1 when page size changes", async () => {
      const user = userEvent.setup();
      render(<SortableTable {...defaultProps} data={largeMockData} />);

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
        <SortableTable {...defaultProps} data={fiftyRowData} />,
      );

      await user.click(screen.getByRole("button", { name: /Go to last page/ }));
      expect(screen.getByText("Page 5 of 5")).toBeInTheDocument();

      // Rerendering the mounted instance is what reproduces the trap. A fresh
      // render would start on page one and never reach the state where the
      // navigation has vanished and no control on screen offers a way back.
      rerender(
        <SortableTable {...defaultProps} data={fiftyRowData.slice(0, 3)} />,
      );

      expect(screen.queryByText("No cities found")).not.toBeInTheDocument();
      expect(screen.getAllByRole("row")).toHaveLength(4);
    });

    it("shows no pagination navigation at exactly one page of rows", () => {
      render(
        <SortableTable {...defaultProps} data={fiftyRowData.slice(0, 10)} />,
      );

      // Header row plus all ten data rows.
      expect(screen.getAllByRole("row")).toHaveLength(11);
      expect(
        screen.queryByRole("navigation", {
          name: "Table pagination navigation",
        }),
      ).not.toBeInTheDocument();
    });

    it("shows pagination navigation reporting two pages at one row past a page", () => {
      render(
        <SortableTable {...defaultProps} data={fiftyRowData.slice(0, 11)} />,
      );

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
        <SortableTable {...defaultProps} data={fiftyRowData} />,
      );

      await user.click(screen.getByRole("button", { name: /Go to last page/ }));

      rerender(<SortableTable {...defaultProps} data={[]} />);

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
        <SortableTable {...defaultProps} data={fiftyRowData} />,
      );

      await user.click(screen.getByRole("button", { name: /Go to last page/ }));
      expect(screen.getByText("Page 5 of 5")).toBeInTheDocument();

      rerender(
        <SortableTable {...defaultProps} data={fiftyRowData.slice(0, 25)} />,
      );
      expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();

      rerender(<SortableTable {...defaultProps} data={fiftyRowData} />);
      expect(screen.getByText("Page 5 of 5")).toBeInTheDocument();
    });

    it("returns to the first page when the search term changes", async () => {
      // A different term is a different set of rows, so the position chosen in
      // the old set carries no meaning into it.
      const user = userEvent.setup();
      const { rerender } = render(
        <SortableTable {...defaultProps} data={fiftyRowData} />,
      );

      await user.click(screen.getByRole("button", { name: "Go to last page" }));
      expect(screen.getByText("Page 5 of 5")).toBeInTheDocument();

      rerender(
        <SortableTable
          {...defaultProps}
          data={fiftyRowData}
          searchTerm="city"
        />,
      );
      expect(screen.getByText("Page 1 of 5")).toBeInTheDocument();
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
      render(<SortableTable {...defaultProps} data={largeMockData} />);

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
      render(<SortableTable {...defaultProps} data={largeMockData} />);

      // Sort by city (ascending)
      await user.click(screen.getByRole("button", { name: "City" }));

      // Get first city on page 1
      const rows = screen.getAllByRole("row");
      const firstCityPage1 = rows[1].textContent;

      // Go to page 2
      const nextButton = screen.getByRole("button", {
        name: /Go to next page/,
      });
      await user.click(nextButton);

      // Get first city on page 2
      const rowsPage2 = screen.getAllByRole("row");
      const firstCityPage2 = rowsPage2[1].textContent;

      // Page 2 first city should be alphabetically after page 1 first city
      expect(firstCityPage1!.localeCompare(firstCityPage2!)).toBeLessThan(0);
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA labels on sort buttons", () => {
      render(<SortableTable {...defaultProps} />);

      const cityHeader = screen.getByRole("columnheader", { name: /City/ });
      expect(cityHeader).toHaveAttribute("aria-sort", "none");
    });

    it("updates ARIA sort attributes when sorting", async () => {
      const user = userEvent.setup();
      render(<SortableTable {...defaultProps} />);

      const cityHeader = screen.getByRole("columnheader", { name: /City/ });
      const citySortButton = screen.getByRole("button", { name: "City" });
      await user.click(citySortButton);

      expect(cityHeader).toHaveAttribute("aria-sort", "ascending");

      await user.click(citySortButton);
      expect(cityHeader).toHaveAttribute("aria-sort", "descending");
    });

    it("advances one sort state per enter press on the sort button", async () => {
      const user = userEvent.setup();
      render(<SortableTable {...defaultProps} />);

      const cityHeader = screen.getByRole("columnheader", { name: /City/ });
      screen.getByRole("button", { name: "City" }).focus();

      // One press, one state. A manual key handler retained alongside the
      // native button would fire twice here and land on descending.
      await user.keyboard("{Enter}");
      expect(cityHeader).toHaveAttribute("aria-sort", "ascending");
    });

    it("advances one sort state per space press on the sort button", async () => {
      const user = userEvent.setup();
      render(<SortableTable {...defaultProps} />);

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
      render(<SortableTable {...defaultProps} />);

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
        <SortableTable {...defaultProps} data={pagedData} />,
      );

      // Matched on the exact attribute name rather than on a substring of the
      // serialized markup, so a differently cased or partly matching
      // attribute cannot satisfy the assertion.
      expect(container.querySelectorAll("[aria-current]")).toHaveLength(0);

      // And again in the single-page state, where the navigation carrying it
      // is absent altogether.
      rerender(<SortableTable {...defaultProps} />);
      expect(container.querySelectorAll("[aria-current]")).toHaveLength(0);
    });

    it("announces the sort change in the polite region", async () => {
      const user = userEvent.setup();
      const { container } = render(<SortableTable {...defaultProps} />);

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
      const { container } = render(<SortableTable {...defaultProps} />);

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
      const { container, rerender } = render(
        <SortableTable {...defaultProps} />,
      );

      rerender(<SortableTable {...defaultProps} data={[]} searchTerm="zzzz" />);

      const regions = container.querySelectorAll('[aria-live="polite"]');
      const announced = Array.from(regions).map((region) => region.textContent);
      expect(announced).toContain("No cities found for that search");
    });

    it("has table caption for screen readers", () => {
      render(<SortableTable {...defaultProps} />);

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

      render(<SortableTable {...defaultProps} data={largeMockData} />);

      // Named by the action alone. A name carrying the position would change
      // under focus on every press, which re-announces the whole control.
      expect(
        screen.getByRole("button", { name: "Go to first page" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Go to next page" }),
      ).toBeInTheDocument();
    });

    it("has live regions for dynamic updates", () => {
      render(<SortableTable {...defaultProps} />);

      const liveRegions = document.querySelectorAll('[aria-live="polite"]');
      expect(liveRegions.length).toBeGreaterThan(0);
    });
  });

  describe("Data Display", () => {
    it("formats population numbers with commas", () => {
      render(<SortableTable {...defaultProps} />);

      expect(screen.getByText("37,400,068")).toBeInTheDocument(); // Tokyo population
    });

    it("displays capital status correctly", () => {
      render(<SortableTable {...defaultProps} />);

      // Should show "primary" for capitals and "admin" for non-capitals
      expect(screen.getAllByText("primary")).toHaveLength(3); // Tokyo, Jakarta, New Delhi are primary capitals
      expect(screen.getAllByText("admin")).toHaveLength(2); // Osaka, Mumbai are admin cities
    });

    it("displays all country codes", () => {
      render(<SortableTable {...defaultProps} />);

      expect(screen.getAllByText("JPN")).toHaveLength(2); // Tokyo and Osaka both in Japan
      expect(screen.getByText("IDN")).toBeInTheDocument(); // Jakarta in Indonesia
      expect(screen.getAllByText("IND")).toHaveLength(2); // Mumbai and New Delhi both in India
    });
  });
});
