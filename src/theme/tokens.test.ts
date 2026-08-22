// @vitest-environment node
//
// The stylesheet is the single source of truth for every colour in the app, so
// this guard reads the shipped file rather than a copy of its values. Node
// rather than the DOM environment for two measured reasons: the runner replaces
// CSS imports with empty strings, so nothing is loaded into a document to
// inspect; and jsdom does not substitute var() in getComputedStyle, so even a
// mounted page would hand back the literal string "var(--gray-50)" instead of a
// colour. Resolving the indirection here is the only way to assert on the values
// that actually reach a screen.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

import { THEME_STORAGE_KEY } from "./resolveTheme";

// Resolved from this file's own location rather than from the working directory,
// which is wherever the runner happened to be invoked and is not the project root
// under an IDE runner or an explicit root argument.
const here = import.meta as ImportMeta & { dirname: string };
const projectRoot = join(here.dirname, "..", "..");
const cssPath = join(projectRoot, "src", "index.css");
const htmlPath = join(projectRoot, "index.html");

const LIGHT_SELECTOR = ":root";
const DARK_SELECTOR = ':root[data-theme="dark"]';

// The two thresholds from the contrast success criteria: 4.5:1 where the pair
// carries text, 3:1 where it is a border, a gridline or the focus ring. Neither
// number is ever moved to accommodate a failing pair, and no pair is ever added
// to an allowlist to keep this file green. A ratio below the line is a colour
// choice to redo, not a threshold to renegotiate.
const TEXT_CONTRAST_MINIMUM = 4.5;
const NON_TEXT_CONTRAST_MINIMUM = 3;

// The logo is the same two colours in both themes by design, so these two are
// the complete exemption list for the partner assertion. Two entries, named
// here rather than derived: a list that grows quietly is how the guard stops
// being one.
const THEME_INVARIANT_TOKENS = ["--color-brand", "--color-brand-contrast"];

// Only the exact bare form. A fallback argument such as var(--x, #abc) would let
// a missing primitive ship a working colour with the chain silently broken, so
// the resolver never gets the chance to report it.
const BARE_INDIRECTION = /^var\(\s*(--[\w-]+)\s*\)$/;

const IS_COLOR_TOKEN = /^--color-/;

/** Every declaration in the file, keyed by selector then by property. */
function readBlocks(): Map<string, Map<string, string>> {
  const blocks = new Map<string, Map<string, string>>();

  postcss
    .parse(readFileSync(cssPath, "utf8"), { from: cssPath })
    .walkRules((rule) => {
      const declarations =
        blocks.get(rule.selector) ?? new Map<string, string>();
      rule.walkDecls((declaration) => {
        declarations.set(declaration.prop, declaration.value.trim());
      });
      blocks.set(rule.selector, declarations);
    });

  return blocks;
}

const blocks = readBlocks();

function requireBlock(selector: string): Map<string, string> {
  const block = blocks.get(selector);
  if (block === undefined) {
    throw new Error(`src/index.css declares no ${selector} block`);
  }
  return block;
}

const lightBlock = requireBlock(LIGHT_SELECTOR);
const darkOverrides = requireBlock(DARK_SELECTOR);

// The dark theme as a browser sees it: the overrides layered onto the base, so
// a token the dark block leaves alone still resolves through its light value.
const darkBlock = new Map([...lightBlock, ...darkOverrides]);

const THEMES: Array<[string, Map<string, string>]> = [
  ["light", lightBlock],
  ["dark", darkBlock],
];

/**
 * A token followed through the semantic tier to the primitive value it names.
 * Throws rather than skips on an undeclared reference or a cycle: either one
 * means the layering is broken, and a guard that stayed silent about it would
 * be reporting on a stylesheet nobody ships.
 */
