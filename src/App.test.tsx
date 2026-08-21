import { StrictMode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { getCities } from "./api/getCities";
import { CITY_FIXTURE_ENVELOPE } from "./test/cityFixture";
import { stubDatasetFetch } from "./test/fetchStub";

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

/**
 * The latency the search seam simulates on every call, download or not.
 */
const SEAM_LATENCY_MS = 200;

/**
 * The container, re-imported from a module registry that has been reset first.
 * The loader caches its dataset request at module scope, so without the reset a
 * case that counts requests inherits an earlier case's populated cache and
 * counts none at all.
 *
 * Resetting the registry is not enough on its own. The spy above survives the
 * reset, and it still delegates to the module instance it was bound to, so the
 * warm cache would come back through it. Rebinding it to the freshly loaded
 * module is what actually makes the cache cold.
 */
async function freshApp() {
  vi.resetModules();
  const actual =
    await vi.importActual<typeof import("./api/getCities")>("./api/getCities");
  getCitiesSeam.mockImplementation(actual.getCities);
  return (await import("./App")).default;
}

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
    expect(
      screen.queryByText("Downloading the city data..."),
    ).not.toBeInTheDocument();
  });

  it("renders a synthesized message when the search rejects with a bare value", async () => {
    const bareRejection = "the service replied with a plain string";
    getCitiesSeam.mockRejectedValueOnce(bareRejection);

    render(<App />);

    expect(
      await screen.findByText("Error: An unexpected error occurred"),
    ).toBeInTheDocument();
    expect(screen.queryByText(bareRejection)).not.toBeInTheDocument();
    expect(
      screen.queryByText("Downloading the city data..."),
    ).not.toBeInTheDocument();
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

  it("issues one dataset request under a double mount", async () => {
    const fetchSpy = stubDatasetFetch(CITY_FIXTURE_ENVELOPE);
    const FreshApp = await freshApp();

    render(
      <StrictMode>
        <FreshApp />
      </StrictMode>,
    );

    expect(await screen.findByText("Tokyo")).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("issues one dataset request across a typed search under a double mount", async () => {
    vi.useFakeTimers();
    const fetchSpy = stubDatasetFetch(CITY_FIXTURE_ENVELOPE);
    const FreshApp = await freshApp();
    // Bind the input helper to the controlled clock. Without this it waits on a
    // clock the test has frozen and the run stalls instead of failing.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <StrictMode>
        <FreshApp />
      </StrictMode>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + SEAM_LATENCY_MS);
    });

    await user.type(screen.getByRole("textbox", { name: "Search" }), "par");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + SEAM_LATENCY_MS);
    });

    expect(screen.getByText("Paris")).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("keeps the newer result when an earlier search settles last", async () => {
    // Today both searches read the same in-memory array, so a race between them
    // would be invisible. The guard is established now because a later phase
    // seeds a non-empty term on first load, at which point the two searches
    // carry different rows and the interleaving becomes real.
    const earlierRows: City[] = [
      {
        id: 10,
        name: "Osaka",
        nameAscii: "Osaka",
        country: "Japan",
        countryIso3: "JPN",
        capital: "admin",
        population: 15490000,
      },
    ];
    const laterRows: City[] = [
      {
        id: 11,
        name: "Paris",
        nameAscii: "Paris",
        country: "France",
        countryIso3: "FRA",
        capital: "primary",
        population: 11060000,
      },
    ];

    let settleEarlier: (rows: City[]) => void = () => {};
    const earlier = new Promise<City[]>((resolve) => {
      settleEarlier = resolve;
    });

    getCitiesSeam.mockImplementationOnce(() => earlier);
    getCitiesSeam.mockImplementationOnce(() => Promise.resolve(laterRows));

    // This case runs on the real clock, so the inter-keystroke delay is dropped
    // rather than bound. A file that fakes the clock anywhere has to declare one
    // or the other at every input session, which the toolchain guard enforces.
    const user = userEvent.setup({ delay: null });

    render(<App />);

    await user.type(screen.getByRole("textbox", { name: "Search" }), "p");

    expect(await screen.findByText("Paris")).toBeInTheDocument();

    await act(async () => {
      settleEarlier(earlierRows);
      await earlier;
    });

    expect(screen.getByText("Paris")).toBeInTheDocument();
    expect(screen.queryByText("Osaka")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Error: /)).not.toBeInTheDocument();
  });

  it("recovers from a failed dataset load when the retry control is used", async () => {
    const fetchSpy = stubDatasetFetch(CITY_FIXTURE_ENVELOPE);
    fetchSpy.mockResolvedValueOnce(new Response("not found", { status: 404 }));
    const FreshApp = await freshApp();
    const user = userEvent.setup({ delay: null });

    render(<FreshApp />);

    expect(
      await screen.findByText(
        "Error: The city data could not be downloaded (status 404).",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Tokyo")).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Error: The city data could not be downloaded (status 404).",
      ),
    ).not.toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
