/**
 * A persisted choice owned once per document: the stored word, or "system" when
 * none is stored. The default has one representation, the key being absent.
 */
export interface ChoiceStore<T extends string> {
  subscribe: (onStoreChange: () => void) => () => void;
  getSnapshot: () => T | "system";
  set: (next: T | "system") => void;
}

/**
 * Builds a module store over one localStorage key. Only words that pass
 * isStored are read back, and each notifyOn window event re-notifies without a
 * re-read.
 */
export function createChoiceStore<T extends string>(
  key: string,
  isStored: (value: unknown) => value is T,
  notifyOn: readonly string[] = [],
): ChoiceStore<T> {
  /** Anything isStored rejects is absent. The access throws when blocked. */
  function read(): T | "system" {
    try {
      const stored = localStorage.getItem(key);

      if (isStored(stored)) {
        return stored;
      }
    } catch {
      // An unreadable store is an absent one.
    }

    return "system";
  }

  let choice = read();

  const subscribers = new Set<() => void>();

  /** Tells every current subscriber to re-read, in registration order. */
  function notify(): void {
    for (const subscriber of subscribers) {
      subscriber();
    }
  }

  /**
   * Re-reads the store on each event and ignores the value the event carries. A
   * null key is a clear().
   */
  function handleStorage(event: StorageEvent): void {
    if (event.key === null || event.key === key) {
      choice = read();
      notify();
    }
  }

  return {
    /** Registers a listener; the first one re-reads storage and installs the window listeners. */
    subscribe(onStoreChange) {
      if (subscribers.size === 0) {
        choice = read();
        window.addEventListener("storage", handleStorage);

        for (const type of notifyOn) {
          window.addEventListener(type, notify);
        }
      }

      subscribers.add(onStoreChange);

      return () => {
        subscribers.delete(onStoreChange);

        if (subscribers.size === 0) {
          window.removeEventListener("storage", handleStorage);

          for (const type of notifyOn) {
            window.removeEventListener(type, notify);
          }
        }
      };
    },

    /** The current choice, a stable primitive. */
    getSnapshot: () => choice,

    /** Moves the choice, writes it through to storage, and notifies. */
    set(next) {
      choice = next;

      try {
        if (next === "system") {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, next);
        }
      } catch {
        // The choice holds in memory until the next re-read, which restores what
        // storage still has; only its persistence is lost.
      }

      notify();
    },
  };
}
