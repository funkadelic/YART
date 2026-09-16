// @vitest-environment jsdom
//
// Token tiers and contrast, the theme script's placement in each shell, and the
// halves of the stylesheet rules stylelint has no way to express: an SCSS
// variable declared in a component sheet, a reference to a retired token, the
// global sheets' bounded px count, and the positive claim that the focus ring is
// drawn. The negative rules live in .stylelintrc.json.
//
// Reads the generated src/styles/tokens.css and src/index.css as files, because
// the runner blanks CSS imports and jsdom evaluates neither var() nor
// light-dark(). The environment is jsdom for the shell guard's DOMParser.

import { existsSync, readFileSync, readdirSync } from "node:fs";
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
const tokensPath = join(projectRoot, "src", "styles", "tokens.css");

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
// the complete list of colors declared without a light-dark() pair. Written out
// by hand, so the list cannot grow without a visible edit.
const THEME_INVARIANT_TOKENS = ["--color-brand", "--color-brand-contrast"];

// The tier that carries no theme at all: spacing, type and the radius. Their
// prefix holds them out of the color assertions, so the exemption list above
// stays at the two logo colors no matter how far the scale grows.
const INVARIANT_TOKEN_PREFIXES = ["--space-", "--font-size-", "--radius-"];

// Opaque three- or six-digit only, the two forms luminance() parses.
const OPAQUE_HEX = /#(?:[0-9a-f]{3}|[0-9a-f]{6})/.source;
const HEX = new RegExp(`^${OPAQUE_HEX}$`, "i");
const LIGHT_DARK = new RegExp(
  `^light-dark\\(\\s*(${OPAQUE_HEX})\\s*,\\s*(${OPAQUE_HEX})\\s*\\)$`,
  "i",
);

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
  // The flat gray ramp the neutral primitives replaced.
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
// the exemption cannot grow to cover an unrelated px. A bounded count over the
// global sheets is a claim the stylelint unit allowed-list cannot make.
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

// The two global files are read on their own terms below, so the walk excludes them.
const globalStylesheets = [cssPath, tokensPath];
const componentStylesheets = findStylesheets(join(projectRoot, "src")).filter(
  (file) => !globalStylesheets.includes(file),
);

