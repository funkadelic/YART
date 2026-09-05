// This file names both domain row types, so it sits beside the module it
// asserts about rather than in either feature directory. Asserting it from
// inside one of them would make that feature the owner of a claim about both.
//
// The suffix is the runner's own convention for a type-level test, compiled by
// `npm run typecheck` and collected as a suite by nothing.

import type { City } from "./api/getCities";
import type { Film } from "./api/getFilms";
import type { AppState, INITIAL_APP_STATE } from "./appState";
import type { Expect } from "./components/DataTable/column.test-d";

/**
 * What the type parameter is for: one initial value fits a request state over
 * either row type. A change pinning it back to a concrete row would fail here
 * at compile time rather than at whichever call site noticed first.
 */
export type AssertInitialStateFitsCities = Expect<
  typeof INITIAL_APP_STATE extends AppState<City> ? true : false
>;

export type AssertInitialStateFitsFilms = Expect<
  typeof INITIAL_APP_STATE extends AppState<Film> ? true : false
>;
