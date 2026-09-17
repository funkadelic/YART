import type { Column } from "./column";
import { rowComparator } from "./sortRows";

/** Rows per run sorted natively before the merge passes begin. */
const RUN_LENGTH = 1024;

/** Merged elements between checks of the slice deadline. */
const MERGE_STEP = 512;

/** Main-thread time a slice may take before it yields to input and paint. */
const SLICE_MS = 8;

/**
 * Merges the sorted ranges [left, middle) and [middle, end) of source into
 * target, yielding every MERGE_STEP merged elements.
 */
function* mergePair<T>(
  source: readonly T[],
  target: T[],
  bounds: { left: number; middle: number; end: number },
  compare: (a: T, b: T) => number,
): Generator<void, void, void> {
  const { middle, end } = bounds;
  let i = bounds.left;
  let j = middle;
  let out = bounds.left;

  // Index reads use `as T`: every index read is inside the loop bounds.
  while (i < middle && j < end) {
    target[out++] =
      compare(source[i] as T, source[j] as T) <= 0
        ? (source[i++] as T)
        : (source[j++] as T);
    if ((out - bounds.left) % MERGE_STEP === 0) yield;
  }
  while (i < middle) target[out++] = source[i++] as T;
  while (j < end) target[out++] = source[j++] as T;
}

/**
 * Bottom-up merge sort over a copy, yielding after each run and every
 * MERGE_STEP merged elements. Returns the sorted buffer.
 */
function* mergeSort<T>(
  rows: readonly T[],
  compare: (a: T, b: T) => number,
  runLength: number,
): Generator<void, T[], void> {
  const length = rows.length;
  let source = [...rows];
  let target = new Array<T>(length);

  for (let start = 0; start < length; start += runLength) {
    const run = source.slice(start, start + runLength).sort(compare);
    source.splice(start, run.length, ...run);
    yield;
  }

  for (let width = runLength; width < length; width *= 2) {
    for (let left = 0; left < length; left += 2 * width) {
      const middle = Math.min(left + width, length);
      const end = Math.min(left + 2 * width, length);
      yield* mergePair(source, target, { left, middle, end }, compare);
    }
    [source, target] = [target, source];
  }

  return source;
}

/**
 * Hands the main thread back for input and paint.
 *
 * ponytail: the fallback pays the 4 ms nested-timer clamp in browsers without
 * scheduler.yield; a MessageChannel yield avoids it if that matters.
 */
function yieldToMain(): Promise<void> {
  // Chromium 94 to 128 has scheduler without yield, so test the method.
  if (typeof globalThis.scheduler?.yield === "function") {
    return scheduler.yield();
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * The order `sortRows` gives, computed in slices of about SLICE_MS so a large
 * sort never blocks a frame. Resolves undefined when cancelled at a yield.
 * `runLength` exists so tests reach the merge passes with small inputs.
 */
export async function sortRowsSliced<T, Id extends string>(
  rows: readonly T[],
  column: Column<T, Id>,
  direction: "asc" | "desc",
  getRowId: (row: T) => string,
  isCancelled: () => boolean,
  runLength = RUN_LENGTH,
): Promise<readonly T[] | undefined> {
  const steps = mergeSort(
    rows,
    rowComparator(column, direction, getRowId),
    runLength,
  );
  let deadline = performance.now() + SLICE_MS;

  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;

    if (performance.now() >= deadline) {
      await yieldToMain();
      if (isCancelled()) return undefined;
      deadline = performance.now() + SLICE_MS;
    }
  }
}
