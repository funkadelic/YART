import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards over the toolchain baseline itself. The migration established each
 * convention below once, and nothing else in the suite notices if one of them is
 * quietly undone.
 */

const projectRoot = process.cwd();

interface Manifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  browserslist?: unknown;
  scripts?: Record<string, string>;
}

const manifest = JSON.parse(
  readFileSync(join(projectRoot, "package.json"), "utf8"),
) as Manifest;

/**
 * Every test file under the source tree, found by walking rather than by asking git,
 * so the guard still works from an exported tarball.
 */
function findTestFiles(directory: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);

    if (entry.isDirectory()) {
      found.push(...findTestFiles(absolute));
    } else if (/\.test\.tsx?$/.test(entry.name)) {
      found.push(absolute);
    }
  }

  return found;
}

const testFiles = findTestFiles(join(projectRoot, "src"));

const guardFile = join(projectRoot, "src", "toolchain.test.ts");

describe("toolchain baseline", () => {
  // The previous runner and its adapters were removed rather than ported.
  // Any one of them reappearing means a second, competing test toolchain is back.
  it("keeps the previous test runner and its adapters out of the manifest", () => {
    const installed = {
      ...manifest.dependencies,
      ...manifest.devDependencies,
    };

    const retired = [
      "jest",
      "jest-environment-jsdom",
      "ts-jest",
      "ts-node",
      "@types/jest",
      "identity-obj-proxy",
      "jest-transformer-svg",
    ];

    expect(retired.filter((name) => name in installed)).toEqual([]);
  });

  // The svg transformer that handled this asset is gone, and the asset went with it.
  it("keeps the orphaned logo asset deleted", () => {
    expect(existsSync(join(projectRoot, "src", "logo.svg"))).toBe(false);
  });

  // browserslist is pinned to explicit versions like the rest of the
  // manifest. A shared query such as "defaults" or "last 2 versions" would let
  // upstream data releases move the build output without a commit.
  it("pins browserslist to explicit versions rather than a moving query", () => {
    const queries = manifest.browserslist;

    expect(Array.isArray(queries)).toBe(true);

    for (const query of queries as string[]) {
      expect(query).toMatch(/^\S+\s+>=\s+\d+(\.\d+)*$/);
    }
  });

  // CI runs the format check and so does the hook, which catches drift before it
  // becomes a commit rather than after it becomes a push.
  it("runs lint and the format check from the pre-commit hook", () => {
    const hook = readFileSync(
      join(projectRoot, ".husky", "pre-commit"),
      "utf8",
    );

    expect(hook).toContain("npm run lint");
    expect(hook).toContain("npm run format:check");
  });

  // A faked clock plus the user input library deadlocks unless the
  // library is told which clock to advance, and a file that never restores the
  // real clock leaks the fake one into whatever runs next. Both were found the
  // hard way during the migration, so both are asserted across the whole tree
  // rather than in the one file that happened to hit them.
  it("binds every faked clock correctly in every test file", () => {
    expect(testFiles.length).toBeGreaterThan(0);

    const offenders: string[] = [];

    for (const file of testFiles) {
      const name = relative(projectRoot, file);

      // This file names the timer APIs to search for them, so it matches its own
      // patterns without ever faking a clock.
      if (file === guardFile) continue;

      const source = readFileSync(file, "utf8");
      if (!source.includes("useFakeTimers")) continue;

      if (!source.includes("useRealTimers")) {
        offenders.push(`${name}: fakes the clock and never restores it`);
      }

      // Matched as an option key, not as a bare substring: a file can call
      // advanceTimersByTimeAsync all it likes and still have left the input
      // library pointed at the real clock.
      if (
        source.includes("userEvent.setup") &&
        !/\badvanceTimers\s*:/.test(source)
      ) {
        offenders.push(`${name}: drives user input against an unbound clock`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
