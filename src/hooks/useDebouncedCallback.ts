import { useCallback, useEffect, useRef } from "react";

/**
 * Debounces a call rather than a value: the returned function schedules the
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
 * in flight when the component tears down never lands.
 *
 * The callback is read out of a ref when the timer fires rather than closed
 * over when the call was scheduled, so a pending call always runs the current
 * implementation instead of the one that happened to be current a moment
 * earlier. That is also what lets the returned function be memoized over the
 * delay alone: it holds one identity for the life of the component whatever the
 * caller does with its own, so an inline arrow is as safe here as a memoized
 * callback rather than being a stale-closure trap the types cannot catch.
 */
export function useDebouncedCallback<A extends unknown[]>(
  callback: (...args: A) => void,
  delay: number,
): (...args: A) => void {
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

  return useCallback(
    (...args: A) => {
      clearTimeout(pending.current);
      pending.current = setTimeout(() => {
        latest.current(...args);
      }, delay);
    },
    [delay],
  );
}
