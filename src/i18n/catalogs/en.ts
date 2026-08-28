/**
 * The base catalog: every string the shared table renders that names what its
 * rows are, in the language the rest of the tree is checked against.
 *
 * The wording is the wording the table already shipped, so introducing the
 * catalog changed no rendered string.
 *
 * The two function-valued entries take the resolved language tag as their first
 * parameter and ignore it here. The parameter exists so that weaving a number
 * or a plural into one of these sentences can move behind the entry later
 * without changing the arity the table sees, which is the whole reason the
 * table's labels are functions rather than templates.
 */
export const en = {
  loading: "Downloading the city data...",
  empty: "No cities found",
  emptyAnnouncement: "No cities found for that search",
  results: (tag: string, shown: number, total: number) =>
    `Showing ${shown} cities out of ${total} total results`,
  caption: (tag: string, total: number, sortSummary: string) =>
    `City data with ${total} entries, currently ${sortSummary}`,
};

/**
 * The shape every other catalog is held to. Derived from the base rather than
 * declared beside it, so the key set has one definition: a catalog missing a key
 * or misspelling one fails the type check rather than rendering undefined at a
 * reader.
 */
export type Catalog = typeof en;
