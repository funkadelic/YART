import type { City, DatasetErrorCode } from "../data/worldcities/cities";
import {
  DATASET_ERROR_CODES,
  DatasetError,
  loadCities,
} from "../data/worldcities/cities";

// Re-exported so no consumer's import path changes: the definition moved, the
// import site did not.
export type { City };

// The failure vocabulary reaches the rest of the tree through this seam too, so
// the loader keeps exactly one consumer. The application layer and the catalogs
// need the code to choose a sentence; neither has any business reaching past
// this module to get it.
export type { DatasetErrorCode };
export { DATASET_ERROR_CODES, DatasetError };

export interface GetCitiesParams {
  searchTerm?: string;
}

/**
 * Simulated network latency, in milliseconds.
 */
const LATENCY_MS = 200;

/**
 * Fake API that returns cities matching a search term against city name, ascii
 * name, country name, or country code. Capital is rendered by the table but is
 * not matched, because its values are classification codes rather than anything
 * a reader searches for; the loader's key comment carries the reasoning. The
 * dataset itself is downloaded once and cached, so a failed download is what
 * rejects here.
 */
export async function getCities({
  searchTerm = "",
}: GetCitiesParams = {}): Promise<City[]> {
  const all = await loadCities();

  const needle = searchTerm.trim().toLowerCase();
  // The empty term returns a copy, so the module-scope cache cannot escape
  // and both branches hand back an array the caller owns. Copying 50,250
  // references costs less than the latency below.
  const matched = needle
    ? all.filter((city) => city.searchKey.includes(needle))
    : [...all];

  // The latency is applied to the filter rather than only to the download, so a
  // cache-warm call still behaves like a network call and the container's
  // debounce timing keeps its meaning.
  await new Promise<void>((resolve) => {
    setTimeout(resolve, LATENCY_MS);
  });

  return matched;
}
