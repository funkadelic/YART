import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDebounce } from "./useDebounce";

const DELAY = 150;

// Well below the whole suite's wall clock bound, so a frozen clock that the
// hook never escapes reports as a fast failure instead of a stalled run.
const CASE_TIMEOUT_MS = 5000;

/**
 * Renders the hook while recording the value it returns on every render, so a
 * case can assert how many times the value actually changed rather than only
 * what it settled on. No user input library is constructed in this file: the
 * fake clock is deliberately isolated from the library that deadlocks against
 * it, so a failure here points at the timer setup and nothing else.
 */
function renderDebounce(initialValue: string, initialDelay: number = DELAY) {
  const seen: string[] = [];

  const view = renderHook(
    ({ value, delay }: { value: string; delay: number }) => {
      const debounced = useDebounce(value, delay);
      seen.push(debounced);
      return debounced;
    },
    { initialProps: { value: initialValue, delay: initialDelay } },
  );

  return { ...view, seen };
}

/**
 * The values the hook emitted, meaning every render where the returned value
 * differed from the previous render's.
 */
function emissions(seen: string[]): string[] {
  return seen.filter((value, index) => index > 0 && value !== seen[index - 1]);
}

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it(
    "returns the initial value on the first render, before any time passes",
    () => {
      const { result } = renderDebounce("first");

      expect(result.current).toBe("first");
    },
    CASE_TIMEOUT_MS,
  );

  it(
    "keeps returning the previous value until the delay elapses",
    () => {
      const { result, rerender } = renderDebounce("first");

      rerender({ value: "second", delay: DELAY });
      act(() => {
        vi.advanceTimersByTime(DELAY - 1);
      });

      expect(result.current).toBe("first");
    },
    CASE_TIMEOUT_MS,
  );

  it(
    "emits the new value once the full delay elapses",
    () => {
      const { result, rerender, seen } = renderDebounce("first");

      rerender({ value: "second", delay: DELAY });
      act(() => {
        vi.advanceTimersByTime(DELAY);
      });

      expect(result.current).toBe("second");
      expect(emissions(seen)).toEqual(["second"]);
    },
    CASE_TIMEOUT_MS,
  );

  it(
    "emits only the last value from a burst of changes inside one delay window",
    () => {
      const { result, rerender, seen } = renderDebounce("first");

      for (const value of ["a", "b", "c", "last"]) {
        rerender({ value, delay: DELAY });
        act(() => {
          vi.advanceTimersByTime(DELAY - 50);
        });
      }

      // Nothing has landed yet: each change cleared the timer the previous one
      // scheduled, so the pending timeout never reached its boundary.
      expect(emissions(seen)).toEqual([]);

      act(() => {
        vi.advanceTimersByTime(DELAY);
      });

      expect(emissions(seen)).toEqual(["last"]);
      expect(result.current).toBe("last");
    },
    CASE_TIMEOUT_MS,
  );

  it(
    "reschedules against the new delay when the delay changes mid-flight",
    () => {
      const longerDelay = 400;
      const { result, rerender } = renderDebounce("first");

      rerender({ value: "second", delay: DELAY });
      act(() => {
        vi.advanceTimersByTime(100);
      });

      rerender({ value: "second", delay: longerDelay });

      // The old boundary comes and goes without an emission, because changing
      // the delay cleared the pending timer and scheduled a fresh one.
      act(() => {
        vi.advanceTimersByTime(DELAY - 100);
      });
      expect(result.current).toBe("first");

      act(() => {
        vi.advanceTimersByTime(longerDelay - (DELAY - 100));
      });
      expect(result.current).toBe("second");
    },
    CASE_TIMEOUT_MS,
  );

  it(
    "emits nothing after unmounting with a timer still pending",
    () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      try {
        const { result, rerender, unmount, seen } = renderDebounce("first");

        rerender({ value: "second", delay: DELAY });
        act(() => {
          vi.advanceTimersByTime(DELAY - 50);
        });

        unmount();
        act(() => {
          vi.advanceTimersByTime(DELAY * 2);
        });

        expect(result.current).toBe("first");
        expect(emissions(seen)).toEqual([]);
        expect(consoleError).not.toHaveBeenCalled();
      } finally {
        consoleError.mockRestore();
      }
    },
    CASE_TIMEOUT_MS,
  );
});
