import { existsSync, globSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { required } from "./test/required";

/**
 * Guards over the toolchain baseline itself. Each convention below was
 * established once, and nothing else in the suite notices if one is undone.
 *
 * Every guard inspects the construct it cares about rather than searching for a
 * token. A token search passes on a mention inside a comment, and on a file
 * where one call site is correct and the next is not.
 */

// Resolved from this file's own location, because the working directory is wherever
// the runner happened to be invoked and is not the project root under an IDE runner
// or an explicit --root. Read off import.meta directly, because the DOM environment
// replaces the global URL class and node:url will not convert the result.
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
 * The file parsed once, as TSX so a JSX tag and a generic arrow both read the
 * way the tree writes them.
 *
 * A parse rather than a scanner: whether a slash opens a regular expression,
 * divides, or sits inside a JSX tag is decided by the grammar, not by the
 * characters either side of it.
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

/**
 * Every value the visitor returns for a node, in source order.
 *
 * The walks below differ only in that predicate. Starts at the file's children,
 * so the source file node itself is never handed to a visitor.
 */
function collect<T>(
  file: ts.SourceFile,
  visit: (node: ts.Node) => T | undefined,
): T[] {
  const found: T[] = [];

  const walk = (node: ts.Node): void => {
    const value = visit(node);
    if (value !== undefined) found.push(value);
    node.forEachChild(walk);
  };

  file.forEachChild(walk);
  return found;
}

/** A half-open span of the source, in UTF-16 code units. */
type Range = readonly [start: number, end: number];

/**
 * Every comment in the file.
 *
 * A comment is trivia rather than a node, so it is reached through the token it
 * is attached to. Every comment attaches to exactly one token, the end-of-file
 * token included, so walking the leaves reaches each one once.
 */
function commentRanges(file: ts.SourceFile): Range[] {
  const text = file.getFullText();
  const found: Range[] = [];

  const visit = (node: ts.Node): void => {
    const children = node.getChildren(file);

    if (children.length === 0) {
      // Both, because the two APIs partition the comments between them and do
      // not overlap. A comment on the same line as the code before it is trailing by
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
 * The source with every listed range reduced to spaces, keeping the line breaks
 * so an index into the result is still an index into the original.
 *
 * Split by code unit, because that is the unit the parser reports its positions
 * in, and splitting by code point would slide every offset after an astral
 * character by one.
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
 * Literals are kept. They are part of the code, and one guard below reads the
 * provider name out of one.
 */
function stripComments(source: string): string {
  return blankRanges(source, commentRanges(parse(source)));
}

/** The name a call names, whether it is bare or a member call. */
function calleeName(call: ts.CallExpression): string | undefined {
  const callee = call.expression;

  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;

  return ts.isIdentifier(callee) ? callee.text : undefined;
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
 * Asked of the tree, because the question is whether the call happens. A name written inside a string is not a call, and a teardown hook
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
  return collect(file, (node) =>
    isCallTo(node, callee, file) ? node : undefined,
  );
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
    // own text, because the source of a quoted key carries the quotation marks
    // and the key does not.
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

/**
 * Every file matching a pattern, walked with the platform's own glob.
 *
 * withFileTypes and the isFile filter are not decoration. A failed browser run
 * leaves src/__screenshots__/<spec name>.tsx, which is a directory whose name
 * ends in .tsx, and the glob returns it like any other match. Handing that to
 * readFileSync dies of EISDIR for a reason unrelated to what the guard checks.
 */
function projectFiles(pattern: string): string[] {
  return globSync(pattern, {
    cwd: projectRoot,
    withFileTypes: true,
    exclude: (entry) =>
      entry.isDirectory() &&
      /^(?:node_modules|dist|lib|coverage|\.git)$/.test(entry.name),
  })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

/**
 * Every file the runner would collect. The pattern tracks the runner's own
 * default include, which is wider than the shape this project uses today, so a
 * first `.spec.ts` is covered the day someone writes it.
 */
function testFiles(): string[] {
  return projectFiles("**/*.{test,spec}.?([cm])[jt]s?(x)");
}

/**
 * Every module under src/ that is not a test file, so a guard can ask a
 * question of the application rather than of the suite. A call site in a test is
 * a test double; a call site in a module is the application doing it.
 *
 * A `.test-d.ts` is in neither walk, because the runner never collects one and
 * nothing it contains ships.
 */
function sourceModules(): string[] {
  return projectFiles("src/**/*.?([cm])[jt]s?(x)").filter(
    (file) => !/\.(test|spec)(-d)?\.[cm]?[jt]sx?$/.test(file),
  );
}

const scannedFiles = testFiles().filter((file) => file !== guardFile);

// The directory holding the second runner's specs. Named here because two
// guards below read it and one of them asserts it is still being read.
const E2E_DIRECTORY = "e2e";

/** Whether a scanned file is one of the second runner's specs. */
function isEndToEndSpec(file: string): boolean {
  return relative(projectRoot, file).split(sep)[0] === E2E_DIRECTORY;
}

/**
 * The two clock calls, named as the tree writes them. The guard below asks the
 * tree whether each one happens, because the text only says whether it appears.
 */
const FAKE_CLOCK_CALL = "vi.useFakeTimers";
const REAL_CLOCK_CALL = "vi.useRealTimers";

// A test file that mounts more than it asserts spends its runtime producing
// coverage rather than evidence, and the coverage gate cannot tell the two
// apart. Zero assertions satisfies the inequality, so it is named separately
// below.
//
// Counted off the tree by callee name, so a member call such as a root's own
// render method counts and a rerender does not.
const COUNTS_AS_MOUNT = new Set(["render", "renderHook"]);
const COUNTS_AS_ASSERTION = "expect";

// The complete coverage exclude list. Four entries, named here and not derived,
// because a list that grows quietly is how the guard stops being one. Three
// of them match artifacts that never execute; src/test/** matches the shared
// scaffolding, which does execute on every run and is excluded because it is
// support code for the tests and not code the product ships. An application
// source file appearing beside them would fit the gate to the code instead of
// the code to the gate, and the lint rule in eslint.config.js stops the one
// executing entry becoming that same hole by being imported from outside a test.
const COVERAGE_EXCLUDE_PATTERNS = [
  "src/**/*.test.{ts,tsx}",
  "src/**/*.test-d.ts",
  "src/test/**",
  "src/**/*.d.ts",
];

// A suppression comment in any provider's spelling, matched against raw source
// because a hint is itself a comment and blanking comments first would make the
// guard vacuous. None exists in this tree. The standing convention is that an
// otherwise-unreachable branch records the condition that would make it
// reachable, and is never hidden from the report.
const COVERAGE_IGNORE_HINT = /\b(?:v8|c8|istanbul|node)\s+ignore\b/;

const CONFIG_FILE = "vite.config.ts";
const E2E_CONFIG_FILE = "playwright.config.ts";
const WORKFLOW_FILE = ".github/workflows/ci.yml";
const SONAR_FILE = "sonar-project.properties";

// Both runner configs that launch a browser, held below against the one browser install
// line in the pipeline. There was one launch site for as long as there was one
// runner, and there are two now, so the holding is evaluated per file. A check
// taken across the pair passes on a file contributing nothing as long as the
// other file still contributes a match, and this whole exercise is written
// against that vacuous pass.
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
 * patterns are rooted at the project instead of at the source directory. Both
 * differences are mechanical, so the Sonar list is derived here. Writing it out
 * a second time would leave it to drift from the list it has to agree with.
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
// list; an empty one would otherwise pass.
function coveragePatterns(key: string): string[] | null {
  const declared = new RegExp(`${key}\\s*:\\s*\\[([^\\]]*)\\]`).exec(
    coverageBlock(),
  );

  if (declared === null) return null;

  return [
    ...required(declared[1], "the declared list").matchAll(/"([^"]*)"/g),
  ].map((match) => required(match[1], "a quoted entry"));
}

// The three things CC BY 4.0 obliges this repository to state, written out here
// so the assertion below matches the committed copy exactly and not a shape
// that resembles it.
const ATTRIBUTION_SOURCE_URL = "https://simplemaps.com/data/world-cities";
const ATTRIBUTION_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";
const ATTRIBUTION_MODIFICATIONS =
  "Modified: unused columns removed, rows ordered by population.";

/**
 * A literal expression's value, read from the tree as written. Anything else
 * throws, so a computed schema key fails here instead of being skipped.
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

/** Every shell the site ships, one per page. */
const SHELLS = ["index.html", "movies.html"];

/** How many of those are committed, and therefore always readable. */
const COMMITTED_SHELLS = 2;

/**
 * Each entry module beside the real-engine sweep that mounts the same page
 * without it. One pair per shell, held at that count below.
 */
const BROWSER_SWEEPS = [
  { entry: "src/index.tsx", sweep: "src/a11y.browser.test.tsx" },
  { entry: "src/movies.tsx", sweep: "src/a11y.films.browser.test.tsx" },
];

/**
 * The shells to read, with the count guarded.
 *
 * Without the count the loops below pass vacuously the day someone renames a
 * shell, the failure mode a list-driven guard always brings with it.
 * Same idiom the address-document loop uses, for the same reason.
 */
function shells(): string[] {
  const found = SHELLS.filter((name) => existsSync(join(projectRoot, name)));

  expect(
    found.length,
    "fewer shells were found than the site commits",
  ).toBeGreaterThanOrEqual(COMMITTED_SHELLS);

  return found;
}

/** A module of this tree, parsed, for the literals a reader sees in it. */
function moduleSource(path: string): ts.SourceFile {
  return parse(readFileSync(join(projectRoot, path), "utf8"));
}

// The one address writer, and the module that owns which keys the address may
// carry.
const ADDRESS_WRITER = "src/features/DatasetPage/DatasetPage.tsx";
const SCHEMA_MODULE = "src/components/DataTable/tableStateUrl.ts";

/**
 * Every module allowed to write the address. One module writes it, and each
 * shell mounts that one component with its own config, so any second writer
 * fails this list.
 */
const ADDRESS_WRITERS = [ADDRESS_WRITER];

/**
 * The four keys the query string owns, sorted.
 *
 * Pinned as a set instead of asserted as a floor, because the risk runs in the
 * other direction. A fifth entry for the locale would make the reader's language
 * part of the view state a link reproduces, which the address deliberately
 * does not do.
 */
const SCHEMA_KEYS = ["page", "q", "size", "sort"];

/**
 * Every history-mutating call this file performs, one entry per call site, named
 * by the method and not by the receiver.
 *
 * Matched on the property being called rather than on the whole callee, because
 * the invariant is about the mutation happening at all. A destructured binding
 * or a receiver held in a local is the same second writer.
 */
function historyMutations(file: ts.SourceFile): string[] {
  return collect(file, (node) => {
    const name = ts.isCallExpression(node) ? calleeName(node) : undefined;

    return name === "replaceState" || name === "pushState" ? name : undefined;
  });
}

/**
 * The keys the query-string schema declares, sorted, read out of the schema's own
 * property names.
 *
 * Read as names rather than through literalValue over the whole array, because
 * each entry also carries a parse and a serialize function and a literal
 * evaluator would refuse the array outright.
 */
function schemaKeys(): string[] {
  const file = moduleSource(SCHEMA_MODULE);
  const entries = collect(file, (node) =>
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.name.text === "PARAM_SCHEMA" &&
    node.initializer &&
    ts.isArrayLiteralExpression(node.initializer)
      ? node.initializer.elements
      : undefined,
  ).at(-1);

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
 * Each reads a locale from the machine when called with no argument, which is
 * the defect the locale layer closed. Each also builds a formatter and throws it
 * away.
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
 * Every place a file asks the platform for a locale: a namespace construction,
 * or a call to one of the value-level helpers above.
 *
 * Asked of the tree, which matters twice here. A namespace named in a block
 * comment is not a call site, so the paragraph explaining the rule cannot fail
 * it. Nor is a type annotation: the comparator's collator parameter constructs
 * nothing.
 */
function localeCallSites(file: ts.SourceFile): string[] {
  return collect(file, (node) => {
    if (!ts.isNewExpression(node) && !ts.isCallExpression(node))
      return undefined;

    const callee = node.expression;
    if (!ts.isPropertyAccessExpression(callee)) return undefined;

    if (callee.expression.getText(file) === "Intl") {
      return `Intl.${callee.name.text}`;
    }

    return LOCALE_AWARE_METHODS.has(callee.name.text)
      ? callee.name.text
      : undefined;
  });
}

describe("toolchain baseline", () => {
  // A report the upload step cannot collect is skipped, so the pipeline stays
  // green over an upload carrying nothing.
  it("keeps every configured report on a path the upload step collects", () => {
    // Comments blanked, because the prose above that reporter quotes these names
    // and an unstripped read would take it for configuration.
    const e2eConfig = stripComments(
      readFileSync(join(projectRoot, E2E_CONFIG_FILE), "utf8"),
    );
    // The path is read off the reporter that writes it, so a script naming an
    // output file it no longer produces reads as absent instead of valid.
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

  // One install line and two configs that each launch a browser, with none of
  // the three naming the others. A headless launch with no channel resolves to
  // the headless shell, which is all --only-shell downloads; turn headless off
  // or name a channel and the pipeline fails on a missing executable. Asserted
  // as an implication, because installing more than a launch needs is wasteful
  // and not broken.
  //
  // Every check is inside the loop. Taken across the pair, a count is satisfied
  // by one file while the other contributes nothing.
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
      // a binary the pipeline never fetched. Banned instead of parsed, because
      // the preset table lives in the runner's own package, and reproducing it
      // here to keep it in step is a worse trade than extending this guard on
      // the day a preset is actually wanted.
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

  // Nothing under src/ imports the icon or the manifest, so a rename breaks
  // neither the build nor the type check and surfaces as a missing file in a
  // browser. That is how the manifest came to ship into every build, referenced
  // by nothing, with an empty icons array.
  //
  // Read outward from the shell with no second copy of the filenames here, so
  // renaming a file and its href together stays green.
  it("keeps the icon and manifest links in every shell resolving to shipped files", () => {
    const publicDirectory = join(projectRoot, "public");

    // Over every shell, not index.html alone: a second shell carrying the same
    // two links is a second copy free to rot the same way.
    for (const shell of shells()) {
      const html = readFileSync(join(projectRoot, shell), "utf8");

      for (const relation of ["icon", "manifest"]) {
        const link = new RegExp(`<link[^>]*\\brel="${relation}"[^>]*>`).exec(
          html,
        )?.[0];

        expect(link, `${shell} declares no ${relation} link`).toBeDefined();

        const href = /\bhref="([^"]*)"/.exec(link ?? "")?.[1];

        expect(
          href,
          `the ${relation} link in ${shell} declares no href`,
        ).toBeDefined();
        expect(
          existsSync(join(publicDirectory, (href ?? "").replace(/^\//, ""))),
          `the ${relation} link in ${shell} points at ${href ?? ""}, which public/ does not carry`,
        ).toBe(true);
      }
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

  // A faked clock plus the user input library deadlocks unless the library is
  // told which clock to advance, and a file that never restores the real clock
  // leaks the fake one into whatever runs next. Both are asserted across the
  // whole tree, not only in the file that hit them.
  //
  // Inert for the end-to-end specs, which fake no clock and import no input
  // library, so both loops skip them on their first condition.
  it("binds every faked clock correctly in every test file", () => {
    expect(scannedFiles.length).toBeGreaterThan(0);

    const offenders: string[] = [];

    for (const file of scannedFiles) {
      const source = stripComments(readFileSync(file, "utf8"));
      const tree = parse(source);
      if (!containsCall(tree, FAKE_CLOCK_CALL, tree)) continue;

      const name = relative(projectRoot, file);

      // Required inside the teardown hook, because a restore that only ever runs
      // on the happy path is not a restore.
      const restores = findCalls(tree, "afterEach").some((call) =>
        call.arguments.some((argument) =>
          containsCall(argument, REAL_CLOCK_CALL, tree),
        ),
      );

      if (!restores) {
        offenders.push(`${name}: never restores the clock in an afterEach`);
      }

      // Judged per call site, because one bound session elsewhere in the file
      // cannot answer for this one.
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

  // Each file is read from disk with nothing carried between iterations, so the
  // offender list is the same on one worker or many.
  //
  // The end-to-end specs are graded too, with nothing configured to include
  // them: the walk starts at the project root and the filename pattern is the
  // runner default. They mount nothing, so the zero-assertion branch is the half
  // that reaches them. The assertion below fails if they drop out.
  it("asserts something, and no more renders than assertions, in every test file", () => {
    expect(scannedFiles.length).toBeGreaterThan(0);

    // Without this the recording above goes stale silently. Adding that
    // directory to the skipped set would stop grading every end-to-end spec,
    // with the comment still sitting here saying they are graded.
    expect(
      scannedFiles.some(isEndToEndSpec),
      `no file under ${E2E_DIRECTORY}/ is graded, so the rule stopped reading the end-to-end specs`,
    ).toBe(true);

    const offenders: string[] = [];

    for (const file of scannedFiles) {
      const tree = parse(readFileSync(file, "utf8"));
      const called = collect(tree, (node) =>
        ts.isCallExpression(node) ? calleeName(node) : undefined,
      );
      const renders = called.filter((call) => COUNTS_AS_MOUNT.has(call)).length;
      const assertions = called.filter(
        (call) => call === COUNTS_AS_ASSERTION,
      ).length;
      const name = relative(projectRoot, file);

      // Named ahead of the comparison, because zero renders against zero
      // assertions satisfies the inequality while being the clearest case of a
      // file that produces coverage and no evidence.
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

  // The other way to reach the number without writing the test is to suppress.
  // The config is scanned too, because it holds the coverage block.
  it("carries no coverage ignore hint anywhere", () => {
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

  // Each real-engine sweep mounts a container rather than its entry module, so
  // it imports the global stylesheet itself. That is a second copy of which
  // sheets this app ships, and the sweep it feeds is the contrast one: a sheet
  // added to an entry module alone leaves that page's sweep reading a page no
  // reader loads, and reporting green. Compared as a set of side-effect imports,
  // which is what a global sheet is.
  //
  // Driven over a pair per page with a count beside it, so a renamed sweep
  // empties the loop into a failure.
  it("keeps each browser sweep on the same global stylesheets its entry module ships", () => {
    const globalSheets = (file: string): string[] =>
      [
        ...stripComments(
          readFileSync(join(projectRoot, file), "utf8"),
        ).matchAll(/^import\s+"([^"]*\.css)";$/gm),
      ]
        .map((match) => required(match[1], "the imported stylesheet"))
        .toSorted();

    expect(BROWSER_SWEEPS).toHaveLength(COMMITTED_SHELLS);

    for (const { entry, sweep } of BROWSER_SWEEPS) {
      const shipped = globalSheets(entry);

      expect(
        shipped.length,
        `${entry} imports no global stylesheet`,
      ).toBeGreaterThan(0);

      expect(globalSheets(sweep), sweep).toEqual(shipped);
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

  // The token names are a published contract, so the README list cannot drift from the generator.
  it("lists exactly the generated tokens in the README styling table", () => {
    const readme = readFileSync(join(projectRoot, "README.md"), "utf8");
    const section = /\n### Styling\n([\s\S]*?)\n#{2,3} /.exec(readme)?.[1];

    expect(section, "the README has no Styling section").toBeDefined();

    const documented = (section ?? "")
      .split("\n")
      .filter((line) => line.startsWith("|"))
      .flatMap((line) => line.match(/--yart-[a-z0-9-]+/g) ?? [])
      .sort();
    const generated = [
      ...readFileSync(
        join(projectRoot, "src/styles/tokens.css"),
        "utf8",
      ).matchAll(/^\s*(--yart-[a-z0-9-]+):/gm),
    ]
      .flatMap((match) => match[1] ?? [])
      .sort();

    expect(
      {
        onlyInReadme: documented.filter((name) => !generated.includes(name)),
        onlyInTokens: generated.filter((name) => !documented.includes(name)),
      },
      "the README styling table and src/styles/tokens.css name different tokens",
    ).toEqual({ onlyInReadme: [], onlyInTokens: [] });
    expect(documented).toEqual(generated);
  });
  // Asked of constructs: whether anything but the one page component mutates
  // history, and whether the query string still owns exactly its four keys.
  it("keeps one address writer and four query keys", () => {
    const sources = sourceModules();

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
      "the address is written from somewhere other than the one writer",
    ).toEqual(ADDRESS_WRITERS);

    // Separate from the count above so the failure says which rule broke. A push
    // fills the back stack with positions the reader never asked to record, which
    // is a different defect from a second writer arguing over the query string.
    expect(
      pushes,
      "a history push appeared under src/, so Back no longer leaves the site",
    ).toEqual([]);

    expect(
      schemaKeys(),
      "the query-string schema owns a different set of keys than it did",
    ).toEqual(SCHEMA_KEYS);
  });
  // A fifth surface asking the platform for a locale of its own would
  // reintroduce the defect the locale layer closed, invisibly on a machine whose
  // own preference is the base tag.
  //
  // eslint.config.js holds the modules under src/, the boot script included. A
  // disallow rule cannot say the formatter still builds its five instances.
  it("still builds the five cached formatters in the formatter module", () => {
    expect(
      localeCallSites(
        parse(readFileSync(join(projectRoot, FORMATTER_MODULE), "utf8")),
      ).toSorted(),
      "the formatter module no longer builds the five cached instances",
    ).toEqual([
      "Intl.Collator",
      "Intl.ListFormat",
      // Twice on purpose: one plain number formatter for grouped counts and one
      // unit formatter for the runtime, cached apart because they are configured
      // differently and both are per tag.
      "Intl.NumberFormat",
      "Intl.NumberFormat",
      "Intl.PluralRules",
    ]);
  });
});

describe("the plugin rule sets the lint gate claims to run", () => {
  // A flat-config block that spreads a shared config and then declares its own
  // rules key replaces those rules wholesale rather than merging with them, and
  // the gate stays green because the rules are absent. No disallow rule can
  // state the positive claim that a rule set is still on.
  //
  // The one rule off on purpose: the new JSX transform needs no import in scope.
  // Listed so a second name joining it has to be deliberate.
  const DELIBERATELY_OFF = ["react/react-in-jsx-scope"];

  const severityOf = (entry: unknown): unknown =>
    Array.isArray(entry) ? entry[0] : entry;

  const isOff = (entry: unknown): boolean => {
    const severity = severityOf(entry);
    return severity === 0 || severity === "off" || severity === undefined;
  };

  // The specifiers are variables instead of literals because one of these
  // plugins ships no type declarations, and a literal specifier would make that
  // a typecheck failure here while eslint.config.js, being JavaScript, imports
  // it happily.
  const rulesOf = async (
    specifier: string,
    at: (module: Record<string, unknown>) => unknown,
  ): Promise<Record<string, unknown>> => {
    const loaded = (await import(specifier)) as { default?: unknown };
    const plugin = (loaded.default ?? loaded) as Record<string, unknown>;
    return (at(plugin) ?? {}) as Record<string, unknown>;
  };

  const path = (plugin: Record<string, unknown>, ...keys: string[]): unknown =>
    keys.reduce<unknown>(
      (node, key) => (node as Record<string, unknown> | undefined)?.[key],
      plugin,
    );

  it.each([
    [
      "the React",
      () =>
        rulesOf("eslint-plugin-react", (plugin) =>
          path(plugin, "configs", "flat", "recommended", "rules"),
        ),
      11,
      DELIBERATELY_OFF,
    ],
    [
      "the React Hooks",
      () =>
        rulesOf("eslint-plugin-react-hooks", (plugin) =>
          path(plugin, "configs", "flat", "recommended", "rules"),
        ),
      2,
      [],
    ],
    [
      "the JSX accessibility",
      () =>
        rulesOf("eslint-plugin-jsx-a11y", (plugin) =>
          path(plugin, "flatConfigs", "recommended", "rules"),
        ),
      10,
      [],
    ],
    [
      "the typescript-eslint type-checked",
      // An array of flat configs, merged in order so a later entry wins.
      () =>
        rulesOf("typescript-eslint", (plugin) =>
          (
            (path(plugin, "configs", "recommendedTypeChecked") ?? []) as {
              rules?: Record<string, unknown>;
            }[]
          ).reduce<Record<string, unknown>>(
            (merged, config) => ({ ...merged, ...config.rules }),
            {},
          ),
        ),
      20,
      [],
    ],
  ])(
    "has every rule of %s recommended set active",
    async (_name, load, floor, off) => {
      const { ESLint } = await import("eslint");

      // calculateConfigForFile answers for a path with nothing behind it, so a
      // rename would otherwise leave this guard green over a file that moved.
      const target = join(
        projectRoot,
        "src/components/DataTable/TableHead.tsx",
      );
      expect(existsSync(target), "the guard's sample file moved").toBe(true);

      const resolved: unknown = await new ESLint({
        cwd: projectRoot,
      }).calculateConfigForFile(target);
      const active =
        (resolved as { rules?: Record<string, unknown> }).rules ?? {};

      // A plugin ships some of its own recommended entries at severity 0, so
      // the claim is over the ones it enables.
      const enabled = Object.entries((await load()) ?? {})
        .filter(([, entry]) => !isOff(entry))
        .map(([name]) => name)
        .filter((name) => !off.includes(name));

      // A floor, not an exact count, so an upstream set that grows does not fail
      // the gate, while an empty one cannot pass it vacuously.
      expect(enabled.length, "the set resolved empty").toBeGreaterThanOrEqual(
        floor,
      );

      expect(
        enabled.filter((name) => isOff(active[name])),
        "rules of the set are not on",
      ).toEqual([]);
    },
  );

  it("has the stylelint standard-scss set active over a component stylesheet", async () => {
    const stylelint = (await import("stylelint")).default;

    const target = join(
      projectRoot,
      "src/components/DataTable/DataTable.module.scss",
    );
    expect(existsSync(target), "the guard's sample file moved").toBe(true);

    const resolved = await stylelint.resolveConfig(target);
    const rules = resolved?.rules ?? {};

    // One rule the shared set brings and this repo's own file never declares,
    // so its presence can only come from the extends line still being honored.
    expect(
      Object.keys(rules),
      "the standard-scss set is not reaching component stylesheets",
    ).toContain("scss/at-rule-no-unknown");
    expect(
      Object.keys(rules).length,
      "the resolved stylelint rule set is implausibly small",
    ).toBeGreaterThan(20);
  });
});

describe("the coverage gate the pipeline rests on", () => {
  // The exclude list beside it already has a guard. The threshold did not, and
  // it is the half that decides whether a drop fails the build or is written
  // into a log nobody reads. Asserted as the shorthand instead of as four
  // numbers, because the shorthand is what makes it total over the metrics.
  it("still asks for a hundred on every metric", () => {
    const source = readFileSync(join(projectRoot, "vite.config.ts"), "utf8");

    expect(
      source,
      "the coverage threshold is no longer the total shorthand",
    ).toMatch(/thresholds:\s*\{\s*100:\s*true\s*\}/);
  });
});
