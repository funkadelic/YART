import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { es } from "../../i18n/catalogs/es";
import { LOCALE_STORAGE_KEY } from "../../i18n/resolveLocale";
import { setPrefersDark } from "../../test/matchMediaStub";
import { THEME_STORAGE_KEY } from "../../theme/resolveTheme";
import { Header } from "./Header";
import { ThemeControl } from "./ThemeControl";
import { required } from "../../test/required";

const OPTION_NAMES = ["Light", "Dark", "System"];

/** What the document element is carrying, which is what the whole page repaints from. */
function stampedTheme(): string | null {
  return document.documentElement.getAttribute("data-theme");
}

/** How many options are checked, which the group's semantics fix at exactly one. */
function checkedOptionCount(): number {
  return screen
    .getAllByRole("radio")
    .filter((option) => (option as HTMLInputElement).checked).length;
}

describe("ThemeControl", () => {
  it("renders one option per theme state and no more", () => {
    render(<ThemeControl />);

    expect(screen.getAllByRole("radio")).toHaveLength(OPTION_NAMES.length);

    for (const name of OPTION_NAMES) {
      expect(screen.getByRole("radio", { name })).toBeInTheDocument();
    }
  });

  // The three option names and the group's own name are copy, not state tokens:
  // the value the control writes stays the English word either way, which is
  // what the document element is stamped with and what storage holds.
  it("names the group and its three options in the chosen language", () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, "es");

    render(<ThemeControl />);

    expect(screen.getByRole("radiogroup")).toHaveAccessibleName(es.themeGroup);
    for (const name of [es.themeLight, es.themeDark, es.themeSystem]) {
      expect(screen.getByRole("radio", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("radio", { name: es.themeSystem })).toHaveAttribute(
      "value",
      "system",
    );
  });

  it("names the group, so the options are not three loose controls", () => {
    render(<ThemeControl />);

    expect(screen.getByRole("radiogroup")).toHaveAccessibleName(/theme/i);
  });

  it("checks System when nothing is stored", () => {
    render(<ThemeControl />);

    expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Light" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Dark" })).not.toBeChecked();
  });

  it("checks the stored choice and stamps it on the document element", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");

    render(<ThemeControl />);

    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
    expect(stampedTheme()).toBe("dark");
  });

  it("moves the document element in the same interaction as the selection", async () => {
    const user = userEvent.setup();
    render(<ThemeControl />);

    await user.click(screen.getByRole("radio", { name: "Light" }));

    expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "System" })).not.toBeChecked();
    expect(stampedTheme()).toBe("light");
  });

  it("resolves System against the operating system rather than assuming light", () => {
    setPrefersDark(true);

    render(<ThemeControl />);

    expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
    expect(stampedTheme()).toBe("dark");
  });

  it("moves the selection with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<ThemeControl />);

    await user.click(screen.getByRole("radio", { name: "Light" }));
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
    expect(stampedTheme()).toBe("dark");
  });

  it("wraps from the last option round to the first", async () => {
    const user = userEvent.setup();
    render(<ThemeControl />);

    await user.click(screen.getByRole("radio", { name: "System" }));
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
  });

  it("is a single tab stop, entered at the checked option", async () => {
    const user = userEvent.setup();
    render(
      <>
        <ThemeControl />
        <button type="button">Past the group</button>
      </>,
    );

    await user.tab();
    expect(screen.getByRole("radio", { name: "System" })).toHaveFocus();

    await user.tab();
    expect(
      screen.getByRole("button", { name: "Past the group" }),
    ).toHaveFocus();
  });

  it("keeps every option's accessible name fixed as the selection changes", async () => {
    const user = userEvent.setup();
    render(<ThemeControl />);

    await user.click(screen.getByRole("radio", { name: "Dark" }));

    for (const name of OPTION_NAMES) {
      expect(screen.getByRole("radio", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
    expect(checkedOptionCount()).toBe(1);
  });

  it("keeps two mounted controls out of each other's radio group", async () => {
    const user = userEvent.setup();
    render(
      <>
        <ThemeControl />
        <ThemeControl />
      </>,
    );

    const groups = screen.getAllByRole("radiogroup");
    const first = required(groups[0], "the first radiogroup");
    const second = required(groups[1], "the second radiogroup");
    const ids = screen
      .getAllByRole("radio")
      .map((radio) => radio.getAttribute("id"));

    // Duplicate ids are invalid HTML, and the label binding is what breaks
    // first: htmlFor finds the first matching input, so clicking the second
    // control's label would check the first control's radio.
    expect(new Set(ids).size).toBe(ids.length);

    await user.click(within(second).getByRole("radio", { name: "Dark" }));

    expect(within(second).getByRole("radio", { name: "Dark" })).toBeChecked();
    expect(
      within(first).getByRole("radio", { name: "Dark" }),
    ).not.toBeChecked();
    expect(within(first).getByRole("radio", { name: "System" })).toBeChecked();
  });

  it("is mounted in the header, so the page it themes is the page it sits on", () => {
    render(<Header />);

    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(OPTION_NAMES.length);
  });
});
