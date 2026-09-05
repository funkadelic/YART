/**
 * Generates the committed film dataset asset, src/data/films/films.json, from a
 * SPARQL result downloaded from the Wikidata Query Service.
 *
 * Run it with `npm run generate:films`. Its only inputs and outputs are files
 * inside this repository: no network client is imported, so regenerating the
 * dataset can never introduce a build-time trust boundary. The query, the curl
 * invocation that downloads its result, and the service limits that make a
 * manual run the right shape are recorded in src/data/films/license.md.
 */

import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
// Imported, so this file is clean under the browser-globals lint config the
// rest of the repo uses.
import process from "node:process";

// Resolved from this file's own location, because the working directory is
// wherever npm happened to be invoked and is not necessarily the project root.
const dataDir = join(import.meta.dirname, "..", "src", "data", "films");
const DEFAULT_INPUT_PATH = join(import.meta.dirname, "films-result.json");
const OUTPUT_PATH = join(dataDir, "films.json");

/**
 * The version stamped into the envelope: the date the query was run, followed by
 * a repo-local revision counter.
 *
 * Wikidata publishes no release number, so the query date is the only stable
 * upstream identifier available. Bump the +rN suffix whenever this generator's
 * output changes for a reason other than a fresh export, because the date alone
 * cannot distinguish two different local transforms of the same export.
 */
const DATASET_VERSION = "2026-09-04+r1";

/**
 * The single declaration of column order in this generator. It must equal the
 * loader's own column constant in src/data/films, which asserts the asset's
 * declared order and refuses the payload when the two disagree.
 */
const COLUMN_ORDER = Object.freeze([
  "id",
  "title",
  "year",
  "runtime",
  "directors",
  "genres",
  "countries",
]);

/** The three fields GROUP_CONCAT returns joined, in column order. */
const MULTI_VALUED = Object.freeze(["directors", "genres", "countries"]);

/**
 * The character films.rq joins each group on.
 *
 * ponytail: a label containing this character splits into two names and is
 * accepted, because a joined string cannot say which it was. No English label
 * in the current export carries one. Switch both this and films.rq to a control
 * character such as U+001F if that ever stops being true, which costs a fresh
 * download because the recorded query has to run again to produce a result the
 * new separator can split.
 */
const SEPARATOR = "|";

// buildEnvelope and formatEnvelope are copied from scripts/generate-cities.mjs,
// not imported, because both close over that file's own DATASET_VERSION and
// COLUMN_ORDER and parameterizing them for two callers is the larger move. At a
// third dataset, lift the pair into a shared scripts/envelope.mjs.

/**
 * Wraps the rows in the envelope the loader expects. The declared column list
 * turns the tuple shape's one real defect, a silently shifted field, into a loud
 * startup failure.
 */
export function buildEnvelope(rows) {
  rows.forEach((row, index) => {
    if (!Array.isArray(row) || row.length !== COLUMN_ORDER.length) {
      throw new Error(
        `Row ${index} is not an array of ${COLUMN_ORDER.length} elements.`,
      );
    }
  });

  return { version: DATASET_VERSION, columns: COLUMN_ORDER, rows };
}

/**
 * Serializes the envelope with every row on its own line.
 *
 * The line-per-row layout is why the tuple shape was chosen, because it makes a
 * single corrected film a one-line diff. A plain JSON.stringify puts the whole
 * payload on one line, and the reviewability argument for this shape collapses
 * with it.
 */
export function formatEnvelope(envelope) {
  const lines = [
    "{",
    `  "version": ${JSON.stringify(envelope.version)},`,
    `  "columns": ${JSON.stringify(envelope.columns)},`,
    '  "rows": [',
  ];

  if (envelope.rows.length > 0) {
    lines.push(
      envelope.rows.map((row) => `    ${JSON.stringify(row)}`).join(",\n"),
    );
  }

  lines.push("  ]", "}", "");

  return lines.join("\n");
}

/**
 * An unbound OPTIONAL omits its key from the binding object and does not bind
 * an empty string, so absence is the null signal for every optional field.
 */
function literal(binding, name) {
  return binding[name]?.value;
}

/**
 * Maps a SPARQL JSON result onto the envelope's column order.
 *
 * Rows are ordered by ascending Q-id and every multi-valued field is sorted, so
 * two exports of the same data serialize identically and a corrected film stays
 * a one-line diff. Neither order comes from upstream: SPARQL promises no row
 * order and GROUP_CONCAT none within a group.
 */
