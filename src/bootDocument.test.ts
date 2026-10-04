import { describe, expect, it, vi } from "vitest";

import { BOOT_SETTINGS, bootDocument, bootScript } from "./bootDocument";
import { resolveLocale } from "./i18n/resolveLocale";
import { setPrefersDark } from "./test/matchMediaStub";

// Restated as literals so a renamed key fails here instead of passing for
// whatever the subject holds.
const THEME_KEY = "yart-theme";
const LOCALE_KEY = "yart-locale";

/** What the document element carries after a boot. */
function stamped() {
  const root = document.documentElement;

  return {
    theme: root.getAttribute("data-theme"),
    colorScheme: root.style.colorScheme,
    lang: root.getAttribute("lang"),
    dir: root.getAttribute("dir"),
  };
}

/** Makes every storage read throw, the shape blocked site data takes. */
function breakStorage(): void {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("site data is blocked");
  });
}

/** What the reader's machine says it wants, for one case. */
function preferLanguages(languages: readonly string[]): void {
  vi.spyOn(navigator, "languages", "get").mockReturnValue(languages);
}

describe("bootDocument", () => {
  describe("the theme", () => {
    it("takes a stored dark over a light system preference", () => {
      localStorage.setItem(THEME_KEY, "dark");

      bootDocument(BOOT_SETTINGS);

      expect(stamped().theme, "stored dark was not stamped").toBe("dark");
      expect(stamped().colorScheme, "color-scheme did not follow").toBe("dark");
    });

    it("takes a stored light over a dark system preference", () => {
      localStorage.setItem(THEME_KEY, "light");
      setPrefersDark(true);

      bootDocument(BOOT_SETTINGS);

      expect(stamped().theme, "stored light was not stamped").toBe("light");
    });

    it.each([
      ["nothing stored", null],
      ["a stored system", "system"],
      ["an unknown word", "blue"],
    ])("follows the system preference with %s", (_label, stored) => {
      if (stored !== null) {
        localStorage.setItem(THEME_KEY, stored);
      }

      bootDocument(BOOT_SETTINGS);
      expect(stamped().theme, "light preference not followed").toBe("light");

      setPrefersDark(true);
      bootDocument(BOOT_SETTINGS);
      expect(stamped().theme, "dark preference not followed").toBe("dark");
    });

    it("falls to light without matchMedia", () => {
      vi.stubGlobal("matchMedia", undefined);

      bootDocument(BOOT_SETTINGS);

      expect(stamped().theme, "missing matchMedia was not light").toBe("light");
    });
  });

  describe("the locale", () => {
    it("maps the stored pseudo-locale to an English tag, right to left", () => {
      localStorage.setItem(LOCALE_KEY, "ar-XB");

      bootDocument(BOOT_SETTINGS);

      expect(stamped().lang, "pseudo-locale tag drifted").toBe("en-US");
      expect(stamped().dir, "pseudo-locale direction drifted").toBe("rtl");
    });

    it("maps a stored es to its tag", () => {
      localStorage.setItem(LOCALE_KEY, "es");

      bootDocument(BOOT_SETTINGS);

      expect(stamped().lang, "stored es tag drifted").toBe("es-ES");
      expect(stamped().dir, "stored es direction drifted").toBe("ltr");
    });

    it.each(["toString", "__proto__"])(
      "ignores a stored inherited key %s",
      (stored) => {
        localStorage.setItem(LOCALE_KEY, stored);
        preferLanguages(["fr"]);

        bootDocument(BOOT_SETTINGS);

        expect(stamped().lang, "inherited key reached the lookup").toBe(
          "fr-FR",
        );
      },
    );

    it("takes the first supported primary subtag, case-insensitively", () => {
      preferLanguages(["de-DE", "FR-ca", "en"]);

      bootDocument(BOOT_SETTINGS);

      expect(stamped().lang, "preference walk drifted").toBe("fr-FR");
    });

    it("never negotiates the pseudo-locale", () => {
      preferLanguages(["ar-EG"]);

      bootDocument(BOOT_SETTINGS);

      expect(stamped().lang, "ar negotiated the pseudo-locale").toBe("en-US");
      expect(stamped().dir, "ar negotiated right to left").toBe("ltr");
    });

    it("falls to English with no preferences", () => {
      preferLanguages([]);

      bootDocument(BOOT_SETTINGS);

      expect(stamped().lang, "empty preferences fallback drifted").toBe(
        "en-US",
      );
      expect(stamped().dir, "empty preferences direction drifted").toBe("ltr");
    });

    it.each([
      [["de-DE", "FR-ca", "en"]],
      [["ar-EG"]],
      [[]],
      [["es-419", "en"]],
      [["pt-BR"]],
    ])("agrees with resolveLocale for %j", (preferences) => {
      preferLanguages(preferences);

      bootDocument(BOOT_SETTINGS);
      const expected = resolveLocale("system", preferences);

      expect(stamped().lang, "lang disagrees with the resolver").toBe(
        expected.tag,
      );
      expect(stamped().dir, "dir disagrees with the resolver").toBe(
        expected.dir,
      );
    });
  });

  it("still reads the system preference and languages when storage throws", () => {
    breakStorage();
    setPrefersDark(true);
    preferLanguages(["es"]);

    bootDocument(BOOT_SETTINGS);

    expect(stamped().theme, "blocked storage skipped the preference").toBe(
      "dark",
    );
    expect(stamped().lang, "blocked storage skipped the languages").toBe(
      "es-ES",
    );
  });

  it("runs as serialized text in global scope", () => {
    localStorage.setItem(THEME_KEY, "dark");
    localStorage.setItem(LOCALE_KEY, "ar-XB");
    // Indirect eval runs in global scope, so module bindings are unreachable.
    const globalEval = globalThis.eval;

    globalEval(bootScript());

    expect(stamped(), "the serialized script is not self-contained").toEqual({
      theme: "dark",
      colorScheme: "dark",
      lang: "en-US",
      dir: "rtl",
    });
  });
});
