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

  const needle = searchTerm.trim().toLowerCase();

  // The guard sits at this seam, because a URL parser would cover only terms
  // arriving from the address. Here a term arriving any other way is answered
  // the same. The separator marks a field boundary in the search key, so no
  // field's content holds one and a term carrying one matches nothing. Deleting
  // it instead would answer a different search, and a term of nothing but a
  // separator would answer every row.
  //
  // The empty term returns a copy, so the module-scope cache cannot escape.
  let matched: City[];
  if (needle === "") {
    matched = [...all];
  } else if (needle.includes(SEARCH_KEY_SEPARATOR)) {
    matched = [];
  } else {
    matched = all.filter((city) => city.searchKey.includes(needle));
  }

  // Applied to the filter as well as the download, so a cache-warm call still
  // behaves like a network call and the debounce timing keeps its meaning.
  await new Promise<void>((resolve) => {
    setTimeout(resolve, LATENCY_MS);
  });

  return matched;
}
