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
 * in flight when the component tears down never lands. The returned function is
 * memoized over the callback and the delay, so a caller that memoizes its
 * callback holds one identity for the life of the component.
 */
export function useDebouncedCallback<A extends unknown[]>(
  callback: (...args: A) => void,
  delay: number,
): (...args: A) => void {
  const pending = useRef<ReturnType<typeof setTimeout>>(undefined);

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
        callback(...args);
      }, delay);
    },
    [callback, delay],
  );
}
