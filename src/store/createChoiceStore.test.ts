import { describe, expect, it, vi } from "vitest";

import { createChoiceStore, type ChoiceStore } from "./createChoiceStore";

const KEY = "test-choice";

/** A two-word vocabulary, enough to tell a stored word from a rejected one. */
function isWord(value: unknown): value is "red" | "blue" {
  return value === "red" || value === "blue";
}

/**
 * Runs a case with one subscriber registered, and unregisters it however the
 * case ends, so a failing case leaves no listener behind for the next.
 */
function withSubscriber<T>(
  store: ChoiceStore<"red" | "blue">,
  run: (notifications: () => number) => T,
): T {
  let notifications = 0;
  const unsubscribe = store.subscribe(() => {
    notifications += 1;
  });

  try {
    return run(() => notifications);
  } finally {
    unsubscribe();
  }
}

/** Makes localStorage throw for one case, as it does when site data is blocked. */
function breakStorage(method: "getItem" | "setItem" | "removeItem"): void {
  vi.spyOn(Storage.prototype, method).mockImplementation(() => {
    throw new Error("site data is blocked");
  });
}

describe("createChoiceStore", () => {
  describe("reading", () => {
    it("reads a stored word at creation, with no subscriber", () => {
      localStorage.setItem(KEY, "blue");

      expect(createChoiceStore(KEY, isWord).getSnapshot()).toBe("blue");
    });

    it.each([null, "green", "", "system"])(
      "reports system for the stored value %o",
      (stored) => {
        if (stored !== null) {
          localStorage.setItem(KEY, stored);
        }

        expect(createChoiceStore(KEY, isWord).getSnapshot()).toBe("system");
      },
    );

    it("reports system when the read throws, without throwing", () => {
      breakStorage("getItem");

      expect(() => createChoiceStore(KEY, isWord)).not.toThrow();
      expect(createChoiceStore(KEY, isWord).getSnapshot()).toBe("system");
    });

    it("re-reads on the first subscribe without notifying", () => {
      const store = createChoiceStore(KEY, isWord);

      localStorage.setItem(KEY, "red");

      withSubscriber(store, (notifications) => {
        expect(store.getSnapshot()).toBe("red");
        expect(notifications()).toBe(0);
      });
    });
  });

  describe("writing", () => {
    it("writes the word verbatim and notifies once", () => {
      const store = createChoiceStore(KEY, isWord);

      withSubscriber(store, (notifications) => {
        store.set("blue");

        expect(store.getSnapshot()).toBe("blue");
        expect(localStorage.getItem(KEY)).toBe("blue");
        expect(notifications()).toBe(1);
      });
    });

    it("removes the key for system rather than storing the word", () => {
      localStorage.setItem(KEY, "red");
      const store = createChoiceStore(KEY, isWord);

      store.set("system");

      expect(store.getSnapshot()).toBe("system");
      expect(localStorage.getItem(KEY)).toBeNull();
    });

    it("still changes the choice when the write throws", () => {
      const store = createChoiceStore(KEY, isWord);

      withSubscriber(store, (notifications) => {
        breakStorage("setItem");

        expect(() => {
          store.set("red");
        }).not.toThrow();

        expect(store.getSnapshot()).toBe("red");
        expect(notifications()).toBe(1);
      });
    });

    it("still changes the choice when the removal throws", () => {
      localStorage.setItem(KEY, "red");
      const store = createChoiceStore(KEY, isWord);

      withSubscriber(store, (notifications) => {
        breakStorage("removeItem");

        expect(() => {
          store.set("system");
        }).not.toThrow();

        expect(store.getSnapshot()).toBe("system");
        expect(notifications()).toBe(1);
      });
    });
  });

  describe("subscribers", () => {
    it("notifies every subscriber", () => {
      const store = createChoiceStore(KEY, isWord);

      withSubscriber(store, (first) => {
        withSubscriber(store, (second) => {
          store.set("red");

          expect(first()).toBe(1);
          expect(second()).toBe(1);
        });
      });
    });

    it("installs the window listeners with the first subscriber only", () => {
      const store = createChoiceStore(KEY, isWord, ["languagechange"]);
      const added = vi.spyOn(window, "addEventListener");

      withSubscriber(store, () => {
        expect(added).toHaveBeenCalledWith("storage", expect.any(Function));
        expect(added).toHaveBeenCalledWith(
          "languagechange",
          expect.any(Function),
        );

        const afterFirst = added.mock.calls.length;

        withSubscriber(store, () => {
          expect(added.mock.calls).toHaveLength(afterFirst);
        });
      });
    });

    it("removes the window listeners with the last subscriber only", () => {
      const store = createChoiceStore(KEY, isWord, ["languagechange"]);
      const removed = vi.spyOn(window, "removeEventListener");

      withSubscriber(store, () => {
        withSubscriber(store, () => {
          // One subscriber is leaving and one is staying, so nothing is
          // removed yet.
        });

        expect(removed).not.toHaveBeenCalled();
      });

      expect(removed).toHaveBeenCalledWith("storage", expect.any(Function));
      expect(removed).toHaveBeenCalledWith(
        "languagechange",
        expect.any(Function),
      );
    });

    it("installs only the storage listener without notifyOn", () => {
      const store = createChoiceStore(KEY, isWord);
      const added = vi.spyOn(window, "addEventListener");

      withSubscriber(store, () => {
        expect(added).toHaveBeenCalledTimes(1);
        expect(added).toHaveBeenCalledWith("storage", expect.any(Function));
      });
    });
  });

  describe("storage events", () => {
    it("re-reads and notifies for its key, ignoring the event value", () => {
      localStorage.setItem(KEY, "red");
      const store = createChoiceStore(KEY, isWord);

      withSubscriber(store, (notifications) => {
        localStorage.setItem(KEY, "blue");
        window.dispatchEvent(
          new StorageEvent("storage", { key: KEY, newValue: "red" }),
        );

        expect(store.getSnapshot()).toBe("blue");
        expect(notifications()).toBe(1);
      });
    });

    it("re-reads and notifies when another document clears storage", () => {
      localStorage.setItem(KEY, "red");
      const store = createChoiceStore(KEY, isWord);

      withSubscriber(store, (notifications) => {
        localStorage.clear();
        window.dispatchEvent(new StorageEvent("storage", { key: null }));

        expect(store.getSnapshot()).toBe("system");
        expect(notifications()).toBe(1);
      });
    });

    it("ignores a write to any other key", () => {
      localStorage.setItem(KEY, "red");
      const store = createChoiceStore(KEY, isWord);

      withSubscriber(store, (notifications) => {
        localStorage.setItem(KEY, "blue");
        window.dispatchEvent(new StorageEvent("storage", { key: "unrelated" }));

        expect(store.getSnapshot()).toBe("red");
        expect(notifications()).toBe(0);
      });
    });

    it("does not follow a store on a different key", () => {
      const first = createChoiceStore(KEY, isWord);
      const second = createChoiceStore("other-choice", isWord);

      withSubscriber(first, (firstNotifications) => {
        withSubscriber(second, (secondNotifications) => {
          localStorage.setItem("other-choice", "blue");
          window.dispatchEvent(
            new StorageEvent("storage", { key: "other-choice" }),
          );

          expect(first.getSnapshot()).toBe("system");
          expect(second.getSnapshot()).toBe("blue");
          expect(firstNotifications()).toBe(0);
          expect(secondNotifications()).toBe(1);
        });
      });
    });
  });

  describe("notifyOn events", () => {
    it("notifies without re-reading storage", () => {
      const store = createChoiceStore(KEY, isWord, ["languagechange"]);

      withSubscriber(store, (notifications) => {
        localStorage.setItem(KEY, "red");
        window.dispatchEvent(new Event("languagechange"));

        expect(notifications()).toBe(1);
        expect(store.getSnapshot()).toBe("system");
      });
    });
  });
});
