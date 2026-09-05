import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import FilmsApp from "./FilmsApp";
import { DatasetError, getFilms } from "./api/getFilms";
import { en } from "./i18n/catalogs/en";
import { FILM_FIXTURE_ENVELOPE } from "./test/filmFixture";
import { required } from "./test/required";
import { stubFilmDatasetFetch } from "./test/fetchStub";

import type { Film } from "./api/getFilms";

// The search seam is spied on, with the factory delegating to the real module,
// so the integration cases below keep exercising real behavior and a case that
// needs a specific outcome overrides it for itself. A rejection carrying
// something other than an Error is only reachable this way, because the real
// module never produces one.
vi.mock("./api/getFilms", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api/getFilms")>();
  return { ...actual, getFilms: vi.fn(actual.getFilms) };
});

const getFilmsSeam = vi.mocked(getFilms);

/** The debounce window the container applies to the search term. */
const DEBOUNCE_MS = 150;

/** The latency the search seam simulates on every call, download or not. */
const SEAM_LATENCY_MS = 200;

/**
 * The container, re-imported from a module registry that has been reset first.
 * The loader caches its dataset request at module scope, so without the reset a
 * case that counts requests inherits an earlier case's populated cache.
 *
 * The mock is re-declared here too, because resetting the registry does not
 * re-evaluate a mock factory. The container would keep importing the seam
 * belonging to the registry that was thrown away, while the loader it now calls
 * belongs to the new one, and the two would hold two different dataset error
 * classes. The spy object itself is
 * deliberately the same one, so a call count spans the reset.
 */
async function freshFilmsApp() {
  vi.resetModules();
  vi.doMock("./api/getFilms", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./api/getFilms")>();
    getFilmsSeam.mockImplementation(actual.getFilms);
    return { ...actual, getFilms: getFilmsSeam };
  });
  return (await import("./FilmsApp")).default;
}

const SAMPLE_FILMS: Film[] = [
  {
    id: "Q2345",
    title: "12 Angry Men",
    year: 1957,
    runtime: 95,
    directors: ["Sidney Lumet"],
    genres: ["drama film"],
    countries: ["United States"],
  },
];