function resolve(
  property: string,
  scope: Map<string, string>,
  seen = new Set<string>(),
): string {
  if (seen.has(property)) {
    throw new Error(`token cycle reached ${property}`);
  }
  seen.add(property);

  const value = scope.get(property);
  if (value === undefined) {
    throw new Error(`${property} is not declared`);
  }

  const indirection = BARE_INDIRECTION.exec(value);
  return indirection ? resolve(indirection[1], scope, seen) : value;
}

// Relative luminance and contrast ratio, straight from the specification. Five
// lines of arithmetic; a package for it would be a runtime dependency standing
// behind a build-time assertion.
function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const digits = hex.replace("#", "");
  const full =
    digits.length === 3
      ? [...digits].map((digit) => digit + digit).join("")
      : digits;
  const [red, green, blue] = [0, 2, 4].map((offset) =>
    channel(parseInt(full.slice(offset, offset + 2), 16)),
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * The curated pair set: the semantic pairings the app actually renders, not the
 * cross product. Muted text, the accent and the error colour never sit on the
 * hover fill, only inherited body text does, and the focus ring sits outside the
 * border box on the parent surface rather than on the fill it surrounds.
 *
 * The two logo rows are measured by choice. The non-text contrast criterion
 * exempts logos and logotypes outright, so if a future surface change turns
 * either one red the correct answer is to drop the exempt pair deliberately,
 * never to lower a threshold to keep it.
 */
const PAIRS: Array<[string, string, number]> = [
  ["--color-text", "--color-surface", TEXT_CONTRAST_MINIMUM],
  ["--color-text", "--color-surface-raised", TEXT_CONTRAST_MINIMUM],
  ["--color-text", "--color-surface-hover", TEXT_CONTRAST_MINIMUM],
  ["--color-text-muted", "--color-surface", TEXT_CONTRAST_MINIMUM],
  ["--color-text-muted", "--color-surface-raised", TEXT_CONTRAST_MINIMUM],
  ["--color-accent", "--color-surface", TEXT_CONTRAST_MINIMUM],
  ["--color-accent", "--color-surface-raised", TEXT_CONTRAST_MINIMUM],
  ["--color-error", "--color-surface", TEXT_CONTRAST_MINIMUM],
  ["--color-error", "--color-surface-raised", TEXT_CONTRAST_MINIMUM],
  ["--color-border", "--color-surface", NON_TEXT_CONTRAST_MINIMUM],
  ["--color-border", "--color-surface-raised", NON_TEXT_CONTRAST_MINIMUM],
  ["--color-border", "--color-surface-hover", NON_TEXT_CONTRAST_MINIMUM],
  ["--color-focus-ring", "--color-surface", NON_TEXT_CONTRAST_MINIMUM],
  ["--color-focus-ring", "--color-surface-raised", NON_TEXT_CONTRAST_MINIMUM],
  ["--color-brand", "--color-surface", NON_TEXT_CONTRAST_MINIMUM],
  ["--color-brand-contrast", "--color-brand", NON_TEXT_CONTRAST_MINIMUM],
];

function colorTokens(block: Map<string, string>): string[] {
  return [...block.keys()].filter((property) => IS_COLOR_TOKEN.test(property));
}

describe("token layering", () => {
  it("gives every colour token a partner in the other theme", () => {
    const inLight = colorTokens(lightBlock);
    const inDark = colorTokens(darkOverrides);

    expect(
      inLight.length,
      "the light block declares no colour tokens",
    ).toBeGreaterThan(0);

    for (const token of inLight) {
      if (THEME_INVARIANT_TOKENS.includes(token)) continue;
      expect(
        inDark,
        `${token} is declared for light with no dark partner`,
      ).toContain(token);
    }

    for (const token of inDark) {
      expect(
        inLight,
        `${token} is declared for dark and never for light`,
      ).toContain(token);
    }

    // The exemption is only defensible while it stays the two logo colours. A
    // third entry means a token went theme-invariant without anyone deciding it.
    for (const token of THEME_INVARIANT_TOKENS) {
      expect(
        inDark,
        `${token} is exempt from the partner rule but the dark block overrides it anyway`,
      ).not.toContain(token);
    }
  });

  it("declares every colour token as a bare indirection onto a primitive", () => {
    for (const [theme, block] of [
      ["light", lightBlock],
      ["dark", darkOverrides],
    ] as const) {
      for (const token of colorTokens(block)) {
        const value = block.get(token);
        expect(
          value,
          `${token} in ${theme} is ${String(value)} rather than a bare var() onto a primitive`,
        ).toMatch(BARE_INDIRECTION);
      }
    }
  });

  it("resolves every colour token to a concrete value in both themes", () => {
    for (const [theme, block] of THEMES) {
      for (const token of colorTokens(lightBlock)) {
        expect(
          resolve(token, block),
          `${token} in ${theme} does not resolve to a colour`,
        ).toMatch(/^#[0-9a-f]{3,8}$/i);
      }
    }
  });

  it("reports an undeclared reference and a cycle rather than passing over them", () => {
    expect(() => resolve("--color-missing", lightBlock)).toThrow(
      "--color-missing is not declared",
    );

    const cyclic = new Map([
      ["--a", "var(--b)"],
      ["--b", "var(--a)"],
    ]);
    expect(() => resolve("--a", cyclic)).toThrow("token cycle");
  });

  it("declares a concrete color-scheme in each theme block", () => {
    expect(
      lightBlock.get("color-scheme"),
      "the light block does not declare color-scheme: light",
    ).toBe("light");
    expect(
      darkOverrides.get("color-scheme"),
      "the dark block does not declare color-scheme: dark",
    ).toBe("dark");
  });

  it("qualifies the dark block by attribute so specificity is what makes it win", () => {
    // Asserted as the selector rather than as source order: a block that only
    // wins by sitting later in the file starts losing the moment anything is
    // appended after it.
    expect([...blocks.keys()]).toContain(DARK_SELECTOR);
  });
});

describe("contrast", () => {
  for (const [theme, block] of THEMES) {
    for (const [foreground, background, minimum] of PAIRS) {
      it(`clears ${minimum}:1 for ${foreground} on ${background} in ${theme}`, () => {
        // Compared without rounding: the specification is explicit that 2.999:1
        // does not meet a 3:1 threshold, and a ratio landing exactly on the line
        // passes.
        expect(
          contrastRatio(resolve(foreground, block), resolve(background, block)),
          `${foreground} on ${background} in ${theme}`,
        ).toBeGreaterThanOrEqual(minimum);
      });
    }
  }
});

describe("the theme script in index.html", () => {
  const html = readFileSync(htmlPath, "utf8");
  const headStart = html.indexOf("<head>");
  const headEnd = html.indexOf("</head>");
  const head = html.slice(headStart, headEnd);

  // Attribute-free by construction: type="module", defer and async each defer
  // the script past first paint, and each fails silently rather than loudly, so
  // the guard looks for a script carrying no attributes at all.
  const blocking = [...head.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter((match) => match[1].trim() === "")
    .map((match) => ({
      body: match[2],
      offset: headStart + (match.index ?? 0),
    }));

  it("carries exactly one blocking classic script inside the head", () => {
    expect(
      blocking.length,
      "index.html has no attribute-free script in its head, so the theme lands after first paint",
    ).toBe(1);
  });

  it("places it before the module script", () => {
    const moduleScript = html.search(/<script[^>]*\btype=["']module["']/);

    expect(moduleScript, "index.html loads no module script").toBeGreaterThan(
      -1,
    );
    expect(
      blocking[0].offset,
      "the theme script does not precede the module script",
    ).toBeLessThan(moduleScript);
  });

  // A presence check on the shared literal, not an agreement test between the
  // script and the resolver. The two implementations of the resolve rule are a
  // known, accepted duplication; this only catches the storage key drifting.
  it("reads the same storage key the resolver exports", () => {
    expect(
      blocking[0].body,
      `the theme script does not mention the storage key ${THEME_STORAGE_KEY}`,
    ).toContain(THEME_STORAGE_KEY);
  });
});
