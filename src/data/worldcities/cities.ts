// The ?url suffix is load-bearing: a plain value import would compile several
// megabytes of dataset into the JavaScript chunk with no visible error.
import citiesUrl from "./cities.json?url";

/**
 * simplemaps.com "World Cities" basic database, v1.91.3, distributed under
 * CC BY 4.0. See license.txt.
 *
 * Only the columns this type needs are kept, and rows are ordered by descending
 * population. Provenance is recorded in license.txt and the README, not here.
 *
 * Upstream quirks preserved deliberately:
 * - 432 rows have no population and are recorded as 0.
 * - 2 rows have no upstream id and are assigned 1 and 2. Every real id is
 *   >= 1004003059, so these cannot collide.
 * - 2 rows have an empty city_ascii and fall back to the city name.
 *
 * City and country names stay in their source form in every locale: the dataset
 * carries a name and an ascii name and nothing else, so a reader of the French
 * interface still reads the English country name. Translating them would need a
 * translated column and a regenerated asset, which is a data pipeline rather
 * than an internationalization change.
 *
 * Stated here as well as in the README, and held together by a guard in
 * src/toolchain.test.ts so neither copy can be reworded on its own.
 */
export interface City {
  id: number;
  name: string;
  nameAscii: string;
  country: string;
  countryIso3: string;
  capital: string;
  population: number;
}

/**
 * The ways loading can fail. Codes, because the messages below are English.
 * Eight are thrown here; "unexpected" is App's fallback for a rejection that
 * carries no Error. A tuple, so the catalog test walks the set rather than
 * restating it.
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

/** The order the asset must declare, so a mis-mapping is a startup failure. */
const COLUMNS = [
  "id",
  "name",
  "nameAscii",
  "country",
  "countryIso3",
  "capital",
  "population",
] as const;

/** A text input cannot produce this, so a needle cannot cross a field. */
const SEARCH_KEY_SEPARATOR = "\u0000";

/** A search cache rather than a fact about a city, so it stays off City. */
interface IndexedCity extends City {
  searchKey: string;
}

/** Generous: a wall-clock deadline over a 3.3MB asset that cannot resume. */
const LOAD_TIMEOUT_MS = 60_000;

/** A download that did not finish. A stall and a drop are one failure. */
function transportError(cause: unknown): DatasetError {
  return new DatasetError(
    "transport",
    0,
    "The city data could not be downloaded. Check your connection and try again.",
    { cause },
  );
}

let cached: Promise<IndexedCity[]> | undefined;

/** The only place the untyped result of response.json() is narrowed. */
function parseCities(payload: unknown): IndexedCity[] {
  if (typeof payload !== "object" || payload === null) {
    throw new DatasetError(
      "notAnObject",
      0,
      "The city data could not be read.",
    );
  }

  const { columns, rows } = payload as { columns?: unknown; rows?: unknown };

  if (!Array.isArray(rows)) {
    throw new DatasetError(
      "missingRows",
      0,
      "The city data is missing its rows array.",
    );
  }

  if (
    !Array.isArray(columns) ||
    columns.length !== COLUMNS.length ||
    columns.some((column, at) => column !== COLUMNS[at])
  ) {
    throw new DatasetError(
      "columnOrder",
      0,
      "The city data has an unexpected column order and was not loaded.",
    );
  }

  return (rows as unknown[]).map((row, at) => {
    if (!Array.isArray(row) || row.length !== COLUMNS.length) {
      throw new DatasetError(
        "rowShape",
        at,
        `City row ${at} does not have ${COLUMNS.length} fields and was not loaded.`,
      );
    }

    const [id, name, nameAscii, country, countryIso3, capital, population] =
      row as unknown[];

    if (
      typeof id !== "number" ||
      typeof population !== "number" ||
      typeof name !== "string" ||
      typeof nameAscii !== "string" ||
      typeof country !== "string" ||
      typeof countryIso3 !== "string" ||
      typeof capital !== "string"
    ) {
      throw new DatasetError(
        "rowFieldType",
        at,
        `City row ${at} has a field of the wrong type and was not loaded.`,
      );
    }

    return {
      id,
      name,
      nameAscii,
      country,
      countryIso3,
      capital,
      population,
      // Four of the five rendered columns. Capital is left out: its upstream
      // codes would make "in" match 31,388 rows of 50,250 instead of 19,051.
      searchKey: [name, nameAscii, country, countryIso3]
        .join(SEARCH_KEY_SEPARATOR)
        .toLowerCase(),
    };
  });
}

/** The module-scope cache is what makes a double mount issue one request. */
export function loadCities(): Promise<IndexedCity[]> {
  if (cached) return cached;

  const pending = fetch(citiesUrl, {
    signal: AbortSignal.timeout(LOAD_TIMEOUT_MS),
  })
    // The browser's own text tells the reader nothing, so it is replaced and
    // kept as the cause. Attached here, so a read failure is not reported as one.
    .catch((reason: unknown) => {
      throw transportError(reason);
    })
    .then((response) => {
      if (!response.ok) {
        throw new DatasetError(
          "status",
          response.status,
          `The city data could not be downloaded (status ${response.status}).`,
        );
      }
      // A static host serving its own page for a missing file answers with a
      // success status and HTML, so the status check stays ahead of this.
      return response.json().catch((reason: unknown) => {
        // A body that is not JSON fails the parse and nothing else does, so
        // everything else reaching here is the download stopping partway.
        if (!(reason instanceof SyntaxError)) {
          throw transportError(reason);
        }
        throw new DatasetError(
          "notJson",
          0,
          "The city data was downloaded but could not be read as JSON.",
          { cause: reason },
        );
      });
    })
    .then(parseCities);

  // Attached at store time: any delay leaves a window in which a retry
  // re-awaits the already-rejected promise. Unconditional is safe, because a
  // new entry is only stored after this handler has cleared the old one.
  pending.catch(() => {
    cached = undefined;
  });

  cached = pending;
  return pending;
}
