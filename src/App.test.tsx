import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { getCities } from "./api/getCities";

import type { City } from "./api/getCities";

// The search seam is spied on rather than stubbed out: the factory delegates to
// the real module, so the integration case below keeps exercising real
// behaviour, and a case that needs a specific outcome overrides it for itself.
// A rejection carrying something other than an Error is only reachable this
// way, because the real module never produces one.
vi.mock("./api/getCities", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api/getCities")>();
  return { ...actual, getCities: vi.fn(actual.getCities) };
});

const getCitiesSeam = vi.mocked(getCities);

/**
 * The debounce window the container applies to the search term.
 */
const DEBOUNCE_MS = 150;

const SAMPLE_CITIES: City[] = [
  {
    id: 1,
    name: "Tokyo",
    nameAscii: "Tokyo",
    country: "Japan",
    countryIso3: "JPN",
    capital: "primary",
    population: 37732000,
  },
];

describe("App", () => {
  beforeEach(async () => {
    const actual =
      await vi.importActual<typeof import("./api/getCities")>(
        "./api/getCities",
      );
    getCitiesSeam.mockReset();
    getCitiesSeam.mockImplementation(actual.getCities);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the city list once the initial search resolves", async () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "City List" }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("table")).toBeInTheDocument();
    });
  });

  it("renders the failure message when the search rejects with an Error", async () => {
    const failure = new Error("The city service is unreachable");
    getCitiesSeam.mockRejectedValueOnce(failure);

    render(<App />);

    expect(
      await screen.findByText(`Error: ${failure.message}`),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  it("renders a synthesized message when the search rejects with a bare value", async () => {
    const bareRejection = "the service replied with a plain string";
    getCitiesSeam.mockRejectedValueOnce(bareRejection);

    render(<App />);

    expect(
      await screen.findByText("Error: An unexpected error occurred"),
    ).toBeInTheDocument();
    expect(screen.queryByText(bareRejection)).not.toBeInTheDocument();
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  it("issues one search after the debounce window rather than one per keystroke", async () => {
    // Resolve immediately so the only wait the clock has to cover is the
    // debounce window, not the seam's simulated latency.
    getCitiesSeam.mockResolvedValue(SAMPLE_CITIES);

    vi.useFakeTimers();
    // Bind the input helper to the controlled clock. Without this it waits on a
    // clock the test has frozen and the run stalls instead of failing.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<App />);

    // The container searches once on mount with an empty term, before anything
    // is typed, so every count below is a delta from that settled baseline.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    });
    expect(getCitiesSeam).toHaveBeenCalledTimes(1);
    const callsAfterMount = getCitiesSeam.mock.calls.length;

    await user.type(screen.getByRole("textbox", { name: "Search" }), "tok");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1);
    });
    expect(getCitiesSeam.mock.calls.length - callsAfterMount).toBe(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(getCitiesSeam.mock.calls.length - callsAfterMount).toBe(1);
    expect(getCitiesSeam).toHaveBeenLastCalledWith({ searchTerm: "tok" });
  });
});
