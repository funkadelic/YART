// @vitest-environment node
//
// Token layering and contrast, the theme script's placement in index.html, and
// the halves of the stylesheet rules stylelint has no way to express: an SCSS
// variable declared in a component sheet, a reference to a retired token, the
// global sheet's bounded px count, and the positive claim that the focus ring is
// drawn. The negative rules live in .stylelintrc.json, where a violation is
// named at the line it sits on rather than at the end of a walk.
//
// The stylesheet is the single source of truth for every color in the app, so
// this guard reads the shipped file, never a copy of its values. It runs under
// Node for two measured reasons: the runner replaces CSS imports with empty
// strings, so nothing is loaded into a document to inspect; and jsdom does not
// substitute var() in getComputedStyle, so even a mounted page would hand back
// the literal string "var(--gray-50)" instead of a color. Resolving the
// indirection here is the only way to assert on the values that actually reach a
// screen.

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

import { THEME_STORAGE_KEY } from "./resolveTheme";
import { required } from "../test/required";

// Resolved from this file's own location. The working directory is wherever the
// runner happened to be invoked and is not the project root under an IDE runner
// or an explicit root argument.
const here = import.meta as ImportMeta & { dirname: string };
const projectRoot = join(here.dirname, "..", "..");
const cssPath = join(projectRoot, "src", "index.css");
const htmlPath = join(projectRoot, "index.html");

const LIGHT_SELECTOR = ":root";
const DARK_SELECTOR = ':root[data-theme="dark"]';

// The two thresholds from the contrast success criteria: 4.5:1 where the pair
// carries text, 3:1 where it is a border, a gridline or the focus ring. Neither
// number is ever moved to accommodate a failing pair, and no pair is ever added
// to an allowlist to keep this file green. A ratio below the line is a color
// choice to redo.
const TEXT_CONTRAST_MINIMUM = 4.5;
const NON_TEXT_CONTRAST_MINIMUM = 3;

// The logo is the same two colors in both themes by design, so these two are
// the complete exemption list for the partner assertion. Written out by hand, so
// the list cannot grow without a visible edit.
const THEME_INVARIANT_TOKENS = ["--color-brand", "--color-brand-contrast"];

// The tier that carries no theme at all: spacing, type and the radius. Their
// prefix holds them out of the color assertions, so the exemption list above
// stays at the two logo colors no matter how far the scale grows.
const INVARIANT_TOKEN_PREFIXES = ["--space-", "--font-size-", "--radius-"];

// Only the exact bare form. A fallback argument such as var(--x, #abc) would let
// a missing primitive ship a working color with the chain silently broken, so
// the resolver never gets the chance to report it.
const BARE_INDIRECTION = /^var\(\s*(--[\w-]+)\s*\)$/;

const IS_COLOR_TOKEN = /^--color-/;

// The flat tier the semantic tokens replaced. Named here so a stylesheet that
// reaches for one goes red; the reference would otherwise resolve to nothing and
// render an element with no color at all.
const RETIRED_TOKENS = [
  "--border-color",
  "--border-light",
  "--text-color",
  "--text-muted",
  "--background-light",
  "--background-light-hover",
  "--accent-color",
  "--error-color",
  // The flat gray ramp the --neutral- primitives replaced. Nothing declares one
  // any more, so a reference resolves to nothing.
  "--gray-50",
  "--gray-100",
  "--gray-400",
  "--gray-500",
  "--gray-600",
  "--gray-700",
  "--gray-800",
  "--gray-900",
];

// Anchored to the start of a line, which is where a declaration sits. An
// interpolation or a reference mid-value is a use, and there is nothing to use
// once no file declares one.
const SCSS_VARIABLE = /^[ \t]*\$[\w-]+[ \t]*:/gm;

// The control radius and the container one, and nothing beside them. Counted, so
// the exemption cannot grow to cover an unrelated px.
// src/index.css declares the tokens the stylelint unit allowed-list holds the
// component stylesheets to, and a bounded count is a claim that rule cannot make.
const GLOBAL_PX_ALLOWANCE = 2;

// A hairline and the focus ring draw lines, and one authored in rem would
// thicken as the reader's type grew.
// Anything wider is spacing, and spacing arrives through a token.
const HAIRLINE_PX = 2;
const PX_VALUE = /(\d+(?:\.\d+)?)px/g;

const SKIPPED_DIRECTORIES = new Set(["node_modules", "dist", "coverage"]);

/**
 * Source with comments blanked out, so a construct named in prose is never
 * mistaken for one the file actually performs. Copied from the toolchain guard,
 * which needs the same distinction for the same reason.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/**
 * Every stylesheet under src/, found by walking, so one added by a later
 * component is covered the day it lands instead of the day someone remembers to
 * add it here. The walk takes any extension, because a shared partial is a place
 * a rule would otherwise be free to break.
 */
function findStylesheets(directory: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
      found.push(...findStylesheets(join(directory, entry.name)));
    } else if (/\.(css|scss)$/.test(entry.name)) {
      found.push(join(directory, entry.name));
    }
  }

  return found;
}

