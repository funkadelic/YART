import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Footer } from "./Footer";

/**
 * The footer attribution is a licence obligation, not decoration. This file is
 * what stops it being removed by a refactor that does not know why it is there:
 * delete either anchor, or reword the modification sentence, and these cases go
 * red instead of the repository quietly falling out of compliance.
 *
 * Every assertion reads the accessible name and the href rather than the markup
 * structure, so a later phase can restyle the footer without touching this file.
 * Accessible-name matching normalizes whitespace, so a line wrap in the JSX
 * cannot flap these.
 */

/** Rendered text with runs of whitespace collapsed, so JSX line wrapping is invisible. */
function normalize(text: string | null): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

describe("Footer", () => {
  it("links the dataset source under the name the source uses", () => {
    render(<Footer />);

    expect(
      screen.getByRole("link", { name: "simplemaps.com World Cities" }),
    ).toHaveAttribute("href", "https://simplemaps.com/data/world-cities");
  });

  it("names the licence and links its deed", () => {
    render(<Footer />);

    expect(screen.getByRole("link", { name: "CC BY 4.0" })).toHaveAttribute(
      "href",
      "https://creativecommons.org/licenses/by/4.0/",
    );
  });

  it("states that the data was modified and names both modifications", () => {
    const { container } = render(<Footer />);

    expect(normalize(container.textContent)).toBe(
      "City data from simplemaps.com World Cities, licensed CC BY 4.0. " +
        "Modified: unused columns removed, rows ordered by population.",
    );
  });

  it("keeps the attribution in the accessibility tree", () => {
    render(<Footer />);

    for (const name of ["simplemaps.com World Cities", "CC BY 4.0"]) {
      const link = screen.getByRole("link", { name });

      // closest matches the element itself as well as its ancestors, so this
      // covers both a hidden link and a link hidden by whatever wraps it.
      expect(link.closest("[aria-hidden]")).toBeNull();
    }
  });

  it("renders both links with no props supplied", () => {
    render(<Footer />);

    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});
