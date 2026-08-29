// The ?url suffix is load-bearing. A plain value import of the same file would
// compile the whole dataset back into the JavaScript bundle, with no visible
// error, and the app would then download it a second time as well.
import citiesUrl from "./cities.json?url";

/**
 * simplemaps.com "World Cities" basic database, v1.91.3, distributed under
 * CC BY 4.0. See license.txt.
 *
 * The dataset ships as cities.json. Only the columns the City type needs are
 * kept; lat, lng, iso2, and admin_name are dropped. Rows are ordered by
 * descending population so the default view leads with the largest cities.
 *
 * Provenance is recorded in license.txt and in the README rather than here, so
 * there is one account of how the committed bytes came to exist.
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
 * That is stated here as well as in the README because this is the file a reader
 * asking why a name is not translated is already looking at. The two copies are
 * held together by a guard in src/toolchain.test.ts, so neither can be reworded
 * on its own.
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
 * The ways loading the dataset can fail, as a closed set of codes.
 *
 * A code rather than a message, because the message below is English and the
 * reader may not be. The application layer turns a code into the sentence a
 * reader sees, and this module still imports nothing but its own asset: the
 * codes are its own vocabulary in the way the city type is.
 *
 * Eight of the nine are thrown here. The ninth is the container's own fallback
 * for a rejection that carries no error at all, which cannot originate here
 * because nothing here rejects with a non-error.
 *
 * A tuple rather than a bare union, so the catalog test can walk the set rather
 * than restate it.
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

/**
 * A dataset failure, carrying the code that says which one it is.
 *
 * The message stays exactly what it was and stays English: it is the
 * developer-facing text, the one a stack trace and a test assertion read. The
 * preserved cause stays where it was attached. Neither reaches the screen.
 *
 * The detail is a single number and every failure carries one, including the
 * six whose sentence ignores it. Uniform on purpose, so the lookup that turns a
 * code into a sentence has one shape and no branch; the three that use it carry
 * a row index or a response status.
 */
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
 * The column order the asset must declare. Asserting it is what converts the
 * tuple shape's one real defect from silently mis-mapping 50,250 rows into a
 * loud startup failure.
 */
const COLUMNS = [
  "id",
  "name",
  "nameAscii",
  "country",
  "countryIso3",
  "capital",
  "population",
] as const;

/**
 * Separates the fields of the derived search key. A text input cannot produce
 * this character, so a needle can never match across a field boundary.
 * Concatenating with a space instead would diverge from the per-field matcher
 * this replaces on thousands of rows.
 */
const SEARCH_KEY_SEPARATOR = "\u0000";

/**
 * The derived key is a search cache, not a fact about a city, so it stays off
 * the exported type: a searchKey on City would surface in a column descriptor
 * as a column-shaped field that is not a column.
 */
interface IndexedCity extends City {
  searchKey: string;
}

let cached: Promise<IndexedCity[]> | undefined;

/**
 * The only place the untyped result of response.json() is narrowed. Each
 * failure carries a code, and the sentence a reader is shown is chosen from
 * that code one layer up; the message written here is the developer-facing
 * text and no longer reaches the screen.
 */
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
      // Four of the five rendered columns. Capital is the one left out, and
      // deliberately: its only values are the upstream classification codes
      // "primary", "admin", "minor", and empty, which nobody types into a city
      // search, and folding them in would bleed into every short needle. Over
      // the committed rows "in" would match 31,388 of 50,250 instead of 19,051,
      // through "admin" and "minor" rather than through anything a reader meant.
      searchKey: [name, nameAscii, country, countryIso3]
        .join(SEARCH_KEY_SEPARATOR)
        .toLowerCase(),
    };
  });
}

/**
 * Downloads, validates, and indexes the dataset, caching the promise at module
 * scope. A cache hit returns the same promise, which is what makes a double
 * mount issue one request by construction rather than by cancellation.
 */
export function loadCities(): Promise<IndexedCity[]> {
  if (cached) return cached;

  const pending = fetch(citiesUrl)
    // The text a request carries when it never reaches the host is the
    // browser's own, it differs between browsers, and none of it tells the
    // reader what to do. It is replaced here and kept as the cause. This is
    // attached to the request rather than to the chain below, so nothing
    // thrown while reading the response can be reported as a transport
    // failure.
    .catch((reason: unknown) => {
      throw new DatasetError(
        "transport",
        0,
        "The city data could not be downloaded. Check your connection and try again.",
        { cause: reason },
      );
    })
    .then((response) => {
      if (!response.ok) {
        throw new DatasetError(
          "status",
          response.status,
          `The city data could not be downloaded (status ${response.status}).`,
        );
      }
      // A static host that serves the application's own page for a file it
      // cannot find answers with a success status and a body of HTML, so the
      // parser reports a syntax error naming a character rather than anything
      // the reader can act on. The status check stays ahead of this, so a
      // status failure is never reported as a parse failure.
      return response.json().catch((reason: unknown) => {
        throw new DatasetError(
          "notJson",
          0,
          "The city data was downloaded but could not be read as JSON.",
          { cause: reason },
        );
      });
    })
    .then(parseCities);

  // Attached at store time and never deferred. Any delay leaves a window in
  // which a retry re-awaits the already-rejected promise and fails instantly
  // for a reason the user cannot see. The clear is unconditional because the
  // only path that stores a new entry runs after this handler has already
  // cleared the old one, so a rejection can never reach an entry other than
  // its own. The rejection still reaches callers, who hold the promise
  // returned below rather than this derived one.
  pending.catch(() => {
    cached = undefined;
  });

  cached = pending;
  return pending;
}
