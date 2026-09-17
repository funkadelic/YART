// The page slice, walked across a whole result set so the cost is measurable.

import { withCodSpeed } from "@codspeed/tinybench-plugin";
import { Bench } from "tinybench";

import { paginate } from "../src/components/paginate";
import { cityRows } from "./fixtures";
import { ROUNDS, report, rounds } from "./harness";

/** The city dataset's full size, which an empty search shows. */
const ROWS = 50_250;

const rows = cityRows(ROWS);

/** Reads every page at one size. */
function walk(pageSize: number): void {
  const pages = Math.ceil(rows.length / pageSize);
  for (let page = 1; page <= pages; page += 1) {
    paginate(rows, page, pageSize);
  }
}

const bench = withCodSpeed(new Bench());

bench
  .add(`walk every page of ${ROWS} rows at 10 a page`, () => {
    walk(10);
  })
  .add(`walk every page of ${ROWS} rows at 100 a page`, () => {
    walk(100);
  })
  .add(`read the first page of ${ROWS} rows, ${ROUNDS} rounds`, () => {
    rounds(() => {
      paginate(rows, 1, 10);
    });
  })
  // A shared link can carry a page past the end, which goes through the clamp.
  .add(`read a page past the end of ${ROWS} rows, ${ROUNDS} rounds`, () => {
    rounds(() => {
      paginate(rows, 10_000_000, 10);
    });
  });

await bench.run();
report(bench);
