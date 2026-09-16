// Paging, which runs after every sort, every search and every page press. One
// call is a clamp and a slice, so the benchmarks below walk a whole result set
// rather than reading one page: a reader paging through a dataset pays this
// once per press, and a run of presses is what makes the cost visible.

import { withCodSpeed } from "@codspeed/tinybench-plugin";
import { Bench } from "tinybench";

import { paginate } from "../src/components/paginate";
import { cityRows } from "./fixtures";
import { ROUNDS, report, rounds } from "./harness";

/** The whole city asset's order of magnitude, which is what an empty search shows. */
const ROWS = 50_000;

const rows = cityRows(ROWS);

/** Reads every page at one size, the way paging to the end of a result set does. */
function walk(pageSize: number): void {
  const pages = Math.ceil(rows.length / pageSize);
  for (let page = 1; page <= pages; page += 1) {
    paginate(rows, page, pageSize);
  }
}

const bench = withCodSpeed(new Bench());

bench
  // The default size, so the walk is five thousand slices of ten.
  .add(`walk every page of ${ROWS} rows at 10 a page`, () => {
    walk(10);
  })
  // The largest size the control offers: a tenth of the presses, ten times the
  // rows copied out on each one.
  .add(`walk every page of ${ROWS} rows at 100 a page`, () => {
    walk(100);
  })
  // The single read a first render performs, which is the one call a reader
  // waits on before anything is painted.
  .add(`read the first page of ${ROWS} rows, ${ROUNDS} rounds`, () => {
    rounds(() => {
      paginate(rows, 1, 10);
    });
  })
  // The far end of the same set. The clamp is what a position beyond the last
  // page passes through, and a shared link can carry one.
  .add(`read a page past the end of ${ROWS} rows, ${ROUNDS} rounds`, () => {
    rounds(() => {
      paginate(rows, 10_000_000, 10);
    });
  });

await bench.run();
report(bench);
