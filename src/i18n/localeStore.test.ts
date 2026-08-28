import { describe, expect, it, vi } from "vitest";

import {
  getChoiceSnapshot,
  getLocaleSnapshot,
  setLocaleChoice,
  subscribeLocale,
} from "./localeStore";
import { LOCALE_STORAGE_KEY } from "./resolveLocale";

/**
 * Runs a case with one subscriber registered, and unregisters it however the
 * case ends.
 *
 * Every case goes through here rather than reading the store cold, because the
 * store is a module singleton and the file is one module instance: the choice
 * one case leaves behind would otherwise be the state the next case starts
 * from. Subscribing is what re-reads the store, so a case that seeds storage
 * first sees what it seeded. The finally is what stops a failing case from
 * leaving a listener behind for the case after it.
 */
function withSubscriber<T>(run: (notifications: () => number) => T): T {
  let notifications = 0;
  const unsubscribe = subscribeLocale(() => {
    notifications += 1;
  });

  try {
    return run(() => notifications);
  } finally {
    unsubscribe();
  }
}

/**
 * Makes the store hostile for one case. The property access is what throws when
 * site data is blocked, so this is the shape the guard has to survive.
 */
function breakStorage(method: "getItem" | "setItem" | "removeItem"): void {
  vi.spyOn(Storage.prototype, method).mockImplementation(() => {
    throw new Error("site data is blocked");
  });
}

/** What the reader's machine says it wants, for one case. */
function preferLanguages(languages: readonly string[]): void {
  vi.spyOn(navigator, "languages", "get").mockReturnValue(languages);
}

describe("the locale store", () => {
  describe("the stored choice", () => {
    it("follows the machine when the key is absent", () => {
      withSubscriber(() => {
        expect(getChoiceSnapshot()).toBe("system");
      });
    });

    it("reports a stored catalog id", () => {
      localStorage.setItem(LOCALE_STORAGE_KEY, "fr");

      withSubscriber(() => {
        expect(getChoiceSnapshot()).toBe("fr");
      });
    });

    it.each(["klingon", "", "system", "EN"])(
      "treats the stored value %o as absent",
      (stored) => {
        localStorage.setItem(LOCALE_STORAGE_KEY, stored);

        withSubscriber(() => {
          expect(getChoiceSnapshot()).toBe("system");
        });
      },
    );

    it("treats an unreadable store as absent rather than letting the read escape", () => {
      breakStorage("getItem");

      withSubscriber(() => {
        expect(getChoiceSnapshot()).toBe("system");
      });
    });
  });

  describe("the resolved snapshot", () => {
    it("negotiates the machine's preferences while the choice is system", () => {
      preferLanguages(["es-419", "en"]);

      withSubscriber(() => {
        expect(getLocaleSnapshot().catalog).toBe("es");
      });
    });

    it("ignores the machine once the reader has chosen", () => {
      preferLanguages(["es-419", "en"]);
      localStorage.setItem(LOCALE_STORAGE_KEY, "ar-XB");

      withSubscriber(() => {
        expect(getLocaleSnapshot()).toEqual({
          catalog: "ar-XB",
          tag: "en-US",
          dir: "rtl",
        });
      });
    });
  });

  describe("writing the choice back", () => {
    it("writes the chosen id verbatim and notifies", () => {
      withSubscriber((notifications) => {
        setLocaleChoice("fr");

        expect(getChoiceSnapshot()).toBe("fr");
        expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("fr");
        expect(notifications()).toBe(1);
      });
    });

    it("removes the key for the system choice rather than writing the word", () => {
      localStorage.setItem(LOCALE_STORAGE_KEY, "es");

      withSubscriber(() => {
        setLocaleChoice("system");

        expect(getChoiceSnapshot()).toBe("system");
        expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull();
      });
    });

    it("ignores a value that names no choice", () => {
      withSubscriber((notifications) => {
        setLocaleChoice("klingon");

        expect(getChoiceSnapshot()).toBe("system");
        expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull();
        expect(notifications()).toBe(0);
      });
    });

    it("still changes the choice when the write throws", () => {
      withSubscriber((notifications) => {
        breakStorage("setItem");

        expect(() => {
          setLocaleChoice("es");
        }).not.toThrow();

        expect(getChoiceSnapshot()).toBe("es");
        expect(notifications()).toBe(1);
      });
    });

    it("still changes the choice when the removal throws", () => {
      localStorage.setItem(LOCALE_STORAGE_KEY, "es");

      withSubscriber(() => {
        breakStorage("removeItem");

        expect(() => {
          setLocaleChoice("system");
        }).not.toThrow();

        expect(getChoiceSnapshot()).toBe("system");
      });
    });
  });

  describe("the subscribers", () => {
    // The whole reason this is a store rather than a copy of the theme hook:
    // the picker in the header and the table below it both read it, and both
    // have to be told at once or the two disagree about what the page is in.
    it("notifies every subscriber registered at once", () => {
      withSubscriber((first) => {
        withSubscriber((second) => {
          setLocaleChoice("fr");

          expect(first()).toBe(1);
          expect(second()).toBe(1);
        });
      });
    });

    it("installs the window listeners with the first subscriber only", () => {
      const added = vi.spyOn(window, "addEventListener");

      withSubscriber(() => {
        expect(added).toHaveBeenCalledWith("storage", expect.any(Function));
        expect(added).toHaveBeenCalledWith(
          "languagechange",
          expect.any(Function),
        );

        const afterFirst = added.mock.calls.length;

        withSubscriber(() => {
          expect(added.mock.calls.length).toBe(afterFirst);
        });
      });
    });

    it("removes the window listeners with the last subscriber only", () => {
      const removed = vi.spyOn(window, "removeEventListener");

      withSubscriber(() => {
        withSubscriber(() => {
          // Nothing yet: one reader is leaving and one is staying.
        });

        expect(removed).not.toHaveBeenCalled();
      });

      expect(removed).toHaveBeenCalledWith("storage", expect.any(Function));
      expect(removed).toHaveBeenCalledWith(
        "languagechange",
        expect.any(Function),
      );
    });
  });

  describe("the other tabs", () => {
    it("follows a choice written by another document", () => {
      withSubscriber((notifications) => {
        localStorage.setItem(LOCALE_STORAGE_KEY, "fr");
        window.dispatchEvent(
          new StorageEvent("storage", { key: LOCALE_STORAGE_KEY }),
        );

        expect(getChoiceSnapshot()).toBe("fr");
        expect(notifications()).toBe(1);
      });
    });

    it("re-reads the store rather than trusting the value the event carries", () => {
      localStorage.setItem(LOCALE_STORAGE_KEY, "fr");

      withSubscriber(() => {
        localStorage.removeItem(LOCALE_STORAGE_KEY);
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: LOCALE_STORAGE_KEY,
            newValue: "es",
          }),
        );

        expect(getChoiceSnapshot()).toBe("system");
      });
    });

    it("ignores a write to any other key", () => {
      localStorage.setItem(LOCALE_STORAGE_KEY, "fr");

      withSubscriber((notifications) => {
        window.dispatchEvent(new StorageEvent("storage", { key: "unrelated" }));

        expect(getChoiceSnapshot()).toBe("fr");
        expect(notifications()).toBe(0);
      });
    });
  });

  // The reader can change what their machine asks for without reloading, and
  // under the system choice that moves the resolved locale with no write to
  // storage to announce it.
  it("re-reads when the machine's languages change", () => {
    withSubscriber((notifications) => {
      window.dispatchEvent(new Event("languagechange"));

      expect(notifications()).toBe(1);
    });
  });
});
