import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { en } from "../../i18n/catalogs/en";
import { es } from "../../i18n/catalogs/es";
import { LOCALE_STORAGE_KEY } from "../../i18n/resolveLocale";
import { Footer } from "./Footer";

/** The four identifiers the sentences carry verbatim in every language. */
const CITIES_SOURCE = "simplemaps.com World Cities";
const CITIES_LICENSE = "CC BY 4.0";
const FILMS_SOURCE = "Wikidata";
const FILMS_LICENSE = "CC0 1.0";

/** Each identifier and the address it has to point at, whatever language it sits in. */
const LINKS = [
  [CITIES_SOURCE, "https://simplemaps.com/data/world-cities"],
  [CITIES_LICENSE, "https://creativecommons.org/licenses/by/4.0/"],
  [FILMS_SOURCE, "https://www.wikidata.org/"],
  [FILMS_LICENSE, "https://creativecommons.org/publicdomain/zero/1.0/"],
] as const;

/**
 * The city attribution is a license obligation and the film credit is a
 * courtesy the upstream data access page asks for. These cases stop either
 * being removed by a refactor that does not know why it is there: delete an
 * anchor, or reword a modification sentence, and they go red instead of the
 * repository quietly falling out of compliance.
 *
 * Every assertion reads the accessible name and the href, never the markup
 * structure, so a later change can restyle the footer without touching this
 * file. Accessible-name matching normalizes whitespace, so a line wrap in the
 * JSX cannot flap these.
 *
 * The sentences themselves are asserted against the catalog entries. A literal
 * restating them would be a second copy of the copy, and the two would drift
 * the first time a word changed. So whatever the sentences say, all four
 * identifiers are in them and all four are links, in every language.
 */

/** Rendered text with runs of whitespace collapsed, so JSX line wrapping is invisible. */
function normalize(text: string | null): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

describe("Footer", () => {
  it("links every source and licence under the name that source uses", () => {
    render(<Footer />);

    for (const [name, href] of LINKS) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
  });

  it("renders both catalog sentences whole, modifications included", () => {
    const { container } = render(<Footer />);
    const rendered = normalize(container.textContent);

    expect(rendered).toContain(
      normalize(en.cities.attribution(CITIES_SOURCE, CITIES_LICENSE)),
    );
    expect(rendered).toContain(
      normalize(en.films.attribution(FILMS_SOURCE, FILMS_LICENSE)),
    );
    expect(rendered).toContain("Modified:");
  });

  // Crediting a source that requires no credit misleads if it reads as an
  // obligation the project is discharging. The sentence has to say which it is,
  // because the license names in the footer look alike to a reader.
  it("says the film credit is a courtesy rather than a requirement", () => {
    const { container } = render(<Footer />);

    expect(normalize(container.textContent)).toContain(
      "Credited as a courtesy",
    );
  });

  it("carries the same obligations in a second language", () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, "es");

    const { container } = render(<Footer />);
    const rendered = normalize(container.textContent);

    expect(rendered).toContain(
      normalize(es.cities.attribution(CITIES_SOURCE, CITIES_LICENSE)),
    );
    expect(rendered).toContain(
      normalize(es.films.attribution(FILMS_SOURCE, FILMS_LICENSE)),
    );
    // The sentences are translated; the source names, the license identifiers
    // and the addresses are not, because they are identifiers and not copy.
    for (const [name, href] of LINKS) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
    expect(rendered).toContain("Modificado:");
  });

  it("keeps both attributions in the accessibility tree", () => {
    render(<Footer />);

    for (const [name] of LINKS) {
      const link = screen.getByRole("link", { name });

      // closest matches the element itself as well as its ancestors, so this
      // covers both a hidden link and a link hidden by whatever wraps it.
      expect(link.closest("[aria-hidden]")).toBeNull();
    }
  });

  it("renders every link with no props supplied", () => {
    render(<Footer />);

    expect(screen.getAllByRole("link")).toHaveLength(LINKS.length);
  });
});