export function parseSparqlResult(text) {
  const bindings = JSON.parse(text)?.results?.bindings;
  if (!Array.isArray(bindings)) {
    throw new Error("The query result carries no results.bindings array.");
  }

  const rows = bindings.map((binding, index) => {
    const uri = literal(binding, "film");
    if (uri === undefined) {
      throw new Error(`Binding ${index} has no film URI.`);
    }

    // The tail segment of the entity URI. Already injective, so unlike the
    // cities id it needs no padding and no synthetic fallback. Validated here,
    // and not left to the asset check, because the sort below reads the digits
    // off it. A tail that is not an entity id yields NaN, and a comparator
    // returning NaN reorders the rows with no error anywhere.
    const id = uri.slice(uri.lastIndexOf("/") + 1);
    if (!/^Q[0-9]+$/.test(id)) {
      throw new Error(
        `Binding ${index} has a film URI that is not an entity id: ${uri}`,
      );
    }

    const title = literal(binding, "title");
    if (title === undefined || title === "") {
      throw new Error(`Film ${id} has no English title.`);
    }

    // Upstream values are emitted verbatim, the one title carrying an em dash
    // and the thirty carrying en dashes included. This project's rule against
    // those characters governs prose it authors, and normalizing a title would
    // break reproducibility from the recorded query.
    const row = [id, title];

    // Number, because at least one runtime is fractional and an integer parse
    // would truncate it silently.
    for (const name of ["year", "runtime"]) {
      const raw = literal(binding, name);
      if (raw === undefined) {
        row.push(null);
        continue;
      }
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        throw new Error(
          `Film ${id} has a ${name} that is not a number: ${JSON.stringify(raw)}`,
        );
      }
      row.push(value);
    }

    // Split here, once, at generation time, so no comparator and no cell renderer
    // ever has to take a joined string apart, and sorted so the committed asset
    // is canonical and a regeneration cannot permute it. GROUP_CONCAT promises no
    // order within a group.
    //
    // The empty-element check catches a value that begins or ends with the
    // separator. It cannot catch a separator in the middle of a label, which
    // splits into two non-empty names and is accepted: the joined string is
    // genuinely ambiguous and no check downstream can recover the intent. See
    // the ceiling recorded on SEPARATOR.
    for (const name of MULTI_VALUED) {
      const raw = literal(binding, name);
      const values = raw === undefined ? [] : raw.split(SEPARATOR);
      if (values.some((value) => value === "")) {
        throw new Error(
          `Film ${id} has a ${name} value that starts or ends with the separator: ${JSON.stringify(raw)}`,
        );
      }
      row.push(values.sort());
    }

    return row;
  });

  rows.sort(
    (left, right) => Number(left[0].slice(1)) - Number(right[0].slice(1)),
  );

  return rows;
}

/**
 * Reports every way the export stops exercising the row shape this dataset was
 * taken for. An asset with no null and no empty list still parses and renders,
 * so it would pass every check while exercising none of those shapes.
 */
export function checkShape(rows) {
  const problems = [];
  const ids = rows.map((row) => row[0]);

  if (new Set(ids).size !== ids.length) {
    problems.push("some film ids repeat, so the row id is not injective");
  }
  if (!rows.some((row) => row[2] === null)) {
    problems.push("no row carries a null year");
  }
  if (!rows.some((row) => row[3] === null)) {
    problems.push("no row carries a null runtime");
  }
  MULTI_VALUED.forEach((name, at) => {
    if (!rows.some((row) => row[4 + at].length === 0)) {
      problems.push(`no row carries an empty ${name} list`);
    }
  });
  if (!rows.some((row) => row[5].length > 1)) {
    problems.push("no row carries more than one genre");
  }

  return problems;
}

function main(args) {
  const inputPath = args[0] ? resolve(args[0]) : DEFAULT_INPUT_PATH;

  if (!existsSync(inputPath)) {
    process.stderr.write(
      `No Wikidata query result at ${inputPath}.\n` +
        "Download it with:\n" +
        "  curl -sS -G https://query.wikidata.org/sparql \\\n" +
        '    --data-urlencode "query@scripts/films.rq" \\\n' +
        '    -H "Accept: application/sparql-results+json" \\\n' +
        '    -A "YART/0.1 (https://github.com/funkadelic/YART)" \\\n' +
        "    -o scripts/films-result.json\n" +
        "The user agent is not optional; see src/data/films/license.md.\n",
    );
    process.exitCode = 1;
    return;
  }

  const rows = parseSparqlResult(readFileSync(inputPath, "utf8"));
  const problems = checkShape(rows);

  if (problems.length > 0) {
    process.stderr.write(
      `The export no longer carries the shape this dataset was taken for:\n${problems
        .map((problem) => `  ${problem}\n`)
        .join("")}Nothing was written.\n`,
    );
    process.exitCode = 1;
    return;
  }

  writeFileSync(OUTPUT_PATH, formatEnvelope(buildEnvelope(rows)), "utf8");
  process.stdout.write(
    `Wrote ${rows.length} rows, ${statSync(OUTPUT_PATH).size} bytes, to ${OUTPUT_PATH}\n`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  main(process.argv.slice(2));
}
