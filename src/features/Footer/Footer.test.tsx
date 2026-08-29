import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { en } from "../../i18n/catalogs/en";
import { es } from "../../i18n/catalogs/es";
import { LOCALE_STORAGE_KEY } from "../../i18n/resolveLocale";
import { Footer } from "./Footer";

/** The two identifiers the sentence carries verbatim in every language. */
const SOURCE_NAME = "simplemaps.com World Cities";
const LICENSE_NAME = "CC BY 4.0";

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
 *
 * The sentence itself is asserted against the catalog entry rather than against
 * a literal restating it. A literal here would be a second copy of the copy, and
 * the two would drift the first time a word changed. What is asserted is the
 * obligation: whatever the sentence says, both identifiers are in it and both
 * are links, in every language.
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

  it("renders the catalog's whole attribution sentence, modifications included", () => {
    const { container } = render(<Footer />);

    expect(normalize(container.textContent)).toBe(
      normalize(en.attribution(SOURCE_NAME, LICENSE_NAME)),
    );
    expect(normalize(container.textContent)).toContain("Modified:");
  });

  it("carries the same four obligations in a second language", () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, "es");

    const { container } = render(<Footer />);

    expect(normalize(container.textContent)).toBe(
      normalize(es.attribution(SOURCE_NAME, LICENSE_NAME)),
    );
    // The sentence is translated; the source name, the licence identifier and
    // both addresses are not. They are identifiers rather than copy.
    expect(screen.getByRole("link", { name: SOURCE_NAME })).toHaveAttribute(
      "href",
      "https://simplemaps.com/data/world-cities",
    );
    expect(screen.getByRole("link", { name: LICENSE_NAME })).toHaveAttribute(
      "href",
      "https://creativecommons.org/licenses/by/4.0/",
    );
    expect(normalize(container.textContent)).toContain("Modificado:");
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
