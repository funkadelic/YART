import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LOCALE_STORAGE_KEY } from "../i18n/resolveLocale";
import { useLocale } from "./useLocale";

/**
 * Renders the hook on its own. No user input library and no controlled clock is
 * constructed in this file: the hook schedules nothing, so a failure here points
 * at the hook and not at the runner's timer handling.
 */
function renderLocale() {
  return renderHook(() => useLocale());
}

/** What the document element is actually carrying, which is the only readable proof. */
function stamped(): { lang: string; dir: string } {
  return {
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
  };
}

describe("useLocale", () => {
  it("negotiates the machine's preferences when the reader has chosen nothing", () => {
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["fr-CA", "en"]);

    const { result } = renderLocale();

    expect(result.current.choice).toBe("system");
    expect(result.current.tag).toBe("fr-FR");
  });

  it("reports the stored choice and the catalog it names", () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, "es");

    const { result } = renderLocale();

    expect(result.current.choice).toBe("es");
    expect(result.current.catalog.empty).toBe("No cities found");
  });

  describe("stamping the document element", () => {
    it("carries the resolved tag and direction", () => {
      const { result } = renderLocale();

      expect(stamped()).toEqual({ lang: "en-US", dir: "ltr" });
      expect(result.current.dir).toBe("ltr");
    });

    it("follows a choice the reader makes", () => {
      const { result } = renderLocale();

      act(() => {
        result.current.setChoice("ar-XB");
      });

      // The pseudo-locale's strings are English, so its tag is English and only
      // its direction is borrowed.
      expect(stamped()).toEqual({ lang: "en-US", dir: "rtl" });
      expect(result.current.choice).toBe("ar-XB");
    });

    // The theme hook beside this one is single instance by construction, and its
    // own documentation says a second caller would race the first. This one is
    // the opposite claim, so it is asserted rather than assumed: both callers
    // read one store, so both write the same pair.
    it("agrees with a second caller in the same tree", () => {
      const both = renderHook(() => [useLocale(), useLocale()] as const);

      act(() => {
        both.result.current[0].setChoice("fr");
      });

      const [first, second] = both.result.current;

      expect(second.tag).toBe(first.tag);
      expect(second.dir).toBe(first.dir);
      expect(stamped()).toEqual({ lang: "fr-FR", dir: "ltr" });
    });
  });

  it("follows a choice written by another document", () => {
    const { result } = renderLocale();

    act(() => {
      localStorage.setItem(LOCALE_STORAGE_KEY, "fr");
      window.dispatchEvent(
        new StorageEvent("storage", { key: LOCALE_STORAGE_KEY }),
      );
    });

    expect(result.current.choice).toBe("fr");
    expect(stamped().lang).toBe("fr-FR");
  });
});
