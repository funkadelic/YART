import type { Film } from "../data/films/films";
import { loadFilms } from "../data/films/films";

// Re-exported so no consumer's import path changed when the definition moved.
export type { Film };

// The failure vocabulary reaches the tree through this seam too, so the loader
// keeps exactly one consumer.
export type { DatasetErrorCode } from "../data/films/films";
export { DATASET_ERROR_CODES, DatasetError } from "../data/films/films";

export interface GetFilmsParams {
  searchTerm?: string;
}

/** Simulated network latency, in milliseconds. */
const LATENCY_MS = 200;

/**
 * Matches a term against the title.
 *
 * A sibling of src/api/getCities.ts, kept separate because the search semantics
 * differ. The city seam matches a derived key joining four fields, which only
 * cities have and which brings a separator guard with it, and a shared seam
 * would carry that guard for a dataset that has no key to guard.
 */
export async function getFilms({
  searchTerm = "",
}: GetFilmsParams = {}): Promise<Film[]> {
  const all = await loadFilms();

  const needle = searchTerm.trim().toLowerCase();

  // The empty term returns a copy, so the module-scope cache cannot escape.
  const matched =
    needle === ""
      ? [...all]
      : all.filter((film) => film.title.toLowerCase().includes(needle));

  // Applied to the filter as well as the download, so a cache-warm call still
  // behaves like a network call and the debounce timing keeps its meaning.
  await new Promise<void>((resolve) => {
    setTimeout(resolve, LATENCY_MS);
  });

  return matched;
}
