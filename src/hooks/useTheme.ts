import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import {
  PREFERS_DARK_QUERY,
  THEME_CHOICES,
  THEME_STORAGE_KEY,
  resolveTheme,
} from "../theme/resolveTheme";
import type { ThemeChoice } from "../theme/resolveTheme";

/** Anything but the two explicit words is absent. The access can throw. */
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

/** Asked once, or the reader and the subscription below could disagree. */
function supportsMediaQueries(): boolean {
  return typeof window.matchMedia === "function";
}

/** The system preference. No media query support prefers light. */
function readPrefersDark(): boolean {
  if (!supportsMediaQueries()) {
    return false;
  }

  return window.matchMedia(PREFERS_DARK_QUERY).matches;
}

/** Through useSyncExternalStore, not an effect, which leaves a window. */
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
 * Owns the theme: the stored choice, the write-through, the theme stamped on
 * the document element, and the subscriptions to the system and the other tabs.
 *
 * Single instance by construction. The choice is per caller and the document
 * element is not, so two callers hold two choices and their two effects race on
 * one element. Lift this behind a provider before adding a second caller.
 *
 * The choice-plus-preference rule is written a second time as a literal in the
 * blocking inline script in index.html, which cannot import a module. Change
 * both together; the parity guard in src/toolchain.test.ts holds them.
 */
export function useTheme() {
  const [choice, setChoiceState] = useState<ThemeChoice>(readStoredChoice);
  const prefersDark = useSyncExternalStore(
    subscribePrefersDark,
    readPrefersDark,
  );

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      // This key only. The event does not fire in the tab that wrote it, so the
      // setter below need not guard against itself. A null key is a clear().
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
    // either one left unmaintained goes stale the first time the reader picks.
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
  }, [resolved]);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);

    try {
      if (next === "system") {
        // A delete, not the word: the default has one representation, the key
        // not being there.
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