/** Every declaration in a file, keyed by selector then by property. */
function readBlocks(path: string): Map<string, Map<string, string>> {
  const blocks = new Map<string, Map<string, string>>();

  postcss
    .parse(readFileSync(path, "utf8"), { from: path })
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

const blocks = readBlocks(cssPath);

function requireBlock(selector: string): Map<string, string> {
  const block = blocks.get(selector);
  if (block === undefined) {
    throw new Error(`src/index.css declares no ${selector} block`);
  }
  return block;
}

const lightBlock = requireBlock(LIGHT_SELECTOR);
const darkBlock = requireBlock(DARK_SELECTOR);

const tokenBlock = required(
  readBlocks(tokensPath).get(LIGHT_SELECTOR),
  "the :root block of src/styles/tokens.css",
);

const THEMES = ["light", "dark"] as const;

/** The hex a color token resolves to in a theme, from its pair or its plain value. */
function side(token: string, theme: (typeof THEMES)[number]): string {
  const value = tokenBlock.get(token);
  if (value === undefined) throw new Error(`${token} is not declared`);
  const pair = LIGHT_DARK.exec(value);
  if (pair) return required(pair[theme === "light" ? 1 : 2], "the pair side");
  if (HEX.test(value)) return value;
  throw new Error(
    `${token} is ${value}, neither a light-dark() pair nor a hex`,
  );
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

describe("token tiers", () => {
  it("pairs every color token but the two logo colors in light-dark()", () => {
    const colors = [...tokenBlock.keys()].filter((property) =>
      IS_COLOR_TOKEN.test(property),
    );
    expect(
      colors.length,
      "tokens.css declares no color tokens",
    ).toBeGreaterThan(0);

    for (const [property, value] of tokenBlock) {
      const tier = ["--color-", ...INVARIANT_TOKEN_PREFIXES].some((prefix) =>
        property.startsWith(prefix),
      );
      expect(tier, `${property} belongs to no token tier`).toBe(true);
      if (!IS_COLOR_TOKEN.test(property)) continue;

      if (THEME_INVARIANT_TOKENS.includes(property)) {
        expect(value, `${property} is not a plain hex`).toMatch(HEX);
      } else {
        expect(value, `${property} is not a light-dark() pair`).toMatch(
          LIGHT_DARK,
        );
      }
    }
  });

  it("holds that exemption at exactly the two logo colors", () => {
    // Nothing else in the suite notices a third name arriving, and growing the
    // list has to be a deliberate, visible edit.
    expect(
      THEME_INVARIANT_TOKENS.length,
      "the pair exemption has grown past the two logo colors",
    ).toBe(2);
  });

  it("keeps light-dark() out of the theme-invariant tier", () => {
    for (const prefix of INVARIANT_TOKEN_PREFIXES) {
      const declared = [...tokenBlock].filter(([property]) =>
        property.startsWith(prefix),
      );

      expect(
        declared.length,
        `tokens.css declares no ${prefix} token, so that half of the scale does not exist`,
      ).toBeGreaterThan(0);

      for (const [token, value] of declared) {
        expect(
          value,
          `${token} is theme-invariant but wrapped in light-dark()`,
        ).not.toContain("light-dark(");
      }
    }
  });

  it("authors spacing and type in rem and the radius in px", () => {
    // A layout authored in rem follows the reader's browser font-size setting,
    // while a corner radius that grew with it would only distort. The unit is an
    // accessibility property here, not a style preference.
    for (const [property, value] of tokenBlock) {
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
    // throw at best and widen a color gate to a length at worst.
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

  it("declares a concrete color-scheme in each theme block", () => {
    expect(
      lightBlock.get("color-scheme"),
      "the light block does not declare color-scheme: light",
    ).toBe("light");
    expect(
      darkBlock.get("color-scheme"),
      "the dark block does not declare color-scheme: dark",
    ).toBe("dark");
  });
});

describe("contrast", () => {
  for (const theme of THEMES) {
    for (const [foreground, background, minimum] of PAIRS) {
      it(`clears ${minimum}:1 for ${foreground} on ${background} in ${theme}`, () => {
        // Compared without rounding, because the specification is explicit that
        // 2.999:1 does not meet a 3:1 threshold. A ratio landing exactly on the
        // line passes.
        expect(
          contrastRatio(side(foreground, theme), side(background, theme)),
          `${foreground} on ${background} in ${theme}`,
        ).toBeGreaterThanOrEqual(minimum);
      });
    }
  }
});

// Every shell the site ships. Each carries its own copy of the theme script, so
// a guard reading one of them leaves the other free to defer the script and
// flash the wrong theme, and for a right-to-left reader the wrong direction, on
// every load.
const SHELLS = ["index.html", "movies.html"];

describe.each(SHELLS)("the theme script in %s", (shell) => {
  const html = readFileSync(join(projectRoot, shell), "utf8");
  // Parsed rather than scraped: the markup this guard has to reject is exactly
  // the markup a hand-written tag matcher gets wrong. querySelectorAll returns
  // document order, so an index into this list says which script runs first.
  const doc = new DOMParser().parseFromString(html, "text/html");
  const scripts = [...doc.querySelectorAll("script")];

  // Filtered on the three things that actually defer a script past first paint,
  // so a script carrying an unrelated attribute still counts. Each of the three
  // fails silently, which is why it is worth a guard, and a CSP nonce is the one
  // this file will need first.
  const blocking = [...doc.head.querySelectorAll("script")].filter(
    (script) =>
      script.type.toLowerCase() !== "module" &&
      !script.hasAttribute("defer") &&
      !script.hasAttribute("async"),
  );

  it("carries exactly one blocking classic script inside the head", () => {
    expect(
      blocking.length,
      `${shell} has no attribute-free script in its head, so the theme lands after first paint`,
    ).toBe(1);
  });

  it("places it before the module script", () => {
    expect(blocking, "no blocking script to place").toHaveLength(1);

    const moduleScript = scripts.findIndex(
      (script) => script.type.toLowerCase() === "module",
    );

    expect(moduleScript, `${shell} loads no module script`).toBeGreaterThan(-1);
    expect(
      scripts.indexOf(required(blocking[0], "the blocking script")),
      `the theme script in ${shell} does not precede the module script`,
    ).toBeLessThan(moduleScript);
  });

  // A presence check on the shared literal. The two implementations of the
  // resolve rule are a known, accepted duplication, so this only catches the
  // storage key drifting.
  it("reads the same storage key the resolver exports", () => {
    expect(blocking, "no blocking script to read a key from").toHaveLength(1);
    expect(
      required(blocking[0], "the blocking script").textContent,
      `the theme script in ${shell} does not mention the storage key ${THEME_STORAGE_KEY}`,
    ).toContain(THEME_STORAGE_KEY);
  });
});

// A renamed shell would otherwise empty the loop above into silence rather than
// into a failure.
it("checks the theme script in every shell the site ships", () => {
  expect(SHELLS.length, "the shell list is empty").toBe(2);

  for (const shell of SHELLS) {
    expect(
      existsSync(join(projectRoot, shell)),
      `${shell} is named in the shell list but is not in the tree`,
    ).toBe(true);
  }
});

// The halves of the old color guard stylelint has no rule for: declaring an
// SCSS variable, and naming a token that no longer exists. Checked as a string,
// because the CSS parser throws outright on the inline comments in the table's
// stylesheet.
describe("stray declarations in the component stylesheets", () => {
  it("finds the stylesheets by walking rather than by a list", () => {
    expect(
      componentStylesheets.length,
      "no stylesheet was found under src/ beside the global ones, so every assertion below is vacuous",
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

  it("leaves no retired token declared in the global stylesheets", () => {
    for (const file of globalStylesheets) {
      const source = stripComments(readFileSync(file, "utf8"));

      for (const token of RETIRED_TOKENS) {
        expect(
          source,
          `${relative(projectRoot, file)} still declares the retired token ${token}`,
        ).not.toMatch(new RegExp(`(?<![\\w-])${token}(?![\\w-])`));
      }
    }
  });
});

// The half of the length rule stylelint's unit allowed-list has no way to say.
// It counts instead of forbidding, over the two global sheets, where the two
// corner radii are px on purpose.
describe("length in the global stylesheets", () => {
  it("allows the global stylesheets the corner radii and nothing beside them", () => {
    const found = globalStylesheets
      .flatMap((file) => [
        ...stripComments(readFileSync(file, "utf8")).matchAll(PX_VALUE),
      ])
      .filter(([, magnitude]) => Number(magnitude) > HAIRLINE_PX)
      .map(([length]) => length);

    expect(
      found,
      `src/index.css and src/styles/tokens.css hold ${String(found.length)} off-scale lengths rather than the radii alone: ${found.join(", ")}`,
    ).toHaveLength(GLOBAL_PX_ALLOWANCE);
  });
});

// The remap in src/index.css is a second list of the color token names, so a
// color added to the generated stylesheet and forgotten there loses its color
// under forced colors with every other gate still green. Read as text, because
// postcss keys the media block's :root exactly as it keys the plain one.
describe("the forced-colors remap", () => {
  it("covers every color token the stylesheet declares", () => {
    const source = readFileSync(cssPath, "utf8");
    const forced = source.slice(source.indexOf("@media (forced-colors"));
    const remapped = new Set(
      [...forced.matchAll(/(--color-[\w-]+)\s*:/g)].map(([, token]) => token),
    );
    const declared = [...tokenBlock.keys()].filter((property) =>
      IS_COLOR_TOKEN.test(property),
    );

    expect(declared.length).toBeGreaterThan(0);
    expect(declared.filter((token) => !remapped.has(token))).toEqual([]);
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
