// The ?url suffix is load-bearing: a plain value import would compile several
// megabytes of dataset into the JavaScript chunk with no visible error.
import citiesUrl from "./cities.json?url";
import {
  DatasetError,
  SEARCH_KEY_SEPARATOR,
  createEnvelopeLoader,
} from "../loadEnvelope";

// The failure vocabulary reaches the tree through this module, so no consumer's
// import path moved when the shared boundaries were extracted. Same trick
// src/api/getCities.ts uses on this module, for the same reason.
export type { DatasetErrorCode } from "../loadEnvelope";
export {
  DATASET_ERROR_CODES,
  DatasetError,
  SEARCH_KEY_SEPARATOR,
} from "../loadEnvelope";

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

/** An index for searching and not a fact about a city, so it stays off City. */
interface IndexedCity extends City {
  searchKey: string;
}

/** The only place a row's untyped fields are narrowed. */
function parseCityRows(rows: unknown[]): IndexedCity[] {
  return rows.map((row, at) => {
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
      // Four of the five rendered columns. Capital is left out because its
      // upstream codes would make "in" match 31,388 rows of 50,250 instead of
      // 19,051.
      searchKey: [name, nameAscii, country, countryIso3]
        .join(SEARCH_KEY_SEPARATOR)
        .toLowerCase(),
    };
  });
}

/** The cache the factory holds is why a double mount issues one request. */
export const loadCities = createEnvelopeLoader({
  url: citiesUrl,
  dataset: "city",
  columns: COLUMNS,
  parseRows: parseCityRows,
});
