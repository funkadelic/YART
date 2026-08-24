import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDebouncedCallback } from "./useDebouncedCallback";

const DELAY = 150;

// Well below the whole suite's wall clock bound, so a frozen clock that the
// hook never escapes reports as a fast failure instead of a stalled run.
const CASE_TIMEOUT_MS = 5000;

type Commit = (term: string) => void;

/**
 * Renders the hook over a recording callback, handing back the debounced
 * function of the latest render alongside the recorder, so a case can assert
 * how many times the call actually landed rather than only what it landed
 * with. No user input library is constructed in this file: the controlled
 * clock is deliberately isolated from the library that deadlocks against it,
 * so a failure here points at the timer setup and nothing else.
 */
function renderDebouncedCallback(initialDelay: number = DELAY) {
  const commit = vi.fn<Commit>();

  const view = renderHook(
    ({ callback, delay }: { callback: Commit; delay: number }) =>
      useDebouncedCallback(callback, delay),
    { initialProps: { callback: commit, delay: initialDelay } },
  );

  return { ...view, commit };
}

describe("useDebouncedCallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it(
    "schedules the call rather than running it synchronously",
    () => {
      const { result, commit } = renderDebouncedCallback();

      result.current("tok");

      expect(commit).not.toHaveBeenCalled();
    },
    CASE_TIMEOUT_MS,
  );

  it(
    "runs the callback with the scheduling call's arguments once the delay elapses",
    () => {
      const { result, commit } = renderDebouncedCallback();

      result.current("tok");
      vi.advanceTimersByTime(DELAY - 1);
      expect(commit).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);

      expect(commit).toHaveBeenCalledTimes(1);
      expect(commit).toHaveBeenCalledWith("tok");
    },
    CASE_TIMEOUT_MS,
  );

  it(
    "collapses a burst of calls into one invocation carrying the last arguments",
    () => {
      const { result, commit } = renderDebouncedCallback();

      for (const term of ["t", "to", "tok", "toky"]) {
        result.current(term);
        vi.advanceTimersByTime(DELAY - 50);
      }

      // Nothing has landed yet: each call cleared the timer the previous one
      // scheduled, so the pending timeout never reached its boundary.
      expect(commit).not.toHaveBeenCalled();

      vi.advanceTimersByTime(DELAY);

      expect(commit).toHaveBeenCalledTimes(1);
      expect(commit).toHaveBeenCalledWith("toky");
    },
    CASE_TIMEOUT_MS,
  );

  it(
    "never runs the callback when the component unmounts with a call pending",
    () => {
      const { result, unmount, commit } = renderDebouncedCallback();

      result.current("tok");
      vi.advanceTimersByTime(DELAY - 50);

      unmount();
      vi.advanceTimersByTime(DELAY * 2);

      expect(commit).not.toHaveBeenCalled();
    },
    CASE_TIMEOUT_MS,
  );

  it(
    "schedules against the new delay once the delay changes",
    () => {
      const longerDelay = 400;
      const { result, rerender, commit } = renderDebouncedCallback();

      rerender({ callback: commit, delay: longerDelay });
      result.current("tok");

      // The old boundary comes and goes without an invocation, because the
      // call was scheduled against the delay of the render that produced it.
      vi.advanceTimersByTime(DELAY);
      expect(commit).not.toHaveBeenCalled();

      vi.advanceTimersByTime(longerDelay - DELAY);

      expect(commit).toHaveBeenCalledWith("tok");
    },
    CASE_TIMEOUT_MS,
  );

  it(
    "keeps one identity across renders while the callback and the delay are unchanged",
    () => {
      const { result, rerender, commit } = renderDebouncedCallback();
      const first = result.current;

      rerender({ callback: commit, delay: DELAY });
      expect(result.current).toBe(first);

      rerender({ callback: vi.fn<Commit>(), delay: DELAY });
      expect(result.current).not.toBe(first);
    },
    CASE_TIMEOUT_MS,
  );
});
