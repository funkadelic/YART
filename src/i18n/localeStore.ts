import {
  LOCALE_STORAGE_KEY,
  isCatalogId,
  isLocaleChoice,
  resolveLocale,
  type LocaleChoice,
  type ResolvedLocale,
} from "./resolveLocale";

/** Owned once for the document, which is what makes several callers agree. */

/** Anything not a shipped id is absent. The access throws when blocked. */
function readStoredChoice(): LocaleChoice {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);

    if (isCatalogId(stored)) {
      return stored;
    }
  } catch {
    // An unreadable store is an absent one.
  }

  return "system";
}

let choice: LocaleChoice = readStoredChoice();

const subscribers = new Set<() => void>();

/** Tells every current subscriber to re-read, in registration order. */
function notify(): void {
  for (const subscriber of subscribers) {
    subscriber();
  }
}

/** Re-read rather than trust the event. A null key is a clear(). */
function handleStorage(event: StorageEvent): void {
  if (event.key === null || event.key === LOCALE_STORAGE_KEY) {
    choice = readStoredChoice();
    notify();
  }
}

/** The listeners come and go with the first and last subscriber. */
export function subscribeLocale(onStoreChange: () => void): () => void {
  if (subscribers.size === 0) {
    choice = readStoredChoice();
    window.addEventListener("storage", handleStorage);
    window.addEventListener("languagechange", notify);
  }

  subscribers.add(onStoreChange);

  return () => {
    subscribers.delete(onStoreChange);

    if (subscribers.size === 0) {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("languagechange", notify);
    }
  };
}

/** Safe to hand straight to React: the resolver returns a module constant. */
export function getLocaleSnapshot(): ResolvedLocale {
  return resolveLocale(choice, navigator.languages);
}

/** What the reader picked, which is what the picker paints as selected. */
export function getChoiceSnapshot(): LocaleChoice {
  return choice;
}

/**
 * Moves the choice and writes it through. A value naming none is ignored: the
 * option list is closed, so nothing reaching that branch came from a reader.
 */
export function setLocaleChoice(next: string): void {
  if (!isLocaleChoice(next)) {
    return;
  }

  choice = next;

  try {
    if (next === "system") {
      // A delete, not the word: the default has one representation, the key
      // not being there.
      localStorage.removeItem(LOCALE_STORAGE_KEY);
    } else {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    }
  } catch {
    // The choice still stands for this session; only its persistence is lost.
  }

  notify();
}