// The global file is read on its own terms below, by the two guards written
// against it, so the walk excludes it.
const componentStylesheets = findStylesheets(join(projectRoot, "src")).filter(
  (file) => file !== cssPath,
);

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

// The dark theme as a browser sees it, the overrides layered onto the base, so
// a token the dark block leaves alone still resolves through its light value.
const darkBlock = new Map([...lightBlock, ...darkOverrides]);

const THEMES: Array<[string, Map<string, string>]> = [
  ["light", lightBlock],
  ["dark", darkBlock],
];

/**
 * A token followed through the semantic tier to the primitive value it names.
 * An undeclared reference or a cycle throws, because either one means the
 * layering is broken and a guard that stayed silent would be reporting on a
 * stylesheet nobody ships.
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
  return indirection
    ? resolve(required(indirection[1], "the var() target"), scope, seen)
    : value;
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
  // Asserted as a triple, because the three offsets are a literal and the map
  // over them cannot return any other length.
  const [red, green, blue] = [0, 2, 4].map((offset) =>
    channel(parseInt(full.slice(offset, offset + 2), 16)),
  ) as [number, number, number];
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort(
    (x, y) => y - x,
  ) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * The semantic pairings the app actually renders, curated instead of the full
 * cross product. Muted text, the accent and the error color never sit on the
 * hover fill, only inherited body text does, and the focus ring sits outside the
 * border box on the parent surface rather than on the fill it surrounds.
 *
 * Four text pairs are absent because axe decides them by value in the real-engine
 * sweep, and CONTRAST-OVERLAP.md records that measurement per pair.
 *
 * The two logo rows are measured by choice. The non-text contrast criterion
 * exempts logos and logotypes outright, so if a future surface change turns
 * either one red the correct answer is to drop the exempt pair deliberately,
 * never to lower a threshold to keep it.
 */
const PAIRS: Array<[string, string, number]> = [
  ["--color-text", "--color-surface-hover", TEXT_CONTRAST_MINIMUM],
  ["--color-text-muted", "--color-surface-raised", TEXT_CONTRAST_MINIMUM],
  ["--color-accent", "--color-surface", TEXT_CONTRAST_MINIMUM],
  ["--color-accent", "--color-surface-raised", TEXT_CONTRAST_MINIMUM],
  ["--color-error", "--color-surface", TEXT_CONTRAST_MINIMUM],
  ["--color-error", "--color-surface-raised", TEXT_CONTRAST_MINIMUM],
  ["--color-border-strong", "--color-surface", NON_TEXT_CONTRAST_MINIMUM],
  [
    "--color-border-strong",
    "--color-surface-raised",
    NON_TEXT_CONTRAST_MINIMUM,
  ],
  ["--color-border-strong", "--color-surface-hover", NON_TEXT_CONTRAST_MINIMUM],
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

    // The exemption is only defensible while it stays the two logo colors. A
    // third entry means a token went theme-invariant without anyone deciding it.
    for (const token of THEME_INVARIANT_TOKENS) {
      expect(
        inDark,
        `${token} is exempt from the partner rule but the dark block overrides it anyway`,
      ).not.toContain(token);
    }
  });

  it("holds that exemption at exactly the two logo colours", () => {
    // Nothing else in the suite notices a third name arriving, and growing the
    // list has to be a deliberate, visible edit.
    expect(
      THEME_INVARIANT_TOKENS.length,
      "the partner-rule exemption has grown past the two logo colours",
    ).toBe(2);
  });

  it("declares the theme-invariant tier once, in the light block alone", () => {
    for (const prefix of INVARIANT_TOKEN_PREFIXES) {
      const declared = [...lightBlock.keys()].filter((property) =>
        property.startsWith(prefix),
      );

      expect(
        declared.length,
        `:root declares no ${prefix} token, so that half of the scale does not exist`,
      ).toBeGreaterThan(0);

      for (const token of declared) {
        expect(
          darkOverrides.has(token),
          `${token} carries no theme and must not be overridden per theme`,
        ).toBe(false);
      }
    }
  });

  it("authors spacing and type in rem and the radius in px", () => {
    // A layout authored in rem follows the reader's browser font-size setting,
    // while a corner radius that grew with it would only distort. The unit is an
    // accessibility property here, not a style preference.
    for (const [property, value] of lightBlock) {
      if (
        property.startsWith("--space-") ||
        property.startsWith("--font-size-")
      )
        expect(value, `${property} is not a rem length`).toMatch(
          /^\d*\.?\d+rem$/,
        );
      if (property.startsWith("--radius-"))
        expect(value, `${property} is not a px length`).toMatch(/^\d+px$/);
    }
  });

  it("keeps the theme-invariant tier out of the contrast pair set", () => {
    // A spacing token has no color to measure, so a pair naming one would
    // throw on resolve at best and widen a color gate to a length at worst.
    for (const [foreground, background] of PAIRS) {
      for (const token of [foreground, background]) {
        for (const prefix of INVARIANT_TOKEN_PREFIXES) {
          expect(
            token.startsWith(prefix),
            `${token} carries no theme and cannot be one side of a contrast pair`,
          ).toBe(false);
        }
      }
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
    // Asserted on the selector, because a block that only wins by sitting later
    // in the file starts losing the moment anything is appended after it.
    expect([...blocks.keys()]).toContain(DARK_SELECTOR);
  });
});

