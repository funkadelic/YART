// The suffix is the runner's own convention for a type-level test. `npm run
// typecheck` compiles it and no suite runs it.

import type { Equal, Expect } from "../components/DataTable/column.test-d";
import type { City, getCities } from "./getCities";
import type { Film, getFilms } from "./getFilms";

/** Both seams hand out the shared cache, so neither result may be mutable. */
export type AssertCitiesReadonly = Expect<
  Equal<Awaited<ReturnType<typeof getCities>>, readonly City[]>
>;
export type AssertFilmsReadonly = Expect<
  Equal<Awaited<ReturnType<typeof getFilms>>, readonly Film[]>
>;
