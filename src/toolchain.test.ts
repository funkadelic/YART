import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

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
  browserslist?: unknown;
  [key: string]: unknown;
}

const manifest = JSON.parse(
  readFileSync(join(projectRoot, "package.json"), "utf8"),
) as Manifest;

/**
 * A character that can end a value. It is the whole of the rule that tells a
 * division from a regular expression literal, which both open with a slash and
 * are distinguished by nothing else. The closing brace and the less-than sign
 * are on the list for JSX rather than for JavaScript: a self-closing tag puts a
 * slash right after `{...props}` and a closing tag puts one right after `<`, and
 * reading either as a regular expression would run to the next slash in the
 * file.
 */
const ENDS_A_VALUE = /[\w$)\]}"'`/<]/;

/** A span of source, and whether the scanner reads it as code. */
interface Span {
  start: number;
  end: number;
  kind: "code" | "comment" | "literal";
}

/**
 * The index just past the comment or literal beginning at `start`, or null when
 * ordinary code begins there. `previous` is the last significant character
 * before it, which is what decides whether a slash opens a regular expression.
 */
function spanEnd(
  source: string,
  start: number,
  previous: string,
): number | null {
  const opener = source[start];

  if (opener === "/" && source[start + 1] === "/") {
    const end = source.indexOf("\n", start);
    return end === -1 ? source.length : end;
  }

  if (opener === "/" && source[start + 1] === "*") {
    const end = source.indexOf("*/", start + 2);
    return end === -1 ? source.length : end + 2;
  }

  const isRegex = opener === "/" && !ENDS_A_VALUE.test(previous);

  if (!isRegex && opener !== '"' && opener !== "'" && opener !== "`") {
    return null;
  }

  let index = start + 1;
  let inCharacterClass = false;

  while (index < source.length) {
    const character = source[index];

    if (character === "\\") {
      index += 2;
      continue;
    }

    if (isRegex && character === "[") inCharacterClass = true;
    else if (isRegex && character === "]") inCharacterClass = false;
    else if (character === opener && !inCharacterClass) return index + 1;
    // An unterminated quote is a misread rather than a real literal, so it ends
    // at the line break instead of consuming the rest of the file.
    else if (character === "\n" && opener !== "`") return index;

    index += 1;
  }

  return source.length;
}

/**
 * The source split into code, comments and literals in one pass.
 *
 * One pass rather than two regex sweeps, because the two orderings a sweep can
 * take are wrong in opposite directions. Blanking comments first rewrites a glob
 * such as "src/**" followed later by "*\/y", whose two string literals open and
 * close a block comment between them and take the code in between with them.
 * Blanking literals first reads the apostrophe in a comment's "the file's own"
 * as opening a string, and swallows to the next apostrophe. A scanner that knows
 * which construct it is inside has neither failure.
 */
function spans(source: string): Span[] {
  const found: Span[] = [];
  let index = 0;
  let codeStart = 0;
  let previous = "";

  while (index < source.length) {
    const end = spanEnd(source, index, previous);

    if (end === null) {
      const character = source[index];
      if (!/\s/.test(character)) previous = character;
      index += 1;
      continue;
    }

    if (index > codeStart) {
      found.push({ start: codeStart, end: index, kind: "code" });
    }

    const following = source[index + 1];

    found.push({
      start: index,
      end,
      kind:
        source[index] === "/" && (following === "/" || following === "*")
          ? "comment"
          : "literal",
    });

    previous = source[end - 1];
    index = end;
    codeStart = end;
  }

  if (index > codeStart) {
    found.push({ start: codeStart, end: index, kind: "code" });
  }

  return found;
}

/** A span reduced to spaces, keeping its line breaks so offsets still line up. */
function blank(text: string): string {
  return text.replace(/[^\n]/g, " ");
}

/**
 * Source with comments blanked out, so a construct named in prose is never
 * mistaken for one the file actually performs.
 *
 * Literals are kept rather than blanked. They are part of the code, and one
 * guard below reads the provider name out of one.
 */
function stripComments(source: string): string {
  return spans(source)
    .map((span) => {
      const text = source.slice(span.start, span.end);
      return span.kind === "comment" ? blank(text) : text;
    })
    .join("");
}

/**
 * Source with everything that is not code blanked out, so an index into it is an
 * index into the original and every character it still shows is code. This is
 * what the parenthesis counting below reads: a string holding a bracket and a
 * pattern such as /\(/ both carry parentheses that balance nothing.
 */
