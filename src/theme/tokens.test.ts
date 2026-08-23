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

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
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

// The tier that carries no theme at all: spacing, type and the radius. These are
// held out of the colour assertions by their prefix rather than by an entry in
// the exemption list above, which is what lets that list stay at the two logo
// colours no matter how far the scale grows.
const INVARIANT_TOKEN_PREFIXES = ["--space-", "--font-size-", "--radius-"];

// Only the exact bare form. A fallback argument such as var(--x, #abc) would let
// a missing primitive ship a working colour with the chain silently broken, so
// the resolver never gets the chance to report it.
const BARE_INDIRECTION = /^var\(\s*(--[\w-]+)\s*\)$/;

const IS_COLOR_TOKEN = /^--color-/;

// The flat tier the semantic tokens replaced. Named here so a stylesheet that
// reaches for one of them goes red rather than resolving to nothing and
// rendering an element with no colour at all.
const RETIRED_TOKENS = [
  "--border-color",
  "--border-light",
  "--text-color",
  "--text-muted",
  "--background-light",
  "--background-light-hover",
  "--accent-color",
  "--error-color",
];

// The four hex lengths CSS accepts, and nothing longer, so an identifier that
// merely starts with hex digits is not mistaken for a colour.
const HEX_COLOR = /#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})(?![0-9a-z-])/gi;

// The other two forms CSS accepts for a fixed colour. A functional notation and
// a named colour are as fixed as a hex is, and neither flips with the theme, so
// a guard that reads hex alone waves both through. The boundaries exclude a
// hyphen, so var(--gray-50) and white-space are read as the identifiers they
// are rather than as colours.
const COLOR_FUNCTION =
  /(?<![\w-])(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)[ \t]*\(/gi;
const NAMED_COLOR =
  /(?<![\w-])(red|blue|green|black|white|gray|grey|orange|teal|silver|transparent)(?![\w-])/gi;

// Anchored to the start of a line, which is where a declaration sits. An
// interpolation or a reference mid-value is a use, and there is nothing to use
// once no file declares one.
const SCSS_VARIABLE = /^[ \t]*\$[\w-]+[ \t]*:/gm;

// Matched on the property family, so outline-offset is not mistaken for a
// suppression while the two longhands that cancel a ring are still seen. The
// value runs to the next delimiter rather than to a required semicolon: the
// last declaration in a block needs none, and !important sits between the two.
const OUTLINE_DECLARATION =
  /(?<![\w-])outline(?:-style|-width|-color)?[ \t]*:([^;}]*)/g;

// A zero width, an absent style or an invisible colour each cancel the ring.
// The zero is matched only as a whole number, so a 0.125rem ring reads as a
// ring rather than as the absence of one. Its unit is optional and spelled out,
// because a bare 0 and a 0 carrying any length unit are the same width.
const RING_CANCELLING_VALUE =
  /(?<![\w.-])(none|0(px|rem|em)?|transparent)(?![\w.%-])/i;

// A border or an outline is a line rather than a length on the spacing scale,
// and one authored in rem would thicken as the reader's type grew. Anything
// wider than this is spacing, and spacing arrives through a token.
const PX_HAIRLINE_MAXIMUM = 2;
const PX_LENGTH = /(\d+(?:\.\d+)?)px/g;

// Every other length that ignores the reader's setting or compounds against an
// inherited one. Guarding px alone enforced "not px" while the stated rule is
// "rem": 1.5em compounds against the parent's size and 12pt is a fixed physical
// length, and neither was seen. No hairline allowance here, because a hairline
// authored in any of these is not a hairline. The optional sign is matched only
// after a non-word, non-hyphen character, so a negative margin is read as a
// length while --space-2em is read as the identifier it is.
const NON_REM_LENGTH =
  /(?<![\w-])-?\d+(?:\.\d+)?(em|pt|pc|in|mm|cm|ex|ch)(?![\w-])/g;

// The corner radius, and nothing beside it. Asserted as a count rather than
// skipped, so the exemption cannot quietly become the global file's licence to
// hold a second px length.
const GLOBAL_PX_ALLOWANCE = 1;

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
 * Source with the condition of every media at-rule blanked out. A breakpoint is
 * a viewport measurement, not a step on the spacing scale, and one expressed in
 * rem would move with the reader's type, which is the opposite of what a layout
 * breakpoint is for.
 */
