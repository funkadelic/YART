import { StrictMode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { City } from "../../api/getCities";
import { DatasetError } from "../../data/loadEnvelope";
import { en } from "../../i18n/catalogs/en";
import { es } from "../../i18n/catalogs/es";
import { CITY_FIXTURE_ENVELOPE } from "../../test/cityFixture";
import { stubDatasetFetch } from "../../test/fetchStub";
import { CITY_PAGE } from "../cities/cityPage";
import { FILM_PAGE } from "../films/filmPage";
import { DatasetPage } from "./DatasetPage";

/** The search seam's own type, so a stub is held to the page's contract. */
type CitySearch = (typeof CITY_PAGE)["search"];

/**
 * The debounce window the page applies to the search term.
 */
const DEBOUNCE_MS = 150;

/**
 * The page and its city config, both re-imported from a registry reset first.
 * The loader caches its dataset request at module scope, so a case counting
 * requests needs a fresh one. Both come from the new registry, or the page and
 * the loader would hold two dataset error classes.
 */
async function freshPage() {
  vi.resetModules();
  const { DatasetPage: FreshPage } = await import("./DatasetPage");
  const { CITY_PAGE: FRESH_CITY_PAGE } = await import("../cities/cityPage");
  return { FreshPage, FRESH_CITY_PAGE };
}

/** The city page over an injected search, so a case picks its own outcome. */
const withSearch = (search: CitySearch) => ({ ...CITY_PAGE, search });

/** The film seam's own type, for the same reason as the city one above. */
type FilmSearch = (typeof FILM_PAGE)["search"];

/** The film page over an injected search. */
const withFilmSearch = (search: FilmSearch) => ({ ...FILM_PAGE, search });

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

describe("DatasetPage requests", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the city list once the initial search resolves", async () => {
    render(<DatasetPage config={CITY_PAGE} />);

    expect(
      screen.getByRole("heading", { name: "City List" }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("table")).toBeInTheDocument();
    });
  });

  it("clears the busy flag once the first search settles", async () => {
    render(<DatasetPage config={CITY_PAGE} />);

    // Asserted inside the poll, not after one that returned on the table
    // appearing: the resolve and the settle are two separate dispatches, so
    // the table is on screen one render before the flag clears.
    await waitFor(() => {
      expect(screen.getByRole("table").closest("[aria-busy]")).toHaveAttribute(
        "aria-busy",
        "false",
      );
    });
  });

  it("renders the sentence the failure's code names, not the failure's own message", async () => {
    const failure = new DatasetError(
      "invalid",
      0,
      "the developer-facing text",
      { cause: new Error("Unexpected token < in JSON at position 0") },
    );
    render(<DatasetPage config={withSearch(() => Promise.reject(failure))} />);

    expect(
      await screen.findByText(
        `Error: ${en.cities.datasetError.invalid("en-US", 0)}`,
      ),
    ).toBeInTheDocument();
    // The developer-facing message and the preserved cause both stay off the
    // screen. The reader sees only the authored sentence.
    expect(document.body).not.toHaveTextContent("the developer-facing text");
    expect(document.body).not.toHaveTextContent("Unexpected token");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Downloading the city data..."),
    ).not.toBeInTheDocument();
  });

  it("renders the unexpected sentence when the search rejects with an error carrying no code", async () => {
    const failure = new Error("The city service is unreachable");
    render(<DatasetPage config={withSearch(() => Promise.reject(failure))} />);

    expect(
      await screen.findByText("Error: An unexpected error occurred."),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(failure.message);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders a synthesized message when the search rejects with a bare value", async () => {
    const bareRejection = "the service replied with a plain string";
    render(
      <DatasetPage
        config={withSearch(
          vi.fn<CitySearch>().mockRejectedValue(bareRejection),
        )}
      />,
    );

    expect(
      await screen.findByText("Error: An unexpected error occurred."),
    ).toBeInTheDocument();
    expect(screen.queryByText(bareRejection)).not.toBeInTheDocument();
    // The page synthesizes an error to carry the code. Its message is
    // developer-facing like every other one, and worded so it cannot be
    // mistaken for the sentence the catalog supplies.
    expect(document.body).not.toHaveTextContent("was not an error");
    expect(
      screen.queryByText("Downloading the city data..."),
    ).not.toBeInTheDocument();
  });

  // Null rather than a string, unlike the case above. A string reaches the
  // catalog lookup, which answers with the unexpected sentence for anything
  // that is not a dataset error, so it cannot tell a rejection that took the
  // synthesizing branch from one that skipped it.
  it("renders a synthesized message when the search rejects with nothing at all", async () => {
    render(
      <DatasetPage
        config={withSearch(vi.fn<CitySearch>().mockRejectedValue(null))}
      />,
    );

    expect(
      await screen.findByText("Error: An unexpected error occurred."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  // The translation happens during render because the catch sits inside the
  // fetch effect. Reading the catalog there would put the locale in that
  // effect's dependency array, and a reader changing language while an error
  // was on screen would re-download several megabytes of city data to find out
  // the same thing in another language.
  it("re-renders a displayed failure in the chosen language without issuing a request", async () => {
    const user = userEvent.setup({ delay: null });
    const search = vi.fn<CitySearch>(() =>
      Promise.reject(
        new DatasetError("transport", 0, "the developer-facing text"),
      ),
    );

    render(<DatasetPage config={withSearch(search)} />);

    expect(
      await screen.findByText(
        `Error: ${en.cities.datasetError.transport("en-US", 0)}`,
      ),
    ).toBeInTheDocument();

    const callsBefore = search.mock.calls.length;

    await user.selectOptions(
      screen.getByRole("combobox", { name: /language/i }),
      "es",
    );

    expect(
      await screen.findByText(
        `Error: ${es.cities.datasetError.transport("es-ES", 0)}`,
      ),
    ).toBeInTheDocument();
    expect(search.mock.calls).toHaveLength(callsBefore);
  });

  it("issues one search after the debounce window rather than one per keystroke", async () => {
    // The seam resolves immediately, so the clock covers only the debounce
    // window.
    const search = vi.fn<CitySearch>(() => Promise.resolve(SAMPLE_CITIES));

    vi.useFakeTimers();
    // Bind the input helper to the controlled clock. Without this it waits on a
    // clock the test has frozen and the run stalls instead of failing.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<DatasetPage config={withSearch(search)} />);

    // The page searches once on mount with an empty term, before anything
    // is typed, so every count below is a delta from that settled baseline.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    });
    expect(search).toHaveBeenCalledTimes(1);
    const callsAfterMount = search.mock.calls.length;

    await user.type(screen.getByRole("textbox", { name: "Search" }), "tok");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1);
    });
    expect(search.mock.calls.length - callsAfterMount).toBe(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(search.mock.calls.length - callsAfterMount).toBe(1);
    expect(search).toHaveBeenLastCalledWith({ searchTerm: "tok" });
  });

  it("issues one dataset request under a double mount", async () => {
    const fetchSpy = stubDatasetFetch(CITY_FIXTURE_ENVELOPE);
    const { FreshPage, FRESH_CITY_PAGE } = await freshPage();

    render(
      <StrictMode>
        <FreshPage config={FRESH_CITY_PAGE} />
      </StrictMode>,
    );

    expect(await screen.findByText("Tokyo")).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("issues one dataset request across a typed search under a double mount", async () => {
    vi.useFakeTimers();
    const fetchSpy = stubDatasetFetch(CITY_FIXTURE_ENVELOPE);
    const { FreshPage, FRESH_CITY_PAGE } = await freshPage();
    // Bind the input helper to the controlled clock. Without this it waits on a
    // clock the test has frozen and the run stalls instead of failing.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <StrictMode>
        <FreshPage config={FRESH_CITY_PAGE} />
      </StrictMode>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    });

    await user.type(screen.getByRole("textbox", { name: "Search" }), "par");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    });

    expect(screen.getByText("Paris")).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("keeps the newer result when an earlier search settles last", async () => {
    // Every search awaits one cached load and filters synchronously, so today
    // results settle in issue order. The guard holds if one ever settles late.
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

    const search = vi
      .fn<CitySearch>()
      .mockImplementationOnce(() => earlier)
      .mockImplementationOnce(() => Promise.resolve(laterRows));

    // This case runs on the real clock, so the inter-keystroke delay is dropped
    // and not bound to a fake one. A file that fakes the clock anywhere has to
    // declare one or the other at every input session, which the toolchain
    // guard enforces.
    const user = userEvent.setup({ delay: null });

    render(<DatasetPage config={withSearch(search)} />);

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

    const search = vi
      .fn<CitySearch>()
      .mockImplementationOnce(() => earlier)
      .mockImplementationOnce(() => Promise.resolve(laterRows));

    // This case runs on the real clock, so the inter-keystroke delay is dropped
    // and not bound to a fake one. A file that fakes the clock anywhere has to
    // declare one or the other at every input session, which the toolchain
    // guard enforces.
    const user = userEvent.setup({ delay: null });

    render(<DatasetPage config={withSearch(search)} />);

    await user.type(screen.getByRole("textbox", { name: "Search" }), "p");

    expect(await screen.findByText("Paris")).toBeInTheDocument();

    await act(async () => {
      failEarlier(new Error("The city service is unreachable"));
      // The page's own catch arm settles this rejection. Awaiting it here
      // only orders the assertions after it, so the await is swallowed and
      // cannot fail the case it is sequencing.
      await earlier.catch(() => {});
    });

    expect(screen.queryByText(/^Error: /)).not.toBeInTheDocument();
    expect(screen.getByText("Paris")).toBeInTheDocument();
  });

  it("stops claiming a download once the dataset has arrived, even when the search that follows is empty", async () => {
    stubDatasetFetch(CITY_FIXTURE_ENVELOPE);
    const { FreshPage, FRESH_CITY_PAGE } = await freshPage();
    const search = vi.fn<CitySearch>(FRESH_CITY_PAGE.search);
    vi.useFakeTimers();
    // Bind the input helper to the controlled clock. Without this it waits on a
    // clock the test has frozen and the run stalls instead of failing.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<FreshPage config={{ ...FRESH_CITY_PAGE, search }} />);

    // The cold pole. Nothing has arrived yet, so the claim is true here.
    expect(
      screen.getByText("Downloading the city data..."),
    ).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    });
    expect(screen.getByText("Tokyo")).toBeInTheDocument();

    const searchInput = screen.getByRole("textbox", { name: "Search" });
    await user.type(searchInput, "zzzz");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    });
    expect(screen.getByText("No cities found")).toBeInTheDocument();

    // One more keystroke over an empty result set. A request is in flight with
    // no rows behind it, so a row count reads it as a cold start. The search is
    // held open so it is still in flight when the claim is read.
    search.mockImplementationOnce(() => new Promise<City[]>(() => {}));
    await user.type(searchInput, "z");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    });

    expect(search).toHaveBeenLastCalledWith({ searchTerm: "zzzzz" });
    expect(screen.queryByText("Downloading the city data...")).toBeNull();
    expect(screen.getByText("No cities found")).toBeInTheDocument();
  });

  it("recovers from a failed dataset load when the retry control is used", async () => {
    const fetchSpy = stubDatasetFetch(CITY_FIXTURE_ENVELOPE);
    fetchSpy.mockResolvedValueOnce(new Response("not found", { status: 404 }));
    const { FreshPage, FRESH_CITY_PAGE } = await freshPage();
    const user = userEvent.setup({ delay: null });

    render(<FreshPage config={FRESH_CITY_PAGE} />);

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

// Only what the city cases above cannot say: that the films domain reaches the
// error sentence, and the after-a-failure half of the download claim.
describe("DatasetPage requests on the films page", () => {
  it("renders the film sentence the failure's code names, not the failure's own message", async () => {
    const failure = new DatasetError(
      "invalid",
      0,
      "the developer-facing text",
      { cause: new Error("Unexpected token < in JSON at position 0") },
    );
    render(
      <DatasetPage config={withFilmSearch(() => Promise.reject(failure))} />,
    );

    expect(
      await screen.findByText(
        `Error: ${en.films.datasetError.invalid("en-US", 0)}`,
      ),
    ).toBeInTheDocument();
    // The other page's wording for the same code stays off the screen too.
    expect(document.body).not.toHaveTextContent("the developer-facing text");
    expect(document.body).not.toHaveTextContent("city data");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  // The settled action runs from a finally, so a failure cannot leave a
  // permanent spinner behind it.
  it("stops claiming a download after a failure as well as after a result", async () => {
    const failure = new DatasetError(
      "transport",
      0,
      "the developer-facing text",
    );
    render(
      <DatasetPage config={withFilmSearch(() => Promise.reject(failure))} />,
    );

    expect(
      screen.getByText("Downloading the film data..."),
    ).toBeInTheDocument();

    expect(
      await screen.findByText(
        `Error: ${en.films.datasetError.transport("en-US", 0)}`,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Downloading the film data...")).toBeNull();
  });
});
