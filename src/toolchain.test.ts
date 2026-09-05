import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { required } from "./test/required";

/**
 * Guards over the toolchain baseline itself. The migration established each
 * convention below once, and nothing else in the suite notices if one of them is
 * quietly undone.
 *
 * Every guard here is only worth its line count if it goes red on the violation it
 * names, so each one is written to inspect the construct it cares about rather than
 * to look for a token anywhere in a file. A token search passes on a mention inside
 * a comment, and passes on a file where one call site is correct and the next is not.
 */

// Resolved from this file's own location rather than from the working directory,
// which is wherever the runner happened to be invoked and is not the project root
// under an IDE runner or an explicit --root. Read off import.meta directly rather
// than through a URL, because the DOM environment replaces the global URL class and
// node:url will not convert the result.
const here = import.meta as ImportMeta & { dirname: string; filename: string };
const projectRoot = join(here.dirname, "..");
const guardFile = here.filename;

interface Manifest {
  scripts?: Record<string, string>;
  [key: string]: unknown;
}

const manifest = JSON.parse(
  readFileSync(join(projectRoot, "package.json"), "utf8"),
) as Manifest;

/**
 * The four entries in the README's Stack list that carry a version, mapped to
 * the package the manifest pins.
 *
 * A major rather than the exact pin, because the manifest is pinned exactly and
 * a patch bump would otherwise falsify the prose on a change nobody reads the
 * README for. Only these four carry one: they answer the question a reviewer
 * opens the list with, which is which generation of each this tree is on. The
 * rest of the list is commodity tooling whose version answers nothing, and a
 * version there would be one more copy to keep honest for no reader's benefit.
 */
const README_STACK_MAJORS: Readonly<Record<string, string>> = {
  React: "react",
  TypeScript: "typescript",
  Vite: "vite",
  Vitest: "vitest",
};

/**
 * The file parsed once, as TSX so a JSX tag and a generic arrow both read the
 * way the tree writes them.
 *
 * A parse rather than a scan, because the one question a character-level
 * scanner cannot answer is the one that matters here: whether a slash opens a
 * regular expression or divides is decided by the grammar, not by the
 * characters either side of it, and a slash inside a JSX tag is a third case
 * again. The parser settles all three; nothing below approximates them.
 */
function parse(source: string): ts.SourceFile {
  return ts.createSourceFile(
    "scanned.tsx",
    source,
    ts.ScriptTarget.Latest,
    // Parent pointers, which the walk to the leaves below needs.
    true,
    ts.ScriptKind.TSX,
  );
}

/** A half-open span of the source, in UTF-16 code units. */
type Range = readonly [start: number, end: number];

/**
 * Every comment in the file.
 *
 * A comment is trivia rather than a node, so it is reached through the token it
 * is attached to rather than found in the tree. Every comment is attached to
 * exactly one token, the end-of-file token included, so walking the leaves
 * reaches each one once and none is missed at the end of a file or before a
 * closing brace.
 */
function commentRanges(file: ts.SourceFile): Range[] {
  const text = file.getFullText();
  const found: Range[] = [];

  const visit = (node: ts.Node): void => {
    const children = node.getChildren(file);

    if (children.length === 0) {
      // Both, because the two APIs partition the comments rather than overlap.
      // A comment sitting on the same line as the code before it is trailing by
      // definition and the leading reader skips it, so reading leading alone
      // leaves every end-of-line comment in the file visible as code.
      const attached = [
        ...(ts.getLeadingCommentRanges(text, node.getFullStart()) ?? []),
        ...(ts.getTrailingCommentRanges(text, node.getEnd()) ?? []),
      ];

      for (const comment of attached) found.push([comment.pos, comment.end]);
      return;
    }

    for (const child of children) visit(child);
  };

  visit(file);
  return found;
}

/**
 * Every string, template chunk, regular expression and run of JSX text.
 *
 * A template's interpolations are code and stay code: only the literal chunks
 * around them are listed here, which is why the template head, middle and tail
 * are named separately rather than the template expression that holds them.
 */
function literalRanges(file: ts.SourceFile): Range[] {
  const found: Range[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteralLike(node) ||
      ts.isRegularExpressionLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    ) {
      found.push([node.getStart(file), node.getEnd()]);
    }

    node.forEachChild(visit);
  };

  file.forEachChild(visit);
  return found;
}

/**
 * The source with every listed range reduced to spaces, keeping the line breaks
 * so an index into the result is still an index into the original.
 *
 * Split by code unit rather than by code point, because that is the unit the
 * parser reports its positions in and an astral character would otherwise slide
 * every offset after it by one.
 */
function blankRanges(source: string, ranges: readonly Range[]): string {
  const characters = source.split("");

  for (const [start, end] of ranges) {
    for (let index = start; index < end; index += 1) {
      if (characters[index] !== "\n") characters[index] = " ";
    }
  }

  return characters.join("");
}

/**
 * Source with comments blanked out, so a construct named in prose is never
 * mistaken for one the file actually performs.
 *
 * Literals are kept rather than blanked. They are part of the code, and one
 * guard below reads the provider name out of one.
 */
function stripComments(source: string): string {
  return blankRanges(source, commentRanges(parse(source)));
}

/**
 * Source with everything that is not code blanked out, so an index into it is an
 * index into the original and every character it still shows is code. This is
 * what the call counting below reads: a string holding a call and a pattern such
 * as /expect\(/ both name calls that happen nowhere.
 */
function codeMask(source: string): string {
  const file = parse(source);
  return blankRanges(source, [...commentRanges(file), ...literalRanges(file)]);
}

/**
 * Prose with markdown backticks removed and every run of whitespace collapsed to a
 * single space, so an assertion compares the sentence a reader sees rather than the
 * line breaks and markup a formatter chose. Two documents in two formats are being
 * compared below, and an assertion that does not state what it treats as equal is a
 * guess: a rewrap must not flap it, and a reworded sentence must still fail it.
 */
