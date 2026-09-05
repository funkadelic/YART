import { describe, it, expect, vi } from "vitest";

import { DatasetError, createEnvelopeLoader } from "./loadEnvelope";

/**
 * Guards over the half of the parse boundary every dataset shares: everything
 * that fails before a row is looked at. Without a case per rejection path a
 * malformed asset does not fail loudly, it fills the table with undefined cells
 * and surfaces much later as a cryptic sort crash.
 *
 * Every case starts from a known-good envelope and changes exactly one thing,
 * and asserts the message it expects, because a case that accepts any
 * rejection passes when the load failed for an unrelated reason. The messages
 * are written here as literals and not imported from the loader, so a rename
 * cannot move both sides at once.
 *
 * The row types are local and deliberately not City. This module knows no
 * domain, and a test reaching for the cities fixture would pass for a loader
 * that had quietly become city-specific.
 */

const WIDGET_URL = "/widgets.json";
const WIDGET_COLUMNS = ["id", "label"] as const;

interface Widget {
  id: number;
  label: string;
}

interface Envelope {
  version: string;
  columns: unknown;
  rows: unknown;
}

/** A fresh, valid envelope for each case to spoil in exactly one way. */
function envelope(): Envelope {
  return {
    version: "1",
    columns: [...WIDGET_COLUMNS],
    rows: [
      [1, "one"],
      [2, "two"],
    ],
  };
}

function rowsOf(payload: Envelope): unknown[] {
  return payload.rows as unknown[];
}

function columnsOf(payload: Envelope): unknown[] {
  return payload.columns as unknown[];
}

function parseWidgetRows(rows: unknown[]): Widget[] {
  return rows.map((row) => {
    const [id, label] = row as [number, string];
    return { id, label };
  });
}

/**
 * A loader with its own cache. Built per case, so these cases run without
 * resetting the module registry.
 */
function widgetLoader() {
  return createEnvelopeLoader({
    url: WIDGET_URL,
    dataset: "widget",
    columns: WIDGET_COLUMNS,
    parseRows: parseWidgetRows,
  });
}

function stubFetch(payload: unknown) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(payload))),
    );
}

/**
 * The error a load rejected with. Resolving is itself a failure here and is
 * reported as one, so no later assertion has to trip over an undefined value.
 */
async function rejectionOf<Row>(
  load: () => Promise<Row[]>,
): Promise<DatasetError> {
  try {
    await load();
  } catch (error) {
    if (error instanceof DatasetError) return error;
    throw new Error(
      `The load rejected with something other than a dataset error: ${String(error)}`,
      { cause: error },
    );
  }

  throw new Error("The load resolved when it was expected to reject.");
}

/**
 * The message and the code a load of the given payload rejected with. The two
 * travel together because they are asserted together everywhere, and reading
 * only one of them leaves the other free to drift.
 */
async function rejection(payload: unknown) {
  stubFetch(payload);
  const error = await rejectionOf(widgetLoader());
  return { message: error.message, code: error.code };
}

describe("envelope validation", () => {
  it("rejects a payload that is not an object", async () => {
    expect(await rejection("the widget data, honestly")).toEqual({
      message: "The widget data could not be read.",
      code: "notAnObject",
    });
  });

  it("rejects a null payload", async () => {
    expect(await rejection(null)).toEqual({
      message: "The widget data could not be read.",
      code: "notAnObject",
    });
  });

  it("rejects a payload with no rows array", async () => {
    const payload = envelope();
    delete (payload as Partial<Envelope>).rows;

    expect(await rejection(payload)).toEqual({
      message: "The widget data is missing its rows array.",
      code: "missingRows",
    });
  });

  it("rejects a payload whose rows is an object rather than an array", async () => {
    const payload = envelope();
    payload.rows = { 0: [1, "one"] };

    expect(await rejection(payload)).toEqual({
      message: "The widget data is missing its rows array.",
      code: "missingRows",
    });
  });

  it("rejects a payload with no columns array", async () => {
    const payload = envelope();
    delete (payload as Partial<Envelope>).columns;

    expect(await rejection(payload)).toEqual({
      message:
        "The widget data has an unexpected column order and was not loaded.",
      code: "columnOrder",
    });
  });

  it("rejects a payload whose columns are transposed", async () => {
    const payload = envelope();
    const columns = columnsOf(payload);
    [columns[0], columns[1]] = [columns[1], columns[0]];

    expect(await rejection(payload)).toEqual({
      message:
        "The widget data has an unexpected column order and was not loaded.",
      code: "columnOrder",
    });
  });

  it("rejects a payload whose columns are short by one", async () => {
    const payload = envelope();
    payload.columns = columnsOf(payload).slice(0, 1);

    expect(await rejection(payload)).toEqual({
      message:
        "The widget data has an unexpected column order and was not loaded.",
      code: "columnOrder",
    });
  });

  it("hands the rows to the dataset's own parser and nothing else", async () => {
    // The row check is the half that stays per dataset, so what this module
    // owes it is the rows array and no interpretation of what is in it.
    stubFetch(envelope());
    const parseRows = vi.fn(parseWidgetRows);
    const load = createEnvelopeLoader({
      url: WIDGET_URL,
      dataset: "widget",
      columns: WIDGET_COLUMNS,
      parseRows,
    });

    const rows = await load();

    expect(parseRows).toHaveBeenCalledWith(rowsOf(envelope()));
    expect(rows).toEqual([
      { id: 1, label: "one" },
      { id: 2, label: "two" },
    ]);
  });
});