describe("contrast", () => {
  for (const [theme, block] of THEMES) {
    for (const [foreground, background, minimum] of PAIRS) {
      it(`clears ${minimum}:1 for ${foreground} on ${background} in ${theme}`, () => {
        // Compared without rounding, because the specification is explicit that
        // 2.999:1 does not meet a 3:1 threshold. A ratio landing exactly on the
        // line passes.
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

  // Filtered on the three attributes that actually defer a script past first
  // paint, so a script carrying an unrelated attribute still counts. Each of the
  // three fails silently, which is why it is worth a guard. An attribute that
  // changes nothing about when the script runs is not worth one, and a CSP nonce
  // is the one this file will need first.
  const blocking = [...head.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter(
      (match) =>
        !/\b(?:type=["']module["']|defer|async)\b/.test(
          required(match[1], "the script tag's attributes"),
        ),
    )
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
    expect(blocking, "no blocking script to place").toHaveLength(1);

    const moduleScript = html.search(/<script[^>]*\btype=["']module["']/);

    expect(moduleScript, "index.html loads no module script").toBeGreaterThan(
      -1,
    );
    expect(
      required(blocking[0], "the blocking script").offset,
      "the theme script does not precede the module script",
    ).toBeLessThan(moduleScript);
  });

  // A presence check on the shared literal. The two implementations of the
  // resolve rule are a known, accepted duplication, so this only catches the
  // storage key drifting.
  it("reads the same storage key the resolver exports", () => {
    expect(blocking, "no blocking script to read a key from").toHaveLength(1);
    expect(
      required(blocking[0], "the blocking script").body,
      `the theme script does not mention the storage key ${THEME_STORAGE_KEY}`,
    ).toContain(THEME_STORAGE_KEY);
  });
});

// The halves of the old color guard stylelint has no rule for: declaring an
// SCSS variable, and naming a token that no longer exists. Checked as a string,
// because the CSS parser throws outright on the inline comments in the table's
// stylesheet.
describe("stray declarations in the component stylesheets", () => {
  it("finds the stylesheets by walking rather than by a list", () => {
    expect(
      componentStylesheets.length,
      "no stylesheet was found under src/ beside the global one, so every assertion below is vacuous",
    ).toBeGreaterThan(0);
  });

  it("leaves no SCSS variable or retired token in any of them", () => {
    const offenders: string[] = [];

    for (const file of componentStylesheets) {
      // Stripped first, so a hex value quoted in an explanation is judged as
      // prose and a declaration is judged as a declaration.
      const source = stripComments(readFileSync(file, "utf8"));
      const name = relative(projectRoot, file);

      for (const variable of source.matchAll(SCSS_VARIABLE)) {
        offenders.push(`${name}: declares ${variable[0].trim()}`);
      }

      for (const token of RETIRED_TOKENS) {
        if (new RegExp(`(?<![\\w-])${token}(?![\\w-])`).test(source)) {
          offenders.push(`${name}: still names the retired token ${token}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("leaves no retired token declared in the global stylesheet", () => {
    const source = stripComments(readFileSync(cssPath, "utf8"));

    for (const token of RETIRED_TOKENS) {
      expect(
        source,
        `src/index.css still declares the retired token ${token}`,
      ).not.toMatch(new RegExp(`(?<![\\w-])${token}(?![\\w-])`));
    }
  });
});

// The half of the length rule stylelint's unit allowed-list has no way to say.
// It counts instead of forbidding, and it reads src/index.css, where the two
// corner radii are px on purpose, because growing with the reader's type would
// only distort the shape.
describe("length in the global stylesheet", () => {
  it("allows the global stylesheet the corner radii and nothing beside them", () => {
    const found = [
      ...stripComments(readFileSync(cssPath, "utf8")).matchAll(PX_VALUE),
    ]
      .filter(([, magnitude]) => Number(magnitude) > HAIRLINE_PX)
      .map(([length]) => length);

    expect(
      found,
      `src/index.css holds ${String(found.length)} off-scale lengths rather than the radii alone: ${found.join(", ")}`,
    ).toHaveLength(GLOBAL_PX_ALLOWANCE);
  });
});

describe("the focus ring", () => {
  it("is drawn once, globally, from the ring token", () => {
    const rule = blocks.get(":focus-visible");

    expect(
      rule,
      "src/index.css declares no unscoped :focus-visible rule, so every control is on its own for a focus indicator",
    ).toBeDefined();
    expect(
      rule?.get("outline"),
      "the global focus rule does not draw its outline from the ring token",
    ).toContain("--color-focus-ring");
  });
});