function normalizeProse(source: string): string {
  return source.replace(/`/g, "").replace(/\s+/g, " ");
}

/**
 * A comment handed to normalizeProse with its markers stripped from every line, the
 * block form's asterisk and the line form's pair of slashes alike. The third copy of
 * the provenance paragraph lived in a block comment, so an absence assertion that
 * skipped the strip would pass on a reintroduced copy for the wrong reason; the
 * amended address invariant is carried in line comments, so a presence assertion that
 * skipped them would fail on markup rather than on the prose it is reading.
 */
function normalizeComment(source: string): string {
  return normalizeProse(source.replace(/^[ \t]*(?:\*|\/\/)[ ]?/gm, ""));
}

/** Whether a node is a call to the named callee, matched as the tree writes it. */
function isCallTo(
  node: ts.Node,
  callee: string,
  file: ts.SourceFile,
): node is ts.CallExpression {
  return ts.isCallExpression(node) && node.expression.getText(file) === callee;
}

/**
 * Whether the subtree performs a call to the named callee.
 *
 * Asked of the tree rather than of the text, because the question is whether the
 * call happens. A name written inside a string is not a call, and a teardown hook
 * that only mentions the restore has not performed one.
 */
function containsCall(
  node: ts.Node,
  callee: string,
  file: ts.SourceFile,
): boolean {
  if (isCallTo(node, callee, file)) return true;

  return (
    ts.forEachChild(node, (child) => containsCall(child, callee, file)) ?? false
  );
}

/** Every call to the named callee, so each call site can be judged on its own. */
function findCalls(file: ts.SourceFile, callee: string): ts.CallExpression[] {
  const found: ts.CallExpression[] = [];

  const visit = (node: ts.Node): void => {
    if (isCallTo(node, callee, file)) found.push(node);
    node.forEachChild(visit);
  };

  file.forEachChild(visit);
  return found;
}

/**
 * Every call to a method on the input library's default export other than the
 * session opener. Matched on the property being called rather than on a pattern
 * over the source, so a method named inside a string is not one of these.
 */
function directUserEventCalls(file: ts.SourceFile): ts.CallExpression[] {
  const found: ts.CallExpression[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(file) === "userEvent" &&
      node.expression.name.text !== "setup"
    ) {
      found.push(node);
    }

    node.forEachChild(visit);
  };

  file.forEachChild(visit);
  return found;
}

/**
 * Whether an input session is bound to the fake clock, either by being handed a
 * clock advance or by having its delay switched off.
 *
 * Read off the options object's own properties, so a key spelled inside a string
 * cannot stand in for the property itself, and an option belonging to some other
 * call cannot answer for this one.
 */
function bindsClock(call: ts.CallExpression): boolean {
  const [options] = call.arguments;

  if (options === undefined || !ts.isObjectLiteralExpression(options)) {
    return false;
  }

  return options.properties.some((property) => {
    const name = property.name;

    // A spread names no property to read and a computed key is not known here,
    // so neither can answer for one. Everything else is read through the name's
    // own text rather than through its source, because the source of a quoted
    // key carries the quotation marks and the key does not.
    if (
      name === undefined ||
      !(ts.isIdentifier(name) || ts.isStringLiteralLike(name))
    ) {
      return false;
    }

    if (name.text === "advanceTimers") return true;

    return (
      name.text === "delay" &&
      ts.isPropertyAssignment(property) &&
      property.initializer.kind === ts.SyntaxKind.NullKeyword
    );
  });
}

const SKIPPED_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  "coverage",
  ".git",
]);

/**
 * Every file the runner would collect, found by walking rather than by asking git so
 * the guard still works from an exported tarball. The pattern tracks the runner's own
 * default include rather than the narrower shape this project happens to use today,
 * so a first `.spec.ts` or `tests/` file is covered the day someone writes it.
 */
function findTestFiles(directory: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
      found.push(...findTestFiles(join(directory, entry.name)));
    } else if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) {
      found.push(join(directory, entry.name));
    }
  }

  return found;
}

/**
 * Every module under a directory that is not a test file, so a guard can ask a
 * question of the application rather than of the suite, because a call site
 * written into a test is a test double and a call site written into a module is
 * the application doing it.
 *
 * Not quite the complement of findTestFiles: a `.test-d.ts` is in neither walk.
 * The runner never collects one, so it is not a file findTestFiles describes,
 * and `tsc` is the only thing that reads it, so a literal or an Intl call
 * written there ships to nobody and is not the application doing it either.
 */
function findSourceFiles(directory: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
      found.push(...findSourceFiles(path));
    } else if (
      /\.[cm]?[jt]sx?$/.test(entry.name) &&
      !/\.(test|spec)(-d)?\.[cm]?[jt]sx?$/.test(entry.name)
    ) {
      found.push(path);
    }
  }

  return found;
}

const scannedFiles = findTestFiles(projectRoot).filter(
  (file) => file !== guardFile,
);

// The directory holding the second runner's specs. Named here because two
// guards below read it and one of them asserts it is still being read.
const E2E_DIRECTORY = "e2e";

/** Whether a scanned file is one of the second runner's specs. */
function isEndToEndSpec(file: string): boolean {
  return relative(projectRoot, file).split(sep)[0] === E2E_DIRECTORY;
}

const FAKES_CLOCK = /\buseFakeTimers\s*\(/;
const CONFIGURES_CLOCK = /\bfakeTimers\s*:/;
const IMPORTS_USER_EVENT = /from\s+["']@testing-library\/user-event["']/;

/**
 * The two clock calls, named as the tree writes them. The guard below asks the
 * tree whether each one happens rather than asking the text whether it appears.
 */
const FAKE_CLOCK_CALL = "vi.useFakeTimers";
const REAL_CLOCK_CALL = "vi.useRealTimers";

// A test file that mounts more than it asserts is spending its runtime producing
// coverage rather than evidence, and the coverage gate cannot tell the two apart.
// A file that asserts nothing at all is the limiting case of the same thing, and
// the inequality alone lets it through, so it is named separately below.
// Two counting decisions are written out here because the naive reading gets them
// wrong in opposite directions and neither is visible in the pattern itself. A
// member call such as a root's own render method is counted, deliberately: the
// stricter reading costs nothing today and a bootstrap test driving a root
// directly is exactly where the first one would appear. A rerender call is not
// counted, because there is no word boundary inside that identifier and the rule
// names the two mounting entry points only.
const COUNTS_AS_RENDER = /\b(?:renderHook|render)\s*\(/g;
const COUNTS_AS_ASSERTION = /\bexpect\s*\(/g;

// The complete coverage exclude list. Four entries, named here rather than
// derived: a list that grows quietly is how the guard stops being one. Three
// of them match artifacts that never execute; src/test/** matches the shared
// scaffolding, which does execute on every run and is excluded because it is
// support code for the tests rather than code the product ships. An
// application source file appearing beside them would be the gate being fitted
// to the code instead of the code being written to the gate, and the lint rule
// in eslint.config.js is what stops the one executing entry becoming that same
// hole by being imported from outside a test.
const COVERAGE_EXCLUDE_PATTERNS = [
  "src/**/*.test.{ts,tsx}",
  "src/**/*.test-d.ts",
  "src/test/**",
  "src/**/*.d.ts",
];

// A suppression comment in any provider's spelling, matched against raw source
// because a hint is itself a comment and blanking comments first would make the
// guard vacuous. None exists in this tree: the standing convention is that an
// otherwise-unreachable branch records the condition that would make it
// reachable, never that it is hidden from the report.
const COVERAGE_IGNORE_HINT = /\b(?:v8|c8|istanbul|node)\s+ignore\b/;

const CONFIG_FILE = "vite.config.ts";
const E2E_CONFIG_FILE = "playwright.config.ts";
const WORKFLOW_FILE = ".github/workflows/ci.yml";
const SONAR_FILE = "sonar-project.properties";

// The two test runners this repository is written to hold, each paired with the
// file that configures it. Named as pairs rather than as two loose lists so
// neither half can be asserted without the other: a runner declared with no
// config is a dependency nothing drives, and a config with no runner declared is
// a file nothing reads.
//
// Two runners rather than one, deliberately. The first runner's browser project
// exposes a page object with no navigation method of any kind, so a real
// navigation, a reload and a history traversal cannot be reached from it at all.
// Four flows need exactly those: the address restored across a reload, the
// arrival edges canonicalized on a fresh load, the entry ledger across a back
// and forward traversal, and the theme stamped before any module runs. That is
// what the second runner was taken for, and it is the shape of question that
// would force a third to be a decision rather than a drift.
//
// Coverage is deliberately not generalized across the two. The second runner
// collects none, the hundred percent threshold stays measured over the first
// runner's deterministic project alone, and the reason sits beside the second
// runner's own config.
const TEST_RUNNERS = [
  { package: "vitest", config: CONFIG_FILE },
  { package: "@playwright/test", config: E2E_CONFIG_FILE },
];

// Test-runner packages this repository has not taken. The first seven belong to
// the runner that was removed rather than ported, and any one of them
// reappearing means that runner is back. The rest are the runners a contributor
// is most likely to reach for next, listed so a third runner arriving as a
// dependency is a red test rather than a fact the tree quietly stops stating.
// The driver package the second runner sits on is not here, because it is a
// direct dependency of this tree by design.
const UNTAKEN_TEST_RUNNERS = [
  "jest",
  "jest-environment-jsdom",
  "ts-jest",
  "ts-node",
  "@types/jest",
  "identity-obj-proxy",
  "jest-transformer-svg",
  "mocha",
  "jasmine",
  "ava",
  "karma",
  "qunit",
  "tape",
  "cypress",
  "testcafe",
  "nightwatch",
  "webdriverio",
  "@web/test-runner",
  "node-tap",
];

// Every runner package name this guard knows about, taken or not. The
// intersection of this list with the declared dependencies is compared as a
// sorted set, the same way the coverage exclude list is: reordering either list
// is not a weakening and must not flap the guard, while a runner arriving or a
// runner leaving must both fail.
const KNOWN_TEST_RUNNERS = [
  ...TEST_RUNNERS.map((runner) => runner.package),
  ...UNTAKEN_TEST_RUNNERS,
];

// Both files that launch a browser, held below against the one browser install
// line in the pipeline. There was one launch site for as long as there was one
// runner, and there are two now, so the holding is evaluated per file: a check
// taken across the pair passes on a file contributing nothing as long as the
// other file still contributes a match, which is the vacuous pass the whole
// exercise is written against.
const LAUNCH_CONFIG_FILES = [CONFIG_FILE, E2E_CONFIG_FILE];

// The browser a config launches, matched under either key the two runners use
// for it. One names it inside its instance list, the other on its shared use
// block, and an extraction that knew only the first spelling would contribute
// zero matches from the second file and assert nothing at all about it.
const LAUNCHED_BROWSER = /\bbrowser(?:Name)?\s*:\s*"([^"]*)"/g;

// The workflow searches junit/ and passes only that directory, and the uploader
// matches junit in the file name.
const UPLOADED_REPORT_PATH = /^junit\/[^/]*junit[^/]*\.xml$/;

/**
 * One coverage exclude pattern written in Sonar's dialect, which is the same
 * statement in a matcher with two fewer features: it expands no braces, and its
 * patterns are rooted at the project rather than at the source directory. Both
 * differences are mechanical, so the Sonar list is derived here rather than
 * written out a second time and left to drift from the list it has to agree
 * with.
 */
function sonarEquivalents(pattern: string): string[] {
  const braces = /\{([^}]*)\}/.exec(pattern);
  const expanded = braces
    ? required(braces[1], "the brace group")
        .split(",")
        .map((option) =>
          pattern.replace(required(braces[0], "the brace match"), option),
        )
    : [pattern];

  return expanded.map((entry) => entry.replace(/^src\/\*\*\//, "**/"));
}

// The coverage block of the config, ready to be read a key at a time.
//
// Comments are blanked through the shared helper, which leaves the globs being
// compared intact: they carry the block-comment sequences inside string
// literals, and the helper knows the difference.
//
// Anchored at the coverage key, because a project may carry an include or an
// exclude of its own and the first one in the file is not necessarily this one.
function coverageBlock(): string {
  const source = stripComments(
    readFileSync(join(projectRoot, CONFIG_FILE), "utf8"),
  );

  return source.slice(source.indexOf("coverage:"));
}

// The written-out patterns of one coverage key, read out of the block above.
// Returns null when the key is absent, so a deleted list fails as a missing
// list rather than passing as an empty one.
function coveragePatterns(key: string): string[] | null {
  const declared = new RegExp(`${key}\\s*:\\s*\\[([^\\]]*)\\]`).exec(
    coverageBlock(),
  );

  if (declared === null) return null;

  return [
    ...required(declared[1], "the declared list").matchAll(/"([^"]*)"/g),
  ].map((match) => required(match[1], "a quoted entry"));
}

/**
 * Every file that can install something on the whole suite: the config itself,
 * and each setup file it declares. Derived rather than named, because the config
 * carries one setupFiles array per project, the browser project's is empty
 * today, and a third project or a setup file added to that one would sit outside
 * a written-out pair and never be read.
 */
function suiteWideFiles(): string[] {
  const declared = [
    ...stripComments(
      readFileSync(join(projectRoot, CONFIG_FILE), "utf8"),
    ).matchAll(/setupFiles\s*:\s*\[([^\]]*)\]/g),
  ];

  // An absence here would quietly shrink the guard to the config alone, which
  // is why the count is asserted at the call site rather than assumed.
  const files = declared.flatMap((match) =>
    [...required(match[1], "the declared list").matchAll(/"([^"]*)"/g)].map(
      (entry) => required(entry[1], "a quoted entry").replace(/^\.\//, ""),
    ),
  );

  return [CONFIG_FILE, ...files];
}

// The three things CC BY 4.0 obliges this repository to state, written out here
// so the assertion below matches the committed copy exactly rather than a shape
// that resembles it.
const ATTRIBUTION_SOURCE_URL = "https://simplemaps.com/data/world-cities";
const ATTRIBUTION_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";
const ATTRIBUTION_MODIFICATIONS =
  "Modified: unused columns removed, rows ordered by population.";

// The two sentences that make up the account of the dataset's provenance, written
// out here for the same reason the three literals above are: a rewrite in either
// document that carries them cannot move both sides of the assertion at once.
const PROVENANCE_SERIALIZATION =
  "serialized by scripts/generate-cities.mjs from the row data this " +
  "repository already carried, not from a fresh run over the upstream " +
  "CSV export.";
const PROVENANCE_REGENERATION =
  "regenerated by that script from the upstream worldcities.csv export, " +
  "which orders rows by descending population and breaks ties by ascending " +
  "id, so a regenerated file is not expected to be byte-identical to the " +
  "committed one.";

/**
 * The ceiling on what the catalogs reach, written out here for the same reason
 * the provenance sentences above are: a rewrite in either document that carries
 * it cannot move both sides of the assertion at once.
 *
 * Two documents rather than one because the question arrives from two
 * directions. A reader evaluating the internationalization opens the README; a
 * reader wondering why a country name is still English is already looking at the
 * module that defines the city type. Stating it twice is deliberate, and this is
 * what stops the two from becoming two different statements.
 */
const SOURCE_FORM_CEILING =
  "City and country names stay in their source form in every locale: the " +
  "dataset carries a name and an ascii name and nothing else, so a reader of " +
  "the French interface still reads the English country name. Translating " +
  "them would need a translated column and a regenerated asset, which is a " +
  "data pipeline rather than an internationalization change.";

/** The two documents that carry that ceiling: the prose one and the code one. */
const SOURCE_FORM_DOCUMENTS = ["README.md", "src/data/worldcities/cities.ts"];

/**
 * A literal expression's value, built from the tree rather than evaluated.
 *
 * The parity guard below compares two copies of one rule that cannot import
 * each other, so both sides have to be read as written. Importing the module
 * side would report what it evaluates to, which is not the same question: a
 * reader looking at index.html and at the module is comparing literals, and a
 * literal is what the guard has to compare too. Anything that is not a string,
 * an array or an object of those throws, so a rule that grows a computed value
 * fails here rather than being silently skipped.
 */
function literalValue(node: ts.Node, file: ts.SourceFile): unknown {
  if (
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isParenthesizedExpression(node)
  ) {
    return literalValue(node.expression, file);
  }

  if (ts.isStringLiteralLike(node)) return node.text;

  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map((element) => literalValue(element, file));
  }

  if (ts.isObjectLiteralExpression(node)) {
    const value: Record<string, unknown> = {};

    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) {
        throw new Error(`${property.getText(file)} is not a plain property`);
      }

      const name = property.name;

      if (!ts.isIdentifier(name) && !ts.isStringLiteral(name)) {
        throw new Error(`${name.getText(file)} is not a plain property name`);
      }

      value[name.text] = literalValue(property.initializer, file);
    }

    return value;
  }

  throw new Error(`${node.getText(file)} is not a literal`);
}

/**
 * The value a named variable is declared with, found anywhere in the file.
 *
 * Anywhere rather than at the top level, because one of the two files read
 * below wraps everything it declares in an immediately invoked function.
 */
function declaredLiteral(
  file: ts.SourceFile,
  name: string,
  where: string,
): unknown {
  let initializer: ts.Expression | undefined;

  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer
    ) {
      initializer = node.initializer;
    }

    node.forEachChild(visit);
  };

  file.forEachChild(visit);

  return literalValue(required(initializer, `${name} in ${where}`), file);
}

/** The first argument of every call to the named callee, as written. */
function firstArguments(file: ts.SourceFile, callee: string): string[] {
  return findCalls(file, callee).map(
    (call) =>
      literalValue(
        required(call.arguments[0], `an argument to ${callee}`),
        file,
      ) as string,
  );
}

/**
 * The one inline script index.html carries, parsed.
 *
 * Matched with the expression the policy plugin in vite.config.ts uses to find
 * the script it hashes, so this guard reads exactly the script that ships. That
 * plugin already throws unless there is exactly one; asserting it here as well
 * means the guard says which of the two failed rather than reporting a parse of
 * the wrong script.
 */
function inlineScript(): ts.SourceFile {
  const html = readFileSync(join(projectRoot, "index.html"), "utf8");
  const found = [
    ...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g),
  ];

  expect(
    found.length,
    "index.html carries something other than exactly one inline script",
  ).toBe(1);

  return parse(required(found[0]?.[1], "the inline script's body"));
}

/** A module of this tree, parsed, for the literals a reader sees in it. */
function moduleSource(path: string): ts.SourceFile {
  return parse(readFileSync(join(projectRoot, path), "utf8"));
}

const THEME_MODULE = "src/theme/resolveTheme.ts";
const LOCALE_MODULE = "src/i18n/resolveLocale.ts";

// The one module allowed to write the address, and the module that owns which
// keys the address may carry.
const ADDRESS_WRITER = "src/features/CityTable/CityTable.tsx";
const SCHEMA_MODULE = "src/components/DataTable/tableStateUrl.ts";

/**
 * The four keys the query string owns, sorted.
 *
 * Pinned as a set rather than asserted as a floor, because the risk this guards
 * runs in the other direction: a fifth entry for the locale would make the
 * reader's language part of the view state a link reproduces, which is the one
 * thing the amendment below says the address deliberately does not do.
 */
const SCHEMA_KEYS = ["page", "q", "size", "sort"];

/**
 * The account of what a link does and does not reproduce, written out here for
 * the same reason the provenance sentences above are: a rewrite in any document
 * that carries it cannot move both sides of the assertion at once.
 *
 * The statement is amended rather than new. Following the reader's locale is
 * what made the previous wording false, so the wording moved in the same change
 * set that made it move, and this is the first machine check it has had.
 */
const ADDRESS_INVARIANT =
  "One address is one view, per resolved locale: the query string carries " +
  "the search term, the sort column and direction, the page and the page " +
  "size, and the resolved locale is deliberately not among them, so two " +
  "readers opening the same link see the same rows in the order and the " +
  "number format their own locale produces. Putting the locale in the " +
  "address would force the sender's language on the recipient and would " +
  "make the locale part of the table's view state";

/**
 * Every document that carries that account, most-consulted first.
 *
 * The first two are committed. The last two are the generated project
 * instructions and the codebase map they are generated from, and this
 * repository keeps both out of version control, so they are asserted where they
 * exist and skipped where they do not rather than failing a fresh clone for
 * missing a file it was never given. The count below is what stops that
 * tolerance from quietly emptying the loop.
 */
const ADDRESS_DOCUMENTS = [
  "README.md",
  ADDRESS_WRITER,
  ".claude/CLAUDE.md",
  ".planning/codebase/ARCHITECTURE.md",
];

/** How many of those documents are committed, and therefore always readable. */
const COMMITTED_ADDRESS_DOCUMENTS = 2;

/**
 * Every history-mutating call this file performs, one entry per call site, named
 * by the method rather than by the receiver.
 *
 * Asked of the tree rather than of the text, so a method named inside a string or
 * a comment is not a call. Matched on the property being called rather than on
 * the whole callee as written, because the invariant is about the mutation
 * happening at all: a destructured binding or a receiver held in a local is the
 * same second writer under a different spelling.
 */
function historyMutations(file: ts.SourceFile): string[] {
  const found: string[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const name = ts.isPropertyAccessExpression(callee)
        ? callee.name.text
        : ts.isIdentifier(callee)
          ? callee.text
          : undefined;

      if (name === "replaceState" || name === "pushState") found.push(name);
    }

    node.forEachChild(visit);
  };

  file.forEachChild(visit);
  return found;
}

/**
 * The keys the query-string schema declares, sorted, read out of the schema's own
 * property names.
 *
 * Read from the construct rather than from a token search, and read as names
 * rather than through literalValue over the whole array, because each entry also
 * carries a parse and a serialize function and a literal evaluator would refuse
 * the array outright.
 */
function schemaKeys(): string[] {
  const file = moduleSource(SCHEMA_MODULE);
  let entries: readonly ts.Expression[] | undefined;

  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "PARAM_SCHEMA" &&
      node.initializer &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      entries = node.initializer.elements;
    }

    node.forEachChild(visit);
  };

  file.forEachChild(visit);

  return required(entries, `PARAM_SCHEMA in ${SCHEMA_MODULE}`)
    .map((entry) => {
      const key = ts.isObjectLiteralExpression(entry)
        ? entry.properties.find(
            (property): property is ts.PropertyAssignment =>
              ts.isPropertyAssignment(property) &&
              ts.isIdentifier(property.name) &&
              property.name.text === "key",
          )
        : undefined;

      return literalValue(
        required(key?.initializer, `a schema entry's key in ${SCHEMA_MODULE}`),
        file,
      ) as string;
    })
    .toSorted();
}

