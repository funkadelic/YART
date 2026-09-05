/**
 * Everything the container remembers about the collection it is fetching. One
 * object, because the effect moves several of these together. Generic over the
 * row type, so a second container reuses it rather than copying it.
 */
export interface AppState<T> {
  readonly rows: readonly T[];
  readonly error: Error | null;
  readonly loading: boolean;
  /** Whether the collection has arrived once, which loading cannot say. */
  readonly datasetReady: boolean;
  /** Incremented by the retry control and listed as an effect dependency. */
  readonly retryAttempt: number;
}

/**
 * The five things that happen to a request. Settling is its own action, because
 * folding it in would leave the no-permanent-spinner guarantee resting on two
 * branches agreeing forever.
 */
export type AppAction<T> =
  | { readonly type: "attempt" }
  | { readonly type: "resolved"; readonly rows: readonly T[] }
  | { readonly type: "failed"; readonly error: Error }
  | { readonly type: "settled" }
  | { readonly type: "retry" };

/**
 * Where the container starts: mounted, with its effect not yet run. Typed over
 * no row at all, so it fits a state over any row type without a cast.
 */
export const INITIAL_APP_STATE: AppState<never> = {
  rows: [],
  error: null,
  loading: false,
  datasetReady: false,
  retryAttempt: 0,
};

/** The only thing that moves the container from one request state to the next. */
export function applyAppAction<T>(
  state: AppState<T>,
  action: AppAction<T>,
): AppState<T> {
  switch (action.type) {
    case "attempt":
      // Clear the last failure as the new attempt starts, so a retry does not
      // leave the old error on screen beside the new load.
      return { ...state, error: null, loading: true };
    case "resolved":
      return {
        ...state,
        rows: action.rows,
        error: null,
        datasetReady: true,
      };
    case "failed":
      // The rows on screen stay correct until something replaces them, so a
      // failure paints beside them rather than emptying the table.
      return { ...state, error: action.error };
    case "settled":
      return { ...state, loading: false };
    case "retry":
      return { ...state, retryAttempt: state.retryAttempt + 1 };
  }
}
