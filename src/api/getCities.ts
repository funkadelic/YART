import type { City } from "../data/worldcities/cities";
import { SEARCH_KEY_SEPARATOR, loadCities } from "../data/worldcities/cities";

// Re-exported so no consumer's import path changed when the definition moved.
export type { City };

// The failure vocabulary reaches the tree through this seam too, so the loader
// keeps exactly one consumer.
export type { DatasetErrorCode } from "../data/worldcities/cities";
export { DATASET_ERROR_CODES, DatasetError } from "../data/worldcities/cities";

export interface GetCitiesParams {
  searchTerm?: string;
}

/** Simulated network latency, in milliseconds. */
const LATENCY_MS = 200;

/** Matches a term against name, ascii name, country and country code. */
export async function getCities({
  searchTerm = "",
}: GetCitiesParams = {}): Promise<City[]> {
  const all = await loadCities();

  // Stripped here rather than at the URL parser, so a needle arriving any
  // other way cannot span two fields either.
  const needle = searchTerm
    .replaceAll(SEARCH_KEY_SEPARATOR, "")
    .trim()
    .toLowerCase();
  // The empty term returns a copy, so the module-scope cache cannot escape.
  const matched = needle
    ? all.filter((city) => city.searchKey.includes(needle))
    : [...all];

  // Applied to the filter as well as the download, so a cache-warm call still
  // behaves like a network call and the debounce timing keeps its meaning.
  await new Promise<void>((resolve) => {
    setTimeout(resolve, LATENCY_MS);
  });

  return matched;
}