/** The one module allowed to ask the platform for a locale. */
const FORMATTER_MODULE = "src/i18n/format.ts";

/**
 * The value-level locale-aware helpers on strings, numbers and dates.
 *
 * Every one of these reads a locale from the machine when it is called with no
 * argument, which is the defect this phase exists to close: four independent
 * defaults where the application resolves exactly one locale. They are also
 * expensive in the same way the constructors are, because each call builds a
 * formatter and throws it away.
 */
const LOCALE_AWARE_METHODS = new Set([
  "localeCompare",
  "toLocaleString",
  "toLocaleDateString",
  "toLocaleTimeString",
  "toLocaleLowerCase",
  "toLocaleUpperCase",
]);

/**
 * Every place a file asks the platform for a locale: a construction of an
 * internationalization namespace constructor, or a call to one of the
 * value-level helpers above.
 *
 * Asked of the tree rather than of the text, which is this file's own standard
 * and is load-bearing twice over here. A namespace named inside a block comment
 * is not a call site, and this guard is worthless if the paragraph explaining
 * why the rule exists can fail it. A type annotation naming the same
 * constructor is not one either: the comparator's fourth parameter is declared
 * as a collator and constructs nothing, which is the entire point of it being a
 * parameter.
 */
function localeCallSites(file: ts.SourceFile): string[] {
  const found: string[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isNewExpression(node) || ts.isCallExpression(node)) {
      const callee = node.expression;

      if (ts.isPropertyAccessExpression(callee)) {
        if (callee.expression.getText(file) === "Intl") {
          found.push(`Intl.${callee.name.text}`);
        } else if (LOCALE_AWARE_METHODS.has(callee.name.text)) {
          found.push(callee.name.text);
        }
      }
    }

    node.forEachChild(visit);
  };

  file.forEachChild(visit);
  return found;
}

