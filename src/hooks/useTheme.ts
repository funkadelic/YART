import { useCallback, useEffect, useState } from "react";

import {
  PREFERS_DARK_QUERY,
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
 * The property access is what throws when site data is blocked, so neither a
 * typeof guard nor optional chaining substitutes for the catch. Unguarded, the
 * throw happens inside a state initializer, which unmounts the whole tree over a
 * display preference.
 */
function readStoredChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);

    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
    // An unreadable store is an absent one.
  }

  return "system";
}

/**
 * The operating system's current preference. An environment with no media query
 * support prefers light, which is the same answer the resolver gives for a
 * missing choice, so nothing downstream has a third case to handle.
 */
function readPrefersDark(): boolean {
  if (typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia(PREFERS_DARK_QUERY).matches;
}

/**
 * Owns the theme: the stored choice, the write-through when it changes, the
 * concrete theme stamped on the document element, and the operating system
 * subscription that keeps the system choice current.
 *
 * The rule that turns a choice plus a preference into a theme is written a
 * second time, as a literal, inside the blocking inline script in index.html.
 * That script runs before any module loads, so it cannot import this. A change
 * to either one needs the same change to the other, and nothing in the suite
 * asserts that they agree.
 */
export function useTheme() {
  const [choice, setChoiceState] = useState<ThemeChoice>(readStoredChoice);
  const [prefersDark, setPrefersDark] = useState<boolean>(readPrefersDark);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const query = window.matchMedia(PREFERS_DARK_QUERY);

    const handlePreferenceChange = (event: MediaQueryListEvent) => {
      setPrefersDark(event.matches);
    };

    query.addEventListener("change", handlePreferenceChange);

    return () => {
      query.removeEventListener("change", handlePreferenceChange);
    };
  }, []);

  const resolved = resolveTheme(choice, prefersDark);

  useEffect(() => {
    // Both halves, because the inline script sets both before first paint and
    // the one left unmaintained goes stale the first time the user chooses.
    document.documentElement.setAttribute("data-theme", resolved);
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

  return { choice, setChoice, resolved };
}
