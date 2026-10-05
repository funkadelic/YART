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
 * Every case goes through here because the store is a module singleton and the
 * file is one module instance, so the choice one case leaves behind would be the
 * state the next case starts from. Subscribing re-reads the store, so a case
 * that seeds storage first sees what it seeded. The finally stops a failing case
 * from leaving a listener behind for the case after it.
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
