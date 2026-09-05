// These assertions name a domain type, so they live here rather than beside the
// descriptor they assert about. The shared table directory must name no domain
// type at all, and a source sweep proves that; importing the column array into
// that directory would fail the proof the layer rule rests on. Consolidating
// this file back into its sibling looks like tidying and is the defect.
//
// The suffix means here what it means at the head of that sibling: it is the
// runner's own convention for a type-level test, compiled by `npm run typecheck`
// and collected as a suite by nothing.

import type {
  Equal,
  Expect,
  IsAny,
  Not,
} from "../../components/DataTable/column.test-d";
import type { FilmColumnId } from "./filmColumns";

/**
 * The six ids exactly, with nothing widened and nothing missing. Dropping one
 * of the literals below fails `npm run typecheck`, which is what says the
 * assertion is live rather than vacuous.
 */
export type AssertFilmColumnIds = Expect<
  Equal<
    FilmColumnId,
    "title" | "year" | "runtime" | "directors" | "genres" | "countries"
  >
>;

export type AssertFilmColumnIdIsNotAny = Expect<Not<IsAny<FilmColumnId>>>;

/**
 * The failure that looks like success: inference collapsing to the whole string
 * type still compiles everywhere a column id is used, and silently costs every
 * renamed column its compile error.
 */
export type AssertFilmColumnIdIsNotString = Expect<
  Not<Equal<FilmColumnId, string>>
>;
