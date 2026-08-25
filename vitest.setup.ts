import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/dom";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

import { CITY_FIXTURE_ENVELOPE } from "./src/test/cityFixture";
import { stubDatasetFetch } from "./src/test/fetchStub";
import { installMatchMediaStub } from "./src/test/matchMediaStub";

// The DOM environment supplies no fetch, so the global is Node's own
// implementation, which requires an absolute URL and rejects the root-relative
// path the dataset URL resolves to under this runner. An unstubbed dataset load
// therefore fails with a URL parse error rather than a network error, and a test
// can pass because a load failed for the wrong reason. Installing the stub here
// means no test reaches the real network by accident; a test that wants a
// failure overrides it deliberately.
beforeEach(() => {
  stubDatasetFetch(CITY_FIXTURE_ENVELOPE);
  installMatchMediaStub();
});

// Teardown is one hook rather than two, and it unmounts before it resets.
//
// Testing Library only registers its own cleanup when a global afterEach exists.
// Test globals are imported explicitly rather than injected, so that registration
// never happens and the rendered DOM has to be torn down here instead. Without
// this, renders accumulate across tests and duplicate-element errors follow.
//
// The unmount goes first, because the unmount is itself a source of the writes
// the resets below undo. It runs inside act, which flushes any render still
// pending from a timer along with the effects that render schedules, and an
// effect in that flush can write the address or the theme attribute. Split
// across two hooks the resets cannot cover it: the runner orders afterEach
// hooks in reverse registration by default, so the hook holding the resets runs
// before the hook holding the unmount, and a write the unmount produces
// outlives the reset that exists to clear it. The next test then reads that
// write as its own starting state. It surfaces as an occasional failure in an
// unrelated later test rather than a reproducible one, because a commit that
// lands during the test itself is reset normally and only a commit still
// pending at the boundary escapes.
//
// The resets themselves close three leaks of one shape. Without the first, a
// stub installed by one test is still in place for the next, so a case that
// never asked for a dataset failure inherits one. The environment gives one
// document, one storage, and one address per test file, so a case meaning to
// exercise the no-stored-choice theme default silently exercises whatever the
// previous case stamped on the document element, and a case meaning to open a
// link with no parameters opens the previous case's link instead.
afterEach(() => {
  cleanup();

  vi.unstubAllGlobals();
  vi.restoreAllMocks();

  // Three suites in this repository declare the node environment so they can read
  // shipped files, and this setup file runs for them too. There is no document to
  // reset there, and an unguarded reference is a ReferenceError that fails every
  // one of their cases.
  if (typeof document !== "undefined") {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.removeProperty("color-scheme");
    window.history.replaceState(null, "", "/");
  }

  try {
    localStorage.clear();
  } catch {
    // Storage can be unavailable outright; there is then nothing to clear.
  }
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
