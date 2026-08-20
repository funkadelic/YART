import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  onSearchChange: jest.fn(),
  loading: false,
  error: null,
};

describe("SortableTable", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      const mockOnSearchChange = jest.fn();

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
    it("shows loading state on the first load, when there is no data yet", () => {
      render(<SortableTable {...defaultProps} data={[]} loading={true} />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("keeps the table mounted while refetching with results on screen", () => {
      const { rerender } = render(<SortableTable {...defaultProps} />);
      const tableBeforeRefetch = screen.getByRole("table");

      rerender(<SortableTable {...defaultProps} loading={true} />);

      // Same DOM node, so the table is dimmed in place instead of unmounting
      // and flashing on every keystroke.
      expect(screen.getByRole("table")).toBe(tableBeforeRefetch);
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
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
  });

  describe("Sorting Functionality", () => {
    it("sorts by city name in ascending order", async () => {
      const user = userEvent.setup();
      render(<SortableTable {...defaultProps} />);

      const cityHeader = screen.getByRole("columnheader", { name: /City/ });
      await user.click(cityHeader);

      const rows = screen.getAllByRole("row");
      const firstDataRow = rows[1]; // Skip header row
      expect(firstDataRow).toHaveTextContent("Jakarta"); // First alphabetically
    });

    it("sorts by population in ascending order", async () => {
      const user = userEvent.setup();
      render(<SortableTable {...defaultProps} />);

      const populationHeader = screen.getByRole("columnheader", {
        name: /Population/,
      });
      await user.click(populationHeader);

      const rows = screen.getAllByRole("row");
      const firstDataRow = rows[1];
      expect(firstDataRow).toHaveTextContent("Osaka"); // Smallest population
    });

    it("implements three-state sorting (asc -> desc -> none)", async () => {
      const user = userEvent.setup();
      render(<SortableTable {...defaultProps} />);

      const cityHeader = screen.getByRole("columnheader", { name: /City/ });

      // First click: ascending - should show up arrow
      await user.click(cityHeader);
      expect(cityHeader).toHaveAttribute("aria-sort", "ascending");

      // Second click: descending - should show down arrow
      await user.click(cityHeader);
      expect(cityHeader).toHaveAttribute("aria-sort", "descending");

      // Third click: no sort
      await user.click(cityHeader);
      expect(cityHeader).toHaveAttribute("aria-sort", "none");
    });

    it("shows sort icons only for active column", async () => {
      const user = userEvent.setup();
      render(<SortableTable {...defaultProps} />);

      const cityHeader = screen.getByRole("columnheader", { name: /City/ });
      await user.click(cityHeader);

      expect(cityHeader).toHaveAttribute("aria-sort", "ascending");

      // Other columns should not be sorted - use exact match
      const countryHeader = screen.getByRole("columnheader", {
        name: "Sort by Country ascending",
      });
      expect(countryHeader).toHaveAttribute("aria-sort", "none");
    });

    it("switches sort when clicking different column", async () => {
      const user = userEvent.setup();
      render(<SortableTable {...defaultProps} />);

      // Sort by city first
      const cityHeader = screen.getByRole("columnheader", { name: /City/ });
      await user.click(cityHeader);
      expect(cityHeader).toHaveAttribute("aria-sort", "ascending");

      // Sort by country
      const countryHeader = screen.getByRole("columnheader", {
        name: "Sort by Country ascending",
      });
      await user.click(countryHeader);

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
      const cityHeader = screen.getByRole("columnheader", { name: /City/ });
      await user.click(cityHeader);

      // Should reset to page 1
      expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    });

    it("maintains sort order across pages", async () => {
      const user = userEvent.setup();
      render(<SortableTable {...defaultProps} data={largeMockData} />);

      // Sort by city (ascending)
      const cityHeader = screen.getByRole("columnheader", { name: /City/ });
      await user.click(cityHeader);

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
      await user.click(cityHeader);

      expect(cityHeader).toHaveAttribute("aria-sort", "ascending");

      await user.click(cityHeader);
      expect(cityHeader).toHaveAttribute("aria-sort", "descending");
    });

    it("supports keyboard navigation on headers", async () => {
      const user = userEvent.setup();
      render(<SortableTable {...defaultProps} />);

      const cityHeader = screen.getByRole("columnheader", { name: /City/ });
      cityHeader.focus();

      await user.keyboard("{Enter}");
      expect(cityHeader).toHaveAttribute("aria-sort", "ascending");
    });

    it("sorts when the space key is pressed on a header", async () => {
      const user = userEvent.setup();
      render(<SortableTable {...defaultProps} />);

      const cityHeader = screen.getByRole("columnheader", { name: /City/ });
      cityHeader.focus();

      await user.keyboard(" ");
      expect(cityHeader).toHaveAttribute("aria-sort", "ascending");

      await user.keyboard(" ");
      expect(cityHeader).toHaveAttribute("aria-sort", "descending");
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

      expect(
        screen.getByRole("button", { name: /Go to first page of 3 pages/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: /Go to next page, currently on page 1 of 3/,
        }),
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
