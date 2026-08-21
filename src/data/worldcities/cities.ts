// The ?url suffix is load-bearing. A plain value import of the same file would
// compile the whole dataset back into the JavaScript bundle, with no visible
// error, and the app would then download it a second time as well.
import citiesUrl from "./cities.json?url";

/**
 * simplemaps.com "World Cities" basic database, v1.91.3, distributed under
 * CC BY 4.0. See license.txt.
 *
 * The dataset ships as cities.json, produced from the upstream worldcities.csv
 * export by scripts/generate-cities.mjs. Only the columns the City type needs
 * are kept; lat, lng, iso2, and admin_name are dropped. Rows are ordered by
 * descending population so the default view leads with the largest cities.
 *
 * Upstream quirks preserved deliberately:
 * - 432 rows have no population and are recorded as 0.
 * - 2 rows have no upstream id and are assigned 1 and 2. Every real id is
 *   >= 1004003059, so these cannot collide.
 * - 2 rows have an empty city_ascii and fall back to the city name.
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
 * The only place the untyped result of response.json() is narrowed. Every
 * message here reaches the inline error region verbatim, so each one is written
 * for a reader rather than for a log.
 */
function parseCities(payload: unknown): IndexedCity[] {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("The city data could not be read.");
  }

  const { columns, rows } = payload as { columns?: unknown; rows?: unknown };

  if (!Array.isArray(rows)) {
    throw new Error("The city data is missing its rows array.");
  }

  if (
    !Array.isArray(columns) ||
    columns.length !== COLUMNS.length ||
    columns.some((column, at) => column !== COLUMNS[at])
  ) {
    throw new Error(
      "The city data has an unexpected column order and was not loaded.",
    );
  }

  return (rows as unknown[]).map((row, at) => {
    if (!Array.isArray(row) || row.length !== COLUMNS.length) {
      throw new Error(
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
      throw new Error(
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
      searchKey: [name, nameAscii, country]
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
    .then((response) => {
      if (!response.ok) {
        throw new Error(
          `The city data could not be downloaded (status ${response.status}).`,
        );
      }
      return response.json();
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
