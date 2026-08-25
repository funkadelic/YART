import { useCallback, useEffect, useMemo, useRef } from "react";

/**
 * A debounced call and the means to drop one that is already pending.
 *
 * Two named members rather than a cancel hung on the scheduler: attaching one
 * means mutating a memoized function during render, which is the shape this
 * project's lint gate rejects. Both members are stable, so a caller that
 * destructures the pair can put either in a dependency array; the wrapper is
 * memoized too, for a caller that holds it whole.
 */
export interface DebouncedCallback<A extends unknown[]> {
  readonly schedule: (...args: A) => void;
  readonly cancel: () => void;
}

/**
 * Debounces a call rather than a value: the scheduler it returns schedules the
 * callback and reschedules it on every further call, so a burst of calls
 * settles into one invocation carrying the arguments of the last.
 *
 * Debouncing the call is what keeps this usable from an event handler. A
 * debounced value has to be turned into a state write or a callback somewhere,
 * and the only place left for that is an effect, which is the shape this
 * project's lint gate now rejects. Scheduling inside the handler makes the
 * commit an ordinary event-driven write instead.
 *
 * The pending handle lives in a ref and is cleared on unmount, so a call still
 * in flight when the component tears down never lands. The cancel covers the
 * case that is not a teardown: a caller that has just replaced the state a
 * pending call was made against needs to drop that call, and without a cancel
 * its only alternative is to let the stale value land on top of the new one.
 *
 * The callback is read out of a ref when the timer fires rather than closed
 * over when the call was scheduled, so a pending call always runs the current
 * implementation instead of the one that happened to be current a moment
 * earlier. That is also what lets the scheduler be memoized over the delay
 * alone: it holds one identity for the life of the component whatever the
 * caller does with its own, so an inline arrow is as safe here as a memoized
 * callback rather than being a stale-closure trap the types cannot catch.
 */
export function useDebouncedCallback<A extends unknown[]>(
  callback: (...args: A) => void,
  delay: number,
): DebouncedCallback<A> {
  const pending = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(callback);

  // Written after the render commits rather than during it, so a render React
  // discards cannot leave this pointing at a callback that never took effect.
  useEffect(() => {
    latest.current = callback;
  });

  useEffect(
    () => () => {
      clearTimeout(pending.current);
    },
    [],
  );

  const schedule = useCallback(
    (...args: A) => {
      clearTimeout(pending.current);
      pending.current = setTimeout(() => {
        latest.current(...args);
      }, delay);
    },
    [delay],
  );

  // The handle is dropped as well as cleared, so a cancel followed by another
  // cancel clears nothing rather than an identifier the platform has since
  // handed to someone else's timer.
  const cancel = useCallback(() => {
    clearTimeout(pending.current);
    pending.current = undefined;
  }, []);

  return useMemo(() => ({ schedule, cancel }), [schedule, cancel]);
}
