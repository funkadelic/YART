import type { City } from "../data/worldcities/cities";
import { SEARCH_KEY_SEPARATOR, loadCities } from "../data/worldcities/cities";

// Re-exported so no consumer's import path changed when the definition moved.
export type { City };

export interface GetCitiesParams {
  searchTerm?: string;
}

/** Matches a term against name, ascii name, country and country code. */
export async function getCities({
  searchTerm = "",
}: GetCitiesParams = {}): Promise<readonly City[]> {
  const all = await loadCities();

  const needle = searchTerm.trim().toLowerCase();

  // The guard sits at this seam, because a URL parser would cover only terms
  // arriving from the address. Here a term arriving any other way is answered
  // the same. The separator marks a field boundary in the search key, so no
  // field's content holds one and a term carrying one matches nothing. Deleting
  // it instead would answer a different search, and a term of nothing but a
  // separator would answer every row.
  //
  // The empty term hands out the cache itself, which the loader freezes, so the
  // sort cache can key on its identity.
  if (needle === "") return all;
  if (needle.includes(SEARCH_KEY_SEPARATOR)) {
    return [];
  }
  return all.filter((city) => city.searchKey.includes(needle));
}