function codeMask(source: string): string {
  return spans(source)
    .map((span) => {
      const text = source.slice(span.start, span.end);
      return span.kind === "code" ? text : blank(text);
    })
    .join("");
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
 * A block comment handed to normalizeProse with the leading asterisk stripped from
 * every line. The third copy of the provenance paragraph lived in a comment, where
 * every line begins with an asterisk, so an absence assertion that skipped the strip
 * would pass on a reintroduced copy for the wrong reason.
 */
function normalizeComment(source: string): string {
  return normalizeProse(source.replace(/^[ \t]*\*[ ]?/gm, ""));
}

/**
 * The argument text of every call to the named callee, sliced on balanced parentheses
 * so each call site can be judged on its own arguments instead of on whether the file
 * mentions an option somewhere.
 */
function callArguments(source: string, callee: string): string[] {
  // Matched and counted over the mask so a call named inside a string is not
  // found and a bracket inside one does not close the slice, then sliced out of
  // the source so the caller reads the arguments as written.
  const mask = codeMask(source);
  const pattern = new RegExp(`${callee}\\s*\\(`, "g");
  const found: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(mask)) !== null) {
    const start = match.index + match[0].length;
    let index = start;
    let depth = 1;

    while (index < mask.length && depth > 0) {
      const character = mask[index];
      if (character === "(") depth += 1;
      else if (character === ")") depth -= 1;
      index += 1;
    }

    found.push(source.slice(start, index - 1));
  }

  return found;
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

const scannedFiles = findTestFiles(projectRoot).filter(
  (file) => file !== guardFile,
);

