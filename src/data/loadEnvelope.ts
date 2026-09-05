/**
 * The ways loading can fail. Codes, because the messages below are English.
 * Six are thrown here, two by each dataset's own row check, and "unexpected" is
 * App's fallback for a rejection that carries no Error. A tuple, so the catalog
 * test walks the set rather than restating it.
 */
export const DATASET_ERROR_CODES = [
  "notAnObject",
  "missingRows",
  "columnOrder",
  "rowShape",
  "rowFieldType",
  "transport",
  "status",
  "notJson",
  "unexpected",
] as const;

/** Which failure a dataset error is. */
export type DatasetErrorCode = (typeof DATASET_ERROR_CODES)[number];

/** A dataset failure and its code. The message never reaches the screen. */
export class DatasetError extends Error {
  constructor(
    readonly code: DatasetErrorCode,
    readonly detail: number,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "DatasetError";
  }
}

/**
 * Joins the indexed fields. The address can carry one (`?q=%00`) and trim does
 * not strip it, so whichever seam owns a search key removes it from the needle
 * rather than this being a character no input produces.
 */
export const SEARCH_KEY_SEPARATOR = "\u0000";

/** Generous: a wall-clock deadline sized for the larger asset, which cannot resume. */
const LOAD_TIMEOUT_MS = 60_000;

/** A download that did not finish. A stall and a drop are one failure. */
function transportError(dataset: string, cause: unknown): DatasetError {
  return new DatasetError(
    "transport",
    0,
    `The ${dataset} data could not be downloaded. Check your connection and try again.`,
    { cause },
  );
}

/** What a dataset brings to the shared envelope. */
export interface EnvelopeLoaderOptions<Row> {
  /** The URL-imported asset. */
  url: string;
  /** Names the dataset in the failure messages this module throws. */
  dataset: string;
  /** The order the asset must declare, so a mis-mapping is a startup failure. */
  columns: readonly string[];
  /** The per-row check, which is the only shape this module does not know. */
  parseRows: (rows: unknown[]) => Row[];
}

/**
 * Builds a loader over one dataset asset: the transport, status, JSON and
 * envelope boundaries, and one promise cache.
 *
 * A factory rather than a function, because the cache is closed over per call.
 * One module-scope cache shared by every dataset would let one request resolve
 * with another dataset's rows, which this shape makes unrepresentable.
 */
export function createEnvelopeLoader<Row>({
  url,
  dataset,
  columns,
  parseRows,
}: EnvelopeLoaderOptions<Row>): () => Promise<Row[]> {
  let cached: Promise<Row[]> | undefined;

  /** The only place the untyped result of response.json() is narrowed. */
  function parseEnvelope(payload: unknown): Row[] {
    if (typeof payload !== "object" || payload === null) {
      throw new DatasetError(
        "notAnObject",
        0,
        `The ${dataset} data could not be read.`,
      );
    }

    const { columns: declared, rows } = payload as {
      columns?: unknown;
      rows?: unknown;
    };

    if (!Array.isArray(rows)) {
      throw new DatasetError(
        "missingRows",
        0,
        `The ${dataset} data is missing its rows array.`,
      );
    }

    if (
      !Array.isArray(declared) ||
      declared.length !== columns.length ||
      declared.some((column, at) => column !== columns[at])
    ) {
      throw new DatasetError(
        "columnOrder",
        0,
        `The ${dataset} data has an unexpected column order and was not loaded.`,
      );
    }

    return parseRows(rows as unknown[]);
  }

  /** The cache is what makes a double mount issue one request. */
  return function load(): Promise<Row[]> {
    if (cached) return cached;

    const pending = fetch(url, {
      signal: AbortSignal.timeout(LOAD_TIMEOUT_MS),
    })
      // The browser's own text tells the reader nothing, so it is replaced and
      // kept as the cause. Attached here, so a read failure is not reported as one.
      .catch((reason: unknown) => {
        throw transportError(dataset, reason);
      })
      .then((response) => {
        if (!response.ok) {
          throw new DatasetError(
            "status",
            response.status,
            `The ${dataset} data could not be downloaded (status ${response.status}).`,
          );
        }
        // A static host serving its own page for a missing file answers with a
        // success status and HTML, so the status check stays ahead of this.
        return response.json().catch((reason: unknown) => {
          // A body that is not JSON fails the parse and nothing else does, so
          // everything else reaching here is the download stopping partway.
          if (!(reason instanceof SyntaxError)) {
            throw transportError(dataset, reason);
          }
          throw new DatasetError(
            "notJson",
            0,
            `The ${dataset} data was downloaded but could not be read as JSON.`,
            { cause: reason },
          );
        });
      })
      .then(parseEnvelope);

    // Attached at store time: any delay leaves a window in which a retry
    // re-awaits the already-rejected promise. Unconditional is safe, because a
    // new entry is only stored after this handler has cleared the old one.
    pending.catch(() => {
      cached = undefined;
    });

    cached = pending;
    return pending;
  };
}
