// Shared by every suite.

import type { Bench } from "tinybench";

/** Repeats for calls costing microseconds, which would otherwise sit in instrumentation noise. */
export const ROUNDS = 100;

/** Runs one round's work ROUNDS times. */
export function rounds(run: () => void): void {
  for (let round = 0; round < ROUNDS; round += 1) {
    run();
  }
}

/** Prints the local results table; under CodSpeed there are no results, so nothing prints. */
export function report(bench: Bench): void {
  if (bench.tasks.every((task) => task.result === undefined)) return;

  console.table(bench.table());
}
