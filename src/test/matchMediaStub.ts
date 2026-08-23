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
 *
 * The stub carries only the three members the hook touches. The global is
 * installed through a helper that takes an unknown value, so consumers still
 * typecheck against the DOM's own declaration and a member nothing calls would
 * be answering to nobody.
 */

type MediaPreferenceListener = (event: {
  matches: boolean;
  media: string;
}) => void;

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

  vi.stubGlobal("matchMedia", (query: string) => {
    return {
      media: query,
      get matches() {
        return query === PREFERS_DARK_QUERY && prefersDark;
      },
      addEventListener: (_type: string, listener: MediaPreferenceListener) => {
        mediaListeners.add(listener);
      },
      removeEventListener: (
        _type: string,
        listener: MediaPreferenceListener,
      ) => {
        mediaListeners.delete(listener);
      },
    };
  });
}
