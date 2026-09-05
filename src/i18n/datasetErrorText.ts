// Taken from the shared envelope loader rather than from either dataset seam.
// This module serves both pages, so naming one seam would pull that dataset's
// loader into the chunk both entries share, and the other page would download
// a dataset it never renders.
import { DatasetError } from "../data/loadEnvelope";

import type { DomainCatalog } from "./catalogs/en";

/**
 * The sentence a reader is shown for a failed load. Called during render, not
 * at the catch, which would put the locale in the fetch effect's dependencies.
 * The second of the two branches is the one a rejection with no error reaches.
 *
 * Given one domain's half of the catalog rather than the whole of it: this
 * reads the error record and nothing else, so the caller names which failed.
 */
export function datasetErrorText(
  error: Error,
  catalog: DomainCatalog,
  tag: string,
): string {
  if (error instanceof DatasetError) {
    return catalog.datasetError[error.code](tag, error.detail);
  }

  return catalog.datasetError.unexpected(tag, 0);
}
