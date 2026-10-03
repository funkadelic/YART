/**
 * Packs the library once and installs the tarball into a scratch app, which
 * typechecks against it and renders the table. Run it with `npm run test:package`.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

// Resolved from this file, so the run does not depend on the caller's cwd.
const root = join(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const REQUIRED = ["lib/index.js", "lib/styles.css", "lib/types/yart.d.ts"];
const ALLOWED_TOP = ["package.json", "README.md", "LICENSE", "CHANGELOG.md"];

const SCRATCH_TSCONFIG = {
  compilerOptions: {
    target: "es2022",
    module: "esnext",
    moduleResolution: "bundler",
    jsx: "react-jsx",
    strict: true,
    exactOptionalPropertyTypes: true,
    noUncheckedIndexedAccess: true,
    skipLibCheck: false,
    lib: ["es2022", "dom"],
    outDir: "out",
  },
  include: ["app.tsx", "styles.ts", "css.d.ts"],
};

const APP = `import { renderToString } from "react-dom/server";
import {
  columns,
  DataTable,
  DEFAULT_TABLE_STATE,
  englishSearchLabels,
  englishTableLabels,
  SearchInput,
} from "yet-another-react-table";

interface Part {
  sku: string;
  name: string;
  qty: number;
}

const rows: Part[] = [
  { sku: "fc-1", name: "Flux capacitor", qty: 1 },
  { sku: "md-2", name: "Mr. Fusion", qty: 3 },
];

const col = columns<Part>(new Intl.Collator("en"));
const cols = [
  col.key("name", { label: "Name" }),
  col.key("qty", { label: "Quantity", numeric: true }),
];

const noop = () => {};

const html = renderToString(
  <>
    <SearchInput value="" onChange={noop} labels={englishSearchLabels} />
    <DataTable
      rows={rows}
      columns={cols}
      getRowId={(row) => row.sku}
      state={DEFAULT_TABLE_STATE}
      onSortChange={noop}
      onPageChange={noop}
      onPageSizeChange={noop}
      loading={false}
      datasetReady={true}
      errorMessage={null}
      labels={{ ...englishTableLabels, empty: "No parts" }}
    />
  </>,
);

if (!html.includes("Flux capacitor")) {
  throw new Error("rendered markup lacks the row text");
}
if (!html.includes(englishTableLabels.caption(2, englishTableLabels.unsorted))) {
  throw new Error("rendered markup lacks the English caption");
}
console.log(\`rendered \${html.length} chars\`);
`;

// npm run re-exports a configured allow-scripts as an env var, which a
// project-scoped install rejects; the scratch install reads it from .npmrc.
const childEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) => key.toLowerCase() !== "npm_config_allow_scripts",
  ),
);

/** Runs a command, streaming its output, and throws on a non-zero exit. */
function run(command, args, cwd) {
  execFileSync(command, args, { cwd, env: childEnv, stdio: "inherit" });
}

/** Packs the repo once into dir and returns the tarball path and file list. */
function pack(dir) {
  // --ignore-scripts keeps prepack output off stdout; the build already ran.
  const json = execFileSync(
    "npm",
    ["pack", "--json", "--ignore-scripts", "--pack-destination", dir],
    { cwd: root, encoding: "utf8" },
  );
  const [result] = JSON.parse(json);
  return {
    tarball: join(dir, result.filename),
    files: result.files.map((file) => file.path),
  };
}

/** Throws on a packed path outside lib/ and the manifest files, or a missing entry. */
function assertFileList(files) {
  for (const path of files) {
    if (!ALLOWED_TOP.includes(path) && !path.startsWith("lib/")) {
      throw new Error(`unexpected path in tarball: ${path}`);
    }
  }
  for (const path of REQUIRED) {
    if (!files.includes(path)) {
      throw new Error(`missing from tarball: ${path}`);
    }
  }
}

/** Writes the scratch app's manifest, config and sources into dir. */
function writeScratchApp(dir) {
  const files = {
    "package.json": JSON.stringify({ private: true, type: "module" }),
    "tsconfig.json": JSON.stringify(SCRATCH_TSCONFIG),
    "css.d.ts": 'declare module "*.css";\n',
    "styles.ts": 'import "yet-another-react-table/styles.css";\n',
    "app.tsx": APP,
  };
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
  }
}

/** The repo's exact version of a dev dependency, as an install spec. */
function pinned(name) {
  return `${name}@${manifest.devDependencies[name]}`;
}

/** Builds, packs, installs into a scratch app, typechecks and renders. */
function main() {
  run("npm", ["run", "build:lib"], root);

  const packDir = mkdtempSync(join(tmpdir(), "yart-pack-"));
  const appDir = mkdtempSync(join(tmpdir(), "yart-app-"));
  try {
    const { tarball, files } = pack(packDir);
    assertFileList(files);

    writeScratchApp(appDir);
    run(
      "npm",
      [
        "install",
        "--no-audit",
        "--no-fund",
        "--ignore-scripts",
        tarball,
        pinned("react"),
        pinned("react-dom"),
        pinned("typescript"),
        pinned("@types/react"),
        pinned("@types/react-dom"),
      ],
      appDir,
    );
    run(join(appDir, "node_modules", ".bin", "tsc"), ["-p", "."], appDir);
    run("node", ["out/app.js"], appDir);

    const resolved = execFileSync(
      "node",
      [
        "--input-type=module",
        "-e",
        'console.log(import.meta.resolve("yet-another-react-table/styles.css"))',
      ],
      { cwd: appDir, encoding: "utf8" },
    ).trim();
    if (!resolved.endsWith("/lib/styles.css")) {
      throw new Error(`styles.css resolved to ${resolved}`);
    }
  } finally {
    rmSync(packDir, { recursive: true, force: true });
    rmSync(appDir, { recursive: true, force: true });
  }
  console.log("package smoke: ok");
}

main();
