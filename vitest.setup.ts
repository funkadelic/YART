import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/dom";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

import { CITY_FIXTURE_ENVELOPE } from "./src/test/cityFixture";
import { stubDatasetFetch } from "./src/test/fetchStub";

// Testing Library only registers its own cleanup when a global afterEach exists.
// Test globals are imported explicitly rather than injected, so that registration
// never happens and the rendered DOM has to be torn down here instead. Without
// this, renders accumulate across tests and duplicate-element errors follow.
afterEach(cleanup);

// The DOM environment supplies no fetch, so the global is Node's own
// implementation, which requires an absolute URL and rejects the root-relative
// path the dataset URL resolves to under this runner. An unstubbed dataset load
// therefore fails with a URL parse error rather than a network error, and a test
// can pass because a load failed for the wrong reason. Installing the stub here
// means no test reaches the real network by accident; a test that wants a
// failure overrides it deliberately.
beforeEach(() => {
  stubDatasetFetch(CITY_FIXTURE_ENVELOPE);
});

// Without this, a stub installed by one test is still in place for the next one,
// so a case that never asked for a dataset failure inherits one.
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

// Testing Library drains the microtask queue after every awaited interaction by
// scheduling a zero-delay timeout, and it only pumps a controlled clock when it
// recognises the previous runner's global. This runner does not provide that
// global, so under a controlled clock the timeout never fires and every awaited
// interaction stalls forever rather than failing. The wrapper below is the
// stock one with that recognition check replaced by this runner's own, so the
// clock gets pumped and the drain completes. With a real clock it behaves
// exactly as the stock wrapper does.
configure({
  asyncWrapper: async (callback) => {
    const wasActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;

    try {
      const result = await callback();

      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 0);
        if (vi.isFakeTimers()) {
          vi.advanceTimersByTime(0);
        }
      });

      return result;
    } finally {
      actEnvironment.IS_REACT_ACT_ENVIRONMENT = wasActEnvironment;
    }
  },
});
