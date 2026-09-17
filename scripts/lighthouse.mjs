/**
 * Audits the production build with Lighthouse and prints the median metrics.
 * Run it with `npm run lighthouse` after `npm run build`.
 */

import {
  appendFileSync,
  accessSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";
import { computeMedianRun } from "lighthouse/core/lib/median-run.js";

const root = join(import.meta.dirname, "..");
const OUTPUT = join(root, "lighthouse");
const INSTALL_HINT = "npx playwright install --with-deps --only-shell chromium";
const RUNS = 3;
const PAGES = [
  { name: "Cities", slug: "cities", path: "/" },
  { name: "Films", slug: "films", path: "/movies.html" },
];

/** Milliseconds as seconds to one decimal. */
const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`;
/** Table columns: header, how to read the value off a run, how to print it. */
const METRICS = [
  ["Score", (lhr) => lhr.categories.performance.score * 100, Math.round],
  ["FCP", (lhr) => lhr.audits["first-contentful-paint"].numericValue, seconds],
  [
    "LCP",
    (lhr) => lhr.audits["largest-contentful-paint"].numericValue,
    seconds,
  ],
  [
    "TBT",
    (lhr) => lhr.audits["total-blocking-time"].numericValue,
    (ms) => `${Math.round(ms)}ms`,
  ],
  [
    "CLS",
    (lhr) => lhr.audits["cumulative-layout-shift"].numericValue,
    (value) => value.toFixed(3),
  ],
  ["Speed Index", (lhr) => lhr.audits["speed-index"].numericValue, seconds],
];

/** Throws unless both shells of the build are on disk. */
function assertBuilt() {
  for (const shell of ["index.html", "movies.html"]) {
    if (!existsSync(join(root, "dist", shell))) {
      throw new Error(`dist/${shell} is missing; run \`npm run build\` first.`);
    }
  }
}

/** A loopback port the OS reports free. */
function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

/** Resolves once the preview answers OK, rejecting if it exits or times out. */
function waitForPreview(child, url) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 30_000;
    const onExit = (code) =>
      reject(new Error(`vite preview exited early with code ${code}.`));
    child.once("exit", onExit);
    const poll = async () => {
      try {
        if ((await fetch(url)).ok) {
          child.off("exit", onExit);
          return resolve();
        }
      } catch {
        // Not listening yet.
      }
      if (Date.now() > deadline) {
        child.off("exit", onExit);
        return reject(new Error(`vite preview did not answer at ${url}.`));
      }
      setTimeout(poll, 200);
    };
    poll();
  });
}

// ponytail: Playwright exports no path for the headless shell, so this mirrors its cache layout; use an exported path if one appears.
/** The headless shell binary installed beside Playwright's full Chromium. */
function headlessShellPath() {
  const [, cache, revision] =
    /^(.*)[\\/]chromium-(\d+)[\\/]/.exec(chromium.executablePath()) ?? [];
  const shellRoot = join(`${cache}`, `chromium_headless_shell-${revision}`);
  const binary = `chrome-headless-shell${process.platform === "win32" ? ".exe" : ""}`;
  try {
    const platformDir = readdirSync(shellRoot).find((name) =>
      name.startsWith("chrome-headless-shell-"),
    );
    const path = join(shellRoot, `${platformDir}`, binary);
    accessSync(path);
    return path;
  } catch (error) {
    throw new Error(`Headless shell not found; run \`${INSTALL_HINT}\`.`, {
      cause: error,
    });
  }
}

/** Runs one audit and throws when Lighthouse could not load the page. */
async function audit(url, port) {
  const result = await lighthouse(url, {
    port,
    output: ["html", "json"],
    onlyCategories: ["performance"],
  });
  if (!result) throw new Error(`Lighthouse returned no result for ${url}.`);
  const { runtimeError } = result.lhr;
  if (runtimeError) {
    throw new Error(
      `Lighthouse failed on ${url}: ${runtimeError.code} ${runtimeError.message}`,
    );
  }
  return result;
}

/** The middle value of an odd-length list. */
function median(values) {
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
}

/** One table row of per-metric medians over a page's runs. */
function medianRow(page, runs) {
  const cells = METRICS.map(([metric, read, format]) => {
    const values = runs.map(({ lhr }) => read(lhr));
    if (!values.every(Number.isFinite)) {
      throw new Error(`${page.name}: ${metric} is not a finite number.`);
    }
    return format(median(values));
  });
  return `| ${[page.name, ...cells].join(" | ")} |`;
}

/** Writes the run closest to the median as the page's HTML and JSON report. */
function writeMedianReport(page, runs) {
  const lhrs = runs.map(({ lhr }) => lhr);
  const [html, json] = runs[lhrs.indexOf(computeMedianRun(lhrs))].report;
  mkdirSync(OUTPUT, { recursive: true });
  writeFileSync(join(OUTPUT, `${page.slug}.report.html`), html);
  writeFileSync(join(OUTPUT, `${page.slug}.report.json`), json);
}

/** Audits one page RUNS times, writes its report and returns its table row. */
async function auditPage(page, url, port) {
  const runs = [];
  for (let run = 0; run < RUNS; run++) runs.push(await audit(url, port));
  writeMedianReport(page, runs);
  return medianRow(page, runs);
}

/** Prints the medians table and saves copies for the job summary and PR comment. */
function report(rows) {
  const header = ["Page", ...METRICS.map(([metric]) => metric)];
  const table = [
    `### Lighthouse, median of ${RUNS} mobile runs`,
    "",
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...rows,
  ].join("\n");
  console.log(table);
  writeFileSync(join(OUTPUT, "summary.md"), `${table}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${table}\n`);
  }
}

/** Serves the build, audits it and stops everything it started. */
async function main() {
  assertBuilt();
  const chromePath = headlessShellPath();
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const preview = spawn(
    process.execPath,
    [
      join(root, "node_modules/vite/bin/vite.js"),
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    { cwd: root, stdio: ["ignore", "ignore", "inherit"] },
  );
  // Passed twice: on WSL chrome-launcher rewrites the option to a Windows path,
  // and the last --user-data-dir flag wins.
  const profile = mkdtempSync(join(tmpdir(), "lighthouse-"));
  let chrome;
  try {
    await waitForPreview(preview, `${base}/`);
    // Playwright launches the other two sites unsandboxed too; runners have no usable sandbox.
    chrome = await launch({
      chromePath,
      userDataDir: profile,
      chromeFlags: ["--headless", "--no-sandbox", `--user-data-dir=${profile}`],
    });
    const rows = [];
    for (const page of PAGES) {
      rows.push(await auditPage(page, `${base}${page.path}`, chrome.port));
    }
    report(rows);
  } finally {
    chrome?.kill();
    preview.kill();
    rmSync(profile, { recursive: true, force: true, maxRetries: 10 });
  }
}

await main();
