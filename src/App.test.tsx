import { StrictMode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { DatasetError, getCities } from "./api/getCities";
import { en } from "./i18n/catalogs/en";
import { es } from "./i18n/catalogs/es";
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
 * Resetting the registry is not enough on its own, and the mock is re-declared
 * here rather than left to the hoisted one above for a second reason beyond
 * rebinding the spy. Resetting the registry does not re-evaluate a mock factory,
 * so the container would keep importing the seam belonging to the registry that
 * was thrown away, while the loader it now calls belongs to the new one. The two
 * would then hold two different dataset error classes, and the failure sentence
 * would be chosen by an identity check that can never succeed. Re-declaring the
 * factory puts the container and the loader back in one registry.
 *
 * The spy object itself is deliberately the same one, so a call count spans the
 * reset.
 */
async function freshApp() {
  vi.resetModules();
  vi.doMock("./api/getCities", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./api/getCities")>();
    getCitiesSeam.mockImplementation(actual.getCities);
    return { ...actual, getCities: getCitiesSeam };
  });
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

  it("renders the sentence the failure's code names, not the failure's own message", async () => {
    const failure = new DatasetError(
      "notJson",
      0,
      "the developer-facing text",
      { cause: new Error("Unexpected token < in JSON at position 0") },
    );
    getCitiesSeam.mockRejectedValueOnce(failure);

    render(<App />);

    expect(
      await screen.findByText(
        `Error: ${en.cities.datasetError.notJson("en-US", 0)}`,
      ),
    ).toBeInTheDocument();
    // The developer-facing message and the preserved cause both stay off the
    // screen. The reader sees the authored sentence and nothing else.
    expect(document.body).not.toHaveTextContent("the developer-facing text");
    expect(document.body).not.toHaveTextContent("Unexpected token");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Downloading the city data..."),
    ).not.toBeInTheDocument();
  });

  it("renders the unexpected sentence when the search rejects with an error carrying no code", async () => {
    const failure = new Error("The city service is unreachable");
    getCitiesSeam.mockRejectedValueOnce(failure);

    render(<App />);

    expect(
      await screen.findByText("Error: An unexpected error occurred."),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(failure.message);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders a synthesized message when the search rejects with a bare value", async () => {
    const bareRejection = "the service replied with a plain string";
    getCitiesSeam.mockRejectedValueOnce(bareRejection);

    render(<App />);

    expect(
      await screen.findByText("Error: An unexpected error occurred."),
    ).toBeInTheDocument();
    expect(screen.queryByText(bareRejection)).not.toBeInTheDocument();
    // The container synthesizes an error to carry the code. Its message is
    // developer-facing like every other one, and worded so it cannot be
    // mistaken for the sentence the catalog supplies.
    expect(document.body).not.toHaveTextContent("was not an error");
    expect(
      screen.queryByText("Downloading the city data..."),
    ).not.toBeInTheDocument();
  });

  // The reason the translation happens during render rather than at the catch
  // inside the fetch effect. Reading the catalog there would put the locale in
  // that effect's dependency array, and a reader changing language while an
  // error was on screen would re-download several megabytes of city data to
  // find out the same thing in another language.
  it("re-renders a displayed failure in the chosen language without issuing a request", async () => {
    const user = userEvent.setup({ delay: null });
    getCitiesSeam.mockRejectedValue(
      new DatasetError("transport", 0, "the developer-facing text"),
    );

    render(<App />);

    expect(
      await screen.findByText(
        `Error: ${en.cities.datasetError.transport("en-US", 0)}`,
      ),
    ).toBeInTheDocument();

    const callsBefore = getCitiesSeam.mock.calls.length;

    await user.selectOptions(
      screen.getByRole("combobox", { name: /language/i }),
      "es",
    );

    expect(
      await screen.findByText(
        `Error: ${es.cities.datasetError.transport("es-ES", 0)}`,
      ),
    ).toBeInTheDocument();
    expect(getCitiesSeam.mock.calls).toHaveLength(callsBefore);
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

  it("keeps the newer result when an earlier search rejects last", async () => {
    // The mirror of the case above on the failure path. Without the guard in the
    // catch arm, a rejection belonging to a search the user has already moved
    // past paints an error over rows that are on screen and correct.
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

    let failEarlier: (reason: Error) => void = () => {};
    const earlier = new Promise<City[]>((_resolve, reject) => {
      failEarlier = reject;
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
      failEarlier(new Error("The city service is unreachable"));
      // The container's own catch arm settles this rejection. Awaiting it here
      // only orders the assertions after it, so the await is swallowed rather
      // than allowed to fail the case it is sequencing.
      await earlier.catch(() => {});
    });

    expect(screen.queryByText(/^Error: /)).not.toBeInTheDocument();
    expect(screen.getByText("Paris")).toBeInTheDocument();
  });

  it("stops claiming a download once the dataset has arrived, even when the search that follows is empty", async () => {
    stubDatasetFetch(CITY_FIXTURE_ENVELOPE);
    const FreshApp = await freshApp();
    vi.useFakeTimers();
    // Bind the input helper to the controlled clock. Without this it waits on a
    // clock the test has frozen and the run stalls instead of failing.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<FreshApp />);

    // The cold pole: nothing has arrived yet, so the claim is true here.
    expect(
      screen.getByText("Downloading the city data..."),
    ).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + SEAM_LATENCY_MS);
    });
    expect(screen.getByText("Tokyo")).toBeInTheDocument();

    const searchInput = screen.getByRole("textbox", { name: "Search" });
    await user.type(searchInput, "zzzz");

    // The debounce window and the seam's latency are advanced separately. The
    // seam schedules its delay only once the awaited load has settled, so a
    // single combined advance can pass the deadline before the timer exists.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEAM_LATENCY_MS);
    });
    expect(screen.getByText("No cities found")).toBeInTheDocument();

    // One more keystroke over an empty result set. A request is in flight with
    // no rows behind it, which is the state a row count reads as a cold start.
    await user.type(searchInput, "z");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    });

    expect(screen.queryByText("Downloading the city data...")).toBeNull();
    expect(screen.getByText("No cities found")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEAM_LATENCY_MS);
    });
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
