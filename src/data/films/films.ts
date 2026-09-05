// The ?url suffix is load-bearing: a plain value import would compile several
// megabytes of dataset into the JavaScript chunk with no visible error.
import filmsUrl from "./films.json?url";
import { DatasetError, createEnvelopeLoader } from "../loadEnvelope";

// The failure vocabulary reaches the tree through this module, so no consumer's
// import path moved when the shared boundaries were extracted. Same trick
// src/api/getFilms.ts uses on this module, for the same reason.
export type { DatasetErrorCode } from "../loadEnvelope";
export { DATASET_ERROR_CODES, DatasetError } from "../loadEnvelope";

/**
 * Wikidata films, queried through the Query Service and released under CC0 1.0.
 * See license.md.
 *
 * Only the properties this type needs are kept, rows are ordered by ascending
 * Q-id, and multi-valued properties are collapsed to arrays. Provenance is
 * recorded in license.md and the README, not here.
 *
 * Upstream quirks preserved deliberately:
 * - One row has no year and 59 have no runtime, each recorded as null rather
 *   than as zero, because a film with no recorded length is not a film of no
 *   length.
 * - One runtime is fractional. It is kept as it was published rather than
 *   rounded, since rounding at a parse boundary is data loss with no record.
 * - Around a hundred rows carry an empty array for a multi-valued property,
 *   which is the query returning no binding rather than a film with no country.
 *
 * Film, director, genre and country names stay in their source form in every
 * locale: the query asks for English labels and nothing else, so a reader of
 * the French interface still reads the English genre name. Translating them
 * would need a translated label per property and a regenerated asset, which is
 * a data pipeline rather than an internationalization change.
 *
 * Stated here as well as in the README, and held together by a guard in
 * src/toolchain.test.ts so neither copy can be reworded on its own.
 */
export interface Film {
  id: string;
  title: string;
  year: number | null;
  runtime: number | null;
  directors: readonly string[];
  genres: readonly string[];
  countries: readonly string[];
}

/** The order the asset must declare, so a mis-mapping is a startup failure. */
const COLUMNS = [
  "id",
  "title",
  "year",
  "runtime",
  "directors",
  "genres",
  "countries",
] as const;

/** The two nullable fields. Zero is a value here, so absence is null, not falsy. */
function isNumberOrNull(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

/** An array of numbers is still an array, so the elements are checked too. */
function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === "string")
  );
}

/** The only place a row's untyped fields are narrowed. */
function parseFilmRows(rows: unknown[]): Film[] {
  return rows.map((row, at) => {
    if (!Array.isArray(row) || row.length !== COLUMNS.length) {
      throw new DatasetError(
        "rowShape",
        at,
        `Film row ${at} does not have ${COLUMNS.length} fields and was not loaded.`,
      );
    }

    const [id, title, year, runtime, directors, genres, countries] =
      row as unknown[];

    if (
      typeof id !== "string" ||
      typeof title !== "string" ||
      !isNumberOrNull(year) ||
      !isNumberOrNull(runtime) ||
      !isStringArray(directors) ||
      !isStringArray(genres) ||
      !isStringArray(countries)
    ) {
      throw new DatasetError(
        "rowFieldType",
        at,
        `Film row ${at} has a field of the wrong type and was not loaded.`,
      );
    }

    // The runtime is taken as published. A fractional one is real and rounding
    // it here would be data loss no reader could see.
    //
    // The multi-valued fields are sorted here because the query groups them and
    // SPARQL promises no order within a group, so the asset's order is arbitrary
    // and a regeneration may permute it. Sorting once at the boundary is what
    // makes both the cell text and the column's order reproducible.
    return {
      id,
      title,
      year,
      runtime,
      directors: [...directors].sort(),
      genres: [...genres].sort(),
      countries: [...countries].sort(),
    };
  });
}

/** The cache the factory holds is what makes a double mount issue one request. */
export const loadFilms = createEnvelopeLoader({
  url: filmsUrl,
  dataset: "film",
  columns: COLUMNS,
  parseRows: parseFilmRows,
});
