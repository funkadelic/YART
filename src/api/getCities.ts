import type { City } from "../data/worldcities/cities";
import { loadCities } from "../data/worldcities/cities";

// Re-exported so no consumer's import path changes: the definition moved, the
// import site did not.
export type { City };

export interface GetCitiesParams {
  searchTerm?: string;
}

/**
 * Simulated network latency, in milliseconds.
 */
const LATENCY_MS = 200;

/**
 * Fake API that returns cities matching a search term against city name, ascii
 * name, or country name. The dataset itself is downloaded once and cached, so a
 * failed download is what rejects here.
 */
export async function getCities({
  searchTerm = "",
}: GetCitiesParams = {}): Promise<City[]> {
  const all = await loadCities();

  const needle = searchTerm.trim().toLowerCase();
  const matched = needle
    ? all.filter((city) => city.searchKey.includes(needle))
    : all;

  // The latency is applied to the filter rather than only to the download, so a
  // cache-warm call still behaves like a network call and the container's
  // debounce timing keeps its meaning.
  await new Promise<void>((resolve) => {
    setTimeout(resolve, LATENCY_MS);
  });

  return matched;
}
