import { vi } from "vitest";

import { PREFERS_DARK_QUERY } from "../theme/resolveTheme";

/**
 * Shared operating-system preference stub.
 *
 * The DOM environment implements no matchMedia at all, and the header hosts the
 * theme control, so every test that renders the app or the layout reaches it
 * without knowing anything about theming. This module owns the preference the
 * stub reports and the listeners currently subscribed to it, so a test can move
 * the preference and read back whether a mounted consumer followed.
 */

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

/**
 * Installs the stub and returns the preference to light. Called per test rather
 * than once at module scope because the suite unstubs globals after every case,
 * which would strip a module-scope installation after the first test in a file
 * and fail every later test in it for a reason unrelated to its subject.
 */
export function installMatchMediaStub(): void {
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
}
