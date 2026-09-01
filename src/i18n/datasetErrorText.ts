import { DatasetError } from "../api/getCities";

import type { Catalog } from "./catalogs/en";

/**
 * The sentence a reader is shown for a failed load. Called during render, not
 * at the catch, which would put the locale in the fetch effect's dependencies.
 * The second of the two branches is the one a rejection with no error reaches.
 */
export function datasetErrorText(
  error: Error,
  catalog: Catalog,
  tag: string,
): string {
  if (error instanceof DatasetError) {
    return catalog.datasetError[error.code](tag, error.detail);
  }

  return catalog.datasetError.unexpected(tag, 0);
}