describe("FilmsApp", () => {
  beforeEach(async () => {
    // Installed over the city stub the setup file puts in place, so a case that
    // reaches the real loader is answered with film data.
    stubFilmDatasetFetch();

    const actual =
      await vi.importActual<typeof import("./api/getFilms")>("./api/getFilms");
    getFilmsSeam.mockReset();
    getFilmsSeam.mockImplementation(actual.getFilms);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the film list once the initial search resolves", async () => {
    vi.useFakeTimers();
    const FreshFilmsApp = await freshFilmsApp();

    render(<FreshFilmsApp />);

    expect(
      screen.getByRole("heading", { name: "Film List" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Downloading the film data..."),
    ).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEAM_LATENCY_MS);
    });

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("12 Angry Men")).toBeInTheDocument();
    expect(screen.queryByText("Downloading the film data...")).toBeNull();
  });

  it("renders the film sentence the failure's code names, not the failure's own message", async () => {
    vi.useFakeTimers();
    getFilmsSeam.mockRejectedValueOnce(
      new DatasetError("notJson", 0, "the developer-facing text", {
        cause: new Error("Unexpected token < in JSON at position 0"),
      }),
    );

    render(<FilmsApp />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEAM_LATENCY_MS);
    });

    expect(
      screen.getByText(`Error: ${en.films.datasetError.notJson("en-US", 0)}`),
    ).toBeInTheDocument();
    // The developer-facing message and the preserved cause both stay off the
    // screen, and so does the other page's wording for the same code.
    expect(document.body).not.toHaveTextContent("the developer-facing text");
    expect(document.body).not.toHaveTextContent("city data");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders the unexpected sentence when the search rejects with a bare value", async () => {
    vi.useFakeTimers();
    const bareRejection = "the service replied with a plain string";
    getFilmsSeam.mockRejectedValueOnce(bareRejection);

    render(<FilmsApp />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEAM_LATENCY_MS);
    });

    expect(
      screen.getByText("Error: An unexpected error occurred."),
    ).toBeInTheDocument();
    expect(screen.queryByText(bareRejection)).not.toBeInTheDocument();
    // The container synthesizes an error to carry the code. Its message is
    // developer-facing like every other one.
    expect(document.body).not.toHaveTextContent("was not an error");
  });

  it("issues one search per committed term rather than one per keystroke", async () => {
    getFilmsSeam.mockResolvedValue(SAMPLE_FILMS);

    vi.useFakeTimers();
    // Bound to the controlled clock. Without this it waits on a clock the test
    // has frozen and the run stalls instead of failing.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<FilmsApp />);

    // The container searches once on mount with an empty term, so every count
    // below is a delta from that settled baseline.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    });
    expect(getFilmsSeam).toHaveBeenCalledTimes(1);

    await user.type(screen.getByRole("textbox", { name: "Search" }), "ang");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1);
    });
    expect(getFilmsSeam).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(getFilmsSeam).toHaveBeenCalledTimes(2);
    expect(getFilmsSeam).toHaveBeenLastCalledWith({ searchTerm: "ang" });
  });

  // Without the guard in the effect, a result belonging to a search the reader
  // has already moved past replaces rows that are on screen and correct.
  it("drops a result that arrives after its search was moved past", async () => {
    const sample = required(SAMPLE_FILMS[0], "the first sample row");
    const earlierRows: Film[] = [{ ...sample, title: "Cleopatra" }];
    const laterRows: Film[] = [{ ...sample, title: "Inception" }];

    let settleEarlier: (rows: Film[]) => void = () => {};
    const earlier = new Promise<Film[]>((resolve) => {
      settleEarlier = resolve;
    });

    getFilmsSeam.mockImplementationOnce(() => earlier);
    getFilmsSeam.mockImplementationOnce(() => Promise.resolve(laterRows));

    // This case runs on the real clock, so the inter-keystroke delay is dropped
    // and not bound to a fake one.
    const user = userEvent.setup({ delay: null });

    render(<FilmsApp />);

    await user.type(screen.getByRole("textbox", { name: "Search" }), "i");

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS * 2));
    });
    expect(screen.getByText("Inception")).toBeInTheDocument();

    await act(async () => {
      settleEarlier(earlierRows);
      await earlier;
    });

    expect(screen.getByText("Inception")).toBeInTheDocument();
    expect(screen.queryByText("Cleopatra")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Error: /)).not.toBeInTheDocument();
  });

  // The mirror of the case above on the failure path. Without the guard in the
  // catch arm, a rejection belonging to a search the reader has already moved
  // past paints an error over rows that are on screen and correct.
  it("drops a rejection that arrives after its search was moved past", async () => {
    const sample = required(SAMPLE_FILMS[0], "the first sample row");
    const laterRows: Film[] = [{ ...sample, title: "Inception" }];

    let failEarlier: (reason: Error) => void = () => {};
    const earlier = new Promise<Film[]>((_resolve, reject) => {
      failEarlier = reject;
    });

    getFilmsSeam.mockImplementationOnce(() => earlier);
    getFilmsSeam.mockImplementationOnce(() => Promise.resolve(laterRows));

    const user = userEvent.setup({ delay: null });

    render(<FilmsApp />);

    await user.type(screen.getByRole("textbox", { name: "Search" }), "i");

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS * 2));
    });
    expect(screen.getByText("Inception")).toBeInTheDocument();

    await act(async () => {
      failEarlier(new Error("The film service is unreachable"));
      // The container's own catch arm settles this rejection. Awaiting it here
      // only orders the assertions after it, so the await is swallowed and
      // cannot fail the case it is sequencing.
      await earlier.catch(() => {});
    });

    expect(screen.queryByText(/^Error: /)).not.toBeInTheDocument();
    expect(screen.getByText("Inception")).toBeInTheDocument();
  });

  it("recovers from a failed dataset load when the retry control is used", async () => {
    const fetchSpy = stubFilmDatasetFetch(FILM_FIXTURE_ENVELOPE);
    fetchSpy.mockResolvedValueOnce(new Response("not found", { status: 404 }));
    const FreshFilmsApp = await freshFilmsApp();
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<FreshFilmsApp />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEAM_LATENCY_MS);
    });
    expect(
      screen.getByText(
        "Error: The film data could not be downloaded (status 404).",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEAM_LATENCY_MS);
    });

    expect(screen.getByText("12 Angry Men")).toBeInTheDocument();
    expect(screen.queryByText(/^Error: /)).not.toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  // The settled action runs from a finally, so a failure cannot leave a
  // permanent spinner behind it.
  it("stops claiming a download after a failure as well as after a result", async () => {
    vi.useFakeTimers();
    getFilmsSeam.mockRejectedValueOnce(
      new DatasetError("transport", 0, "the developer-facing text"),
    );

    render(<FilmsApp />);

    expect(
      screen.getByText("Downloading the film data..."),
    ).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEAM_LATENCY_MS);
    });

    expect(screen.queryByText("Downloading the film data...")).toBeNull();
    expect(
      screen.getByText(`Error: ${en.films.datasetError.transport("en-US", 0)}`),
    ).toBeInTheDocument();
  });
});
