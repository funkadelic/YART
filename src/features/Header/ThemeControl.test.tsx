import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { setPrefersDark } from "../../../vitest.setup";
import { THEME_STORAGE_KEY } from "../../theme/resolveTheme";
import { Header } from "./Header";
import { ThemeControl } from "./ThemeControl";

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

  it("is mounted in the header, so the page it themes is the page it sits on", () => {
    render(<Header />);

    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(OPTION_NAMES.length);
  });
});
