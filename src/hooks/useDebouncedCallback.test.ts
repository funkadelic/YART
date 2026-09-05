import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDebouncedCallback } from "./useDebouncedCallback";

const DELAY = 150;

// Well below the whole suite's wall clock bound, so a frozen clock that the
// hook never escapes reports as a fast failure instead of a stalled run.
const CASE_TIMEOUT_MS = 5000;

type Commit = (term: string) => void;

/**
 * Renders the hook over a recording callback, handing back the scheduler and
 * cancel of the latest render alongside the recorder, so a case can assert how
 * many times the call actually landed and not only what it landed with. No
 * user input library is constructed in this file, because the controlled clock
 * is deliberately isolated from the library that deadlocks against it, so a
 * failure here points at the timer setup and nothing else.
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

      result.current.schedule("tok");

      expect(commit).not.toHaveBeenCalled();
    },
    CASE_TIMEOUT_MS,
  );

  it(
    "runs the callback with the scheduling call's arguments once the delay elapses",
    () => {
      const { result, commit } = renderDebouncedCallback();

      result.current.schedule("tok");
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
        result.current.schedule(term);
        vi.advanceTimersByTime(DELAY - 50);
      }

      // Nothing has landed yet, because each call cleared the timer the
      // previous one scheduled and the pending timeout never reached its
      // boundary.
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

      result.current.schedule("tok");
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
      result.current.schedule("tok");

      // The old boundary comes and goes without an invocation, because the
      // call was scheduled against the delay of the render that produced it.
      vi.advanceTimersByTime(DELAY);
      expect(commit).not.toHaveBeenCalled();

      vi.advanceTimersByTime(longerDelay - DELAY);

      expect(commit).toHaveBeenCalledWith("tok");
    },
    CASE_TIMEOUT_MS,
  );

  // A pending call stops being wanted for reasons other than unmount. A caller
  // that has just replaced the state the call was typed against needs to drop
  // it, and without this its only alternative is to let the stale value land on
  // top of the new one.
  it(
    "never runs a call the caller cancelled",
    () => {
      const { result, commit } = renderDebouncedCallback();

      result.current.schedule("tok");
      vi.advanceTimersByTime(DELAY - 50);

      result.current.cancel();
      vi.advanceTimersByTime(DELAY * 2);

      expect(commit).not.toHaveBeenCalled();
    },
    CASE_TIMEOUT_MS,
  );

  it(
    "schedules normally again after a cancel",
    () => {
      const { result, commit } = renderDebouncedCallback();

      result.current.schedule("tok");
      result.current.cancel();
      result.current.schedule("kyo");
      vi.advanceTimersByTime(DELAY);

      expect(commit).toHaveBeenCalledTimes(1);
      expect(commit).toHaveBeenCalledWith("kyo");
    },
    CASE_TIMEOUT_MS,
  );

  // The handle is retired by a call that lands just as surely as by a cancel,
  // so the drop belongs in both places. The path is live in the application: a
  // search commits, a traversal follows, and the traversal cancels a commit
  // that is no longer pending. What the platform is handed is asserted
  // directly, because the handle itself is deliberately not observable and a
  // case that only re-scheduled afterwards would pass either way.
  it(
    "hands the platform nothing when a cancel follows a call that already landed",
    () => {
      const { result, commit } = renderDebouncedCallback();

      result.current.schedule("tok");
      vi.advanceTimersByTime(DELAY);
      expect(commit).toHaveBeenCalledTimes(1);

      const clear = vi.spyOn(globalThis, "clearTimeout");
      try {
        result.current.cancel();

        expect(clear).toHaveBeenCalledWith(undefined);
      } finally {
        // Restored inside the case, because the shared teardown runs after
        // this file has put the real clock back and would therefore reinstall
        // the controlled clock's own function.
        clear.mockRestore();
      }

      result.current.schedule("kyo");
      vi.advanceTimersByTime(DELAY);

      expect(commit).toHaveBeenCalledTimes(2);
      expect(commit).toHaveBeenLastCalledWith("kyo");
    },
    CASE_TIMEOUT_MS,
  );

  it(
    "clears nothing when there is nothing pending to cancel",
    () => {
      const { result, commit } = renderDebouncedCallback();

      result.current.cancel();
      result.current.cancel();
      vi.advanceTimersByTime(DELAY * 2);

      expect(commit).not.toHaveBeenCalled();
    },
    CASE_TIMEOUT_MS,
  );

  // The case the hook exists to make impossible to get wrong. A caller handing
  // over a fresh callback on every render, as an inline arrow does, used to have
  // its pending call run the closure of the render that scheduled it, with
  // current arguments and a stale implementation.
  it(
    "runs the callback of the latest render rather than the one current when the call was scheduled",
    () => {
      const { result, rerender, commit } = renderDebouncedCallback();
      const replacement = vi.fn<Commit>();

      result.current.schedule("tok");
      rerender({ callback: replacement, delay: DELAY });
      vi.advanceTimersByTime(DELAY);

      expect(commit).not.toHaveBeenCalled();
      expect(replacement).toHaveBeenCalledTimes(1);
      expect(replacement).toHaveBeenCalledWith("tok");
    },
    CASE_TIMEOUT_MS,
  );

  it(
    "keeps one identity across renders whatever the caller does with its callback",
    () => {
      const { result, rerender, commit } = renderDebouncedCallback();
      const first = result.current.schedule;

      rerender({ callback: commit, delay: DELAY });
      expect(result.current.schedule).toBe(first);

      // Nothing about the callback reaches the memo, because the callback is
      // read out of a ref at fire time and never captured. The identity the
      // caller holds is a guarantee, not an argument about how some component
      // two layers up wrote its own memo.
      rerender({ callback: vi.fn<Commit>(), delay: DELAY });
      expect(result.current.schedule).toBe(first);

      // The delay does reach it, because a scheduling call has to read the
      // window the current render states.
      rerender({ callback: commit, delay: 400 });
      expect(result.current.schedule).not.toBe(first);
    },
    CASE_TIMEOUT_MS,
  );
});