function stripMediaConditions(source: string): string {
  return source.replace(/@media[^{]*/g, "@media ");
}

/**
 * The lengths in a stylesheet that are not on the rem scale: any px wide enough
 * to be spacing rather than a hairline, plus every unit that is not rem at all.
 * Judged on the file with its comments and its breakpoints removed first, so a
 * retired value quoted in an explanation is read as prose and a breakpoint is
 * read as a breakpoint.
 */
function offScaleLengths(source: string): string[] {
  const readable = stripMediaConditions(stripComments(source));

  return [
    ...[...readable.matchAll(PX_LENGTH)]
      .filter(([, magnitude]) => Number(magnitude) > PX_HAIRLINE_MAXIMUM)
      .map(([length]) => length),
    ...[...readable.matchAll(NON_REM_LENGTH)].map(([length]) => length),
  ];
}

/**
 * Every colour literal in a stylesheet, in each of the three forms CSS accepts
 * for one. All of them rather than the first, so a file that reintroduces five
 * reports five and is fixed once instead of five times.
 */
function colourLiterals(source: string): string[] {
  return [HEX_COLOR, COLOR_FUNCTION, NAMED_COLOR].flatMap((matcher) =>
    [...source.matchAll(matcher)].map(([literal]) => literal),
  );
}

/**
 * The outline declarations in a stylesheet whose value cancels the focus ring,
 * returned whole so the failure message names the declaration that has to go.
 */
function focusRingSuppressions(source: string): string[] {
  return [...source.matchAll(OUTLINE_DECLARATION)]
    .filter(([, value]) => RING_CANCELLING_VALUE.test(value))
    .map(([declaration]) => declaration.trim());
}

/**
 * Every stylesheet under src/, found by walking rather than by a list, so a
 * stylesheet added by a later component is covered the day it lands instead of
 * the day someone remembers to add it here. Every extension rather than the
 * module ones alone, because a shared partial and a global file are the two
 * places a rule would otherwise be free to break.
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

const stylesheets = findStylesheets(join(projectRoot, "src"));

// The global file declares the hex primitives every other file reaches for
// through a token, so it is the one exemption from the colour half of the guard
// and from nothing else.
const componentStylesheets = stylesheets.filter((file) => file !== cssPath);

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
  // The selected segment of the theme control: the surface colour laid on the
  // accent, which is the one pairing in the app that reads a background token as
  // a foreground. Measured here rather than by hand, so a later accent change
  // cannot quietly take the control's label below the text threshold.
  ["--color-surface", "--color-accent", TEXT_CONTRAST_MINIMUM],
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

  it("holds that exemption at exactly the two logo colours", () => {
    // Asserted rather than trusted. Nothing else in the suite notices a third
    // name arriving, and the whole point of naming the list was that growing it
    // has to be a deliberate, visible edit.
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
    // The unit is the accessibility property, not a style preference: a layout
    // authored in rem follows the reader's browser font-size setting, while a
    // corner radius that grew with it would only distort.
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
    // A spacing token has no colour to measure, so a pair naming one would
    // throw on resolve at best and widen a colour gate to a length at worst.
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

  // Filtered on the three attributes that actually defer a script past first
  // paint, rather than on carrying no attributes at all. Each of those fails
  // silently rather than loudly, which is what makes them worth a guard. An
  // attribute that changes nothing about when the script runs is not: a CSP
  // nonce is the one this file will need first, and it defers nothing.
  const blocking = [...head.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter(
      (match) => !/\b(?:type=["']module["']|defer|async)\b/.test(match[1]),
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
      blocking[0].offset,
      "the theme script does not precede the module script",
    ).toBeLessThan(moduleScript);
  });

  // A presence check on the shared literal, not an agreement test between the
  // script and the resolver. The two implementations of the resolve rule are a
  // known, accepted duplication; this only catches the storage key drifting.
  it("reads the same storage key the resolver exports", () => {
    expect(blocking, "no blocking script to read a key from").toHaveLength(1);
    expect(
      blocking[0].body,
      `the theme script does not mention the storage key ${THEME_STORAGE_KEY}`,
    ).toContain(THEME_STORAGE_KEY);
  });
});

// A string check rather than a parse: the CSS parser throws outright on the
// inline comments in the table's stylesheet, and a guard written against the one
// module file that happens to have none would look like it worked.
describe("colour in the component stylesheets", () => {
  it("finds the stylesheets by walking rather than by a list", () => {
    expect(
      componentStylesheets.length,
      "no stylesheet was found under src/ beside the global one, so every assertion below is vacuous",
    ).toBeGreaterThan(0);
  });

  it("leaves no colour literal, SCSS variable or retired token in any of them", () => {
    const offenders: string[] = [];

    for (const file of componentStylesheets) {
      // Stripped first, so a hex value quoted in an explanation is judged as
      // prose and a declaration is judged as a declaration.
      const source = stripComments(readFileSync(file, "utf8"));
      const name = relative(projectRoot, file);

      for (const literal of colourLiterals(source)) {
        offenders.push(`${name}: holds the colour literal ${literal}`);
      }

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

// The counterpart to the colour guard, and the reason the walk above takes
// every stylesheet rather than the module ones: the rule this keeps is that
// spacing and type are authored in rem through a token, so the layout follows
// the reader's browser font-size setting. A stylesheet written after this file
// inherits the rule by being walked, without anyone restating it.
describe("length in the stylesheets", () => {
  it("leaves no px spacing in any component stylesheet", () => {
    const offenders: string[] = [];

    for (const file of componentStylesheets) {
      for (const length of offScaleLengths(readFileSync(file, "utf8"))) {
        offenders.push(
          `${relative(projectRoot, file)}: holds ${length}, which is spacing and belongs to a token`,
        );
      }
    }

    expect(offenders).toEqual([]);
  });

  it("allows the global stylesheet the corner radius and nothing beside it", () => {
    const found = offScaleLengths(readFileSync(cssPath, "utf8"));

    expect(
      found,
      `src/index.css holds ${String(found.length)} off-scale lengths rather than the radius alone: ${found.join(", ")}`,
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

  it("is suppressed by no stylesheet", () => {
    const offenders: string[] = [];

    // The global stylesheet is walked alongside the rest: a suppression there
    // would cancel the rule from the same file that declares it.
    for (const file of stylesheets) {
      const source = stripComments(readFileSync(file, "utf8"));

      for (const suppression of focusRingSuppressions(source)) {
        offenders.push(
          `${relative(projectRoot, file)}: cancels the focus ring with ${suppression}`,
        );
      }
    }

    expect(offenders).toEqual([]);
  });
});

// The guards above read a clean tree, which is the one condition under which a
// guard that matches nothing and a guard that works are indistinguishable. Each
// spelling below is one a real author reaches for and one an earlier revision of
// these matchers passed, so the reach is asserted rather than assumed.
describe("the reach of the guards", () => {
  it("sees a colour literal in every form CSS accepts for one", () => {
    for (const declaration of [
      "color: #abc;",
      "color: red;",
      "background: rgb(1 2 3);",
      "border-color: hsl(0 0% 0%);",
      "background: transparent;",
      "color: color-mix(in oklab, #fff, #000);",
    ]) {
      expect(
        colourLiterals(declaration),
        `${declaration} is invisible to the colour guard`,
      ).not.toEqual([]);
    }
  });

  it("reads a token reference and a property name as neither", () => {
    for (const declaration of [
      "color: var(--color-text);",
      "background: var(--gray-50);",
      "white-space: nowrap;",
      "background-color: var(--color-surface);",
    ]) {
      expect(
        colourLiterals(declaration),
        `${declaration} is reported as a colour literal`,
      ).toEqual([]);
    }
  });

  it("sees a length authored off the rem scale, whatever unit carries it", () => {
    for (const declaration of [
      "padding: 1.5em;",
      "margin: 12pt;",
      "width: 2in;",
      "gap: 3mm;",
      "inline-size: 40ch;",
      "margin-top: -1.5em;",
      "padding: 24px;",
    ]) {
      expect(
        offScaleLengths(declaration),
        `${declaration} is invisible to the length guard`,
      ).not.toEqual([]);
    }
  });

  it("reads the rem scale, a hairline and a viewport measure as none of that", () => {
    for (const declaration of [
      "padding: 1.5rem;",
      "gap: 0.25rem;",
      "width: 50%;",
      "min-height: 100vh;",
      "border-bottom: 1px solid var(--color-border);",
      "margin: 0;",
      "--space-2em: 1rem;",
    ]) {
      expect(
        offScaleLengths(declaration),
        `${declaration} is reported as an off-scale length`,
      ).toEqual([]);
    }
  });

  it("sees a suppressed focus ring however it is spelled", () => {
    for (const declaration of [
      "outline: none;",
      "outline: none !important;",
      "outline-style: none;",
      "a { color: var(--color-text); outline: none }",
      "outline: 0 solid transparent;",
      "outline-width: 0;",
      "outline-width: 0rem;",
      "outline-color: transparent;",
    ]) {
      expect(
        focusRingSuppressions(declaration),
        `${declaration} is invisible to the focus-ring guard`,
      ).not.toEqual([]);
    }
  });

  it("reads a drawn ring and an offset as neither", () => {
    for (const declaration of [
      "outline: 2px solid var(--color-focus-ring);",
      "outline: 0.125rem solid var(--color-focus-ring);",
      "outline-offset: 2px;",
    ]) {
      expect(
        focusRingSuppressions(declaration),
        `${declaration} is reported as a suppression`,
      ).toEqual([]);
    }
  });
});
