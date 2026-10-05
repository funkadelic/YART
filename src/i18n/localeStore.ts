import { createChoiceStore } from "../store/createChoiceStore";
import {
  LOCALE_STORAGE_KEY,
  isCatalogId,
  isLocaleChoice,
  resolveLocale,
  type ResolvedLocale,
} from "./resolveLocale";

// The chosen locale, owned once for the document, so every caller resolves the
// same value.

const store = createChoiceStore(LOCALE_STORAGE_KEY, isCatalogId, [
  "languagechange",
]);

/** Subscribes to the choice and to the machine's language list changing. */
export const subscribeLocale = store.subscribe;

/** What the reader picked, and what the picker paints as selected. */
export const getChoiceSnapshot = store.getSnapshot;

/** Safe to hand straight to React; the resolver returns a module constant. */
export function getLocaleSnapshot(): ResolvedLocale {
  return resolveLocale(store.getSnapshot(), navigator.languages);
}

/**
 * Moves the choice and writes it through. A value naming no choice is ignored,
 * and the option list is closed, so nothing reaching that branch came from a
 * reader.
 */
export function setLocaleChoice(next: string): void {
  if (isLocaleChoice(next)) {
    store.set(next);
  }
}
