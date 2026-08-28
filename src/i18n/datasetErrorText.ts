import { DatasetError } from "../api/getCities";

import type { Catalog } from "./catalogs/en";

/**
 * The sentence a reader is shown for a failed load.
 *
 * Called during render rather than where the failure is caught, and the
 * difference matters: the catch lives inside the container's fetch effect, so
 * reading the catalog there would put the locale in that effect's dependency
 * array and changing the language would re-issue the search.
 *
 * The lookup is total over a closed union of codes read off a class instance,
 * so nothing a reader controls indexes it and there is no fallback arm inside
 * it. Only the selected sentence is returned; the failure's own message is
 * developer-facing text and its preserved cause is engine text, and neither is
 * something a reader was ever meant to see.
 *
 * A failure that is not a dataset error is one this application has no code
 * for, and it takes the unexpected sentence. That is the second of the two
 * branches here, and it is the one a rejection carrying no error at all reaches.
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
