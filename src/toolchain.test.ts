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
 * Source with comments blanked out, so a construct named in prose is never mistaken
 * for one the file actually performs. String literals holding a `//` sequence survive
 * only if they carry the usual scheme colon, which is enough for test sources.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
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
  const pattern = new RegExp(`${callee}\\s*\\(`, "g");
  const found: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    const start = match.index + match[0].length;
    let index = start;
    let depth = 1;

    while (index < source.length && depth > 0) {
      const character = source[index];
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
  // reads, so that possibility is closed here rather than left implicit.
  it("installs no global fake clock outside the test files", () => {
    for (const name of ["vitest.setup.ts", "vite.config.ts"]) {
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
