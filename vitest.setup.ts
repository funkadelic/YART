import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/dom";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

import { CITY_FIXTURE_ENVELOPE } from "./src/test/cityFixture";
import { stubDatasetFetch } from "./src/test/fetchStub";
import { PREFERS_DARK_QUERY } from "./src/theme/resolveTheme";

// Testing Library only registers its own cleanup when a global afterEach exists.
// Test globals are imported explicitly rather than injected, so that registration
// never happens and the rendered DOM has to be torn down here instead. Without
// this, renders accumulate across tests and duplicate-element errors follow.
afterEach(cleanup);

/** What the stub hands a change listener. The hook reads `matches` and nothing else. */
interface MediaPreferenceEvent {
  readonly matches: boolean;
  readonly media: string;
}

type MediaPreferenceListener = (event: MediaPreferenceEvent) => void;

/**
 * The shape the stub returns. Declared here rather than borrowed from the DOM
 * library because the real interface's event listener methods are overloaded and
 * an object literal cannot satisfy both arms without a cast. Nothing typechecks
 * against this but the stub itself: the global is installed through a helper that
 * takes an unknown value, so consumers still see the DOM's own declaration.
 */
interface MediaQueryListStub {
  readonly media: string;
  readonly matches: boolean;
  onchange: null;
  addEventListener: (type: string, listener: MediaPreferenceListener) => void;
  removeEventListener: (
    type: string,
    listener: MediaPreferenceListener,
  ) => void;
  addListener: () => void;
  removeListener: () => void;
  dispatchEvent: () => boolean;
}

let prefersDark = false;
const mediaListeners = new Set<MediaPreferenceListener>();

/**
 * Moves the operating system preference the stub reports and notifies everything
 * currently subscribed, so a test can prove that a mounted consumer follows a
 * change rather than only that it read the value once.
 */
export function setPrefersDark(next: boolean): void {
  prefersDark = next;

  for (const listener of mediaListeners) {
    listener({ matches: next, media: PREFERS_DARK_QUERY });
  }
}

/**
 * How many change listeners are registered right now. A test proves an unmount
 * released its subscription by reading zero here instead of assuming it.
 */
export function mediaListenerCount(): number {
  return mediaListeners.size;
}

// The DOM environment supplies no fetch, so the global is Node's own
// implementation, which requires an absolute URL and rejects the root-relative
// path the dataset URL resolves to under this runner. An unstubbed dataset load
// therefore fails with a URL parse error rather than a network error, and a test
// can pass because a load failed for the wrong reason. Installing the stub here
// means no test reaches the real network by accident; a test that wants a
// failure overrides it deliberately.
beforeEach(() => {
  stubDatasetFetch(CITY_FIXTURE_ENVELOPE);

  // The DOM environment implements no matchMedia at all, and the header hosts
  // the theme control, so every test that renders the app or the layout reaches
  // it without knowing anything about theming. Installed here rather than at
  // module scope because the afterEach below unstubs globals, which would strip
  // a module-scope installation after the first test in each file and fail every
  // later test in that file for a reason unrelated to its subject.
  prefersDark = false;
  mediaListeners.clear();

  vi.stubGlobal("matchMedia", (query: string): MediaQueryListStub => {
    return {
      media: query,
      get matches() {
        return query === PREFERS_DARK_QUERY && prefersDark;
      },
      onchange: null,
      addEventListener: (_type, listener) => {
        mediaListeners.add(listener);
      },
      removeEventListener: (_type, listener) => {
        mediaListeners.delete(listener);
      },
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    };
  });
});

// Without this, a stub installed by one test is still in place for the next one,
// so a case that never asked for a dataset failure inherits one.
//
// The theme reset is here for the same class of leak from a different source:
// cleanup unmounts React trees and nothing else, and the environment gives one
// document and one storage per test file, so a case that means to exercise the
// no-stored-choice default silently exercises whatever the previous case stamped
// on the document element, and passes for the wrong reason.
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();

  // Three suites in this repository declare the node environment so they can read
  // shipped files, and this setup file runs for them too. There is no document to
  // reset there, and an unguarded reference is a ReferenceError that fails every
  // one of their cases.
  if (typeof document !== "undefined") {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.removeProperty("color-scheme");
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
