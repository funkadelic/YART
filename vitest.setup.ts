import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/dom";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Testing Library only registers its own cleanup when a global afterEach exists.
// Test globals are imported explicitly rather than injected, so that registration
// never happens and the rendered DOM has to be torn down here instead. Without
// this, renders accumulate across tests and duplicate-element errors follow.
afterEach(cleanup);

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
