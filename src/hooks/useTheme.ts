import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import {
  PREFERS_DARK_QUERY,
  THEME_CHOICES,
  THEME_STORAGE_KEY,
  resolveTheme,
} from "../theme/resolveTheme";
import type { ThemeChoice } from "../theme/resolveTheme";

/**
 * Reads the stored choice. Anything that is not exactly one of the two explicit
 * words is absent, and so is a store that cannot be read at all: a stale entry
 * from an older build and a hostile one are the same case, and both render the
 * default rather than an undefined theme.
 *
 * Membership is tested against the declared vocabulary rather than against two
 * words written out again here, so the accepted set has one definition. The
 * default word is excluded on its own line: the key holding it is already
 * treated as absent, because the default has exactly one representation and it
 * is the key not being there.
 *
 * The property access is what throws when site data is blocked, so neither a
 * typeof guard nor optional chaining substitutes for the catch. Unguarded, the
 * throw happens inside a state initializer, which unmounts the whole tree over a
 * display preference.
 */
function readStoredChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const explicit = THEME_CHOICES.find(
      (choice) => choice !== "system" && choice === stored,
    );

    if (explicit) {
      return explicit;
    }
  } catch {
    // An unreadable store is an absent one.
  }

  return "system";
}

/**
 * Whether this environment can answer a media query at all. Asked in one place
 * rather than two: the reader below and the subscription below that have to
 * agree, or the hook subscribes to something it will not read.
 */
function supportsMediaQueries(): boolean {
  return typeof window.matchMedia === "function";
}

/**
 * The operating system's current preference. An environment with no media query
 * support prefers light, which is the same answer the resolver gives for a
 * missing choice, so nothing downstream has a third case to handle.
 */
function readPrefersDark(): boolean {
  if (!supportsMediaQueries()) {
    return false;
  }

  return window.matchMedia(PREFERS_DARK_QUERY).matches;
}

/**
 * Subscribes to the operating system's preference, returning the unsubscribe.
 *
 * Paired with the reader above through useSyncExternalStore rather than through
 * an effect that seeds state and then re-reads it. The preference can move
 * between the render that would seed it and the commit that would subscribe,
 * and StrictMode's mount, unmount, remount opens that window a second time; the
 * hook closes both by reading the store itself after subscribing.
 *
 * An environment with no media query support subscribes to nothing and keeps
 * the reader's answer, so the two cannot disagree about whether a query exists.
 */
function subscribePrefersDark(onStoreChange: () => void): () => void {
  if (!supportsMediaQueries()) {
    return () => {};
  }

  const query = window.matchMedia(PREFERS_DARK_QUERY);
  query.addEventListener("change", onStoreChange);

  return () => {
    query.removeEventListener("change", onStoreChange);
  };
}

/**
 * Owns the theme: the stored choice, the write-through when it changes, the
 * concrete theme stamped on the document element, and the two subscriptions that
 * keep it current, one to the operating system and one to the other tabs.
 *
 * Single instance by construction. The choice is per caller, the document
 * element the effect stamps it onto is not, so a second caller gets its own
 * choice and the two effects race on every render, leaving the loser showing a
 * control that disagrees with the painted page. Lift this behind a provider
 * mounted once before the second caller exists.
 *
 * The rule that turns a choice plus a preference into a theme is written a
 * second time, as a literal, inside the blocking inline script in index.html.
 * That script runs before any module loads, so it cannot import this. A change
 * to either one needs the same change to the other, and the parity guard in
 * src/toolchain.test.ts is what fails when they stop agreeing.
 */
export function useTheme() {
  const [choice, setChoiceState] = useState<ThemeChoice>(readStoredChoice);
  const prefersDark = useSyncExternalStore(
    subscribePrefersDark,
    readPrefersDark,
  );

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      // This key only, and only a write from another document: the event does
      // not fire in the tab that made it, which is why the setter below does
      // not have to guard against reacting to itself. A null key is a clear()
      // rather than a write, and it takes this key with it.
      if (event.key === null || event.key === THEME_STORAGE_KEY) {
        setChoiceState(readStoredChoice());
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const resolved = resolveTheme(choice, prefersDark);

  useEffect(() => {
    // Both halves, because the inline script sets both before first paint and
    // the one left unmaintained goes stale the first time the user chooses.
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
  }, [resolved]);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);

    try {
      if (next === "system") {
        // A delete, not the word: the default has exactly one representation,
        // and every other value the key could hold is already treated as absent.
        localStorage.removeItem(THEME_STORAGE_KEY);
      } else {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      }
    } catch {
      // The choice still stands for this session; only its persistence is lost.
    }
  }, []);

  return { choice, setChoice };
}