describe("transport", () => {
  it("rejects a non-ok response by status, without reading the body", async () => {
    // The body served here would fail validation on its own, so a message that
    // names the status is proof the status was checked before anything was
    // parsed.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("the widget data, honestly", { status: 500 }),
    );

    const error = await rejectionOf(widgetLoader());

    expect(error.message).toBe(
      "The widget data could not be downloaded (status 500).",
    );
    expect(error.code).toBe("status");
    // The status travels as the detail, so the sentence a reader is shown can
    // name it without parsing it back out of the message.
    expect(error.detail).toBe(500);
  });

  it("rejects a request that never reaches the host with copy written for a reader", async () => {
    // The text a failed request carries is the browser's own, it differs
    // between browsers, and none of it tells the reader what to do.
    const transportFailure = new Error("Failed to fetch");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(transportFailure);

    const error = await rejectionOf(widgetLoader());

    expect(error.message).toBe(
      "The widget data could not be downloaded. Check your connection and try again.",
    );
    expect(error.code).toBe("transport");
    expect(error.message).not.toContain("Failed to fetch");
    // The reader sees the authored sentence, a developer still has the reason.
    expect(error.cause).toBe(transportFailure);
  });

  it("arms a timeout on the request, so a stall rejects rather than hanging", async () => {
    // A stalled request is the one failure that produces no rejection of its
    // own. Nothing settles, the download message renders forever, and the
    // reader is never offered the retry. Asserting the signal is an AbortSignal
    // would not say that, since a controller's signal that never fires is one
    // too, so the assertion below is that the signal handed to the request is a
    // timeout with a plausible budget.
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    const fetchSpy = stubFetch(envelope());

    await widgetLoader()();

    const budget = timeoutSpy.mock.calls[0]?.[0];
    // The band, not the value. A test naming the constant would only restate
    // it, but a zero or a millisecond would fail every load and a day would be
    // the hang this replaces.
    expect(budget).toBeGreaterThanOrEqual(5_000);
    expect(budget).toBeLessThanOrEqual(120_000);
    // The signal the timeout produced is the signal the request carries.
    expect(fetchSpy.mock.calls[0]?.[1]?.signal).toBe(
      timeoutSpy.mock.results[0]?.value,
    );
  });

  it("reports a body read that stopped as a failed download, not a bad body", async () => {
    // A connection that dies after the headers arrive rejects the body read
    // and not the request, and so does the timeout signal, which covers the
    // body too. Neither is a file the parser could not read, and reporting one
    // as such sends the reader looking for a corrupt data file when the fault
    // is their connection.
    const dropped = new TypeError("terminated");
    const response = new Response("{");
    vi.spyOn(response, "json").mockRejectedValue(dropped);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response);

    const error = await rejectionOf(widgetLoader());

    expect(error.code).toBe("transport");
    expect(error.message).toBe(
      "The widget data could not be downloaded. Check your connection and try again.",
    );
    expect(error.cause).toBe(dropped);
  });

  it("rejects a success response carrying a page instead of the data file", async () => {
    // What a static host returns for a file it cannot find: the application's
    // own page, under a success status. The parser then reports a syntax error
    // naming a character, which is no help to anyone reading the screen.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        "<!doctype html><html><body>Yet Another React Table</body></html>",
        { status: 200, headers: { "content-type": "text/html" } },
      ),
    );

    const error = await rejectionOf(widgetLoader());

    expect(error.message).toBe(
      "The widget data was downloaded but could not be read as JSON.",
    );
    expect(error.code).toBe("notJson");
    expect(error.message).not.toContain("Unexpected token");
    expect(error.cause).toBeInstanceOf(Error);
  });
});

describe("caching", () => {
  it("issues one request for two calls, so a double mount loads once", async () => {
    // A request count, because a timing assertion passes against a second
    // request that happened to be fast.
    const fetchSpy = stubFetch(envelope());
    const load = widgetLoader();

    const first = await load();
    const second = await load();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it("clears the cache on rejection, so a retry re-issues the request", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("Failed to fetch"))
      .mockResolvedValueOnce(new Response(JSON.stringify(envelope())));
    const load = widgetLoader();

    await expect(load()).rejects.toBeInstanceOf(DatasetError);
    // The clear is attached to the rejected promise itself, so a retry issued
    // after it has settled finds no cache and does not re-await the failure.
    const rows = await load();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(rows).toHaveLength(2);
  });

  it("holds one cache per loader, so two datasets do not answer each other", async () => {
    // Why this is a factory. A single module-scope cache would
    // let the second loader resolve with the first one's rows, which is a films
    // page rendering cities.
    const gadgetColumns = ["code"] as const;
    vi.spyOn(globalThis, "fetch").mockImplementation((input) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            input === WIDGET_URL
              ? envelope()
              : { version: "1", columns: [...gadgetColumns], rows: [["a"]] },
          ),
        ),
      ),
    );
    const loadGadgets = createEnvelopeLoader({
      url: "/gadgets.json",
      dataset: "gadget",
      columns: gadgetColumns,
      parseRows: (rows) => rows.map((row) => ({ code: (row as [string])[0] })),
    });

    const widgets = await widgetLoader()();
    const gadgets = await loadGadgets();

    expect(widgets).toEqual([
      { id: 1, label: "one" },
      { id: 2, label: "two" },
    ]);
    expect(gadgets).toEqual([{ code: "a" }]);
  });
});
