// The ?url suffix matters: a plain value import would compile the whole
// dataset into the JavaScript chunk with no visible error.
import filmsUrl from "./films.json?url";
import { DatasetError, createEnvelopeLoader } from "../loadEnvelope";

// The failure vocabulary reaches the tree through this module, so a consumer
// needs one import path rather than two. src/api/getFilms.ts does the same.
export type { DatasetErrorCode } from "../loadEnvelope";
export { DATASET_ERROR_CODES, DatasetError } from "../loadEnvelope";

/**
 * Wikidata films, queried through the Query Service and released under CC0 1.0.
 * Provenance is in license.md. A missing year or runtime is null rather than
 * zero, and films.asset.test.ts holds that and the other preserved quirks.
 *
 * Film, director, genre and country names stay in their source form in every
 * locale. The query asks for English labels and nothing else, so a reader of
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

// Code-unit order, because the asset is parsed once and cached while the
// locale can still change.
const byCodeUnit = (a: string, b: string) => {
  if (a === b) return 0;
  return a < b ? -1 : 1;
};

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

    // Runtime kept as published; a fractional one is real. The multi-valued
    // fields are sorted here because GROUP_CONCAT promises no order.
    return {
      id,
      title,
      year,
      runtime,
      directors: [...directors].sort(byCodeUnit),
      genres: [...genres].sort(byCodeUnit),
      countries: [...countries].sort(byCodeUnit),
    };
  });
}

/** The cache the factory holds is why a double mount issues one request. */
export const loadFilms = createEnvelopeLoader({
  url: filmsUrl,
  dataset: "film",
  columns: COLUMNS,
  parseRows: parseFilmRows,
});
