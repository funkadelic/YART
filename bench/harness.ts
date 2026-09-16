// What every suite in this directory shares: the repeat count the small
// measurements need, and the local report.

import type { Bench } from "tinybench";

/**
 * Some of the calls measured here cost a few microseconds: an address parse, a
 * label build, one pass of the reducer. A measurement that small sits close to
 * the floor of what an instrumented run can tell apart from its own overhead,
 * and the difference a change makes to it would be reported as noise.
 *
 * So the small suites measure a run of the same work rather than one call. The
 * count is shared and named here, because a number chosen per benchmark would
 * leave two of them incomparable for a reason nothing records.
 */
export const ROUNDS = 100;

/** Runs one round's work ROUNDS times. */
export function rounds(run: () => void): void {
  for (let round = 0; round < ROUNDS; round += 1) {
    run();
  }
}

/**
 * The table a local run prints.
 *
 * Under CodSpeed the plugin replaces the runner: each task is measured once,
 * by instrumentation, and no tinybench result is recorded for it. The table
 * would be a column of nulls there, and the runner prints its own, so the
 * results are what decides whether this prints at all.
 */
export function report(bench: Bench): void {
  if (bench.tasks.every((task) => task.result === undefined)) return;

  console.table(bench.table());
}
