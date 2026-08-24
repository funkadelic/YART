// These assertions name a domain type, so they live here rather than beside the
// descriptor they assert about. The shared table directory must name no domain
// type at all, and a source sweep proves that in every later plan of this
// phase; importing the column array into that directory would fail the proof
// the phase rests on. Consolidating this file back into its sibling looks like
// tidying and is the defect.
//
// It must not be named as a test file either, for the two reasons recorded at
// the head of that sibling: the runner would collect it and fail it for
// declaring no suite, and the type-declaration suffix falls outside the
// coverage exclude glob.

import type {
  Equal,
  Expect,
  IsAny,
  Not,
} from "../../components/DataTable/columnTypes";
import type { CityColumnId } from "./cityColumns";

/**
 * The five ids exactly, with nothing widened and nothing missing. Dropping one
 * of the literals below fails `npm run typecheck`, which is what says the
 * assertion is live rather than vacuous.
 */
export type AssertCityColumnIds = Expect<
  Equal<
    CityColumnId,
    "name" | "country" | "capital" | "countryIso3" | "population"
  >
>;

export type AssertCityColumnIdIsNotAny = Expect<Not<IsAny<CityColumnId>>>;

/**
 * The failure that looks like success: inference collapsing to the whole string
 * type still compiles everywhere a column id is used, and silently costs every
 * renamed column its compile error.
 */
export type AssertCityColumnIdIsNotString = Expect<
  Not<Equal<CityColumnId, string>>
>;