/** browserslist wherever it is configured: inline, keyed by env, or in its own file. */
function browserslistQueries(): unknown[] {
  const configured = manifest.browserslist;

  if (Array.isArray(configured)) return configured;

  if (configured && typeof configured === "object") {
    return Object.values(configured as Record<string, unknown>).flatMap(
      (value) => (Array.isArray(value) ? value : []),
    );
  }

  const rcPath = join(projectRoot, ".browserslistrc");
  if (existsSync(rcPath)) {
    return readFileSync(rcPath, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
  }

  return [];
}

/**
 * Queries whose meaning is decided by upstream data rather than by this manifest.
 * Any of them lets a browserslist data release move the build output with no commit.
 */
const MOVING_QUERY =
  /\b(defaults|last\s+\d+|dead|since\s+\d{4}|unreleased|maintained|current\s+node|node\s+current|extends|supports)\b|%/i;

const FAKES_CLOCK = /\buseFakeTimers\s*\(/;
const CONFIGURES_CLOCK = /\bfakeTimers\s*:/;
const IMPORTS_USER_EVENT = /from\s+["']@testing-library\/user-event["']/;
const BINDS_CLOCK = /\badvanceTimers\b/;
const DISABLES_DELAY = /\bdelay\s*:\s*null\b/;
const DIRECT_USER_EVENT_CALL = /\buserEvent\.(?!setup\b)[A-Za-z]\w*\s*\(/;

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

// The complete coverage include list. One entry, named here for the same
// reason its exclude sibling is written out: narrowing this to a subdirectory
// satisfies a hundred percent by shrinking the gate's input rather than by
// covering the code, and it is the sibling property the exclude guard does not
// reach.
const COVERAGE_INCLUDE_PATTERNS = ["src/**/*.{ts,tsx}"];

// A suppression comment in any provider's spelling, matched against raw source
// because a hint is itself a comment and blanking comments first would make the
// guard vacuous. None exists in this tree: the standing convention is that an
// otherwise-unreachable branch records the condition that would make it
// reachable, never that it is hidden from the report.
const COVERAGE_IGNORE_HINT = /\b(?:v8|c8|istanbul|node)\s+ignore\b/;

const CONFIG_FILE = "vite.config.ts";
const WORKFLOW_FILE = ".github/workflows/ci.yml";
const SONAR_FILE = "sonar-project.properties";

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
    ? braces[1].split(",").map((option) => pattern.replace(braces[0], option))
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

  return [...declared[1].matchAll(/"([^"]*)"/g)].map((match) => match[1]);
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
    [...match[1].matchAll(/"([^"]*)"/g)].map((entry) =>
      entry[1].replace(/^\.\//, ""),
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

describe("toolchain baseline", () => {
  // The previous runner and its adapters were removed rather than ported.
  // Any one of them reappearing means a second, competing test toolchain is back.
  it("keeps the previous test runner and its adapters out of the manifest", () => {
    const declared = new Set(
      Object.entries(manifest)
        .filter(([key]) => /dependencies$/i.test(key) || key === "overrides")
        .flatMap(([, bucket]) =>
          bucket && typeof bucket === "object"
            ? Object.keys(bucket as Record<string, unknown>)
            : [],
        ),
    );

    const retired = [
      "jest",
      "jest-environment-jsdom",
      "ts-jest",
      "ts-node",
      "@types/jest",
      "identity-obj-proxy",
      "jest-transformer-svg",
    ];

    expect(retired.filter((name) => declared.has(name))).toEqual([]);
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

  // The guard above covers the script a developer types and neither of the two
  // the pipeline runs. Both are asserted as the properties that make them gates
  // rather than as one string, for the same reason: adding a flag is free and
  // dropping the one that matters is not.
  //
  // Without --coverage nothing measures coverage, so the threshold is never
  // evaluated and coverage/lcov.info is never written, which the Sonar import
  // reads as a silent zero rather than as an error. Without the browser project
  // named, the browser script fans out to every project and reports the
  // deterministic suite a second time as if it were the real-engine one.
  it("keeps the coverage and browser scripts carrying the flags their gates need", () => {
    const coverage = manifest.scripts?.["test:coverage"] ?? "";

    expect(coverage, "the coverage script collects no coverage").toMatch(
      /(^|\s)--coverage\b/,
    );
    expect(coverage, "the coverage script names no project").toMatch(
      /--project[= ]jsdom\b/,
    );

    expect(
      manifest.scripts?.["test:browser"] ?? "",
      "the browser script does not name the browser project",
    ).toMatch(/--project[= ]browser\b/);
  });

  // A gate nothing invokes is not a gate. The browser project and its one test
  // file both survive the deletion of the step that runs them, so the pipeline
  // is asserted to name both scripts rather than the manifest alone being
  // trusted to imply that something calls them.
  it("runs both test gates from the pipeline", () => {
    // Judged on live lines only, for the reason the pre-commit guard is:
    // commenting a step out leaves every expected string in the file.
    const live = readFileSync(join(projectRoot, WORKFLOW_FILE), "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));

    for (const script of ["npm run test:coverage", "npm run test:browser"]) {
      expect(
        live.some((line) => line.includes(script)),
        `${WORKFLOW_FILE} no longer runs ${script}`,
      ).toBe(true);
    }
  });

  // Most of the hook rule family is registered at warn rather than error by the
  // plugin's own config, exhaustive-deps among them. Without the flag the gate
  // exits zero with all of them reported, so neither the pipeline nor the
  // pre-commit hook can fail on the rule that guards every dependency array in
  // the tree.
  it("fails the lint gate on a warning as well as an error", () => {
    expect(manifest.scripts?.lint).toContain("--max-warnings 0");
  });

  // The svg transformer that handled this asset is gone, and the asset went with it.
  it("keeps the orphaned logo asset deleted", () => {
    expect(existsSync(join(projectRoot, "src", "logo.svg"))).toBe(false);
  });

  // browserslist is pinned to explicit versions like the rest of the manifest. A
  // shared query such as "defaults" or "last 2 versions" would let upstream data
  // releases move the build output without a commit.
  it("pins browserslist to explicit versions rather than a moving query", () => {
    const queries = browserslistQueries();

    expect(
      queries.length,
      "browserslist is configured nowhere",
    ).toBeGreaterThan(0);

    for (const query of queries) {
      expect(typeof query, `${String(query)} is not a string`).toBe("string");
      expect(query as string, `${String(query)} is a moving query`).not.toMatch(
        MOVING_QUERY,
      );
      expect(
        query as string,
        `${String(query)} names no explicit version`,
      ).toMatch(/\d/);
    }
  });

  // CI runs the format check and so does the hook, which catches drift before it
  // becomes a commit rather than after it becomes a push.
  it("runs lint and the format check from the pre-commit hook", () => {
    const hookPath = join(projectRoot, ".husky", "pre-commit");

    expect(existsSync(hookPath), ".husky/pre-commit is missing").toBe(true);

    // Judged on live lines only: commenting the commands out and falling through to
    // a bare exit disables the hook while leaving every expected string in the file.
    const live = readFileSync(hookPath, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));

    expect(live.some((line) => line.includes("npm run lint"))).toBe(true);
    expect(live.some((line) => line.includes("npm run format:check"))).toBe(
      true,
    );
  });

  // A faked clock plus the user input library deadlocks unless the library is told
  // which clock to advance, and a file that never restores the real clock leaks the
  // fake one into whatever runs next. Both were found the hard way during the
  // migration, so both are asserted across the whole tree rather than in the one
  // file that happened to hit them.
  it("binds every faked clock correctly in every test file", () => {
    expect(scannedFiles.length).toBeGreaterThan(0);

    const offenders: string[] = [];

    for (const file of scannedFiles) {
      const source = stripComments(readFileSync(file, "utf8"));
      if (!FAKES_CLOCK.test(source)) continue;

      const name = relative(projectRoot, file);

      // Required inside the teardown hook rather than anywhere in the file, since a
      // restore that only ever runs on the happy path is not a restore.
      if (
        !callArguments(source, "afterEach").some((body) =>
          /useRealTimers/.test(body),
        )
      ) {
        offenders.push(`${name}: never restores the clock in an afterEach`);
      }

      if (!IMPORTS_USER_EVENT.test(source)) continue;

      // The library's direct entry points construct their own session with a no-op
      // clock advance, so they wait on a real timer the frozen clock never fires.
      // There is no argument to correct; the session form is the only bindable one.
      if (DIRECT_USER_EVENT_CALL.test(source)) {
        offenders.push(
          `${name}: calls the input library directly, which cannot be bound to a fake clock`,
        );
      }

      // Judged per call site: one bound session elsewhere in the file says nothing
      // about this one.
      for (const args of callArguments(source, "userEvent\\.setup")) {
        if (!BINDS_CLOCK.test(args) && !DISABLES_DELAY.test(args)) {
          offenders.push(
            `${name}: opens an input session that is not bound to the fake clock`,
          );
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  // The guard above only sees files it recognises as tests. A clock installed from
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
  it("asserts something, and no more renders than assertions, in every test file", () => {
    expect(scannedFiles.length).toBeGreaterThan(0);

    const offenders: string[] = [];

    for (const file of scannedFiles) {
      const source = stripComments(readFileSync(file, "utf8"));
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

  // The threshold is the single line that turns the number into a gate, and the
  // include list decides what the number is measured over. Both sit beside the
  // exclude list and neither was guarded, so the gate could be reverted to a
  // report, or fitted to a third of the tree, with every other guard green.
  // Compared the same way the exclude list is: reordering is not a weakening
  // and must not flap, while narrowing, widening or emptying must all fail.
  it("keeps the coverage gate at a hundred percent over the whole source tree", () => {
    expect(
      coverageBlock(),
      `${CONFIG_FILE} declares no hundred percent coverage threshold`,
    ).toMatch(/thresholds\s*:\s*\{\s*100\s*:\s*true\s*,?\s*\}/);

    const patterns = coveragePatterns("include");

    expect(
      patterns,
      `${CONFIG_FILE} declares no coverage include list`,
    ).not.toBeNull();

    expect(patterns?.toSorted()).toEqual(COVERAGE_INCLUDE_PATTERNS.toSorted());
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
        .map((match) => match[1])
        .toSorted();

    const shipped = globalSheets("src/index.tsx");

    expect(
      shipped.length,
      "src/index.tsx imports no global stylesheet",
    ).toBeGreaterThan(0);

    expect(globalSheets("src/a11y.browser.test.tsx")).toEqual(shipped);
  });

  // The footer carries this same attribution and has its own test. The README
  // copy has nothing watching it, so a documentation rewrite could drop the
  // source link, the licence link, or the record of what was changed, and the
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

  // The README and the licence file already disagreed once, in the direction of
  // the README claiming a fresh CSV run the artifact's own tie-break ordering
  // disproves. Removal was guarded in neither document and divergence was guarded
  // in neither, so the wrong copy sat beside the right one with the suite green.
  // Both documents are asserted here from one pair of literals, which makes a
  // rewrite of either one alone a red test rather than a silent contradiction.
  it("keeps one account of the dataset's provenance in the README and the licence file", () => {
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
});
