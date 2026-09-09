import {
  LOCALE_STORAGE_KEY,
  isCatalogId,
  isLocaleChoice,
  resolveLocale,
  type LocaleChoice,
  type ResolvedLocale,
} from "./resolveLocale";

// The chosen locale, owned once for the document, so every caller resolves the
// same value.

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

/**
 * Re-reads the store on each event; the value the event carries is ignored. A
 * null key is a clear().
 */
function handleStorage(event: StorageEvent): void {
  if (event.key === null || event.key === LOCALE_STORAGE_KEY) {
    choice = readStoredChoice();
    notify();
  }
}

/**
 * The listeners come and go with the first and last subscriber, so nothing was
 * listening between the last unsubscribe and this call and a cross-tab write in
 * that window went unseen. The choice is re-read here to catch it.
 */
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

/** Safe to hand straight to React; the resolver returns a module constant. */
export function getLocaleSnapshot(): ResolvedLocale {
  return resolveLocale(choice, navigator.languages);
}

/** What the reader picked, and what the picker paints as selected. */
export function getChoiceSnapshot(): LocaleChoice {
  return choice;
}

/**
 * Moves the choice and writes it through. A value naming no choice is ignored,
 * and the option list is closed, so nothing reaching that branch came from a
 * reader.
 */
export function setLocaleChoice(next: string): void {
  if (!isLocaleChoice(next)) {
    return;
  }

  choice = next;

  try {
    if (next === "system") {
      // The default has one representation, the key being absent, so this
      // deletes the key instead of storing the word.
      localStorage.removeItem(LOCALE_STORAGE_KEY);
    } else {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    }
  } catch {
    // The choice still stands for this session; only its persistence is lost.
  }

  notify();
}
