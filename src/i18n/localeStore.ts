import {
  LOCALE_STORAGE_KEY,
  isCatalogId,
  isLocaleChoice,
  resolveLocale,
  type LocaleChoice,
  type ResolvedLocale,
} from "./resolveLocale";

/**
 * The chosen locale, owned once for the whole document.
 *
 * The theme's choice lives inside its hook, one copy per caller, and its own
 * documentation says that is why a second caller would race the first. This one
 * has several callers by design: the picker in the header and the table below
 * it both read it, and both stamp the same document element. Holding the choice
 * here rather than in the hook is what makes those writes agree by
 * construction, because every subscriber resolves the identical value.
 */

/**
 * Reads the stored choice. Anything that is not the id of a catalog that ships
 * is absent, and so is a store that cannot be read at all: a stale entry from an
 * older build and a hostile one are the same case, and both resolve to
 * following the machine rather than to an undefined locale.
 *
 * The property access is what throws when site data is blocked, so neither a
 * typeof guard nor optional chaining substitutes for the catch.
 */
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
 * Another document wrote the key. Re-read the store rather than trusting the
 * value the event carries, and ignore every other key: the event does not fire
 * in the document that made the write, which is why the setter below does not
 * have to guard against reacting to itself.
 *
 * A null key is a clear() rather than a write, and it takes this key with it, so
 * it counts the same as a write to this key.
 */
function handleStorage(event: StorageEvent): void {
  if (event.key === null || event.key === LOCALE_STORAGE_KEY) {
    choice = readStoredChoice();
    notify();
  }
}

/**
 * Registers a reader and returns the unregister.
 *
 * The window listeners are installed with the first subscriber and removed with
 * the last, so a document with nothing mounted holds nothing. That is also why
 * the choice is re-read here: between the last unsubscribe and this call there
 * was no listener, so a write from another document in that window went unseen.
 * React re-reads the snapshot immediately after subscribing, which is what turns
 * the re-read into a render rather than into a value nobody asked for.
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

/**
 * The resolved locale right now.
 *
 * Safe to hand straight to React with no cache in front of it, because the
 * resolver returns one of four module constants and so its identity is already
 * stable for a stable input. A resolver that built its answer would need one,
 * and the loop it would otherwise cause is the reason this is worth stating.
 */
export function getLocaleSnapshot(): ResolvedLocale {
  return resolveLocale(choice, navigator.languages);
}

/** What the reader picked, which is what the picker paints as selected. */
export function getChoiceSnapshot(): LocaleChoice {
  return choice;
}

/**
 * Moves the choice and writes it through.
 *
 * Takes a string rather than the union because the picker hands over whatever
 * the DOM has in the control's value, and this is the one place that decides
 * whether a value names a choice. A value that names none is ignored outright:
 * the option list is closed, so nothing that reaches this branch came from a
 * reader picking something.
 */
export function setLocaleChoice(next: string): void {
  if (!isLocaleChoice(next)) {
    return;
  }

  choice = next;

  try {
    if (next === "system") {
      // A delete, not the word: the default has exactly one representation, and
      // every other value the key could hold is already treated as absent.
      localStorage.removeItem(LOCALE_STORAGE_KEY);
    } else {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    }
  } catch {
    // The choice still stands for this session; only its persistence is lost.
  }

  notify();
}
