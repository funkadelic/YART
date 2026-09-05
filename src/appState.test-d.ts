// This file names both domain row types, so it sits beside the module it
// asserts about. Inside either feature directory it would make that feature the
// owner of a claim about both.
//
// The suffix is the runner's own convention for a type-level test. `npm run
// typecheck` compiles it and no suite runs it.

import type { City } from "./api/getCities";
import type { Film } from "./api/getFilms";
import type { AppState, INITIAL_APP_STATE } from "./appState";
import type { Expect } from "./components/DataTable/column.test-d";

/**
 * The type parameter lets one initial value fit a request state over either row
 * type. Pinning it back to a concrete row fails here at compile time, before
 * any call site sees it.
 */
export type AssertInitialStateFitsCities = Expect<
  typeof INITIAL_APP_STATE extends AppState<City> ? true : false
>;

export type AssertInitialStateFitsFilms = Expect<
  typeof INITIAL_APP_STATE extends AppState<Film> ? true : false
>;
