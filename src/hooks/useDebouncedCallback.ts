import { useCallback, useEffect, useMemo, useRef } from "react";

/** A debounced call, plus the means to drop one that is already pending. */
export interface DebouncedCallback<A extends unknown[]> {
  readonly schedule: (...args: A) => void;
  readonly cancel: () => void;
}

/**
 * Debounces a call rather than a value, and reads the callback from a ref when
 * the timer fires, which is what makes an inline arrow safe to pass.
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
        // Dropped as it fires: a handle the platform has already retired must
        // not be clearable a second time.
        pending.current = undefined;
        latest.current(...args);
      }, delay);
    },
    [delay],
  );

  // The handle is dropped as well as cleared, so a second cancel clears nothing
  // rather than an identifier the platform has since reissued.
  const cancel = useCallback(() => {
    clearTimeout(pending.current);
    pending.current = undefined;
  }, []);

  return useMemo(() => ({ schedule, cancel }), [schedule, cancel]);
}
