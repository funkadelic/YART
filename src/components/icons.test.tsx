import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  FirstPageIcon,
  LastPageIcon,
  SearchIcon,
} from "./icons.js";

const ICONS = [
  ["SearchIcon", SearchIcon],
  ["ChevronUpIcon", ChevronUpIcon],
  ["ChevronDownIcon", ChevronDownIcon],
  ["ChevronLeftIcon", ChevronLeftIcon],
  ["ChevronRightIcon", ChevronRightIcon],
  ["FirstPageIcon", FirstPageIcon],
  ["LastPageIcon", LastPageIcon],
] as const;

describe("icons", () => {
  it.each(ICONS)("%s renders one em-square currentColor svg", (_, Icon) => {
    const { container } = render(<Icon />);

    expect(container.children).toHaveLength(1);
    const svg = container.children[0];
    expect(svg?.tagName.toLowerCase()).toBe("svg");
    expect(svg).toHaveAttribute("width", "1em");
    expect(svg).toHaveAttribute("height", "1em");
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(svg).toHaveAttribute("fill", "none");
    expect(svg).toHaveAttribute("stroke", "currentColor");
    expect(svg).toHaveAttribute("focusable", "false");
    expect(svg).not.toHaveAttribute("class");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it.each(ICONS)("%s passes className through", (_, Icon) => {
    const { container } = render(<Icon className="glyph" />);

    expect(container.children[0]).toHaveClass("glyph");
  });
});
