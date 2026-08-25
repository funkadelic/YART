import type { City } from "./api/getCities";

/**
 * Everything the container remembers about the collection it is fetching, in
 * one object.
 *
 * It is one object rather than five values because the fetch effect moves
 * several of them together: an attempt raises the loading flag and clears the
 * previous failure at the same instant, and separate writes are separate
 * chances to tear.
 */
export interface AppState {
  readonly cities: City[];
  readonly error: Error | null;
  readonly loading: boolean;
  /**
   * The loading flag is also true for a refetch that follows an empty result
   * set, so on its own it cannot say whether the wait is a download or a
   * search. This records the one fact it cannot carry: whether the collection
   * has arrived at least once.
   */
  readonly datasetReady: boolean;
  /**
   * The retry control increments this, and the effect lists it as a dependency,
   * which is what lets a failed load be run again without a page reload.
   */
  readonly retryAttempt: number;
}

/**
 * The five things that happen to a request, named for what happened rather than
 * for the fields they write.
 *
 * Settling is its own action rather than folded into the two outcomes before
 * it, because clearing the loading flag from one handler that runs whichever
 * way the promise went is precisely what stops a failure leaving a permanent
 * spinner. Folding it in would leave that guarantee resting on two branches
 * agreeing forever.
 */
export type AppAction =
  | { readonly type: "attempt" }
  | { readonly type: "resolved"; readonly cities: City[] }
  | { readonly type: "failed"; readonly error: Error }
  | { readonly type: "settled" }
  | { readonly type: "retry" };

/**
 * Where the container starts: nothing fetched, nothing failed, nothing in
 * flight, and no attempt made. The first attempt is what raises the loading
 * flag, so the value here is the state of a container that has just mounted and
 * not yet run its effect.
 */
export const INITIAL_APP_STATE: AppState = {
  cities: [],
  error: null,
  loading: false,
  datasetReady: false,
  retryAttempt: 0,
};

/**
 * The only thing that moves the container from one request state to the next.
 *
 * It is pure and knows nothing about React, so the rules below can be read and
 * tested without rendering anything.
 */
export function applyAppAction(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "attempt":
      // Clear the last failure as the new attempt starts, so a retry does not
      // leave the old error on screen beside the new load.
      return { ...state, error: null, loading: true };
    case "resolved":
      return {
        ...state,
        cities: action.cities,
        error: null,
        datasetReady: true,
      };
    case "failed":
      // The rows already on screen are correct until something replaces them,
      // so a failure paints an error beside them rather than emptying the
      // table, and the arrival flag stays raised.
      return { ...state, error: action.error };
    case "settled":
      return { ...state, loading: false };
    case "retry":
      return { ...state, retryAttempt: state.retryAttempt + 1 };
  }
}
