import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { mediaListenerCount, setPrefersDark } from "../../vitest.setup";
import { THEME_STORAGE_KEY } from "../theme/resolveTheme";
import { useTheme } from "./useTheme";

/**
 * Renders the hook on its own. No user input library and no controlled clock is
 * constructed in this file: the hook schedules nothing, so a failure here points
 * at the hook and not at the runner's timer handling.
 */
function renderTheme() {
  return renderHook(() => useTheme());
}

/** What the document element is actually carrying, which is the only readable proof. */
function stampedTheme(): string | null {
  return document.documentElement.getAttribute("data-theme");
}

/**
 * The inline colour scheme, which is the half of the stamp that decides native
 * control and scrollbar appearance.
 */
function stampedColorScheme(): string {
  return document.documentElement.style.colorScheme;
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

describe("useTheme", () => {
  describe("the stored choice", () => {
    it("reports light when the store holds light", () => {
      localStorage.setItem(THEME_STORAGE_KEY, "light");

      const { result } = renderTheme();

      expect(result.current.choice).toBe("light");
    });

    it("reports dark when the store holds dark", () => {
      localStorage.setItem(THEME_STORAGE_KEY, "dark");

      const { result } = renderTheme();

      expect(result.current.choice).toBe("dark");
    });

    it("reports system when the key is absent", () => {
      const { result } = renderTheme();

      expect(result.current.choice).toBe("system");
    });

    it.each(["blue", "", "SYSTEM"])(
      "treats the stored value %o as absent",
      (stored) => {
        localStorage.setItem(THEME_STORAGE_KEY, stored);

        const { result } = renderTheme();

        expect(result.current.choice).toBe("system");
      },
    );

    it("treats an unreadable store as absent rather than letting the read escape", () => {
      breakStorage("getItem");

      const { result } = renderTheme();

      expect(result.current.choice).toBe("system");
    });
  });

  describe("writing the choice back", () => {
    it("writes the chosen word verbatim", () => {
      const { result } = renderTheme();

      act(() => {
        result.current.setChoice("dark");
      });

      expect(result.current.choice).toBe("dark");
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    });

    it("removes the key for system rather than writing the word", () => {
      localStorage.setItem(THEME_STORAGE_KEY, "dark");
      const { result } = renderTheme();

      act(() => {
        result.current.setChoice("system");
      });

      expect(result.current.choice).toBe("system");
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    });

    it("still changes the choice when the write throws", () => {
      const { result } = renderTheme();
      breakStorage("setItem");

      expect(() => {
        act(() => {
          result.current.setChoice("dark");
        });
      }).not.toThrow();

      expect(result.current.choice).toBe("dark");
      expect(stampedTheme()).toBe("dark");
    });
  });

  describe("stamping the document element", () => {
    it("resolves the system choice to light when the operating system prefers light", () => {
      const { result } = renderTheme();

      expect(result.current.resolved).toBe("light");
      expect(stampedTheme()).toBe("light");
      expect(stampedColorScheme()).toBe("light");
    });

    it("resolves the system choice to dark when the operating system prefers dark", () => {
      setPrefersDark(true);

      const { result } = renderTheme();

      expect(result.current.resolved).toBe("dark");
      expect(stampedTheme()).toBe("dark");
      expect(stampedColorScheme()).toBe("dark");
    });

    it("follows an operating system change while the choice is system", () => {
      renderTheme();
      expect(stampedTheme()).toBe("light");

      act(() => {
        setPrefersDark(true);
      });

      expect(stampedTheme()).toBe("dark");
      expect(stampedColorScheme()).toBe("dark");
    });

    it("ignores an operating system change while the choice is explicit", () => {
      localStorage.setItem(THEME_STORAGE_KEY, "light");
      renderTheme();

      act(() => {
        setPrefersDark(true);
      });

      expect(stampedTheme()).toBe("light");
      expect(stampedColorScheme()).toBe("light");
    });
  });

  describe("the operating system subscription", () => {
    it("releases its listener on unmount", () => {
      const { unmount } = renderTheme();
      expect(mediaListenerCount()).toBe(1);

      unmount();

      expect(mediaListenerCount()).toBe(0);
    });

    it("treats an absent matchMedia as a light preference and subscribes to nothing", () => {
      vi.stubGlobal("matchMedia", undefined);

      const { result } = renderTheme();

      expect(result.current.resolved).toBe("light");
      expect(stampedTheme()).toBe("light");
      expect(mediaListenerCount()).toBe(0);
    });
  });
});
