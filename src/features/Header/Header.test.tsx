import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Header } from "./Header";

describe("Header", () => {
  it("links to both datasets and marks the one being shown", () => {
    render(<Header domain="films" />);

    const nav = within(screen.getByRole("navigation", { name: "Datasets" }));

    expect(nav.getByRole("link", { name: "Cities" })).toHaveAttribute(
      "href",
      "./",
    );
    expect(nav.getByRole("link", { name: "Cities" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(nav.getByRole("link", { name: "Films" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
