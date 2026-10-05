import { useEffect, useSyncExternalStore } from "react";

import { createChoiceStore } from "../store/createChoiceStore";
import {
  PREFERS_DARK_QUERY,
  THEME_STORAGE_KEY,
  isExplicitTheme,
  resolveTheme,
} from "../theme/resolveTheme";

const store = createChoiceStore(THEME_STORAGE_KEY, isExplicitTheme);

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

/** Through useSyncExternalStore, because an effect leaves a window open. */
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
 * Reads the theme from a module store, so every caller sees one choice, and
 * stamps the resolved theme on the document element. Every instance writes the
 * same pair, so instances do not race on the one element.
 *
 * The choice-plus-preference rule is written again in src/bootDocument.ts, the
 * boot script, whose tests hold it to resolveTheme.
 */
export function useTheme() {
  const choice = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const prefersDark = useSyncExternalStore(
    subscribePrefersDark,
    readPrefersDark,
  );
  const resolved = resolveTheme(choice, prefersDark);

  useEffect(() => {
    // Both halves, because the boot script sets both before first paint.
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
  }, [resolved]);

  return { choice, setChoice: store.set };
}
