// The view state reducer and the address it is written to.

import { withCodSpeed } from "@codspeed/tinybench-plugin";
import { Bench } from "tinybench";

import {
  DEFAULT_TABLE_STATE,
  applyTableAction,
  type TableAction,
  type TableState,
} from "../src/components/DataTable/tableState";
import {
  parseSearchTerm,
  parseTableState,
  serializeTableState,
} from "../src/components/DataTable/tableStateUrl";
import {
  CITY_COLUMN_IDS,
  type CityColumnId,
} from "../src/features/CityTable/cityColumns";
import { ROUNDS, report, rounds } from "./harness";

const INITIAL: TableState<CityColumnId> = DEFAULT_TABLE_STATE;

/** One session: a term typed per character, a full sort cycle, a size change and page presses. */
const SESSION: readonly TableAction<CityColumnId>[] = [
  ...Array.from({ length: 12 }, (_, at): TableAction<CityColumnId> => {
    return { type: "query", query: "san francisco".slice(0, at + 1) };
  }),
  { type: "sort", columnId: "name" },
  { type: "sort", columnId: "name" },
  { type: "sort", columnId: "name" },
  { type: "sort", columnId: "population" },
  { type: "pageSize", pageSize: 100 },
  ...Array.from({ length: 25 }, (_, at): TableAction<CityColumnId> => {
    return { type: "page", page: at + 1 };
  }),
  // Unchanged term, which the reducer returns as the same state.
  { type: "query", query: "san francisco" },
];

/** The default view, a full one, an invalid one, and one with params the app does not own. */
const ADDRESSES = [
  "",
  "?q=tokyo&sort=-population&page=4&size=25",
  "?q=&sort=nonsense&page=0&size=7",
  "?utm_source=newsletter&sort=name&gclid=abc123&page=2",
];

const SETTLED: TableState<CityColumnId> = {
  sortColumnId: "population",
  sortDirection: "desc",
  page: 4,
  pageSize: 25,
  query: "  san francisco  ",
  hasSorted: true,
};

const bench = withCodSpeed(new Bench());

bench
  .add(`apply a ${SESSION.length}-action session, ${ROUNDS} rounds`, () => {
    rounds(() => {
      let state = INITIAL;
      for (const action of SESSION) {
        state = applyTableAction(state, action);
      }
    });
  })
  .add(`parse four addresses into view state, ${ROUNDS} rounds`, () => {
    rounds(() => {
      for (const address of ADDRESSES) {
        parseTableState(address, CITY_COLUMN_IDS);
      }
    });
  })
  .add(`parse the term out of four addresses, ${ROUNDS} rounds`, () => {
    rounds(() => {
      for (const address of ADDRESSES) {
        parseSearchTerm(address);
      }
    });
  })
  .add(`serialize a settled view over four addresses, ${ROUNDS} rounds`, () => {
    rounds(() => {
      for (const address of ADDRESSES) {
        serializeTableState(SETTLED, address);
      }
    });
  })
  // One page press: the state moves and its address is written.
  .add(`move a page and write its address, ${ROUNDS} rounds`, () => {
    rounds(() => {
      const next = applyTableAction(SETTLED, { type: "page", page: 5 });
      serializeTableState(next, "?utm_source=newsletter");
    });
  });

await bench.run();
report(bench);
