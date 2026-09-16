// The view state and the address it is written to. Every keystroke that
// survives the debounce, every header press and every page press goes through
// the reducer and then through the serializer, so both run on the interaction
// path rather than on a load.

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

/** The state a table starts from, typed over the city table's own ids. */
const INITIAL: TableState<CityColumnId> = DEFAULT_TABLE_STATE;

/**
 * One reader's session: a term typed a character at a time, a column sorted
 * through its whole cycle, a page size change and a run of page presses. The
 * reducer sees each of these as a separate action, so a session is what its
 * cost is paid over.
 */
const SESSION: readonly TableAction<CityColumnId>[] = [
  ...Array.from({ length: 12 }, (_, at): TableAction<CityColumnId> => {
    return { type: "query", query: "san francisco".slice(0, at + 1) };
  }),
  // The cycle: ascending, descending, cleared, and a second column on top.
  { type: "sort", columnId: "name" },
  { type: "sort", columnId: "name" },
  { type: "sort", columnId: "name" },
  { type: "sort", columnId: "population" },
  { type: "pageSize", pageSize: 100 },
  ...Array.from({ length: 25 }, (_, at): TableAction<CityColumnId> => {
    return { type: "page", page: at + 1 };
  }),
  // A term retyped at its current value, which the debounce commits and the
  // reducer answers with the state it was handed.
  { type: "query", query: "san francisco" },
];

/**
 * The addresses the parser is held against: the plain view, a full one, one
 * whose every value is invalid, and one carrying parameters this app does not
 * own. Each falls down a different arm, and a reader arrives on any of them
 * from a shared link.
 */
const ADDRESSES = [
  "",
  "?q=tokyo&sort=-population&page=4&size=25",
  "?q=&sort=nonsense&page=0&size=7",
  "?utm_source=newsletter&sort=name&gclid=abc123&page=2",
];

/** A settled view, which is what the container writes back on every change. */
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
  // The read a shared link performs before the first render, over every shape
  // of address.
  .add(`parse four addresses into view state, ${ROUNDS} rounds`, () => {
    rounds(() => {
      for (const address of ADDRESSES) {
        parseTableState(address, CITY_COLUMN_IDS);
      }
    });
  })
  // The container's own narrower read, which takes the term and nothing else.
  .add(`parse the term out of four addresses, ${ROUNDS} rounds`, () => {
    rounds(() => {
      for (const address of ADDRESSES) {
        parseSearchTerm(address);
      }
    });
  })
  // The write, which has to preserve every parameter the app does not own, so
  // the incoming query is walked as well as the schema.
  .add(`serialize a settled view over four addresses, ${ROUNDS} rounds`, () => {
    rounds(() => {
      for (const address of ADDRESSES) {
        serializeTableState(SETTLED, address);
      }
    });
  })
  // Reducer and address together, which is what one page press actually costs:
  // the state moves and the new address is written from it.
  .add(`move a page and write its address, ${ROUNDS} rounds`, () => {
    rounds(() => {
      const next = applyTableAction(SETTLED, { type: "page", page: 5 });
      serializeTableState(next, "?utm_source=newsletter");
    });
  });

await bench.run();
report(bench);
