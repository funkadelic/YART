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
  searchTerm: "",
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
});