describe("toolchain baseline", () => {
  // This guard used to ban a list of names belonging to the runner that was
  // removed, and nothing else. A second runner arriving with a config of its own
  // and a dependency of its own passed it mechanically, while the founding claim
  // it stood for, that the whole suite runs under one runner reading one config,
  // had quietly stopped being true. A guard that passes while the intent it
  // names is violated is worse than a red test, so the statement is widened
  // rather than the runner declined: two runners, named, with the file that
  // configures each, and a third is red.
  it("holds the tree to the two test runners it is written to run", () => {
    const declared = new Set(
      Object.entries(manifest)
        .filter(([key]) => /dependencies$/i.test(key) || key === "overrides")
        .flatMap(([, bucket]) =>
          bucket && typeof bucket === "object"
            ? Object.keys(bucket as Record<string, unknown>)
            : [],
        ),
    );

    // Both halves of each pair, so the statement is a fact rather than an
    // aspiration.
    for (const runner of TEST_RUNNERS) {
      expect(
        declared.has(runner.package),
        `the manifest no longer declares ${runner.package}`,
      ).toBe(true);
      expect(
        existsSync(join(projectRoot, runner.config)),
        `${runner.config} is gone, so ${runner.package} is configured by nothing`,
      ).toBe(true);
    }

    expect(
      KNOWN_TEST_RUNNERS.filter((name) => declared.has(name)).toSorted(),
      "the declared test runners are no longer the two this tree is written to run",
    ).toEqual(TEST_RUNNERS.map((runner) => runner.package).toSorted());

    expect(manifest.jest, "the manifest carries a jest block").toBeUndefined();
    expect(
      readdirSync(projectRoot).filter((name) => /^jest\.config\./.test(name)),
    ).toEqual([]);
  });

  // The one runner is driven in single-pass mode, so a pipeline run cannot be left
  // holding a watch process. The script also has to say which project it means:
  // with more than one project declared, a run that names none fans out to every
  // one of them, including the project that needs a browser engine installed.
  // Asserted as those three properties rather than as one string, so adding a flag
  // is free and dropping the project filter is not.
  it("keeps the test script on the current runner in single-pass mode against one project", () => {
    const script = manifest.scripts?.test ?? "";

    expect(
      script,
      "the test script does not start the runner in single-pass mode",
    ).toMatch(/^vitest\s+run\b/);
    expect(script, "the test script carries a watch flag").not.toMatch(
      /(^|\s)(-w|--watch)\b/,
    );
    expect(script, "the test script names no project").toMatch(/--project[= ]/);
  });

  // A report the upload step cannot collect is skipped, so the pipeline stays
  // green over an upload carrying nothing.
  it("keeps every configured report on a path the upload step collects", () => {
    // Comments blanked, because the prose above that reporter quotes these names
    // and an unstripped read would take it for configuration.
    const e2eConfig = stripComments(
      readFileSync(join(projectRoot, E2E_CONFIG_FILE), "utf8"),
    );
    // The path is read off the reporter that writes it, so a script naming an
    // output file it no longer produces reads as absent rather than as valid.
    const scriptReport = (name: string) => {
      const script = manifest.scripts?.[name] ?? "";
      return /--reporter=junit\b/.test(script)
        ? /--outputFile\.junit=(\S+)/.exec(script)?.[1]
        : undefined;
    };

    const reports: [string, string | undefined][] = [
      ["test:coverage", scriptReport("test:coverage")],
      ["test:browser", scriptReport("test:browser")],
      [
        E2E_CONFIG_FILE,
        /"junit"[^\]]*outputFile:\s*"([^"]*)"/.exec(e2eConfig)?.[1],
      ],
    ];

    // Two assertions, because an absent value satisfies no positive match but the
    // message still has to name which source writes nothing.
    for (const [source, report] of reports) {
      expect(report, `${source} writes no junit report`).toBeDefined();
      expect(
        report as string,
        `${source} writes a report the upload step does not collect`,
      ).toMatch(UPLOADED_REPORT_PATH);
    }
  });

  // A gate nothing invokes is not a gate. Every project, config and spec file
  // survives the deletion of the step that runs it, so the pipeline is asserted
  // to name each script rather than the manifest alone being trusted to imply
  // that something calls them.
  it("runs every test gate from the pipeline", () => {
    // Judged on live lines only, for the reason the pre-commit guard is:
    // commenting a step out leaves every expected string in the file.
    const live = readFileSync(join(projectRoot, WORKFLOW_FILE), "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));

    for (const script of [
      "npm run test:coverage",
      "npm run test:browser",
      "npm run test:e2e",
    ]) {
      expect(
        live.some((line) => line.includes(script)),
        `${WORKFLOW_FILE} no longer runs ${script}`,
      ).toBe(true);
    }
  });

  // The step above installs one browser binary and two config files each launch
  // one, with none of the three mentioning either of the others. They agree
  // today through a runner default rather than through anything written down: a
  // headless launch naming no channel resolves to the headless shell, which is
  // the only thing --only-shell downloads. Turn headless off to debug locally,
  // or name a channel, and the pipeline fails on a missing executable that says
  // nothing about what the gate was measuring. Asserted here so it fails in the
  // suite a developer runs first, and as one implication rather than as an
  // equality: installing more than a launch needs is wasteful, not broken.
  //
  // Every check below is inside the loop rather than taken over the two files
  // together. A count summed across the pair is satisfied by one file while the
  // other contributes nothing, and a shell resolution read off the concatenated
  // pair is satisfied by one file being headless while the other is not.
  it("installs the browser binary both launch configurations ask for", () => {
    const install = readFileSync(join(projectRoot, WORKFLOW_FILE), "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .find((line) => line.includes("playwright install"));

    expect(install, `${WORKFLOW_FILE} installs no browser`).toBeDefined();

    for (const name of LAUNCH_CONFIG_FILES) {
      // Comments blanked for both files, so a browser named in prose is never
      // mistaken for one a file launches. Both of these carry long comments
      // naming this browser.
      const config = stripComments(
        readFileSync(join(projectRoot, name), "utf8"),
      );
      const launched = [...config.matchAll(LAUNCHED_BROWSER)].map(
        (match) => match[1],
      );

      expect(launched.length, `${name} launches no browser`).toBeGreaterThan(0);

      // The names above are read off explicit keys. A device preset carries a
      // browser type of its own, so one spread into either file would add a
      // launch this guard never sees and the install check below would pass on
      // a binary the pipeline never fetched. Banned rather than parsed: the
      // preset table lives in the runner's own package, and reproducing it here
      // to keep it in step is a worse trade than making this guard be extended
      // on the day a preset is actually wanted.
      expect(
        config,
        `${name} configures a device preset, which carries a browser type past the check above`,
      ).not.toMatch(/\bdevices\s*\[/);

      for (const browser of launched) {
        expect(
          install as string,
          `${WORKFLOW_FILE} does not install ${browser}, which ${name} launches`,
        ).toContain(browser);
      }

      // The shell is a headless launch with no channel named, and nothing else.
      const resolvesToShell =
        /headless\s*:\s*true/.test(config) && !/channel\s*:/.test(config);

      expect(
        /--only-shell\b/.test(install as string) && !resolvesToShell,
        `${WORKFLOW_FILE} installs the headless shell alone and ${name} launches a browser that is not it`,
      ).toBe(false);
    }
  });

  // Nothing under src/ imports the icon or the manifest. index.html names each
  // by href and the bundler copies both out of public/ verbatim, so a rename
  // breaks neither the build nor the type check: it surfaces as a request for a
  // file that is not there, in a browser, after the fact. That is how the
  // manifest came to ship into every build referenced by nothing at all, with an
  // empty icons array, and stayed that way.
  //
  // Read outward from the shell rather than from a second copy of the filenames
  // kept here, so renaming a file and its href together stays green and renaming
  // one of them does not.
  it("keeps the icon and manifest links in index.html resolving to shipped files", () => {
    const html = readFileSync(join(projectRoot, "index.html"), "utf8");
    const publicDirectory = join(projectRoot, "public");

    for (const relation of ["icon", "manifest"]) {
      const link = new RegExp(`<link[^>]*\\brel="${relation}"[^>]*>`).exec(
        html,
      )?.[0];

      expect(link, `index.html declares no ${relation} link`).toBeDefined();

      const href = /\bhref="([^"]*)"/.exec(link ?? "")?.[1];

      expect(href, `the ${relation} link declares no href`).toBeDefined();
      expect(
        existsSync(join(publicDirectory, (href ?? "").replace(/^\//, ""))),
        `the ${relation} link points at ${href ?? ""}, which public/ does not carry`,
      ).toBe(true);
    }

    const manifest = JSON.parse(
      readFileSync(join(publicDirectory, "manifest.json"), "utf8"),
    ) as { icons?: { src?: string }[] };

    expect(
      manifest.icons ?? [],
      "the manifest carries no icon, so an install has nothing to draw",
    ).not.toHaveLength(0);

    for (const icon of manifest.icons ?? []) {
      expect(
        existsSync(join(publicDirectory, icon.src ?? "")),
        `the manifest names the icon ${icon.src ?? ""}, which public/ does not carry`,
      ).toBe(true);
    }
  });

  // The theme rule is written twice, once in a module and once as a literal
  // inside the blocking inline script, because that script runs before anything
  // importable and cannot import the module. This repository's own constraints
  // recorded that hazard and recorded that nothing asserted the two copies
  // agreed. Stamping the locale from the same script doubles it, so both rules
  // are held here instead of one being documented and neither being checked.
  //
  // Both sides are read as written rather than imported. A reader comparing
  // index.html with the module compares literals, so the guard compares literals
  // too, and set equality rather than substring presence: a guard that searched
  // index.html for the storage key would pass on the mention of it in the
  // comment above the script.
  describe("the inline script and the resolvers", () => {
    it("agrees on both storage keys", () => {
      expect(
        new Set(firstArguments(inlineScript(), "localStorage.getItem")),
      ).toEqual(
        new Set([
          declaredLiteral(
            moduleSource(THEME_MODULE),
            "THEME_STORAGE_KEY",
            THEME_MODULE,
          ),
          declaredLiteral(
            moduleSource(LOCALE_MODULE),
            "LOCALE_STORAGE_KEY",
            LOCALE_MODULE,
          ),
        ]),
      );
    });

    it("agrees on the media query", () => {
      expect(firstArguments(inlineScript(), "window.matchMedia")).toEqual([
        declaredLiteral(
          moduleSource(THEME_MODULE),
          "PREFERS_DARK_QUERY",
          THEME_MODULE,
        ),
      ]);
    });

    it("accepts exactly the explicit theme words the module declares", () => {
      const declared = declaredLiteral(
        moduleSource(THEME_MODULE),
        "THEME_CHOICES",
        THEME_MODULE,
      ) as string[];

      expect(
        new Set(
          declaredLiteral(
            inlineScript(),
            "THEME_WORDS",
            "index.html",
          ) as string[],
        ),
        // The default is the key not being there, so the script must not accept
        // the word for it any more than the module's own reader does.
      ).toEqual(new Set(declared.filter((word) => word !== "system")));
    });

    it("agrees on which catalogs a preference list may select", () => {
      expect(
        new Set(
          declaredLiteral(
            inlineScript(),
            "NEGOTIABLE",
            "index.html",
          ) as string[],
        ),
      ).toEqual(
        new Set(
          declaredLiteral(
            moduleSource(LOCALE_MODULE),
            "NEGOTIABLE_CATALOG_IDS",
            LOCALE_MODULE,
          ) as string[],
        ),
      );
    });

    it("agrees on the tag and the direction of every catalog", () => {
      const resolved = declaredLiteral(
        moduleSource(LOCALE_MODULE),
        "RESOLVED_LOCALES",
        LOCALE_MODULE,
      ) as Record<string, { catalog: string; tag: string; dir: string }>;

      // The script stamps two attributes and has no use for the third field, so
      // it carries two. Compared field by field rather than whole, so the guard
      // states which of the two rules drifted.
      expect(declaredLiteral(inlineScript(), "LOCALES", "index.html")).toEqual(
        Object.fromEntries(
          Object.entries(resolved).map(([id, locale]) => [
            id,
            { tag: locale.tag, dir: locale.dir },
          ]),
        ),
      );

      // The field the script does not carry, checked on the module side alone:
      // an entry naming a catalog other than its own key would send a reader to
      // a catalog the rest of the record says they did not ask for.
      for (const [id, locale] of Object.entries(resolved)) {
        expect(locale.catalog, `the ${id} entry`).toBe(id);
      }
    });
  });

  // A faked clock plus the user input library deadlocks unless the library is told
  // which clock to advance, and a file that never restores the real clock leaks the
  // fake one into whatever runs next. Both were found the hard way during the
  // migration, so both are asserted across the whole tree rather than in the one
  // file that happened to hit them.
  //
  // This is the second guard reading the scanned file list, so it gained the
  // second runner's directory as an input the day that directory appeared.
  // Stating it is the point: a guard silently gaining a new input is the kind of
  // thing that gets discovered rather than known. It is inert for those specs,
  // which fake no clock and import no input library, so both loops below skip
  // them on their first condition.
  it("binds every faked clock correctly in every test file", () => {
    expect(scannedFiles.length).toBeGreaterThan(0);

    const offenders: string[] = [];

    for (const file of scannedFiles) {
      const source = stripComments(readFileSync(file, "utf8"));
      const tree = parse(source);
      if (!containsCall(tree, FAKE_CLOCK_CALL, tree)) continue;

      const name = relative(projectRoot, file);

      // Required inside the teardown hook rather than anywhere in the file, since a
      // restore that only ever runs on the happy path is not a restore.
      const restores = findCalls(tree, "afterEach").some((call) =>
        call.arguments.some((argument) =>
          containsCall(argument, REAL_CLOCK_CALL, tree),
        ),
      );

      if (!restores) {
        offenders.push(`${name}: never restores the clock in an afterEach`);
      }

      if (!IMPORTS_USER_EVENT.test(source)) continue;

      // The library's direct entry points construct their own session with a no-op
      // clock advance, so they wait on a real timer the frozen clock never fires.
      // There is no argument to correct; the session form is the only bindable one.
      if (directUserEventCalls(tree).length > 0) {
        offenders.push(
          `${name}: calls the input library directly, which cannot be bound to a fake clock`,
        );
      }

      // Judged per call site: one bound session elsewhere in the file says nothing
      // about this one.
      for (const call of findCalls(tree, "userEvent.setup")) {
        if (!bindsClock(call)) {
          offenders.push(
            `${name}: opens an input session that is not bound to the fake clock`,
          );
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  // The guard above only sees files it recognizes as tests. A clock installed from
  // shared setup would put the whole suite on a frozen clock from a file it never
  // reads, so that possibility is closed here rather than left implicit. The
  // files read are the ones the config actually names, so a project that grows a
  // setup file is covered the day it is added rather than the day someone
  // remembers this list.
  it("installs no global fake clock outside the test files", () => {
    const scanned = suiteWideFiles();

    expect(
      scanned.length,
      `${CONFIG_FILE} declares no setup files, so this guard reads the config alone`,
    ).toBeGreaterThan(1);

    for (const name of scanned) {
      const source = stripComments(
        readFileSync(join(projectRoot, name), "utf8"),
      );

      expect(source, `${name} installs a global fake clock`).not.toMatch(
        FAKES_CLOCK,
      );
      expect(source, `${name} configures a global fake clock`).not.toMatch(
        CONFIGURES_CLOCK,
      );
    }
  });

  // A file whose mounts outnumber its assertions is measured here rather than in
  // review, because the number a reviewer would have to count is the one thing a
  // machine counts reliably. Each file is read from disk with nothing carried
  // between iterations, so the offender list is the same on one worker or many.
  //
  // This rule reaches the second runner's specs unmodified, and the mechanism is
  // worth writing down because it reads like a change that would be needed and
  // is not. The walk starts at the project root rather than at the source
  // directory, it skips four directories and the second runner's is not one of
  // them, and the filename pattern it matches is the runner-default shape rather
  // than the narrower one this project happens to use, so a spec in that
  // directory is graded the day it is written with no configuration change at
  // all.
  //
  // Which half of the rule bites such a spec is the other thing worth stating.
  // It mounts nothing and asserts something, so it satisfies the inequality
  // trivially; what catches it is the zero-assertion branch below, which is
  // exactly the file that navigates, produces a green run and proves nothing.
  // The setup module in the same directory does not match the filename pattern
  // and is therefore not graded, which is correct, because it asserts nothing by
  // design.
  //
  // Two alternatives were rejected. Widening the mounting pattern to count
  // navigations was rejected because it makes the rule mean two different things
  // depending on which directory it is read in. Exempting the second runner with
  // a recorded reason was rejected because what is written here is that reason
  // plus the guard still running, which is strictly stronger and costs no code.
  it("asserts something, and no more renders than assertions, in every test file", () => {
    expect(scannedFiles.length).toBeGreaterThan(0);

    // Without this the recording above goes stale silently: adding that
    // directory to the skipped set would stop grading every end-to-end spec
    // with the comment still sitting here saying they are graded.
    expect(
      scannedFiles.some(isEndToEndSpec),
      `no file under ${E2E_DIRECTORY}/ is graded, so the rule stopped reading the end-to-end specs`,
    ).toBe(true);

    const offenders: string[] = [];

    for (const file of scannedFiles) {
      // codeMask rather than stripComments: this counts call sites, and
      // stripComments deliberately keeps literals, so a string such as
      // "call render(x) before expect(y)" would score one of each. The provider
      // guard is the only one that needs the literals it keeps.
      const source = codeMask(readFileSync(file, "utf8"));
      const renders = source.match(COUNTS_AS_RENDER)?.length ?? 0;
      const assertions = source.match(COUNTS_AS_ASSERTION)?.length ?? 0;
      const name = relative(projectRoot, file);

      // Named ahead of the comparison rather than left to it: zero renders
      // against zero assertions satisfies the inequality while being the
      // clearest case of a file that produces coverage and no evidence.
      if (assertions === 0) {
        offenders.push(`${name}: asserts nothing`);
      } else if (renders > assertions) {
        offenders.push(
          `${name}: ${renders} renders against ${assertions} assertions`,
        );
      }
    }

    expect(offenders).toEqual([]);
  });

  // The exclude list decides what the hundred percent is measured over, so it is
  // the one place a gate can be satisfied by shrinking its own input. Compared as
  // a set: reordering the four patterns is not a weakening and must not flap the
  // guard, while adding one, removing one or emptying the list must all fail.
  it("keeps the coverage exclude list at the four patterns it is written to hold", () => {
    const patterns = coveragePatterns("exclude");

    expect(
      patterns,
      `${CONFIG_FILE} declares no coverage exclude list`,
    ).not.toBeNull();

    expect(patterns?.toSorted()).toEqual(COVERAGE_EXCLUDE_PATTERNS.toSorted());
  });

  // Sonar reads a file the coverage report excludes as main source and counts
  // every line of it as uncovered, which is how the same tree reported 92.9%
  // there and 98.5% here. The properties file states that the two lists have to
  // agree; this is the assertion that makes the statement hold, and it is
  // derived from the coverage list so neither side can be edited alone.
  it("keeps the Sonar test inclusions agreeing with the coverage exclude list", () => {
    const declared = /^sonar\.test\.inclusions=(.*)$/m.exec(
      readFileSync(join(projectRoot, SONAR_FILE), "utf8"),
    );

    expect(
      declared,
      `${SONAR_FILE} declares no test inclusions`,
    ).not.toBeNull();

    const patterns = (declared?.[1] ?? "")
      .split(",")
      .map((pattern) => pattern.trim())
      .filter((pattern) => pattern !== "");

    expect(patterns.toSorted()).toEqual(
      COVERAGE_EXCLUDE_PATTERNS.flatMap(sonarEquivalents).toSorted(),
    );
  });

  // The other way to reach the number without writing the test: name the provider
  // whose suppression syntax the tree happens to carry, and suppress. Both halves
  // are asserted, and the config is scanned alongside the source because it is the
  // file that holds the coverage block.
  it("uses the v8 provider and carries no coverage ignore hint anywhere", () => {
    expect(
      stripComments(readFileSync(join(projectRoot, CONFIG_FILE), "utf8")),
      `${CONFIG_FILE} does not declare the v8 coverage provider`,
    ).toMatch(/provider\s*:\s*"v8"/);

    const sourceRoot = join(projectRoot, "src");
    // withFileTypes, because a failed browser run leaves a screenshot directory
    // named after the suite that wrote it. `src/__screenshots__/a11y.browser.test.tsx`
    // is a directory whose name ends in .tsx, so a name-only filter hands it to
    // readFileSync and this guard dies of EISDIR for a reason unrelated to what
    // it checks. CI never sees it, because the browser sweep runs after the
    // coverage step, which is exactly why it would only ever bite locally.
    const files = readdirSync(sourceRoot, {
      recursive: true,
      withFileTypes: true,
    })
      .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
      .map((entry) => join(entry.parentPath, entry.name))
      .concat(join(projectRoot, CONFIG_FILE))
      .filter((file) => file !== guardFile);

    expect(files.length).toBeGreaterThan(0);

    const offenders = files.filter((file) =>
      COVERAGE_IGNORE_HINT.test(readFileSync(file, "utf8")),
    );

    expect(offenders.map((file) => relative(projectRoot, file))).toEqual([]);
  });

  // The real-engine sweep mounts App rather than the entry module, so it has to
  // pull in the global stylesheet itself. That is a second copy of the fact of
  // which sheets this app ships, and the sweep it feeds is the contrast one: a
  // sheet added to the entry module alone leaves the sweep reading a page no
  // reader ever loads, and reporting green on it. Compared as a set of
  // side-effect imports, which is what a global sheet is; a module stylesheet
  // arrives bound to a name and is nobody's global.
  it("keeps the browser sweep on the same global stylesheets the entry module ships", () => {
    const globalSheets = (file: string): string[] =>
      [
        ...stripComments(
          readFileSync(join(projectRoot, file), "utf8"),
        ).matchAll(/^import\s+"([^"]*\.css)";$/gm),
      ]
        .map((match) => required(match[1], "the imported stylesheet"))
        .toSorted();

    const shipped = globalSheets("src/index.tsx");

    expect(
      shipped.length,
      "src/index.tsx imports no global stylesheet",
    ).toBeGreaterThan(0);

    expect(globalSheets("src/a11y.browser.test.tsx")).toEqual(shipped);
  });

  // The dataset ceiling is written twice on purpose, once where a reader
  // evaluating this project reads and once where a reader of the code asks the
  // question. Two copies of one fact is how the provenance account came to have
  // a corrected half and a disproved half sitting beside each other, so this
  // pair is held from one literal in the same idiom. The code copy is a block
  // comment, so the comparison strips the leading asterisks: a guard that failed
  // on markup would be a guard nobody keeps.
  it("keeps one account of the dataset ceiling in the README and the data module", () => {
    for (const name of SOURCE_FORM_DOCUMENTS) {
      const source = readFileSync(join(projectRoot, name), "utf8");
      const text = name.endsWith(".md")
        ? normalizeProse(source)
        : normalizeComment(source);

      expect(
        text,
        `${name} no longer carries: ${SOURCE_FORM_CEILING}`,
      ).toContain(SOURCE_FORM_CEILING);
    }
  });

  // The footer carries this same attribution and has its own test. The README
  // copy has nothing watching it, so a documentation rewrite could drop the
  // source link, the license link, or the record of what was changed, and the
  // suite would stay green while the obligation lapsed in the place most readers
  // meet this project first.
  it("keeps the data attribution in the README", () => {
    const readme = readFileSync(join(projectRoot, "README.md"), "utf8");

    for (const required of [
      ATTRIBUTION_SOURCE_URL,
      ATTRIBUTION_LICENSE_URL,
      ATTRIBUTION_MODIFICATIONS,
    ]) {
      expect(readme, `README.md no longer carries: ${required}`).toContain(
        required,
      );
    }
  });

  // The README and the license file already disagreed once, in the direction of
  // the README claiming a fresh CSV run the artifact's own tie-break ordering
  // disproves. Removal was guarded in neither document and divergence was guarded
  // in neither, so the wrong copy sat beside the right one with the suite green.
  // Both documents are asserted here from one pair of literals, which makes a
  // rewrite of either one alone a red test rather than a silent contradiction.
  it("keeps one account of the dataset's provenance in the README and the license file", () => {
    const sentences = [PROVENANCE_SERIALIZATION, PROVENANCE_REGENERATION];

    for (const name of ["README.md", "src/data/worldcities/license.txt"]) {
      const text = normalizeProse(
        readFileSync(join(projectRoot, name), "utf8"),
      );

      for (const sentence of sentences) {
        expect(text, `${name} no longer carries: ${sentence}`).toContain(
          sentence,
        );
      }
    }

    // An absence rather than a presence: the account belongs in the two documents
    // a reader consults for provenance, and the third copy in the data module is
    // what let the disproved sentence survive a correction of the other two. The
    // comparison strips the block comment's asterisk prefixes, so a copy pasted
    // back in as a comment cannot pass on its markup.
    const dataModule = normalizeComment(
      readFileSync(join(projectRoot, "src/data/worldcities/cities.ts"), "utf8"),
    );

    for (const sentence of sentences) {
      expect(
        dataModule,
        `src/data/worldcities/cities.ts has grown a copy of the provenance: ${sentence}`,
      ).not.toContain(sentence);
    }
  });
  // The README names a major for four packages and the manifest owns the real
  // version, which is two copies of one fact with nothing holding them
  // together. That is how a README goes stale without a single failing check,
  // so the majors are read back out of the prose and compared here. The set is
  // asserted before the values: without it, deleting a version from the list
  // would leave this passing over whatever remained.
  it("agrees with the manifest on every major the README stack list names", () => {
    const readme = readFileSync(join(projectRoot, "README.md"), "utf8");
    const section = /\n## Stack\n([\s\S]*?)\n### /.exec(readme)?.[1];

    expect(section, "the README has no Stack section").toBeDefined();

    // A bullet opening with a link and following it with a bare number. The
    // link text is captured rather than assumed, so a renamed label fails the
    // set comparison below instead of dropping out of it in silence.
    const named = new Map<string, string>();

    for (const line of (section ?? "").split("\n")) {
      const bullet = /^- \[([^\]]+)\]\([^)]+\) (\d+)\b/.exec(line);
      if (bullet?.[1] !== undefined && bullet[2] !== undefined) {
        named.set(bullet[1], bullet[2]);
      }
    }

    expect(
      [...named.keys()].sort(),
      "the versioned entries in the README stack list are not the ones this test knows about",
    ).toEqual(Object.keys(README_STACK_MAJORS).sort());

    const pinned: Record<string, string | undefined> = {
      ...(manifest.dependencies as Record<string, string> | undefined),
      ...(manifest.devDependencies as Record<string, string> | undefined),
    };

    for (const [label, name] of Object.entries(README_STACK_MAJORS)) {
      const version = pinned[name];

      expect(version, `${name} is not pinned in the manifest`).toBeDefined();
      expect(
        named.get(label),
        `README says ${label} ${named.get(label) ?? "nothing"} against ${name}@${version ?? "nothing"}`,
      ).toBe((version ?? "").split(".")[0]);
    }
  });
  // The address design had four invariants and no machine check of any of them:
  // the single writer, the absence of a push, the guarded write and the omitted
  // defaults were prose, plus behavior tests that would still pass beside a
  // second writer nobody noticed. Following the reader's locale is what made the
  // headline statement move, so the statement is amended and guarded in the same
  // change set rather than left to be discovered wrong later.
  //
  // Three questions, all asked of constructs. Whether anything but the one
  // component mutates history, whether the query string still owns exactly the
  // four keys it owned, and whether every document a reader consults for the
  // design still says the same thing about what a link reproduces. A token
  // search would pass on all three from a mention inside a comment.
  it("keeps one address writer, four query keys, and one account of what a link carries", () => {
    const sources = findSourceFiles(join(projectRoot, "src"));

    expect(
      sources.length,
      "the source walk found no module under src/, so this guard read nothing",
    ).toBeGreaterThan(0);

    const writers: string[] = [];
    const pushes: string[] = [];

    for (const path of sources) {
      const name = relative(projectRoot, path).split(sep).join("/");

      for (const method of historyMutations(
        parse(readFileSync(path, "utf8")),
      )) {
        if (method === "replaceState") writers.push(name);
        else pushes.push(name);
      }
    }

    expect(
      writers.toSorted(),
      "the address is written from somewhere other than exactly the one writer",
    ).toEqual([ADDRESS_WRITER]);

    // Separate from the count above so the failure says which rule broke. A push
    // fills the back stack with positions the reader never asked to record, which
    // is a different defect from a second writer arguing over the query string.
    expect(
      pushes.toSorted(),
      "a history push appeared under src/, so Back no longer leaves the site",
    ).toEqual([]);

    expect(
      schemaKeys(),
      "the query-string schema owns a different set of keys than it did",
    ).toEqual(SCHEMA_KEYS);

    let read = 0;

    for (const name of ADDRESS_DOCUMENTS) {
      const path = join(projectRoot, name);
      if (!existsSync(path)) continue;

      read += 1;

      expect(
        normalizeComment(readFileSync(path, "utf8")),
        `${name} no longer carries: ${ADDRESS_INVARIANT}`,
      ).toContain(ADDRESS_INVARIANT);
    }

    // Without this the loop above passes vacuously the day someone renames the
    // README or moves the writer, which is the failure mode a tolerance for
    // missing files always brings with it.
    expect(
      read,
      "fewer documents carrying the address invariant were found than are committed",
    ).toBeGreaterThanOrEqual(COMMITTED_ADDRESS_DOCUMENTS);
  });
  // The application resolves one locale and four surfaces follow it: the
  // catalog, the document element, the ordering of text and the grouping of
  // numbers. A fifth surface asking the platform for a locale of its own would
  // reintroduce the defect the locale layer closed, and would do it invisibly,
  // since a machine whose own preference is the base tag renders every one of
  // them identically.
  //
  // The modules under src/ are held by the no-restricted-syntax rules in
  // eslint.config.js. Two halves of that rule are outside what a lint rule can
  // reach, and both are here. ESLint does not lint HTML, so the inline script is
  // asserted here or nowhere; and a disallow rule cannot say that the formatter
  // module still builds anything, so it passes just as happily on a formatter
  // module with its caches deleted.
  it("asks the platform for a locale only where the lint rule cannot reach", () => {
    // The inline script resolves a locale of its own before any module loads.
    // It reaches its answer through a literal map rather than through the
    // platform, so it should contribute nothing.
    expect(
      localeCallSites(inlineScript()),
      "the inline script in index.html asks the platform for a locale",
    ).toEqual([]);

    expect(
      localeCallSites(
        parse(readFileSync(join(projectRoot, FORMATTER_MODULE), "utf8")),
      ).toSorted(),
      "the formatter module no longer builds the four cached instances",
    ).toEqual([
      "Intl.Collator",
      "Intl.ListFormat",
      "Intl.NumberFormat",
      "Intl.PluralRules",
    ]);
  });
});

describe("the plugin rule sets the lint gate claims to run", () => {
  // A flat-config block that spreads a shared config and then declares its own
  // rules key replaces that config's rules wholesale rather than merging with
  // them. The gate stays green, because the rules are simply absent. Same
  // per-object replacement hazard eslint.config.js records for
  // no-restricted-imports, one level up, and no disallow rule can state the
  // positive claim that a rule set is still on.
  //
  // The one rule turned off on purpose: the new JSX transform needs no import
  // in scope. Listed here so a second name joining it has to be deliberate.
  const DELIBERATELY_OFF = ["react/react-in-jsx-scope"];

  const severityOf = (entry: unknown): unknown =>
    Array.isArray(entry) ? entry[0] : entry;

  const isOff = (entry: unknown): boolean => {
    const severity = severityOf(entry);
    return severity === 0 || severity === "off" || severity === undefined;
  };

  it("has every rule of the React recommended set active", async () => {
    const { ESLint } = await import("eslint");
    const react = (await import("eslint-plugin-react")).default;

    // calculateConfigForFile answers for a path with nothing behind it, so a
    // rename would otherwise leave this guard green over a file that moved.
    const target = join(projectRoot, "src/components/DataTable/TableHead.tsx");
    expect(existsSync(target), "the guard's sample file moved").toBe(true);

    const resolved: unknown = await new ESLint({
      cwd: projectRoot,
    }).calculateConfigForFile(target);
    const active =
      (resolved as { rules?: Record<string, unknown> }).rules ?? {};

    const recommended = required(
      react.configs.flat.recommended,
      "the React recommended flat config",
    ).rules;

    // The plugin ships a few of its own recommended entries at severity 0, so
    // the claim is over the ones it actually enables.
    const enabled = Object.entries(recommended ?? {})
      .filter(([, entry]) => !isOff(entry))
      .map(([name]) => name)
      .filter((name) => !DELIBERATELY_OFF.includes(name));

    expect(
      enabled.length,
      "the React recommended set is empty",
    ).toBeGreaterThan(10);

    expect(
      enabled.filter((name) => isOff(active[name])),
      "rules of the React recommended set are not on",
    ).toEqual([]);
  });
});
