import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CityTable } from "../CityTable";
import { en } from "../../i18n/catalogs/en";
import { fr } from "../../i18n/catalogs/fr";
import { LOCALE_STORAGE_KEY } from "../../i18n/resolveLocale";
import { LocaleControl } from "./LocaleControl";

/**
 * The options in the order the control offers them: following the machine
 * first, then one catalog per option named in its own language.
 */
const OPTION_NAMES = [
  "System",
  "English",
  "Español",
  "Français",
  "Pseudo (RTL)",
];

/**
 * The picker itself, found by its role alone. Its name now follows the chosen
 * language, so finding it by an English name would fail in exactly the cases
 * that choose another one. That the control has a name at all, and that the name
 * is translated, is asserted on its own below.
 */
function picker(): HTMLSelectElement {
  return screen.getByRole("combobox");
}

/** What the document element is carrying, which is what the page renders from. */
function stamped(): { lang: string; dir: string } {
  return {
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
  };
}

describe("LocaleControl", () => {
  it("offers one option per catalog plus the machine, in order", () => {
    render(<LocaleControl />);

    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(OPTION_NAMES);
  });

  it("names the control, so the picker is not an unlabelled dropdown", () => {
    render(<LocaleControl />);

    expect(picker()).toHaveAccessibleName(en.common.languageName);
  });

  it("names itself, and the machine, in the chosen language", () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, "fr");

    render(<LocaleControl />);

    expect(picker()).toHaveAccessibleName(fr.common.languageName);
    // The option naming the machine is copy. The autonyms beside it are not,
    // and stay in the language each of them names.
    expect(
      screen.getByRole("option", { name: fr.common.languageSystem }),
    ).toHaveValue("system");
    expect(screen.getByRole("option", { name: "Español" })).toBeInTheDocument();
  });

  it("follows the machine by default", () => {
    render(<LocaleControl />);

    expect(picker()).toHaveValue("system");
  });

  it("paints the stored choice as selected", () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, "fr");

    render(<LocaleControl />);

    expect(picker()).toHaveValue("fr");
  });

  describe("choosing a language", () => {
    it("persists the choice and repaints the document in it", async () => {
      const user = userEvent.setup();
      render(<LocaleControl />);

      await user.selectOptions(picker(), "fr");

      expect(picker()).toHaveValue("fr");
      expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("fr");
      expect(stamped()).toEqual({ lang: "fr-FR", dir: "ltr" });
    });

    // The one option that is not a language. Its strings stay English, which is
    // what makes it reviewable, and only the direction moves.
    it("turns the document around for the pseudo-locale", async () => {
      const user = userEvent.setup();
      render(<LocaleControl />);

      await user.selectOptions(picker(), "ar-XB");

      expect(stamped()).toEqual({ lang: "en-US", dir: "rtl" });
    });

    it("removes the key for the machine rather than storing the word", async () => {
      const user = userEvent.setup();
      localStorage.setItem(LOCALE_STORAGE_KEY, "es");
      render(<LocaleControl />);

      await user.selectOptions(picker(), "system");

      expect(picker()).toHaveValue("system");
      expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull();
    });
  });

  it("follows a choice made in another tab", () => {
    render(<LocaleControl />);

    act(() => {
      localStorage.setItem(LOCALE_STORAGE_KEY, "es");
      window.dispatchEvent(
        new StorageEvent("storage", { key: LOCALE_STORAGE_KEY }),
      );
    });

    expect(picker()).toHaveValue("es");
  });

  // The whole seam in one case: the picker in the header and the table below it
  // are two separate subscribers to one store, so choosing here has to repaint
  // there. Two hooks holding their own copy of the choice would pass every case
  // above and fail this one.
  it("repaints the table below it in the chosen language", async () => {
    const user = userEvent.setup();

    render(
      <>
        <LocaleControl />
        <CityTable
          data={[]}
          onSearchChange={() => {}}
          loading={false}
          datasetReady={false}
          errorMessage={null}
        />
      </>,
    );

    await user.selectOptions(picker(), "fr");

    expect(screen.getByText(fr.cities.loading)).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("fr-FR");
  });
});
